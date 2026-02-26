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
  // Direct language claims
  'hispanohablante', 'spanish speaker', 'hablo español', 'fluent spanish',
  'español nativo', 'native spanish', 'español perfecto', 'perfect spanish',
  'habla español', 'castellano', 'spanish fluent', 'español fluido',
  // Origin/location phrases
  'developer from spain', 'developer from', 'de españa', 'from mexico',
  'from argentina', 'from colombia', 'from chile', 'from peru',
  'from ecuador', 'from venezuela', 'from uruguay', 'from bolivia',
  'from guatemala', 'from costa rica', 'from panama', 'from paraguay',
  'mexico-based', 'spain-based', 'colombia-based', 'argentina-based',
  'radicado en', 'basado en', 'viviendo en', 'ubicado en',
  // Identity
  'latinoamericano', 'latinoamericana', 'latino developer', 'latina developer',
  'latino', 'latina', 'latam', 'hispano', 'hispana', 'espanol', 'español', 'spanish',
  // Professional titles in Spanish
  'desarrollador', 'desarrolladora', 'ingeniero', 'ingeniera',
  'programador', 'programadora', 'arquitecto de software', 'analista',
  'ingeniero de software', 'ingeniera de software',
  'desarrollador web', 'desarrolladora web',
  'desarrollador móvil', 'desarrolladora móvil',
  'desarrollador fullstack', 'desarrollador backend', 'desarrollador frontend',
  // Common bio phrases in Spanish
  'apasionado por', 'apasionada por', 'amante de', 'entusiasta de',
  'me encanta', 'me gusta programar', 'estudiante de', 'graduado de',
  'egresado de', 'licenciado en', 'licenciada en', 'técnico en',
  'trabajando en', 'trabajando como', 'actualmente en',
  'creando soluciones', 'construyendo', 'aprendiendo'
];

// Extended Spanish vocabulary for bio/README text detection
const SPANISH_VOCABULARY = [
  // Common words in developer bios
  'hola', 'gracias', 'adios', 'adiós', 'amor', 'vida',
  'codigo', 'código', 'equipo', 'proyecto', 'trabajo',
  'mundo', 'tecnología', 'tecnologia', 'aplicación', 'aplicacion',
  'también', 'tambien', 'porque', 'desde', 'sobre', 'entre',
  // Technical terms used in Spanish
  'programación', 'programacion', 'desarrollo', 'herramienta',
  'servidor', 'cliente', 'datos', 'algoritmo', 'función', 'funcion',
  'librería', 'libreria', 'paquete', 'módulo', 'modulo',
  'pruebas', 'desplegado', 'despliegue', 'contribución', 'contribucion',
  'repositorio', 'documentación', 'documentacion',
  // Education/university terms
  'universidad', 'facultad', 'carrera', 'semestre', 'tesis',
  'licenciatura', 'maestría', 'maestria', 'doctorado',
  // Common verbs in READMEs
  'instalar', 'ejecutar', 'configurar', 'descargar', 'clonar',
  'compilar', 'construir', 'iniciar', 'crear', 'modificar',
  'utilizar', 'implementar', 'requisitos', 'dependencias',
  // GitHub README indicators
  'descripción', 'descripcion', 'características', 'caracteristicas',
  'instalación', 'instalacion', 'uso', 'ejemplo', 'ejemplos',
  'licencia', 'contribuir', 'contacto', 'autor', 'autores'
];

export interface SpanishLanguageAnalysis {
  isSpanishSpeaker: boolean;
  hasStrongSignal: boolean; // true if location, bio indicators, README, or repo descriptions match
  confidence: number; // 0-100
  reasons: string[];
  location: string | null;
  bioIndicators: string[];
}

/**
 * Analiza si un desarrollador de GitHub es hispanohablante
 * Ahora acepta señales adicionales: descripciones de repos y texto de README del perfil
 */
export function analyzeSpanishLanguageProficiency(
  bio: string | undefined,
  location: string | undefined,
  profile_name: string | undefined,
  company: string | undefined,
  repoDescriptions?: string[],
  profileReadmeText?: string
): SpanishLanguageAnalysis {
  const reasons: string[] = [];
  let totalScore = 0;
  const bioIndicators: string[] = [];
  let hasStrongSignal = false; // requires location, bio indicators, README, or repo descriptions

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
      hasStrongSignal = true; // Location is a STRONG signal
      reasons.push(`📍 Location "${location}" matches Spanish-speaking region`);
    }
  }

  // 2. Check bio for Spanish indicators (40 points max)
  if (bio) {
    const matchedIndicators = SPANISH_BIO_INDICATORS.filter(indicator =>
      bioLower.includes(normalizeText(indicator))
    );

    if (matchedIndicators.length > 0) {
      totalScore += Math.min(40, 12 * matchedIndicators.length);
      hasStrongSignal = true; // Explicit Spanish bio indicators are a STRONG signal
      bioIndicators.push(...matchedIndicators);
      reasons.push(`🗣️ Bio contains Spanish language indicators: ${matchedIndicators.join(', ')}`);
    }

    // Check for Spanish vocabulary in bio
    const foundSpanishWords = SPANISH_VOCABULARY.filter(word => bioLower.includes(normalizeText(word)));
    if (foundSpanishWords.length > 0) {
      totalScore += Math.min(25, 5 * foundSpanishWords.length);
      if (foundSpanishWords.length >= 3) hasStrongSignal = true; // 3+ Spanish vocab words = strong
      reasons.push(`📝 Bio contains Spanish words: ${foundSpanishWords.slice(0, 5).join(', ')}${foundSpanishWords.length > 5 ? '...' : ''}`);
    }
  }

  // 3. Check company/organization name
  if (company) {
    const spanishCompanyKeywords = ['latino', 'hispano', 'españa', 'mexico', 'argentina', 'colombia',
      'chile', 'peru', 'venezuela', 'ecuador', 'uruguay', 'bolivia', 'latam'];
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
      'garcia', 'martinez', 'rodriguez', 'lopez', 'sanchez', 'torres', 'rivera', 'gonzalez',
      'hernandez', 'ramirez', 'flores', 'morales', 'ortiz', 'gutierrez', 'reyes', 'cruz',
      'alvarez', 'mendoza', 'castillo', 'jimenez', 'ruiz', 'diaz', 'romero', 'herrera',
      'medina', 'aguilar', 'vargas', 'perez', 'santiago', 'alejandro', 'andres', 'pablo',
      'pedro', 'miguel', 'angel', 'manuel', 'javier', 'rafael', 'david', 'oscar',
      'sergio', 'ricardo', 'alfonso', 'eduardo', 'guillermo', 'adriana', 'lucia', 'carmen',
      'isabel', 'rosa', 'elena', 'gabriela', 'valentina', 'camila', 'mariana', 'sofia'];
    const nameWords = nameLower.split(/\s+/);
    const spanishNameMatches = nameWords.filter(word =>
      word.length >= 3 && spanishNameParts.some(part => normalizeText(part) === word)
    );

    if (spanishNameMatches.length > 0) {
      totalScore += Math.min(15, 8 * spanishNameMatches.length);
      reasons.push(`👤 Name pattern suggests Spanish heritage: ${spanishNameMatches.join(', ')}`);
    }
  }

  // 5. NEW: Check repo descriptions for Spanish language (20 points max)
  if (repoDescriptions && repoDescriptions.length > 0) {
    let spanishRepoCount = 0;
    for (const desc of repoDescriptions) {
      if (desc && detectSpanishInText(normalizeText(desc))) {
        spanishRepoCount++;
      }
    }
    if (spanishRepoCount > 0) {
      totalScore += Math.min(20, 8 * spanishRepoCount);
      if (spanishRepoCount >= 2) hasStrongSignal = true; // 2+ Spanish repo descriptions = strong
      reasons.push(`📦 ${spanishRepoCount} repo description(s) written in Spanish`);
    }
  }

  // 6. NEW: Check profile README for Spanish content (25 points max)
  if (profileReadmeText) {
    const readmeLower = normalizeText(profileReadmeText);
    const spanishWordsInReadme = SPANISH_VOCABULARY.filter(word => readmeLower.includes(normalizeText(word)));
    const spanishIndicatorsInReadme = SPANISH_BIO_INDICATORS.filter(ind => readmeLower.includes(normalizeText(ind)));

    if (spanishWordsInReadme.length >= 3 || spanishIndicatorsInReadme.length >= 1) {
      const readmeScore = Math.min(25, 4 * spanishWordsInReadme.length + 10 * spanishIndicatorsInReadme.length);
      totalScore += readmeScore;
      hasStrongSignal = true; // README in Spanish = strong signal
      reasons.push(`📄 Profile README contains Spanish content (${spanishWordsInReadme.length} words, ${spanishIndicatorsInReadme.length} indicators)`);
    }
  }

  // Ensure score doesn't exceed 100
  const confidence = Math.min(100, totalScore);

  // STRICT: Requires BOTH a strong signal AND confidence >= 40
  // Name-only matches (e.g. "David", "Daniel") are NOT strong signals
  const isSpanishSpeaker = hasStrongSignal && confidence >= 40;

  return {
    isSpanishSpeaker,
    hasStrongSignal,
    confidence,
    reasons,
    location: location || null,
    bioIndicators
  };
}

/**
 * Detecta si un texto contiene suficientes indicadores de español
 * Útil para analizar READMEs y descripciones de repos
 */
export function detectSpanishInText(text: string): boolean {
  if (!text || text.length < 10) return false;

  const normalizeText = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalized = normalizeText(text);

  // Check for Spanish characters patterns (ñ, ¿, ¡)
  if (/[ñ¿¡]/.test(text.toLowerCase())) return true;

  // Count Spanish vocabulary matches
  let matches = 0;
  for (const word of SPANISH_VOCABULARY) {
    if (normalized.includes(normalizeText(word))) {
      matches++;
      if (matches >= 2) return true; // 2+ Spanish words = likely Spanish
    }
  }

  // Check for Spanish bio indicators
  for (const indicator of SPANISH_BIO_INDICATORS) {
    if (normalized.includes(normalizeText(indicator))) {
      return true;
    }
  }

  return false;
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
