# 🔧 WALEAD MESSAGES - GUÍA DE SETUP

## El tercer mensaje (SEGUIMIENTO) no aparece - SOLUCIÓN COMPLETA

He investigado y hecho todos los cambios necesarios. Aquí está lo que falta y cómo completarlo:

---

## ✅ LO QUE YA ESTÁ HECHO:

1. **SearchEngine.ts** - Genera los 3 mensajes con OpenAI
2. **WaleadMessagesEditor.tsx** - Editor modal para los 3 mensajes
3. **DetailView.tsx** - Muestra los 3 mensajes (icebreaker, followup, second_followup)
4. **CSV Export** - Exporta las 3 columnas Walead

---

## ⚠️ LO QUE NECESITAS HACER:

### PASO 1: Ejecutar SQL en Supabase

Esto es CRÍTICO - sin esto no se guardarán los mensajes editados.

1. Ve a tu **Supabase Dashboard** → Tu Proyecto → **SQL Editor**
2. Click en **"New Query"**
3. Copia y pega TODO esto:

```sql
-- Agregar columna para guardar mensajes editados
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS walead_messages JSONB DEFAULT NULL;

-- Crear índice para mejor performance
CREATE INDEX IF NOT EXISTS idx_candidates_walead_messages 
ON candidates USING GIN (walead_messages);

-- Permitir actualizaciones
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enable_update_candidates" ON candidates;
CREATE POLICY "enable_update_candidates" ON candidates
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

4. Click **"Run"** (Ctrl/Cmd + Enter)
5. Espera a que diga ✅ "Success"

---

### PASO 2: Verificar en tu App

1. **Refresh** la app en el navegador (Ctrl+Shift+R o Cmd+Shift+R)
2. Haz una **búsqueda de candidatos** en LinkedIn
3. Cuando salgan los resultados, **clica en "Ver"** o expande un candidato
4. Deberías ver:
   - 🔵 1️⃣ INVITACIÓN INICIAL (azul)
   - 🟢 2️⃣ POST-ACEPTACIÓN (verde)
   - 🟣 3️⃣ SEGUIMIENTO (púrpura) ← **Este era el que faltaba**

5. Click en **"Editar Mensajes"** (botón azul arriba de los 3 campos)
6. Deberían verse los 3 campos para editar
7. Edit el que quieras y click **"Guardar Cambios"**
8. Debería aparecer ✅ "Mensajes guardados correctamente"

---

### PASO 3: Verificar en CSV

1. Haz click en **"Exportar a CSV"**
2. Selecciona rango de fechas
3. Abre el CSV descargado en Excel
4. Las columnas activas deben ser (13 en total):
   - FIRST_NAME
   - LAST_NAME
   - ROL
   - EMPRESA
   - EMAIL
   - LINKEDIN
   - SCORE
   - **INVITACION_INICIAL** ← Mensaje 1
   - **POST_ACEPTACION** ← Mensaje 2
   - **SEGUIMIENTO** ← Mensaje 3 (si lo editaste, sale el editado; si no, el generado por IA)
   - ANALISIS
   - STATUS
   - FECHA

---

## 🐛 SI SIGUE SIN FUNCIONAR:

### Opción A: Limpiar Browser Cache
```
1. Ctrl+Shift+Delete (Windows) o Cmd+Shift+Delete (Mac)
2. Selecciona "Todo" y "Borrar datos"
3. Refresh la página
```

### Opción B: Verificar en DevTools
```
1. F12 (Abre DevTools)
2. Console tab
3. Busca cualquier error rojo (error guardar, parsing, etc.)
4. Comparte el error conmigo
```

### Opción C: Verificar columna en Supabase
```
1. Supabase Dashboard → Table Editor
2. Abre tabla "candidates"
3. Scroll right - deberías ver columna "walead_messages"
4. Comprueba que sea de tipo "jsonb"
```

---

## 📋 CHECKLIST FINAL

- [ ] Ejecuté el SQL en Supabase
- [ ] El comando terminó con "Success"
- [ ] Hice refresh de la app (Ctrl+Shift+R)
- [ ] Busqué candidatos
- [ ] Veo el botón "Editar Mensajes"
- [ ] Puedo ver los 3 campos en el editor (icebreaker, followup, second_followup)
- [ ] Los mensajes se guardan sin errores
- [ ] El CSV exporta las 3 columnas Walead

---

## 🚀 PRÓXIMOS PASOS (cuando todo funcione):

1. Los mensajes editados se guardan automaticamente en la BD
2. Puedes reutilizar/refinar mensajes en futuras búsquedas
3. El CSV siempre exporta los mensajes editados si existen, sino los generados por IA

---

**Si algo no funciona, mándame screenshot del error en DevTools (F12 → Console)**
