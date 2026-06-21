# care-hire

A secure car hire platform reference implementation.

## Included artifacts

- `PLATFORM_SPEC.md` — complete architecture, security, API, tracking, payment, and compliance design.
- `schema/carhire_schema.sql` — normalized PostgreSQL schema, indexes, and stored procedures.
- `docker-compose.yml` — production-style container stack for PostgreSQL, Redis, backend, and nginx.
- `nginx/nginx.conf` — secure nginx configuration with recommended security headers.

## Next steps

1. Add frontend code for web and mobile clients.
2. Wire JWT auth, payment gateway, and tracking integration.
3. Run schema scripts against PostgreSQL and enable Redis.

## Backend bootstrap

From `backend/`:

```bash
npm install
cp .env.example .env
npm run dev
```

The backend exposes:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/bookings`
- `POST /api/bookings`