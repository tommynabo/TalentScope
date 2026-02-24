/**
 * LanguageDetectionService - Detects if a candidate speaks a specific language
 * Uses keyword matching in profile bio/description text
 */

export class LanguageDetectionService {
  /**
   * Spanish language indicators - words/phrases that indicate Spanish language expertise
   */
  private static SPANISH_KEYWORDS = [
    // Direct Spanish language mentions
    'español',
    'spanish',
    'harablo español',
    'hablo español',
    'spanish speaker',
    'spanish native',
    'native spanish',
    'castellano',
    
    // Common Spanish tech/freelance phrases
    'proyecto en español',
    'trabajos en español',
    'cliente español',
    'españa',
    'méxico',
    'méxico',
    'argentina',
    'colombia',
    'chile',
    'perú',
    'venezuela',
    'latino',
    'latinoamericano',
    'hispanohablante',
    
    // Client/work indicators
    'south america',
    'south american',
    'latin america',
    'spanish speaking',
    'spanish-speaking',
  ];

  /**
   * Detect if candidate speaks Spanish based on profile text
   * @param bio - Candidate's biography/description
   * @param title - Candidate's job title
   * @param country - Candidate's country
   * @returns Language detected: 'es' | 'en' | 'unknown'
   */
  static detectLanguage(
    bio: string = '',
    title: string = '',
    country: string = ''
  ): 'es' | 'en' | 'unknown' {
    const profileText = `${bio} ${title} ${country}`.toLowerCase();

    // Count Spanish keyword matches
    let spanishMatches = 0;
    for (const keyword of this.SPANISH_KEYWORDS) {
      if (profileText.includes(keyword)) {
        spanishMatches++;
      }
    }

    // If we found Spanish keywords, mark as Spanish speaker
    if (spanishMatches >= 1) {
      return 'es';
    }

    // Check for Spanish-speaking countries in profile
    const spanishCountries = [
      'spain',
      'mexico',
      'argentina',
      'colombia',
      'chile',
      'peru',
      'venezuela',
      'ecuador',
      'guatemala',
      'cuba',
      'bolivia',
      'honduras',
      'el salvador',
      'nicaragua',
      'panama',
      'costa rica',
      'dominican',
      'uruguay',
      'paraguay',
      'puerto rico',
    ];

    if (spanishCountries.some(c => profileText.includes(c))) {
      return 'es';
    }

    return 'en'; // Default to English if no Spanish indicators
  }

  /**
   * Check if candidate speaks required language
   * @param bio - Candidate's biography
   * @param title - Candidate's title
   * @param country - Candidate's country
   * @param requiredLanguage - Required language code ('es', 'en', etc.)
   * @returns true if candidate speaks the required language
   */
  static speaksLanguage(
    bio: string = '',
    title: string = '',
    country: string = '',
    requiredLanguage: string = 'en'
  ): boolean {
    if (!requiredLanguage || requiredLanguage === 'en') {
      // English is default, accept all
      return true;
    }

    if (requiredLanguage === 'es') {
      const detected = this.detectLanguage(bio, title, country);
      return detected === 'es';
    }

    return true; // For other languages, accept all by default
  }
}
