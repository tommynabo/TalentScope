/**
 * GitHub Spanish Language Filter
 * Detecta desarrolladores hispanohablantes de España, Latinoamérica
 * Utiliza ubicación, bio, y patrones de actividad para identificar talento hispanohablante
 */

// Spanish-speaking regions and countries
const SPANISH_LOCATIONS = [
  // Spain
  'spain', 'españa', 'madrid', 'barcelona', 'valencia', 'bilbao', 'sevilla',
  'malaga', 'seville', 'bilbao', 'zaragoza', 'alicante', 'palma', 'murcia',
  
  // Mexico
  'mexico', 'méxico', 'cdmx', 'mexico city', 'monterrey', 'guadalajara',
  'cancun', 'playa del carmen', 'los cabos', 'puerto vallarta',
  
  // Argentina
  'argentina', 'buenos aires', 'cordoba', 'mendoza', 'rosario', 'la plata',
  
  // Colombia
  'colombia', 'bogota', 'bogotá', 'medellin', 'medellín', 'cali', 'cartagena',
  
  // Chile
  'chile', 'santiago', 'valparaiso', 'valparaíso', 'concepcion',
  
  // Peru
  'peru', 'perú', 'lima', 'cusco', 'cuzco', 'arequipa',
  
  // Venezueala
  'venezuela', 'caracas', 'maracaibo', 'valencia venezuela',
  
  // Ecuador
  'ecuador', 'quito', 'guayaquil', 'cuenca',
  
  // Bolivia
  'bolivia', 'la paz', 'cochabamba', 'santa cruz',
  
  // Paraguay
  'paraguay', 'asuncion', 'asunción',
  
  // Uruguay
  'uruguay', 'montevideo', 'punta del este',
  
  // Guatemala
  'guatemala', 'guatemala city', 'antigua',
  
  // Costa Rica
  'costa rica', 'san jose', 'san josé',
  
  // Panama
  'panama', 'panamá', 'panama city',
  
  // Dominican Republic
  'dominican republic', 'republica dominicana', 'santo domingo', 'punta cana',
  
  // Puerto Rico
  'puerto rico', 'san juan puerto rico',
  
  // Honduras
  'honduras', 'tegucigalpa', 'san pedro sula',
  
  // Nicaragua
  'nicaragua', 'managua', 'leon',
  
  // El Salvador
  'el salvador', 'san salvador',
  
  // Cuba
  'cuba', 'havana', 'la habana',
  
  // Belize
  'belize', 'belmopan'
];

// Spanish language indicators in bio/description
const SPANISH_BIO_INDICATORS = [
  'hispanohablante', 'spanish speaker', 'hablo español', 'fluent spanish',
  'español nativo', 'native spanish', 'español perfecto', 'perfect spanish',
  'developer from spain', 'developer from', 'de españa', 'from mexico',
  'from argentina', 'from colombia', 'mexico-based', 'spain-based',
  'latinoamericano', 'latino developer', 'habla español', 'castellano',
  'latino', 'latam', 'hispano', 'espanol', 'spanish'
];

// GitHub bio keywords that indicate Spanish-speaking developers
const SPANISH_DEVELOPER_INDICATORS = [
  'desarrollador', 'desarrolladora', 'programmer', 'engineer',
  'web developer', 'fullstack', 'backend', 'frontend', 'mobile developer',
  'code', 'coding', 'software'
];

export interface SpanishLanguageAnalysis {
  isSpanishSpeaker: boolean;
  confidence: number; // 0-100
  reasons: string[];
  location: string | null;
  bioIndicators: string[];
}

/**
 * Analiza si un desarrollador de GitHub es hispanohablante
 */
export function analyzeSpanishLanguageProficiency(
  bio: string | undefined,
  location: string | undefined,
  profile_name: string | undefined,
  company: string | undefined
): SpanishLanguageAnalysis {
  const reasons: string[] = [];
  let totalScore = 0;
  const bioIndicators: string[] = [];

  // Prepare text for analysis (lowercase, remove diacritics)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove accents for better matching
  };

  const bioLower = normalizeText(bio || '');
  const locationLower = normalizeText(location || '');
  const nameLower = normalizeText(profile_name || '');
  const companyLower = normalizeText(company || '');

  // 1. Check location (strongest signal - 50 points max)
  if (location) {
    const matchedLocation = SPANISH_LOCATIONS.find(loc =>
      locationLower.includes(normalizeText(loc))
    );

    if (matchedLocation) {
      totalScore += 50;
      reasons.push(`📍 Location "${location}" matches Spanish-speaking region`);
    }
  }

  // 2. Check bio for Spanish indicators (40 points max)
  if (bio) {
    const matchedIndicators = SPANISH_BIO_INDICATORS.filter(indicator =>
      bioLower.includes(normalizeText(indicator))
    );

    if (matchedIndicators.length > 0) {
      totalScore += Math.min(40, 15 * matchedIndicators.length);
      bioIndicators.push(...matchedIndicators);
      reasons.push(`🗣️ Bio contains Spanish language indicators: ${matchedIndicators.join(', ')}`);
    }

    // Check for Spanish words in bio
    const spanishWords = ['hola', 'gracias', 'adios', 'adiós', 'amor', 'vida', 'codigo', 'código', 'equipo', 'proyecto', 'trabajo'];
    const foundSpanishWords = spanishWords.filter(word => bioLower.includes(word));
    if (foundSpanishWords.length > 0) {
      totalScore += Math.min(20, 5 * foundSpanishWords.length);
      reasons.push(`📝 Bio contains Spanish words: ${foundSpanishWords.join(', ')}`);
    }
  }

  // 3. Check company/organization name
  if (company) {
    const spanishCompanyKeywords = ['latino', 'hispano', 'españa', 'mexico', 'argentina', 'colombia'];
    const hasSpanishCompany = spanishCompanyKeywords.some(kw =>
      companyLower.includes(normalizeText(kw))
    );

    if (hasSpanishCompany) {
      totalScore += 15;
      reasons.push(`🏢 Company name suggests Spanish-speaking organization`);
    }
  }

  // 4. Bonus: Spanish name patterns (gentle, contextual)
  if (profile_name) {
    const spanishNameParts = ['jose', 'juan', 'carlos', 'luis', 'ana', 'maria', 'diego', 'fernando',
      'garcia', 'martinez', 'rodriguez', 'lopez', 'sanchez', 'torres', 'rivera', 'gonzalez'];
    const nameWords = nameLower.split(/\s+/);
    const spanishNameMatches = nameWords.filter(word =>
      spanishNameParts.some(part => normalizeText(part).includes(word) || word.includes(normalizeText(part)))
    );

    if (spanishNameMatches.length > 0) {
      totalScore += 10;
      reasons.push(`👤 Name pattern suggests Spanish heritage`);
    }
  }

  // Ensure score doesn't exceed 100
  const confidence = Math.min(100, totalScore);

  // Threshold: 30+ points = considered Spanish speaker
  // 60+ points = high confidence
  const isSpanishSpeaker = confidence >= 30;

  return {
    isSpanishSpeaker,
    confidence,
    reasons,
    location: location || null,
    bioIndicators
  };
}

/**
 * Get a default Spanish-focused search filter
 */
export function getSpanishFocusedFilter() {
  return {
    spanishLanguageRequired: true,
    minSpanishLanguageConfidence: 60, // Prefer high confidence matches
    prioritizeSpanishLocations: true,
    accept_all_spanish_regions: true // Accept any Spanish-speaking country
  };
}

/**
 * Filter candidates by Spanish language requirement
 */
export function filterBySpanishLanguage(
  candidates: any[],
  requireSpanish: boolean = true,
  minConfidence: number = 30
): any[] {
  if (!requireSpanish) {
    return candidates;
  }

  return candidates.filter(candidate => {
    const analysis = analyzeSpanishLanguageProficiency(
      candidate.bio,
      candidate.location,
      candidate.name,
      candidate.company
    );

    return analysis.confidence >= minConfidence;
  });
}

/**
 * Sort candidates by Spanish language confidence (highest first)
 */
export function sortBySpanishLanguageConfidence(candidates: any[]): any[] {
  return [...candidates].sort((a, b) => {
    const analysisA = analyzeSpanishLanguageProficiency(
      a.bio,
      a.location,
      a.name,
      a.company
    );

    const analysisB = analyzeSpanishLanguageProficiency(
      b.bio,
      b.location,
      b.name,
      b.company
    );

    return analysisB.confidence - analysisA.confidence;
  });
}
