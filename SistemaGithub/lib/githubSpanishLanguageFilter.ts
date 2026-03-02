/**
 * FILTRO HISPANOHABLANTE – GitHub & Marketplace
 * 
 * Mismo enfoque que LinkedIn (que funciona correctamente):
 * Un candidato PASA si cumple AL MENOS UNA señal fuerte:
 *   1. Nombre o apellido hispano
 *   2. Ubicación en país/ciudad hispanohablante
 *   3. Texto en español en bio/descripción/README
 * 
 * CUALQUIER señal es suficiente. No se exige texto en español obligatorio.
 */

// ─── Nombres hispanos (~200) ─────────────────────────────────────────────────
const SPANISH_FIRST_NAMES = new Set([
  // Male
  'alejandro', 'alfonso', 'alfredo', 'alvaro', 'andres', 'angel',
  'antonio', 'arturo', 'bernardo', 'carlos', 'cesar', 'claudio', 'cristian', 'cristobal',
  'daniel', 'david', 'diego', 'eduardo', 'emilio', 'enrique', 'ernesto', 'esteban', 'fabian',
  'federico', 'felipe', 'fernando', 'francisco', 'gabriel', 'gerardo', 'gonzalo', 'guillermo',
  'gustavo', 'hector', 'hugo', 'ignacio', 'ivan', 'javier', 'jesus',
  'joaquin', 'jorge', 'jose', 'juan', 'julio', 'leonardo', 'lorenzo', 'lucas',
  'luis', 'manuel', 'marcos', 'mario', 'martin', 'mateo', 'matias', 'mauricio',
  'miguel', 'nicolas', 'oscar', 'pablo', 'patricio', 'pedro', 'rafael', 'ramiro',
  'ramon', 'raul', 'ricardo', 'roberto', 'rodrigo', 'ruben', 'salvador',
  'samuel', 'santiago', 'sebastian', 'sergio', 'tomas', 'valentin',
  'victor', 'xavier',
  // Female
  'adriana', 'alejandra', 'alicia', 'ana', 'andrea', 'angela', 'beatriz', 'camila',
  'carmen', 'carolina', 'catalina', 'claudia', 'constanza', 'cristina', 'daniela', 'diana',
  'elena', 'elisa', 'emilia', 'esperanza', 'estela', 'eugenia', 'eva', 'fernanda', 'florencia',
  'gabriela', 'gloria', 'graciela', 'guadalupe', 'ines', 'irene', 'isabel', 'javiera',
  'jimena', 'josefina', 'juana', 'julia', 'laura', 'leonor', 'leticia', 'lorena', 'lucia',
  'luisa', 'luz', 'magdalena', 'marcela', 'margarita', 'maria', 'mariana', 'marta',
  'mercedes', 'miriam', 'monica', 'natalia', 'noemi', 'nuria', 'olga', 'paloma',
  'patricia', 'paula', 'pilar', 'raquel', 'rebeca', 'rocio', 'rosa', 'rosario', 'ruth',
  'sandra', 'sara', 'silvia', 'sofia', 'soledad', 'sonia', 'susana', 'teresa', 'valentina',
  'valeria', 'vanessa', 'veronica', 'virginia', 'ximena', 'yolanda'
]);

// ─── Apellidos hispanos ──────────────────────────────────────────────────────
const SPANISH_SURNAMES = new Set([
  'aguilar', 'alvarez', 'araya', 'arce', 'arias', 'barrera', 'blanco', 'bravo',
  'cabrera', 'calderon', 'campos', 'cardenas', 'carrasco', 'castillo',
  'castro', 'cervantes', 'chavez', 'contreras', 'cordoba', 'cortes',
  'cruz', 'delgado', 'diaz', 'dominguez', 'duarte', 'espinosa', 'espinoza', 'estrada',
  'fernandez', 'figueroa', 'flores', 'fuentes', 'gallego', 'garcia', 'gomez', 'gonzalez',
  'guerrero', 'gutierrez', 'guzman', 'hernandez', 'herrera', 'ibanez', 'iglesias',
  'jimenez', 'lara', 'leon', 'lopez', 'luna', 'marin', 'marquez', 'martinez', 'medina',
  'mejia', 'mendez', 'mendoza', 'molina', 'montes', 'montoya', 'mora', 'morales',
  'moreno', 'munoz', 'navarro', 'nieto', 'nunez', 'ochoa', 'olivares', 'ortega',
  'ortiz', 'palacios', 'paredes', 'pascual', 'pena', 'peralta', 'perez', 'pineda',
  'prieto', 'quintero', 'ramirez', 'ramos', 'reyes', 'rios', 'rivera', 'robles',
  'rodriguez', 'rojas', 'romero', 'rosales', 'ruiz', 'saavedra', 'salazar', 'salinas',
  'sanchez', 'sandoval', 'santana', 'santos', 'serrano', 'silva', 'solis',
  'soto', 'suarez', 'tapia', 'torres', 'trujillo', 'valdes', 'valencia',
  'valenzuela', 'vargas', 'vasquez', 'vega', 'velasco', 'vera', 'vidal', 'villanueva',
  'zamora', 'zapata', 'zuniga'
]);

// ─── Ubicaciones hispanohablantes ────────────────────────────────────────────
const SPANISH_LOCATIONS = [
  // Countries
  'españa', 'spain', 'mexico', 'méxico', 'colombia', 'argentina', 'chile', 'peru', 'perú',
  'venezuela', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'costa rica', 'panama', 'panamá',
  'guatemala', 'honduras', 'el salvador', 'nicaragua', 'cuba', 'republica dominicana',
  'dominican republic', 'puerto rico',
  // Major cities Spain
  'madrid', 'barcelona', 'valencia', 'sevilla', 'seville', 'malaga', 'málaga', 'bilbao',
  'zaragoza', 'murcia', 'palma', 'las palmas', 'alicante', 'cordoba', 'córdoba', 'valladolid',
  'vigo', 'gijon', 'gijón', 'granada', 'coruña', 'a coruña', 'vitoria', 'santander', 'pamplona',
  'san sebastian', 'san sebastián', 'donostia', 'salamanca', 'burgos', 'cadiz', 'cádiz',
  'tarragona', 'girona', 'toledo', 'badajoz', 'leon', 'león', 'lleida', 'castellon', 'castellón',
  'almeria', 'almería', 'huelva', 'jaen', 'jaén', 'logroño', 'lugo', 'ourense', 'pontevedra',
  'segovia', 'soria', 'teruel', 'zamora', 'avila', 'ávila', 'cuenca', 'huesca', 'palencia',
  // Major cities LATAM
  'buenos aires', 'bogota', 'bogotá', 'lima', 'santiago', 'ciudad de mexico', 'cdmx',
  'guadalajara', 'monterrey', 'medellin', 'medellín', 'cali', 'barranquilla', 'cartagena',
  'quito', 'guayaquil', 'la paz', 'cochabamba', 'santa cruz', 'asuncion', 'asunción',
  'montevideo', 'san jose', 'san josé', 'caracas', 'maracaibo', 'puebla', 'tijuana',
  'cancun', 'cancún', 'merida', 'mérida', 'rosario', 'mendoza', 'tucuman', 'tucumán',
  'arequipa', 'cusco', 'cuzco', 'trujillo', 'valparaiso', 'valparaíso', 'concepcion', 'concepción',
  'temuco', 'antofagasta', 'santo domingo', 'san juan', 'la habana', 'havana',
  'tegucigalpa', 'san pedro sula', 'managua', 'san salvador', 'playa del carmen', 'punta cana',
  'punta del este',
  // Regions
  'latam', 'latinoamerica', 'latinoamérica', 'hispanoamerica', 'hispanoamérica',
  'iberoamerica', 'iberoamérica', 'cataluña', 'catalonia', 'andalucia', 'andalucía',
  'castilla', 'galicia', 'pais vasco', 'país vasco', 'euskadi', 'asturias', 'cantabria',
  'aragon', 'aragón', 'extremadura', 'navarra', 'la rioja', 'canarias', 'baleares',
];

// ─── Indicadores de texto en español ─────────────────────────────────────────
const SPANISH_TEXT_KEYWORDS = [
  // Job-related
  'desarrollador', 'desarrolladora', 'ingeniero', 'ingeniera', 'programador', 'programadora',
  'analista', 'consultor', 'consultora', 'director', 'directora', 'gerente', 'jefe', 'jefa',
  'lider', 'líder', 'coordinador', 'coordinadora', 'especialista', 'tecnico', 'técnico',
  'diseñador', 'diseñadora', 'arquitecto', 'arquitecta', 'investigador', 'investigadora',
  'responsable',
  // Common phrases in profiles
  'experiencia', 'empresa', 'trabajo', 'proyecto', 'proyectos', 'equipo', 'gestion', 'gestión',
  'implementacion', 'implementación', 'desarrollo', 'tecnologia', 'tecnología', 'soluciones',
  'actualmente', 'anteriormente', 'encargado', 'autonomo', 'autónomo',
  'disponible', 'remoto', 'presencial', 'hibrido', 'híbrido', 'emprendedor', 'emprendedora',
  'cofundador', 'cofundadora', 'fundador', 'fundadora',
  // Education
  'universidad', 'licenciatura', 'master', 'máster', 'grado', 'ingenieria', 'ingeniería',
  'informatica', 'informática', 'telecomunicaciones', 'computacion', 'computación',
  // Bio indicators
  'hispanohablante', 'hablo español', 'español nativo', 'castellano', 'español fluido',
  'apasionado por', 'apasionada por', 'amante de', 'entusiasta de',
  'me encanta', 'me gusta programar', 'estudiante de', 'graduado de',
  'egresado de', 'licenciado en', 'licenciada en', 'trabajando en', 'trabajando como',
  'creando soluciones', 'construyendo', 'aprendiendo',
  // Common Spanish words
  'hola', 'codigo', 'código', 'mundo', 'aplicacion', 'aplicación',
  'programacion', 'programación', 'herramienta', 'servidor', 'datos',
  'funcion', 'función', 'libreria', 'librería', 'modulo', 'módulo',
  'pruebas', 'despliegue', 'contribucion', 'contribución', 'repositorio',
  'documentacion', 'documentación', 'facultad', 'carrera', 'tesis',
  'maestria', 'maestría', 'doctorado',
  'instalar', 'ejecutar', 'configurar', 'descargar', 'compilar',
  'descripcion', 'descripción', 'caracteristicas', 'características',
  'instalacion', 'instalación', 'ejemplo', 'ejemplos', 'licencia', 'contribuir', 'autor',
  // Connector words
  'años de experiencia', 'sobre mi', 'sobre mí', 'acerca de',
  // Identity
  'latinoamericano', 'latinoamericana', 'latino', 'latina', 'hispano', 'hispana',
  'español', 'espanol', 'spanish speaker', 'native spanish', 'fluent spanish',
];

// ─── Normalization ───────────────────────────────────────────────────────────
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents for matching
    .trim();
}

// ─── Public Types ────────────────────────────────────────────────────────────

export interface SpanishLanguageAnalysis {
  isSpanishSpeaker: boolean;
  hasStrongSignal: boolean;
  hasSpanishText: boolean;
  confidence: number; // 0-100
  reasons: string[];
  location: string | null;
  bioIndicators: string[];
}

// ─── CORE: Check Hispanic name ──────────────────────────────────────────────

function hasHispanicName(fullName: string): { match: boolean; matchedParts: string[] } {
  if (!fullName) return { match: false, matchedParts: [] };
  const parts = normalize(fullName).split(/\s+/).filter(p => p.length > 1);
  const matched: string[] = [];
  for (const part of parts) {
    if (SPANISH_FIRST_NAMES.has(part) || SPANISH_SURNAMES.has(part)) {
      matched.push(part);
    }
  }
  return { match: matched.length > 0, matchedParts: matched };
}

// ─── CORE: Check Spanish-speaking location ──────────────────────────────────

function hasSpanishLocation(location: string | undefined | null): { match: boolean; matchedLoc: string } {
  if (!location) return { match: false, matchedLoc: '' };
  const normLoc = normalize(location);
  for (const loc of SPANISH_LOCATIONS) {
    if (normLoc.includes(normalize(loc))) {
      return { match: true, matchedLoc: loc };
    }
  }
  return { match: false, matchedLoc: '' };
}

// ─── CORE: Check Spanish text in content ────────────────────────────────────

function hasSpanishTextContent(texts: (string | undefined | null)[]): { match: boolean; keywordCount: number } {
  const combined = normalize(texts.filter(Boolean).join(' '));
  if (combined.length < 5) return { match: false, keywordCount: 0 };

  // Check for Spanish-unique characters (ñ, ¿, ¡) — instant pass
  const raw = texts.filter(Boolean).join(' ');
  if (/[ñ¿¡]/.test(raw)) return { match: true, keywordCount: 99 };

  let count = 0;
  for (const keyword of SPANISH_TEXT_KEYWORDS) {
    if (combined.includes(normalize(keyword))) {
      count++;
      if (count >= 2) return { match: true, keywordCount: count };
    }
  }
  return { match: false, keywordCount: count };
}

// ─── MAIN FUNCTION ──────────────────────────────────────────────────────────

/**
 * Analiza si un candidato es hispanohablante.
 * 
 * REGLA: Pasa si cumple AL MENOS UNA señal:
 *   1. Nombre o apellido hispano
 *   2. Ubicación en país/ciudad hispanohablante
 *   3. Texto en español en bio/descripción/README (2+ keywords o caracteres ñ¿¡)
 * 
 * Esto replica el enfoque de LinkedIn que funciona correctamente.
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
  let confidence = 0;
  const bioIndicators: string[] = [];
  let hasStrongSignal = false;
  let hasSpanishText = false;

  // ═══════════════════════════════════════════════════════════════
  // SIGNAL 1: Hispanic name (first name or surname)
  // ═══════════════════════════════════════════════════════════════
  const nameCheck = hasHispanicName(profile_name || '');
  if (nameCheck.match) {
    confidence += 50;
    hasStrongSignal = true;
    reasons.push(`👤 Nombre hispano: ${nameCheck.matchedParts.join(', ')}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SIGNAL 2: Spanish-speaking location
  // ═══════════════════════════════════════════════════════════════
  const locCheck = hasSpanishLocation(location);
  if (locCheck.match) {
    confidence += 40;
    hasStrongSignal = true;
    reasons.push(`📍 Ubicación hispanohablante: "${locCheck.matchedLoc}"`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SIGNAL 3: Spanish text in bio / title / descriptions / README
  // ═══════════════════════════════════════════════════════════════
  const textsToCheck: (string | undefined | null)[] = [bio];
  if (repoDescriptions) textsToCheck.push(...repoDescriptions);
  if (profileReadmeText) textsToCheck.push(profileReadmeText);

  const textCheck = hasSpanishTextContent(textsToCheck);
  if (textCheck.match) {
    confidence += 30;
    hasStrongSignal = true;
    hasSpanishText = true;
    reasons.push(`📝 Texto en español detectado (${textCheck.keywordCount} indicadores)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // BONUS: Company hints (doesn't pass alone, just boosts)
  // ═══════════════════════════════════════════════════════════════
  if (company) {
    const companyNorm = normalize(company);
    const spanishCompanyKeywords = ['latino', 'hispano', 'españa', 'mexico', 'argentina', 'colombia',
      'chile', 'peru', 'venezuela', 'ecuador', 'uruguay', 'bolivia', 'latam'];
    if (spanishCompanyKeywords.some(kw => companyNorm.includes(normalize(kw)))) {
      confidence += 10;
      reasons.push(`🏢 Empresa sugiere contexto hispano`);
    }
  }

  confidence = Math.min(100, confidence);

  // ═══════════════════════════════════════════════════════════════
  // VEREDICTO FINAL: Cualquier señal fuerte → PASA
  // Nombre hispano → PASA
  // Ubicación hispanohablante → PASA
  // Texto en español → PASA
  // ═══════════════════════════════════════════════════════════════
  const isSpanishSpeaker = hasStrongSignal;

  return {
    isSpanishSpeaker,
    hasStrongSignal,
    hasSpanishText,
    confidence,
    reasons,
    location: location || null,
    bioIndicators
  };
}

/**
 * Detecta si un texto contiene suficientes indicadores de español
 */
export function detectSpanishInText(text: string): boolean {
  if (!text || text.length < 10) return false;
  const result = hasSpanishTextContent([text]);
  return result.match;
}

/**
 * Quick check: is this person likely a Spanish speaker?
 * Works with any combination of data available.
 * Returns true if ANY signal detected (name, location, or text).
 */
export function isLikelyHispanohablante(
  name: string | undefined | null,
  location: string | undefined | null,
  bio: string | undefined | null,
  title: string | undefined | null,
  country: string | undefined | null,
): boolean {
  // Signal 1: Hispanic name
  if (name && hasHispanicName(name).match) return true;

  // Signal 2: Spanish-speaking location (check both location and country fields)
  if (hasSpanishLocation(location).match) return true;
  if (country && hasSpanishLocation(country).match) return true;

  // Signal 3: Spanish text in bio/title
  const textCheck = hasSpanishTextContent([bio, title]);
  if (textCheck.match) return true;

  return false;
}

/**
 * Get a default Spanish-focused search filter
 */
export function getSpanishFocusedFilter() {
  return {
    spanishLanguageRequired: true,
    minSpanishLanguageConfidence: 30,
    prioritizeSpanishLocations: true,
    accept_all_spanish_regions: true
  };
}

/**
 * Filter candidates by Spanish language requirement.
 * Uses the multi-signal approach: name OR location OR text.
 */
export function filterBySpanishLanguage(
  candidates: any[],
  requireSpanish: boolean = true,
  _minConfidence: number = 30
): any[] {
  if (!requireSpanish) {
    return candidates;
  }

  return candidates.filter(candidate => {
    const analysis = analyzeSpanishLanguageProficiency(
      candidate.bio,
      candidate.location,
      candidate.name || candidate.full_name || candidate.github_username,
      candidate.company
    );
    // Use isSpanishSpeaker (any signal) instead of confidence threshold
    return analysis.isSpanishSpeaker;
  });
}

/**
 * Sort candidates by Spanish language confidence (highest first)
 */
export function sortBySpanishLanguageConfidence(candidates: any[]): any[] {
  return [...candidates].sort((a, b) => {
    const analysisA = analyzeSpanishLanguageProficiency(
      a.bio, a.location, a.name || a.full_name, a.company
    );
    const analysisB = analyzeSpanishLanguageProficiency(
      b.bio, b.location, b.name || b.full_name, b.company
    );
    return analysisB.confidence - analysisA.confidence;
  });
}
