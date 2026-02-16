-- =========================================
-- WALEAD MESSAGES - DATABASE SETUP
-- =========================================
-- Execute this SQL in your Supabase SQL Editor
-- Navigate to: PostgreSQL > SQL Editor > New Query
-- Copy-paste this entire script and run it

-- 1. Add walead_messages column to candidates table
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS walead_messages JSONB DEFAULT NULL;

-- 2. Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_candidates_walead_messages 
ON candidates USING GIN (walead_messages);

-- 3. Enable Row Level Security (if not already enabled)
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- 4. Allow authenticated users to update candidates
DROP POLICY IF EXISTS "enable_update_candidates" ON candidates;
CREATE POLICY "enable_update_candidates" ON candidates
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 5. Verify the column was created (optional - check this query result)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name='candidates' AND column_name='walead_messages';

-- =========================================
-- After running this script:
-- 1. The app can now save edited messages to the database
-- 2. Refresh your app in the browser
-- 3. Search for candidates, edit their messages, and save them
-- 4. Messages will persist across sessions
-- =========================================
