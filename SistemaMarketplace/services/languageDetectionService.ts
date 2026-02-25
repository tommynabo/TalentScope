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
    'hablo español',
    'spanish speaker',
    'spanish native',
    'native spanish',
    'castellano',
    'castillan',
    'speaks spanish',
    'fluent spanish',
    'advanced spanish',
    'proficient spanish',
    
    // Common Spanish tech/freelance phrases
    'proyecto en español',
    'proyectos en español',
    'trabajos en español',
    'trabajo en español',
    'cliente español',
    'clientes españoles',
    'empresa española',
    'empresas españolas',
    'negocios españoles',
    'spanish speaking clients',
    'spanish clients',
    'hispanic market',
    'lattino american',
    
    // Spanish-speaking countries (common in freelancer profiles)
    'españa',
    'spain',
    'madrid',
    'barcelona',
    'valencia',
    'mexico',
    'méxico',
    'méxico city',
    'mexico city',
    'argentina',
    'buenos aires',
    'colombia',
    'bogota',
    'bogotá',
    'chile',
    'santiago',
    'peru',
    'perú',
    'lima',
    'venezuela',
    'caracas',
    'ecuador',
    'quito',
    'guatemala',
    'honduras',
    'el salvador',
    'nicaragua',
    'panama',
    'panamá',
    'costa rica',
    'dominican',
    'república dominicana',
    'puerto rico',
    'uruguay',
    'montevi deo',
    'montevideo',
    'paraguay',
    'asuncion',
    'asunción',
    'cuba',
    'havana',
    'bolovia',
    'la paz',
    
    // Regional/cultural indicators
    'latino',
    'latinoamericano',
    'latin american',
    'hispanic',
    'hispano',
    'hispanohablante',
    'spanish-speaking',
    'spanish speaking',
    'south america',
    'south american',
    'central america',
    'latin america',
    'caribbean',
    
    // Work preference indicators
    'available for spanish projects',
    'spanish project experience',
    'hispanic community',
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
    let spanishCountryMatches = 0;
    
    for (const keyword of this.SPANISH_KEYWORDS) {
      if (profileText.includes(keyword)) {
        spanishMatches++;
        // Country keywords get weighted a bit less
        if (['españa', 'spain', 'mexico', 'méxico', 'argentina', 'colombia', 'chile', 'peru', 'perú'].includes(keyword)) {
          spanishCountryMatches++;
        }
      }
    }

    // If we found explicit Spanish language keywords (not just country), mark as Spanish speaker
    // Requires at least 1 match, but country alone can contribute
    if (spanishMatches >= 1) {
      return 'es';
    }

    // Also check if location appears to be Spanish-speaking
    const spanishCountries = [
      'spain', 'españa',
      'mexico', 'méxico',
      'argentina',
      'colombia',
      'chile',
      'peru', 'perú',
      'venezuela',
      'ecuador',
      'guatemala',
      'honduras',
      'el salvador',
      'nicaragua',
      'panama', 'panamá',
      'costa rica',
      'dominican', 'república dominicana',
      'puerto rico',
      'uruguay',
      'paraguay',
      'cuba',
      'bolivia', 'bolovia',
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

    if (requiredLanguage === 'es' || requiredLanguage === 'español') {
      const detected = this.detectLanguage(bio, title, country);
      return detected === 'es';
    }

    return true; // For other languages, accept all by default
  }
}
