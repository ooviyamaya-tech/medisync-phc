# MediSync PHC

MediSync PHC is a medicine inventory monitoring and redistribution platform for Primary Health Centres (PHCs). It gives PHC and district teams a shared view of medicine availability and helps them spot shortages and expiry risks early.

## Problem

PHCs need to keep essential medicines available despite changing consumption and uneven stock across facilities. When stock records, usage trends, and expiry dates are difficult to monitor together, teams can discover shortages too late while usable stock may be available elsewhere. MediSync PHC brings this information into one workflow so teams can plan replenishment and transfers sooner.

## Key Features

- Role-specific workspaces for pharmacists, medical officers, and district administrators.
- Batch-level stock tracking, consumption records, and offline stock entry with queued synchronization.
- Consumption-based demand forecasts, estimated days of stock remaining, and PHC urgency rankings.
- Stock-out and near-expiry alerts.
- Suggested replenishment and medicine redistribution between PHCs, with transfer approval workflows.
- District, medical-officer, and pharmacist dashboards, with seeded facility and medicine data for local evaluation.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Leaflet, Recharts, and Dexie (IndexedDB).
- **Backend:** Node.js 20+, Express 5, and a JSON REST API.
- **Data and security:** Prisma ORM with SQLite, JWT authentication, bcrypt password hashing, and Zod request validation.

## Run Locally

Install Node.js 20 or newer and npm. Start the backend first, then run the frontend in a second terminal.

### Backend

```sh
cd backend
npm install
cp .env.example .env
```

Set `JWT_SECRET` in `backend/.env` to a random value of at least 24 characters, then initialize and seed the local SQLite database:

```sh
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

The API is available at `http://localhost:3000`; check `http://localhost:3000/health` to confirm it is running. Seeding clears existing application data before recreating the demo dataset.

### Frontend

In a second terminal, from the project root:

```sh
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend uses `http://localhost:3000` as its API by default. To point it at another backend, create `frontend/.env` with:

```dotenv
VITE_API_URL=http://localhost:3000
```

## Demo Logins

All seeded demo accounts use the password `MediSyncDemo2026!`:

| Role | Email | Facility or scope |
| --- | --- | --- |
| Pharmacist | `pharmacist@medisync.demo` | Balianta PHC |
| Medical officer | `officer@medisync.demo` | Balianta PHC |
| District admin | `admin@medisync.demo` | Khordha district |

These credentials are for local development and demonstration only. Do not use them in a deployed environment.

## Tests

Run backend service tests from the `backend` directory:

```sh
npm test
```

Build the frontend from the `frontend` directory:

```sh
npm run build
```