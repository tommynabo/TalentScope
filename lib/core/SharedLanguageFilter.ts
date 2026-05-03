/**
 * SharedLanguageFilter
 *
 * SINGLE canonical implementation of Hispanic/Spanish-speaker detection
 * for ALL TalentScope modules (LinkedIn, GitHub, Marketplace, Community).
 *
 * Previous state: 3 near-identical copies existed across modules.
 * This file is the merged, de-duplicated version — prefer the LinkedIn
 * variant (most complete) and adds the remaining entries from GitHub/Community.
 *
 * Algorithm: a candidate PASSES with AT LEAST ONE of the following signals:
 *   1. Hispanic first name or surname in full name
 *   2. Location in a Spanish-speaking country/city
 *   3. 2+ Spanish text keywords in title/bio/description
 *   The confidence score is cumulative; threshold is ≥ 20.
 */

// ─── Hispanic first names (~250) ─────────────────────────────────────────────
const SPANISH_FIRST_NAMES = new Set([
    // Male
    'alejandro', 'alfonso', 'alfredo', 'álvaro', 'alvaro', 'andrés', 'andres', 'angel', 'ángel',
    'antonio', 'arturo', 'bernardo', 'carlos', 'césar', 'cesar', 'claudio', 'cristian', 'cristóbal',
    'daniel', 'david', 'diego', 'eduardo', 'emilio', 'enrique', 'ernesto', 'esteban', 'ezequiel',
    'fabián', 'fabian', 'federico', 'felipe', 'fernando', 'francisco', 'gabriel', 'gerardo',
    'gonzalo', 'guillermo', 'gustavo', 'héctor', 'hector', 'hernán', 'hernan', 'hugo',
    'ignacio', 'iván', 'ivan', 'jaime', 'javier', 'jesús', 'jesus', 'joaquín', 'joaquin',
    'jorge', 'josé', 'jose', 'juan', 'julio', 'leonardo', 'lorenzo', 'lucas',
    'luis', 'manuel', 'marco', 'marcos', 'mario', 'martín', 'martin', 'mateo', 'matías', 'matias',
    'mauricio', 'miguel', 'nicolás', 'nicolas', 'óscar', 'oscar', 'pablo', 'patricio', 'pedro',
    'rafael', 'ramiro', 'ramón', 'ramon', 'raúl', 'raul', 'ricardo', 'roberto', 'rodrigo',
    'rubén', 'ruben', 'salvador', 'samuel', 'santiago', 'sebastián', 'sebastian', 'sergio',
    'tomás', 'tomas', 'valentín', 'valentin', 'víctor', 'victor', 'xavier',
    // Basque / Catalan
    'iñaki', 'inaki', 'asier', 'koldo', 'unai', 'gorka', 'aitor', 'iker', 'pol', 'arnau',
    'albert', 'oriol', 'pere', 'jordi', 'adrián', 'adrian',
    // Extra (known false negatives)
    'armando', 'agustín', 'agustin', 'benjamín', 'benjamin', 'edgar', 'emerson', 'erik',
    'israel', 'alonso', 'kike', 'pelayo', 'nazar',
    // Biblical / evangelical names widely used in LATAM
    'levi', 'leví', 'josue', 'josué', 'isaias', 'isaías', 'efrain', 'efraín',
    'abner', 'absalon', 'adan', 'adán', 'caleb', 'elias', 'elías', 'eliezer',
    'ezequiel', 'gedeon', 'gedeón', 'gideon', 'habacuc', 'jeremias', 'jeremías',
    'moises', 'moisés', 'nehemias', 'nehemías', 'noé', 'noe', 'samuel', 'salomon',
    'salomón', 'tobias', 'tobías', 'zadquiel',
    // Colloquial/diminutive forms common in Spain & LATAM
    'paco', 'pepe', 'nacho', 'chema', 'txema', 'dani', 'fran', 'alex', 'yago',
    'blas', 'sixto', 'chelo', 'tito', 'chino', 'nano', 'nene', 'pipe', 'pipe',
    // Variants missed in normalization
    'german', 'germán', 'ruben', 'rubén', 'cesar', 'césar', 'victor', 'víctor',
    'hector', 'héctor', 'nestor', 'néstor', 'oscar', 'óscar', 'ulises', 'lazaro',
    'lázaro', 'augusto', 'aurelio', 'braulio', 'cirilo', 'cornelio', 'crispin',
    'crispín', 'dacil', 'dácil', 'desiderio', 'dimas', 'donato', 'eladio', 'eloy',
    'fulgencio', 'galo', 'genaro', 'germinal', 'hilario', 'honorio', 'jacinto',
    'leandro', 'leovigildo', 'macedonio', 'maximo', 'máximo', 'melchor', 'metodio',
    'modesto', 'nazario', 'onesimo', 'onésimo', 'panfilo', 'panfilo', 'porfirio',
    'primitivo', 'quirino', 'régulo', 'regulo', 'restituto', 'saturnino', 'telesforo',
    'torcuato', 'tranquilino', 'urbano', 'wenceslao', 'zenon', 'zenón', 'zotero',
    // Additional female names
    'itzel', 'ximena', 'yareli', 'yatziri', 'zulem', 'zulema', 'dulce', 'yaritza',
    'wendy', 'yessenia', 'yeraldin', 'yeraldinne', 'dayana', 'dayanna', 'yolanda',
    'yareli', 'yazmin', 'yazmin', 'yessenia', 'yulieth', 'yurany', 'magaly', 'xiomara',
    'jocelyn', 'marleny', 'mireya', 'nallely', 'yanira', 'sayda', 'sulma', 'yadira',
    'yamileth', 'yaneth', 'yarely', 'yarlin', 'yeimi', 'yenny', 'yolanda', 'yurani',
    // Female
    'adriana', 'alejandra', 'alicia', 'ana', 'andrea', 'ángela', 'angela', 'beatriz', 'camila',
    'carla', 'carmen', 'carolina', 'catalina', 'cecilia', 'claudia', 'constanza', 'cristina',
    'daniela', 'diana', 'elena', 'elisa', 'emilia', 'esperanza', 'esther', 'estela', 'eugenia',
    'eva', 'fernanda', 'florencia', 'gabriela', 'gloria', 'graciela', 'guadalupe', 'inés', 'ines',
    'irene', 'isabel', 'javiera', 'jimena', 'josefina', 'juana', 'julia', 'laura', 'leonor',
    'leticia', 'lorena', 'lucía', 'lucia', 'luisa', 'luz', 'magdalena', 'marcela', 'margarita',
    'maría', 'maria', 'mariana', 'marta', 'mercedes', 'miriam', 'mónica', 'monica', 'natalia',
    'noemí', 'noemi', 'nuria', 'olga', 'paloma', 'patricia', 'paula', 'pilar', 'raquel', 'rebeca',
    'rocío', 'rocio', 'rosa', 'rosario', 'ruth', 'sandra', 'sara', 'silvia', 'sofía', 'sofia',
    'soledad', 'sonia', 'susana', 'teresa', 'valentina', 'valeria', 'vanessa', 'verónica',
    'veronica', 'virginia', 'ximena', 'yolanda', 'agustina',
    // Basque / Catalan female
    'ainara', 'nerea', 'leire', 'ainhoa', 'alba', 'laia', 'berta', 'clara', 'montserrat',
    'concha', 'amparo', 'inmaculada', 'dolores', 'lourdes', 'milagros', 'remedios',
    'macarena', 'rochi',
]);

// ─── Hispanic surnames (comprehensive merge of all 3 modules) ─────────────────
const SPANISH_SURNAMES = new Set([
    'aguilar', 'álvarez', 'alvarez', 'araya', 'arce', 'arias', 'barrera', 'blanco', 'bravo',
    'cabrera', 'calderón', 'calderon', 'campos', 'cárdenas', 'cardenas', 'carrasco', 'castillo',
    'castro', 'cervantes', 'chávez', 'chavez', 'contreras', 'córdoba', 'cordoba', 'cortés', 'cortes',
    'cruz', 'de la cruz', 'de la fuente', 'de león', 'del río', 'delgado', 'díaz', 'diaz',
    'domínguez', 'dominguez', 'duarte', 'espinosa', 'espinoza', 'estrada', 'fernández', 'fernandez',
    'figueroa', 'flores', 'fuentes', 'gallego', 'gallegos', 'garcía', 'garcia', 'garza', 'gómez',
    'gomez', 'gonzález', 'gonzalez', 'guerrero', 'gutiérrez', 'gutierrez', 'guzmán', 'guzman',
    'hernández', 'hernandez', 'herrera', 'ibáñez', 'ibañez', 'ibarra', 'iglesias', 'jiménez',
    'jimenez', 'juarez', 'lara', 'león', 'leon', 'lópez', 'lopez', 'luna', 'marín', 'marin',
    'márquez', 'marquez', 'martínez', 'martinez', 'medina', 'mejía', 'mejia', 'méndez', 'mendez',
    'mendoza', 'molina', 'montes', 'montoya', 'mora', 'morales', 'moreno', 'muñoz', 'munoz',
    'navarro', 'nieto', 'núñez', 'nunez', 'ochoa', 'olivares', 'orozco', 'ortega', 'ortiz',
    'pacheco', 'padilla', 'palacios', 'paredes', 'pascual', 'peña', 'pena', 'peralta', 'pérez',
    'perez', 'pineda', 'prieto', 'quintero', 'ramírez', 'ramirez', 'ramos', 'reyes', 'ríos',
    'rios', 'rivera', 'robles', 'rodríguez', 'rodriguez', 'rojas', 'romero', 'rosales', 'ruiz',
    'saavedra', 'salazar', 'salinas', 'sánchez', 'sanchez', 'sandoval', 'santana', 'santos',
    'serrano', 'silva', 'solano', 'solís', 'solis', 'soto', 'suárez', 'suarez', 'tapia', 'torres',
    'trujillo', 'valdés', 'valdes', 'valencia', 'valenzuela', 'vargas', 'vásquez', 'vasquez',
    'vega', 'velasco', 'vera', 'vidal', 'villanueva', 'zamora', 'zapata', 'zúñiga', 'zuniga',
    // Extended (known false negatives from all 3 modules)
    'diez', 'picón', 'picon', 'morgade', 'asensio', 'caballer', 'alonso', 'bruned', 'ottobre',
    'abad', 'leal', 'areán', 'arean', 'barrio', 'prados', 'cornejo', 'carreño', 'carreno',
    'torrijos', 'sagredo', 'pareja', 'urtecho', 'cuello', 'elgueta', 'campo', 'monsalve',
    'sorribes', 'ortuño', 'ortuno', 'salmerón', 'salmeron', 'pla', 'scasserra', 'giudice',
    'caballero', 'cebrian', 'cebrián', 'bermejo', 'bernabé', 'bernabe', 'bueno', 'calvo',
    'cano', 'castaño', 'castano', 'cuesta', 'dueñas', 'duenas', 'echeverría', 'echeverria',
    'fabre', 'ferrer', 'galan', 'galán', 'garrido', 'gil', 'gimeno', 'hidalgo', 'huertas',
    'izquierdo', 'jurado', 'lamas', 'largo', 'llopis', 'manzano', 'maqueda', 'mateo',
    'moya', 'naranjo', 'narváez', 'narvaez', 'oliva', 'orozco', 'pardo', 'pastor', 'pedraza',
    'plaza', 'portillo', 'pozo', 'prada', 'quesada', 'roca', 'rubio', 'saenz', 'sainz',
    'segura', 'sevilla', 'soler', 'tejada', 'toro', 'val', 'villar', 'vizoso', 'yáñez', 'yanez',
    // Cono Sur & Centroamérica (subrepresentados en versión anterior)
    'corbacho', 'lacuesta', 'uzcategui', 'uzcátegui', 'elosua', 'elosúa', 'trives',
    'piñon', 'sacasa', 'lacunza', 'lazcano', 'belaunde', 'benavides', 'covarrubias',
    'ibacache', 'jaramillo', 'landaeta', 'mancilla', 'maturana', 'quezada', 'retamal',
    'riveros', 'ugarte', 'vilches', 'zárate', 'zarate', 'zeballos', 'amarilla',
    'benitez', 'benítez', 'cantero', 'colman', 'colmán', 'enciso', 'fretes', 'gamarra',
    'maciel', 'olmedo', 'rolón', 'rolon', 'samaniego',
    // Additional Spain (Valencia, Cataluña, Aragón)
    'correa', 'coronel', 'domene', 'escudero', 'esteve', 'fajardo', 'feliu', 'figueras',
    'guardiola', 'guillen', 'guillén', 'iborra', 'iranzo', 'jorda', 'jordá',
    'labrador', 'lafuente', 'lahoz', 'latorre', 'llorca', 'llorente', 'lluch',
    'maestre', 'marco', 'marti', 'martí', 'mas', 'masip', 'millan', 'millán',
    'miralles', 'miro', 'miró', 'moliner', 'monfort', 'montiel', 'morant',
    'mulet', 'noguera', 'novella', 'oller', 'orellana', 'palau', 'peral', 'perea',
    'pons', 'pont', 'porcar', 'prats', 'puchol', 'puertas', 'roig', 'roman', 'ros',
    'rosello', 'roselló', 'sabater', 'selles', 'sellés', 'sempere', 'sendra',
    'sepulveda', 'sepúlveda', 'soldevila', 'soriano', 'sospedra', 'tarazona',
    'tormo', 'tortosa', 'ubeda', 'úbeda', 'vallés', 'valles', 'valls', 'verdejo',
    'verdú', 'vilar', 'vilarroya', 'villalba',
]);

// ─── Spanish-speaking locations ───────────────────────────────────────────────
const SPANISH_LOCATIONS = [
    // Countries
    'españa', 'spain', 'méxico', 'mexico', 'colombia', 'argentina', 'chile', 'perú', 'peru',
    'venezuela', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'costa rica', 'panamá', 'panama',
    'guatemala', 'honduras', 'el salvador', 'nicaragua', 'cuba', 'república dominicana',
    'dominican republic', 'dominicana', 'puerto rico',
    // Major cities – Spain
    'madrid', 'barcelona', 'valencia', 'sevilla', 'seville', 'málaga', 'malaga', 'bilbao',
    'zaragoza', 'murcia', 'palma', 'las palmas', 'alicante', 'córdoba', 'cordoba', 'valladolid',
    'vigo', 'gijón', 'gijon', 'granada', 'a coruña', 'coruña', 'vitoria', 'santander', 'pamplona',
    'san sebastián', 'san sebastian', 'donostia', 'salamanca', 'burgos', 'cádiz', 'cadiz',
    'tarragona', 'girona', 'toledo', 'badajoz', 'león', 'leon', 'lleida', 'castellón', 'castellon',
    'almería', 'almeria', 'huelva', 'jaén', 'jaen', 'logroño', 'lugo', 'ourense', 'pontevedra',
    'segovia', 'soria', 'teruel', 'zamora', 'ávila', 'avila', 'cuenca', 'huesca', 'palencia',
    // Major cities – LATAM
    'buenos aires', 'bogotá', 'bogota', 'lima', 'santiago', 'ciudad de méxico', 'ciudad de mexico',
    'cdmx', 'guadalajara', 'monterrey', 'medellín', 'medellin', 'cali', 'barranquilla', 'cartagena',
    'quito', 'guayaquil', 'la paz', 'cochabamba', 'santa cruz', 'asunción', 'asuncion',
    'montevideo', 'san josé', 'san jose', 'caracas', 'maracaibo', 'puebla', 'tijuana',
    'cancún', 'cancun', 'mérida', 'merida', 'rosario', 'mendoza', 'tucumán', 'tucuman',
    'arequipa', 'cusco', 'cuzco', 'trujillo', 'valparaíso', 'valparaiso', 'concepción', 'concepcion',
    'temuco', 'antofagasta', 'santo domingo', 'san juan', 'la habana', 'havana',
    // Regions
    'latam', 'latinoamérica', 'latinoamerica', 'hispanoamérica', 'hispanoamerica',
    'iberoamérica', 'iberoamerica', 'cataluña', 'catalonia', 'andalucía', 'andalucia',
    'castilla', 'galicia', 'país vasco', 'pais vasco', 'euskadi', 'asturias', 'cantabria',
    'aragón', 'aragon', 'extremadura', 'navarra', 'la rioja', 'canarias', 'baleares',
];

// ─── Spanish occupational/common keywords ─────────────────────────────────────
const SPANISH_TEXT_KEYWORDS = [
    'desarrollador', 'ingeniero', 'ingeniera', 'programador', 'programadora', 'analista',
    'consultor', 'consultora', 'director', 'directora', 'gerente', 'jefe', 'jefa', 'líder',
    'coordinador', 'coordinadora', 'especialista', 'técnico', 'técnica', 'diseñador', 'diseñadora',
    'arquitecto', 'arquitecta', 'investigador', 'investigadora', 'responsable',
    'experiencia', 'empresa', 'trabajo', 'proyecto', 'proyectos', 'equipo', 'gestión', 'gestion',
    'implementación', 'implementacion', 'desarrollo', 'tecnología', 'tecnologia', 'soluciones',
    'actualmente', 'anteriormente', 'encargado', 'autónomo', 'autonomo',
    'disponible', 'remoto', 'presencial', 'híbrido', 'hibrido', 'emprendedor', 'emprendedora',
    'cofundador', 'cofundadora', 'fundador', 'fundadora',
    'universidad', 'licenciatura', 'máster', 'master', 'grado', 'ingeniería', 'ingenieria',
    'informática', 'informatica', 'telecomunicaciones', 'computación', 'computacion',
    'años de experiencia', 'año', 'años', 'sobre mí', 'sobre mi', 'acerca de',
];

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Strip accents and lower-case for accent-insensitive matching. */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SpanishDetectionResult {
    isSpanish: boolean;
    /** 0–100 cumulative confidence. Pass threshold = 20. */
    confidence: number;
    signals: string[];
}

// ─── Exported helper functions ────────────────────────────────────────────────

/**
 * Check whether a full name contains at least one Hispanic first name or surname.
 */
export function hasSpanishName(fullName: string): { match: boolean; matchedParts: string[] } {
    if (!fullName) return { match: false, matchedParts: [] };
    const norm = normalize(fullName);
    const parts = norm.split(/\s+/).filter(p => p.length > 1);
    const matchedParts = parts.filter(p => SPANISH_FIRST_NAMES.has(p) || SPANISH_SURNAMES.has(p));
    return { match: matchedParts.length > 0, matchedParts };
}

/**
 * Signal 4 — Patronymic suffix detection.
 *
 * Iberian patronymic surnames (González, Martínez, Rodríguez, Hernández,
 * Sánchez, Ruiz, Díaz, Ortiz, Pérez, Jiménez, Gutiérrez, Muñoz, etc.) end
 * in the suffixes -ez, -az, -iz, -oz after diacritic normalization.
 * This pattern is almost exclusively Iberian; false-positive rate on
 * English/French/German/other names is extremely low.
 *
 * Min length = 4 prevents matching short tokens like "oz", "az", "iz".
 */
export function hasPatronymicSuffix(fullName: string): { match: boolean; matchedParts: string[] } {
    if (!fullName) return { match: false, matchedParts: [] };
    const parts = normalize(fullName).split(/\s+/).filter(p => p.length >= 4);
    const matched = parts.filter(p => /[aeio]z$/.test(p));
    return { match: matched.length > 0, matchedParts: matched };
}

/**
 * Detect Spanish-speaking signals in location and free-text fields.
 */
export function hasSpanishLocationOrText(
    location: string | null,
    title: string | null,
    description: string | null,
): { locationMatch: boolean; textMatch: boolean; signals: string[] } {
    const signals: string[] = [];
    let locationMatch = false;
    let textMatch = false;

    if (location) {
        const normLoc = normalize(location);
        for (const loc of SPANISH_LOCATIONS) {
            if (normLoc.includes(normalize(loc))) {
                locationMatch = true;
                signals.push(`location:${loc}`);
                break;
            }
        }
    }

    const combinedText = normalize([title ?? '', description ?? ''].join(' '));
    if (combinedText.length > 5) {
        let hits = 0;
        for (const kw of SPANISH_TEXT_KEYWORDS) {
            if (combinedText.includes(normalize(kw))) {
                hits++;
                if (hits >= 2) {
                    textMatch = true;
                    signals.push(`text:spanish_keywords(${hits})`);
                    break;
                }
            }
        }
    }

    return { locationMatch, textMatch, signals };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Determines if a candidate is likely a Spanish speaker.
 * Any single positive signal is sufficient (confidence threshold = 20).
 *
 * @param name        Full name of the candidate.
 * @param title       Job title or headline.
 * @param description Bio, about text, or README excerpt.
 * @param location    Self-reported location string.
 */
export function isLikelySpanishSpeaker(
    name: string,
    title: string | null,
    description: string | null,
    location: string | null,
): SpanishDetectionResult {
    const signals: string[] = [];
    let confidence = 0;

    // Signal 1 – Hispanic name (+50)
    const nameResult = hasSpanishName(name);
    if (nameResult.match) {
        confidence += 50;
        signals.push(`nombre_hispano:${nameResult.matchedParts.join(',')}`);
    }

    // Signal 2 – Location or text keywords
    const locText = hasSpanishLocationOrText(location, title, description);
    if (locText.locationMatch) {
        confidence += 40;
        signals.push(...locText.signals.filter(s => s.startsWith('location:')));
    }
    if (locText.textMatch) {
        confidence += 30;
        signals.push(...locText.signals.filter(s => s.startsWith('text:')));
    }

    // Signal 3 – Location keyword buried in description (when location field is null)
    if (!locText.locationMatch && description) {
        const normDesc = normalize(description);
        for (const loc of SPANISH_LOCATIONS) {
            if (normDesc.includes(normalize(loc))) {
                confidence += 35;
                signals.push(`desc_location:${loc}`);
                break;
            }
        }
    }

    // Signal 4 – Patronymic suffix (-ez/-az/-iz/-oz) (+40)
    // Iberian patronymics end in these suffixes after diacritic normalization.
    // False-positive rate on non-Hispanic names is extremely low.
    if (!nameResult.match) {
        // Only run when name dict didn’t already score to avoid double-counting.
        const patronymic = hasPatronymicSuffix(name);
        if (patronymic.match) {
            confidence += 40;
            signals.push(`patronimico:${patronymic.matchedParts.join(',')}`);
        }
    }

    // Signal 5 – Structural bonus: ≥3 word name with any positive Hispanic signal (+15)
    // Hispanic naming convention = Nombre Apellido1 Apellido2.
    // If we already have ≥20 pts AND the name has 3+ words, the multi-surname
    // structure adds corroborating evidence even without a dict match.
    const wordCount = name.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 3 && confidence >= 20) {
        confidence += 15;
        signals.push('estructura_nombre_compuesto');
    }

    confidence = Math.min(confidence, 100);

    return {
        isSpanish: confidence >= 20,
        confidence,
        signals,
    };
}
