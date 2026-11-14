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

The tracker uses ephemeral memory-only IDs and sends no persistent cookies or cross-page identity. A privacy notice and opt-out remain available at `/portfolio-insights/privacy.html`. This technical approach does not guarantee a consent exemption in every jurisdiction; confirm applicable local and visitor-region requirements before relying on it. The database still retains event-level information for up to the configured retention period.\n