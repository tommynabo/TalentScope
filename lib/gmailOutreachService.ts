import { supabase } from './supabase';
import https from 'https';

export interface OutreachResult {
  success: number;
  failed: number;
  errors: Array<{ leadId: string; error: string }>;
}

/**
 * Gmail Outreach Service
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
      // 1. Get all pending and running leads that are due to be sent
      const { data: leads, error: leadsError } = await supabase
        .from('gmail_outreach_leads')
        .select(`
          id,
          sequence_id,
          campaign_id,
          candidate_id,
          candidate_name,
          candidate_email,
          status,
          current_step_number,
          scheduled_for,
          gmail_sequences:sequence_id (
            id,
            user_id,
            name,
            status,
            gmail_sequence_steps (
              id,
              sequence_id,
              step_number,
              subject_template,
              body_template,
              delay_hours
            )
          )
        `)
        .in('status', ['pending', 'running']);

      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) {
        console.log('[GmailOutreach] No pending leads');
        return result;
      }

      console.log(`[GmailOutreach] Processing ${leads.length} leads...`);

      // 2. For each lead, check if it's time to send
      for (const lead of leads) {
        try {
          const sequence = (lead as any).gmail_sequences;
          if (!sequence) {
            throw new Error('Sequence not found');
          }

          const steps = sequence.gmail_sequence_steps || [];
          const currentStep = steps.find((s: any) => s.step_number === lead.current_step_number);

          if (!currentStep) {
            // No more steps - mark as completed
            await this.updateLeadStatus(lead.id, 'completed');
            result.success++;
            continue;
          }

          // Check if it's time to send this step
          const scheduledTime = new Date(lead.scheduled_for).getTime();
          const now = Date.now();
          if (scheduledTime > now) {
            // Not yet time
            continue;
          }

          // Get Gmail account for this user
          const { data: account, error: accountError } = await supabase
            .from('gmail_accounts')
            .select('id, email, access_token, refresh_token, user_id')
            .eq('user_id', sequence.user_id)
            .eq('status', 'active')
            .single();

          if (accountError || !account) {
            throw new Error('No active Gmail account found');
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

          // Send the email
          const messageSent = await this.sendEmailViaGmail(
            account.access_token,
            account.email,
            lead.candidate_email,
            subject,
            body
          );

          if (!messageSent) {
            throw new Error('Failed to send email via Gmail API');
          }

          // Log the sent email
          await supabase.from('gmail_logs').insert({
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

          // Calculate next scheduled time
          const nextStepNumber = lead.current_step_number + 1;
          const nextStep = steps.find((s: any) => s.step_number === nextStepNumber);

          if (nextStep) {
            // Schedule next step
            const nextScheduledTime = new Date(now + nextStep.delay_hours * 3600 * 1000).toISOString();
            await supabase
              .from('gmail_outreach_leads')
              .update({
                status: 'running',
                current_step_number: nextStepNumber,
                scheduled_for: nextScheduledTime,
                last_error: null,
              })
              .eq('id', lead.id);
          } else {
            // All steps completed
            await this.updateLeadStatus(lead.id, 'completed');
          }

          result.success++;
          console.log(`[GmailOutreach] ✓ Sent email to ${lead.candidate_email} (Step ${currentStep.step_number})`);
        } catch (error: any) {
          result.failed++;
          const errorMsg = error?.message || 'Unknown error';
          result.errors.push({ leadId: lead.id, error: errorMsg });

          // Update lead with error status
          await supabase
            .from('gmail_outreach_leads')
            .update({
              status: 'failed',
              last_error: errorMsg.substring(0, 255),
            })
            .eq('id', lead.id);

          console.error(`[GmailOutreach] ✗ Error for lead ${lead.id}:`, errorMsg);
        }
      }
    } catch (error) {
      console.error('[GmailOutreach] Fatal error:', error);
    }

    console.log(`[GmailOutreach] Results - Success: ${result.success}, Failed: ${result.failed}`);
    return result;
  },

  /**
   * Send email via Google Gmail API
   */
  async sendEmailViaGmail(
    accessToken: string,
    fromEmail: string,
    toEmail: string,
    subject: string,
    body: string
  ): Promise<{ id: string } | null> {
    try {
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

      // Call Gmail API
      return await new Promise((resolve, reject) => {
        const path = '/gmail/v1/users/me/messages/send';
        const payload = JSON.stringify({
          raw: encodedMessage,
        });

        const options = {
          hostname: 'www.googleapis.com',
          path,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error('Failed to parse Gmail API response'));
              }
            } else {
              reject(new Error(`Gmail API error: ${res.statusCode} - ${data}`));
            }
          });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    } catch (error) {
      console.error('[GmailAPI] Error:', error);
      return null;
    }
  },

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('gmail_outreach_leads')
      .update({ status })
      .eq('id', leadId);

    if (error) {
      console.error('[GmailOutreach] Error updating status:', error);
      throw error;
    }
  },

  /**
   * Replace template variables
   */
  replaceVariables(
    template: string,
    variables: Record<string, string>
  ): string {
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
  extractSpecialty(name: string): string {
    // In a real scenario, this would come from the candidate profile
    // For now, we return a generic specialty
    return 'product engineering';
  },
};
