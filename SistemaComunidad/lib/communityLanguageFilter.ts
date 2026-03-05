/**
 * COMMUNITY LANGUAGE FILTER — Hispanic/Spanish Speaker Detection
 * 
 * Same approach as LinkedIn (proven working) and GitHub systems.
 * A candidate PASSES if AT LEAST ONE strong signal matches:
 *   1. Hispanic first/last name
 *   2. Spanish-speaking location
 *   3. Spanish text in bio/messages
 *   4. Language field indicating Spanish
 * 
 * FIX APPLIED: Handles null/undefined location gracefully
 * (lesson learned from LinkedIn system)
 */

// ─── Hispanic Names (~200) ───────────────────────────────────────────────────

const SPANISH_FIRST_NAMES = new Set([
    // Male
    'alejandro', 'alfonso', 'alfredo', 'alvaro', 'andres', 'angel',
    'antonio', 'arturo', 'bernardo', 'carlos', 'cesar', 'claudio', 'cristian', 'cristobal',
    'daniel', 'david', 'diego', 'eduardo', 'emilio', 'enrique', 'esteban', 'ezequiel',
    'fabian', 'felipe', 'fernando', 'francisco', 'gabriel', 'gerardo', 'gonzalo',
    'guillermo', 'gustavo', 'hector', 'hernan', 'hugo', 'ignacio', 'ivan', 'jaime',
    'javier', 'jesus', 'joaquin', 'jorge', 'jose', 'juan', 'julio', 'leonardo', 'lucas',
    'luis', 'manuel', 'marco', 'marcos', 'mario', 'martin', 'mateo', 'matias', 'mauricio',
    'miguel', 'nicolas', 'oscar', 'pablo', 'patricio', 'pedro', 'rafael', 'ramiro',
    'ramon', 'raul', 'ricardo', 'roberto', 'rodrigo', 'ruben', 'salvador', 'samuel',
    'santiago', 'sebastian', 'sergio', 'tomas', 'valentin', 'victor', 'xavier',
    // Female
    'adriana', 'alejandra', 'alicia', 'ana', 'andrea', 'angela', 'beatriz', 'camila',
    'carla', 'carmen', 'carolina', 'catalina', 'cecilia', 'claudia', 'cristina', 'daniela',
    'diana', 'elena', 'emilia', 'esperanza', 'esther', 'eva', 'fernanda', 'florencia',
    'gabriela', 'guadalupe', 'ines', 'irene', 'isabel', 'jimena', 'josefina', 'juana',
    'julia', 'laura', 'leonor', 'leticia', 'lorena', 'lucia', 'luisa', 'luz', 'magdalena',
    'marcela', 'margarita', 'maria', 'mariana', 'marta', 'mercedes', 'miriam', 'monica',
    'natalia', 'noemi', 'nuria', 'olga', 'paloma', 'patricia', 'paula', 'pilar', 'raquel',
    'rebeca', 'rocio', 'rosa', 'rosario', 'ruth', 'sandra', 'sara', 'silvia', 'sofia',
    'soledad', 'sonia', 'susana', 'teresa', 'valentina', 'valeria', 'vanessa', 'veronica',
    'virginia', 'ximena', 'yolanda'
]);

// ─── Hispanic Surnames ───────────────────────────────────────────────────────

const SPANISH_SURNAMES = new Set([
    'aguilar', 'alvarez', 'araya', 'arce', 'arias', 'barrera', 'blanco', 'bravo',
    'cabrera', 'calderon', 'campos', 'cardenas', 'carrasco', 'castillo',
    'castro', 'cervantes', 'chavez', 'contreras', 'cordoba', 'cortes',
    'cruz', 'de la cruz', 'de leon', 'delgado', 'diaz', 'dominguez', 'duran',
    'espinoza', 'estrada', 'fernandez', 'figueroa', 'flores', 'fuentes',
    'gallegos', 'garcia', 'garza', 'gomez', 'gonzalez', 'guerrero', 'gutierrez',
    'guzman', 'hernandez', 'herrera', 'ibarra', 'jimenez', 'juarez', 'lara',
    'leon', 'lopez', 'luna', 'martinez', 'medina', 'mejia', 'mendez', 'mendoza',
    'molina', 'morales', 'moreno', 'munoz', 'navarro', 'nieto', 'nunez',
    'ochoa', 'orozco', 'ortega', 'ortiz', 'pacheco', 'padilla', 'palacios',
    'paredes', 'pena', 'peralta', 'perez', 'pineda', 'quintero', 'ramirez',
    'ramos', 'reyes', 'rios', 'rivera', 'robles', 'rodriguez', 'rojas', 'romero',
    'rosales', 'ruiz', 'salazar', 'sanchez', 'sandoval', 'santiago', 'santos',
    'silva', 'solano', 'solis', 'soto', 'suarez', 'tapia', 'torres', 'trujillo',
    'valdes', 'valencia', 'valenzuela', 'vargas', 'vasquez', 'vega', 'velasco',
    'vera', 'vidal', 'villanueva', 'zamora', 'zapata', 'zuniga'
]);

// ─── Spanish-speaking locations ──────────────────────────────────────────────

const SPANISH_LOCATIONS = [
    // Countries
    'españa', 'spain', 'mexico', 'méxico', 'colombia', 'argentina', 'chile', 'peru', 'perú',
    'venezuela', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'costa rica', 'panama', 'panamá',
    'guatemala', 'honduras', 'el salvador', 'nicaragua', 'cuba', 'dominicana', 'puerto rico',
    // Major cities
    'madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'málaga', 'bilbao', 'zaragoza',
    'ciudad de mexico', 'guadalajara', 'monterrey', 'bogota', 'bogotá', 'medellin', 'medellín',
    'cali', 'barranquilla', 'buenos aires', 'cordoba', 'córdoba', 'rosario', 'mendoza',
    'santiago de chile', 'viña del mar', 'lima', 'arequipa', 'cusco', 'cuzco', 'trujillo',
    'quito', 'guayaquil', 'la paz', 'cochabamba', 'santa cruz', 'asuncion', 'asunción',
    'montevideo', 'san jose', 'san josé', 'caracas', 'maracaibo', 'puebla', 'tijuana',
    'cancun', 'cancún', 'merida', 'mérida', 'tucuman', 'tucumán',
    // Spanish regions
    'andalucia', 'andalucía', 'cataluña', 'catalonia', 'castilla', 'galicia',
    'pais vasco', 'país vasco', 'asturias', 'cantabria', 'aragon', 'aragón',
    'extremadura', 'navarra', 'la rioja', 'canarias', 'baleares',
    // Latin American regions
    'latam', 'latinoamerica', 'latinoamérica', 'sudamerica', 'sudamérica',
    'centroamerica', 'centroamérica', 'hispanoamerica', 'hispanoamérica',
];

// ─── Spanish text indicators ─────────────────────────────────────────────────

const SPANISH_TEXT_KEYWORDS = [
    // Job-related
    'desarrollador', 'desarrolladora', 'ingeniero', 'ingeniera', 'programador', 'programadora',
    'analista', 'consultor', 'consultora', 'director', 'directora', 'gerente', 'jefe', 'jefa',
    'diseñador', 'diseñadora', 'arquitecto de software',
    // Tech
    'desarrollo web', 'desarrollo movil', 'desarrollo móvil', 'inteligencia artificial',
    'aprendizaje automatico', 'aprendizaje automático', 'ciencia de datos',
    'base de datos', 'nube', 'devops', 'frontend', 'backend', 'full stack',
    // Bio phrases
    'apasionado por', 'me encanta', 'me gusta programar', 'estudiante de', 'graduado de',
    'egresado de', 'licenciado en', 'licenciada en', 'trabajando en', 'trabajando como',
    'creando soluciones', 'construyendo', 'aprendiendo',
    // Common Spanish words
    'hola', 'codigo', 'código', 'mundo', 'aplicacion', 'aplicación',
    'programacion', 'programación', 'herramienta', 'servidor', 'datos',
    'funcion', 'función', 'libreria', 'librería', 'modulo', 'módulo',
    // Community-specific
    'alguien sabe', 'necesito ayuda', 'buenas', 'buenas tardes', 'buenas noches',
    'saludos', 'gracias', 'muchas gracias', 'de nada', 'por favor',
    'compañeros', 'comunidad', 'proyecto personal', 'proyecto propio',
    // Identity
    'latinoamericano', 'latinoamericana', 'latino', 'latina', 'hispano', 'hispana',
    'español', 'espanol', 'spanish speaker', 'native spanish', 'fluent spanish',
    'años de experiencia', 'sobre mi', 'sobre mí', 'acerca de',
];

// ─── Normalization ───────────────────────────────────────────────────────────

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
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

    const parts = normalize(fullName).split(/\s+/).filter(Boolean);
    const matchedParts: string[] = [];

    for (const part of parts) {
        if (SPANISH_FIRST_NAMES.has(part) || SPANISH_SURNAMES.has(part)) {
            matchedParts.push(part);
        }
    }

    return { match: matchedParts.length > 0, matchedParts };
}

// ─── CORE: Check Spanish-speaking location ──────────────────────────────────

function hasSpanishLocation(location: string | undefined | null): { match: boolean; matchedLoc: string } {
    // FIX: Handle null/undefined gracefully (learned from LinkedIn system)
    if (!location || typeof location !== 'string') {
        return { match: false, matchedLoc: '' };
    }

    const normalizedLoc = normalize(location);

    for (const spanishLoc of SPANISH_LOCATIONS) {
        if (normalizedLoc.includes(normalize(spanishLoc))) {
            return { match: true, matchedLoc: spanishLoc };
        }
    }

    return { match: false, matchedLoc: '' };
}

// ─── CORE: Check Spanish text in content ────────────────────────────────────

function hasSpanishText(text: string | undefined | null): { match: boolean; matchedKeywords: string[] } {
    if (!text || typeof text !== 'string') {
        return { match: false, matchedKeywords: [] };
    }

    const normalizedText = normalize(text);
    const matchedKeywords: string[] = [];

    for (const keyword of SPANISH_TEXT_KEYWORDS) {
        if (normalizedText.includes(normalize(keyword))) {
            matchedKeywords.push(keyword);
        }
    }

    return { match: matchedKeywords.length > 0, matchedKeywords };
}

// ─── Main Analysis Function ─────────────────────────────────────────────────

export function analyzeSpanishSignals(candidate: {
    displayName?: string;
    username?: string;
    bio?: string;
    location?: string | null;
    detectedLanguage?: string;
    communityRoles?: string[];
}): SpanishLanguageAnalysis {
    const reasons: string[] = [];
    const bioIndicators: string[] = [];
    let confidence = 0;
    let hasStrongSignal = false;

    // 1. Check name
    const nameToCheck = candidate.displayName || candidate.username || '';
    const nameResult = hasHispanicName(nameToCheck);
    if (nameResult.match) {
        reasons.push(`Hispanic name: ${nameResult.matchedParts.join(', ')}`);
        confidence += 40;
        hasStrongSignal = true;
    }

    // 2. Check location (handles null gracefully)
    const locResult = hasSpanishLocation(candidate.location);
    if (locResult.match) {
        reasons.push(`Spanish-speaking location: ${locResult.matchedLoc}`);
        confidence += 35;
        hasStrongSignal = true;
    }

    // 3. Check bio/text content
    const bioResult = hasSpanishText(candidate.bio);
    if (bioResult.match) {
        reasons.push(`Spanish text detected in bio`);
        bioIndicators.push(...bioResult.matchedKeywords.slice(0, 5)); // Top 5
        confidence += 25;
        hasStrongSignal = true;
    }

    // 4. Check detected language field
    if (candidate.detectedLanguage === 'es') {
        reasons.push('Detected language: Spanish');
        confidence += 30;
        hasStrongSignal = true;
    }

    // Normalize confidence to 0-100
    confidence = Math.min(100, confidence);

    return {
        isSpanishSpeaker: hasStrongSignal,
        hasStrongSignal,
        hasSpanishText: bioResult.match,
        confidence,
        reasons,
        location: candidate.location || null,
        bioIndicators,
    };
}

/**
 * Quick filter: returns true if candidate is likely a Spanish speaker
 */
export function isLikelySpanishSpeaker(
    candidate: {
        displayName?: string;
        username?: string;
        bio?: string;
        location?: string | null;
        detectedLanguage?: string;
    },
    minConfidence: number = 25
): boolean {
    const analysis = analyzeSpanishSignals(candidate);
    return analysis.isSpanishSpeaker && analysis.confidence >= minConfidence;
}
