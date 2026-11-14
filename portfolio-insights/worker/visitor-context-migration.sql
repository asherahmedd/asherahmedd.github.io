-- Execute once in Cloudflare D1 Console for database: portfolio-insights
-- Adds optional aggregated context for visitors who accepted analytics cookies.
-- Existing events and identity records are not changed or deleted.
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
