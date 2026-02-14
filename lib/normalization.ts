/**
 * LinkedIn URL Normalization Utility
 * ===================================
 * Ensures all LinkedIn URLs conform to the canonical format expected by
 * automation platforms like Walead (https://app.walead.ai/).
 *
 * Canonical format: https://www.linkedin.com/in/username
 *
 * Handles:
 * - Regional subdomains (es.linkedin.com, fr.linkedin.com, etc.)
 * - Missing protocol (linkedin.com/in/...)
 * - HTTP instead of HTTPS
 * - Query parameters (?originalSubdomain=es, tracking params, etc.)
 * - Hash fragments
 * - Trailing slashes inconsistencies
 * - Mobile URLs (m.linkedin.com)
 * - Mixed case
 */

// Known LinkedIn regional/special subdomains that must be replaced with 'www'
// Matches: es, fr, de (2-letter country), m (mobile), www, or no subdomain
const LINKEDIN_SUBDOMAINS_REGEX = /^(https?:\/\/)?(([a-z]{1,3})\.)?linkedin\.com/i;

/**
 * Normalizes a LinkedIn profile URL to the canonical global format.
 * @param url - Raw LinkedIn URL (any format)
 * @returns Canonical URL `https://www.linkedin.com/in/username` or empty string if invalid
 */
export function normalizeLinkedInUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';

  let cleaned = url.trim();

  // Skip if clearly not a LinkedIn URL
  if (!cleaned.toLowerCase().includes('linkedin.com')) return cleaned;

  // 1. Ensure protocol
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }

  // 2. Force HTTPS
  cleaned = cleaned.replace(/^http:\/\//i, 'https://');

  // 3. Replace any regional/mobile subdomain with 'www'
  //    Matches: es.linkedin.com, fr.linkedin.com, de.linkedin.com, m.linkedin.com, etc.
  cleaned = cleaned.replace(LINKEDIN_SUBDOMAINS_REGEX, 'https://www.linkedin.com');

  // 4. Remove query parameters (e.g., ?originalSubdomain=es, ?trk=..., utm params)
  const queryIdx = cleaned.indexOf('?');
  if (queryIdx !== -1) {
    cleaned = cleaned.substring(0, queryIdx);
  }

  // 5. Remove hash fragments
  const hashIdx = cleaned.indexOf('#');
  if (hashIdx !== -1) {
    cleaned = cleaned.substring(0, hashIdx);
  }

  // 6. Remove trailing slash for consistency
  cleaned = cleaned.replace(/\/+$/, '');

  // 7. Validate structure: must contain /in/ for profile URLs
  if (!cleaned.includes('/in/')) {
    // If it's a company page or other LinkedIn URL, return as-is (still normalized domain)
    return cleaned;
  }

  // 8. Remove language suffix after username (e.g., /in/username/en, /in/username/es)
  //    LinkedIn appends 2-letter language codes as a trailing path segment
  //    Must be done AFTER trailing slash removal
  cleaned = cleaned.replace(/(\/in\/[\w-]+)\/[a-z]{2}$/i, '$1');

  return cleaned;
}

/**
 * Validates that a LinkedIn URL is in the correct canonical format
 * and is likely to be accepted by Walead.
 * @param url - URL to validate
 * @returns Object with validity status and issues found
 */
export function validateLinkedInUrl(url: string | null | undefined): {
  isValid: boolean;
  issues: string[];
  normalized: string;
} {
  const issues: string[] = [];

  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { isValid: false, issues: ['URL vacía o no proporcionada'], normalized: '' };
  }

  const normalized = normalizeLinkedInUrl(url);

  // Check it starts with canonical prefix
  if (!normalized.startsWith('https://www.linkedin.com')) {
    issues.push('No comienza con https://www.linkedin.com');
  }

  // Check it contains /in/ (profile path)
  if (!normalized.includes('/in/')) {
    issues.push('No contiene /in/ (no es un perfil personal)');
  }

  // Check username exists after /in/
  const inIdx = normalized.indexOf('/in/');
  if (inIdx !== -1) {
    const username = normalized.substring(inIdx + 4);
    if (!username || username.length < 2) {
      issues.push('Username de LinkedIn demasiado corto o vacío');
    }
  }

  // Check for query params that shouldn't be there
  if (normalized.includes('?') || normalized.includes('#')) {
    issues.push('Contiene parámetros de query o fragmentos');
  }

  return {
    isValid: issues.length === 0,
    issues,
    normalized
  };
}

/**
 * Batch normalize an array of LinkedIn URLs.
 * Returns a summary with stats on how many were fixed.
 */
export function batchNormalizeLinkedInUrls(urls: (string | null | undefined)[]): {
  results: { original: string; normalized: string; wasFixed: boolean }[];
  stats: { total: number; fixed: number; empty: number; valid: number };
} {
  const results = urls.map(url => {
    const original = url || '';
    const normalized = normalizeLinkedInUrl(url);
    return {
      original,
      normalized,
      wasFixed: original !== normalized && normalized !== ''
    };
  });

  return {
    results,
    stats: {
      total: urls.length,
      fixed: results.filter(r => r.wasFixed).length,
      empty: results.filter(r => r.normalized === '').length,
      valid: results.filter(r => !r.wasFixed && r.normalized !== '').length
    }
  };
}
