# Marketplace Raid - Navigation & URL Structure

## 🧭 Navigation Map

El proyecto ahora utiliza un **state-based routing** sin sidebar. Cada vista corresponde a un estado diferente en `MarketplaceRaidDashboard`.

### Vista de Campañas (Lista)
```
URL Pattern: /marketplace/campaigns (implícito en estado)
Component: MarketplaceRaidDashboard (view.type === 'list')
Features:
  - Grid de campañas (1-3 columnas responsive)
  - Botón "Nueva Campaña"
  - Click para abrir dashboard
  - Status badges (Activa/Pausa/Completada)
```

### Crear Campaña
```
URL Pattern: /marketplace/campaigns/new (implícito en estado)
Component: CreateCampaignModal (view.type === 'creating')
Features:
  - Form con nombre, platform, keywords, rates
  - Multi-keyword support
  - Platform-specific fields
  - Cierra automáticamente al guardar
  - Vuelve a lista de campañas
```

### Dashboard de Campaña
```
URL Pattern: /marketplace/campaigns/:campaignId (implícito)
Component: CampaignDashboard (view.type === 'dashboard')
Features:
  - Header con 5 stats
  - Pipeline view (default) o Kanban
  - Botón "Buscar" → SearchGenerator
  - Botón "Añadir" → ManualEnrichmentModal
  - Export con date range
```

### Generador de Búsqueda
```
URL Pattern: /marketplace/campaigns/:campaignId/search (implícito)
Component: SearchGenerator (view.type === 'search')
Features:
  - Full-screen UI
  - Lead counter (10-500)
  - Quick presets: 25, 50, 100, 250, 500
  - Progress animation
  - Stats preview
  - "Iniciar Búsqueda" → vuelve al dashboard
```

---

## 🎯 State-Based Navigation

El proyecto usa un patrón `ViewState` para manejar la navegación sin React Router adicional:

```typescript
type ViewState = 
  | { type: 'list' }
  | { type: 'creating' }
  | { type: 'dashboard'; campaignId: string }
  | { type: 'search'; campaignId: string };

const [view, setView] = useState<ViewState>({ type: 'list' });
```

### Transiciones

**List → Creating**
```typescript
setView({ type: 'creating' });
```

**Creating → List**
```typescript
setView({ type: 'list' });
```

**List → Dashboard**
```typescript
setView({ type: 'dashboard', campaignId: campaign.id });
```

**Dashboard → List**
```typescript
setView({ type: 'list' });
```

**Dashboard → Search**
```typescript
setView({ type: 'search', campaignId: campaign.id });
```

**Search → Dashboard**
```typescript
setView({ type: 'dashboard', campaignId: campaign.id });
```

---

## 🔄 Flow Diagrams

### Flujo Completo

```
┌─────────────────┐
│  List View      │
│  All Campaigns  │
└────────┬────────┘
         │
    ┌─────┴─────────────────────────┐
    │                               │
    ▼                               ▼
┌──────────────┐          ┌──────────────────┐
│ New Campaign │          │ Select Campaign  │
│   (Modal)    │          │                  │
└──────┬───────┘          └────────┬─────────┘
       │                           │
       ▼                      ┌────▼────────────┐
    (save)                    │ Dashboard View  │
       │                      │ (Full-screen)   │
       └──────┬──────────────▶└────┬───────────┘
              │                    │
              │          ┌─────────┴─────────┐
              │          │                   │
              ▼          ▼                   ▼
          ┌────┐    ┌────────┐        ┌──────────┐
          │List│    │ Search │        │Add Modal │
          └────┘    │Generator│       │(manual)  │
                    └────────┘        └──────────┘
```

---

## 🔗 Deep Linking (Futuro)

Para implementar URLs reales con React Router:

```typescript
// Rutas sugeridas
<Route path="/marketplace/campaigns" element={<CampaignsList />} />
<Route path="/marketplace/campaigns/new" element={<CreateCampaignModal />} />
<Route path="/marketplace/campaigns/:id" element={<CampaignDashboard />} />
<Route path="/marketplace/campaigns/:id/search" element={<SearchGenerator />} />
```

---

## 📱 Component Tree

```
MarketplaceRaidDashboard
├── List View (view.type === 'list')
│   ├── CampaignsList
│   └── CreateCampaignModal (isOpen)
│
├── Creating View (view.type === 'creating')
│   └── CreateCampaignModal (visible)
│
├── Dashboard View (view.type === 'dashboard')
│   ├── CampaignDashboard
│   │   ├── PipelineList
│   │   ├── KanbanBoard
│   │   └── ManualEnrichmentModal (isOpen)
│   └── SearchGenerator (hidden)
│
└── Search View (view.type === 'search')
    └── SearchGenerator (visible)
```

---

## 🎨 SearchGenerator Features

### Lead Counter
- **Range:** 10 - 500 leads
- **Quick Presets:** 25, 50, 100, 250, 500
- **Slider:** Visual feedback con gradient
- **Display:** Número grande en tiempo real

### Stats Preview
- **Leads Buscados:** El número seleccionado
- **Esperados Encontrados:** ~85% de leads
- **Calidad Alta:** ~60% de los encontrados

### Button States
- **Enabled:** Cuando lead count ≥ 10
- **Disabled:** Durante búsqueda (simulada)
- **Progress:** Muestra % estimado durante búsqueda

---

## 🚀 URL Navigation Implementation

**Actual (State-based):**
```
MarketplaceRaidDashboard
  ↓
  View State {type: 'dashboard', campaignId}
  ↓
  Renders CampaignDashboard
```

**Futuro (URL-based):**
```
/marketplace/campaigns/:id
  ↓
  Router matches route
  ↓
  React Router loads CampaignDashboard
  ↓
  useParams() extracts :id
```

### Ventajas del cambio futuro:
- ✅ URLs compartibles (https://app.com/marketplace/campaigns/123)
- ✅ Historial del navegador (back button)
- ✅ Bookmarkable
- ✅ Soporta deep-linking

---

## 🛠️ Para Implementar URLs Reales

```typescript
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

<Routes>
  <Route path="/marketplace" element={<MarketplaceRaidDashboard />} />
  <Route path="/marketplace/campaigns" element={<CampaignsList />} />
  <Route path="/marketplace/campaigns/new" element={<CreateCampaignModal />} />
  <Route path="/marketplace/campaigns/:id" element={<CampaignDashboard />} />
  <Route path="/marketplace/campaigns/:id/search" element={<SearchGenerator />} />
</Routes>
```

---

## 📊 Current Navigation Status

| Feature | Implementation | Status |
|---------|-----------------|--------|
| List view | Component | ✅ Live |
| Create campaign | Modal | ✅ Live |
| Dashboard view | Component | ✅ Live |
| Search generator | Full-screen | ✅ Live |
| State-based routing | ViewState union | ✅ Live |
| URL-based routing | React Router | ⏳ Futuro |
| Browser history | Not yet | ⏳ Futuro |
| Deep linking | Not yet | ⏳ Futuro |

---

## 🎯 Quick Navigation Reference

### From List
- **→ Dashboard:** Click campaña
- **→ Create:** "Nueva Campaña" button
- **← Back:** Back button en header

### From Dashboard
- **→ List:** Back button
- **→ Search:** "Buscar" button (verde)
- **→ Add:** "Añadir" button (azul)

### From Search
- **→ Dashboard:** "Iniciar Búsqueda" completa
- **← Back:** (Automático tras búsqueda)

### From Create Modal
- **← List:** Cancelar o X button
- **→ List:** Save exitosa

---

## 💡 Pro Tips

1. **Cada vista es independiente** - No necesita props complejos
2. **ViewState maneja todo** - Centralizado y predecible
3. **No hay global state** - Solo useState local
4. **Fácil de convertir a URLs** - Estructura muy clara para migración

---

## 🔮 Roadmap

- [ ] Implementar React Router con URLs reales
- [ ] Persista URL en el navegador
- [ ] Soporte para back/forward buttons
- [ ] Deep linking para compartir campañas
- [ ] URL params para filtros (e.g., ?lane=contacted)
- [ ] Historial de navegación

---

**Versión:** 1.0  
**Última actualización:** 19 Feb 2026
