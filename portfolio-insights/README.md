# Portfolio Insights

Privacy-conscious visitor analytics for [asherahmedd.github.io](https://asherahmedd.github.io/).

## Components

- `index.html` — web dashboard (GitHub Pages; dashboard shell is public, data is password-protected by the backend token).
- `tracker.js` — automatic, cookieless browser event tracker. Uses memory-only per-page IDs, respects browser privacy signals and the site's opt-out setting.
- `worker/` — Cloudflare Worker + D1 database (API and storage).
- `install_tracker.py` — optional script for installing the tracker across portfolio pages after API deployment and publishing the included privacy page.

## Deployment

1. Create a Cloudflare account. Install Node.js and run `npm install -g wrangler`.
2. In `worker/`, run `npx wrangler login` then `npx wrangler d1 create portfolio-insights`. Copy the `database_id` into `wrangler.toml`.
3. Run `npx wrangler d1 execute portfolio-insights --remote --file=schema.sql`.
4. Generate a random high-entropy token, e.g. `openssl rand -hex 32`; store it **only** with `npx wrangler secret put ADMIN_TOKEN`.
5. Run `npx wrangler deploy` from `worker/` and copy its HTTPS `workers.dev` URL.
6. Open `https://asherahmedd.github.io/portfolio-insights/`. Enter the Worker URL and your private admin token. URL is saved locally; token stays in browser memory only. **Do not put the token in git or HTML.**
7. After publishing the privacy notice, add `<script defer src="/portfolio-insights/tracker.js" data-endpoint="https://YOUR-WORKER.workers.dev"></script>` to each portfolio page. You can also use `install_tracker.py --endpoint https://YOUR-WORKER.workers.dev --repo /path/to/site` to add the tag in bulk; the tracker measures page activity without a popup, and users can opt out on `privacy.html`. It avoids persistent visitor identifiers.
8. Dashboard starts showing **real** visits only after your deployed tracker begins collecting events. No historical traffic backfill is available.

## Visitor Journey tracking (opt-in)

**Visitor Journeys** shows how a consenting visitor moves between portfolio pages, including the approximate active time on each page, popular page-to-page transitions, high-interest content and recent anonymous journeys. A random journey token is held in tab session storage and expires after 30 minutes of inactivity. The Worker stores only its one-way digest, page paths without query strings, page entry/exit timestamps and approximate active duration. It does **not** link this token to a named visitor or the separate persistent returning-browser cookie.

Journey data is recorded only after a new, explicitly informed opt-in. The expanded consent choice uses `portfolio_journey_consent_v3`; earlier consent decisions do not automatically authorize journey tracking. Browser privacy signals and site opt-out remain respected. Duration is an estimate based on visible-page recent interaction, not proof of reading. The dashboard shows aggregate page engagement and transitions, with the latest 12 anonymous tab journeys for inspection. Partial sessions and single-page exits may have unknown final durations.

### Activate in Cloudflare without installing software

1. Open the existing **D1 → portfolio-insights → Console**, paste the SQL from [visitor-journey-migration.sql](worker/visitor-journey-migration.sql), and execute it. This adds only `visitor_journey_pages` and indexes.
2. Open **Workers & Pages → ashar-portfolio-insights → Edit Code**, replace the existing code with the latest [worker/src/index.js](worker/src/index.js) and click **Deploy**.
3. On a fresh browser session visit the portfolio and choose **Allow analytics cookies**, then visit several portfolio project pages.
4. Open [Portfolio Insights](https://asherahmedd.github.io/portfolio-insights/), connect with your existing admin token, and inspect **Visitor Journeys**.

Older anonymous traffic cannot be converted into complete historical journeys. These records are purged after 90 days by the existing scheduled Worker cleanup, once the updated Worker is deployed.

## Visitor Intelligence: detailed analytics with explicit consent

The expanded **Visitor Intelligence** section displays country-level aggregate traffic from baseline measurements, plus the following optional, consent-based summaries: approximate city, region, timezone, internet network operator (Cloudflare ASN organization and ASN), broad browser, operating system and device categories, and referring website hostname.

**Network organization is NOT verified employment.** Most visitors may appear under an ISP, mobile carrier, VPN, hosting service, or public Wi-Fi provider. The data cannot identify a real person's name, LinkedIn profile or employer.

To protect visitor privacy, `visitor_context` deliberately stores no raw IP address, visitor hash, detailed user agent, email address or full referrer URL. Its results are aggregated by category; data is collected only from browser visits after accepting the updated **Allow analytics cookies** choice. Earlier opt-ins must reconfirm the expanded scope. The existing cookieless page tracking and opt-out continue without change.

### Cloudflare deployment for the enhanced visitor section (no Node.js)

1. In your existing **D1 database `portfolio-insights` → Console**, execute the statements in [visitor-context-migration.sql](worker/visitor-context-migration.sql). They use `CREATE TABLE IF NOT EXISTS`, preserving previous analytics.
2. In **Workers & Pages → ashar-portfolio-insights → Edit Code**, copy the updated [worker/src/index.js](worker/src/index.js) from GitHub, replace the Worker code and click **Deploy**.
3. Refresh the portfolio and use a fresh browser to **Allow analytics cookies**. Revisit the same browser to generate context data.
4. Open the authenticated [Portfolio Insights dashboard](https://asherahmedd.github.io/portfolio-insights/), select your period, and expand **Visitor Intelligence**.

If the new table is not yet deployed, baseline metrics continue working; detailed visitor breakdowns remain empty. No historical city/network context can be reconstructed from earlier anonymous traffic. Location fields can be absent, approximate or affected by VPNs. Existing retention cleanup purges visitor context after 90 days.

## Simple Insights dashboard (November 2026)

The default dashboard has an executive overview with four cards: **Total Visits** (page-local tracked visits, not people), **LinkedIn Traffic** (page views referred by identifiable LinkedIn referrers), **Project Views** (recorded project-link openings) and **Returning Visits** (only opted-in browsers). Below these are plain-English observations and three charts: **Visits over time**, **Where visitors came from**, and **Most popular projects**.

Detailed page loads, countries, devices, section time, scrolling, technology filters, blog interest, raw referring domains and other consented browser metrics are retained under the expandable **Advanced Analytics** section. No collection schema, API or Worker changes are required for this dashboard-only redesign.

Referral results are based on hostname-level referrals; LinkedIn may suppress referrer information. **Other / unknown** includes direct, hidden and other referring sources and is not equivalent to direct visits. Demo numbers are fictional and remain explicitly labeled. Comparisons with a prior time period are intentionally not shown without a backend comparison dataset. All time-range filters and live API validation remain supported.

## Time filters (November 2026 update)

The dashboard now offers **Last 1 hour, Last 1 day, Last 3 days, Last 1 week, Last 1 month**. These are rolling windows computed on the Worker at request time, not calendar-day boundaries. The chart aggregates into 5-minute intervals for one hour, hourly buckets for 1 or 3 days, and daily buckets for 1 week or 1 month. All other tables and KPIs use the selected same time window.

The frontend calls `GET /stats?hours=1|24|72|168|720`; legacy `?days=7|30|90` remains supported. **Deploy the updated `worker/src/index.js` with `npx wrangler deploy` inside the existing Worker directory** before trying the new filters against live data. A GitHub Pages commit alone does not redeploy an existing Cloudflare Worker. No schema migration or tracker change is required. Demo mode contains fictional data and does not reflect real filter windows.

**Visitors cannot be identified by name with this tracker**. It has no user names, LinkedIn identities, employer or person-level tracking. A volunteered contact method or a separately consented form would be needed to receive names.

## Corrected date range behavior and All time

The live dashboard supports Last 1 hour (5-minute buckets), Last 1 day and Last 3 days (hourly buckets), Last 1 week and Last 1 month (daily buckets), and **All time** (monthly buckets). Every API report uses the same cutoff on all KPIs, traffic sources, page activity, and consented visitor metrics.

**All time** requests `GET /stats?hours=0`, retrieving all **retained** database records. Existing scheduled retention deletes events older than 90 days; this is not lifetime history after deletion. Invalid `hours` values return an HTTP 400 instead of silently falling back to 30 days. The dashboard validates the Worker-returned `hours` field and refuses mismatched results, so a stale Cloudflare Worker cannot mislabel 30-day data as one-hour traffic.

**Action required**: publish the latest `worker/src/index.js` through **Cloudflare Workers & Pages → ashar-portfolio-insights → Edit Code → Deploy**. Updating GitHub alone updates the dashboard but **not** the deployed Worker. The dashboard's demo data is fictional 30-day data and deliberately does not respond to live date filters.

## Optional new versus returning browsers (consent-based)

Basic, cookieless page analytics remains enabled as before. A separate, non-blocking choice appears for optional repeat-visit recognition:

- **Allow analytics cookies:** sets an optional 90-day first-party browser cookie with a random ID, sends it only for the agreed purpose, and records a one-way digest on the server.
- **Reject optional cookies:** does not create a persistent visitor identifier; baseline cookieless measurements continue.
- **Withdraw:** visitors can revoke repeat-visit recognition at /portfolio-insights/privacy.html. This deletes the optional cookie and stops subsequent recognized visits. Previous records remain until 90-day retention cleanup.
- The dashboard displays new consenting browsers, returning visits and distinct opted-in browsers within the selected period. It cannot reveal names, LinkedIn profiles or employers.

### Required Cloudflare deployment

1. Open the existing portfolio-insights/worker directory.
2. Run: npx wrangler d1 execute portfolio-insights --remote --file=schema.sql
3. Run: npx wrangler deploy
4. Open the public site and test opt-in recognition in a browser, then revisit and refresh the private Insights dashboard.

CREATE TABLE IF NOT EXISTS protects existing analytics data. The worker keeps baseline stats available before the new database tables are deployed. GitHub Pages updates do not redeploy Cloudflare Workers automatically.

The dashboard's /stats response includes repeat.new_browsers, repeat.returning_visits, repeat.consented_visits and repeat.distinct_consented_browsers. These are consenting browser counts, not actual distinct people. The /identity endpoint receives an opted-in random UUID over HTTPS and stores a salted SHA-256 digest, not the raw value. Keep ADMIN_TOKEN secret. This is pseudonymous data, so review applicable legal requirements.

## Privacy and security

- No IP address, full user agent, query string, typed chat prompt, user email, session replay or fingerprint is collected.
- Each page generates an ephemeral ID in memory; the tracker does not store an analytics visitor ID or cookie. The dashboard can report visits and page activity, **not unique people**. Only the analytics opt-out preference is stored in `localStorage`.
- Country comes from Cloudflare country metadata; country does not identify a person.
- Visitor scripts cannot identify recruiters or employers.
- The public dashboard frontend requires the backend admin token to obtain statistics. A static GitHub Pages URL cannot itself make a page private. For stronger privacy, host the dashboard behind Cloudflare Access instead of GitHub Pages.
- The Worker checks the expected site origin, but Origin headers can be spoofed. Add Cloudflare rate limiting or a challenge rule for `/track` if abused.
- The demo dataset in the dashboard is **fictional** and is never mixed with live records.
- Keep the `ADMIN_TOKEN` only in Cloudflare Workers secrets; never put credentials in GitHub, browser source, URLs, or commits.
- The included Worker has a daily scheduled cleanup that deletes events older than 90 days after you deploy the configured cron trigger. Review retention requirements for your audience and applicable laws.

## Data captured

Page views and page-local sessions (not unique people), scroll depth thresholds, visible sections and active section time, project openings, blog openings, technology filter clicks, outbound clicks, coarse device type, country and referral hostname.

**Limitations:** the automatic, cookieless design intentionally cannot deduplicate people across page loads. Browser privacy controls, legal requirements and ad blockers may restrict measurement; engaged time is an approximation; browser-reported activity isn't proof of reading. The data reports website interactions, not GitHub repository cloning, stars or visitors to the GitHub repo page.

## API

- `POST /track` — browser event collector; accepts events only from the configured site origin.
- `GET /stats?days=7|30|90` — admin-only analytics, requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `GET /health` — public non-sensitive health check.
## Analytics without a consent popup

The baseline tracker uses ephemeral memory-only IDs and sends no persistent cookies or cross-page identity. A privacy notice and opt-out remain available at `/portfolio-insights/privacy.html`. This technical approach does not guarantee a consent exemption in every jurisdiction; confirm applicable local and visitor-region requirements before relying on it. The database still retains event-level information for up to the configured retention period.\n