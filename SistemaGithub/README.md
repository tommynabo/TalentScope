# Sistema GitHub 🚀

Módulo especializado para búsqueda y gestión de candidatos en GitHub.

## Estructura

```
SistemaGithub/
├── lib/
│   ├── GitHubSearchEngine.ts      # Motor de búsqueda GitHub (Code Scan)
│   ├── githubService.ts            # Servicio principal de GitHub
│   ├── githubSearchService.ts      # Búsqueda avanzada en GitHub
│   ├── githubCandidatePersistence.ts  # Persistencia en Supabase
│   ├── githubDeduplication.ts      # Deduplicación de candidatos
│   ├── githubPresets.ts            # Presets de búsqueda predefinidos
│   └── githubContactService.ts     # Contacto y información de perfiles
└── components/
    ├── GitHubCodeScan.tsx           # Panel principal de búsqueda
    ├── GitHubCampaignList.tsx       # Listado de campañas
    ├── GitHubCandidatesCards.tsx    # Vista de tarjetas
    ├── GitHubCandidatesKanban.tsx  # Vista Kanban
    ├── GitHubCandidatesPipeline.tsx # Vista Pipeline
    ├── GitHubFilterConfig.tsx       # Configuración de filtros
    ├── GitHubScanManager.tsx        # Gestor de búsquedas
    └── GitHubCampaignDashboard.tsx  # Dashboard de campaña
```

## Uso Básico

```typescript
import { GitHubCodeScan } from './SistemaGithub/components/GitHubCodeScan';

// En tu componente padre
<GitHubCodeScan campaignId={campaignId} />
```

## Características

- **GitHub Code Scan**: Búsqueda avanzada de desarrolladores en GitHub
- **Persistencia**: Almacenamiento de candidatos en Supabase
- **Deduplicación**: Evita duplicados automáticamente
- **Presets**: Búsquedas predefinidas (Product Engineers, etc.)
- **Múltiples vistas**: Tarjetas, Kanban, Pipeline

## URL Principal

```
https://tuapp.com/tablero/github/:campaignId
```

