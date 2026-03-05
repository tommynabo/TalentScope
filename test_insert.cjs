require('dotenv').config({ path: '/Users/tomas/Downloads/DOCUMENTOS/TalentScope/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const p_data = {
    campaign_id: "00000000-0000-0000-0000-000000000000",
    user_id: "00000000-0000-0000-0000-000000000000",
    platform: "github",
    username: "testuser",
    display_name: "Test",
    project_links: [],
    repo_links: [],
    skills: [],
    community_roles: []
  };
  const { data, error } = await supabase.rpc('upsert_community_candidate', { p_data });
  console.log("RPC Result:", { data, error });

  const { data: d2, error: e2 } = await supabase.from('community_candidates').insert(p_data).select();
  console.log("Insert Result:", { d2, e2 });
}
run();
