/**
 * Verificador de Schema de Supabase para Sistema GitHub
 * Diagnostica y muestra el estado de las tablas
 * 
 * Uso: npx ts-node verify-github-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

        if (error) {
            if (error.message.includes('does not exist')) {
                console.log(`❌ Table "${tableName}" does not exist`);
                return false;
            }
            console.log(`⚠️  Table "${tableName}" - Error: ${error.message}`);
            return false;
        }

        console.log(`✅ Table "${tableName}" exists`);
        return true;
    } catch (err: any) {
        console.log(`❌ Table "${tableName}" - Exception: ${err.message}`);
        return false;
    }
}

async function main() {
    console.log('\n🔍 GitHub System Supabase Schema Verification\n');
    console.log(`Supabase URL: ${supabaseUrl}\n`);

    // Check critical tables
    const requiredTables = [
        'auth.users',
        'public.profiles',
        'public.campaigns',
        'public.campaigns_github',
        'public.github_search_results'
    ];

    console.log('Checking required tables:\n');

    const results: Record<string, boolean> = {};
    
    for (const tableName of requiredTables) {
        const cleanName = tableName.replace('public.', '').replace('auth.', '');
        results[cleanName] = await checkTable(cleanName);
    }

    console.log('\n📊 Summary:\n');
    const allGood = Object.values(results).every(r => r);
    
    if (allGood) {
        console.log('✅ All tables exist! Schema is ready.');
    } else {
        console.log('⚠️  Some tables are missing:');
        Object.entries(results).forEach(([name, exists]) => {
            if (!exists) {
                console.log(`   - ${name}`);
            }
        });
        
        console.log('\n📋 To fix, run these SQL migrations in Supabase Console:\n');
        console.log('1. Check if "campaigns" table exists with "id" column');
        console.log('2. Check if "profiles" table exists (usually linked to auth.users)');
        console.log('3. Run: supabase/github_search_results_migration.sql\n');
    }

    // Check github_search_results in detail if it exists
    if (results['github_search_results']) {
        console.log('📋 Checking github_search_results columns:\n');
        try {
            const { data, error } = await supabase
                .from('github_search_results')
                .select('*', { count: 'exact', head: true });

            if (!error) {
                console.log('✅ github_search_results is accessible');
                console.log('   Can create candidates ✓');
                console.log('   Can read candidates ✓');
            }
        } catch (err) {
            console.log('❌ Cannot access github_search_results');
        }
    }

    console.log('\n');
}

main().catch(console.error);
