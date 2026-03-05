#!/bin/bash

# ============================================================================
# SISTEMA COMUNIDAD - CHECKLIST INTERACTIVO DE SETUP
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear

echo -e "${PURPLE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║       🚀 SISTEMA COMUNIDAD - SETUP FINAL CHECKLIST 🚀          ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Counter
COMPLETED=0
TOTAL=0

# Function to show checkbox
show_check() {
    local title=$1
    local description=$2
    
    TOTAL=$((TOTAL + 1))
    
    echo ""
    echo -e "${CYAN}[${TOTAL}]${NC} ${BLUE}${title}${NC}"
    echo "    └─ ${description}"
}

# Function to mark completed
mark_done() {
    echo -e "    ${GREEN}✅ HECHO${NC}"
    COMPLETED=$((COMPLETED + 1))
}

# Function to mark pending
mark_pending() {
    echo -e "    ${YELLOW}⏳ PENDENTE${NC}"
}

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}         SECCIÓN 1: CÓDIGO TYPESCRIPT ACTUALIZADO${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

show_check "Imports en CommunityCandidatesPipeline.tsx" \
          "CommunityCandidateSyncService debe estar importado"
echo "    Verificando..."
if grep -q "CommunityCandidateSyncService" "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/SistemaComunidad/components/CommunityCandidatesPipeline.tsx" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

show_check "Botón + Candidatos en UI" \
          "Debe aparecer cuando el candidato tiene email"
echo "    Verificando..."
if grep -q "\+ Candidatos" "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/SistemaComunidad/components/CommunityCandidatesPipeline.tsx" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

show_check "Auto-sync después de extracción" \
          "syncToGmailCandidates() debe llamarse en handleEnrichCandidate"
echo "    Verificando..."
if grep -q "syncToGmailCandidates" "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/SistemaComunidad/components/CommunityCandidatesPipeline.tsx" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

show_check "Fallback en gmailCandidatesService.ts" \
          "Debe consultar community_candidates como fallback"
echo "    Verificando..."
if grep -q "community_candidates" "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/lib/gmailCandidatesService.ts" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

show_check "CommunityCandidateSyncService creado" \
          "Nuevo archivo con lógica de sincronización"
echo "    Verificando..."
if test -f "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/SistemaComunidad/lib/communityCandidateSyncService.ts" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}              SECCIÓN 2: SCRIPTS SQL LISTOS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

show_check "update_global_email_view.sql existe" \
          "Vista global con 4 fuentes (LinkedIn + GitHub + Marketplace + Community)"
echo "    Verificando..."
if test -f "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/supabase/update_global_email_view.sql" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

show_check "community_setup_final.sql existe" \
          "Setup completo con índices, RLS, y verificaciones"
echo "    Verificando..."
if test -f "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/supabase/community_setup_final.sql" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

show_check "SQL incluye 4 UNION (LinkedIn + GitHub + Marketplace + Community)" \
          "La vista debe tener 4 ramas de UNION ALL"
echo "    Verificando..."
if grep -q "UNION ALL" "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/supabase/update_global_email_view.sql" 2>/dev/null && \
   grep -q "community_candidates" "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/supabase/update_global_email_view.sql" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}             SECCIÓN 3: DOCUMENTACIÓN COMPLETA${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

show_check "IMPLEMENTATION_GUIDE.md" \
          "Guía paso a paso para el usuario"
echo "    Verificando..."
if test -f "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/SistemaComunidad/IMPLEMENTATION_GUIDE.md" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

show_check "COMPLETION_SUMMARY.md" \
          "Resumen de lo que está hecho"
echo "    Verificando..."
if test -f "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/SistemaComunidad/COMPLETION_SUMMARY.md" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

show_check "test-community-enrichment.ts" \
          "Script de prueba para validar el flujo"
echo "    Verificando..."
if test -f "/Users/tomas/Downloads/DOCUMENTOS/TalentScope/test-community-enrichment.ts" 2>/dev/null; then
    mark_done
else
    mark_pending
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}          SECCIÓN 4: PASOS A EJECUTAR EN SUPABASE${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

show_check "Ejecutar update_global_email_view.sql" \
          "En Supabase > SQL Editor > New Query > Copy/Paste > Run"
echo ""
echo -e "    ${CYAN}1. Ve a: https://app.supabase.com${NC}"
echo -e "    ${CYAN}2. Abre tu proyecto${NC}"
echo -e "    ${CYAN}3. SQL Editor > New Query${NC}"
echo -e "    ${CYAN}4. Copia contenido de: supabase/update_global_email_view.sql${NC}"
echo -e "    ${CYAN}5. Pega en editor${NC}"
echo -e "    ${CYAN}6. Click Run (esquina inferior derecha)${NC}"
echo ""
echo -e "    ${YELLOW}¿Ya ejecutado?${NC} Marca como hecho: ${YELLOW}echo 'done'${NC}"
mark_pending

show_check "Ejecutar community_setup_final.sql" \
          "Índices, RLS, y validaciones finales"
echo ""
echo -e "    ${CYAN}1. Nuevo Query en Supabase SQL Editor${NC}"
echo -e "    ${CYAN}2. Copia: supabase/community_setup_final.sql${NC}"
echo -e "    ${CYAN}3. Pega y Run${NC}"
echo ""
echo -e "    ${YELLOW}¿Ya ejecutado?${NC} ${GREEN}✅${NC}"
mark_pending

show_check "Verificación de datos" \
          "Ejecutar queries de validación"
echo ""
echo -e "    ${CYAN}Query 1: Contar candidatos de comunidades${NC}"
echo "    SELECT COUNT(*) FROM global_email_candidates"
echo "    WHERE source_platform IN ('Discord', 'Reddit', 'Skool');"
echo ""
echo -e "    ${CYAN}Query 2: Verificar por plataforma${NC}"
echo "    SELECT source_platform, COUNT(*) as count"
echo "    FROM global_email_candidates"
echo "    GROUP BY source_platform;"
echo ""
echo -e "    ${YELLOW}Si ves resultados > 0, ¡funciona!${NC}"
mark_pending

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}           SECCIÓN 5: PRUEBA EN LA INTERFAZ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

show_check "Abre SistemaComunidad" \
          "En tu aplicación frontend"
echo -e "    ${CYAN}1. npm run dev${NC}"
echo -e "    ${CYAN}2. Navega a SistemaComunidad${NC}"
echo -e "    ${CYAN}3. Abre una campaña${NC}"
mark_pending

show_check "Expande un candidato" \
          "Ve el análisis de IA + botones"
echo -e "    ${CYAN}Click en el candidato para expandir${NC}"
mark_pending

show_check "Click 'Extraer Email/LinkedIn'" \
          "Espera a que termine (30-60 segundos)"
echo -e "    ${CYAN}Verás spinner mientras procesa${NC}"
echo -e "    ${CYAN}Msg: '✨ Email/LinkedIn extraído...'${NC}"
mark_pending

show_check "Verifica en Gmail > Buzones > Candidatos" \
          "El candidato debe aparecer aquí"
echo -e "    ${CYAN}1. Abre Gmail Dashboard${NC}"
echo -e "    ${CYAN}2. Buzones${NC}"
echo -e "    ${CYAN}3. Candidatos${NC}"
echo -e "    ${CYAN}4. ¡Busca el candidato!${NC}"
mark_pending

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}              SECCIÓN 6: VALIDACIÓN FINAL${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

show_check "Enriquecimiento funciona" \
          "Email y LinkedIn se guardan correctamente"
mark_pending

show_check "Sincronización automática" \
          "Candidato aparece en global_email_candidates"
mark_pending

show_check "Gmail integrado" \
          "Candidatos visibles en Gmail > Candidatos"
mark_pending

show_check "Sin errores en consola" \
          "F12 > Console no debe tener errores rojo"
mark_pending

show_check "Fallback en Gmail funciona" \
          "Si la vista falla, consulta community_candidates"
mark_pending

echo ""
echo -e "${PURPLE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║                                                                ║${NC}"
echo -e "${PURPLE}║                    📊 RESUMEN DE PROGRESO                      ║${NC}"
echo -e "${PURPLE}║                                                                ║${NC}"
echo -e "${PURPLE}╚════════════════════════════════════════════════════════════════╝${NC}"

PERCENTAGE=$((COMPLETED * 100 / TOTAL))

echo ""
echo -e "${GREEN}✅ Completado:${NC}  ${COMPLETED}/${TOTAL} items"
echo -e "${YELLOW}📊 Progreso:${NC}    ${PERCENTAGE}%"
echo ""

# Draw progress bar
BAR_LENGTH=40
FILLED=$((PERCENTAGE * BAR_LENGTH / 100))
EMPTY=$((BAR_LENGTH - FILLED))

echo -n "["
printf "%${FILLED}s" | tr ' ' '='
printf "%${EMPTY}s" | tr ' ' '-'
echo "]"

echo ""

if [ $PERCENTAGE -eq 100 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}║  🎉 SISTEMA COMPLETAMENTE LISTO 🎉   ║${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}║  ¡Dale caña con el desarrollo!        ║${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
elif [ $PERCENTAGE -ge 50 ]; then
    echo -e "${YELLOW}🚀 Ya casi listo. Sigue los pasos pendientes.${NC}"
else
    echo -e "${CYAN}💡 Comienza con SECCIÓN 2: Scripts SQL${NC}"
fi

echo ""
echo -e "${CYAN}Para más info:${NC}"
echo "  - SistemaComunidad/IMPLEMENTATION_GUIDE.md"
echo "  - SistemaComunidad/COMPLETION_SUMMARY.md"
echo ""
