# EVGrid — Backend API Contract

This document is the contract between the EVGrid frontend (`c:\Users\madhu\EVGrid-Web`)
and the Node.js + Express + MySQL backend that will be connected later.

The frontend never calls `fetch` directly. Every request goes through
`src/api/client.js` and the resource services in `src/api/index.js`.

- API base URL: `VITE_API_BASE_URL` (see `.env`), default `http://localhost:5000/api`
- Dev proxy: `/api/*` is proxied to `VITE_API_PROXY_TARGET` (default `http://localhost:5000`)
- Auth: `Authorization: Bearer <JWT>` on every request except `POST /auth/login`,
  `POST /auth/register`, `POST /auth/verify-otp`, `POST /auth/resend-otp`,
  `POST /auth/forgot-password`, `POST /auth/reset-password` and `GET /health`.
- Token storage: `localStorage["evgrid.access_token"]`

---

## 1. Conventions

### List response shape

```json
{ "items": [ { "id": "..." } ], "total": 128 }
```

A bare array is also accepted by the client, but `{ items, total }` is preferred
because pagination depends on `total`.

### Error shape

Any non-2xx response should return JSON:

```json
{ "message": "Human readable reason", "code": "validation_error", "details": {} }
```

`401` causes the client to drop the stored token automatically.

### Query parameters

| Param | Meaning | Example |
|---|---|---|
| `<field>` | Equality filter | `?status=paid` |
| `<field>[$op]` | Operator filter | `?status[$in]=paid,pending` |
| `sort` | Sort field; `-` prefix = DESC | `?sort=-created_date` |
| `limit` | Page size | `?limit=20` |
| `skip` | Offset | `?skip=40` |

Supported operators: `$eq $ne $gt $gte $lt $lte $in $nin $like $exists`.
`$in` / `$nin` values are sent comma-separated (`?status[$in]=a,b`).

### Single-resource response shape

Create (`POST`) and update (`PATCH`) return the full saved object.
Delete (`DELETE`) returns `204 No Content`.

---

## 2. Authentication endpoints

| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ access_token, user }` |
| GET | `/auth/me` | — | `user` |
| PATCH | `/auth/me` | partial `user` | updated `user` |
| POST | `/auth/register` | `{ email, password, full_name }` | `{ message }` (starts OTP flow) |
| POST | `/auth/verify-otp` | `{ email, otp }` | `{ access_token, user }` |
| POST | `/auth/resend-otp` | `{ email }` | `{ message }` |
| POST | `/auth/forgot-password` | `{ email }` | `{ message }` |
| POST | `/auth/reset-password` | `{ token, password }` | `{ message }` |
| POST | `/auth/logout` | — | `204` (token invalidation) |
| GET | `/auth/oauth/:provider` | `?returnTo=` | `302` redirect to provider consent screen |

---

## 3. System

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ "status": "ok", "db": "connected", "uptime": 123 }` |

Used by the **Settings** page connection test. Should verify the MySQL pool,
not just that Express is listening.

---

## 4. Resource endpoints

Every resource below implements the identical set of routes
(`<path>` = the API path in the table).

### 4.1 Standard CRUD set (repeat for each resource)

| Method | Path | Purpose |
|---|---|---|
| GET | `/<path>` | List with filter / sort / limit / skip |
| GET | `/<path>/count` | `{ count: number }` for the same filters |
| GET | `/<path>/aggregate?sum=a,b` | `{ rows: [{ sum_a, sum_b, count }] }` |
| GET | `/<path>/:id` | Single record |
| POST | `/<path>` | Create |
| PATCH | `/<path>/:id` | Update |
| DELETE | `/<path>/:id` | Delete (`204`) |
| PATCH | `/<path>/bulk` | `{ items: [{ id, ...patch }] }` |
| POST | `/<path>/bulk` | `{ items: [ {...} ] }` |

### 4.2 Resources required

| API path | Used by |
|---|---|
| `/users` | Admin > Users, Profile, Settings, Auth |
| `/users/invite` (POST `{ email, app_role }`) | Admin > Users |
| `/operators` | Admin > Operators, Operator > Stations |
| `/charging-stations` | Discover, Station detail, Operator > Stations, Reports, Dashboard |
| `/charging-points` | Operator > Charging points, Station detail, Maintenance |
| `/bookings` | Bookings, Dashboard, Operator dashboard |
| `/charging-sessions` | Sessions, Energy monitoring, Dashboard, Reports |
| `/payments` | Payments, Dashboard, Reports |
| `/vehicles` | Vehicles, Dashboard, Booking dialog |
| `/notifications` | Notifications, Top bar unread badge |
| `/maintenance-records` | Maintenance, Technician dashboard |
| `/technicians` | Maintenance assignment |
| `/tariffs` | Operator > Tariffs, Station detail |
| `/reviews` | Station detail |
| `/favorites` | Station detail |
| `/audit-logs` | Admin > Audit log, Admin dashboard |

---

## 5. Server-side operation endpoints (`/functions/*`)

These are multi-table transactions and must not be implemented as plain CRUD.

| Method | Path | Body | Behaviour |
|---|---|---|---|
| POST | `/functions/create-booking` | `{ station_id, point_id, booking_date, start_time, end_time, vehicle_id?, estimated_energy_kwh?, notes? }` | Validates the point is free for the slot, creates the `bookings` row, sets the point to `reserved`, writes a `notifications` row. Returns the booking. |
| POST | `/functions/charging-session` | `{ action: 'start' \| 'stop', booking_id?, point_id?, session_id?, energy_kwh?, cost? }` | `start`: creates an `in_progress` session, marks point `occupied`, booking `active`. `stop`: closes the session (`completed`), computes `duration_minutes`/`energy_kwh`/`cost`, frees the point, creates a `pending` payment row. |
| POST | `/functions/process-payment` | `{ payment_id, method }` or `{ payment_id, action: 'refund' }` | Mock gateway settlement: sets `status = paid`, `paid_date`, `transaction_ref`; refund sets `status = refunded`. |

---

## 6. MySQL tables and fields

Field names are the exact keys the frontend reads and writes.
Every table has `id` (PK) and `created_date`.

### `users`
`email` (unique), `password_hash`, `full_name`, `phone`, `city`,
`favorite_connector` (enum: Type 2 | CCS2 | CHAdeMO | Type 1 | GB/T),
`notifications_enabled` (bool), `auto_charge_reminders` (bool),
`app_role` (enum: `ev_user` | `operator` | `technician` | `admin`), `role` (legacy),
`email_verified` (bool), `otp_code`, `otp_expires_at`

### `operators`
`org_name`, `contact_name`, `email`, `phone`, `city`,
`status` (enum: `active` | `pending` | `suspended`),
`commission_percent` (decimal, default 8), `onboarded_date`

### `charging_stations`
`name`, `city`, `state`, `address`, `status` (enum: `online` | `maintenance` | `offline`),
`connector_types` (JSON array), `max_power_kw`, `price_per_kwh`, `operator_name`,
`open_24h` (bool), `opening_hours`, `amenities` (JSON array), `description`,
`image_url`, `rating`, `review_count`, `latitude`, `longitude`

### `charging_points`
`station_id` (FK → charging_stations), `code`, `connector_type`, `current_type` (AC | DC),
`power_kw`, `status` (enum: `available` | `occupied` | `reserved` | `offline` | `maintenance`),
`serial_number`, `last_serviced_date`

### `bookings`
`user_id` (FK → users), `station_id` (FK), `station_name`, `point_id` (FK → charging_points),
`point_code`, `vehicle_id` (FK → vehicles, nullable), `vehicle_label`, `user_name`,
`booking_date` (date), `start_time` (time), `end_time` (time), `duration_minutes`,
`estimated_energy_kwh`, `estimated_cost`,
`status` (enum: `pending` | `confirmed` | `active` | `completed` | `cancelled` | `no_show`),
`notes`

### `charging_sessions`
`booking_id` (FK → bookings, nullable), `user_id` (FK), `station_id` (FK), `station_name`,
`point_id` (FK), `point_code`, `vehicle_id` (FK, nullable), `vehicle_label`,
`start_time` (datetime), `end_time` (datetime, nullable), `duration_minutes`,
`energy_kwh`, `cost`, `status` (enum: `in_progress` | `completed` | `aborted`)

### `payments`
`session_id` (FK → charging_sessions), `booking_id` (FK, nullable), `user_id` (FK),
`station_id` (FK), `station_name`, `invoice_number` (unique), `amount`, `energy_kwh`,
`method` (enum: `upi` | `card` | `wallet` | `netbanking` | `cash`),
`status` (enum: `pending` | `paid` | `failed` | `refunded`),
`transaction_ref`, `paid_date` (datetime, nullable)

### `vehicles`
`user_id` (FK → users), `nickname`, `make`, `model`, `year`, `registration_number`,
`battery_capacity_kwh`, `range_km`, `connector_type`, `is_primary` (bool)

### `notifications`
`user_id` (FK → users), `title`, `message`,
`type` (enum: `booking` | `payment` | `session` | `maintenance` | `system`),
`link`, `is_read` (bool)

### `maintenance_records`
`station_id` (FK), `station_name`, `point_id` (FK, nullable), `point_code`, `title`,
`description`,
`category` (enum: `hardware` | `software` | `cable` | `connector` | `network` | `other`),
`priority` (enum: `low` | `medium` | `high` | `critical`),
`status` (enum: `open` | `assigned` | `in_progress` | `resolved`),
`assigned_to`, `assigned_email`, `reported_by_name`, `reported_date`,
`resolved_date` (nullable), `resolution_notes`

### `technicians`
`name`, `email` (unique), `phone`, `city`, `specialization`, `is_active` (bool)

### `tariffs`
`station_id` (FK), `station_name`, `name`, `price_per_kwh`, `session_fee`,
`idle_fee_per_min`, `currency` (default `INR`), `is_active` (bool), `valid_from` (date)

### `reviews`
`station_id` (FK), `station_name`, `user_id` (FK), `user_name`, `rating` (1–5), `comment`

### `favorites`
`user_id` (FK), `station_id` (FK), `station_name`, `city`
(unique composite index on `user_id, station_id`)

### `audit_logs`
`action`, `entity_type`, `entity_id`, `actor_id` (FK → users), `actor_name`,
`actor_email`, `details` (JSON), `severity` (enum: `info` | `warning` | `critical`),
`ip_address`

---

## 7. Aggregate endpoint detail

The frontend calls:

```
GET /charging-sessions/aggregate?status=completed&sum=energy_kwh,cost
```

and expects:

```json
{ "rows": [ { "sum_energy_kwh": 1842.5, "sum_cost": 33165.0, "count": 120 } ] }
```

Rules:
- `sum` is a comma-separated list of numeric columns; each becomes `sum_<column>`.
- Always include `count`.
- Return exactly one row when no `groupBy` is supplied.
- `payment` totals use the same shape (`sum_amount`).
