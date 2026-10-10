# MediSync PHC Backend

REST API for medicine stock monitoring, consumption forecasting, stock-out alerts, redistribution suggestions, and transfer approvals for Primary Health Centres.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

From the `backend` directory:

```sh
npm install
cp .env.example .env
```

Set `JWT_SECRET` in `.env` to a random value of at least 24 characters. Initialize the local SQLite database and seed demo data:

```sh
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

The API listens on `http://localhost:3000`. `GET /health` is public. `npm start` runs the production server. `npm test` runs service unit tests.

To refresh demo data, run `npm run db:seed` again. Seeding clears existing application data before rebuilding the demo dataset.

## Demo users

All demo users use password `MediSyncDemo2026!`:

| Role | Email | Scope |
| --- | --- | --- |
| Pharmacist | `pharmacist@medisync.demo` | Balianta PHC |
| Medical officer | `officer@medisync.demo` | Balianta PHC |
| District admin | `admin@medisync.demo` | Khordha district |

Get a token with `POST /auth/login`, then send `Authorization: Bearer <token>` on protected routes. These credentials are for local development only.

## API collection

Import [`postman/MediSync-PHC.postman_collection.json`](postman/MediSync-PHC.postman_collection.json) into Postman. The collection uses `baseUrl` and stores the login response token in `token` automatically. Set `email` and `password` collection variables to choose a demo role.

## Main routes

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/login`, `GET /auth/me` |
| Reference data | `GET /phcs`, `GET /medicines` |
| Stock | `GET /stock`, `POST /stock`, `PUT/PATCH /stock/:id`, `DELETE /stock/:id`, `POST /stock/bulk-sync` |
| Consumption | `POST /consumption`, `GET /consumption` |
| Forecast | `GET /forecast/:phc_id`, `GET /forecast/:phc_id/:medicine_id` |
| Alerts | `GET /alerts`, `PATCH /alerts/:id` |
| Planning | `GET /centres/urgency`, `GET /redistribution/suggest`, `GET /indent/suggest` |
| Transfers | `POST /transfers`, `GET /transfers`, `PATCH /transfers/:id/approve`, `PATCH /transfers/:id/reject` |
| Dashboards | `GET /dashboard/pharmacist`, `GET /dashboard/medical-officer`, `GET /dashboard/district-admin` |

List endpoints support `page` and `limit` (maximum 100) and return a `pagination` object. Responses are wrapped in `{ "data": ... }`; failures use `{ "error": { "code", "message", "details?" } }`.

### Forecast and planning behavior

Forecasts use a linearly weighted moving average over the latest 30 calendar days (weights increase toward today), a month-specific seasonal multiplier, days remaining at current stock, and a confidence estimate based on observed history. Unusual use compares the last three-day daily average with the prior baseline mean plus two population standard deviations. Redistribution excludes the requesting PHC, only considers same-district PHCs with stock above a 30-day demand reserve, and orders candidates by distance, surplus, then earliest expiry. A district warehouse is returned separately as a fallback.

### Offline stock sync

`POST /stock/bulk-sync` accepts `{ "entries": [...] }`. Each item includes a unique `client_id`, `client_timestamp`, `phc_id`, `medicine_id`, `batch_no`, `quantity`, and `expiry_date`. Repeated client IDs are idempotent. A timestamp older than the batch's latest update is returned as a per-item `STALE_UPDATE` failure; other item failures do not prevent the rest of the batch from being processed.

### Transfers

Only `MEDICAL_OFFICER` accounts may approve or reject. Approval validates available stock and moves FEFO batches (earliest expiry first) to the destination in a database transaction, updates the request, and writes an audit record in that transaction. Warehouse requests draw from the destination district's warehouse.

## Alerts

The alert refresh runs hourly by default (`ALERT_CRON`) and after stock or consumption writes. Open alerts are deduplicated by PHC, medicine, and alert type. Projected stock-out alerts are `HIGH` within seven days and `CRITICAL` within three; near-expiry alerts are raised within 60 days and become `HIGH` within 30 days.

## Tests

```sh
npm test
```

The forecast and redistribution ranking modules are pure functions and have isolated Node.js test-runner coverage.

## Data and security notes

Prisma models use SQLite-compatible strings for enum-like fields; request schemas restrict values to the documented roles and states. JWT authentication, password hashing, role checks, PHC scoping, CORS, Zod validation, and consistent error responses are enabled. Before deployment, set a strong secret, configure CORS for trusted origins, use HTTPS, and back up the SQLite database. Configure production migrations with a reviewed Prisma migration rather than relying on `db push`.