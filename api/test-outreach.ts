import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 30 };

// ── Inline Supabase client (process.env for Node.js runtime) ──
// Uses service role key to bypass RLS — required for server-side operations
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  // Prefer service role key (bypasses RLS), fallback to anon key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const key = serviceKey || anonKey;
  
  console.log('[Supabase] Init:', { 
    url: url.substring(0, 30),
    usingServiceKey: !!serviceKey,
    usingAnonKey: !serviceKey && !!anonKey,
    allKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
  });

  if (!url || !key) {
    throw new Error(`Missing Supabase env vars. URL=${!!url}, KEY=${!!key}`);
  }
  return createClient(url, key);
}

// ── Refresh Gmail OAuth token ──
async function refreshGmailToken(
  supabase: any,
  accountId: string,
  refreshToken: string
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables. Add them to Vercel.');
  }
  if (!refreshToken) {
    throw new Error('No refresh_token stored for this Gmail account. Reconnect Gmail via the UI.');
  }

  console.log('[GmailToken] Refreshing access token...');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const tokenData = await resp.json();

  if (!resp.ok || !tokenData.access_token) {
    throw new Error(`Token refresh failed (${resp.status}): ${JSON.stringify(tokenData)}`);
  }

  const newToken = tokenData.access_token;
  console.log('[GmailToken] ✓ Got new access token, saving to DB...');

  // Persist the new token so subsequent sends work
  await supabase
    .from('gmail_accounts')
    .update({ access_token: newToken, updated_at: new Date().toISOString() })
    .eq('id', accountId);

  return newToken;
}

// ── Template variable replacement ──
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  });
  return result;
}

// ── Send email via Gmail API ──
async function sendEmailViaGmail(
  accessToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<{ id: string }> {
  if (!accessToken) throw new Error('No access token');
  if (!fromEmail || !toEmail) throw new Error(`Invalid emails: from=${fromEmail}, to=${toEmail}`);

  const email = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ].join('\n');

  const encodedMessage = Buffer.from(email).toString('base64');
  console.log(`[GmailAPI] Sending to ${toEmail} from ${fromEmail}`);

  const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gmail API ${response.status}: ${errorData.substring(0, 300)}`);
  }

  const data = await response.json();
  console.log(`[GmailAPI] ✓ Sent, message ID: ${data.id}`);
  return data;
}

// ── Main processing logic ──
interface OutreachResult {
  success: number;
  failed: number;
  errors: Array<{ leadId: string; error: string }>;
}

async function processPendingLeads(): Promise<OutreachResult> {
  const supabase = getSupabase();
  const result: OutreachResult = { success: 0, failed: 0, errors: [] };

  console.log('[Outreach] 1. Starting...');
  console.log('[Outreach] 2. Supabase instance created, querying ALL leads...');

  // First, get ALL leads to verify the table is accessible
  const { data: allLeads, error: allErr } = await supabase
    .from('gmail_outreach_leads')
    .select('id, status, candidate_email');

  console.log('[Outreach] 3. ALL leads response:', { count: allLeads?.length, error: allErr?.message, data: allLeads?.slice(0, 2) });

  // Now filter for pending/running
  console.log('[Outreach] 4. Querying pending/running leads with filter...');
  const { data: pendingLeads, error: leadsErr } = await supabase
    .from('gmail_outreach_leads')
    .select('*')
    .in('status', ['pending', 'running']);

  console.log('[Outreach] 5. Pending/running query result:', { count: pendingLeads?.length, error: leadsErr?.message });
  
  if (leadsErr) {
    console.error('[Outreach] 6. QUERY ERROR:', leadsErr);
    throw new Error(`Leads fetch error: ${leadsErr.message}`);
  }

  let leads: any[] = pendingLeads || [];

  if (leads.length === 0) {
    // In test mode: auto-reset failed leads so the test always processes something
    const failedLeads = allLeads?.filter(l => l.status === 'failed') || [];
    console.log(`[Outreach] 7. No pending leads. Found ${failedLeads.length} failed leads — auto-resetting for test...`);

    if (failedLeads.length === 0) {
      console.log('[Outreach] No leads at all. Create leads in the UI first.');
      return result;
    }

    const resetIds = failedLeads.map(l => l.id);
    const { error: resetErr } = await supabase
      .from('gmail_outreach_leads')
      .update({ status: 'pending', last_error: null, updated_at: new Date().toISOString() })
      .in('id', resetIds);

    if (resetErr) {
      console.error('[Outreach] Reset error:', resetErr.message);
      return result;
    }

    console.log(`[Outreach] ✓ Reset ${resetIds.length} leads to pending, re-fetching...`);

    // Re-fetch now that they're pending
    const { data: retryLeads, error: retryErr } = await supabase
      .from('gmail_outreach_leads')
      .select('*')
      .in('id', resetIds);

    if (retryErr || !retryLeads?.length) {
      console.error('[Outreach] Re-fetch error:', retryErr?.message);
      return result;
    }

    leads = retryLeads;
  }

  console.log(`[Outreach] Processing ${leads.length} leads...`);

  for (const lead of leads) {
    if (!lead?.id) continue;

    try {
      const scheduledTime = new Date(lead.scheduled_for).getTime();
      const now = Date.now();
      if (scheduledTime > now) {
        console.log(`[Outreach] Lead ${lead.id} not yet due (${lead.scheduled_for})`);
        continue;
      }

      console.log(`[Outreach] Lead ${lead.id} — sequence_id: ${lead.sequence_id}`);

      if (!lead.sequence_id) {
        throw new Error(`Lead has no sequence_id. Lead data: ${JSON.stringify(lead)}`);
      }

      const { data: sequences, error: seqErr } = await supabase
        .from('gmail_sequences')
        .select('id, user_id, name, status')
        .eq('id', lead.sequence_id)
        .limit(1);

      console.log(`[Outreach] Sequence query result: count=${sequences?.length}, err=${seqErr?.message}`);

      if (seqErr) throw new Error(`Sequence error: ${seqErr.message}`);
      if (!sequences || sequences.length === 0) throw new Error(`Sequence not found: ${lead.sequence_id}`);
      const sequence = sequences[0];

      const { data: steps, error: stepsErr } = await supabase
        .from('gmail_sequence_steps')
        .select('*')
        .eq('sequence_id', lead.sequence_id)
        .order('step_number', { ascending: true });

      if (stepsErr || !steps?.length) throw new Error(`Steps error: ${stepsErr?.message || 'none found'}`);

      const currentStep = steps.find((s: any) => s.step_number === lead.current_step_number);

      if (!currentStep) {
        await supabase.from('gmail_outreach_leads').update({ status: 'completed', last_error: null }).eq('id', lead.id);
        result.success++;
        console.log(`[Outreach] Lead ${lead.id} completed`);
        continue;
      }

      const { data: accounts, error: accErr } = await supabase
        .from('gmail_accounts')
        .select('id, email, access_token, refresh_token, user_id')
        .eq('user_id', sequence.user_id)
        .eq('status', 'active')
        .limit(1);

      console.log(`[Outreach] Gmail account query: count=${accounts?.length}, err=${accErr?.message}, user=${sequence.user_id}`);

      if (accErr) throw new Error(`Gmail account error: ${accErr.message}`);
      if (!accounts || accounts.length === 0) throw new Error(`No active Gmail account for user ${sequence.user_id}`);
      const account = accounts[0];
      if (!account.access_token && !account.refresh_token) throw new Error('Gmail account has no tokens. Reconnect Gmail from the UI.');

      // Always refresh the token before sending — access_tokens expire in ~1 hour
      let accessToken = account.access_token;
      if (account.refresh_token) {
        try {
          accessToken = await refreshGmailToken(supabase, account.id, account.refresh_token);
        } catch (refreshErr: any) {
          console.warn(`[Outreach] Token refresh failed, trying stored token: ${refreshErr.message}`);
          // If refresh fails due to missing env vars, warn and fall back
        }
      }

      if (!accessToken) throw new Error('No valid access token. Reconnect Gmail from the UI.');

      const vars = {
        name: lead.candidate_name || '',
        email: lead.candidate_email || '',
        specialty: 'product engineering',
      };
      const subject = replaceVariables(currentStep.subject_template, vars);
      const body = replaceVariables(currentStep.body_template, vars);

      console.log(`[Outreach] Sending to ${lead.candidate_email}, step ${currentStep.step_number}`);

      const sent = await sendEmailViaGmail(accessToken, account.email, lead.candidate_email, subject, body);

      await supabase.from('gmail_logs').insert({
        user_id: sequence.user_id,
        action_type: 'sent',
        message_id: sent.id,
        sequence_id: lead.sequence_id,
        lead_id: lead.id,
        account_id: account.id,
        metadata: { to: lead.candidate_email, subject, step: currentStep.step_number },
      });

      const nextStepNum = lead.current_step_number + 1;
      const nextStep = steps.find((s: any) => s.step_number === nextStepNum);

      if (nextStep) {
        const nextTime = new Date(now + nextStep.delay_hours * 3600 * 1000).toISOString();
        await supabase.from('gmail_outreach_leads').update({
          status: 'running',
          current_step_number: nextStepNum,
          scheduled_for: nextTime,
          last_error: null,
        }).eq('id', lead.id);
      } else {
        await supabase.from('gmail_outreach_leads').update({ status: 'completed', last_error: null }).eq('id', lead.id);
      }

      result.success++;
      console.log(`[Outreach] ✓ Sent to ${lead.candidate_email} (step ${currentStep.step_number})`);
    } catch (error: any) {
      result.failed++;
      const msg = error?.message || 'Unknown error';
      result.errors.push({ leadId: lead.id, error: msg });
      await supabase.from('gmail_outreach_leads').update({ status: 'failed', last_error: msg.substring(0, 255) }).eq('id', lead.id);
      console.error(`[Outreach] ✗ Lead ${lead.id}:`, msg);
    }
  }

  console.log(`[Outreach] Done — Success: ${result.success}, Failed: ${result.failed}`);
  return result;
}

// ── API Handler ──
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // No auth required for manual test — this endpoint is called from the UI
    console.log('[TestOutreach] Triggering...');
    const data = await processPendingLeads();
    console.log('[TestOutreach] Done:', data);

    return res.status(200).json({
      success: true,
      message: 'Outreach processed',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[TestOutreach] Fatal:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || String(error),
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
      timestamp: new Date().toISOString(),
    });
  }
}
}

