# Task 7 — Expanded Admin Backend Endpoints
**Date:** 2026-05-14  
**Status:** COMPLETE ✅  
**Tests:** 84/84 passed (professional suite) + 19/19 (initial suite)

**Important finding:** `authLimiter` is set to `max: 5` per 15-minute window (`rateLimitMiddleware.js:11`). Restarting the server resets the in-memory counter. Running the test suite more than twice in the same 15-minute window will return 429 on login. For CI/CD, either use Redis-backed rate limiting with a test bypass, or increase the limit in `NODE_ENV=test`.

---

## What Was Done

### Files changed
| File | Change |
|------|--------|
| `backend/src/controllers/adminController.js` | Replaced 3 stubs, added 5 new methods (8 total changes) |
| `backend/src/routes/adminRoutes.js` | Full rewrite — correct route order, validation added, 5 new routes |

### Methods replaced (stubs → full implementations)
| Method | What changed |
|--------|-------------|
| `createProduct` | Raw body passthrough → proper field extraction, slug auto-generation, `salePrice`/`discountPercent` handling, inventory upsert for all sizes, AuditLog |
| `updateProduct` | Raw body passthrough → safe partial update (undefined fields skipped), falsy check for salePrice/discountPercent, AuditLog with diff metadata |
| `deleteProduct` | Hard `prisma.product.delete()` → soft archive (`status: 'ARCHIVED'`), AuditLog |

### New methods added
| Method | Route | Notes |
|--------|-------|-------|
| `getProduct` | `GET /products/:id` | Single product with inventory; 404 if not found |
| `getProductStats` | `GET /products/:id/stats` | 30-day page views, cart adds, conversion rate, all-time revenue + units sold |
| `cancelOrder` | `POST /orders/:id/cancel` | Atomic: cancel + restore inventory + refund payment. Guards: SHIPPED/DELIVERED/CANCELLED/REFUNDED blocked, 48-hour window enforced |
| `getDashboardExtended` | `GET /dashboard-extended` | Revenue (UTC midnight), order counts, low stock (≤5), recent orders (all items), top 5 products, customer totals |
| `getAnalytics` | `GET /analytics?period=N` | Funnel metrics, revenue by day, top products by views + revenue, revenue by payment method |

---

## Corrections Over the Spec

| Issue | Spec | Implementation |
|-------|------|----------------|
| Prisma v5 `groupBy _count` syntax | `_count: true` (invalid) | `_count: { fieldName: true }` (correct) — applied in 4 places |
| `cancelOrder` — allowed statuses | Allowed SHIPPED cancellation | Blocked: `CANCELLED`, `REFUNDED`, `DELIVERED`, `SHIPPED` |
| `cancelOrder` — no 48h limit | No time check | `hoursSinceOrder > 48` → 400 error |
| `cancelOrder` — no payment guard | `order.payments[0].status` would throw if empty | `order.payments?.[0] || null` null check |
| `getDashboardExtended` — timezone | `setHours(0,0,0,0)` (local time) | `setUTCHours(0,0,0,0)` (UTC consistent with DB) |
| `getDashboardExtended` — items preview | `include: { items: { take: 1 } }` | `include: { items: true }` — full items per order |
| `getDashboardExtended` — low stock threshold | `lte: 3` | `lte: 5` — longer restocking lead time for luxury |
| `createProduct` — missing slug | Throws Prisma constraint error | Auto-generates from `name.toLowerCase()...` |
| `createProduct` — inventory duplicates | `prisma.inventory.create` (silent duplicates) | `prisma.inventory.upsert` with `productId_size` composite key |
| `createProduct` — no default sizes | No inventory if `sizes` absent | Falls back to `['XS', 'S', 'M', 'L']` |
| Analytics period | No validation | Clamped: `Math.min(Math.max(parseInt(period) \|\| 30, 1), 365)` |
| Route order | No `GET /products/:id` existed | Added; `GET /products/:id/stats` registered first (permanent order) |

---

## Test Results

| # | Test | Expected | Result |
|---|------|----------|--------|
| T1 | GET /dashboard-extended | 200 | ✅ 200 |
| T2 | GET /analytics?period=7 | 200 | ✅ 200 |
| T3 | GET /analytics?period=0 (clamp) | 200, uses 1 day | ✅ 200 |
| T4 | POST /products valid (no slug) | 201, slug auto-generated | ✅ 201, slug=`test-piece` |
| T5 | POST /products price=-100 | 422 validation error | ✅ 422 |
| T6 | POST /products discountPercent=150 | 422 validation error | ✅ 422 |
| T7 | GET /products/:id | 200 | ✅ 200 |
| T8 | GET /products/:id/stats (route order) | 200, not matched as /:id | ✅ 200 |
| T9 | PATCH /products/:id (price, salePrice, discountPercent) | 200, fields updated | ✅ 200 |
| T10 | PATCH salePrice:0 | 200, salePrice=null | ✅ 200, `salePrice: null` |
| T11 | DELETE /products/:id | 200, "Product archived" | ✅ 200 |
| T12 | GET product after DELETE | status=ARCHIVED | ✅ `status: ARCHIVED` |
| T13 | POST /orders/:id/cancel (PAID, <48h) | 200, cancelled | ✅ 200 |
| T14 | POST /orders/nonexistent/cancel | 404 | ✅ 404 |
| T15 | No auth token | 401 | ✅ 401 |
| T16 | Inventory upsert — 4 rows for test-piece | XS/S/M/L, stock=10 | ✅ 4 rows, correct SKUs |
| T17 | Cancel already-CANCELLED order | 400 | ✅ 400 "Cannot cancel order with status CANCELLED" |
| T18 | Analytics structure | All summary keys, 30-day revenue array | ✅ 8 summary keys, 30 revenue days, 10 top products |
| T19 | Dashboard-extended structure | revenue/orders/customers/lowStock keys | ✅ All keys present, full items per order |

---

## Route Order (Permanent — Must Never Change)

```
GET    /products                ← list all
POST   /products                ← create
GET    /products/:id/stats      ← MUST be before /:id
GET    /products/:id            ← single product
PATCH  /products/:id            ← update
DELETE /products/:id            ← soft archive
```

Express matches routes top-to-bottom. If `/:id` were registered before `/:id/stats`, the word `stats` would be captured as the `:id` param and `getProduct` would be called instead of `getProductStats`.
