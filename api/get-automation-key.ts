/**
 * GET /api/get-automation-key
 * ============================
 * Serverless Vercel endpoint that implements the "Shadow Accounts" pattern:
 * the client never handles the EficacIA master secret — it just hits this
 * endpoint with its Supabase session token and receives a user-scoped API key.
 *
 * Flow:
 *  1. Validate the user's Supabase access token.
 *  2. Check profiles.automation_api_key. If present, return it immediately.
 *  3. Otherwise, POST to EficacIA's /api/internal/provision with the master secret.
 *  4. Persist the provisioned key in profiles and return it to the client.
 *
 * Required environment variables (Vercel project settings):
 *   SUPABASE_SERVICE_ROLE_KEY     – service-role key (bypasses RLS for profiles writes)
 *   SUPABASE_URL or VITE_SUPABASE_URL – project URL
 *   EFICACIA_BASE_URL             – EficacIA backend root, e.g. https://api.eficacia.io
 *   TALENTSCOPE_MASTER_SECRET     – shared secret between TalentScope server <> EficacIA
 *
 * Required DB migration (apply once in Supabase SQL editor):
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS automation_api_key TEXT;
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient }                        from '@supabase/supabase-js';

export const config = { maxDuration: 15 };

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // ── Only GET is supported ───────────────────────────────────────────────────
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── 1. Extract + validate Bearer token sent by the frontend ─────────────────
  const authHeader = (req.headers['authorization'] ?? '') as string;
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <token> header' });
    return;
  }
  const userToken = authHeader.slice(7).trim();
  if (!userToken) {
    res.status(401).json({ error: 'Empty bearer token' });
    return;
  }

  // ── 2. Build service-role Supabase client ────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('[get-automation-key] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 3. Validate user token → get user identity ───────────────────────────────
  const { data: { user }, error: authErr } = await supabase.auth.getUser(userToken);
  if (authErr || !user) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  // ── 4. Check for an existing automation key in the user's profile ────────────
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('automation_api_key')
    .eq('id', user.id)
    .maybeSingle();                                 // null if not found, no TS error

  if (profileErr) {
    console.error('[get-automation-key] Profile read error:', profileErr.message);
    res.status(500).json({ error: 'Error fetching user profile' });
    return;
  }

  if (profile?.automation_api_key) {
    res.status(200).json({ apiKey: profile.automation_api_key });
    return;
  }

  // ── 5. Provision a new key from EficacIA backend ─────────────────────────────
  const eficaciaBaseUrl  = (process.env.EFICACIA_BASE_URL  ?? '').replace(/\/$/, '');
  const masterSecret     = process.env.TALENTSCOPE_MASTER_SECRET ?? '';

  if (!eficaciaBaseUrl || !masterSecret) {
    console.error('[get-automation-key] Missing EFICACIA_BASE_URL or TALENTSCOPE_MASTER_SECRET');
    res.status(500).json({
      error:
        'Server misconfiguration: EficacIA provisioning not set up. ' +
        'Add EFICACIA_BASE_URL and TALENTSCOPE_MASTER_SECRET to Vercel environment variables.',
    });
    return;
  }

  let provisionedKey: string;
  try {
    const provisionRes = await fetch(`${eficaciaBaseUrl}/api/internal/provision`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${masterSecret}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        email:   user.email ?? '',
      }),
    });

    if (!provisionRes.ok) {
      const text = await provisionRes.text().catch(() => '');
      throw new Error(`EficacIA responded ${provisionRes.status}: ${text.slice(0, 300)}`);
    }

    // EficacIA can return { apiKey } or { api_key } — handle both conventions
    const payload = (await provisionRes.json()) as { apiKey?: string; api_key?: string };
    provisionedKey = (payload.apiKey ?? payload.api_key ?? '').trim();
    if (!provisionedKey) throw new Error('EficacIA returned an empty API key');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[get-automation-key] Provisioning failed:', msg);
    res.status(502).json({ error: `Key provisioning error: ${msg}` });
    return;
  }

  // ── 6. Persist the key in the user's profile (non-fatal if it fails) ─────────
  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, automation_api_key: provisionedKey },
      { onConflict: 'id' },
    );

  if (upsertErr) {
    // The key was provisioned — return it to the client even if persistence failed.
    // Next request will provision again (idempotent on EficacIA side).
    console.error('[get-automation-key] Could not persist key:', upsertErr.message);
  }

  res.status(200).json({ apiKey: provisionedKey });
}
