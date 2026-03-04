import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';

/**
 * Diagnostic endpoint to check system status
 * Returns information about pending leads, accounts, sequences
 * Useful for debugging without triggering actual email sends
 */
export const config = {
    maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Content-Type', 'application/json');

    try {
        console.log('[Diagnose] Running system diagnostics...');

        const diagnostics: Record<string, any> = {
            timestamp: new Date().toISOString(),
            checks: {},
            issues: [],
        };

        // 1. Check for pending leads
        try {
            const { data: leads, error: leadsError } = await supabase
                .from('gmail_outreach_leads')
                .select('id, sequence_id, candidate_email, status, scheduled_for, current_step_number')
                .in('status', ['pending', 'running']);

            if (leadsError) {
                diagnostics.checks.pendingLeads = { error: leadsError.message };
                diagnostics.issues.push(`Could not fetch leads: ${leadsError.message}`);
            } else {
                diagnostics.checks.pendingLeads = {
                    count: leads?.length || 0,
                    data: leads?.slice(0, 5) || [],
                    notes: `Showing first 5 of ${leads?.length || 0} leads`,
                };
            }
        } catch (error: any) {
            diagnostics.checks.pendingLeads = { error: error.message };
            diagnostics.issues.push(`Exception fetching leads: ${error.message}`);
        }

        // 2. Check for active Gmail accounts
        try {
            const { data: accounts, error: accountsError } = await supabase
                .from('gmail_accounts')
                .select('id, email, user_id, status, access_token')
                .eq('status', 'active');

            if (accountsError) {
                diagnostics.checks.gmailAccounts = { error: accountsError.message };
                diagnostics.issues.push(`Could not fetch accounts: ${accountsError.message}`);
            } else {
                const accountsList = accounts?.map(a => ({
                    email: a.email,
                    status: a.status,
                    hasToken: !!a.access_token,
                    id: a.id,
                    user_id: a.user_id,
                })) || [];
                
                diagnostics.checks.gmailAccounts = {
                    count: accountsList.length,
                    accounts: accountsList,
                };

                // Check for accounts without tokens
                const accountsWithoutTokens = accountsList.filter(a => !a.hasToken);
                if (accountsWithoutTokens.length > 0) {
                    diagnostics.issues.push(
                        `${accountsWithoutTokens.length} Gmail account(s) missing access_token: ${accountsWithoutTokens.map(a => a.email).join(', ')}`
                    );
                }
            }
        } catch (error: any) {
            diagnostics.checks.gmailAccounts = { error: error.message };
            diagnostics.issues.push(`Exception fetching accounts: ${error.message}`);
        }

        // 3. Check for active sequences
        try {
            const { data: sequences, error: seqError } = await supabase
                .from('gmail_sequences')
                .select('id, name, status, user_id')
                .eq('status', 'active');

            if (seqError) {
                diagnostics.checks.sequences = { error: seqError.message };
                diagnostics.issues.push(`Could not fetch sequences: ${seqError.message}`);
            } else {
                diagnostics.checks.sequences = {
                    count: sequences?.length || 0,
                    data: sequences || [],
                };
            }
        } catch (error: any) {
            diagnostics.checks.sequences = { error: error.message };
            diagnostics.issues.push(`Exception fetching sequences: ${error.message}`);
        }

        // 4. Basic connection test
        try {
            const { data: test } = await supabase.from('gmail_accounts').select('id').limit(1);
            diagnostics.checks.supabaseConnection = { status: 'ok', connected: true };
        } catch (error: any) {
            diagnostics.checks.supabaseConnection = { status: 'error', error: error.message };
            diagnostics.issues.push(`Supabase connection failed: ${error.message}`);
        }

        // 5. Summary
        diagnostics.summary = {
            healthy: diagnostics.issues.length === 0,
            issueCount: diagnostics.issues.length,
            nextSteps: generateNextSteps(diagnostics),
        };

        return res.status(200).json(diagnostics);
    } catch (error: any) {
        console.error('[Diagnose] Fatal error:', error);
        return res.status(500).json({
            error: 'Diagnostic failed',
            message: error?.message || String(error),
            timestamp: new Date().toISOString(),
        });
    }
}

function generateNextSteps(diagnostics: any): string[] {
    const steps: string[] = [];

    if ((diagnostics.checks.pendingLeads?.count || 0) === 0) {
        steps.push('ℹ️ No pending leads found. Create a sequence and add candidates first.');
    }

    if ((diagnostics.checks.gmailAccounts?.count || 0) === 0) {
        steps.push('⚠️ No Gmail accounts connected. Go to Buzones > Cuentas and connect a Gmail account.');
    }

    const accountsWithoutTokens = (diagnostics.checks.gmailAccounts?.accounts || []).filter(
        (a: any) => !a.hasToken
    );
    if (accountsWithoutTokens.length > 0) {
        steps.push(
            `⚠️ ${accountsWithoutTokens.length} account(s) need reconnection (missing tokens). Go to Buzones > Cuentas and reconnect them.`
        );
    }

    if ((diagnostics.checks.sequences?.count || 0) === 0) {
        steps.push('ℹ️ No active sequences. Create a sequence and click "Activar Secuencia".');
    }

    if (diagnostics.issues.length === 0) {
        steps.push(
            '✅ System looks healthy! If emails still aren\'t sending, check the server logs for more details.'
        );
    }

    return steps;
}
