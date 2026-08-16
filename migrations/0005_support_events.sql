CREATE TABLE IF NOT EXISTS support_events (
  id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('supplies', 'meal', 'medical', 'bath', 'collection')),
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  eligibility TEXT,
  description TEXT,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'open', 'ended', 'check')),
  checked_at TEXT NOT NULL,
  contact_note TEXT,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS support_events_area_starts_idx ON support_events (area, starts_at);
