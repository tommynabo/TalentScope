# ✅ CHECKLIST DE IMPLEMENTACIÓN

## 🎯 Tu objetivo: Solucionar el error "No se encontraron candidatos"

Este checklist te guiará paso a paso. Marca cada elemento cuando lo completes.

---

## FASE 1: Preparación (5 minutos)

- [ ] **Leer resumen rápido**: `APIFY_SETUP_QUICK_START.md`
- [ ] **Entender la arquitectura**: `APIFY_ARCHITECTURE_DIAGRAM.md` (opcional pero recomendado)
- [ ] **Acceso a Supabase**: Abre https://app.supabase.com con tu cuenta
- [ ] **Verificar credenciales**: Confirma que `.env` tiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

---

## FASE 2: Crear Tabla en Supabase (1-2 minutos)

- [ ] **Abrir SQL Editor**: 
  1. Ve a Supabase Dashboard
  2. Selecciona tu proyecto **TalentScope**
  3. Haz clic en **SQL Editor** (barra izquierda)

- [ ] **Ejecutar migración**:
  1. Abre el archivo: `supabase/apify_config_setup.sql`
  2. Copia TODO el contenido
  3. En Supabase SQL Editor, pega el código
  4. Haz clic en **Execute** (botón azul arriba a la derecha)
  5. Espera a que termine (verás "✅ SCHEMA CREATED SUCCESSFULLY")

- [ ] **Verificar la tabla se creó**:
  ```sql
  SELECT COUNT(*) FROM public.apify_config;
  -- Debe devolver algo como: count = 3
  ```

---

## FASE 3: Obtener tus Actor IDs de Apify (5-10 minutos)

- [ ] **Buscar un scraper de Upwork**:
  1. Ve a https://apify.com/store
  2. Haz login con tu cuenta de Apify
  3. En el buscador, escribe "upwork" o "freelance"
  4. Selecciona un actor que tenga buenas reviews (⭐⭐⭐⭐+)
  5. Ejemplo: `powerai/upwork-talent-search-scraper`
  6. **Anota el Actor ID completo**
  7. Si no tiene Actor ID visible, busca "actor ID" en la página

- [ ] **Buscar un scraper de Fiverr**:
  1. En https://apify.com/store
  2. Haz clic en el que encontraste previamente
  3. En buscador, escribe "fiverr"
  4. Selecciona uno con buenas reviews
  5. Ejemplo: `newpo/fiverr-scraper`
  6. **Anota este Actor ID también**

- [ ] **Verificar que funcionen** (opcional pero recomendado):
  1. En cada página de actor, hace clic en "See live results" o "Test"
  2. Asegúrate de que el actor corre sin errores
  3. Tu cuenta de Apify debe tener créditos suficientes

**Guardados:**
```
Actor ID Upwork: _________________________________
Actor ID Fiverr: _________________________________
```

---

## FASE 4: Guardar Actor IDs en Supabase (1-2 minutos)

### Opción A: Usar SQL (Recomendado si no entienden bien SQL)

- [ ] **Abrir archivo de actualización**:
  1. En VS Code, abre: `supabase/UPDATE_APIFY_ACTOR_IDS.sql`
  2. En la línea ~10, busca: `'powerai/upwork-talent-search-scraper'`
  3. Reemplaza con tu Actor ID real de Upwork
  4. En la línea ~17, busca: `'newpo/fiverr-scraper'`
  5. Reemplaza con tu Actor ID real de Fiverr

- [ ] **Ejecutar en Supabase SQL Editor**:
  1. Selecciona y copia el código actualizado
  2. Vuelve a Supabase → SQL Editor
  3. Pega el código
  4. Haz clic en **Execute**

- [ ] **Verificar cambios guardados**:
  ```sql
  SELECT config_key, platform, actor_id FROM public.apify_config_active;
  ```
  Debería mostrar tus Actor IDs nuevos.

### Opción B: SQL directo (Si prefieres escribir SQL)

- [ ] **Ejecutar en SQL Editor**:
  ```sql
  UPDATE public.apify_config 
  SET actor_id = 'TU_ACTOR_ID_UPWORK_AQUI'
  WHERE config_key = 'upwork_scraper';

  UPDATE public.apify_config 
  SET actor_id = 'TU_ACTOR_ID_FIVERR_AQUI'
  WHERE config_key = 'fiverr_scraper';

  -- Verificar
  SELECT * FROM apify_config_active;
  ```

---

## FASE 5: Probar en la Aplicación (5-10 minutos)

- [ ] **Actualizar código en local** (si no está ya):
  - El código ya está actualizado si seguiste mis instrucciones
  - Si necesitas forcible, en terminal:
    ```bash
    cd /Users/tomas/Downloads/DOCUMENTOS/TalentScope
    git status  # Para ver cambios
    ```

- [ ] **Reiniciar la aplicación**:
  1. Si estaba corriendo, detén el servidor (Ctrl+C en terminal)
  2. Limpia caché del navegador (Ctrl+F5)
  3. Reinicia: `npm run dev` (o tu comando habitual)
  4. Abre http://localhost:5173 (o donde esté tu app)

- [ ] **Navegar a Marketplace**:
  1. En la interfaz, busca la sección **Marketplace** o **Campaigns**
  2. Si no la ves, asegúrate que estás logueado

- [ ] **Hacer una búsqueda de prueba**:
  1. Crea una campaña (o selecciona una existente)
  2. Haz clic en **Buscar** o **Search**
  3. Configura:
     - Plataforma: **Upwork**
     - Palabra clave: `python` (simple)
     - Otras opciones: pvalores por defecto
  4. Haz clic en **Iniciar búsqueda**

- [ ] **Observar los logs**:
  - ✅ Los logs debería ser persistentes (NO limpios automáticamente)
  - ✅ Debería ver: "✅ APIFY CONECTADO - SCRAPING EN VIVO"
  - ✅ Debería ver: "📊 FASE 1: Scraping en UPWORK..."
  - ✅ Debería ver candidatos encontrados o error específico

- [ ] **Si hay error**, revisar**:
  - Si dice "No se encontraron candidatos":
    1. Abre Supabase y verifica los Actor IDs:
       ```sql
       SELECT * FROM apify_config_active WHERE platform = 'Upwork';
       ```
    2. Los Actor IDs deben estar exactitud correctos
    3. Probablemente tu cuenta de Apify tiene creditos agotados
    
  - Si dice "Error de conexión":
    1. Verifica `.env` tiene los parámetros de Supabase
    2. Recarga la página (Ctrl+F5)

---

## FASE 6: Validar Todo Funciona (2 minutos)

- [ ] **Confirmación Visual**:
  - [ ] Los logs aparecen y NO se limpian automáticamente
  - [ ] Ves mensaje de "APIFY CONECTADO"
  - [ ] Se muestran candidatos O un error específico
  - [ ] El error que ves es "No créditos" o algo similar (NO "Actor ID no configurado")

- [ ] **Validación en BD** (opcional):
  ```sql
  -- Ejecuta en Supabase SQL Editor:
  SELECT 
    config_key,
    actor_id,
    status,
    updated_at
  FROM public.apify_config 
  WHERE status = 'active';
  ```
  Verifica que tus Actor IDs están guardados.

---

## FASE 7: Documentación para Futuro (Recomendado)

- [ ] **Guardar en un lugar seguro**:
  - Anota tus Actor IDs de Apify en un documento seguro
  - Ten de respaldo en caso que necesites restaurar

- [ ] **Leer documentación completa** (opcional):
  - [ ] `SistemaMarketplace/APIFY_ACTOR_ID_SETUP.md` - Guía completa
  - [ ] `APIFY_ARCHITECTURE_DIAGRAM.md` - Entender cómo funciona
  - [ ] `CHANGES_SUMMARY.md` - Ver todos los cambios realizados

---

## 🚨 TROUBLESHOOTING RÁPIDO

### ❌ "No se encontraron candidatos"
```sql
-- En Supabase SQL Editor, verifica:
SELECT * FROM apify_config_active;
-- Los actor_id deben ser correctos y no vacíos

-- Si no ves nada, ejecuta nuevamente:
supabase/UPDATE_APIFY_ACTOR_IDS.sql
```

### ❌ "Error de conexión a Supabase"
- Verifica `.env`: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- Recarga el navegador (Ctrl+F5)
- Abre la consola (F12) y busca errores

### ❌ "Tabla apify_config no existe"
- Vuelve a ejecutar `supabase/apify_config_setup.sql` en SQL Editor
- Verifica no haya errores en la ejecución

### ❌ "Los logs se siguen limpiando"
- Esto era un bug de la versión anterior
- Con tus cambios, debe estar solucionado
- Si persiste, abre consola (F12) y busca errores JavaScript

---

## ✅ CHECKLIST FINAL

- [ ] Migración SQL ejecutada sin errores
- [ ] Tabla `apify_config` visible en Supabase
- [ ] Actor IDs reales (de Apify Store) guardados en BD
- [ ] Aplicación reiniciada y caché limpiado
- [ ] Búsqueda en Upwork/Fiverr funciona
- [ ] Logs son persistentes (no se limpian)
- [ ] Se muestra "APIFY CONECTADO" o similar
- [ ] Candidatos encontrados o error específico (NO "Actor ID no configurado")

---

## 🎉 ¡COMPLETADO!

Si todas las casillas están marcadas, **¡Has solucionado el problema exitosamente!**

### Próximos pasos opcionales:
1. Crear un panel de administración para cambiar Actor IDs desde UI
2. Agregar más plataformas (LinkedIn, Indeed, etc.)
3. Implementar validación automática de Actor IDs
4. Agregar registro de auditoría de cambios

---

## 📞 ¿NECESITAS AYUDA?

Si algo no funciona después de completar este checklist:

1. **Verifica los logs del navegador** (F12 → Console)
2. **Lee la documentación**:
   - `SistemaMarketplace/APIFY_ACTOR_ID_SETUP.md`
   - `APIFY_ARCHITECTURE_DIAGRAM.md`
3. **Revisa Supabase** para confirmar datos guardados correctamente
4. **Busca errores específicos** en la consola

---

**¡Buena suerte! 🚀**

Última actualización: 20 Febrero 2026
