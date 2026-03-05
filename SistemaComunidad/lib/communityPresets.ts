import { CommunityFilterCriteria, CommunityPlatform } from '../types/community';

/**
 * Community Search Presets
 * 
 * Pre-configured search profiles for common community hunting scenarios.
 * Each preset defines filters optimized for specific talent profiles.
 */

// ─── Discord: Flutter/Dart Developers ────────────────────────────────────────

export const PRESET_DISCORD_FLUTTER_DEVS: CommunityFilterCriteria = {
    platforms: [CommunityPlatform.Discord],
    keywords: ['flutter', 'dart', 'mobile', 'widget', 'riverpod', 'bloc', 'firebase'],
    targetRole: 'Flutter Developer',
    discordServerIds: [
        // Popular Flutter Discord servers (IDs to be configured)
    ],
    minActivityScore: 30,
    minReputation: 20,
    minMessageCount: 10,
    roles: ['helper', 'contributor', 'active_member'],
    requireProjectLinks: false,
    requireSpanishSpeaker: true,
    minSpanishConfidence: 25,
    maxResults: 100,
    maxDaysOld: 90,
};

// ─── Reddit: SaaS Builders ──────────────────────────────────────────────────

export const PRESET_REDDIT_SAAS_BUILDERS: CommunityFilterCriteria = {
    platforms: [CommunityPlatform.Reddit],
    keywords: ['saas', 'startup', 'mvp', 'product', 'indie hacker', 'side project', 'launched', 'shipping'],
    targetRole: 'Product Engineer / SaaS Builder',
    subreddits: [
        'SaaS', 'startups', 'webdev', 'reactjs', 'nextjs',
        'indiehackers', 'sidehustle', 'EntrepreneurRideAlong',
    ],
    minActivityScore: 25,
    minReputation: 15,
    minMessageCount: 5,
    roles: ['contributor', 'active_member'],
    requireProjectLinks: true,
    requireSpanishSpeaker: false,
    maxResults: 150,
    maxDaysOld: 60,
};

// ─── Skool: Tech Communities ────────────────────────────────────────────────

export const PRESET_SKOOL_TECH_COMMUNITIES: CommunityFilterCriteria = {
    platforms: [CommunityPlatform.Skool],
    keywords: ['developer', 'code', 'programming', 'building', 'tech', 'software', 'engineering'],
    targetRole: 'Technical Builder',
    skoolCommunityUrls: [
        // Skool community URLs to be configured
    ],
    minActivityScore: 20,
    minReputation: 10,
    minMessageCount: 3,
    roles: ['contributor', 'active_member'],
    requireProjectLinks: false,
    requireSpanishSpeaker: true,
    minSpanishConfidence: 25,
    maxResults: 80,
    maxDaysOld: 120,
};

// ─── GitHub Discussions: Active Contributors ────────────────────────────────

export const PRESET_GITHUB_DISCUSSIONS_ACTIVE: CommunityFilterCriteria = {
    platforms: [CommunityPlatform.GitHubDiscussions],
    keywords: ['flutter', 'react', 'typescript', 'architecture', 'performance', 'security'],
    targetRole: 'Senior Developer',
    githubRepos: [
        'flutter/flutter',
        'vercel/next.js',
        'supabase/supabase',
        'facebook/react',
    ],
    minActivityScore: 40,
    minReputation: 30,
    minMessageCount: 10,
    minHelpfulnessScore: 40,
    roles: ['helper', 'contributor'],
    requireProjectLinks: false,
    requireCodeContributions: true,
    requireSpanishSpeaker: false,
    maxResults: 100,
    maxDaysOld: 90,
};

// ─── Multi-Platform: Spanish-Speaking Builders ──────────────────────────────

export const PRESET_SPANISH_BUILDERS: CommunityFilterCriteria = {
    platforms: [
        CommunityPlatform.Discord,
        CommunityPlatform.Reddit,
        CommunityPlatform.Skool,
    ],
    keywords: [
        'desarrollador', 'flutter', 'react', 'mobile', 'saas', 'startup',
        'proyecto', 'app', 'typescript', 'javascript', 'python',
    ],
    targetRole: 'Hispanic Tech Builder',
    subreddits: ['programacion', 'devarg', 'programar'],
    minActivityScore: 20,
    minReputation: 10,
    minMessageCount: 5,
    roles: ['helper', 'contributor', 'active_member'],
    requireProjectLinks: false,
    requireSpanishSpeaker: true,
    minSpanishConfidence: 30,
    languages: ['es'],
    maxResults: 200,
    maxDaysOld: 90,
};

// ─── All Presets Map ─────────────────────────────────────────────────────────

export const COMMUNITY_PRESETS: Record<string, {
    name: string;
    description: string;
    criteria: CommunityFilterCriteria;
    icon: string;
}> = {
    discord_flutter: {
        name: 'Flutter Discord Devs',
        description: 'Desarrolladores activos en servidores de Flutter/Dart en Discord',
        criteria: PRESET_DISCORD_FLUTTER_DEVS,
        icon: '🎯',
    },
    reddit_saas: {
        name: 'Reddit SaaS Builders',
        description: 'Builders de SaaS e Indie Hackers en subreddits técnicos',
        criteria: PRESET_REDDIT_SAAS_BUILDERS,
        icon: '🚀',
    },
    skool_tech: {
        name: 'Skool Tech Communities',
        description: 'Miembros activos en comunidades técnicas de Skool',
        criteria: PRESET_SKOOL_TECH_COMMUNITIES,
        icon: '🎓',
    },
    github_discussions: {
        name: 'GitHub Discussions Active',
        description: 'Contribuidores activos en Discussions de repos populares',
        criteria: PRESET_GITHUB_DISCUSSIONS_ACTIVE,
        icon: '💻',
    },
    spanish_builders: {
        name: 'Spanish-Speaking Builders',
        description: 'Talento hispano multi-plataforma con mentalidad builder',
        criteria: PRESET_SPANISH_BUILDERS,
        icon: '🌍',
    },
};

/**
 * Get preset by key
 */
export function getPreset(key: string): CommunityFilterCriteria | null {
    return COMMUNITY_PRESETS[key]?.criteria || null;
}

/**
 * Get all preset keys
 */
export function getPresetKeys(): string[] {
    return Object.keys(COMMUNITY_PRESETS);
}
