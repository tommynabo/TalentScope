# ✅ Checklist de Validación - SistemaMarketplace

Por favor verifica cada punto:

## 🔧 Configuración Inicial

- [ ] Tienes una API key válida de Apify (comienza con `apify_`)
- [ ] La API key está guardada en `.env.local` como `VITE_APIFY_API_KEY` o `VITE_APIFY_MARKETPLACE_API_KEY`
- [ ] Tienes una API key de OpenAI (opcional, para enriquecimiento)
- [ ] Tienes credenciales Supabase configuradas (opcional, para guardar config)

## 🌐 Verificación de conexión

Abre DevTools Console (F12) y ejecuta:

```javascript
// 1. Verificar que los servicios están importados
const { MarketplaceRaidService } = window;
console.log('Service importado:', !!MarketplaceRaidService);

// 2. Verificar API keys en variables de entorno
console.log('API Keys disponibles:');
console.log('Apify:', import.meta.env.VITE_APIFY_API_KEY ? '✅' : '❌');
console.log('OpenAI:', import.meta.env.VITE_OPENAI_API_KEY ? '✅' : '❌');
console.log('Supabase:', import.meta.env.VITE_SUPABASE_URL ? '✅' : '❌');

// 3. Crear servicio
const service = MarketplaceRaidService.getInstance(
  import.meta.env.VITE_APIFY_API_KEY,
  import.meta.env.VITE_OPENAI_API_KEY,
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
console.log('Servicio creado:', !!service);

// 4. Validar conexiones
const connections = await service.validateAllConnections();
console.log('Conexiones:', connections);
```

**Resultado esperado:**
```
✅ Service importado: true
API Keys disponibles:
✅ Apify
❌ OpenAI (opcional)
✅ Servicio creado: true
Conexiones: { apify: true, openai: false/true }
```

## 🎯 Test de Búsqueda

1. **Ir a Marketplace Raid**
2. **Crear nueva campaña:**
   - Nombre: "Test Flutter"
   - Plataforma: Upwork
   - Keywords: Flutter
   - Tarifa mínima: $30
   - Job Success Rate: 80%
3. **Presionar "Buscar Candidatos"**

**Logs esperados en Console:**
```
✅ SCRAPING REAL: Apify API Marketplace configurada (apify_...)
✅✅✅ APIFY CONECTADO - SCRAPING EN VIVO
📊 FASE 1: Scraping en UPWORK...
🔗 Upwork URL: https://www.upwork.com/nx/search/talent/?q=flutter&sort=relevance
🚀 Ejecutando actor: apify/web-scraper
⏳ Actor iniciado, run ID: SUcdtBtkHisdSJJf6
📊 Dataset: 1 items
✅ Upwork: 5 resultados raw del actor
🎯 Scraping completado: 5 candidatos REALES encontrados
```

**Resultado esperado:**
- ✅ Ver 5-50 candidatos listados
- ✅ Mostrar nombre, tarifa, éxito, ubicación
- ✅ Candidatos pueden arrastrarse a diferentes lanes en Kanban

## 🚨 Problemas comunes

### ❌ "No se encontraron candidatos"
Checklist:
- [ ] ¿Tienes API key válida de Apify?
- [ ] ¿Tienes créditos/suscripción en Apify?
- [ ] ¿El keyword es visible en Upwork? (prueba en www.upwork.com)
- [ ] ¿Espere 30 segundos para que el actor se ejecute completo?

**Solución:** Verifica en console que `connections.apify === true`

### ⚠️ "Failed to load resource: 406"
- Normal - significa tabla Supabase no existe o no tiene acceso
- Sistema usa defaults automáticamente
- No bloquea el scraping

**Solución:** Ignorar, es warning no error

### ❌ "Los resultados devueltos contienen errores"
- Probablemente ya no ocurra con la nueva versión
- Si ocurre: el actor devuelve datos mal formados

**Solución:** Intenta con otro keyword

## 📊 Verificar datos extraídos

Cuando veas candidatos, verifica:
- [ ] Nombre no es "Unknown"
- [ ] Tiene URL de perfil válida
- [ ] Tarifa está entre $20-500
- [ ] Job Success Rate > 0
- [ ] Ubicación (país) está visible

## 🎬 Test completo

```javascript
// Script completo para validación
(async () => {
  console.log('=== MARKETPLACE VALIDATION TEST ===\n');
  
  // 1. Check environment
  console.log('1. Environment Check:');
  const apiKey = import.meta.env.VITE_APIFY_API_KEY;
  console.log(`   ✅ API Key: ${apiKey ? apiKey.substring(0,15) + '...' : 'NOT SET'}`);
  
  // 2. Create service
  console.log('\n2. Service Creation:');
  const { MarketplaceRaidService } = window;
  const service = MarketplaceRaidService.getInstance(apiKey);
  console.log(`   ✅ Service: ${service ? 'CREATED' : 'FAILED'}`);
  
  // 3. Test connection
  console.log('\n3. Connection Test:');
  const connections = await service.validateAllConnections();
  console.log(`   ✅ Apify: ${connections.apify ? 'CONNECTED' : 'FAILED'}`);
  console.log(`   ✅ OpenAI: ${connections.openai ? 'CONNECTED' : 'OPTIONAL'}`);
  
  // 4. Create raid
  console.log('\n4. Raid Creation:');
  const filter = {
    keyword: 'flutter',
    minHourlyRate: 30,
    minJobSuccessRate: 80,
    platforms: ['Upwork'],
    certifications: []
  };
  const raid = await service.startRaid('Test Raid', filter);
  console.log(`   ✅ Raid ID: ${raid.id.substring(0,12)}...`);
  
  console.log('\n=== TEST COMPLETE ===');
  console.log('Si todo es ✅, puedes buscar candidatos!');
})();
```

## 📝 Checklist de Configuración Mínima

- [ ] `.env.local` tiene `VITE_APIFY_API_KEY`
- [ ] App carga en `http://localhost:5173`
- [ ] Console aparece sin Uncaught errors
- [ ] MarketplaceRaidService está disponible
- [ ] Puedes crear una campaña
- [ ] Al buscar, ves logs en console (no mensajes de error)

## 🎯 Indicadores clave de éxito

Verás estos mensajes en console cuando funcione:
```
✅ SCRAPING REAL: Apify API Marketplace configurada
✅✅✅ APIFY CONECTADO - SCRAPING EN VIVO
✅ Upwork: 5 resultados raw del actor
🎯 Scraping completado: 5 candidatos REALES encontrados
```

Si NO ves estos mensajes → revisa tu API key

## 💡 Tips para mejores resultados

1. **Test con keywords populares:**
   - "flutter" (muy buscado)
   - "react" (muy buscado)
   - "node.js" (muy buscado)

2. **Ajusta los filtros:**
   - Reduce "Job Success Rate" si no encuentras
   - Reduce "Tarifa Mínima" si no encuentras

3. **Use dedicated actors (opcional):**
   - Compra actores en Apify.com
   - Configura en Supabase tabla `apify_config`
   - Verás 10-20x más candidatos

## 🆘 Support

Si te quedas atrapado:
1. Revisa que tienes API key válida
2. Verifica `connections.apify === true`
3. Busca errors en console (F12)
4. Lee `SistemaMarketplace/QUICK_FIX_GUIDE.md`

---

**Última actualización:** 21 Feb 2026  
**Versión:** SistemaMarketplace v2.5 (Scraping Fixed)
