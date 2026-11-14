# Portfolio Insights

Privacy-conscious visitor analytics for [asherahmedd.github.io](https://asherahmedd.github.io/).

## Components

- `index.html` — web dashboard (GitHub Pages; dashboard shell is public, data is password-protected by the backend token).
- `tracker.js` — consent-gated browser event tracker; does not transmit any event without opt-in.
- `worker/` — Cloudflare Worker + D1 database (API and storage).
- `install_tracker.py` — optional script for installing the tracker across portfolio pages after API deployment and publishing the included privacy page.

## Deployment

1. Create a Cloudflare account. Install Node.js and run `npm install -g wrangler`.
2. In `worker/`, run `npx wrangler login` then `npx wrangler d1 create portfolio-insights`. Copy the `database_id` into `wrangler.toml`.
3. Run `npx wrangler d1 execute portfolio-insights --remote --file=schema.sql`.
4. Generate a random high-entropy token, e.g. `openssl rand -hex 32`; store it **only** with `npx wrangler secret put ADMIN_TOKEN`.
5. Run `npx wrangler deploy` from `worker/` and copy its HTTPS `workers.dev` URL.
6. Open `https://asherahmedd.github.io/portfolio-insights/`. Enter the Worker URL and your private admin token. URL is saved locally; token stays in browser memory only. **Do not put the token in git or HTML.**
7. After publishing a privacy notice/consent control, add `<script defer src="/portfolio-insights/tracker.js" data-endpoint="https://YOUR-WORKER.workers.dev"></script>` to each portfolio page. You can also use `install_tracker.py --endpoint https://YOUR-WORKER.workers.dev --repo /path/to/site` to add the tag in bulk; this script does not add a consent UI. Call `PortfolioInsights.enable()` only from an explicit opt-in action, and `disable()` on opt-out.
8. Dashboard starts showing **real** visits only after your deployed tracker begins collecting events. No historical traffic backfill is available.

## Privacy and security

- No IP address, full user agent, query string, typed chat prompt, user email, session replay or fingerprint is collected.
- Analytics identity is pseudonymous and created only after consent. `localStorage` visitor IDs can be cleared by browsers and do not reliably count real people across devices.
- Country comes from Cloudflare country metadata; country does not identify a person.
- Visitor scripts cannot identify recruiters or employers.
- The public dashboard frontend requires the backend admin token to obtain statistics. A static GitHub Pages URL cannot itself make a page private. For stronger privacy, host the dashboard behind Cloudflare Access instead of GitHub Pages.
- The Worker checks the expected site origin, but Origin headers can be spoofed. Add Cloudflare rate limiting or a challenge rule for `/track` if abused.
- The demo dataset in the dashboard is **fictional** and is never mixed with live records.
- Keep the `ADMIN_TOKEN` only in Cloudflare Workers secrets; never put credentials in GitHub, browser source, URLs, or commits.
- Add data retention/deletion policies appropriate for your audience and applicable privacy regulations. The included SQL does not automatically purge old events.

## Data captured

Page views, approximate unique visitor IDs/sessions, scroll depth thresholds, visible sections and active section time, project openings, blog openings, technology filter clicks, outbound clicks, coarse device type, country and referral hostname.

**Limitations:** ad blockers and privacy settings can prevent tracking; engaged time is an approximation; browser-reported activity isn't proof of reading. The data reports website interactions, not GitHub repository cloning, stars or visitors to the GitHub repo page.

## API

- `POST /track` — browser event collector; accepts events only from the configured site origin.
- `GET /stats?days=7|30|90` — admin-only analytics, requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `GET /health` — public non-sensitive health check.