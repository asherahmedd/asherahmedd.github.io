# Portfolio Starter + Live Analytics (Open Source)

A customizable, static portfolio website with a **no-code profile setup form**, responsive homepage, projects, contact links, privacy page and **optional** real visitor analytics backed by Cloudflare Workers + D1.

This reusable starter is based on the techniques used in [Muhammad Ashar's full portfolio](../../index.html) and its [original analytics project](../../portfolio-insights/README.md). The complete source of the personal portfolio, including its pages, visuals, and analytics infrastructure, is available in the [parent repository](https://github.com/asherahmedd/asherahmedd.github.io). This folder is the generic, privacy-conscious version: nobody needs to delete the original owner's personal information to start.

## What's included

| File | Purpose |
| --- | --- |
| `setup.html` | Fill a form and download your own `config.js`; no coding for profile content |
| `config.js` | Generated profile, projects, contact links, optional Worker URL |
| `index.html` | Mobile-friendly portfolio homepage |
| `privacy.html` | Visitor analytics transparency and opt-out |
| `analytics/tracker.js` | Real cookieless page/activity events; no fake visits |
| `analytics/index.html` | Live dashboard; reads only token-protected API |
| `worker/src/index.js` | Cloudflare Worker analytics API |
| `worker/schema.sql` | Database schema |
| `worker/wrangler.toml` | Worker deployment configuration |

## Part A — Publish your portfolio (no terminal needed)

1. Create a free GitHub account and a **new public repository** named `YOUR-USERNAME.github.io` (replace USERNAME with your actual GitHub username). Or use a normal repository name, in which case the URL includes `/REPOSITORY/`.
2. Download this GitHub repository as ZIP (**Code → Download ZIP**), unzip it, and open the folder `open-source/portfolio-starter`.
3. Open `setup.html` in your browser. Fill in your name, description, skills, project titles, contact links. Click **Download my config.js**. Replace the starter `config.js` with this downloaded file.
4. Upload the **contents** of `open-source/portfolio-starter` to your new GitHub repository root. GitHub's **Add file → Upload files** accepts folders via drag and drop in supported browsers. Keep the folder structure. Do **not** upload the entire parent repository to your own profile by mistake.
5. In your new repository choose **Settings → Pages → Deploy from a branch → main → /(root) → Save**.
6. Visit `https://YOUR-USERNAME.github.io/` after deployment; for a normal repo use `https://YOUR-USERNAME.github.io/REPOSITORY/`.
7. For changes later, use `setup.html` again and replace `config.js`, then commit. Your HTML/CSS needs no editing.

Your portfolio works at this point **without analytics**. It includes email/WhatsApp links instead of an unreliable third-party message form.

## Part B — Enable real analytics (optional, ~setup with terminal required)

Because the dashboard stores visitor statistics securely, you need a free Cloudflare account and a Worker+D1 database. GitHub Pages alone cannot run the server-side collection and protected dashboard API.

1. Install Node.js, then in a terminal open the `worker` directory and run `npx wrangler login` (approve Cloudflare access).
2. Run `npx wrangler d1 create portfolio-starter-insights`. Copy the **database_id** into `worker/wrangler.toml`.
3. Set `SITE_ORIGIN` in `wrangler.toml` to your exact portfolio **origin**, e.g. `https://YOUR-USERNAME.github.io` (no path, no trailing slash).
4. From inside the `worker` folder run `npx wrangler d1 execute portfolio-starter-insights --remote --file=schema.sql`.
5. Run `npx wrangler secret put ADMIN_TOKEN`. Enter a long random value (at least 32 unpredictable characters). **Never save this token inside the repository, setup form, config.js, a screenshot or a URL**.
6. Run `npx wrangler deploy`. Copy the printed `https://...workers.dev` URL.
7. Re-open `setup.html`, repeat your profile information and add that Worker URL under **Optional visitor analytics**, download the new `config.js` and upload it to GitHub. Alternatively, edit just `workerUrl` inside your existing `config.js` to preserve your profile details.
8. Open your deployed site's `/analytics/` dashboard, enter the Worker URL and private admin token, then click **Load live statistics**. Your browser may take a moment to load the latest code. Your own page visits should register unless privacy/opt-out controls prevent them.

**Important:** A Worker deployed without an active D1 binding or schema will not collect valid events. `GET /health` checks availability, but only an actual website visit + successful dashboard query proves full operation.

## Dashboard & privacy

- The tracker respects Global Privacy Control and Do Not Track, and has an opt-out stored in the browser.
- Data is real after activation; no fabricated numbers and no retrospective collection.
- The dashboard counts page-local ephemeral visitors/sessions, **not unique people**.
- Dashboard HTML is public on GitHub Pages. **Only analytics data is protected by the secret token.** If the dashboard itself must be private, put it behind Cloudflare Access.
- The Worker checks browser Origin, which can be spoofed. For abuse prevention, consider Cloudflare rate limits on `/track`.
- 90-day event retention is configured through a scheduled cleanup cron. Review regional privacy laws before activating.
- Cloudflare free tier limits and pricing can change; check your account dashboard.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Dashboard shows zeros | Worker URL in `config.js`, privacy opt-out, visit the live site, then check database |
| Unauthorized / 401 | Correct private admin token |
| Origin not allowed / CORS | `SITE_ORIGIN` must match the live site's origin exactly; redeploy Worker |
| Database errors | `database_id`, D1 schema, remote database |
| Profile did not update | Make sure you uploaded **your generated** `config.js`, not the old one |
| Contact links not opening | Check email and international phone format |

## Developer notes

This is an original reusable starter. Some analytics code is adapted from the public personal portfolio in the parent repository. The files contain **no owner-specific passwords or API keys**. Audit publicly uploaded content and choose your own license before redistributing. This starter makes no claim of automatic Cloudflare account creation or secret provisioning; those steps necessarily require account-owner authorization.
