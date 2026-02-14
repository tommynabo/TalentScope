# Plan de Implementación: Optimización de Calidad de Leads para Walead v1.0

## 1. Contexto y Análisis del Problema
**Problema:** Al exportar leads desde TalentScope e importarlos en Walead (https://app.walead.ai/), un porcentaje significativo de contactos es rechazado silenciosamente.
**Causa Identificada:** Walead tiene validaciones estrictas sobre el formato de la URL de LinkedIn. Específicamente, las URLs con subdominios regionales (ej. `es.linkedin.com`, `fr.linkedin.com`) causan fallos en la importación.
**Impacto:** Pérdida de oportunidades de venta (de 3 leads, solo 1 se importa correctamente en las pruebas del usuario).

## 2. Estrategia de Solución
El objetivo es asegurar que **el 100% de los leads exportados** cumplan con el formato canónico que espera Walead. Se implementará una capa de normalización y validación "pre-vuelo" (antes de exportar).

### Estándar Objetivo (Canonical URL)
Walead (y la mayoría de CRMs) esperan este formato exacto:
`https://www.linkedin.com/in/username/`

**Lo que debemos corregir automáticamente:**
| Formato Incorrecto (Actual) | Formato Correcto (Destino) |
|-----------------------------|----------------------------|
| `https://es.linkedin.com/in/juan-perez` | `https://www.linkedin.com/in/juan-perez` |
| `http://linkedin.com/in/juan-perez` | `https://www.linkedin.com/in/juan-perez` |
| `linkedin.com/in/juan-perez/` | `https://www.linkedin.com/in/juan-perez` |
| `https://www.linkedin.com/in/juan-perez?originalSubdomain=es` | `https://www.linkedin.com/in/juan-perez` |

## 3. Plan Técnico Paso a Paso

### Fase 1: Creación de utilidad de Normalización (Utilities)
Crear una función robusta `normalizeLinkedInUrl` que sea capaz de sanear cualquier input.

**Lógica propuesta:**
1. **Forzar Protocolo:** Asegurar `https://`.
2. **Estandarizar Subdominio:** Reemplazar cualquier subdominio de 2 letras (es, fr, de, etc.) o la ausencia de él por `www`.
3. **Limpiar Query Params:** Eliminar todo después de `?`.
4. **Validación de Estructura:** Verificar que contenga `/in/`.
5. **Formateo Final:** Eliminar slashes finales redundantes si es necesario (aunque `/` final es estándar, mejor consistencia).

### Fase 2: Implementación en Exportación (Hotfix Inmediato)
Modificar `LeadsTable.tsx` donde ocurre la función `exportToCSV`.
- Inyectar la función de normalización justo antes de generar el CSV.
- **Beneficio:** Corrección inmediata sin tocar la base de datos histórica.

### Fase 3: Implementación en Ingesta (Mejora Permanente)
Modificar `SearchService.ts` y `SearchEngine.ts`.
- Aplicar la normalización en el momento que se detecta el lead (scraping).
- **Beneficio:** La base de datos (Supabase) empezará a llenarse solo con datos limpios y correctos.

## 4. Validaciones de Calidad (Checklist)

Para asegurar que la importación en Walead sea exitosa, el CSV debe cumplir:

- [ ] **Columna LinkedIn:** Todas las URLs deben empezar por `https://www.linkedin.com/in/`.
- [ ] **Sin Duplicados:** Asegurar que no exportamos el mismo perfil dos veces (ya manejado por `DeduplicationService` pero verificar).
- [ ] **Caracteres Especiales:** Nombres con tildes o caracteres raros deben estar bien codificados (UTF-8 con BOM `\ufeff` ya está implementado, mantenerlo).

## 5. Próximos Pasos (Acción Requerida)

1.  **Aprobar este plan.**
2.  **Ejecución:**
    - Crear archivo `lib/normalization.ts` con la lógica de limpieza.
    - Integrarlo en `LeadsTable.tsx` para solucionar el problema hoy mismo.
    - Integrarlo en `SearchService.ts` para arreglar los futuros leads.
