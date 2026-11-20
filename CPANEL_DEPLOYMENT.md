# Ampec Sales Portal — GitHub Actions to cPanel

This configuration is based on the GitHub workflow you supplied, adapted to **this** Vite + Express 5 + TypeScript + MySQL codebase. The existing features are preserved. The workflow deploys *compiled output*, not TypeScript source.

## 1) Hosting layout

Repository (GitHub):

```text
ampec-sales-portal/
  .github/workflows/deploy-cpanel.yml
  client/             React/Vite + Tailwind
    public/.htaccess  React Router fallback
  server/             Express/TypeScript + MySQL
    app.js            cPanel Passenger startup file
    src/              API source
  package-lock.json   workspace dependency lock
```

When the workflow runs, it sends:

```text
FTP WEBSITE ROOT (CPANEL_WEB_DIR, defaults to /)
  index.html
  assets/
  .htaccess            (React Router fallback)

FTP API APP ROOT (CPANEL_API_DIR, defaults to /api/)
  app.js               (Passenger startup file)
  package.json         (API runtime packages)
  dist/                (compiled JavaScript)
  tmp/restart.txt      (Passenger reload trigger)
```

**Preferred security layout:** keep the Node application root `api` **outside** the publicly served website document root, while mapping its **Application URL** to `/api` using cPanel's *Setup Node.js App* / *Application Manager*. An FTP account rooted at the site docroot may not be able to reach a sibling private `api` folder; use hosting paths/FTP access that can address both destinations. If your earlier setup placed `/api` inside the docroot and worked, you can use that layout temporarily, but it is less safe because misconfiguration can expose source code or configuration files. Never place a real `.env` in a publicly reachable folder without confirming the web server blocks access. Use cPanel environment variables where possible.

**Important:** `CPANEL_WEB_DIR` and `CPANEL_API_DIR` are **FTP server paths**, not URLs or necessarily absolute filesystem paths. They must point to **two separate deployment targets**. Your previous FTP configuration used `/` and `/api/`; verify these are still correct for the selected FTP account. Do not set `dangerous-clean-slate` to `true`.

## 2) cPanel requirements and initial setup

- HTTPS enabled for the web domain (required for secure session cookies).
- Node.js 22 recommended (>=20.19) **with Passenger/Setup Node.js App support** on the cPanel server.
- MySQL database and DB user created in cPanel, with access to that database.
- FTP/FTPS account whose document-root mapping matches the two workflow paths. FTPS (encrypted port 21) must be supported.
- In cPanel, create a Node application:
  - **Application root**: `api` (the directory that receives `app.js` and `dist/`)
  - **Application URL**: `https://YOUR-DOMAIN/api` (route prefix `/api`)
  - **Startup file**: `app.js`
  - **Node version**: 22 (or supported 20.19+)
  - **Mode**: Production
- Ensure the site document root has the built Vite static files.

CPanel versions differ. Some screens say *Setup Node.js App*, others *Application Manager*. The workflow **does not create** the Node application or MySQL database; this one-time setup is done in cPanel.

## 3) Production environment variables — stored in cPanel, NOT GitHub

Open your cPanel Node app's environment variable screen and configure:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | `https://YOUR-DOMAIN` (exact scheme and host, no trailing slash) |
| `DB_HOST` | usually `localhost` (confirm with hosting provider) |
| `DB_PORT` | `3306` unless host specifies otherwise |
| `DB_NAME` | cPanel-prefixed MySQL database name |
| `DB_USER` | cPanel-prefixed MySQL username |
| `DB_PASSWORD` | actual database password |
| `JWT_SECRET` | securely generated secret of at least 32 characters |

Do **not** set `PORT` unless the provider requires it; Passenger normally supplies one. The API supports `/api/*` whether Passenger strips `/api` before forwarding or preserves it.

If your cPanel does not expose an environment variable editor, store a private `.env` in the **Node application root**, not the site document root. See `server/.env.production.example`; the runtime now looks for `<app-root>/.env` and falls back to the repository root during local development. FTP deployment deliberately excludes `.env` so that deployment cannot overwrite secrets.

⚠️ Your supplied `.env.zip` contained an actual `.env`. It is **not included in the output ZIP**. If it or other credentials were ever pushed to GitHub or placed in a public web directory, rotate the database and JWT credentials.

## 4) GitHub configuration

Create a repository (private recommended), push this project's files to `main`. The workflow reuses the environment name from your previous working GitHub Action (`Production - atpl-dhaka`, with an en dash in the actual name). If your current repository uses a different environment, change the `environment` line in the workflow before deploying.

Set GitHub **Actions secrets** (Repository > Settings > Secrets and variables > Actions):

- `FTP_HOST`
- `FTP_USERNAME`
- `FTP_PASSWORD`

Optional **Actions variables** for different FTP roots:

- `CPANEL_WEB_DIR` (default `/`)
- `CPANEL_API_DIR` (default `/api/`)

Paths must end with `/`, and the two destination folders must not overlap. The workflow uses FTPS port 21. Edit `deploy-cpanel.yml` if your hosting provider uses a different FTPS port or needs SFTP/SSH instead.

**Do not put DB passwords or JWT secrets into Vite `VITE_*` variables**: Vite embeds those in public browser JavaScript. The application uses same-origin API requests to `/api`, so no `VITE_API_URL` is needed.

## 5) First deployment

```bash
git init
git add .
git commit -m "Prepare Ampec Sales Portal for cPanel"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPO.git
git push -u origin main
```

If your existing repository already has the older `.github/workflows/main.yml` deployment, delete or disable it before enabling this new workflow; otherwise two workflows could upload to the same cPanel folders.

The GitHub Action (Actions tab) will:

1. Run `npm ci` from the **repository root** using the workspace lockfile.
2. Typecheck then build server and Vite client.
3. Verify the expected build files exist.
4. Upload `client/dist/` to the web root, including SPA `.htaccess`.
5. Upload `server/dist/`, `app.js`, `package.json`, `tmp/restart.txt` to `/api/`.

**One-time Node dependencies on cPanel**: go to the Node application and click **Run NPM Install** after the first deployment, or SSH into the API app root and run `npm install --omit=dev`. This is necessary because uploading source with FTP cannot install server dependencies. The server's `package.json` can stand alone in the `api` directory; it doesn't need the root workspace lockfile at runtime. Re-run NPM Install whenever backend dependencies change.

The workflow creates `tmp/restart.txt` to request a Passenger restart. On some cPanel installations, a *Restart* click is needed after installing modules or changing environment variables.

## 6) Database setup

Run your existing `server/sql/schema.sql` through **phpMyAdmin** on the cPanel MySQL database. This contains idempotent table definitions for authentication, permissions and 3F prices; import to a **backup** before changing an existing production database. Do not run seed automatically on every deployment.

To seed the initial admin only if needed, use the existing setup scripts with a correctly configured environment, or create it via an approved one-time admin initialization process. The initial seed password must be changed immediately; do **not** retain the default password in production. Preserve users and permissions when uploading new releases.

## 7) Check the deployment

- `https://YOUR-DOMAIN/` — Vite React app
- `https://YOUR-DOMAIN/login` — SPA route should load after direct refresh
- `https://YOUR-DOMAIN/api/health` — JSON with `status: "ok"` when MySQL works
- Log in and visit `/price-list/3f`; import a test workbook and check MySQL.

If the homepage works but the API shows 404/503, verify the `/api` Node application URL, startup file `app.js`, Node version, `dist/` directory, environment variables, installed dependencies, cPanel error logs and restart status. If the API returns 500 at `/api/health`, check DB connection credentials. If direct refresh `/price-list/3f` returns 404, check the published web-root `.htaccess` and Apache mod_rewrite.

## 8) Security & maintenance

- Protect `api` source and `.env` from public web access. Putting the Node app outside the web document root is safest.
- Keep HTTPS enabled, don't expose DB credentials in GitHub source or Vite output.
- Rotate credentials if they were ever committed, even if deleted later.
- Make MySQL backups before first setup and before schema changes.
- Never run `npm run db:seed` on every GitHub push. It can reset or recreate privileged test accounts if mishandled.
- cPanel deploy does not automatically run database migrations or install changed server dependencies. Add those steps later with an audited SSH workflow if your provider supports SSH.
- Review rate limits, login auditing and CSRF protection before opening the portal to the public internet.
