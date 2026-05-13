# Task 1 — Prisma Schema Additions
**Status:** COMPLETE  
**Date:** 2026-05-13  
**Environment:** Neon Cloud PostgreSQL · Prisma ORM v5.22.0 · Node.js v22.20.0

---

## What Was Done

Added discount pricing fields to the `Product` model and introduced two new analytics models (`PageView`, `CartEvent`) to the Prisma schema. The schema changes were pushed to the live Neon cloud database and the Prisma client was regenerated to include all new models.

### Specific changes:
1. Added `salePrice Float?` to `Product` model — stores optional sale/promotional price in EUR
2. Added `discountPercent Int?` to `Product` model — stores optional discount percentage (e.g. 20 = 20% off)
3. Added `PageView` model — records every page visit with path, sessionId, optional productId, userAgent, referer, and createdAt. Indexed on `path`, `productId`, and `createdAt` for fast analytics queries
4. Added `CartEvent` model — records cart funnel events (`add_to_cart`, `remove_from_cart`, `checkout_started`, `checkout_completed`) with sessionId, optional productId and orderId. Indexed on `event`, `productId`, and `createdAt`
5. Created migration SQL file `20260513120000_add_discount_analytics/migration.sql` manually (Prisma `migrate dev` requires an interactive TTY which is unavailable in the scripting environment — `db push` was used to apply the changes, migration file written manually for version tracking)
6. Regenerated Prisma client (`npx prisma generate`)

---

## Files Changed

| File | Change Type | Description |
|------|------------|-------------|
| `backend/src/prisma/schema.prisma` | Modified | Added `salePrice`, `discountPercent` to Product; added PageView and CartEvent models |
| `backend/src/prisma/migrations/20260513120000_add_discount_analytics/migration.sql` | Created (new) | SQL migration file with ALTER TABLE and CREATE TABLE statements |
| `backend/node_modules/@prisma/client/` | Regenerated | Prisma client updated to include pageView and cartEvent query methods |

---

## Files NOT Changed (confirmed unmodified)
- All frontend HTML files — untouched
- All backend controllers, services, routes — untouched
- `backend/src/config/db.js` — untouched (Prisma client import unchanged)

---

## Test Case Results

| # | Test | Input / Action | Expected | Actual | Status |
|---|------|----------------|----------|--------|--------|
| T1.1 | `salePrice Float?` field in schema | `grep 'salePrice' schema.prisma` | Field present | `salePrice Float?` found | ✅ PASS |
| T1.2 | `discountPercent Int?` field in schema | `grep 'discountPercent' schema.prisma` | Field present | `discountPercent Int?` found | ✅ PASS |
| T1.3 | `PageView` model defined | `grep 'model PageView' schema.prisma` | Model present | `model PageView {` found | ✅ PASS |
| T1.4 | `CartEvent` model defined | `grep 'model CartEvent' schema.prisma` | Model present | `model CartEvent {` found | ✅ PASS |
| T1.5 | Migration files present | `ls migrations/` | Both migration dirs exist | `20260508070850_initial_schema` and `20260513120000_add_discount_analytics` present | ✅ PASS |
| T1.6 | `prisma.pageView.findMany()` accessible | Node script query | Returns array, no error | `OK — pageView accessible, records: 38` | ✅ PASS |
| T1.7 | `prisma.cartEvent.findMany()` accessible | Node script query | Returns array, no error | `OK — cartEvent accessible, records: 3` | ✅ PASS |
| T1.8 | API PATCH accepts `salePrice` + `discountPercent` | `PATCH /api/admin/products/:id` `{salePrice:1200, discountPercent:17}` | 200 OK, values stored | `salePrice: 1200, discountPercent: 17` confirmed in response | ✅ PASS |
| T1.8a | Edge case: `salePrice = 0` | `PATCH` with `{salePrice:0}` | Stores `0`, not `null` | `salePrice: 0` returned | ✅ PASS |
| T1.9 | Extreme: negative `salePrice` | `PATCH` with `{salePrice:-50}` | DB accepts (no constraint) | Stored `-50` — **validation flagged for Task 7** | ⚠️ NOTED |
| T1.10 | Extreme: `discountPercent > 100` | `PATCH` with `{discountPercent:150}` | DB accepts (no constraint) | Stored `150` — **clamping validation flagged for Task 7** | ⚠️ NOTED |
| T1.11 | Extreme: very large float `salePrice` | `PATCH` with `{salePrice:999999.99}` | Stored exactly | `999999.99` returned exactly | ✅ PASS |
| T1.12 | PageView full record create/read/delete | Node script: create record with all 7 fields | All columns writable | Record created with id, path, productId, sessionId, userAgent, referer, createdAt | ✅ PASS |
| T1.13 | CartEvent full record create/read/delete | Node script: create record with all 6 fields | All columns writable | Record created with id, event, sessionId, productId, orderId, createdAt | ✅ PASS |
| T1.14 | DB indexes exist on PageView and CartEvent | Raw SQL: `pg_indexes` query | 6 indexes (3 per table) | PageView: path, productId, createdAt. CartEvent: event, productId, createdAt | ✅ PASS |
| T1.15 | Product columns correct type in DB | Raw SQL: `information_schema.columns` | `double precision` nullable, `integer` nullable | `discountPercent: integer, nullable:YES` · `salePrice: double precision, nullable:YES` | ✅ PASS |

**Total: 14 PASS · 2 NOTED (not failures — input validation is Task 7 controller responsibility)**

---

## Notes for Subsequent Tasks

- **Task 7** must add validation in `createProduct` and `updateProduct`: reject `salePrice < 0`, reject `discountPercent < 0` or `discountPercent > 100`
- The DB already had PageView/CartEvent from a previous session (phase1 remote was force-reset). The cloud DB was NOT reset — `prisma db push` confirmed "already in sync"
- Prisma client regenerated successfully; backend restarted cleanly on port 5000

---

## Awaiting
User confirmation of live preview before GitHub push.
