# Gmail Outreach Debugging Guide

## Quick Fix Steps

If you're getting errors when testing Gmail outreach (`Probar Envío`), follow these steps:

### 1. **Run Diagnostics First**
```
POST /api/diagnose
```
This endpoint checks:
- ✅ Are there pending leads?
- ✅ Are Gmail accounts connected and have tokens?
- ✅ Are sequences active?
- ✅ Does the database connection work?

### 2. **Common Issues and Solutions**

#### ❌ "No active Gmail account found"
**Problem:** No Gmail account is connected, or the one you connected doesn't have an access token.

**Solution:**
1. Go to **Buzones** (left sidebar) → **Cuentas Gmail**
2. Click **Conectar Nueva Cuenta**
3. Follow the OAuth flow completely
4. Verify account appears in the list with status "Activa"
5. Refresh sequence page and try test again

#### ❌ "Gmail account has no access token"
**Problem:** Account is saved but the OAuth token wasn't stored properly

**Solution:**
1. Go to **Buzones** → **Cuentas Gmail**
2. Disconnect the broken account (if there's a delete option)
3. Click **Conectar Nueva Cuenta** again
4. Make sure to complete the full OAuth flow
5. Check your backend logs for token generation errors

#### ❌ "No pending leads found" (but system shows success: 0, failed: 0)
**Problem:** No leads exist in the `gmail_outreach_leads` table

**Solution:**
1. Go to Gmail Sequences
2. Select a sequence
3. In "Candidatos de Secuencia", click to select candidates
4. Verify candidates are added with status showing they're in the sequence
5. Make sure sequence is "Activada" (shows Activar Secuencia button only when draft)
6. Try test again

#### ❌ "Sequence not found" or "Steps not found"
**Problem:** Sequence or sequence steps are corrupted/missing

**Solution:**
1. Delete the sequence (if you have a delete button)
2. Create it again from a template
3. Make sure all three steps show in the editor
4. Click "Guardar Cambios" to confirm
5. Try test again

### 3. **What Each Error in the Test Response Means**

When you click "Probar Envío", the response shows:

```
✅ Test completado

Enviados: X      ← Number of emails successfully sent
Fallos: Y        ← Number of emails that failed
Detalles:
- ERROR MESSAGE  ← Specific errors for each failed lead, or SYSTEM error
```

**Example responses:**

**Success:** 
```
Enviados: 2
Fallos: 0
Detalles:
Sin errores especiales
```

**Partial failure:**
```
Enviados: 1
Fallos: 1
Detalles:
SYSTEM: No active Gmail account found for user {user_id}
```

### 4. **Enable Browser Console Logging**

Open Developer Tools (F12 or Cmd+Shift+I) → Console tab, then:
- The system logs detailed messages starting with `[Test]`, `[GmailAPI]`, etc.
- These logs show exactly where the error occurs
- Share these logs if you need more help

### 5. **Server Logs (Vercel)**

If the error still shows "Server error (500)", check:
1. Go to your Vercel deployment dashboard
2. Look at **Logs** for the `test-outreach` function
3. Look for recent errors with `[GmailOutreach]` prefix
4. These logs show the exact failure point

## How the System Works

1. **Sequence Creation**
   - User creates sequence with 3 steps (0h, 24h, 48h delays)
   - Each step has `subject_template` and `body_template`
   - Variables: `{{name}}`, `{{specialty}}`, `{{email}}`

2. **Adding Candidates**
   - User selects candidates to add to sequence
   - System creates row in `gmail_outreach_leads` with:
     - `status: 'pending'`
     - `scheduled_for: now` (ready to send immediately)
     - `current_step_number: 1`

3. **Activating Sequence**
   - Click "Activar Secuencia"
   - Changes sequence status from `draft` → `active`

4. **Sending Emails (Cron or Manual Test)**
   - Every minute, cron checks for pending/running leads where `scheduled_for <= now`
   - For each lead, fetches sequence, steps, and Gmail account
   - Generates email by replacing `{{variables}}` with actual values
   - Sends via Gmail API (RFC 2822 format, base64 encoded)
   - Updates lead to next step or marks completed
   - Logs successful sends to `gmail_logs` table

5. **Observing Progress**
   - Candidate status shows in pipeline/kanban views
   - Refresh page to see "Contactado" status after send

## Testing Locally

If you want to test without waiting for cron:

1. **Manual Test Endpoint**
   ```bash
   curl -X POST http://localhost:5173/api/test-outreach \
     -H "Content-Type: application/json"
   ```

2. **Check Supabase Data Directly**
   - Open Supabase dashboard
   - Check `gmail_outreach_leads` table for pending rows
   - Check `gmail_accounts` table for access_token field
   - Check `gmail_logs` table for successful sends

## Advanced: What's Logged

When processing runs, you'll see logs like:
```
[GmailOutreach] Starting to process pending leads...
[GmailOutreach] Found 2 leads to process
[GmailOutreach] Processing lead {lead_id}
[GmailAPI] Preparing to send email to candidate@example.com from yourgmail@gmail.com
[GmailAPI] Email sent successfully, message ID: {id}
[GmailOutreach] ✓ Sent email to candidate@example.com (Step 1)
[GmailOutreach] Results - Success: 2, Failed: 0, Errors: 0
```

Errors would look like:
```
[GmailOutreach] Processing lead {lead_id}
[GmailAPI] Error sending email: Gmail API error: 401 - Invalid auth
[GmailOutreach] ✗ Error for lead {lead_id}: Gmail API error: 401 - Invalid auth
```

## Next Steps After First Success

Once you see `Enviados: X`, you'll know:
- ✅ Database connections work
- ✅ Gmail OAuth is valid
- ✅ Email sending logic works
- ✅ System is ready for full cron automation

Then you need to:
1. Set `CRON_SECRET` environment variable in Vercel
2. Configure cron job in `vercel.json`
3. Emails will send automatically every minute on schedule
