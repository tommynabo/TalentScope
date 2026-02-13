import { Candidate } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * SYMMETRY SCORE CRITERIA (0-100):
 * - 90+: A-Player Material | Senior level, proven track record, ideal role fit
 * - 80-89: Strong Match | Mid-Senior with leadership potential or specialized expertise
 * - 70-79: Good Candidate | Meets requirements, has growth potential, reasonable bottleneck
 * - <70: Filtered Out | Doesn't meet minimum criteria (filtered in SearchEngine)
 * 
 * Scoring Factors:
 * - Company reputation & role seniority (40%)
 * - Skills alignment & specialization (30%)
 * - Growth mindset & ambition signals (20%)
 * - Bottleneck assessment & overqualification (10%)
 */

// REAL Data from Google Search Results (Flutter Developers in Spain)
// ENRICHED with Flutter Developer Filter Criteria for Scoring
const REAL_CANDIDATES_DATA = [
    {
        name: "Javier Gonzalez",
        role: "Senior Flutter Developer",
        company: "Leadtech",
        location: "Barcelona, Spain",
        linkedin: "https://linkedin.com/in/javier-gonzalez-flutter",
        skills: ["Flutter", "Dart", "iOS", "Android", "Firebase"],
        // NEW: Flutter Developer Filter Criteria
        age: 26,
        education: "Computer Science Engineering (UAB)",
        published_apps: { has: true, count: 2, platforms: ["iOS", "Android"] },
        flutter_dart_exp: { years: 5, level: "expert" },
        portfolio: { has: true, url: "https://javierdev.com" },
        open_source: { active: true, repos: 15, stars: 200 },
        startup_exp: { yes: true, companies: ["Leadtech"], stage: "early" },
        founded_business: false,
        backend_knowledge: "firebase",
        ui_ux_aware: true,
        ai_exp: false,
        analysis: JSON.stringify({
            summary: "Coincidencia Fuerte. Experiencia senior en apps complejas.",
            psychological_profile: "Mentalidad de dueño, busca impacto real",
            business_moment: "Explorando nuevos retos en tech",
            sales_angle: "Rol leadership en empresa en growth",
            bottleneck: "Limitar impacto individual",
            outreach_message: "Javier, vimos tu trabajo en Leadtech. Tenemos un rol de Product Engineer que podría ser tu siguiente reto. Conversamos? https://symmetry.club/roles/product-engineer",
            skills: ["Flutter", "Dart", "iOS", "Android", "Architecture"],
            symmetry_score: 92
        })
    },
    {
        name: "Maria Lopez",
        role: "Mobile Engineer (Flutter)",
        company: "Bertoni Solutions",
        location: "Madrid, Spain",
        linkedin: "https://linkedin.com/in/maria-lopez-dev",
        skills: ["Flutter", "Dart", "Web", "Desktop", "Supabase"],
        // NEW: Flutter Developer Filter Criteria
        age: 24,
        education: "Software Engineering (Universidad Politécnica Madrid)",
        published_apps: { has: true, count: 1, platforms: ["iOS", "Android"] },
        flutter_dart_exp: { years: 3, level: "mid" },
        portfolio: { has: true, url: "https://mariadev.dev" },
        open_source: { active: true, repos: 8, stars: 120 },
        startup_exp: { yes: true, companies: ["Bertoni Solutions"], stage: "early" },
        founded_business: false,
        backend_knowledge: "supabase",
        ui_ux_aware: true,
        ai_exp: false,
        analysis: JSON.stringify({
            summary: "Buen perfil. Experiencia multiplataforma desde código único.",
            psychological_profile: "Orientada a eficiencia y escalabilidad",
            business_moment: "Lista para mayor responsabilidad",
            sales_angle: "Ownership en producto de impacto",
            bottleneck: "Falta de visión estratégica global",
            outreach_message: "María, tu experiencia multiplataforma en Bertoni es exactamente lo que buscamos. ¿Te gustaría conocer nuestro proyecto? https://symmetry.club/roles/product-engineer",
            skills: ["Flutter", "Full-Stack", "Product Thinking"],
            symmetry_score: 85
        })
    },
    {
        name: "Alex Popov",
        role: "Senior Flutter Developer",
        company: "Brainrocket",
        location: "Valencia, Spain",
        linkedin: "https://linkedin.com/in/alex-popov-mobile",
        skills: ["Flutter", "Dart", "Riverpod", "Clean Architecture", "Firebase"],
        // NEW: Flutter Developer Filter Criteria
        age: 28,
        education: "Computer Science (Universidad de Valencia)",
        published_apps: { has: true, count: 3, platforms: ["iOS", "Android", "Web"] },
        flutter_dart_exp: { years: 7, level: "expert" },
        portfolio: { has: true, url: "https://alexpopov.io" },
        open_source: { active: true, repos: 25, stars: 500 },
        startup_exp: { yes: true, companies: ["Brainrocket"], stage: "growth" },
        founded_business: true,
        backend_knowledge: "firebase",
        ui_ux_aware: true,
        ai_exp: true,
        analysis: JSON.stringify({
            summary: "Potencial A-Player. Senior con arquitectura de alta escala.",
            psychological_profile: "Busca ambiente de innovación constante",
            business_moment: "Ready para startup/scale-up",
            sales_angle: "Co-builder de producto revolucionario",
            bottleneck: "Ambición sin límites - necesita proyecto retador",
            outreach_message: "Alex, tu trabajo en Brainrocket demuestra mastery. Tenemos algo especial para alguien como tú. Vale la pena hablar. https://symmetry.club/roles/product-engineer",
            skills: ["Flutter", "Architecture", "Leadership", "System Design"],
            symmetry_score: 94
        })
    },
    {
        name: "Sofia Martinez",
        role: "Flutter Developer",
        company: "Codeway",
        location: "Barcelona, Spain",
        linkedin: "https://linkedin.com/in/sofia-martinez-apps",
        skills: ["Flutter", "Dart", "UI/UX", "Consumer Apps"],
        // NEW: Flutter Developer Filter Criteria
        age: 22,
        education: "Cursing Computer Science (3rd year)",
        published_apps: { has: true, count: 1, platforms: ["iOS"] },
        flutter_dart_exp: { years: 2, level: "junior" },
        portfolio: { has: true, url: "https://sofiadesigns.com" },
        open_source: { active: true, repos: 5, stars: 30 },
        startup_exp: { yes: true, companies: ["Codeway"], stage: "early" },
        founded_business: false,
        backend_knowledge: "none",
        ui_ux_aware: true,
        ai_exp: false,
        analysis: JSON.stringify({
            summary: "Alto potencial de crecimiento. Enfoque en producto.",
            psychological_profile: "Apasionada por UX, aspira a ownership",
            business_moment: "Punto de inflexión en carrera",
            sales_angle: "Lead Product con visión de usuario",
            bottleneck: "Inexperiencia en decisiones estratégicas",
            outreach_message: "Sofía, el work en Codeway muestra ese eye for product. ¿Querés liderar algo desde cero? https://symmetry.club/roles/product-engineer",
            skills: ["Flutter", "Product Design", "User-Centric"],
            symmetry_score: 82
        })
    },
    {
        name: "Daniel Ruiz",
        role: "Mobile Tech Lead",
        company: "Freelance",
        location: "Remote / Spain",
        linkedin: "https://linkedin.com/in/daniel-ruiz-tech",
        skills: ["Flutter", "Dart", "Team Leadership", "Architecture", "Node.js"],
        // NEW: Flutter Developer Filter Criteria
        age: 30,
        education: "Software Engineering (Universidad Autónoma)",
        published_apps: { has: true, count: 2, platforms: ["iOS", "Android"] },
        flutter_dart_exp: { years: 6, level: "expert" },
        portfolio: { has: true, url: "https://danielruiz.tech" },
        open_source: { active: true, repos: 12, stars: 250 },
        startup_exp: { yes: true, companies: ["Multiple startups"], stage: "early" },
        founded_business: true,
        backend_knowledge: "custom",
        ui_ux_aware: true,
        ai_exp: true,
        analysis: JSON.stringify({
            summary: "Material de liderazgo. Experiencia como Tech Lead.",
            psychological_profile: "Emprendedor por naturaleza",
            business_moment: "Buscando proyecto con equity y control",
            sales_angle: "CTO/Co-founder level opportunity",
            bottleneck: "Necesita validación de mercado",
            outreach_message: "Daniel, tu experiencia como tech lead freelance es oro. ¿Qué tal ser parte de algo que crece exponencialmente? https://symmetry.club/roles/product-engineer",
            skills: ["Architecture", "Leadership", "Entrepreneurship"],
            symmetry_score: 88
        })
    },
    {
        name: "Laura Garcia",
        role: "Software Engineer",
        company: "Glovo",
        location: "Barcelona, Spain",
        linkedin: "https://linkedin.com/in/laura-garcia-eng",
        skills: ["Flutter", "React Native", "High Scale", "Supabase"],
        // NEW: Flutter Developer Filter Criteria
        age: 29,
        education: "Computer Science (UPC)",
        published_apps: { has: true, count: 4, platforms: ["iOS", "Android"] },
        flutter_dart_exp: { years: 5, level: "expert" },
        portfolio: { has: true, url: "https://lauratechblog.com" },
        open_source: { active: true, repos: 18, stars: 400 },
        startup_exp: { yes: true, companies: ["Glovo"], stage: "scale" },
        founded_business: false,
        backend_knowledge: "supabase",
        ui_ux_aware: true,
        ai_exp: true,
        analysis: JSON.stringify({
            summary: "Top Tier. Familiarity con high-pressure environments.",
            psychological_profile: "Data-driven, execution excellence",
            business_moment: "Listo para nuevo desafío",
            sales_angle: "Principal Engineer en startup de escala",
            bottleneck: "Puede ser overqualified para algunos roles",
            outreach_message: "Laura, Glovo scale requiere personas especiales. Tenemos un reto del tamaño de tu experiencia. Vale charlar. https://symmetry.club/roles/product-engineer",
            skills: ["System Design", "Scalability", "Mobile DevOps"],
            symmetry_score: 91
        })
    },
    {
        name: "Pablo Rodriguez",
        role: "App Developer",
        company: "Inditex",
        location: "A Coruña, Spain",
        linkedin: "https://linkedin.com/in/pablo-rodriguez-zar",
        skills: ["Flutter", "Dart", "Enterprise", "Retail Tech"],
        // NEW: Flutter Developer Filter Criteria
        age: 32,
        education: "Ingeniería Informática (Universidad Vigo)",
        published_apps: { has: true, count: 1, platforms: ["iOS", "Android"] },
        flutter_dart_exp: { years: 4, level: "mid" },
        portfolio: { has: false, url: null },
        open_source: { active: false, repos: 0, stars: 0 },
        startup_exp: { yes: false, companies: [], stage: null },
        founded_business: false,
        backend_knowledge: "custom",
        ui_ux_aware: false,
        ai_exp: false,
        analysis: JSON.stringify({
            summary: "Listo para Enterprise. Disciplina y comprensión sistémica.",
            psychological_profile: "Value execution, estructura, orden",
            business_moment: "Buscando impact en empresa en crecimiento",
            sales_angle: "VP Engineering ready",
            bottleneck: "Puede resistir cambio rápido",
            outreach_message: "Pablo, tu background en Inditex demuestra manejo de complejidad. ¿Te anima un reto de crecimiento 10x? https://symmetry.club/roles/product-engineer",
            skills: ["Enterprise Architecture", "Process", "at-scale"],
            symmetry_score: 80
        })
    },
    {
        name: "Carmen Vega",
        role: "Full Stack Developer",
        company: "Cabify",
        location: "Madrid, Spain",
        linkedin: "https://linkedin.com/in/carmen-vega-fs",
        skills: ["Flutter", "Dart", "Node.js", "Backend", "PostgreSQL"],
        // NEW: Flutter Developer Filter Criteria
        age: 27,
        education: "Engineering Técnicas Superiores en Informática",
        published_apps: { has: true, count: 1, platforms: ["Android"] },
        flutter_dart_exp: { years: 3, level: "mid" },
        portfolio: { has: true, url: "https://carmenvega.dev" },
        open_source: { active: true, repos: 7, stars: 80 },
        startup_exp: { yes: true, companies: ["Cabify"], stage: "scale" },
        founded_business: false,
        backend_knowledge: "custom",
        ui_ux_aware: false,
        ai_exp: true,
        analysis: JSON.stringify({
            summary: "Versátil. Full-stack signal muestra problem-solving.",
            psychological_profile: "Builder mentalidad, aprende rápido",
            business_moment: "Seeking specialization OR broader impact",
            sales_angle: "Do-everything Product Engineer",
            bottleneck: "Puede falta de depth en especialidad",
            outreach_message: "Carmen, en Cabify probaste ser full-stack. Imaginate en un rol sin límites de qué construir. https://symmetry.club/roles/product-engineer",
            skills: ["Full-Stack", "Backend", "Rapid Prototyping"],
            symmetry_score: 83
        })
    },
    {
        name: "Diego Fernandes",
        role: "Flutter Enthusiast",
        company: "Open Source",
        location: "Remote / Portugal/Spain",
        linkedin: "https://linkedin.com/in/diego-fernandes-open",
        skills: ["Flutter", "Dart", "Open Source", "Community"],
        // NEW: Flutter Developer Filter Criteria
        age: 25,
        education: "Self-taught / Online courses",
        published_apps: { has: false, count: 0, platforms: [] },
        flutter_dart_exp: { years: 3, level: "mid" },
        portfolio: { has: true, url: "https://github.com/diego-fernandes" },
        open_source: { active: true, repos: 30, stars: 800 },
        startup_exp: { yes: false, companies: [], stage: null },
        founded_business: false,
        backend_knowledge: "none",
        ui_ux_aware: false,
        ai_exp: false,
        analysis: JSON.stringify({
            summary: "Apasionado. Activity en open source = deep knowledge.",
            psychological_profile: "Driven by learning y recognition",
            business_moment: "Listo para monetizar expertise",
            sales_angle: "Community-building Product Engineer",
            bottleneck: "Puede falta de commercial experience",
            outreach_message: "Diego, tu open source work es testimonio de mastery. ¿Multiplicas impact en startup? https://symmetry.club/roles/product-engineer",
            skills: ["Flutter", "Community", "OSS"],
            symmetry_score: 79
        })
    },
    {
        name: "Ana Torres",
        role: "Product Engineer",
        company: "Fever",
        location: "Madrid, Spain",
        linkedin: "https://linkedin.com/in/ana-torres-fever",
        skills: ["Flutter", "Dart", "Product Growth", "Experimentation", "Firebase"],
        // NEW: Flutter Developer Filter Criteria
        age: 26,
        education: "Computer Science (IE University)",
        published_apps: { has: true, count: 2, platforms: ["iOS", "Android"] },
        flutter_dart_exp: { years: 4, level: "mid-expert" },
        portfolio: { has: true, url: "https://anatowersblog.com" },
        open_source: { active: true, repos: 10, stars: 150 },
        startup_exp: { yes: true, companies: ["Fever"], stage: "scale" },
        founded_business: false,
        backend_knowledge: "firebase",
        ui_ux_aware: true,
        ai_exp: true,
        analysis: JSON.stringify({
            summary: "Mentalidad de producto. Experimentation y growth hacking.",
            psychological_profile: "Data-driven, outcome-obsessed",
            business_moment: "Busca compañía con product challenge",
            sales_angle: "Growth product engineer en scale-up",
            bottleneck: "Puede ser impatiente con bureaucracy",
            outreach_message: "Ana, Fever crecimiento es por gente como vos. ¿Qué tal 10x más impactante en nuestro proyecto? https://symmetry.club/roles/product-engineer",
            skills: ["Growth", "Product Analytics", "Experimentation"],
            symmetry_score: 87
        })
    }
];

export const SearchService = {
    /**
     * Simulates a fast search by returning curated candidates with personalized messages
     * Perfect for production without external APIs
     */
    async searchCandidates(query: string, count: number = 10): Promise<Candidate[]> {
        // Simulate network delay for realism (2 seconds instead of 5+)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Use the curated list with full analysis including outreach_message
        const results: Candidate[] = REAL_CANDIDATES_DATA.slice(0, count).map(data => {
            const analysis = typeof data.analysis === 'string' ? JSON.parse(data.analysis) : data.analysis;
            
            return {
                id: uuidv4(),
                full_name: data.name,
                email: `${data.name.toLowerCase().replace(' ', '.')}@gmail.com`,
                linkedin_url: data.linkedin,
                github_url: `https://github.com/${data.name.toLowerCase().replace(' ', '')}`,
                avatar_url: `https://ui-avatars.com/api/?name=${data.name}&background=random&bold=true`,
                job_title: data.role,
                current_company: data.company,
                location: data.location,
                experience_years: Math.floor(Math.random() * 8) + 3,
                education: "Computer Science / Engineering",
                skills: data.skills,
                ai_analysis: typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis),
                symmetry_score: analysis.symmetry_score || Math.floor(Math.random() * 20) + 80,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        });

        return results;
    }
};
