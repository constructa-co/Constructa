-- Sprint 3B: World-Class Proposal — extend profiles and projects

-- Extend profiles with company capability fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vat_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_trading integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialisms text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS capability_statement text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS insurance_details text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accreditations text;

-- Add proposal-specific fields to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS proposal_introduction text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tc_overrides jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gantt_phases jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_photos jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS proposal_sent_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS proposal_accepted_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS proposal_accepted_by text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS proposal_token text;
