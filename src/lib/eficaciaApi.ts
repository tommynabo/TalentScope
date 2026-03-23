/**
 * EficacIA API Client
 * ===================
 * Typed fetch wrapper that routes all calls to the EficacIA backend.
 *
 * Key design decisions
 * --------------------
 * · EFICACIA_BASE_URL is hardcoded — users never configure a URL.
 * · Call `setupEficaciaAuth(supabaseSessionToken)` once on mount.
 *   It hits TalentScope's own `/api/get-automation-key` serverless endpoint
 *   which provisions / retrieves a user-scoped key via master secret (server only).
 *   The key is cached in memory for the lifetime of the browser session.
 * · Every subsequent `eficaciaFetch()` injects the key automatically.
 */

// ─── Hardcoded backend URL ────────────────────────────────────────────────────
export const EFICACIA_BASE_URL = 'https://eficac-ia.vercel.app';

// ─── In-memory API key (never stored in localStorage or cookies) ──────────────
let _runtimeApiKey: string | null = null;

/** Returns true once setupEficaciaAuth() has resolved successfully. */
export function isKeyInitialized(): boolean {
  return _runtimeApiKey !== null && _runtimeApiKey.length > 0;
}

/**
 * Call once when the user enters the EficacIA section.
 * Internally calls TalentScope's `/api/get-automation-key` with the user's
 * Supabase JWT; the server either returns a cached key or provisions a new one.
 *
 * @param supabaseSessionToken  JWT from `supabase.auth.getSession()`
 */
export async function setupEficaciaAuth(supabaseSessionToken: string): Promise<string> {
  if (_runtimeApiKey) return _runtimeApiKey; // already initialised — fast path

  const res = await fetch('/api/get-automation-key', {
    method:  'GET',
    headers: { Authorization: `Bearer ${supabaseSessionToken}` },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = ((await res.json()) as { error?: string }).error ?? msg; } catch { /* ignore */ }
    throw new Error(`[EficacIA] Auth setup failed: ${msg}`);
  }

  const { apiKey } = (await res.json()) as { apiKey: string };
  if (!apiKey) throw new Error('[EficacIA] Server returned an empty API key');

  _runtimeApiKey = apiKey;
  return apiKey;
}

/** Clears the in-memory key — call on logout. */
export function clearRuntimeKey(): void {
  _runtimeApiKey = null;
}

// Keep for backward-compat with views that guard on this — always true
// now that the URL is hardcoded.
export function isEficaciaConfigured(): boolean {
  return true;
}

// ─── Error class ──────────────────────────────────────────────────────────────
export class EficaciaApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EficaciaApiError';
  }
}

// ─── Core fetch function ──────────────────────────────────────────────────────
export interface FetchOptions {
  method?:  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?:    unknown;
  headers?: Record<string, string>;
}

/**
 * Makes an authenticated request to the EficacIA backend.
 *
 * Usage:
 *   const campaigns = await eficaciaFetch<EficaciaCampaign[]>('/api/linkedin/campaigns');
 *   await eficaciaFetch('/api/linkedin/withdraw-pending', { method: 'POST' });
 */
export async function eficaciaFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const apiKey = _runtimeApiKey ?? '';

  // Guard against header-injection
  if (typeof path !== 'string' || /[\r\n]/.test(path)) {
    throw new EficaciaApiError(400, 'Ruta de API inválida.');
  }

  const url = `${EFICACIA_BASE_URL}${path}`;

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  if (apiKey) {
    baseHeaders['Authorization'] = `Bearer ${apiKey}`;
    baseHeaders['x-api-key']     = apiKey;
  }

  const { method = 'GET', body, headers: extra = {} } = options;

  const response = await fetch(url, {
    method,
    headers: { ...baseHeaders, ...extra },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const text = await response.text();
      if (text) msg = text;
    } catch { /* ignore */ }
    throw new EficaciaApiError(response.status, msg);
  }

  const ct = response.headers.get('content-type') ?? '';
  if (response.status === 204 || !ct.includes('application/json')) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface EficaciaAccount {
  id:                   string;
  name:                 string;
  email?:               string;
  provider:             'linkedin' | 'unipile';
  status:               'connected' | 'disconnected' | 'pending' | 'error';
  unipile_account_id?:  string;
  avatar_url?:          string;
  created_at:           string;
}

export interface EficaciaCampaignStep {
  id:          string;
  order:       number;
  delay_days:  number;
  type:        'connection_request' | 'message' | 'inmail';
  template:    string;
}

export interface EficaciaCampaign {
  id:          string;
  name:        string;
  status:      'active' | 'paused' | 'draft' | 'completed';
  account_id?: string;
  steps:       EficaciaCampaignStep[];
  stats: {
    sent:             number;
    accepted:         number;
    replied:          number;
    acceptance_rate:  number;
    reply_rate:       number;
  };
  created_at:  string;
  updated_at:  string;
}

export interface EficaciaThread {
  id:                    string;
  contact_name:          string;
  contact_avatar?:       string;
  contact_linkedin_url?: string;
  last_message:          string;
  last_message_at:       string;
  unread_count:          number;
  campaign_id?:          string;
  campaign_name?:        string;
}

export interface EficaciaMessage {
  id:                 string;
  thread_id:          string;
  sender_name:        string;
  sender_linkedin_id?: string;
  sender_avatar?:     string;
  content:            string;
  timestamp:          string;
  is_outbound:        boolean;
  read:               boolean;
}

export interface EficaciaDailyStat {
  date:      string;
  sent:      number;
  accepted:  number;
  replied:   number;
}

export interface EficaciaTopCampaign {
  campaign_id:      string;
  campaign_name:    string;
  sent:             number;
  acceptance_rate:  number;
  reply_rate:       number;
}

export interface EficaciaAnalytics {
  total_sent:      number;
  total_accepted:  number;
  total_replied:   number;
  acceptance_rate: number;
  reply_rate:      number;
  daily_stats:     EficaciaDailyStat[];
  top_campaigns:   EficaciaTopCampaign[];
}

export interface EficaciaPendingConnection {
  id:           string;
  name:         string;
  profile_url:  string;
  sent_at:      string;
  days_pending: number;
}

export interface EficaciaWithdrawResult {
  withdrawn: number;
  failed:    number;
  message:   string;
}

export interface EficaciaSequence {
  id:         string;
  name:       string;
  steps_count: number;
  campaigns_count: number;
  steps: EficaciaCampaignStep[];
  created_at: string;
}

export interface EficaciaLead {
  id:                    string;
  name:                  string;
  linkedin_url?:         string;
  avatar_url?:           string;
  headline?:             string;
  company?:              string;
  status:                'pending' | 'accepted' | 'replied' | 'bounced' | 'opted_out';
  last_activity_at?:     string;
  enrolled_at:           string;
  campaign_id:           string;
}

export interface EficaciaCampaignOptions {
  daily_connection_limit: number;
  daily_message_limit:    number;
  account_id:             string;
  timezone:               string;
  send_on_weekends:       boolean;
}
