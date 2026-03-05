import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 30 };

/**
 * Community Search Proxy
 * 
 * Server-side proxy for external API calls that can't be made directly
 * from the browser due to CORS. Supports:
 * 
 *   - GitHub Search Users:  ?platform=github-users&query=flutter+developer&limit=30
 *   - GitHub Search Issues:  ?platform=github-issues&query=flutter+is:issue&limit=30
 *   - GitHub Repo Issues:    ?platform=github&repo=flutter/flutter&limit=100
 *   - Reddit (via RSS):      ?platform=reddit&subreddit=FlutterDev&query=flutter&limit=25
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const platform = req.query.platform as string;

    try {
        switch (platform) {
            case 'github-users':
                return await handleGitHubUsers(req, res);
            case 'github-issues':
                return await handleGitHubIssues(req, res);
            case 'github':
                return await handleGitHubRepoIssues(req, res);
            case 'reddit':
                return await handleRedditRSS(req, res);
            default:
                return res.status(400).json({ error: `Unknown platform: ${platform}` });
        }
    } catch (error: any) {
        console.error('[community-search] Error:', error);
        return res.status(500).json({ error: error.message || 'Internal error' });
    }
}

// ─── GitHub Search Users API ─────────────────────────────────────────────────
// Finds developer profiles matching keywords, location, language

async function handleGitHubUsers(req: VercelRequest, res: VercelResponse) {
    const query = req.query.query as string || 'developer';
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    const url = `https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=${limit}`;
    console.log(`[community-search] GitHub Users: q=${query} limit=${limit}`);

    const response = await fetch(url, {
        headers: { 'User-Agent': 'TalentScope/1.0', 'Accept': 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[community-search] GitHub Users error ${response.status}`);
        return res.status(response.status).json({ error: `GitHub API: ${response.status}`, details: text.slice(0, 200) });
    }

    const data = await response.json();
    const users = (data.items || []).map((u: any) => ({
        login: u.login,
        avatar_url: u.avatar_url,
        html_url: u.html_url,
        type: u.type,
        score: u.score, // GitHub's relevance score
    }));

    console.log(`[community-search] GitHub Users: ${users.length} found (total: ${data.total_count})`);
    return res.status(200).json({ users, total: data.total_count || 0 });
}

// ─── GitHub Search Issues API ────────────────────────────────────────────────
// Finds developers by their issue/discussion activity

async function handleGitHubIssues(req: VercelRequest, res: VercelResponse) {
    const query = req.query.query as string || 'developer';
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=${limit}&sort=reactions`;
    console.log(`[community-search] GitHub Issues: q=${query} limit=${limit}`);

    const response = await fetch(url, {
        headers: { 'User-Agent': 'TalentScope/1.0', 'Accept': 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[community-search] GitHub Issues error ${response.status}`);
        return res.status(response.status).json({ error: `GitHub API: ${response.status}`, details: text.slice(0, 200) });
    }

    const data = await response.json();
    const issues = (data.items || []).map((i: any) => ({
        author: i.user?.login,
        avatar_url: i.user?.avatar_url,
        html_url: i.html_url,
        user_html_url: i.user?.html_url,
        title: i.title,
        comments: i.comments,
        reactions_total: i.reactions?.total_count || 0,
        created_at: i.created_at,
        repo_url: i.repository_url,
    }));

    console.log(`[community-search] GitHub Issues: ${issues.length} found (total: ${data.total_count})`);
    return res.status(200).json({ issues, total: data.total_count || 0 });
}

// ─── GitHub Repo Issues ──────────────────────────────────────────────────────

async function handleGitHubRepoIssues(req: VercelRequest, res: VercelResponse) {
    const repo = req.query.repo as string;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!repo) {
        return res.status(400).json({ error: 'Missing repo parameter' });
    }

    const url = `https://api.github.com/repos/${repo}/issues?per_page=${limit}&state=all`;
    console.log(`[community-search] GitHub Repo: ${repo}`);

    const response = await fetch(url, {
        headers: { 'User-Agent': 'TalentScope/1.0' },
    });

    if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: `GitHub API: ${response.status}`, details: text.slice(0, 200) });
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

    return res.status(200).json({ issues: mapped, total: mapped.length });
}

// ─── Reddit via RSS (JSON API blocked from datacenter IPs) ───────────────────

async function handleRedditRSS(req: VercelRequest, res: VercelResponse) {
    const subreddit = req.query.subreddit as string;
    const query = req.query.query as string || '';
    const limit = parseInt(req.query.limit as string) || 25;

    if (!subreddit) {
        return res.status(400).json({ error: 'Missing subreddit parameter' });
    }

    // Use RSS (Atom) feed — Reddit's JSON API blocks datacenter IPs but RSS usually works
    const url = `https://www.reddit.com/r/${subreddit}/search.rss?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=relevance&t=year`;
    console.log(`[community-search] Reddit RSS: r/${subreddit} q=${query}`);

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TalentScope/1.0; +https://talentscope.app)',
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[community-search] Reddit RSS error ${response.status}:`, text.slice(0, 200));
        return res.status(response.status).json({ error: `Reddit RSS error: ${response.status}`, details: text.slice(0, 200) });
    }

    const xml = await response.text();

    // Parse RSS/Atom XML to extract posts and authors
    const posts: any[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
        const entry = match[1];

        const author = extractTag(entry, 'name') || 'unknown';
        const title = extractTag(entry, 'title') || '';
        const link = extractAttr(entry, 'link', 'href') || '';
        const updated = extractTag(entry, 'updated') || '';
        const content = extractTag(entry, 'content') || '';

        // Estimate engagement from content
        const commentMatch = content.match(/(\d+)\s*comment/i);
        const scoreMatch = content.match(/(\d+)\s*point/i);

        posts.push({
            author: author.replace('/u/', ''),
            title,
            url: link,
            updated,
            num_comments: commentMatch ? parseInt(commentMatch[1]) : 0,
            score: scoreMatch ? parseInt(scoreMatch[1]) : 1,
            subreddit,
        });
    }

    console.log(`[community-search] Reddit RSS: ${posts.length} entries from r/${subreddit}`);
    return res.status(200).json({ posts, total: posts.length });
}

// ─── XML Helpers ─────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') : null;
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
}
