# MediSync PHC Frontend

React + Vite interface for the MediSync PHC REST API.

## Requirements

- Node.js 20 or newer
- The MediSync backend running at `http://localhost:3000`

## Setup

```sh
cd frontend
npm install
npm run dev
```

Vite serves the application at `http://localhost:5173`. The API base URL defaults to `http://localhost:3000`. To use a different backend, create `.env` in this folder:

```sh
VITE_API_URL=http://localhost:3000
```

The backend currently enables CORS with `cors()` and accepts requests from the Vite origin without extra configuration. Demo account buttons fill `pharmacist@medisync.demo`, `officer@medisync.demo`, or `admin@medisync.demo`; all use `MediSyncDemo2026!`.

## Capabilities

- Role-aware navigation for pharmacists, medical officers, and district admins.
- Stock, forecast, alerts, urgency, transfers, indent and dashboard screens wired to the backend routes documented in `backend/README.md`.
- JWT held in `sessionStorage` and sent as a bearer token.
- Installable PWA shell and IndexedDB offline entry queue.
- Stock entries sync in batches through `POST /stock/bulk-sync`. The current backend has no consumption bulk-sync route, so queued usage entries replay individually through `POST /consumption` when the connection returns.

The current API does not persist decision comments on transfer approvals; the approval screen explains this limitation. Since consumption submissions do not have an idempotency key in the API, avoid repeated retries if a connection drops immediately after submission.