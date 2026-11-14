CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ts TEXT NOT NULL,
 event TEXT NOT NULL,
 visitor TEXT NOT NULL,
 session TEXT NOT NULL,
 path TEXT NOT NULL,
 section TEXT NOT NULL DEFAULT '',
 item TEXT NOT NULL DEFAULT '',
 depth INTEGER NOT NULL DEFAULT 0,
 active_ms INTEGER NOT NULL DEFAULT 0,
 country TEXT NOT NULL DEFAULT 'Unknown',
 referrer TEXT NOT NULL DEFAULT '',
 device TEXT NOT NULL DEFAULT 'other'
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(event,ts);
CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session,ts);

-- Optional consented repeat-visit measurement; raw browser IDs are never stored.
CREATE TABLE IF NOT EXISTS identity_visitors (
 visitor_hash TEXT PRIMARY KEY,
 first_seen TEXT NOT NULL,
 last_seen TEXT NOT NULL,
 visits INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS identity_visits (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ts TEXT NOT NULL,
 visitor_hash TEXT NOT NULL,
 is_returning INTEGER NOT NULL CHECK(is_returning IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_identity_visits_ts ON identity_visits(ts);
CREATE INDEX IF NOT EXISTS idx_identity_visits_hash ON identity_visits(visitor_hash);
CREATE INDEX IF NOT EXISTS idx_identity_visitors_last_seen ON identity_visitors(last_seen);

-- Aggregated reporting attributes from visits that opted into analytics cookies.
-- Deliberately no raw IP, full user agent, personal name or visitor hash in this table.
CREATE TABLE IF NOT EXISTS visitor_context (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ts TEXT NOT NULL,
 country TEXT NOT NULL DEFAULT 'Unknown',
 region TEXT NOT NULL DEFAULT 'Unknown',
 city TEXT NOT NULL DEFAULT 'Unknown',
 timezone TEXT NOT NULL DEFAULT 'Unknown',
 network_org TEXT NOT NULL DEFAULT 'Unknown',
 asn INTEGER NOT NULL DEFAULT 0,
 device TEXT NOT NULL DEFAULT 'other',
 os TEXT NOT NULL DEFAULT 'Other',
 browser TEXT NOT NULL DEFAULT 'Other',
 referrer TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_visitor_context_ts ON visitor_context(ts);
