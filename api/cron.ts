
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Serverless Function (switched from edge due to global outage)
export const config = {
    maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Verify Cron Secret
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Logic: Trigger Search for Active Campaigns (Placeholder)
    console.log("Cron Job Triggered: Executing Daily Search...");

    return res.status(200).json({ success: true, message: "Daily search executed" });
}
