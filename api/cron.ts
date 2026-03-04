import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 30 };

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  console.log('[Supabase] Init with URL:', !!url, 'KEY:', !!key, 'Env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', '));

  if (!url || !key) throw new Error(`Missing Supabase: URL=${!!url}, KEY=${!!key}`);
  return createClient(url, key);
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  });
  return result;
}

async function sendEmailViaGmail(accessToken: string, fromEmail: string, toEmail: string, subject: string, body: string): Promise<{ id: string }> {
  const email = [`From: ${fromEmail}`, `To: ${toEmail}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 7bit', '', body].join('\n');
  const encodedMessage = Buffer.from(email).toString('base64');

  const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gmail API ${response.status}: ${errorData.substring(0, 300)}`);
  }
  return await response.json();
}

async function processPendingLeads() {
  const supabase = getSupabase();
  const result = { success: 0, failed: 0, errors: [] as Array<{ leadId: string; error: string }> };

  console.log('[Cron] 1. Starting...');

  const { data: allLeads, error: allErr } = await supabase
    .from('gmail_outreach_leads').select('id, status, candidate_email');
  
  console.log('[Cron] 2. ALL leads count:', allLeads?.length, 'error:', allErr?.message);
  if (allLeads?.length) {
    console.log('[Cron] Available statuses:', new Set(allLeads.map(l => l.status)));
  }

  const { data: leads, error: leadsErr } = await supabase
    .from('gmail_outreach_leads').select('*').in('status', ['pending', 'running']);

  console.log('[Cron] 3. Pending/running leads count:', leads?.length, 'error:', leadsErr?.message);
  if (leadsErr) throw new Error(`Leads error: ${leadsErr.message}`);
  if (!leads?.length) {
    console.log('[Cron] No leads to process');
    return result;
  }
  
  console.log('[Cron] 4. Processing', leads.length, 'leads...');

  for (const lead of leads) {
    if (!lead?.id) continue;
    try {
      if (new Date(lead.scheduled_for).getTime() > Date.now()) continue;

      const { data: sequence, error: seqErr } = await supabase
        .from('gmail_sequences').select('id, user_id, name, status').eq('id', lead.sequence_id).single();
      if (seqErr || !sequence) throw new Error(`Sequence error: ${seqErr?.message || 'not found'}`);

      const { data: steps, error: stepsErr } = await supabase
        .from('gmail_sequence_steps').select('*').eq('sequence_id', lead.sequence_id).order('step_number', { ascending: true });
      if (stepsErr || !steps?.length) throw new Error(`Steps error: ${stepsErr?.message || 'none'}`);

      const currentStep = steps.find((s: any) => s.step_number === lead.current_step_number);
      if (!currentStep) {
        await supabase.from('gmail_outreach_leads').update({ status: 'completed', last_error: null }).eq('id', lead.id);
        result.success++;
        continue;
      }

      const { data: account, error: accErr } = await supabase
        .from('gmail_accounts').select('id, email, access_token, user_id').eq('user_id', sequence.user_id).eq('status', 'active').single();
      if (accErr || !account?.access_token) throw new Error(`Gmail account error: ${accErr?.message || 'no token'}`);

      const vars = { name: lead.candidate_name || '', email: lead.candidate_email || '', specialty: 'product engineering' };
      const subject = replaceVariables(currentStep.subject_template, vars);
      const body = replaceVariables(currentStep.body_template, vars);

      const sent = await sendEmailViaGmail(account.access_token, account.email, lead.candidate_email, subject, body);

      await supabase.from('gmail_logs').insert({
        user_id: sequence.user_id, action_type: 'sent', message_id: sent.id,
        sequence_id: lead.sequence_id, lead_id: lead.id, account_id: account.id,
        metadata: { to: lead.candidate_email, subject, step: currentStep.step_number },
      });

      const nextStepNum = lead.current_step_number + 1;
      const nextStep = steps.find((s: any) => s.step_number === nextStepNum);
      if (nextStep) {
        await supabase.from('gmail_outreach_leads').update({
          status: 'running', current_step_number: nextStepNum,
          scheduled_for: new Date(Date.now() + nextStep.delay_hours * 3600000).toISOString(), last_error: null,
        }).eq('id', lead.id);
      } else {
        await supabase.from('gmail_outreach_leads').update({ status: 'completed', last_error: null }).eq('id', lead.id);
      }

      result.success++;
    } catch (error: any) {
      result.failed++;
      const msg = error?.message || 'Unknown error';
      result.errors.push({ leadId: lead.id, error: msg });
      await supabase.from('gmail_outreach_leads').update({ status: 'failed', last_error: msg.substring(0, 255) }).eq('id', lead.id);
    }
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Cron] Starting...');
    const result = await processPendingLeads();
    console.log('[Cron] Done:', result);
    return res.status(200).json({ success: true, result });
  } catch (error: any) {
    console.error('[Cron] Error:', error);
    return res.status(500).json({ success: false, error: error?.message });
  }
}