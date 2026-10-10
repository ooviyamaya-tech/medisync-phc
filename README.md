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

Set `JWT_SECRET` in `backend/.env` to a random value of at least 24 characters. Initialize the local SQLite database and seed its demo data:

```sh
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

The API is available at `http://localhost:3000`; check `http://localhost:3000/health` to confirm it is running. `npm run db:seed` clears existing application data before recreating the demo dataset. Normal server startup seeds automatically only when the database has no users, PHCs, or medicines.

### Frontend

In a second terminal, from the project root:

```sh
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend reads `VITE_API_URL`, defaulting to `http://localhost:3000`; copy `frontend/.env.example` to `frontend/.env` only when you need to override that default.

## Free Deployment

Deploy the backend to Render and the frontend to Vercel. The free Render filesystem is ephemeral. This SQLite setup is appropriate for a demo: a restart or redeploy can erase its database, after which the backend creates the schema and seeds the demo data again. Use durable managed storage and an appropriately configured database for production; do not treat free-tier SQLite data as persistent.

### 1. Deploy the backend on Render

1. Push this repository to GitHub and create a **Web Service** in Render connected to it.
2. Set **Root Directory** to `backend`, **Runtime** to Node, **Build Command** to `npm ci && npx prisma generate`, and **Start Command** to `npm start`. Choose the Free instance type.
3. Add these environment variables in the Render service settings:
   - `DATABASE_URL`: `file:./dev.db`
   - `JWT_SECRET`: a private random string of at least 24 characters; generate one locally with `openssl rand -base64 32`
   - `FRONTEND_URL`: the exact Vercel origin, with no trailing slash; set after deploying the frontend

   Render supplies `PORT` automatically, and the server listens on it. `JWT_EXPIRES_IN` (default `12h`) and `ALERT_CRON` (default `0 * * * *`) are optional. Do not set `PORT` yourself.
4. Deploy. The start command runs `prisma db push`, then starts the API. On an empty database, startup seeds the demo dataset once. Confirm the service is healthy at `https://<your-render-service>.onrender.com/health`.

### 2. Deploy the frontend on Vercel

1. Create a Vercel project for the same repository. Set **Root Directory** to `frontend`, **Framework Preset** to Vite, **Build Command** to `npm run build`, and **Output Directory** to `dist`.
2. Add the environment variable `VITE_API_URL=https://<your-render-service>.onrender.com` (use the Render service's actual URL, with no trailing slash), then deploy.
3. Copy the deployed Vercel origin, such as `https://<your-project>.vercel.app`, into Render's `FRONTEND_URL` setting and redeploy the backend. This restricts browser CORS access to that frontend origin. The included `frontend/vercel.json` serves React Router routes through the app entry point so refreshing routes such as `/map` works.
4. Open the Vercel URL, sign in with a demo account below, and verify the API health URL. Free Render services may take a little time to wake after inactivity.

## Demo Logins

All seeded demo accounts use the password `MediSyncDemo2026!`:

| Role | Email | Facility or scope |
| --- | --- | --- |
| Pharmacist | `pharmacist@medisync.demo` | Balianta PHC |
| Medical officer | `officer@medisync.demo` | Balianta PHC |
| District admin | `admin@medisync.demo` | Khordha district |

These public demo credentials are intended only for evaluation. Do not enter real health, patient, or inventory data into this deployment.

## Tests

Run backend service tests from the `backend` directory:

```sh
npm test
```

Build the frontend from the `frontend` directory:

```sh
npm run build
```