# 🔑 Configuración: 2 Claves Apify Diferentes

## ¿Por Qué 2 Claves?

Es una **EXCELENTE PRÁCTICA** tener claves separadas:

| Beneficio | Descripción |
|-----------|-------------|
| 🔒 **Seguridad** | Si una clave se compromete, solo ese sistema se ve afectado |
| 💰 **Control de Gasto** | Rastrear cuánto dinero consume cada sistema |
| ⚡ **Rate Limits** | Cada clave tiene su propio límite de requests por minuto |
| 🔄 **Rotación Independiente** | Cambiar una sin afectar la otra |
| 📊 **Análisis Separado** | Dashboard de Apify muestra métricas por clave |

---

## ✅ Cómo Configurar

### PASO 1: Obtener 2 Claves de Apify

1. **Clave 1 - Para LinkedIn/GitHub:**
   - Ve a https://console.apify.com → Settings → Integrations
   - Copia tu API Token
   - Ejemplo: `apify_api_XXXXXXX_linkedin_github`

2. **Clave 2 - Para Marketplace (Upwork/Fiverr):**
   - Opción A: Usar la misma cuenta pero con una clave secundaria (menos común)
   - Opción B: Crear una segunda cuenta de Apify para mejor separación
   - Ejemplo: `apify_api_YYYYYYY_marketplace`

### PASO 2: Actualizar tu `.env`

```bash
# ✅ CLAVE PARA SISTEMAS LINKEDIN/GITHUB (búsquedas de talento)
VITE_APIFY_API_KEY=apify_api_XXXXXXX_linkedin_github

# ✅ CLAVE PARA MARKETPLACE (Upwork/Fiverr scraping)
VITE_APIFY_MARKETPLACE_API_KEY=apify_api_YYYYYYY_marketplace

# Las demás claves permanecen igual
VITE_OPENAI_API_KEY=sk-proj-...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJ...
```

### PASO 3: Listo ✅

El código está actualizado para:
- ✅ LinkedInSearchEngine usa `VITE_APIFY_API_KEY`
- ✅ ApifyService (Marketplace) usa `VITE_APIFY_MARKETPLACE_API_KEY`
- ✅ Si no existe `VITE_APIFY_MARKETPLACE_API_KEY`, automáticamente cae a `VITE_APIFY_API_KEY`

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│   Tu Aplicación TalentScope             │
├─────────────────────────────────────────┤
│                                         │
│  LinkedIn/GitHub Sistema                │
│  ├── LinkedInSearchEngine                │
│  └── USA: VITE_APIFY_API_KEY            │
│      (apify_api_XXXXXXX_linkedin)       │
│                                         │
│  Marketplace Sistema (Upwork/Fiverr)    │
│  ├── ApifyService                       │
│  └── USA: VITE_APIFY_MARKETPLACE_API_KEY│
│      (apify_api_YYYYYYY_marketplace)   │
│                                         │
└─────────────────────────────────────────┘
        ↓          ↓
     Apify API  Apify API
   (KEY 1)    (KEY 2)
```

---

## 🔍 Verificar que Funciona

### LinkedIn/GitHub

```typescript
// En LinkedInSearchEngine.ts
const apiKey = import.meta.env.VITE_APIFY_API_KEY;
console.log('LinkedIn usando:', apiKey.substring(0, 15));
```

### Marketplace

```typescript
// En CampaignDashboard.tsx
const apifyMarketplaceKey = import.meta.env.VITE_APIFY_MARKETPLACE_API_KEY 
                           || import.meta.env.VITE_APIFY_API_KEY;
console.log('Marketplace usando:', apifyMarketplaceKey.substring(0, 15));
```

---

## 📊 Dashboard de Apify

Cuando tengas 2 claves, en https://console.apify.com verás:

```
Account Overview

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Token: apify_api_XXXXXXX_linkedin_github
├── Spent this month: $50
├── Actors used: LinkedIn, GitHub Scrapers
└── Last used: 2h ago

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Token: apify_api_YYYYYYY_marketplace
├── Spent this month: $30
├── Actors used: nwtn/upwork, apify/web-scraper
└── Last used: 1h ago
```

---

## 🔄 Fallback Automático

El código está diseñado inteligentemente:

```typescript
// Si NO tienes VITE_APIFY_MARKETPLACE_API_KEY:
const apifyMarketplaceKey = import.meta.env.VITE_APIFY_MARKETPLACE_API_KEY 
                           || import.meta.env.VITE_APIFY_API_KEY;
                           // ↑ Usa esta si no existe la anterior

// Resultado: Funciona con UNA sola clave también
```

**Esto significa:**
- ✅ Si solo tienes 1 clave: todo funciona (ambos sistemas usan la misma)
- ✅ Si tienes 2 claves: cada sistema usa la suya
- ✅ Sin necesidad de cambiar código, solo `.env`

---

## 💡 Casos de Uso

### Caso 1: Una sola clave (Inicio)
```bash
VITE_APIFY_API_KEY=apify_api_XXXXXXX

# Ambos LinkedIn y Marketplace usan VITE_APIFY_API_KEY
```

### Caso 2: Dos claves (Producción)
```bash
VITE_APIFY_API_KEY=apify_api_XXXXXXX_linkedin
VITE_APIFY_MARKETPLACE_API_KEY=apify_api_YYYYYYY_marketplace

# LinkedIn usa VITE_APIFY_API_KEY
# Marketplace usa VITE_APIFY_MARKETPLACE_API_KEY
```

### Caso 3: Diferentes proveedores
```bash
VITE_APIFY_API_KEY=apify_api_XXXXXXX  # De cuenta Apify A

# Para Marketplace usas un scraper personalizado
# (en lugar de apify_api_YYYYYYY, podrías tener WebScraper API)
```

---

## 📈 Monitoreo Independiente

Con 2 claves, puedes ver en Apify Console:

**Clave 1 (LinkedIn/GitHub):**
- Consumo de creditos
- Actores usados
- Estadísticas de búsqueda

**Clave 2 (Marketplace):**
- Consumo separado
- Actores de scraping (Upwork, Fiverr)
- Estadísticas de marketplace

---

## ⚠️ Importante

1. **No expongas las claves** en control de versiones
2. **Usa `.env.local`** para desarrollo
3. **Usa variables de entorno** en producción
4. **Rota las claves regularmente** (mejor hacerlo por separado ahora)
5. **Monitorea el consumo** en cada clave

---

## 🔐 Seguridad: Rotación de Claves

Si una clave se compromete:

```bash
# ANTES: Todo el sistema afectado
VITE_APIFY_API_KEY=apify_api_COMPROMISED

# DESPUÉS: Solo Marketplace afectado
VITE_APIFY_API_KEY=apify_api_XXXXXXX_linkedin     # OK
VITE_APIFY_MARKETPLACE_API_KEY=apify_api_COMPROMISED  # Cambiar esto
```

Cambias solo la parte del Marketplace, sin afectar LinkedIn.

---

## ✨ Conclusión

- ✅ **Soportado**: Código actualizado para 2 claves
- ✅ **Flexible**: Fallback automático si falta una clave
- ✅ **Seguro**: Isolamiento de credenciales
- ✅ **Escalable**: Fácil agregar más claves en futuro

**Solo necesitas agregar `VITE_APIFY_MARKETPLACE_API_KEY` en tu `.env`**

---

**Última actualización:** 20 Febrero 2026
**Status:** ✅ Production Ready
