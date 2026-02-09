

import { createClient } from '@supabase/supabase-js';

// dotenv dependency removed, relying on shell env vars

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyConnection() {
    console.log('Verifying Supabase connection...');
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('Connection failed:', error.message);
            process.exit(1);
        }
        console.log('Connection successful!');
    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

verifyConnection();
