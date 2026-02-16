-- SQL Command to fix analytics_daily RLS issue
-- Execute this in Supabase SQL Editor to enable analytics_daily for authenticated users

-- First, enable RLS on the table if not already enabled
ALTER TABLE IF EXISTS analytics_daily ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON analytics_daily;
DROP POLICY IF EXISTS "Allow authenticated users" ON analytics_daily;

-- Create the policy that allows all operations for authenticated users
CREATE POLICY "Enable all for authenticated users" ON analytics_daily
FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'analytics_daily';
