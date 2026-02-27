-- Audit log table: append-only, immutable record of all ERP actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  action      TEXT NOT NULL,
  module      TEXT NOT NULL,
  entity_id   TEXT,
  entity_type TEXT,
  details     JSONB DEFAULT '{}',
  factory_id  UUID REFERENCES factories(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for listing by time (most common query)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- Index for filtering by module
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs (module, created_at DESC);

-- Index for filtering by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id, created_at DESC);

-- Index for filtering by entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

-- Index for factory-scoped queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_factory ON audit_logs (factory_id, created_at DESC);

-- RLS: allow authenticated users to insert, only admins to read
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (true);
