# ExtraHand Coupon Service

Standalone coupon microservice for ExtraHand.

## Collections (existing MongoDB)

- `coupons`
- `couponRedemptions`

## Run

1. Copy `.env.example` → `.env`
2. Set `MONGODB_URI` and `SERVICE_AUTH_TOKEN` (same values as payment-service)
3. Set `PAYMENT_SERVICE_URL` for first-booking checks
4. `npm ci` (or `npm install`) && `npm run dev`

Default port: **4015**  
Node: **>=20.19.0** (see `.nvmrc`)

## Deploy (CapRover)

- `Dockerfile` — multi-stage Node 20 Alpine build (`npm ci` + `tsc`)
- `captain-definition` — CapRover app definition (port **4015**, health `/api/v1/health`)
- `.dockerignore` — keeps build context small

Set CapRover env vars from `captain-definition.envVars` (especially `MONGODB_URI`, `SERVICE_AUTH_TOKEN`, `PAYMENT_SERVICE_URL`).

## Seed FIRST100

Runs automatically on startup (idempotent). Or:

```bash
npm run seed:first100
```

`FIRST100` = **₹100 OFF** (FIXED), min ₹499, both flows, first booking only, 1 use per user.

## Key APIs

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/coupons/validate` | X-Service-Auth |
| POST | `/api/v1/coupons/redemptions/reserve` | X-Service-Auth |
| POST | `/api/v1/coupons/redemptions/:id/confirm` | X-Service-Auth |
| POST | `/api/v1/coupons/redemptions/:id/cancel` | X-Service-Auth |
| POST/GET/PATCH | `/api/v1/coupons/admin/coupons...` | X-Service-Auth |
