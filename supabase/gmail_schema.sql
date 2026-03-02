-- Schema for Gmail Integration and Automated Outreach

-- 1. Gmail Accounts
CREATE TABLE IF NOT EXISTS public.gmail_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'error', 'disconnected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email)
);

-- 2. Gmail Sequences (Campaigns)
CREATE TABLE IF NOT EXISTS public.gmail_sequences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Gmail Sequence Steps
CREATE TABLE IF NOT EXISTS public.gmail_sequence_steps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sequence_id UUID NOT NULL REFERENCES public.gmail_sequences(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    delay_hours INTEGER NOT NULL DEFAULT 48, -- delay from PREVIOUS step or start. 0 means immediate.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sequence_id, step_number)
);

-- 4. Gmail Outreach Leads (Tracking who gets what)
CREATE TABLE IF NOT EXISTS public.gmail_outreach_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sequence_id UUID NOT NULL REFERENCES public.gmail_sequences(id) ON DELETE CASCADE,
    campaign_id TEXT, -- referencing external campaign IDs (e.g. linkedin/github/marketplace)
    candidate_id TEXT, -- referencing external candidate ID
    candidate_name TEXT NOT NULL,
    candidate_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'replied', 'bounced', 'failed', 'completed')),
    current_step_number INTEGER NOT NULL DEFAULT 1,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Gmail Logs (for Analytics Dashboard)
CREATE TABLE IF NOT EXISTS public.gmail_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('sent', 'reply', 'bounce', 'error')),
    message_id TEXT,
    sequence_id UUID REFERENCES public.gmail_sequences(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.gmail_outreach_leads(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.gmail_accounts(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)

ALTER TABLE public.gmail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_outreach_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_logs ENABLE ROW LEVEL SECURITY;

-- Policies

CREATE POLICY "Users can manage their own gmail accounts" ON public.gmail_accounts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sequences" ON public.gmail_sequences
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage sequence steps of their sequences" ON public.gmail_sequence_steps
    FOR ALL USING (
        sequence_id IN (SELECT id FROM public.gmail_sequences WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage outreach leads of their sequences" ON public.gmail_outreach_leads
    FOR ALL USING (
        sequence_id IN (SELECT id FROM public.gmail_sequences WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage their own gmail logs" ON public.gmail_logs
    FOR ALL USING (auth.uid() = user_id);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    CREATE TRIGGER update_gmail_accounts_modtime BEFORE UPDATE ON public.gmail_accounts FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_gmail_sequences_modtime BEFORE UPDATE ON public.gmail_sequences FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_gmail_sequence_steps_modtime BEFORE UPDATE ON public.gmail_sequence_steps FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_gmail_outreach_leads_modtime BEFORE UPDATE ON public.gmail_outreach_leads FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;
