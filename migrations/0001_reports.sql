CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  area TEXT NOT NULL,
  seed_key TEXT,
  verdict TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_place_created ON reports(place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_area_created ON reports(area, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_ip_place ON reports(ip_hash, place_id, created_at DESC);
