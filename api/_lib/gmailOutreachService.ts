import { supabase } from './supabase';

export interface OutreachResult {
  success: number;
  failed: number;
  errors: Array<{ leadId: string; error: string }>;
}

/**
 * Gmail Outreach Service (Server-side version for Vercel serverless functions)
 * Handles sending emails from scheduled outreach sequences
 */
export const GmailOutreachService = {
  /**
   * Process all pending and scheduled outreach leads
   * Called from cron job every minute
   */
  async processPendingLeads(): Promise<OutreachResult> {
    const result: OutreachResult = { success: 0, failed: 0, errors: [] };

    try {
      console.log('[GmailOutreach] Starting to process pending leads...');

      // 1. Get all pending and running leads
      const { data: leads, error: leadsError } = await supabase
        .from('gmail_outreach_leads')
        .select('*')
        .in('status', ['pending', 'running']);

      if (leadsError) {
        throw new Error(`Failed to fetch leads: ${leadsError.message}`);
      }

      if (!leads || leads.length === 0) {
        console.log('[GmailOutreach] No pending leads found');
        return result;
      }

      console.log(`[GmailOutreach] Found ${leads.length} leads to process`);

      // 2. For each lead, check if it's time to send
      for (const lead of leads) {
        if (!lead || !lead.id) {
          console.warn('[GmailOutreach] Skipping invalid lead');
          continue;
        }

        try {
          console.log(`[GmailOutreach] Processing lead ${lead.id}`);

          // Check if it's time to send this step
          const scheduledTime = new Date(lead.scheduled_for).getTime();
          const now = Date.now();
          if (scheduledTime > now) {
            console.log(`[GmailOutreach] Lead ${lead.id} not yet scheduled (${new Date(lead.scheduled_for).toISOString()})`);
            continue;
          }

          // Get the sequence and steps
          const { data: sequence, error: seqError } = await supabase
            .from('gmail_sequences')
            .select('id, user_id, name, status')
            .eq('id', lead.sequence_id)
            .single();

          if (seqError) {
            throw new Error(`Sequence error: ${seqError.message}`);
          }

          if (!sequence) {
            throw new Error(`Sequence not found: ${lead.sequence_id}`);
          }

          const { data: steps, error: stepsError } = await supabase
            .from('gmail_sequence_steps')
            .select('*')
            .eq('sequence_id', lead.sequence_id)
            .order('step_number', { ascending: true });

          if (stepsError) {
            throw new Error(`Steps error: ${stepsError.message}`);
          }

          if (!steps || steps.length === 0) {
            throw new Error(`No steps found for sequence ${lead.sequence_id}`);
          }

          const currentStep = steps.find((s: any) => s.step_number === lead.current_step_number);

          if (!currentStep) {
            await this.updateLeadStatus(lead.id, 'completed');
            result.success++;
            console.log(`[GmailOutreach] Lead ${lead.id} completed (no more steps)`);
            continue;
          }

          // Get Gmail account for this user
          const { data: account, error: accountError } = await supabase
            .from('gmail_accounts')
            .select('id, email, access_token, refresh_token, user_id')
            .eq('user_id', sequence.user_id)
            .eq('status', 'active')
            .single();

          if (accountError) {
            throw new Error(`Account fetch error: ${accountError.message}`);
          }

          if (!account) {
            throw new Error(`No active Gmail account found for user ${sequence.user_id}. Please reconnect your Gmail.`);
          }

          if (!account.access_token) {
            throw new Error(`Gmail account has no access token. Please reconnect your Gmail account.`);
          }

          // Replace variables in templates
          const subject = this.replaceVariables(currentStep.subject_template, {
            name: lead.candidate_name,
            email: lead.candidate_email,
            specialty: this.extractSpecialty(lead.candidate_name),
          });

          const body = this.replaceVariables(currentStep.body_template, {
            name: lead.candidate_name,
            email: lead.candidate_email,
            specialty: this.extractSpecialty(lead.candidate_name),
          });

          console.log(`[GmailOutreach] Sending email to ${lead.candidate_email}, subject: ${subject}`);

          // Send the email
          let messageSent;
          try {
            messageSent = await this.sendEmailViaGmail(
              account.access_token,
              account.email,
              lead.candidate_email,
              subject,
              body
            );
          } catch (gmailError: any) {
            throw new Error(`Failed to send email via Gmail: ${gmailError.message}`);
          }

          if (!messageSent || !messageSent.id) {
            throw new Error('Gmail API did not return message ID after sending');
          }

          // Log the sent email
          const { error: logError } = await supabase.from('gmail_logs').insert({
            user_id: sequence.user_id,
            action_type: 'sent',
            message_id: messageSent.id,
            sequence_id: lead.sequence_id,
            lead_id: lead.id,
            account_id: account.id,
            metadata: {
              to: lead.candidate_email,
              subject,
              step: currentStep.step_number,
            },
          });

          if (logError) {
            console.error(`[GmailOutreach] Error logging email: ${logError.message}`);
          }

          // Calculate next scheduled time
          const nextStepNumber = lead.current_step_number + 1;
          const nextStep = steps.find((s: any) => s.step_number === nextStepNumber);

          if (nextStep) {
            const nextScheduledTime = new Date(now + nextStep.delay_hours * 3600 * 1000).toISOString();
            const { error: updateError } = await supabase
              .from('gmail_outreach_leads')
              .update({
                status: 'running',
                current_step_number: nextStepNumber,
                scheduled_for: nextScheduledTime,
                last_error: null,
              })
              .eq('id', lead.id);

            if (updateError) {
              throw new Error(`Failed to update lead: ${updateError.message}`);
            }
          } else {
            await this.updateLeadStatus(lead.id, 'completed');
          }

          result.success++;
          console.log(`[GmailOutreach] ✓ Sent email to ${lead.candidate_email} (Step ${currentStep.step_number})`);
        } catch (error: any) {
          result.failed++;
          const errorMsg = error?.message || 'Unknown error';
          result.errors.push({ leadId: lead.id, error: errorMsg });

          const { error: updateError } = await supabase
            .from('gmail_outreach_leads')
            .update({
              status: 'failed',
              last_error: errorMsg.substring(0, 255),
            })
            .eq('id', lead.id);

          if (updateError) {
            console.error(`[GmailOutreach] Could not update lead status: ${updateError.message}`);
          }

          console.error(`[GmailOutreach] ✗ Error for lead ${lead.id}:`, errorMsg);
        }
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[GmailOutreach] Fatal error in processPendingLeads:', errorMsg);
      console.error('[GmailOutreach] Stack:', error?.stack);
      result.errors.push({
        leadId: 'SYSTEM',
        error: `System error: ${errorMsg}`,
      });
    }

    console.log(`[GmailOutreach] Results - Success: ${result.success}, Failed: ${result.failed}, Errors: ${result.errors.length}`);
    return result;
  },

  /**
   * Send email via Google Gmail API using fetch
   */
  async sendEmailViaGmail(
    accessToken: string,
    fromEmail: string,
    toEmail: string,
    subject: string,
    body: string
  ): Promise<{ id: string }> {
    if (!accessToken) {
      throw new Error('No access token provided to sendEmailViaGmail');
    }

    if (!fromEmail || !toEmail) {
      throw new Error(`Invalid email addresses: from=${fromEmail}, to=${toEmail}`);
    }

    // Create the email message in RFC 2822 format
    const email = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
    ].join('\n');

    // Encode to base64
    const encodedMessage = Buffer.from(email).toString('base64');
    console.log(`[GmailAPI] Preparing to send email to ${toEmail} from ${fromEmail}`);

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
      console.error(`[GmailAPI] Failed response: ${response.status}`, errorData);
      throw new Error(`Gmail API error: ${response.status} - ${errorData.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log(`[GmailAPI] Email sent successfully, message ID: ${data.id}`);
    return data;
  },

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('gmail_outreach_leads')
      .update({ status, last_error: null })
      .eq('id', leadId);

    if (error) {
      console.error('[GmailOutreach] Error updating status:', error);
      throw new Error(`Failed to update lead status: ${error.message}`);
    }
  },

  /**
   * Replace template variables
   */
  replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    });
    return result;
  },

  /**
   * Extract specialty from candidate name (fallback)
   */
  extractSpecialty(_name: string): string {
    return 'product engineering';
  },
};
