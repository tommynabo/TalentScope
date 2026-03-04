
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GmailOutreachService } from '../lib/gmailOutreachService';

// Vercel Serverless Function
export const config = {
    maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Verify Cron Secret
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('[Cron] Starting Gmail outreach processing...');
        
        // 2. Process pending Gmail outreach leads
        const result = await GmailOutreachService.processPendingLeads();
        
        console.log('[Cron] Gmail outreach completed:', result);

        return res.status(200).json({
            success: true,
            message: 'Gmail outreach processed',
            result,
        });
    } catch (error: any) {
        console.error('[Cron] Error:', error);
        return res.status(500).json({
            success: false,
            message: error?.message || 'Cron job failed',
        });
    }
}
