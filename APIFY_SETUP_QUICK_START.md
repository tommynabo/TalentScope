# 🚀 SETUP RÁPIDO: Actor IDs en Base de Datos

## ✅ Qué se ha hecho

He solucionado el problema del error "No se encontraron candidatos" moviendo la configuración de Actor IDs de Apify **de variables de entorno a la base de datos Supabase**.

### Cambios realizados:
1. ✅ Creada tabla `apify_config` en Supabase para almacenar Actor IDs
2. ✅ Creado `ApifyConfigService` para acceder a la BD
3. ✅ Actualizado `ApifyService` para leer desde BD
4. ✅ Actualizado `MarketplaceRaidService` para pasar parámetros de Supabase
5. ✅ Actualizado `CampaignDashboard` para inicializar correctamente
6. ✅ Mensajes de error mejorados que apuntan a la solución

---

## 🎯 Próximos pasos (3 pasos simples)

### Paso 1: Ejecutar la migración SQL (1 minuto)

```bash
# Abre Supabase → Tu proyecto → SQL Editor
# Copia y pega el contenido de:
supabase/apify_config_setup.sql
# Haz click en "Execute"
```

### Paso 2: Obtener tus Actor IDs reales de Apify (5 minutos)

1. Ve a https://apify.com/store
2. Busca un scraper de **Upwork** (ej: `powerai/upwork-talent-search-scraper`)
3. Busca un scraper de **Fiverr** (ej: `newpo/fiverr-scraper`)
4. Anota los Actor IDs

### Paso 3: Actualizar los Actor IDs en BD (1 minuto)

```bash
# Abre Supabase → SQL Editor nuevamente
# Copia el contenido de:
supabase/UPDATE_APIFY_ACTOR_IDS.sql
# Reemplaza los valores por defecto con tus Actor IDs reales
# Haz click en "Execute"
```

**Ejemplo:**
```sql
-- Cambiar esto:
UPDATE public.apify_config 
SET actor_id = 'powerai/upwork-talent-search-scraper'  -- Tu Actor ID aquí
WHERE config_key = 'upwork_scraper';
```

---

## ✅ Verificar que funciona

1. Abre TalentScope en tu navegador
2. Ve a **Marketplace** > **Campaigns**
3. Intenta buscar candidatos en **Upwork**
4. Los logs deberían:
   - ✅ Persistir (no limpiarse automáticamente)
   - ✅ Mostrar que Actor IDs están en BD
   - ✅ Iniciar búsqueda correctamente

---

## 📚 Documentación Completa

Para instrucciones detalladas, lee:
- [`SistemaMarketplace/APIFY_ACTOR_ID_SETUP.md`](./SistemaMarketplace/APIFY_ACTOR_ID_SETUP.md) - Guía completa con más opciones
- [`supabase/apify_config_setup.sql`](./supabase/apify_config_setup.sql) - Script de creación de tablas
- [`supabase/UPDATE_APIFY_ACTOR_IDS.sql`](./supabase/UPDATE_APIFY_ACTOR_IDS.sql) - Script para actualizar valores

---

## 🚨 Si algo no funciona

**Problema: "No se encontraron candidatos"**
```sql
-- Verifica en Supabase que los Actor IDs estén guardados:
SELECT * FROM public.apify_config_active;
```

**Problema: "Error de conexión a Supabase"**
- Verifica `.env`: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- Recarga el navegador (Ctrl+F5 si es Firefox, Cmd+Shift+R si es Mac)

**Problema: Los logs se siguen limpiando**
- Esto era un bug de la versión anterior
- Con esta actualización está solucionado
- Si persiste: abre consola del navegador (F12) y busca errores

---

## 💡 Ventajas del nuevo sistema

✅ **No necesitas .env**: Los Actor IDs están en BD
✅ **Actualización SIN redeploy**: Cambia valores en Supabase al instante
✅ **Escalable**: Prepara el sistema para múltiples plataformas
✅ **Seguro**: RLS policies en Supabase
✅ **Cacheado**: Rendimiento optimizado

---

## 📞 ¿Necesitas ayuda?

Si tienes dudas:
1. Lee la documentación en `SistemaMarketplace/APIFY_ACTOR_ID_SETUP.md`
2. Revisa los errores en la consola del navegador (F12)
3. Verifica que la tabla `apify_config` existe en Supabase

**¡Listo para empezar! 🎉**
