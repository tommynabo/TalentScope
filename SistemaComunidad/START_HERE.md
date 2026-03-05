# ⚡ 5 MINUTOS SUMMARY - QUÉ HACER AHORA

> Lee esto en 5 minutos. Después sabrás exactamente qué hacer.

---

## 🎯 Lo que está hecho (100%)

✅ **Motor de extracción OSINT** - Apify busca emails y LinkedIn  
✅ **Botones en la UI** - "Extraer Email/LinkedIn" + "+ Candidatos"  
✅ **Sincronización automática** - Después de extraer, se sinc a Gmail  
✅ **Fallback en Gmail** - Si vista SQL falla, consulta BD directo  
✅ **Vista unificada** - SQL que une LinkedIn + GitHub + Marketplace + Community  
✅ **Documentación completa** - Guías, checklist, test scripts  

---

## 🚀 Lo que necesitas hacer (3 pasos, 10 minutos)

### PASO 1: Ve a Supabase (2 minutos)

1. Abre: https://app.supabase.com
2. Entra a tu proyecto TalentScope
3. Click: **SQL Editor** (icono `{}` izquierda)
4. Click: **New Query**

### PASO 2: Ejecuta el SQL (5 minutos)

**En tu navegador:**

1. Abre archivo: `supabase/update_global_email_view.sql`
2. Copia TODO el contenido
3. En Supabase, pega en el editor
4. Click: **Run** (abajo a la derecha)

**Qué hace:** Crea vista que unifica todos los candidatos con email de 4 fuentes

### PASO 3: Ejecuta setup final (3 minutos)

**En tu navegador:**

1. Abre archivo: `supabase/community_setup_final.sql`
2. Copia TODO el contenido
3. En Supabase, nueva query, pega
4. Click: **Run**

**Qué hace:** Verifica estructura, crea índices, configura seguridad

---

## ✅ Verificar que funciona (1 minuto)

En Supabase SQL Editor, ejecuta esto:

```sql
SELECT COUNT(*) as candidatos_comunidad
FROM global_email_candidates
WHERE source_platform IN ('Discord', 'Reddit', 'Skool');
```

**Si devuelve > 0:** ¡Todo funciona! ✨

**Si devuelve 0:** Es normal, significa que aún no hay candidatos con email extraído.

---

## 🧪 Probar en la UI (2 minutos)

1. Abre: **SistemaComunidad** en tu app
2. Crea/abre una **campaña**
3. Busca **candidatos** (o scrollea)
4. **Expande** uno haciendo click
5. Click botón: **"Extraer Email/LinkedIn"**
6. Espera 30-60 segundos (spinner animado)
7. Verás mensaje: **"✨ Email/LinkedIn extraído y sincronizado"**
8. Abre **Gmail > Buzones > Candidatos**
9. ¡Debería estar allí! 🎉

---

## 📁 Archivos Clave

**NUEVOS (Creados):**
- `SistemaComunidad/lib/communityCandidateSyncService.ts` ← Motor sync
- `SistemaComunidad/IMPLEMENTATION_GUIDE.md` ← Guía paso a paso
- `supabase/community_setup_final.sql` ← SQL con validaciones
- `test-community-enrichment.ts` ← Script de test

**ACTUALIZADOS:**
- `SistemaComunidad/components/CommunityCandidatesPipeline.tsx` ← Nuevo botón + auto-sync
- `lib/gmailCandidatesService.ts` ← Fallback para comunidades

---

## 🎯 Después de esto

### ¿Qué puedes hacer?

1. **Extraer emails** de candidatos Discord/Reddit/Skool
2. **Enviar emails automáticos** vía Gmail a candidatos
3. **Trackear opens/clicks** de tus emails
4. **A/B test** diferentes secuencias

---

## 🆘 Si algo falla

| Problema | Solución |
|----------|----------|
| "El botón no funciona" | Verifica console (F12) para ver error |
| "No aparece en Gmail" | Recarga la página, o ejecuta SQL de nuevo |
| "¿Dónde está el botón +?" | Solo aparece si el candidato tiene email |
| "Mi email no fue extraído" | Algunos usuarios tienen perfil privado (normal) |

---

## 📚 Para más info

- `SistemaComunidad/README.md` - Overview del sistema
- `SistemaComunidad/IMPLEMENTATION_GUIDE.md` - Guía detallada
- `SistemaComunidad/COMPLETION_SUMMARY.md` - Resumen técnico
- `SistemaComunidad/ARCHITECTURE_VISUAL_FLOW.md` - Diagrama visual

---

## ✨ Resumen en 1 línea

> **Tu sistema de comunidades ahora automáticamente extrae emails/LinkedIn de candidatos Discord/Reddit y los sincroniza a Gmail para outreach automático.**

---

## 🎉 ¿Listo?

```
1. Ve a Supabase
2. Ejecuta 2 scripts SQL (5 min)
3. Prueba en la UI
4. ¡Extrae candidatos y envía emails!
```

**Tiempo total:** ~15 minutos setup + uso inmediato

---

**¿Preguntas?** Ver archivos de documentación arriba.
