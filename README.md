# EVGrid — Electric Vehicle Charging & Energy Management

EVGrid is a two-part application:

| Part | Stack | Location | Default URL |
|---|---|---|---|
| Frontend | React 18 + Vite + Tailwind + shadcn/ui | `src/` | http://localhost:5173 |
| Backend | Node.js + Express + MySQL (`mysql2`) | `backend/` | http://localhost:5000/api |

The frontend never talks to MySQL. It calls the REST API through
`src/api/` (`client.js` → `resources.js` → `index.js`); the API contract is
documented in [docs/BACKEND-ENDPOINTS.md](docs/BACKEND-ENDPOINTS.md) and the
database structure lives in `backend/db/schema.sql`.

---

## 1. Requirements

- **Node.js 18 or newer** (20+ recommended) — `node --version`
- **MySQL 8** running locally (or reachable over the network)
- npm 9+

---

## 2. Install

```bash
npm install
```

This installs both the frontend and the backend dependencies — there is a
single `package.json` at the project root.

---

## 3. Configure

### 3.1 Frontend — `.env` (project root)

Already present. It only contains public values:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_API_PROXY_TARGET=http://localhost:5000
```

### 3.2 Backend — `backend/.env`

Create your private copy from the template and fill in your MySQL credentials:

```powershell
# Windows PowerShell
copy backend\.env.example backend\.env
```

```bash
# macOS / Linux
cp backend/.env.example backend/.env
```

Then edit `backend/.env`:

| Variable | Required | Notes |
|---|---|---|
| `DB_HOST` | yes | e.g. `127.0.0.1` |
| `DB_PORT` | yes | e.g. `3306` |
| `DB_USER` | yes | e.g. `root` |
| `DB_PASSWORD` | yes | **your** MySQL password |
| `DB_NAME` | yes | e.g. `evgrid` (created by `db:setup`) |
| `JWT_SECRET` | production | generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `SMTP_USER` | production | Gmail address that sends verification codes — see §3.3 |
| `SMTP_PASSWORD` | production | 16-character Google **App Password** (not your account password) |
| `PORT` | no | defaults to `5000` |
| `CORS_ORIGINS` | no | defaults to `http://localhost:5173` |

> `backend/.env` holds database and mail credentials and must never be committed
> or copied into anything the browser can read. Only the root `.env` (the
> `VITE_*` values) is exposed to the frontend.

### 3.3 Email delivery — Gmail SMTP

Verification codes are sent with Nodemailer over Gmail. Gmail rejects your
normal account password, so you must create an **App Password**:

1. Open <https://myaccount.google.com/security> and turn on **2-Step
   Verification** (App Passwords do not exist without it).
2. Open <https://myaccount.google.com/apppasswords>, name the app `EVGrid` and
   click **Create**.
3. Google shows a 16-character password in four groups, e.g.
   `abcd efgh ijkl mnop`. Put the Gmail address and that password in
   `backend/.env`:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=noreply.evgrid@gmail.com
   SMTP_PASSWORD=abcdefghijklmnop
   MAIL_FROM_NAME=EVGrid
   ```

   Spaces in the app password are stripped automatically, so you can paste it
   exactly as Google displays it. Never commit this file.

4. Restart the API with `npm run server`. A successful check prints:

   ```
   [evgrid] SMTP ready — verification email is sent from noreply.evgrid@gmail.com.
   ```

   A wrong password prints `SMTP login failed: Invalid login: 535-5.7.8 ...`
   together with the fix.

| Setting | Default | Notes |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | any SMTP host works |
| `SMTP_PORT` / `SMTP_SECURE` | `465` / `true` | use `587` + `false` for STARTTLS |
| `SMTP_USER` / `SMTP_PASSWORD` | — | both required to enable delivery |
| `MAIL_FROM` | `SMTP_USER` | overrides the `From:` address |
| `MAIL_FROM_NAME` | `EVGrid` | display name on the `From:` header |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | minimum wait between two codes |
| `OTP_RESEND_WINDOW_MINUTES` | `15` | length of the resend window |
| `OTP_MAX_SENDS_PER_WINDOW` | `5` | codes allowed per window, per address |

If `SMTP_USER` / `SMTP_PASSWORD` are empty, **development** still works: the
code is printed in the API terminal and returned in the response. In
**production** registration answers `503` instead of silently accepting users
who can never verify.

---

## 4. Create the database and tables

```bash
npm run db:setup
```

The script connects with the `DB_*` values, creates the database if it does not
exist and applies `backend/db/schema.sql` (15 tables, `CREATE TABLE IF NOT
EXISTS`, safe to re-run). **It inserts no rows** — station data comes from
`npm run seed` (§4.1) and every other record is created through the API.

### 4.1 Sample charging stations (optional)

```bash
npm run seed
```

Seeds a realistic Hyderabad network so the app can be tested without an admin
account: 3 operators, 9 charging stations, 28 charging points and 9 active
tariffs, all written to MySQL through the same connection pool the API uses
(nothing is hardcoded in the frontend).

| Station | Points | Max power | Tariff |
| --- | --- | --- | --- |
| Hitec City Cyber Towers EV Hub | 3 | 120 kW | ₹19.50/kWh |
| Gachibowli Stadium Charging Plaza | 3 | 150 kW | ₹21.00/kWh |
| Banjara Hills Road No. 12 ChargePoint | 3 | 60 kW | ₹17.00/kWh |
| Jubilee Hills Check Post Fast Charge | 3 | 100 kW | ₹20.00/kWh |
| Kondapur Botanical Garden EV Station | 3 | 50 kW | ₹16.50/kWh |
| Secunderabad Railway Station EV Park | 4 | 120 kW | ₹19.00/kWh |
| Kukatpally Forum Mall Charging Bay | 3 | 60 kW | ₹18.00/kWh |
| LB Nagar Metro EV Hub | 3 | 90 kW | ₹18.50/kWh |
| RGIA Airport EV Charging Court | 3 | 150 kW | ₹22.00/kWh |

The script is **idempotent** — every row is matched on a stable natural key
(operator name / station name / station+point code / station+tariff name) and
updated in place, so re-running it never creates duplicates. It only writes to
`operators`, `charging_stations`, `charging_points` and `tariffs`; it never
deletes a row and never touches `users`, `bookings`, `payments` or
`charging_sessions`.

---

## 5. Run

Open two terminals:

```bash
# Terminal 1 — API on http://localhost:5000/api
npm run server

# Terminal 2 — frontend on http://localhost:5173
npm run dev
```

`npm run server:dev` starts the API with Node's watch mode (auto-restart on
change).

### Verify the connection

```bash
curl http://localhost:5000/api/health
```

```json
{ "status": "ok", "db": "connected", "latency_ms": 1.2, "environment": "development", "uptime": 12 }
```

If MySQL is unreachable the endpoint answers `503` with
`{ "status": "error", "db": "disconnected", ... }` and the message explains what
to fix. The Settings page in the app performs the same check.

---

## 6. First use

1. Open http://localhost:5173/register and register with an email + password.
2. The API generates a real, hashed, time-limited verification code and emails
   it from the Gmail account configured in §3.3. Without SMTP credentials
   (development only) the code is printed in the API terminal and returned in
   the response body as `otp` instead.
3. Enter the code on the OTP screen — you are signed in with a JWT.
4. Open **Discover**. With the sample data from §4.1 loaded you can filter by
   city (`Hyderabad`), connector or power, open a station, and reserve a slot —
   no `admin` account required. Every viewer sees the same network; only
   operator/admin roles can edit stations.

To obtain an `admin` account, register normally and then promote yourself once:

```sql
UPDATE users SET app_role = 'admin', role = 'admin' WHERE email = 'you@example.com';
```

An admin (or operator) account is only needed to *create or edit* stations,
points and tariffs from the Operator / Admin pages. The sample network is
already populated, so the EV-user flows (bookings, sessions, payments) are
reachable immediately.

---

## 7. API overview

Base URL `http://localhost:5000/api`. All routes except the ones listed below
require `Authorization: Bearer <JWT>`.

| Area | Routes |
|---|---|
| System | `GET /health` (public) |
| Auth | `POST /auth/register`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/logout`; `GET`/`PATCH /auth/me`; `GET /auth/oauth/:provider` |
| Operations | `POST /functions/create-booking`, `/functions/charging-session`, `/functions/process-payment` |
| Resources | `users`, `operators`, `charging-stations`, `charging-points`, `bookings`, `charging-sessions`, `payments`, `vehicles`, `notifications`, `maintenance-records`, `technicians`, `tariffs`, `reviews`, `favorites`, `audit-logs` |

Each resource exposes the same nine routes:

```
GET    /<resource>?<filters>&sort=-created_date&limit=20&skip=0   -> { items, total }
GET    /<resource>/count?<filters>                                -> { count }
GET    /<resource>/aggregate?<filters>&sum=amount                 -> { rows: [{ sum_amount, count }] }
GET    /<resource>/:id                                            -> object
POST   /<resource>                                                -> created object
PATCH  /<resource>/:id                                            -> updated object
DELETE /<resource>/:id                                            -> 204
PATCH  /<resource>/bulk   { items: [{ id, ...patch }] }
POST   /<resource>/bulk   { items: [ { ...record } ] }
```

Extra: `POST /users/invite` `{ email, app_role }` (admin only).

Filters: `?status=paid`, `?status[$in]=paid,pending`, `?max_power_kw[$gte]=50`,
`?search=volt`. Supported operators: `$eq $ne $gt $gte $lt $lte $in $nin $like
$exists`.

Errors are always `{ "message": "...", "code": "...", "details": {} }`.

---

## 8. Project layout

```
backend/
  server.js                 Express app, CORS, JSON, health, graceful shutdown
  config/env.js             env loading (dotenv) + DB pool options
  config/db.js              mysql2 pool, query helpers, transactions
  controllers/              crud, auth, functions, users, health
  middleware/               auth (JWT), error handler, 404
  routes/                   index, auth, functions, per-resource router
  utils/                    registry, query builder, validation, serialisation,
                            schema introspection, ids, JWT, bcrypt, mailer
                            (Nodemailer/Gmail SMTP), resend throttle
  db/schema.sql             15-table MySQL 8 schema (structure only)
  db/setup.js               npm run db:setup
  db/seed.js                npm run seed (sample Hyderabad network)
  .env.example              environment template (no credentials)
src/                        React frontend
docs/BACKEND-ENDPOINTS.md   the API contract
```

### Design notes

- **No hand-written column lists.** Column names, types, enums and nullability
  are read from `INFORMATION_SCHEMA` at runtime (`utils/schemaCache.js`), so the
  same code validates, filters, sorts and serialises every resource.
- **Parameterised SQL everywhere.** Values are always bound; identifiers are
  validated against the live schema and back-quoted (`utils/queryBuilder.js`).
- **Transactions** wrap booking creation, the session start/stop lifecycle and
  payment settlement, so partial writes cannot happen.
- **Ownership scoping.** Drivers only see their own bookings, sessions,
  payments, vehicles, notifications and favourites; staff see the network.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `503` on `/api/health` — *Access denied for user* | `DB_USER` / `DB_PASSWORD` in `backend/.env` are wrong |
| `503` — *Cannot reach the MySQL server* | MySQL is not running, or `DB_HOST` / `DB_PORT` are wrong |
| `503` — *A required table is missing* | Run `npm run db:setup` |
| Discover shows "0 stations found" | Run `npm run seed` (§4.1); check the station `city` is one of the values in `CITIES` (`src/lib/evgrid.js`) |
| Frontend shows "Cannot reach the EVGrid API" | Start the API with `npm run server`; check `VITE_API_BASE_URL` |
| Browser blocks the request (CORS) | Add your frontend origin to `CORS_ORIGINS` in `backend/.env` |
| OTP never arrives | Check the API terminal. `SMTP login failed` → re-create the App Password (§3.3). `SMTP is not configured` → set `SMTP_USER` / `SMTP_PASSWORD`. In development the code is also printed in the terminal |
| `429 otp_rate_limited` on register/resend | The resend limits in §3.3 were hit. Wait for the `retry_after_seconds` in the error `details`, or raise `OTP_MAX_SENDS_PER_WINDOW` |
| `502 email_delivery_failed` (production) | Gmail rejected or could not accept the message; the server log holds the SMTP response code. Check the From address is the authenticated `SMTP_USER` |

---

## 10. Known limitations

- **Only verification codes are emailed.** Password-reset links and user
  invitations are still logged to the API console (and returned outside
  production) — they share the same `utils/mailer.js` transport, so wiring them
  up is a small follow-up.
- **The resend limiter is in-process.** Counters live in the API process, so
  they reset on restart and are not shared across multiple instances. A
  single-instance deployment is the supported topology.
- **Failed verification attempts are not throttled.** Only *sending* codes is
  limited (`OTP_MAX_SENDS_PER_WINDOW`). Add a per-account attempt counter before
  exposing the API publicly.
- **`GET /auth/oauth/:provider` returns `501`.** No OAuth provider credentials
  are configured; email + password sign-in is the supported flow.
- **Payments are simulated.** `POST /functions/process-payment` marks an invoice
  `paid`/`refunded` with a generated mock reference — no gateway is contacted.
- **Session energy is derived.** Without a real meter, `energy_kwh` is computed
  from `charging_points.power_kw` × session duration and priced with
  `charging_stations.price_per_kwh`. Send `energy_kwh` / `cost` in the stop
  payload to override it with metered values.

---

## 11. Deployment — GitHub → Render (API) + Vercel (frontend)

| Part | Host | Source | Config file |
|---|---|---|---|
| Source of truth | GitHub | whole repository | `.gitignore` |
| REST API + MySQL client | **Render** (Web Service) | `backend/` | [`render.yaml`](render.yaml) |
| Static frontend | **Vercel** (Vite) | `dist/` | [`vercel.json`](vercel.json) |
| Database | any hosted MySQL 8 | — | — |

Nothing in this section is applied yet — it documents the configuration to
enter when you deploy.

### 11.1 Rotate the local credentials before the first push

`backend/.env` contains a live MySQL password and a live Gmail App Password.
`.gitignore` keeps that file out of Git, but anyone who has seen the file
(including a screenshot or a shared folder) still has those values, so:

1. Change the local MySQL user's password.
2. Revoke the old Gmail App Password at <https://myaccount.google.com/apppasswords>
   and create a new one (§3.3).
3. Update `backend/.env`, then verify nothing sensitive is staged with
   `git status` — `backend/.env` must be listed as **ignored**, never as a
   new file.

### 11.2 Hosted MySQL

Create a MySQL 8 instance (Aiven, Clever Cloud, Railway, TiDB Cloud,
PlanetScale …) and note its host, port, user, password, database name and
whether TLS is mandatory. Then apply the schema and (optionally) the sample
network **to that instance** from your machine:

```powershell
# Windows PowerShell — point backend/.env at the hosted instance first
$env:DB_HOST="<host>"; $env:DB_PORT="<port>"; $env:DB_USER="<user>"
$env:DB_PASSWORD="<password>"; $env:DB_NAME="<database>"; $env:DB_SSL="require"
npm run db:setup    # 15 tables, CREATE TABLE IF NOT EXISTS, no rows inserted
npm run seed        # optional: 3 operators / 9 stations / 28 points / 9 tariffs
```

Or simply edit `backend/.env` temporarily, run both commands, then change it
back for local development.

- Most hosted providers create the database for you and **deny
  `CREATE DATABASE`** — `db:setup` detects that and applies the schema to the
  database that already exists. If the database itself is missing, create it in
  the provider dashboard first.
- **TLS:** set `DB_SSL=require` when the provider encrypts connections
  (Aiven, Railway, Clever Cloud, TiDB Cloud …). Use `DB_SSL=verify` together
  with `DB_SSL_CA` (the provider's CA certificate) for full verification.
  On Render, write the PEM into `DB_SSL_CA` as a single line with `\n` escapes.

### 11.3 Render — the API

Either import [`render.yaml`](render.yaml) (Render → **New → Blueprint**) or
create a **Web Service** manually with these settings:

| Setting | Value |
|---|---|
| Runtime | `Node` |
| Root directory | repository root (default) |
| Build command | `npm ci` |
| Start command | `npm run server` |
| Health check path | `/api/health` |
| Auto-deploy | on (tracks `main`) |

Environment variables (**Environment → Add Environment Variable**):

| Variable | Required | Example / notes |
|---|---|---|
| `NODE_ENV` | yes | `production` — enables strict CORS, hides internal errors and makes SMTP mandatory |
| `PORT` | no | Render sets it automatically; the API reads `process.env.PORT` |
| `API_PREFIX` | no | `/api` (default) |
| `CORS_ORIGINS` | yes | the deployed frontend origin, e.g. `https://evgrid.vercel.app` (comma-separate several) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | yes | hosted MySQL credentials from §11.2 |
| `DB_SSL` | usually | `require` (or `verify` with `DB_SSL_CA`) for hosted MySQL |
| `DB_SSL_CA` | if `verify` | provider CA certificate, PEM with `\n` escapes |
| `JWT_SECRET` | yes | generate a **new** one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | no | `12h` (default) |
| `BCRYPT_ROUNDS` | no | `10` (default) |
| `SMTP_USER` / `SMTP_PASSWORD` | yes | Gmail address + App Password (§3.3) — without them registration returns `503` in production |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | no | `smtp.gmail.com` / `465` / `true` |
| `MAIL_FROM_NAME` / `MAIL_FROM` | no | `EVGrid` / the Gmail address |

Do **not** copy `PORT`, `CORS_ORIGINS`, `DB_*` or `JWT_SECRET` values from
`backend/.env` into the repository or into `render.yaml` — they belong in the
Render dashboard only. After the first deploy, `GET https://<service>.onrender.com/api/health`
must answer `{ "status": "ok", "db": "connected", … }`.

> `app.set('trust proxy', true)` is already configured, so client IPs and rate
> limiting behave correctly behind Render's proxy. On the free plan the service
> sleeps when idle, so the first request after a pause is slow.

### 11.4 Vercel — the frontend

Import the same repository and keep [`vercel.json`](vercel.json) (Vite preset,
`npm run build` → `dist`, SPA fallback so `/stations` deep links work while
`/images/*` still resolve as real files). Set **one** environment variable:

| Variable | Environment | Value |
|---|---|---|
| `VITE_API_BASE_URL` | Production **and** Preview | `https://<your-service>.onrender.com/api` |

`VITE_*` variables are inlined by Vite **at build time**, so the variable must
exist before the build — adding or changing it later requires a redeploy. If it
is missing, the deployed site falls back to `http://localhost:5000/api` and
every request fails with *“Cannot reach the EVGrid API”*.

### 11.5 Finish the wiring

1. Deploy the API on Render, note its URL.
2. Set `VITE_API_BASE_URL` on Vercel, then deploy the frontend.
3. Put the Vercel URL into `CORS_ORIGINS` on Render and redeploy the API —
   without it the browser blocks every request.
4. Register a fresh account on the deployed site and confirm the verification
   email arrives.

### 11.6 Uploading to GitHub

```bash
git init                       # this folder is not a repository yet
git add .
git status                     # confirm backend/.env is NOT listed
git commit -m "Prepare EVGrid for deployment (Render + Vercel + hosted MySQL)"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

If `git status` ever shows `backend/.env` or `.env`, stop and add them to
`.gitignore` before committing.
