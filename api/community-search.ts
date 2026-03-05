import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 30 };

/**
 * Community Search Proxy
 * 
 * Proxies requests from the browser to Reddit/GitHub APIs
 * to avoid CORS restrictions. Called by CommunitySearchEngine.
 * 
 * Usage:
 *   GET /api/community-search?platform=reddit&subreddit=FlutterDev&query=flutter&limit=100
 *   GET /api/community-search?platform=github&repo=flutter/flutter&limit=100
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for our frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const platform = req.query.platform as string;

    try {
        if (platform === 'reddit') {
            return await handleReddit(req, res);
        } else if (platform === 'github') {
            return await handleGitHub(req, res);
        } else {
            return res.status(400).json({ error: `Unknown platform: ${platform}` });
        }
    } catch (error: any) {
        console.error('[community-search] Error:', error);
        return res.status(500).json({ error: error.message || 'Internal error' });
    }
}

async function handleReddit(req: VercelRequest, res: VercelResponse) {
    const subreddit = req.query.subreddit as string;
    const query = req.query.query as string || '';
    const limit = parseInt(req.query.limit as string) || 100;

    if (!subreddit) {
        return res.status(400).json({ error: 'Missing subreddit parameter' });
    }

    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=relevance&t=year`;

    console.log(`[community-search] Reddit: fetching ${url}`);

    const response = await fetch(url, {
        headers: { 'User-Agent': 'TalentScope/1.0 (Community Search Bot)' },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[community-search] Reddit error ${response.status}:`, text);
        return res.status(response.status).json({ error: `Reddit API error: ${response.status}`, details: text });
    }

    const data = await response.json();
    const posts = (data.data?.children || []).map((child: any) => ({
        author: child.data?.author,
        title: child.data?.title,
        score: child.data?.score,
        num_comments: child.data?.num_comments,
        subreddit: child.data?.subreddit,
        selftext: child.data?.selftext?.slice(0, 500),
        url: child.data?.url,
        created_utc: child.data?.created_utc,
    }));

    console.log(`[community-search] Reddit: found ${posts.length} posts from r/${subreddit}`);
    return res.status(200).json({ posts, total: posts.length });
}

async function handleGitHub(req: VercelRequest, res: VercelResponse) {
    const repo = req.query.repo as string;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!repo) {
        return res.status(400).json({ error: 'Missing repo parameter' });
    }

    const url = `https://api.github.com/repos/${repo}/issues?per_page=${limit}&state=all`;

    console.log(`[community-search] GitHub: fetching ${url}`);

    const response = await fetch(url, {
        headers: { 'User-Agent': 'TalentScope/1.0' },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[community-search] GitHub error ${response.status}:`, text);
        return res.status(response.status).json({ error: `GitHub API error: ${response.status}`, details: text });
    }

    const issues = await response.json();
    const mapped = (issues || []).map((issue: any) => ({
        author: issue.user?.login,
        avatar_url: issue.user?.avatar_url,
        html_url: issue.html_url,
        user_html_url: issue.user?.html_url,
        title: issue.title,
        comments: issue.comments,
        reactions_total: issue.reactions?.total_count || 0,
        created_at: issue.created_at,
    }));

    console.log(`[community-search] GitHub: found ${mapped.length} issues from ${repo}`);
    return res.status(200).json({ issues: mapped, total: mapped.length });
}
