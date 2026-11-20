# Ampec Sales Portal — cPanel-ready starter

**Deploying to cPanel?** Read [`CPANEL_DEPLOYMENT.md`](CPANEL_DEPLOYMENT.md) first. The GitHub Actions workflow builds the Vite frontend into the website root and the compiled Node.js API into `/api/`. All upload/search/theme/permissions features from your current source are preserved. Real `.env` files are intentionally excluded.

---

# Ampec Sales Portal — Tailwind Starter

Minimal, responsive starter for a company sales support portal. This package intentionally contains **no cable price upload, PDF/Excel parsing, catalogue search, or supplier modules** yet.

## Stack

- **Web:** Vite 6, React 18, TypeScript, Tailwind CSS 4, React Router, Lucide icons
- **API:** Node.js 22, Express 5, TypeScript, Zod, HTTP-only JWT session cookie
- **DB:** MySQL 8 / mysql2 connection pool, roles, permissions, users, activity audit log
- **Tooling:** npm workspaces. Frontend and backend run together with one command.

## Quick setup (Windows / local)

**Prerequisites:** Node.js 20.19+ (Node 22 recommended), npm, and either MySQL 8 or Docker Desktop.

### Step 1 — Start MySQL

**Option A: Docker (no MySQL installation required)**

```powershell
docker compose up -d
```

This creates the local MySQL 8.4 instance on port `3306` with credentials matching `.env.example`.

**Option B: Install MySQL 8 Community Server + Workbench**

In MySQL Workbench, sign in as the MySQL root account and run:

```sql
CREATE DATABASE IF NOT EXISTS cable_price_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cable_portal'@'localhost' IDENTIFIED BY 'change_this_db_password';
GRANT ALL PRIVILEGES ON cable_price_portal.* TO 'cable_portal'@'localhost';
-- If your MySQL installation distinguishes TCP (127.0.0.1) from 'localhost':
CREATE USER IF NOT EXISTS 'cable_portal'@'127.0.0.1' IDENTIFIED BY 'change_this_db_password';
GRANT ALL PRIVILEGES ON cable_price_portal.* TO 'cable_portal'@'127.0.0.1';
```

Use **one** of these options. If MySQL is already running on port `3306`, don't start Docker on the same port. Update the password in both MySQL and `.env` if you change it.

### Step 2 — Configure environment

```powershell
Copy-Item .env.example .env
```

In `.env`, verify the `DB_*` values and replace `JWT_SECRET` with a 32+ character random string. Generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Step 3 — Install and initialize

From the project **root folder**:

```powershell
npm install
npm run db:setup
npm run db:seed
npm run dev
```

- **Website:** http://localhost:5173
- **API:** http://localhost:4000
- **API & MySQL health:** http://localhost:4000/api/health

Seeded super admin for **local development only**:

```text
Email:    atplgraphics@gmail.com
Password: 12345678
```

The password is hashed in MySQL; the app **requires a new 12+ character password on first login**. The seed will not reset an existing user's password. Do not expose the initial credentials to the internet.

### Step 4 — Check types and build

```powershell
npm run typecheck
npm run build
```

## Structure

```text
ampec-sales-portal-tailwind/
├── client/
│   ├── src/
│   │   ├── app/                    # Routes, auth guards
│   │   ├── components/
│   │   │   ├── layout/             # Responsive app shell, navigation
│   │   │   └── ui/                 # Buttons, inputs, dialogs, notices
│   │   ├── features/
│   │   │   ├── auth/               # Login and current session provider
│   │   │   ├── dashboard/          # Minimal overview
│   │   │   ├── team/               # Users, roles and permissions
│   │   │   └── settings/           # Account and password settings
│   │   ├── lib/                    # Typed API client
│   │   ├── main.tsx
│   │   └── styles.css              # Tailwind import ONLY; no handwritten CSS
│   ├── vite.config.ts              # React + Tailwind v4 plugins, API proxy
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/                 # Environment and MySQL pool
│   │   ├── middleware/             # Authentication and role authorization
│   │   ├── routes/                 # Auth and admin endpoints
│   │   ├── scripts/                # DB setup and default-role seed
│   │   ├── services/               # User queries and audit log
│   │   └── utils/                  # HTTP error classes
│   ├── sql/schema.sql              # Minimal schema
│   └── package.json
├── .env.example
├── docker-compose.yml
└── package.json                   # Workspaces and root commands
```

## What's implemented

- Login/logout/session, first-login password change
- Super admin can create users and edit status/roles, create roles and edit their permission assignments
- MySQL-backed RBAC; API checks server-side on each request
- Audit events recorded in MySQL (API endpoint available; no cluttering dashboard with an activity feed)
- Mobile-friendly Tailwind layout with simple overview, Team, Roles & Settings pages

## Adding a feature later

1. Create a new folder in `client/src/features/` (for example `features/cable-prices/`).
2. Create an Express router in `server/src/routes/` and register it in `server/src/index.ts`.
3. Add database migrations/tables under `server/sql/` (prefer numbered migrations as the schema evolves).
4. Apply `authenticate` + `requirePermission('your-feature:action')` to API routes. Seed the new permission in `server/src/scripts/seed.ts`.
5. Add a protected route to `client/src/app/App.tsx` and an actual menu entry to `components/layout/AppShell.tsx` when the feature is ready.

Future cable-pricing features are intentionally **not** present in the UI. Existing reserved `prices:*` permissions are placeholders and do not grant any current pricing API access.

## Notes

- Tailwind is configured using the official `@tailwindcss/vite` plugin. `client/src/styles.css` contains only `@import "tailwindcss";` — all UI styling is composed using utility classes.
- API routes are restricted using backend logic. Hiding a navigation item is **not** authorization.
- `/api/admin/*` currently requires super admin; delegation to other roles can be implemented explicitly later.
- The Node API uses Express 5 for proper handling of rejected async route promises.
- Development MySQL credentials in `.env.example` and `docker-compose.yml` are for local use only.
- This source package has not undergone a production security audit; add HTTPS, deployment configuration, CSRF protections appropriate to the hosting setup, persistent session revocation, backups, monitoring and tests before deploying publicly.

---

## 3F Holdings Price List (new module)

The existing authentication, users, roles, and Tailwind layout are retained. A **Price List** sidebar group now contains **3F Holdings** (`/price-list/3f`). The module requires the `prices:read` permission; the Import Excel button and API require `prices:upload`. The existing `super_admin` role has both. After updating an older installation, **run `npm run db:setup` and `npm run db:seed` again** to add the new SQL tables and grant permissions (the seed does not reset an existing admin's password).

### Import workflow

1. Sign in and select **Price List → 3F Holdings**.
2. Choose **Import Excel** (users with upload permission only).
3. Select a `.xls` or `.xlsx` file (max **8 MB**) and select its **effective month**. This is deliberately entered by the user: the sample's quotation date is September 1, 2026, but the filename describes a November 2026 price tier.
4. Preview all discovered worksheets. They can increase/decrease between versions. For each sheet, the importer locates the *Item*, *Description*, *Unit Price/Roll (Based on LME/ton)* range labels, *Packing(Roll)*, and *MOQ*.
5. By default it selects **one yellow-highlighted price range per sheet** (including native legacy `.xls` BIFF8 highlights). If no unambiguous yellow is found, the user **must select** a tier from that sheet's dropdown. A selected tier can always be changed manually.
6. Preview warnings for rows with a missing description or nonnumeric selected price. The importer refuses to import until every worksheet has a tier selected.
7. Confirm import. MySQL saves the normalized product rows and the supplier/month/source metadata. The newest successful import becomes **active**; previous imports remain available from the **month selector** in the search screen. Importing the exact same file twice for the same month is blocked.

The three-sheet supplied sample produces **44 valid items across six categories** and **3 warnings** (product rows with a price but no description) using the yellow **14301-14600 / AB** tier. Prices are rounded to 2 decimals. The Excel source file is *not* included in this project ZIP and is not saved as a binary blob; its normalized searchable data and SHA-256 fingerprint are stored.

### Search view

The visible table columns are **UL | Description | Price (USD) | Price Range | Packing / Roll | MOQ**. Category is shown as a small secondary label beneath the description. You can search by AWG, description, UL, or category, filter by category, paginate results, and choose a previous monthly snapshot.

### Source files added or changed

| Path | Purpose |
|---|---|
| `server/sql/schema.sql` | New `price_suppliers`, `price_imports`, `price_items` tables and indexes |
| `server/src/features/prices/workbook.ts` | Dynamic XLS/XLSX parsing, yellow-header detection, section/UL grouping and row validation |
| `server/src/features/prices/routes.ts` | Permission-checked preview, transactional import, month/version queries and search APIs |
| `server/src/index.ts` | Registers price list API routes and handles file size errors |
| `server/src/scripts/seed.ts` | Descriptions of live pricing permissions |
| `server/package.json` | the patched `@e965/xlsx` alias, `exceljs`, `cfb`, `multer` and TypeScript types |
| `client/src/features/prices/types.ts` | Shared frontend price list data types |
| `client/src/features/prices/Import3FDialog.tsx` | Excel import, sheet-by-sheet tier selection and validation preview |
| `client/src/features/prices/ThreeFPricePage.tsx` | Responsive searchable pricing table, filters and history |
| `client/src/components/layout/AppShell.tsx` | Price List → 3F Holdings sidebar submenu |
| `client/src/app/App.tsx` | Protected `/price-list/3f` route |
| `client/src/lib/api.ts` | Multipart upload helper |
| `client/src/components/ui/Dialog.tsx` | Supports a wider preview dialog |

### API routes

- `GET /api/price-lists/suppliers` — supplier registry, requires `prices:read`
- `GET /api/price-lists/3f/meta` — latest version, history, categories, requires `prices:read`
- `GET /api/price-lists/3f/items?q=&category=&page=1&limit=20&version=` — search active or historical prices, requires `prices:read`
- `POST /api/price-lists/3f/preview` — multipart `workbook` and `selections` JSON, requires `prices:upload`
- `POST /api/price-lists/3f/import` — multipart `workbook`, `month` (`YYYY-MM`), and `selections` JSON, requires `prices:upload`

### Extension points for future suppliers

Create a separate parser under `server/src/features/prices/` for suppliers with different column layouts, add a supplier record to `price_suppliers`, expose matching routes, and add the supplier link under `client/src/components/layout/AppShell.tsx`. The `price_imports` and `price_items` storage pattern is already supplier/version-aware.

### Testing and security notes

This is a local-development starter. Test the workbook preview against each new template. The parser accepts Excel files only and rejects files over 8 MB; workbook and row counts are limited. Uploads are parsed in memory, not placed in a public web folder. SQL uses parameterized queries, and preview/import endpoints independently verify permissions. Before public deployment, add CSRF protection to cookie-authenticated write endpoints, malware scanning, HTTPS, import rate limiting, and operational backups. Check `npm audit` and upgrade the Excel parsing library as fixes become available.

To inspect a local supplier file from the command line **without importing or connecting to MySQL**, run:

```bash
npm run check:3f -- "C:\Users\YourName\Downloads\3F-prices.xls"
```

The command prints the detected tiers, valid-row counts and warnings without storing anything.
