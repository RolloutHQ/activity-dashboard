# Rollout Demo App

Lightweight Express server + React 18 dashboard that:

- Uses Rollout Link (`@rollout/link-react`) for credential input and credential management.
- Mints Rollout JWTs on the backend (`HS512`, `iss/sub/exp`).
- Loads KPI + trend data from Postgres `public.rollout_%` tables by `credentialId`.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy envs and fill values:
   ```bash
   cp .env.example .env
   ```
3. Run both server and client:
   ```bash
   npm run dev
   ```

Server: `http://localhost:4000`  
Client: `http://localhost:5173`

## API

- `GET /api/config`
- `GET /api/rollout/token?userId=<id>`
- `GET /api/credentials`
- `GET /api/dashboard/summary?credentialId=<id>&rangeDays=90&metric=contactsMade`
