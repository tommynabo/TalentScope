-- ═══════════════════════════════════════════════════════════════════════════════
-- GITHUB SYSTEM - RLS POLICIES FIX
-- Ejecuta esto en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- Política para profiles - SELECT
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- Política para profiles - INSERT
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Política para profiles - UPDATE
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Política para campaigns - SELECT
DROP POLICY IF EXISTS "campaigns_select_own" ON public.campaigns;
CREATE POLICY "campaigns_select_own" ON public.campaigns FOR SELECT USING (user_id = auth.uid());

-- Política para campaigns - INSERT
DROP POLICY IF EXISTS "campaigns_insert_own" ON public.campaigns;
CREATE POLICY "campaigns_insert_own" ON public.campaigns FOR INSERT WITH CHECK (user_id = auth.uid());

-- Política para campaigns - UPDATE
DROP POLICY IF EXISTS "campaigns_update_own" ON public.campaigns;
CREATE POLICY "campaigns_update_own" ON public.campaigns FOR UPDATE USING (user_id = auth.uid());

-- Política para campaigns - DELETE
DROP POLICY IF EXISTS "campaigns_delete_own" ON public.campaigns;
CREATE POLICY "campaigns_delete_own" ON public.campaigns FOR DELETE USING (user_id = auth.uid());

-- Política para github_search_results - SELECT
DROP POLICY IF EXISTS "github_search_results_select_own" ON public.github_search_results;
CREATE POLICY "github_search_results_select_own" ON public.github_search_results FOR SELECT USING (user_id = auth.uid());

-- Política para github_search_results - INSERT
DROP POLICY IF EXISTS "github_search_results_insert_own" ON public.github_search_results;
CREATE POLICY "github_search_results_insert_own" ON public.github_search_results FOR INSERT 
WITH CHECK (user_id = auth.uid() AND campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid()));

-- Política para github_search_results - UPDATE
DROP POLICY IF EXISTS "github_search_results_update_own" ON public.github_search_results;
CREATE POLICY "github_search_results_update_own" ON public.github_search_results FOR UPDATE 
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Política para github_search_results - DELETE
DROP POLICY IF EXISTS "github_search_results_delete_own" ON public.github_search_results;
CREATE POLICY "github_search_results_delete_own" ON public.github_search_results FOR DELETE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (usar: tablename NOT table_name)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
