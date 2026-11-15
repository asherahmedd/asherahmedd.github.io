-- Run in the existing Cloudflare D1 database: portfolio-insights
-- Safe to execute more than once. Existing analytics tables remain unchanged.
CREATE TABLE IF NOT EXISTS visitor_journey_pages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 journey_hash TEXT NOT NULL,
 page_id TEXT NOT NULL UNIQUE,
 path TEXT NOT NULL,
 started_at TEXT NOT NULL,
 ended_at TEXT,
 active_ms INTEGER NOT NULL DEFAULT 0,
 source TEXT NOT NULL DEFAULT '',
 device TEXT NOT NULL DEFAULT 'other'
);
CREATE INDEX IF NOT EXISTS idx_journey_started
 ON visitor_journey_pages(started_at);
CREATE INDEX IF NOT EXISTS idx_journey_hash_started
 ON visitor_journey_pages(journey_hash,started_at);
