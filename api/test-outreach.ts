import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 30 };

// ── Inline Supabase client (process.env for Node.js runtime) ──
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  console.log('[Supabase] Initializing with:', { 
    urlExists: !!url, 
    urlStarts: url.substring(0, 20),
    keyExists: !!key,
    keyStarts: key.substring(0, 10),
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
  });

  if (!url || !key) {
    throw new Error(`Missing Supabase env vars. URL=${!!url}, KEY=${!!key}. Available: ${Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', ')}`);
  }
  return createClient(url, key);
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

  console.log('[Outreach] Starting...');

  // First, get ALL leads to verify the table is accessible
  const { data: allLeads, error: allErr } = await supabase
    .from('gmail_outreach_leads')
    .select('*');

  console.log('[Outreach] ALL leads count:', allLeads?.length || 0, 'Error:', allErr?.message);

  // Now filter for pending/running
  const { data: leads, error: leadsErr } = await supabase
    .from('gmail_outreach_leads')
    .select('*')
    .in('status', ['pending', 'running']);

  console.log('[Outreach] Pending/running leads count:', leads?.length || 0, 'Error:', leadsErr?.message);
  if (leadsErr) {
    console.error('[Outreach] Detailed error:', leadsErr);
    throw new Error(`Leads fetch error: ${leadsErr.message}`);
  }

  if (!leads || leads.length === 0) {
    console.log('[Outreach] No pending/running leads found');
    if (!allErr && allLeads?.length) {
      const statuses = new Set(allLeads.map((l: any) => l.status));
      console.log('[Outreach] Available statuses:', Array.from(statuses));
    }
    return result;
  }

  console.log(`[Outreach] Found ${leads.length} leads`);

  for (const lead of leads) {
    if (!lead?.id) continue;

    try {
      const scheduledTime = new Date(lead.scheduled_for).getTime();
      const now = Date.now();
      if (scheduledTime > now) {
        console.log(`[Outreach] Lead ${lead.id} not yet due (${lead.scheduled_for})`);
        continue;
      }

      const { data: sequence, error: seqErr } = await supabase
        .from('gmail_sequences')
        .select('id, user_id, name, status')
        .eq('id', lead.sequence_id)
        .single();

      if (seqErr || !sequence) throw new Error(`Sequence error: ${seqErr?.message || 'not found'}`);

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

      const { data: account, error: accErr } = await supabase
        .from('gmail_accounts')
        .select('id, email, access_token, refresh_token, user_id')
        .eq('user_id', sequence.user_id)
        .eq('status', 'active')
        .single();

      if (accErr || !account) throw new Error(`Gmail account error: ${accErr?.message || 'no active account for user ' + sequence.user_id}`);
      if (!account.access_token) throw new Error('Gmail account has no access_token. Reconnect Gmail.');

      const vars = {
        name: lead.candidate_name || '',
        email: lead.candidate_email || '',
        specialty: 'product engineering',
      };
      const subject = replaceVariables(currentStep.subject_template, vars);
      const body = replaceVariables(currentStep.body_template, vars);

      console.log(`[Outreach] Sending to ${lead.candidate_email}, step ${currentStep.step_number}`);

      const sent = await sendEmailViaGmail(account.access_token, account.email, lead.candidate_email, subject, body);

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

