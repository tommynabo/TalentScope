import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client for Vercel serverless functions.
 * Uses process.env instead of import.meta.env (which is Vite-only).
 */
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase Server] Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    availableKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', '),
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
