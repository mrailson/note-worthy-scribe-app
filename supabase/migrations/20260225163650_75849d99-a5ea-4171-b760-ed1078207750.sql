
-- Table 1: Recruitment config (JSONB blob, mirrors nres_estates_config)
CREATE TABLE nres_recruitment_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  practices_data JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE nres_recruitment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recruitment config"
  ON nres_recruitment_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage recruitment config"
  ON nres_recruitment_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO nres_recruitment_config (id, practices_data) VALUES ('default', '[]');

-- Table 2: Recruitment audit trail
CREATE TABLE nres_recruitment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  practice_name TEXT,
  staff_name TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT
);

ALTER TABLE nres_recruitment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recruitment audit"
  ON nres_recruitment_audit FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert recruitment audit"
  ON nres_recruitment_audit FOR INSERT TO authenticated WITH CHECK (true);
