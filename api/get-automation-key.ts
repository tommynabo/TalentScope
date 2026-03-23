/**
 * GET /api/get-automation-key
 * ============================
 * Shadow Accounts pattern: the client's Supabase session token is exchanged
 * for a user-scoped EficacIA API key.  The EficacIA master secret never
 * reaches the browser.
 *
 * ⚠️  This file MUST NOT import anything from src/ — Vite-only APIs like
 *     import.meta.env break in the Vercel Node runtime.
 *
 * Required Vercel environment variables:
 *   VITE_SUPABASE_URL          – Supabase project URL
 *   VITE_SUPABASE_ANON_KEY     – Supabase anon / public key
 *   SUPABASE_SERVICE_ROLE_KEY  – (optional) service-role key for RLS bypass
 *   TALENTSCOPE_MASTER_SECRET  – shared secret used to call EficacIA /provision
 *
 * Required DB migration (run once in Supabase SQL editor):
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS automation_api_key TEXT;
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient }                        from '@supabase/supabase-js';

export const config = { maxDuration: 15 };

// Hardcoded EficacIA provisioning endpoint — no env var needed for the URL
const EFICACIA_PROVISION_URL = 'https://eficac-ia.vercel.app/api/internal/provision';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Wrap everything so we never return an opaque 502
  try {
    // ── CORS preflight ────────────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // ── Cache-Busting ────────────────────────────────────────────────────────
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma',        'no-cache');
    res.setHeader('Expires',       '0');

    // ── Method guard ────────────────────────────────────────────────────────
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // ── Extract Bearer token ─────────────────────────────────────────────────
    const authHeader = ((req.headers['authorization'] as string) ?? '').trim();
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
      return;
    }
    const userToken = authHeader.slice(7).trim();
    if (!userToken) {
      res.status(401).json({ error: 'Empty bearer token' });
      return;
    }

    // ── Build Supabase clients (completely self-contained — no src/ imports) ─
    // Support both Vite-prefixed names and plain names for Vercel env config
    const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
    const anonKey     = (process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '').trim();
    // Prefer service-role for writes; fall back to anon (works if RLS allows it)
    const writeKey    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? anonKey;

    if (!supabaseUrl || !anonKey) {
      res.status(500).json({
        error: 'Server misconfiguration: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set',
      });
      return;
    }

    const opts = { auth: { persistSession: false as const, autoRefreshToken: false as const } };

    // Anon client — used only for getUser() (JWT validation)
    const supabaseAuth  = createClient(supabaseUrl, anonKey,   opts);
    // Write client — service role (or anon+user JWT) for profile reads/writes
    const supabaseAdmin = createClient(supabaseUrl, writeKey,  opts);

    // ── Validate user token → get user identity ──────────────────────────────
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(userToken);
    if (authErr || !user) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }

    // ── Check profiles for an existing key ────────────────────────────────────
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('automation_api_key')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      res.status(500).json({ error: `Profile read failed: ${profileErr.message}` });
      return;
    }

    if (profile?.automation_api_key) {
      res.status(200).json({ apiKey: profile.automation_api_key });
      return;
    }

    // ── Provision a new key from EficacIA ────────────────────────────────────
    const masterSecret = (process.env.TALENTSCOPE_MASTER_SECRET ?? '').trim();
    if (!masterSecret) {
      res.status(500).json({
        error: 'Server misconfiguration: TALENTSCOPE_MASTER_SECRET not set',
      });
      return;
    }

    const provisionRes = await fetch(EFICACIA_PROVISION_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${masterSecret}`,
      },
      body: JSON.stringify({ userId: user.id, email: user.email ?? '' }),
    });

    if (!provisionRes.ok) {
      const text = await provisionRes.text().catch(() => '');
      throw new Error(
        `EficacIA provisioning returned ${provisionRes.status}: ${text.slice(0, 300)}`,
      );
    }

    const payload      = (await provisionRes.json()) as { apiKey?: string; api_key?: string };
    const provisionedKey = (payload.apiKey ?? payload.api_key ?? '').trim();
    if (!provisionedKey) throw new Error('EficacIA returned an empty API key');

    // ── Persist the key (non-fatal on failure) ───────────────────────────────
    const { error: upsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user.id, automation_api_key: provisionedKey }, { onConflict: 'id' });

    if (upsertErr) {
      console.warn('[get-automation-key] Key persistence failed (non-fatal):', upsertErr.message);
    }

    res.status(200).json({ apiKey: provisionedKey });

  } catch (e: unknown) {
    // Catch-all: always return a JSON 500, never an opaque 502
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[get-automation-key] Unhandled error:', msg);
    res.status(500).json({ error: msg });
  }
}

