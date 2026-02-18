# GitHub Outreach Messages System

## 📧 Overview

El sistema genera automáticamente **3 mensajes personalizados** para cada candidato GitHub después del análisis de perfil. Los mensajes son:

1. **🔵 Invitación (Icebreaker)** - Primer contacto, referenciando sus proyectos específicos
2. **🟢 Post-Aceptación (Pitch)** - Propuesta de valor once the connection is accepted
3. **🟣 Seguimiento (Followup)** - Soft follow-up si no responden

## 🤖 How Messages Are Generated

### Flow

```
GitHub Search → Profile Analysis → AI Generation → Save to Supabase
                                            ↓
                                    OpenAI Prompt
                                            ↓
                          3 Personalized Messages
                          + 4 Analysis Cards
```

### OpenAI Prompt Structure

**File:** [lib/openai.ts](lib/openai.ts) - Function `generateCandidateAnalysis()`

The prompt receives:
```typescript
{
  name: "Antonio Munificent",
  username: "munificent",
  bio: "Language designer at Google",
  languages: ["C++", "JavaScript", "Python"],
  topRepos: [
    { name: "craftinginterpreters", description: "Guide to implementing interpreters" }
  ]
}
```

And generates:
```json
{
  "analysis_psychological": "Methodical problem solver with deep systems thinking...",
  "analysis_business": "Active open-source contributor with proven shipping capability...",
  "analysis_sales_angle": "Appeal to technical leadership and architectural challenges...",
  "analysis_bottleneck": "May resist corporate processes without clear technical autonomy...",
  "outreach_icebreaker": "Hola Antonio, impresionado con tu trabajo en crafting interpreters...",
  "outreach_pitch": "Buscamos alguien con tu expertise en sistemas complejos...",
  "outreach_followup": "Solo quería tocar base sobre la oportunidad mencionada...",
  "ai_summary": ["Expert in language design", "Proven open-source track record", ...]
}
```

## 📝 Message Generation Rules

### 1️⃣ Icebreaker Message
- **Max:** 2-3 sentences
- **Personalization:** Specific repo/project reference
- **Tone:** Professional, specific, not generic
- **Required:** Mention at least 1 actual tech stack or project
- **Format:** "Hola [name], impresionado con..."

**Example:**
```
"Hola Antonio, impresionado con tu trabajo en crafting interpreters. 
Tu diseño de sistemas es exactamente lo que buscamos para nuestros 
proyectos con Dart."
```

### 2️⃣ Pitch Message
- **Max:** 2-3 sentences
- **Value Prop:** Why THIS opportunity fits THEM
- **Mention:** Specific tech challenge or stack
- **Tone:** Collaborative, not salesy
- **Not:** Generic LinkedIn sales pitch

**Example:**
```
"Estamos construyendo la próxima generación de aplicaciones móviles 
con arquitectura de sistemas similar a lo que haces. Necesitamos a 
alguien con tu nivel de profundidad técnica."
```

### 3️⃣ Followup Message
- **Max:** 1-2 sentences
- **Tone:** Low pressure, soft
- **Purpose:** Re-engage without being pushy
- **Format:** "Solo quería tocar base sobre..."

**Example:**
```
"Solo quería tocar base sobre la oportunidad de arquitectura que 
mencioné. Entiendo que estás ocupado, pero te creo perfecto para esto."
```

## 📍 Where Messages Are Shown

### During Search (View Mode - Pipeline)
- **Location:** [SistemaGithub/components/GitHubCandidatesPipeline.tsx](SistemaGithub/components/GitHubCandidatesPipeline.tsx)
- **Display:** 3 Message Cards below candidate analysis
- **Size:** text-sm (readable), with line-clamp-4 on cards
- **Actions:** Copy or "Ver/Editar" (View/Edit)

### Edit Modal
- **Trigger:** Click "Ver/Editar" on any message card
- **Modal Features:**
  - Full textarea with complete message visible
  - Character count
  - "Save Changes" button (Supabase integration)
  - "Copiar Mensaje" (Copy) button
  - Save status indicators (saving, saved, error)

### Export (CSV)
- **Fields Included:**
  - `outreach_icebreaker`
  - `outreach_pitch`
  - `outreach_followup`
- **Format:** Full message text (no truncation in exports)

## 💾 Storage & Persistence

### Database Location
- **Table:** `github_search_results` (old) → `github_candidates` (new schema)
- **Columns:**
  - `outreach_icebreaker TEXT`
  - `outreach_pitch TEXT`
  - `outreach_followup TEXT`

### When Saved
1. **Auto-generated:** When `generateCandidateAnalysis()` runs via OpenAI
2. **Persisted:** Via `GitHubCandidatePersistence.saveCandidates()` to Supabase
3. **User-edited:** Via `GitHubCandidatePersistence.saveOutreachMessages()` when user clicks "Guardar Cambios"

### Code Flow
```typescript
// During search
async searchDevelopers(...) {
  // ... search logic ...
  const aiAnalysis = await generateAIAnalysis(user, languages, repos, criteria);
  
  // Include messages in metrics
  const metrics = {
    outreach_icebreaker: aiAnalysis?.outreach_icebreaker,
    outreach_pitch: aiAnalysis?.outreach_pitch,
    outreach_followup: aiAnalysis?.outreach_followup,
    // ... other fields ...
  };
  
  // Save to Supabase (includes messages)
  await GitHubCandidatePersistence.saveCandidates(campaignId, [metrics], userId);
}

// When user edits
async handleSaveMessage() {
  const success = await GitHubCandidatePersistence.saveOutreachMessages(
    campaignId,
    github_username,
    { outreach_icebreaker: editedValue }
  );
}
```

## 🎯 User Journey

1. **Run GitHub Search**
   - Criteria applied
   - OpenAI generates profiles + 3 messages for each candidate
   - Messages saved to Supabase automatically

2. **View Candidates**
   - Select Pipeline view mode
   - See 3 message cards: Invitación, Post-Aceptación, Seguimiento
   - Messages show first ~3 lines with "Ver/Editar" button

3. **Edit Message**
   - Click "Ver/Editar" on any message card
   - Modal opens with full message text in editable textarea
   - Edit as needed
   - Click "Guardar Cambios" → saves to Supabase with feedback status
   - Status shows: "Guardando..." → "¡Guardado!" (2 sec) or "Error"

4. **Copy Message for Outreach**
   - Click "Copiar" button in modal or card
   - Message copied to clipboard
   - Feedback: "¡Copiado!" for 2 seconds
   - Paste into LinkedIn/email manually

5. **Export Campaign**
   - CSV export includes all 3 messages
   - Full text (no truncation)
   - Can import into email tool or CRM

## ⚙️ Configuration

### OpenAI Model
- **Model:** `gpt-4-turbo`
- **Response Format:** JSON
- **Temperature:** Default (0.7 - balanced creativity/consistency)

### Message Constraints
- **Language:** Spanish (Español)
- **Tone:** Professional, technical
- **Personalization:** Must reference specific project/metric/language
- **No Generic:** Every message unique per candidate

## 🔧 Troubleshooting

### Messages Not Generating
1. ✅ Check OpenAI API key in .env: `VITE_OPENAI_API_KEY`
2. ✅ Verify rate limits (API quota)
3. ✅ Check browser console for OpenAI errors
4. ✅ Ensure `generateCandidateAnalysis()` is being called in `generateAIAnalysis()`

### Messages Show as Empty/Default
- OpenAI call failed silently (check console)
- Missing fields in `profileData` object
- Response format didn't match expected JSON structure

### "Guardar Cambios" Button Not Appearing
- `campaignId` not passed to `GitHubCandidatesPipeline` component
- Check: [GitHubCodeScan.tsx](components/GitHubCodeScan.tsx) line 550+
- Ensure: `<GitHubCandidatesPipeline campaignId={campaignId} ... />`

### Messages Not Saving to Database
1. Check Supabase connection: `supabase` is authenticated
2. Verify table exists: `github_candidates` or `github_search_results`
3. Check RLS policies allow user UPDATE
4. Verify columns exist: `outreach_icebreaker`, `outreach_pitch`, `outreach_followup`

## 📊 Future Improvements

### Planned Features
- [ ] Message templates (user-saved templates per campaign)
- [ ] A/B testing messages (track response rates)
- [ ] Bulk edit messages with AI enhancement
- [ ] Template variables: `{name}`, `{company}`, `{tech_stack}`
- [ ] Message scheduling (send at specific time)
- [ ] Integration with LinkedIn API (auto-send from platform)

### Potential Enhancements
- Better personalization with more profile data
- Sentiment analysis feedback
- Response rate tracking per message
- Message adaptation based on profile seniority

## 📖 Related Files

- **Generation:** [lib/openai.ts](lib/openai.ts)
- **Service:** [lib/githubService.ts](lib/githubService.ts)
- **Persistence:** [lib/githubCandidatePersistence.ts](lib/githubCandidatePersistence.ts)
- **UI:** [SistemaGithub/components/GitHubCandidatesPipeline.tsx](SistemaGithub/components/GitHubCandidatesPipeline.tsx)
- **Types:** [types/database.ts](types/database.ts) - `GitHubCandidateProfile` interface
- **Schema:** [supabase/github_schema_with_dates.sql](supabase/github_schema_with_dates.sql)
