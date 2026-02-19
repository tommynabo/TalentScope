# Marketplace Dashboard - Full Screen Implementation

## 🎯 Vista Refactorizada

### Cambios Principales:

#### 1. **MarketplaceRaidDashboard** (No más Modal)
- ✅ Ahora es **full-screen** sin modal backdrop
- ✅ Usa `flex h-screen` para ocupar toda la altura disponible
- ✅ **Left Sidebar (w-80)**: Lista de campañas con mini-stats
- ✅ **Main Content**: Espacio completo para el dashboard

#### 2. **CampaignDashboard**
- ✅ Header mejorado con stats en una fila: **Total | Por Contactar | Contactados | Respondieron | Tasa Respuesta**
- ✅ View toggle arriba a la derecha (Pipeline | Kanban)
- ✅ Botón "Añadir" para agregar candidatos manualmente
- ✅ Pipeline es la vista **por defecto** (no Kanban)

#### 3. **Vista de Campañas** (Grid Cards - como LinkedIn)
- Grilla responsive: 1 col en mobile, 2 en tablet, 3 en desktop
- Cada tarjeta muestra:
  - Status badge (Activa/Pausa/Completada)
  - Nombre campaña + Platform
  - Keywords
  - 4 stats: Total | Contactados | Respondieron | Tasa %
  - Fecha de creación

---

## 🗄️ SQL Schema para Marketplace

### Instalación en Supabase:

**Opción 1: SQL Editor (Recomendado)**
1. Ve a Supabase Dashboard → SQL Editor
2. Crea una nueva query
3. Copia todo el contenido de `supabase/marketplace_schema.sql`
4. Ejecuta

**Opción 2: Línea de comandos**
```bash
supabase db push
```

### 🗃️ Tablas Creadas:

#### **marketplace_campaigns**
```sql
CREATE TABLE marketplace_campaigns (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(50) CHECK (platform IN ('Upwork', 'Fiverr')),
    status VARCHAR(50) DEFAULT 'active',
    search_terms JSONB NOT NULL, -- { keywords: [], minHourlyRate, maxHourlyRate, etc }
    total_candidates INT DEFAULT 0,
    in_todo INT DEFAULT 0,
    in_contacted INT DEFAULT 0,
    in_replied INT DEFAULT 0,
    in_rejected INT DEFAULT 0,
    in_hired INT DEFAULT 0,
    contact_rate DECIMAL(5,2),
    response_rate DECIMAL(5,2),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Índices:**
- `user_id` - Fast lookups by user
- `platform` - Filter Upwork vs Fiverr
- `status` - Filter active/paused/completed

#### **marketplace_candidates**
```sql
CREATE TABLE marketplace_candidates (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES marketplace_campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    linkedin_url TEXT,
    hourly_rate DECIMAL(8,2),
    job_success_rate DECIMAL(5,2),
    kanban_lane VARCHAR(50) DEFAULT 'todo',
    notes TEXT,
    platform_data JSONB, -- Extra platform-specific data
    added_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Índices:**
- `campaign_id` - Get candidates for a campaign
- `kanban_lane` - Filter by status
- `added_at` - Sort by date added

---

## 🔒 Seguridad (RLS Policies)

Todos los datos protegidos con Row-Level Security:

```sql
-- Users can only see/edit their own campaigns
SELECT: WHERE user_id = auth.uid()
INSERT/UPDATE/DELETE: WHERE user_id = auth.uid()

-- Candidates inherited from campaign
SELECT: WHERE campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
```

---

## 🤖 Triggers Automáticos

### 1. **update_stats_on_candidate_change**
- Ejecuta: Después de INSERT/UPDATE/DELETE en candidates
- Hace: Recalcula stats de la campaña automáticamente
- Resultado: `total_candidates`, `in_todo`, `in_contacted`, etc. siempre actualizados

### 2. **update_campaigns_timestamp**
- Ejecuta: Antes de UPDATE en campaigns
- Hace: Sets `updated_at = CURRENT_TIMESTAMP`
- Resultado: Sabes cuándo se modificó cada campaña

### 3. **update_candidates_timestamp**
- Similar al anterior pero para candidates

---

## 📊 Helper View

```sql
-- marketplace_campaigns_with_stats
-- Vista que combina campaigns + stats calculados
SELECT c.id, c.name, COUNT(m.id) as total, ...
FROM marketplace_campaigns c
LEFT JOIN marketplace_candidates m ON c.id = m.campaign_id
GROUP BY c.id
```

Uso en React:
```typescript
const { data: campaigns } = await supabase
  .from('marketplace_campaigns_with_stats')
  .select('*')
  .eq('user_id', userId);
```

---

## 🔧 Funciones SQL Útiles

### **update_campaign_stats(campaign_id)**
```sql
-- Manualmente recalcula los stats de una campaña
SELECT update_campaign_stats('123-uuid');
```

---

## 📝 Cómo Persistir en React

### Cargar campañas:
```typescript
const [campaigns, setCampaigns] = useState<Campaign[]>([]);

useEffect(() => {
  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from('marketplace_campaigns')
      .select('*')
      .eq('user_id', userId);
    
    if (data) setCampaigns(data);
  };
  
  loadCampaigns();
}, [userId]);
```

### Guardar nueva campaña:
```typescript
const handleCreateCampaign = async (campaign: Campaign) => {
  const { data, error } = await supabase
    .from('marketplace_campaigns')
    .insert([{
      id: campaign.id,
      name: campaign.name,
      platform: campaign.platform,
      search_terms: campaign.searchTerms,
      user_id: userId,
    }]);
  
  if (!error) {
    setCampaigns([...campaigns, campaign]);
  }
};
```

### Actualizar candidato (mover de carril):
```typescript
const handleUpdateCandidate = async (candidate: EnrichedCandidateInCampaign, newLane: string) => {
  const { error } = await supabase
    .from('marketplace_candidates')
    .update({ kanban_lane: newLane })
    .eq('id', candidate.candidateId);
  
  // El trigger automáticamente recalculará stats
};
```

### Eliminar campaña:
```typescript
const handleDeleteCampaign = async (campaignId: string) => {
  const { error } = await supabase
    .from('marketplace_campaigns')
    .delete()
    .eq('id', campaignId);
  
  // ON DELETE CASCADE eliminará automáticamente los candidates
};
```

---

## ✅ Status de Implementación

| Componente | Estado | Notas |
|-----------|--------|-------|
| UI Full-Screen | ✅ Hecho | Sin modal, layout completo |
| Left Sidebar | ✅ Hecho | Lista de campañas con stats |
| Campaign Cards | ✅ Hecho | Grid responsive |
| Dashboard Stats | ✅ Hecho | 5 stats en header |
| Pipeline View | ✅ Hecho | Default view |
| Kanban View | ✅ Hecho | Drag-and-drop |
| SQL Schema | ✅ Creado | marketplace_schema.sql |
| RLS Policies | ✅ Creadas | Multi-tenant ready |
| Triggers | ✅ Configurados | Auto-update stats |
| React Integration | ⏳ Pendiente | Conectar a Supabase |

---

## 🚀 Próximos Pasos

1. **Conectar Supabase** en React:
   - Inicializar cliente Supabase
   - Cargar campañas en useEffect
   - Reemplazar useState local con datos de BD

2. **Real-time Sync** (Opcional):
   - Subscribirse a cambios en tiempo real
   - Auto-refresh cuando otro usuario edita

3. **Exportar CSV**:
   - Filtrar por fecha
   - Descargar con botón en Pipeline

4. **Búsqueda/Scraping** (Futuro):
   - Integrar Apify o API scraping
   - Llenar tabla de candidates automáticamente

---

## 📌 Notas Importantes

- **JSONB search_terms**: Permite flexibilidad para diferentes plataformas sin alterar schema
- **Cascading deletes**: Eliminar campaign → automáticamente elimina sus candidates
- **RLS obligatorio**: Aunque uses auth, activa RLS para máxima seguridad
- **Timestamps**: `created_at` y `updated_at` se manejan automáticamente con triggers
