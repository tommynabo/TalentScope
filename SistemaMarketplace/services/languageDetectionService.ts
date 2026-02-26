/**
 * LanguageDetectionService - Detects if a candidate speaks a specific language
 * 
 * IMPORTANT: For Spanish, this delegates to the robust analyzeSpanishLanguageProficiency
 * from the GitHub system. That filter requires ACTUAL SPANISH TEXT in the profile,
 * not just a country/location match.
 */

import { analyzeSpanishLanguageProficiency, detectSpanishInText } from '../../SistemaGithub/lib/githubSpanishLanguageFilter';

export class LanguageDetectionService {

  /**
   * Detect language from profile text
   * For Spanish: requires actual Spanish text, not just country mention
   */
  static detectLanguage(
    bio: string = '',
    title: string = '',
    country: string = ''
  ): 'es' | 'en' | 'unknown' {
    // Use the robust GitHub Spanish filter
    const analysis = analyzeSpanishLanguageProficiency(
      bio || undefined,           // bio
      country || undefined,       // location
      undefined,                  // profile_name (not available here)
      undefined,                  // company (not available here)
      undefined,                  // repoDescriptions (N/A for marketplace)
      undefined                   // profileReadmeText (N/A for marketplace)
    );

    // Also check title + bio directly for Spanish text
    const combinedText = `${bio} ${title}`.trim();
    const hasSpanishInText = combinedText.length > 10 && detectSpanishInText(combinedText);

    if (analysis.hasSpanishText || hasSpanishInText) {
      return 'es';
    }

    return 'en';
  }

  /**
   * Check if candidate speaks required language
   * For Spanish: the profile MUST contain actual Spanish text
   */
  static speaksLanguage(
    bio: string = '',
    title: string = '',
    country: string = '',
    requiredLanguage: string = 'en'
  ): boolean {
    if (!requiredLanguage || requiredLanguage === 'en') {
      return true; // English is default, accept all
    }

    if (requiredLanguage === 'es' || requiredLanguage === 'español') {
      // Delegate to the robust GitHub Spanish filter
      const analysis = analyzeSpanishLanguageProficiency(
        bio || undefined,
        country || undefined,
        undefined,  // name not available in marketplace context
        undefined,  // company not available in marketplace context
      );

      // Also check title + bio for Spanish text
      const combinedText = `${bio} ${title}`.trim();
      const hasSpanishInCombined = combinedText.length > 10 && detectSpanishInText(combinedText);

      // STRICT: must have Spanish text somewhere in bio/title
      return analysis.hasSpanishText || hasSpanishInCombined;
    }

    return true; // For other languages, accept all by default
  }
}
