import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GmailOutreachService } from '../lib/gmailOutreachService';

/**
 * Manual trigger for Gmail outreach processing
 * Useful for testing without waiting for the scheduled cron
 * Requires authorization token in header
 */
export const config = {
    maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify auth token (use the same CRON_SECRET)
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized - missing or invalid authorization' });
    }

    try {
        console.log('[TestOutreach] Manually triggering Gmail outreach processing...');
        
        // Process pending Gmail outreach leads
        const result = await GmailOutreachService.processPendingLeads();
        
        console.log('[TestOutreach] Completed:', result);

        return res.status(200).json({
            success: true,
            message: 'Gmail outreach processed manually',
            data: result,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[TestOutreach] Error:', error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Test outreach trigger failed',
            error: error?.toString(),
        });
    }
}
