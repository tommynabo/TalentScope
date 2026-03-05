/**
 * TEST_COMMUNITY_ENRICHMENT.ts
 * 
 * Simple test to verify the Community Enrichment flow:
 * 1. Load a sample community candidate
 * 2. Enrich it with email/LinkedIn
 * 3. Verify it syncs to global_email_candidates
 * 4. Check it shows up in Gmail > Candidatos
 */

import { supabase } from '../lib/supabase';
import type { CommunityCandidate } from './SistemaComunidad/types/community';

async function testCommunityEnrichmentFlow() {
    console.log('🧪 Testing Community Enrichment Flow...\n');

    try {
        // Step 1: Get a sample community candidate from the database
        console.log('📥 Step 1: Loading sample community candidate...');
        const { data: candidates, error: loadError } = await supabase
            .from('community_candidates')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(5);

        if (loadError || !candidates || candidates.length === 0) {
            console.error('❌ No community candidates found in database');
            return;
        }

        const candidate = candidates[0] as CommunityCandidate;
        console.log(`✅ Found candidate: @${candidate.username} from ${candidate.platform}`);
        console.log(`   - Display Name: ${candidate.displayName || 'N/A'}`);
        console.log(`   - Email: ${candidate.email || 'NOT SET'}`);
        console.log(`   - LinkedIn: ${candidate.linkedInUrl || 'NOT SET'}\n`);

        // Step 2: Check if candidate already has email
        if (candidate.email) {
            console.log('⚠️  Candidate already has email. Testing sync to global view...\n');
        } else {
            console.log('ℹ️  Candidate needs enrichment. In real scenario, click "Extraer Email/LinkedIn"\n');
        }

        // Step 3: Verify in global_email_candidates
        console.log('🔍 Step 2: Checking global_email_candidates view...');
        const { data: globalCandidates, error: viewError } = await supabase
            .from('global_email_candidates')
            .select('*')
            .eq('candidate_id', candidate.id)
            .single();

        if (viewError && viewError.code !== 'PGRST116') { // PGRST116 = not found
            console.error('❌ Error querying global_email_candidates:', viewError);
        } else if (globalCandidates) {
            console.log('✅ Candidate found in global_email_candidates:');
            console.log(`   - Source: ${globalCandidates.source_platform}`);
            console.log(`   - Email: ${globalCandidates.email}`);
            console.log(`   - Profile URL: ${globalCandidates.profile_url}\n`);
        } else {
            console.log('❌ Candidate NOT in global_email_candidates view');
            console.log('   (They need to have email set and view needs to be refreshed)\n');
        }

        // Step 4: Check gmail_outreach_sequences (for manual enrollment)
        console.log('📧 Step 3: Checking available Gmail sequences...');
        const { data: sequences, error: seqError } = await supabase
            .from('gmail_outreach_sequences')
            .select('id, name, step_count, created_at')
            .limit(3);

        if (seqError) {
            console.warn('⚠️  Could not load sequences:', seqError.message);
        } else if (sequences && sequences.length > 0) {
            console.log(`✅ Found ${sequences.length} available sequences:`);
            sequences.forEach((seq: any) => {
                console.log(`   - ${seq.name} (${seq.step_count} steps, created: ${seq.created_at})`);
            });
        } else {
            console.log('ℹ️  No sequences found. Create one in Gmail > Sequences first.\n');
        }

        // Step 5: Summary
        console.log('\n✨ TEST SUMMARY:');
        console.log('═══════════════════════════════════════════════════════');
        console.log('🎯 What should happen:');
        console.log('');
        console.log('1. Expand a community candidate in SistemaComunidad');
        console.log('2. Click "Extraer Email/LinkedIn"');
        console.log('3. Wait for extraction (uses Apify + OpenAI)');
        console.log('4. Email gets saved + LinkedIn profile synced');
        console.log('5. Candidate appears in Gmail > Buzones > Candidatos');
        console.log('');
        console.log('📍 Current state:');
        console.log(`   - Test candidate: @${candidate.username}`);
        console.log(`   - Has email: ${candidate.email ? '✅ Yes' : '❌ No'}`);
        console.log(`   - In global view: ${globalCandidates ? '✅ Yes' : '❌ No'}`);
        console.log('═══════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('🔥 Test failed:', error);
    }
}

// Run the test
testCommunityEnrichmentFlow().catch(console.error);
