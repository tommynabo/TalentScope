// Quick test script to verify analytics table and permissions
import { supabase } from './lib/supabase';
import { AnalyticsService } from './lib/analytics';

async function testAnalytics() {
  console.log('=== Analytics Test ===');
  
  try {
    // Test 1: Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Current user:', user?.email);
    if (userError) console.error('User error:', userError);

    // Test 2: Check if table exists and is readable
    console.log('\n--- Test: Read analytics table ---');
    const { data: allStats, error: readError } = await supabase
      .from('analytics_daily')
      .select('*')
      .limit(5);
    
    console.log('Read error:', readError);
    console.log('All stats:', allStats);

    // Test 3: Try to get today's stats
    console.log('\n--- Test: Get today stats ---');
    const stats = await AnalyticsService.getDailyStats();
    console.log('Today stats:', stats);

    // Test 4: Try to track a test event
    console.log('\n--- Test: Track test event ---');
    const today = new Date().toISOString().split('T')[0];
    
    // Manual insert attempt
    const { data: insertData, error: insertError } = await supabase
      .from('analytics_daily')
      .insert([{
        date: today,
        emails_sent: 0,
        replies_received: 0,
        interviews_booked: 0,
        leads_generated: 1
      }])
      .select();

    console.log('Insert error:', insertError);
    console.log('Insert data:', insertData);

    // Test 5: Try to track through service
    console.log('\n--- Test: Track through service ---');
    await AnalyticsService.trackLeadsGenerated(5);
    
    // Read again
    const { data: finalStats, error: finalError } = await supabase
      .from('analytics_daily')
      .select('*')
      .eq('date', today)
      .single();
    
    console.log('Final stats error:', finalError);
    console.log('Final stats:', finalStats);

    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAnalytics();
