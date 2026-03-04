import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GmailOutreachService } from '../lib/gmailOutreachService';

/**
 * Manual trigger for Gmail outreach processing
 * Useful for testing without waiting for the scheduled cron
 * Requires authorization token in header
 * 
 * Usage:
 * curl -X POST https://app.com/api/test-outreach \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *   -H "Content-Type: application/json"
 */
export const config = {
    maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify auth token (fallback to env or accept without if not set)
        const authHeader = req.headers['authorization'];
        const cronSecret = process.env.CRON_SECRET;
        
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: 'Missing or invalid authorization header'
            });
        }

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
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        return res.status(500).json({
            success: false,
            message: 'Test outreach trigger failed',
            error: errorMessage,
            details: error?.stack?.split('\n').slice(0, 3),
        });
    }
}

