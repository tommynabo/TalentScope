
-- Enable RLS
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_candidates ENABLE ROW LEVEL SECURITY;

-- Create Policies (Allow everything for authenticated users for now to unblock)
CREATE POLICY "Enable all for authenticated users" ON candidates
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON campaigns
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON campaign_candidates
FOR ALL USING (auth.role() = 'authenticated');

-- Also allow anon for development if needed (though not recommended for prod)
-- CREATE POLICY "Enable read for anon" ON candidates FOR SELECT USING (true);
