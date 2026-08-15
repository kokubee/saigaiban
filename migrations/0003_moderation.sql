ALTER TABLE reports ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'visible';
ALTER TABLE reports ADD COLUMN review_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE reports ADD COLUMN moderated_at TEXT;
ALTER TABLE reports ADD COLUMN moderated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_moderation ON reports(moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS report_flags (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_flags_report_created ON report_flags(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_flags_ip_created ON report_flags(ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS moderation_audit (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_audit_report_created ON moderation_audit(report_id, created_at DESC);
