-- Returning visitor analysis: stores only one-way browser hashes, never raw cookie IDs.
-- Safe to execute repeatedly. Requires existing visitor_journey_pages table.
CREATE TABLE IF NOT EXISTS visitor_journey_owner (
 journey_hash TEXT PRIMARY KEY,
 browser_hash TEXT NOT NULL,
 first_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journey_owner_browser ON visitor_journey_owner(browser_hash);
CREATE INDEX IF NOT EXISTS idx_journey_owner_first_seen ON visitor_journey_owner(first_seen);
