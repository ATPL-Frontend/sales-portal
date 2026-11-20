# Hosting adaptation summary

Inspected the complete source from `.env.zip` and used the previously working `.github/workflows/main.yml` as a deployment reference. The `public(1).zip` and `controllers.zip` are from a separate earlier app; they were not merged into this portal.

## Created
- `.github/workflows/deploy-cpanel.yml` — GitHub Actions FTPS deploy, Vite site to the website root and compiled API to `/api/`.
- `client/public/.htaccess` — SPA route refresh fallback while keeping `/api` for Passenger.
- `server/app.js` — cPanel's default Passenger startup file, imports compiled `dist/index.js`.
- `server/.env.production.example` — cPanel environment variable example without credentials.
- `CPANEL_DEPLOYMENT.md` — setup, secrets, database, validation and troubleshooting.

## Updated
- `server/src/config/env.ts` — loads `/api/.env` after deployment; still supports repository-root `.env` in development. Native cPanel environment variables take priority.
- `server/src/index.ts` — supports Passenger mapping with and without preserved `/api` prefix; trusts one proxy for correct login rate-limiting IPs.
- `.gitignore` — ensures `.env`, dependencies and builds are not added to Git.
- `README.md` — points to deployment guide.

## Intentionally unchanged
- 3F Excel import/price parsing and MySQL schema, infinite scroll, roles/access, Tailwind light/dark theme, upload toast, scroll-to-top, and frontend API client (which already uses `/api` correctly).

## Important limitations
- cPanel Node application registration, database provisioning and initial `npm install --omit=dev` must be completed on the cPanel host.
- GitHub builds and copies code but does not execute schema migrations or install/upgrade dependencies on the host automatically (no SSH deployment credentials were provided).
- A full integration test on your actual cPanel account is impossible without access. Frontend/backend npm build was also unverified in this environment due to blocked npm downloads; TypeScript syntax and workflow YAML were checked.

## Security
- The supplied `.env` and old project credentials were **never included** in the output project. Store real variables in cPanel, not the repository or Vite's `VITE_*` variables.
