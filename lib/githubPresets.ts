import { GitHubFilterCriteria } from '../types/database';

/**
 * Preset GitHub Filter Criteria Templates
 * 
 * Utiliza estos templates como punto de partida para búsquedas comunes.
 * Todos están calibrados basados en el algoritmo de scoring.
 */

// ===========================
// PRESET 1: "Proven Shippers"
// ===========================
export const PRESET_PROVEN_SHIPPERS: GitHubFilterCriteria = {
    // Repository Metrics
    min_stars: 100,          // Alta calidad
    max_stars: 10000,
    min_forks: 0,
    languages: ['dart', 'flutter'],
    
    // Developer Signals
    min_public_repos: 5,
    min_followers: 50,        // Reconocimiento mínimo
    min_contributions_per_month: 8,
    
    // Code Quality Filters
    min_originality_ratio: 60, // Anti-bootcamp strict
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 3,
    
    // Store Presence - THE CRITICAL SIGNAL
    require_app_store_link: true, // ⭐ ONLY published apps
    
    // Location & Demographics
    locations: ['Spain', 'Barcelona'],
    available_for_hire: false,
    
    score_threshold: 75  // Top tier only
};

// ===========================
// PRESET 2: "Builders Emergentes"
// ===========================
export const PRESET_EMERGING_BUILDERS: GitHubFilterCriteria = {
    // Repository Metrics
    min_stars: 30,           // Baja - permiten juniors
    max_stars: 5000,
    min_forks: 0,
    languages: ['dart', 'flutter', 'kotlin'],
    
    // Developer Signals
    min_public_repos: 3,     // Baja - juniors tienen menos
    min_followers: 5,        // Muy baja
    min_contributions_per_month: 3,
    
    // Code Quality Filters
    min_originality_ratio: 40, // Menos estricto
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 6,
    
    // Store Presence
    require_app_store_link: false, // No required - buscan potencial
    
    // Location & Demographics
    locations: ['Spain'],
    available_for_hire: true, // "Open to work"
    
    score_threshold: 50  // Más amplio
};

// ===========================
// PRESET 3: "Full-Stack Specialists"
// ===========================
export const PRESET_FULLSTACK_SPECIALISTS: GitHubFilterCriteria = {
    // Repository Metrics
    min_stars: 75,
    max_stars: 15000,
    min_forks: 5,            // Deben tener forks (re-usando código)
    languages: ['dart', 'typescript', 'kotlin', 'python', 'go'],
    
    // Developer Signals
    min_public_repos: 8,
    min_followers: 100,      // Alto - reconocidos
    min_contributions_per_month: 10,
    
    // Code Quality Filters
    min_originality_ratio: 50,
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 2, // Muy activo
    
    // Store Presence
    require_app_store_link: false,
    
    // Location & Demographics
    locations: ['Spain', 'Barcelona', 'Madrid'],
    available_for_hire: false,
    
    score_threshold: 70
};

// ===========================
// PRESET 4: "Open Source Contributors"
// ===========================
export const PRESET_OPEN_SOURCE_CONTRIBUTORS: GitHubFilterCriteria = {
    // Repository Metrics
    min_stars: 150,          // Alto para OS
    max_stars: 50000,        // Permite megaprojects
    min_forks: 10,           // Deben tener high-quality forks
    languages: ['dart', 'flutter', 'typescript', 'rust', 'go'],
    
    // Developer Signals
    min_public_repos: 15,    // Muchos repos = grande en OS
    min_followers: 200,      // Alto - community leaders
    min_contributions_per_month: 15,
    
    // Code Quality Filters
    min_originality_ratio: 70, // Mucho trabajo original
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 1, // Súper activo
    
    // Store Presence
    require_app_store_link: false,
    
    // Location & Demographics
    locations: ['Spain'],
    available_for_hire: false,
    
    score_threshold: 75
};

// ===========================
// PRESET 5: "University/Intern Talent Pool"
// ===========================
export const PRESET_UNIVERSITY_TALENT: GitHubFilterCriteria = {
    // Repository Metrics - BAJO
    min_stars: 5,
    max_stars: 500,
    min_forks: 0,
    languages: ['dart', 'flutter', 'java', 'python'],
    
    // Developer Signals - BAJO
    min_public_repos: 2,
    min_followers: 0,        // No filter
    min_contributions_per_month: 1,
    
    // Code Quality - FLEXIBLE
    min_originality_ratio: 50,
    exclude_generic_repos: false, // Allow learning projects
    require_recent_activity: false,
    max_months_since_last_commit: 12,
    
    // Store Presence
    require_app_store_link: false,
    
    // Location & Demographics
    locations: ['Spain'],
    available_for_hire: true, // Buscan prácticas
    
    score_threshold: 30  // Bajo threshold
};

// ===========================
// PRESET 6: "Product Engineers"
// ===========================
export const PRESET_PRODUCT_ENGINEERS: GitHubFilterCriteria = {
    // Repository Metrics
    min_stars: 80,
    max_stars: 20000,
    min_forks: 3,
    languages: ['dart', 'typescript', 'kotlin', 'swift'],
    
    // Developer Signals
    min_public_repos: 6,
    min_followers: 80,
    min_contributions_per_month: 7,
    
    // Code Quality Filters
    min_originality_ratio: 55,
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 4,
    
    // Store Presence - MUY IMPORTANTE
    require_app_store_link: true,  // Must have shipped
    
    // Location & Demographics
    locations: ['Spain', 'Barcelona'],
    available_for_hire: false,
    
    score_threshold: 72  // High quality
};

// ===========================
// PRESET 7: "Solo Developers / Indie Hackers"
// ===========================
export const PRESET_SOLO_DEVELOPERS: GitHubFilterCriteria = {
    // Repository Metrics
    min_stars: 50,
    max_stars: 3000,
    min_forks: 0,
    languages: ['dart', 'flutter', 'go', 'rust'],
    
    // Developer Signals
    min_public_repos: 4,
    min_followers: 20,
    min_contributions_per_month: 5,
    
    // Code Quality Filters
    min_originality_ratio: 90, // Mostly own projects
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 2,
    
    // Store Presence
    require_app_store_link: true,  // Indie hackers ship
    
    // Location & Demographics
    locations: ['Spain'],
    available_for_hire: false,
    
    score_threshold: 70
};

// ===========================
// PRESET 8: "Machine Learning Developers"
// ===========================
export const PRESET_ML_DEVELOPERS: GitHubFilterCriteria = {
    // Repository Metrics
    min_stars: 100,
    max_stars: 50000,
    min_forks: 5,
    languages: ['python', 'typescript', 'go', 'rust'],
    
    // Developer Signals
    min_public_repos: 10,
    min_followers: 150,
    min_contributions_per_month: 12,
    
    // Code Quality Filters
    min_originality_ratio: 65,
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 2,
    
    // Store Presence
    require_app_store_link: false,
    
    // Location & Demographics
    locations: ['Spain'],
    available_for_hire: false,
    
    score_threshold: 75
};

// ===========================
// PRESET 9: "Quality Over Quantity"
// ===========================
export const PRESET_QUALITY_OBSESSED: GitHubFilterCriteria = {
    // Repository Metrics - STRICT
    min_stars: 200,          // Very high
    max_stars: 100000,
    min_forks: 15,           // High engagement
    languages: ['dart', 'flutter'],
    
    // Developer Signals - STRICT
    min_public_repos: 10,
    min_followers: 300,
    min_contributions_per_month: 15,
    
    // Code Quality - EXTREMELY STRICT
    min_originality_ratio: 80,
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 1,
    
    // Store Presence
    require_app_store_link: true,
    
    // Location & Demographics
    locations: ['Spain'],
    available_for_hire: false,
    
    score_threshold: 85  // Only A-players
};

// ===========================
// PRESET 10: "Volume Search (Wide Net)"
// ===========================
export const PRESET_VOLUME_SEARCH: GitHubFilterCriteria = {
    // Repository Metrics - LOOSE
    min_stars: 10,
    max_stars: 5000,
    min_forks: 0,
    languages: ['dart', 'flutter', 'kotlin', 'swift', 'typescript'],
    
    // Developer Signals - LOOSE
    min_public_repos: 1,
    min_followers: 0,
    min_contributions_per_month: 1,
    
    // Code Quality - FLEXIBLE
    min_originality_ratio: 30,
    exclude_generic_repos: false,
    require_recent_activity: false,
    max_months_since_last_commit: 12,
    
    // Store Presence
    require_app_store_link: false,
    
    // Location & Demographics
    locations: ['Spain'],
    available_for_hire: false,
    
    score_threshold: 40  // Very permissive
};

// ===========================
// ALLPRESETS EXPORT
// ===========================
export const GITHUB_FILTER_PRESETS = {
    'Proven Shippers': PRESET_PROVEN_SHIPPERS,
    'Emerging Builders': PRESET_EMERGING_BUILDERS,
    'Full-Stack Specialists': PRESET_FULLSTACK_SPECIALISTS,
    'Open Source Contributors': PRESET_OPEN_SOURCE_CONTRIBUTORS,
    'University Talent': PRESET_UNIVERSITY_TALENT,
    'Product Engineers': PRESET_PRODUCT_ENGINEERS,
    'Solo Developers': PRESET_SOLO_DEVELOPERS,
    'ML Developers': PRESET_ML_DEVELOPERS,
    'Quality Obsessed': PRESET_QUALITY_OBSESSED,
    'Volume Search': PRESET_VOLUME_SEARCH
};

// ===========================
// QUALITY SCORES BY PRESET
// ===========================
/**
 * Estimated results distribution by preset
 * (Based on 50 user search in Spain with dart/flutter)
 */
export const PRESET_INSIGHTS = {
    'Proven Shippers': {
        description: 'Developers with published apps on stores',
        expectedResults: '5-15 users',
        avgScore: 82,
        timeToSearch: '3-5 min',
        difficulty: 'Very High - "Finding Needles"',
        bestFor: 'High conversion campaigns, premium outreach'
    },
    'Emerging Builders': {
        description: 'Young developers with product mindset',
        expectedResults: '30-60 users',
        avgScore: 58,
        timeToSearch: '4-6 min',
        difficulty: 'Medium - Large pool',
        bestFor: 'Volume hiring, internships, junior roles'
    },
    'Full-Stack Specialists': {
        description: 'Multi-language experts with proven track record',
        expectedResults: '8-20 users',
        avgScore: 75,
        timeToSearch: '5-8 min',
        difficulty: 'High - Specific skills',
        bestFor: 'Senior roles, tech leadership'
    },
    'Open Source Contributors': {
        description: 'Community leaders and library maintainers',
        expectedResults: '3-10 users',
        avgScore: 78,
        timeToSearch: '6-10 min',
        difficulty: 'Very High - "Unicorns"',
        bestFor: 'Technical advisory, architect positions'
    },
    'University Talent': {
        description: 'Students and recent grads',
        expectedResults: '80-200 users',
        avgScore: 42,
        timeToSearch: '4-6 min',
        difficulty: 'Low - High volume',
        bestFor: 'Talent pipeline, campus hiring'
    },
    'Product Engineers': {
        description: 'Builders with shipped products',
        expectedResults: '10-20 users',
        avgScore: 76,
        timeToSearch: '3-5 min',
        difficulty: 'High - Critical app requirement',
        bestFor: 'Product roles, founder hiring'
    },
    'Solo Developers': {
        description: 'Indie hackers who ship solo',
        expectedResults: '5-12 users',
        avgScore: 74,
        timeToSearch: '3-5 min',
        difficulty: 'Very High - Specific profile',
        bestFor: 'Contractors, fractional engineers'
    },
    'ML Developers': {
        description: 'Machine learning & AI specialists',
        expectedResults: '3-8 users',
        avgScore: 76,
        timeToSearch: '5-8 min',
        difficulty: 'Very High - Niche skills',
        bestFor: 'AI/ML teams, research positions'
    },
    'Quality Obsessed': {
        description: 'Top 1% of developers',
        expectedResults: '1-5 users',
        avgScore: 87,
        timeToSearch: '2-3 min',
        difficulty: 'Extreme - "Finding Diamonds"',
        bestFor: 'C-level tech, founding teams'
    },
    'Volume Search': {
        description: 'Cast the widest net possible',
        expectedResults: '100+ users',
        avgScore: 48,
        timeToSearch: '5-8 min',
        difficulty: 'Low',
        bestFor: 'Bulk prospecting, testing market'
    }
};

// ===========================
// CUSTOM HELPER FUNCTION
// ===========================
export function createCustomCriteria(
    basePreset: GitHubFilterCriteria,
    overrides: Partial<GitHubFilterCriteria>
): GitHubFilterCriteria {
    return {
        ...basePreset,
        ...overrides
    };
}

// ===========================
// USAGE EXAMPLES
// ===========================
/**
 * Example: Using presets in your component
 * 
 * import { GITHUB_FILTER_PRESETS, createCustomCriteria } from './lib/githubPresets';
 * 
 * // Use preset directly
 * const criteria = GITHUB_FILTER_PRESETS['Proven Shippers'];
 * 
 * // Or customize a preset
 * const customCriteria = createCustomCriteria(
 *   GITHUB_FILTER_PRESETS['Emerging Builders'],
 *   {
 *     min_followers: 50,
 *     score_threshold: 60
 *   }
 * );
 * 
 * // In component
 * <GitHubFilterConfig 
 *   initialCriteria={criteria}
 *   onSave={(newCriteria) => handleSearch(newCriteria)}
 * />
 */
