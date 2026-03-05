# SISTEMA COMUNIDAD - FLUJO VISUAL COMPLETO

## 🔄 Flujo de Datos (Extracción → Sincronización → Gmail)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         USUARIO EN SISTEMA COMUNIDAD                        │
│                                                                             │
│  - Busca candidatos en Discord/Reddit/Skool                               │
│  - Ve el Pipeline con cards de candidatos                                 │
│  - Expande un candidato                                                    │
│  - Ve análisis de IA + botones                                            │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
                     │ Click en: "Extraer Email/LinkedIn"
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    COMMUNITYCANDIDATESPIPELINE.TSX                          │
│                                                                             │
│  ├─ handleEnrichCandidate() llamado                                        │
│  ├─ Estado: enrichingIds.add(candidateId)                                  │
│  └─ Mostrar spinner: "Extrayendo..."                                       │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│              COMMUNITYENRICHMENTSERVICE.ENRICHCANDIDATE()                  │
│                                                                             │
│  1. Mapear CommunityCandidate → ScrapedCandidate                           │
│  2. Inicializar ContactResearchService (Apify + OpenAI)                    │
│  3. Buscar LinkedIn: researchService.findLinkedInProfile()                 │
│  4. Buscar Emails: researchService.findEmailAddresses()                    │
│  5. Actualizar BD: community_candidates.email + linkedin_url               │
│                                                                             │
│  ⏱️  Tiempo: 30-60 segundos (Apify haciendo OSINT)                         │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
                     │ Updates devueltos: { email, linkedInUrl }
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            COMMUNITYCANDIDATESYNCSERVICE.SYNCTOGMAILCANDIDATES()           │
│                                                                             │
│  1. Verificar que candidato tenga email                                    │
│  2. Consultar: global_email_candidates view                                │
│  3. Si está → candidato synced ✅                                          │
│  4. Si no → intenta buscar en fallback                                     │
│                                                                             │
│  Resultado: { success: boolean }                                           │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
                     │ Actualizar UI + Toast
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            COMMUNITYCANDIDATESPIPELINE.TSX - UI ACTUALIZADA                │
│                                                                             │
│  ├─ Toast: "✨ Email/LinkedIn extraído y sincronizado"                     │
│  ├─ Estado: enrichingIds.delete(candidateId)                              │
│  ├─ Botón ahora visible: "+ Candidatos" (con icono de mail)              │
│  └─ Candidato actualizado en lista local                                  │
│                                                                             │
│  Opcionales:                                                                │
│  - Click "+ Candidatos" → Sincronizar manualmente                         │
│  - Click "Ver perfil" → Abrir en Discord/Reddit                           │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
                     │ (Automático - Sin intervención del usuario)
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE - BASE DE DATOS                               │
│                                                                             │
│  TABLA: community_candidates (actualizada)                                │
│  ├─ id: [uuid]                                                             │
│  ├─ campaign_id: [uuid]                                                    │
│  ├─ username: "discord_user"                                               │
│  ├─ display_name: "John Dev"                                               │
│  ├─ email: "john@example.com" ← NUEVO (extraído)                          │
│  ├─ linkedin_url: "https://linkedin.com/in/john" ← NUEVO                   │
│  ├─ platform: "Discord"                                                    │
│  ├─ profile_url: "https://discord.com/..."                                 │
│  └─ created_at: timestamp                                                  │
│                                                                             │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
                     │ (Automático - Trigger de Vista)
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     VISTA SQL: global_email_candidates                      │
│                                                                             │
│  SELECT * FROM:                                                            │
│  ├─ 1. candidates (LinkedIn)                                              │
│  ├─ 2. github_candidates (GitHub)                                         │
│  ├─ 3. marketplace_candidates (Upwork/Fiverr)                             │
│  └─ 4. community_candidates (Discord/Reddit/Skool) ← AQUÍ                 │
│                                                                             │
│  WHERE: email IS NOT NULL AND email != ''                                  │
│                                                                             │
│  UNION ALL sin duplicados                                                  │
│                                                                             │
│  RESULTADO:                                                                 │
│  ├─ candidate_id: [uuid]                                                   │
│  ├─ source_platform: "Discord"                                            │
│  ├─ name: "John Dev"                                                       │
│  ├─ email: "john@example.com"                                              │
│  ├─ profile_url: "https://discord.com/..."                                │
│  ├─ current_role: "Community Member"                                       │
│  └─ created_at: timestamp                                                  │
│                                                                             │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
                     │ (GmailCandidatesService consulta esta vista)
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  GMAILCANDIDATESSERVICE.GETGLOBALEMAILCANDIDATES()         │
│                                                                             │
│  1. SELECT * FROM global_email_candidates (vista SQL)                      │
│  2. Si funciona → devolver candidatos                                      │
│  3. Si falla → FALLBACK a:                                                 │
│     ├─ SELECT FROM github_search_results                                   │
│     ├─ SELECT FROM candidates                                              │
│     ├─ SELECT FROM marketplace_candidates                                  │
│     └─ SELECT FROM community_candidates ← NUEVO FALLBACK                   │
│                                                                             │
│  Resultado: GlobalEmailCandidate[]                                         │
│  ├─ candidate_id                                                           │
│  ├─ source_platform                                                        │
│  ├─ name                                                                   │
│  ├─ email                                                                  │
│  ├─ profile_url                                                            │
│  ├─ current_role                                                           │
│  └─ created_at                                                             │
│                                                                             │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │
                     │ (Carga en Gmail > Buzones > Candidatos)
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      GMAIL DASHBOARD - CANDIDATOS                          │
│                                                                             │
│  Buzones                                                                    │
│  └─ Candidatos                                                             │
│     ├─ "John Dev" (Discord)                                                │
│     │  ├─ Email: john@example.com                                          │
│     │  ├─ Rol: Community Member                                            │
│     │  ├─ Plataforma: Discord                                              │
│     │  ├─ Acciones:                                                        │
│     │  │  ├─ Crear secuencia                                              │
│     │  │  ├─ Agregar a secuencia                                          │
│     │  │  ├─ Enviar email manual                                          │
│     │  │  └─ Ver perfil                                                   │
│     │  └─ [Más opciones...]                                               │
│     ├─ "Jane Dev" (Reddit)                                                 │
│     └─ [Más candidatos...]                                                 │
│                                                                             │
│  ✨ LISTO PARA OUTREACH ✨                                                 │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
         │
         │ Usuario crea Secuencia → Agrega candidatos → Configura emails
         │
         ▼
    ┌─────────────────────────────────┐
    │ Envío de Emails Automáticos      │
    │ con Tracking de Opens/Clicks     │
    └─────────────────────────────────┘
```

---

## 📊 Puntos Clave de la Arquitectura

### 1. **EXTRACCIÓN (30-60 seg)**
```typescript
// CommunityEnrichmentService
- Usa Apify para OSINT público
- Busca emails en: whois, LinkedIn, GitHub, portfolio
- Busca LinkedIn en: Google, Bing, perfiles públicos
- Guarda en community_candidates tabla
```

### 2. **SINCRONIZACIÓN (< 100ms)**
```typescript
// CommunityCandidateSyncService
- Verifica que aparezca en global_email_candidates
- Hace logging detallado
- Manejo robusto de errores
- Sin bloqueos ni delays
```

### 3. **UNITED VIEW (Instant)**
```sql
-- global_email_candidates (SQL VIEW)
- UNION de 4 tablas sin duplicados
- Candidatos enriquecidos automáticamente aparecen
- Sin necesidad de refresh (es una vista dinámica)
```

### 4. **FALLBACK (< 1 seg)**
```typescript
// GmailCandidatesService
Si la vista falla:
├─ Consulta github_search_results
├─ Consulta candidates (LinkedIn)
├─ Consulta marketplace_candidates
└─ Consulta community_candidates ← NUEVO

El usuario NO se da cuenta (manejo transparente)
```

### 5. **GMAIL INTEGRATION**
```
Gmail > Buzones > Candidatos
├─ Carga via GmailCandidatesService
├─ Muestra: nombre, email, rol, plataforma
├─ Acciones: crear secuencia, agregar, enviar email
└─ Compatible con todas las campañas
```

---

## 🔐 Seguridad & Validaciones

```
Community Candidate Sync Flow Security:
│
├─ ✅ RLS: Solo usuarios ven sus propios candidatos
├─ ✅ Email Validation: No NULL, no vacío before sync
├─ ✅ Campaign Association: Candidato vinculado a campaña del usuario
├─ ✅ Error Handling: Logs detallados sin exposición de datos
├─ ✅ Fallback Mechanism: Si vista falla, sempre hay datos disponibles
└─ ✅ OSINT Compliance: Solo datos públicos, sin scraping privado
```

---

## 📈 Escalabilidad

```
Estimados de Performance:

Extracción:
├─ 1 candidato: 30-60 seg (por Apify)
├─ 5 candidatos: 2.5-5 min (secuencial)
└─ 10+ candidatos: Usar batch mode (paralelo)

Sincronización:
├─ 1 candidato: <100ms
├─ 100 candidatos: <1 seg (bulk query)
└─ 1000 candidatos: <5 seg (con índices)

Gmail Load:
├─ 100 candidatos: ~200ms
├─ 1000 candidatos: ~500ms
└─ 10000 candidatos: ~3 seg (con pagination)
```

---

## 🎯 Casos de Uso Reales

### Caso 1: Reclutador Individual
```
1. Busca 20 devs en Discord
2. Extrae emails de 5 más prometedores
3. Abre Gmail > Candidatos (instantáneo)
4. Selecciona 5, crea secuencia
5. Configura 5 emails automáticos
6. Monitorea opens/clicks por 2 semanas
```

### Caso 2: Team Scaling
```
1. Ejecuta campaign de 50 discord devs
2. Extrae emails de 20 mejores (batch mode)
3. Todos aparecen en Gmail automáticamente
4. Marketing crea 3 secuencias diferentes
5. A/B test: secuencia A vs B
6. Análisis: 40% open rate, 12% click rate
```

### Caso 3: Multi-Source Recruitment
```
1. Discord: 10 candidatos extraídos
2. Reddit: 15 candidatos extraídos
3. GitHub: 8 candidatos extraídos
4. LinkedIn: 20 candidatos importados

Total en Gmail > Candidatos: 53 candidatos
├─ Pueden ser filtrados por plataforma
├─ Pueden ser etiquetados por score
└─ Pueden ser agrupados en secuencias
```

---

## 🚀 Próximos Pasos (Roadmap)

### Fase 2: Automation
```
- Auto-enrich: Ejecuciones automáticas periódicas
- Auto-enroll: Agregar automáticamente a secuencia
- Batch mode: Procesar 10+ en paralelo
- Webhooks: Trigger en nuevos candidatos
```

### Fase 3: Intelligence
```
- AI Scoring: Mejorar predicción de tasa respuesta
- Personalization: Emails dinámicos por rol/plataforma
- A/B Testing: Testing automático de subject lines
- Analytics: Dashboard de conversión por fuente
```

### Fase 4: Integration
```
- LinkedIn API: Conexión directa (no OSINT)
- WhatsApp: Mensajes además de email
- Slack: Notificaciones de opens/clicks en Slack
- Zapier: Integración con otros sistemas
```

---

**Diagrama actualizado:** 5 Marzo 2026  
**Estado:** ✅ Sistema funcional y documentado
