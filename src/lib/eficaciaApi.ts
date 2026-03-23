/**
 * EficacIA API Client
 * ===================
 * Typed fetch wrapper that injects credentials and routes all calls to
 * the external EficacIA backend.
 *
 * "Shadow Accounts" key flow
 * --------------------------
 * Instead of asking the user to paste a raw API key, call `initEficaciaKey()`
 * once on mount (passing the Supabase session access_token).  It hits
 * TalentScope's own serverless endpoint `/api/get-automation-key`, which
 * provisions / retrieves a user-scoped key from EficacIA using a server-side
 * master secret the client never sees.  The returned key is cached in memory
 * and injected into every `eficaciaFetch()` call automatically.
 *
 * The baseUrl (EficacIA backend address) is still stored in localStorage so
 * the user only has to enter it once in the "Cuentas" panel.
 */

// ─── Storage keys ────────────────────────────────────────────────────────────
const STORAGE_KEY_URL   = 'eficacia_base_url';
const STORAGE_KEY_ACCT  = 'eficacia_account_id'; // optional default Unipile account

// ─── Env fallback (set VITE_EFICACIA_BASE_URL in .env) ───────────────────────
const ENV_BASE_URL = (import.meta as any).env?.VITE_EFICACIA_BASE_URL ?? '';

// ─── In-memory API key cache (lives for the duration of the browser session) ──
let _runtimeApiKey: string | null = null;

/** Returns true once initEficaciaKey() has resolved successfully. */
export function isKeyInitialized(): boolean {
  return _runtimeApiKey !== null && _runtimeApiKey.length > 0;
}

/**
 * "Shadow Accounts" initialiser.
 * Call this once after the user logs in, passing the Supabase access token.
 * It calls TalentScope's backend to provision / retrieve the user-scoped key
 * and stores it in memory so every subsequent eficaciaFetch() works without
 * the user ever seeing an API key.
 *
 * @param supabaseAccessToken  The JWT from `supabase.auth.getSession()`
 * @returns                    The resolved API key
 */
export async function initEficaciaKey(supabaseAccessToken: string): Promise<string> {
  if (_runtimeApiKey) return _runtimeApiKey; // already initialised

  const res = await fetch('/api/get-automation-key', {
    method:  'GET',
    headers: { Authorization: `Bearer ${supabaseAccessToken}` },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json() as { error?: string }).error ?? msg; } catch { /* ignore */ }
    throw new Error(`[EficacIA] Key init failed: ${msg}`);
  }

  const { apiKey } = await res.json() as { apiKey: string };
  if (!apiKey) throw new Error('[EficacIA] Server returned an empty API key');

  _runtimeApiKey = apiKey;
  return apiKey;
}

/** Clears the in-memory key (call on logout). */
export function clearRuntimeKey(): void {
  _runtimeApiKey = null;
}

// ─── Config helpers ───────────────────────────────────────────────────────────
export interface EficaciaConfig {
  baseUrl:   string;
  accountId: string;
}

export function getEficaciaConfig(): EficaciaConfig {
  return {
    baseUrl:   localStorage.getItem(STORAGE_KEY_URL)  ?? ENV_BASE_URL,
    accountId: localStorage.getItem(STORAGE_KEY_ACCT) ?? '',
  };
}

export function saveEficaciaConfig(config: Partial<EficaciaConfig>): void {
  if (config.baseUrl   !== undefined) localStorage.setItem(STORAGE_KEY_URL,  config.baseUrl);
  if (config.accountId !== undefined) localStorage.setItem(STORAGE_KEY_ACCT, config.accountId);
}

export function clearEficaciaConfig(): void {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ACCT);
  clearRuntimeKey();
}

export function isEficaciaConfigured(): boolean {
  const { baseUrl } = getEficaciaConfig();
  return baseUrl.trim().length > 0;
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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?:   unknown;
  /** Extra headers merged on top of defaults */
  headers?: Record<string, string>;
}

/**
 * Makes an authenticated request to the EficacIA backend.
 * Automatically uses the in-memory key set by initEficaciaKey().
 *
 * Usage:
 *   const campaigns = await eficaciaFetch<EficaciaCampaign[]>('/api/linkedin/campaigns');
 *   await eficaciaFetch('/api/linkedin/withdraw-pending', { method: 'POST' });
 */
export async function eficaciaFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  // Prefer the in-memory runtime key (set by initEficaciaKey) over nothing
  const apiKey   = _runtimeApiKey ?? '';
  const { baseUrl } = getEficaciaConfig();

  if (!baseUrl.trim()) {
    throw new EficaciaApiError(
      0,
      'EficacIA base URL no configurada. Ve a la pestaña "Cuentas" para configurarla.',
    );
  }

  // Validate path doesn't contain injection attempts before constructing URL
  if (typeof path !== 'string' || /[\r\n]/.test(path)) {
    throw new EficaciaApiError(400, 'Ruta de API inválida.');
  }

  const url = `${baseUrl.replace(/\/$/, '')}${path}`;

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  if (apiKey) {
    // Some EficacIA variants use Bearer, others use x-api-key — send both
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

  // 204 No Content or non-JSON → return empty object
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
