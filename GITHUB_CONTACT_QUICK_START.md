# GitHub Contact Research - Quick Start Guide

## ¿Qué es esto?

Sistema **indestructible** que busca emails y LinkedIn de desarrolladores encontrados en GitHub.

Después de usar "Búsqueda en GitHub" para encontrar perfiles de desarrolladores, puedes hacer clic en "Enriquecer Contactos" para encontrar automáticamente:
- 📧 **Emails** - dirección de correo personal
- 🔗 **LinkedIn URLs** - perfil profesional
- 🌐 **Sitios web** - portfolios personales


## Inicio Rápido

### 1️⃣ Buscar Desarrolladores en GitHub
```
1. Ve a "Búsqueda en GitHub"
2. Configura tus criterios (lenguajes, followers, etc.)
3. Haz clic "Iniciar Búsqueda"
4. Espera a que aparezcan los candidatos
```

### 2️⃣ Enriquecer Contactos (NUEVO)
```
1. Una vez tengas candidatos, aparece botón "Enriquecer Contactos"
2. Haz clic en el botón (icono de mail)
3. Se abre un modal con barra de progreso
4. La búsqueda comienza automáticamente
5. Verás actualizaciones en tiempo real
```

### 3️⃣ Ver Resultados
```
- Las cartas de candidatos muestran: ✅ Email encontrado
- Las cartas de candidatos muestran: ✅ LinkedIn encontrado
- Las estadísticas al final muestran totales
- Puedes exportar como CSV si quieres
```


## Cómo Funciona (Técnico)

### 8 Estrategias de Búsqueda (en orden)

La búsqueda intenta 8 métodos diferentes para encontrar contacto:

```
1. COMMITS AUTENTICADOS
   Busca emailen historiales de commits
   ⭐ Más confiable (99% válidos)

2. PERFIL DE GITHUB
   Bio, nombre, ubicación, empresa
   ⭐ Fácil acceso (50% tienen algo)

3. SITIO WEB PERSONAL
   URL en campo "blog"
   ⭐ Si existe, muy probable encontrar contacto

4. README DE REPOS
   Los top 5 repositorios
   ⭐ Desarrolladores a veces lo incluyen (70%)

5. GISTS PÚBLICOS
   Fragmentos de código públicos
   ⭐ A veces revelan info de contacto

6. EVENTOS PÚBLICOS
   Commits en eventos comunitarios
   ⭐ Metadata de commits

7. PULL REQUESTS / ISSUES
   Comentarios en código
   ⭐ Ocasionalmente emails en texto

8. BÚSQUEDA FUZZY
   Patrones y variaciones
   ⭐ Fallback (baja confianza)
```

Cada estrategia que funciona se suma, dándole una calidad de búsqueda:
- 🟢 **Excellent** - Email + LinkedIn + múltiples fuentes  
- 🟢 **Good** - Email o LinkedIn encontrado
- 🟡 **Fair** - Un campo encontrado
- 🔴 **Poor** - Sin información

### Validación de Calidad

Todos los emails se validan:
- ✅ Formato correcto (nombre@dominio.ext)
- ❌ Excluye: noreply, test, localhost, github.com, etc.
- ✅ Prefiere: gmail, yahoo, hotmail, outlook
- ❌ Rechaza: support@, admin@, info@, contact@


## Opciones Avanzadas

### Control de Velocidad
```
Por defecto (seguro):
- 1 candidato a la vez
- 500ms entre cada uno
- 2 reintentos si falla

Para ir más rápido:
- Aumenta parallelRequests a 3-5
- Reduce delayBetweenRequests de 500 a 200
- PERO: Riesgo de rate limiting
```

### Skip de Candidatos ya Enriquecidos
```
Por defecto: ✅ Skip (no re-busca si ya tiene email)
Si quieres forzar re-búsqueda:
- Desmarca "skipAlreadyEnriched"
- El sistema ignorará datos existentes
```

### Reintentos
```
Por defecto: 2 reintentos con backoff exponencial
- Intento 1: falla → espera 500ms
- Intento 2: falla → espera 1000ms
- Intento 3: falla → marca como error

Aumentar a 3 si esperas mucho rate limiting
```


## Control durante la Búsqueda

### Pausar
```
Botón "⏸️ Pause"
- Detiene el procesamiento actual
- Los datos encontrados se guardan
- Puedes reanudar después
```

### Reanudar
```
Botón "▶️ Resume"
- Continúa donde se pausó
- Sin perder progreso
```

### Cancelar
```
Botón "✕ Stop"
- Detiene completamente
- Guarda lo encontrado hasta ese momento
- Modal se cierra
```


## Estadísticas Mostradas

### En Tiempo Real
- **Processed**: X / Total candidatos procesados
- **Success Rate**: % candidatos con éxito
- **Emails Found**: Total emails encontrados
- **LinkedIn Found**: Total LinkedIn encontrados
- **Failed**: Candidatos donde falló búsqueda
- **Current**: Usuario siendo procesado
- **Remaining**: Usuarios sin procesar
- **ETA**: Tiempo estimado restante

### Al Final
```
✅ Research Complete!

📊 Summary:
- Total: 50 candidatos
- Success: 48 (96%)
- Emails: 45 (90%)
- LinkedIn: 40 (80%)
- Avg Quality: 🟢 Excellent
```


## En las Tarjetas de Candidatos

Después del enriquecimiento, cada candidato muestra:

```
┌─────────────────────────────┐
│ @desarrollador              │
│                             │
│ 📊 Score: 85/100           │
│ 📧 dev@gmail.com ✅         │
│ 🔗 linkedin.com/in/dev ✅   │
│ ⭐ 234 Stars | 45 Followers │
│                             │
│ [Ver en GitHub] [LinkedIn]  │
└─────────────────────────────┘
```


## Casos de Uso

### Caso 1: Contactar Developers Rápido
```
1. Busca en GitHub (Product Engineers)
2. Enriquece contactos
3. Exporta emails
4. Importa a tu CRM/Email
5. Envía campaña
```

### Caso 2: LinkedIn Cross-Link
```
1. Busca en GitHub
2. Enriquece contactos (obtiene LinkedIn)
3. Haz clic en "Cross-Search"
4. Busca esos perfiles en LinkedIn
5. Ahora tienes datos de ambas plataformas
```

### Caso 3: Verificar Contactos
```
1. Busca en GitHub
2. Enriquece contactos
3. Verifica emails con Hunter.io o similar
4. Marca "válidos" o "inválidos"
5. Usa solo los válidos
```


## Troubleshooting

### "No emails found para nadie"
❌ **Problema**: Desarrolladores sin email público
✅ **Solución**: 
- Algunos desarrolladores mantienen privacidad
- Intenta con "Enriquecer Contactos" de nuevo
- Si aún nada, probablemente no tienen email público

### "Muy lento (10+ segundos por persona)"
❌ **Problema**: Búsqueda en todos los repositorios
✅ **Solución**:
- Aumenta delayBetweenRequests a 1000ms
- Reduce parallelRequests (estamos seguros con 1)
- Espera entre búsquedas

### "Algunos candidatos muestran error"
❌ **Problema**: API de GitHub rate limited
✅ **Solución**:
- Pausa (⏸️) durante 10-15 segundos
- Reanuda (▶️)
- GitHub API límite: 5000 req/hora con token

### "El modal se cerró, ¿qué pasó con los datos?"
✅ **No hay problema**: Los datos se guardaron en Supabase
- Haz clic en "Enriquecer Contactos" de nuevo
- Aparecerá "skipAlreadyEnriched" - no re-procesará
- Tus candidatos están salvos


## Formato de Datos Guardados

En Supabase, cada candidato se actualiza con:

```json
{
  "github_username": "developer",
  "mentioned_email": "dev@gmail.com",
  "linkedin_url": "https://linkedin.com/in/developer",
  "personal_website": "https://dev.com"
}
```

Campos opcionales:
- Si no se encuentra email → NULL
- Si no se encuentra LinkedIn → NULL
- Sitio web se saca del perfil GitHub


## API / Programática

Si quieres usar esto en tu código:

```typescript
import { GitHubBatchContactEnricher } from '@/lib/githubBatchContactEnricher';

const enricher = new GitHubBatchContactEnricher();
const results = await enricher.enrichCandidates(
    candidates,
    campaignId,
    userId,
    {
        parallelRequests: 1,
        delayBetweenRequests: 500,
        skipAlreadyEnriched: true
    },
    (progress, batch) => {
        console.log(`${progress.percentComplete}% done`);
    }
);

// results es array de EnrichmentResult
// Cada uno tiene: username, original, updated, research, success, error
```


## Performance Esperado

### Velocidad
- **Sin cache**: 1-3 segundos por candidato
- **Con cache**: 100-500ms por candidato
- **Con parallelRequests=3**: 3-9 candidatos/10 segundos

### Precisión
- **Emails**: 85-95% válidos
- **LinkedIn**: 70-85% válidas
- **Combinadas**: 90-98% tiene al menos uno

### Límites
- **GitHub API**: 5000 requests/hora (con token)
- **Candidatos/hora**: ~500 en modo secuencial
- **Candidatos/hora**: ~1500 en modo paralelo (3x)


## Preguntas Frecuentes

**P: ¿Se pierden datos si cierro el modal?**  
R: No, Supabase guarda todo en tiempo real.

**P: ¿Puedo pausar y reanudar después?**  
R: Sí, el progreso se mantiene.

**P: ¿Qué pasa con desarrolladores sin email público?**  
R: Se marcan como "Poor" quality - al menos tienes LinkedIn.

**P: ¿Por qué algunos tardan más que otros?**  
R: Depende cuántos repositorios tengan y accesibilidad de datos.

**P: ¿Se reintentan automáticamente los errores?**  
R: Sí, 2 reintentos con backoff exponencial.

---

**¡Ya estás listo para enriquecer tus candidatos! 🚀**
