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
