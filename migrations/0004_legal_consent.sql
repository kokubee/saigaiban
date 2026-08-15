ALTER TABLE reports ADD COLUMN terms_version TEXT;
ALTER TABLE reports ADD COLUMN privacy_version TEXT;
ALTER TABLE reports ADD COLUMN consented_at TEXT;
ALTER TABLE report_flags ADD COLUMN terms_version TEXT;
ALTER TABLE report_flags ADD COLUMN privacy_version TEXT;
ALTER TABLE report_flags ADD COLUMN consented_at TEXT;
