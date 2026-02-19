# Plan de Implementación: Sistema Marketplace

Este documento detalla el método para encontrar talento extrayendo información de plataformas de freelancing (Upwork/Fiverr) y cruzándola con LinkedIn/GitHub para establecer contacto directo.

**Objetivo:** Extraer la información de la plataforma "B" (Upwork/Fiverr) y cruzarla con la plataforma "A" (LinkedIn/GitHub) para encontrar su contacto directo.

---

## FASE 1: El Scraping (Extrayendo a los mejores)

**Objetivo:** No buscar a cualquiera, filtrar solo a la élite.

**Herramienta clave:** [Apify](https://apify.com/). Plataforma estándar con "Actors" preconstruidos para Upwork y Fiverr.

### El Filtro (Criterios de búsqueda)

1.  **Keyword:** `Flutter` OR `Mobile App Developer`.
2.  **Calidad:**
    *   **Upwork:** "Top Rated" o "Top Rated Plus".
    *   **Fiverr:** "Level 2" o "Top Rated Seller".
3.  **Precio:** +$40/hora. (Descartar tarifas bajas para asegurar "A-Players").
4.  **Éxito:** +90% Job Success Rate.

### Datos a extraer (CSV)
*   **Nombre** (Suele ser parcial, ej. "Juan M.")
*   **País**
*   **Título** (ej. "Senior Flutter Developer")
*   **Info Clave:** Links a portafolios web o nombres de empresas anteriores (Crucial para la Fase 2).

---

## FASE 2: El Enriquecimiento (La "Triangulación")

**Objetivo:** Usar IA para inferir el perfil de LinkedIn a partir de los datos limitados de Upwork/Fiverr.

**Herramienta clave:** [Clay.com](https://www.clay.com/) (o Phantombuster).

### Configuración del flujo en Clay

1.  **Input:** Subir el CSV de Apify con columnas: `Nombre_Parcial`, `Titulo`, `Ubicacion`.
2.  **Paso 1 (Google X-Ray en Clay):**
    *   Query automática: `site:linkedin.com/in/ "Juan" "Flutter" "España"`
3.  **Paso 2 (Match de Foto):**
    *   Usar herramientas de Clay para comparar la foto de perfil de Upwork con la de LinkedIn (Reverse Image Search) y asegurar identidad.
4.  **Paso 3 (Extracción de Email):**
    *   Una vez confirmado el LinkedIn, usar integración Clay + **Prospeo** o **Dropcontact** para obtener email personal/profesional.

---

## FASE 3: El Outreach (El "Rescate")

**Objetivo:** Salir de la plataforma de freelance y contactar directamente.

**Herramientas:**
*   **LinkedIn:** Walead
*   **Email:** Instantly

### El Ángulo del Mensaje (El "Pitch")
No hablar como un cliente más. Hablar como un salvador atacando los dolores del freelancer (inestabilidad, malos clientes, comisiones).

### Plantilla Sugerida

> "Hola {{firstName}}, estaba navegando por Upwork buscando talento top en Flutter y vi que tienes la insignia de Top Rated y unas valoraciones brutales.
>
> Sé que como freelancer se pierde mucho tiempo lidiando con clientes y comisiones. En Symmetry estamos armando el mejor producto de bienestar del mercado y buscamos a un 'A-Player' como tú para el equipo fijo (100% remoto, cero estrés de buscar clientes, proyectos sólidos).
>
> ¿Tienes espacio para dejar el freelanceo y sumarte a un proyecto a largo plazo? Un saludo!"
