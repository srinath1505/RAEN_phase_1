# Task 8 Report — Admin Dashboard UI

**Date:** 2026-05-16  
**Status:** Complete  
**Tests:** All backend verification tests pass

---

## Summary

Built the complete admin panel for RAEN: 9 HTML pages in `stitch/admin/` (1 login + 8 management pages) plus 5 targeted backend changes needed to make the UI functional. All pages use the existing `../public/js/api.js` helper, share a consistent sidebar and auth gate, and communicate exclusively with the already-registered admin API endpoints.

---

## Backend Changes Made

| File | Change |
|------|--------|
| `backend/src/controllers/adminController.js` | `getAllOrders`: added `user: { select: { firstName, lastName } }` to include block |
| `backend/src/controllers/adminController.js` | `getAllCustomers`: added `prisma.order.groupBy` by email to compute `totalSpent` per customer |
| `backend/src/controllers/adminController.js` | `approvePayment`: added `AdminAuditLog` entry after approving UPI payment |
| `backend/src/controllers/adminController.js` | `rejectPayment`: added `AdminAuditLog` entry after rejecting UPI payment |
| `backend/src/services/paymentService.js` | `rejectUpiPayment`: added `orderService.updateOrderStatus(orderId, 'CANCELLED')` so order status is set to CANCELLED on rejection (previously only `paymentStatus` was set to FAILED) |

No new routes or controller methods were created. All 24 admin endpoints already existed and are registered.

---

## Files Created

| File | Description |
|------|-------------|
| `stitch/admin/login.html` | Standalone admin login page. No sidebar, no api.js dependency. Direct fetch to `/api/auth/login`. Validates admin role in JWT response. Enter-key support. |
| `stitch/admin/index.html` | Main dashboard. Revenue stat cards (today/week/month/all-time), order status cards, UPI alert banner, 30-day revenue line chart with 7d/30d/90d period toggle, low stock panel (red ≤2 / amber ≤5), top 5 products by revenue, recent orders table. Uses Chart.js. |
| `stitch/admin/orders.html` | Order management. Table with pagination (20/page), search (order#/name/email), status dropdown with confirm dialog (warns on backwards moves), cancel button (only for PENDING/PAID within 48h), expandable rows showing items / shipping address / payment method. |
| `stitch/admin/products.html` | Product CRUD. Table with image thumbnail (path encoding for spaces/parens), total stock from inventory, status badge. Add/Edit modal with all fields. Stats modal (30-day page views, cart adds, orders, revenue, conversion rate). Soft-delete (archive) with confirm dialog. |
| `stitch/admin/inventory.html` | Inventory management. Alert banner for items ≤5 stock. Color-coded stock cells (red ≤2 / amber ≤5). Inline click-to-edit stock (Enter to save / Escape to cancel). Bulk restock panel listing all low items, single quantity input, sequential PATCH calls with progress. Sortable by product name / stock. |
| `stitch/admin/payments.html` | Payments. Four summary cards calculated client-side from payments list (total revenue, Razorpay, PayPal, UPI). Pending UPI section (amber-bordered box, approve/reject with confirm dialogs). Main payments table with provider/status filter dropdowns. |
| `stitch/admin/customers.html` | Customer management. Four summary cards (total, new this month, with orders, total revenue). Sortable columns. Search by name/email. Expandable rows show last 5 orders filtered client-side from pre-loaded orders list. |
| `stitch/admin/analytics.html` | Full analytics. Period toggle (7/30/90 days). Five funnel stat cards. CSS stepped conversion funnel (5 steps, drop-off percentages, red if >50% drop). Revenue line chart (Chart.js). Revenue by payment method cards. Top 5 products by views + top 5 by revenue tables. |
| `stitch/admin/messages.html` | Two-tab inbox. Contact Messages: click row to expand full message text, auto-marks NEW → READ on expand, status dropdown (NEW/READ/REPLIED), Reply button opens pre-filled mailto link. Early Access: expand row shows full interest + budget + privacy consent fields, status dropdown (NEW/REVIEWED/APPROVED/REJECTED). |

---

## Shared Components Across All 8 Management Pages

- **Auth gate**: `const _token = localStorage.getItem('raen_auth_token'); if (!_token) window.location.href = 'login.html';`
- **Global helpers**: `fmt(n)` for EUR formatting (`€X,XXX.XX`), `fmtDate(d)` for `15 May 2026` format
- **`adminFetch(fn)`**: wraps all API calls, redirects to `login.html` on 401
- **Logout**: clears token, redirects to `login.html`
- **Empty state**: icon + text for every table that may be empty
- **Error state**: red message shown when network/API call fails
- **Active nav**: current page's sidebar link has gold color + left border

---

## API Shapes Used (Actual vs. Briefing)

The briefing contained several incorrect field names for `dashboard-extended` and `analytics` responses. All pages were built against the actual controller output, not the briefing:

| Endpoint | Briefing field | Actual field used |
|----------|----------------|-------------------|
| dashboard-extended | `data.orderCounts` | `data.orders` |
| dashboard-extended | `data.revenue.allTime` | `data.revenue.total` |
| dashboard-extended | `data.pendingVerifications` | `data.pendingUPIVerifications` |
| dashboard-extended | `data.customerCounts` | `data.customers` |
| analytics | `data.totalViews` | `data.summary.totalPageViews` |
| analytics | `data.cartEvents.add_to_cart` | `data.summary.addToCartEvents` |
| analytics | `data.dailyRevenue` | `data.revenueByDay` |
| analytics | `data.revenueByMethod[].total` | `data.revenueByMethod[]._sum.amount` |
| analytics | `data.topProductsByRevenue[].revenue` | `data.topProductsByRevenue[]._sum.lineTotal` |

---

## Backend Verification Tests (All Pass)

| Test | Result |
|------|--------|
| `GET /admin/dashboard-extended` returns HTTP 200 | PASS |
| Response has `data.orders`, `data.revenue.total`, `data.pendingUPIVerifications`, `data.customers`, `data.lowStockItems` | PASS |
| `GET /admin/orders` includes `user` field on each order | PASS |
| `GET /admin/customers` includes `totalSpent` field on each customer | PASS |
| `GET /admin/analytics?period=30` has `data.summary`, `data.revenueByDay`, `data.revenueByMethod`, `data.topProductsByViews` | PASS |
| `data.summary` has all required keys (totalPageViews, uniqueSessions, addToCartEvents, etc.) | PASS |
| `GET /admin/payments/pending-verification` returns payments array | PASS |
| `GET /admin/contact-messages` returns messages array (5 messages in DB) | PASS |
| `GET /admin/early-access` returns requests array | PASS |

---

## Manual Verification Checklist

Start servers if not running:
```bash
# Terminal 1
cd backend && node src/server.js

# Terminal 2
node serve-stitch.js
```

Then open `http://localhost:4173/admin/login.html` and verify:

**Auth flow:**
- [ ] Visiting any admin page without token → redirects to `login.html`
- [ ] Login with `admin@raen.design` / `RaenAdmin2024!` → stores token → redirects to `index.html`
- [ ] Login with wrong credentials → shows error message
- [ ] Sign Out button → clears token → redirects to `login.html`

**Dashboard (`index.html`):**
- [ ] All stat cards show numbers (revenue cards show `€0.00` if no paid orders)
- [ ] Revenue chart renders (may be flat if no paid orders)
- [ ] Period toggle (7d/30d/90d) refetches and updates chart
- [ ] Low stock panel shows items with correct red/amber colour coding
- [ ] UPI alert banner appears if any `VERIFICATION_REQUIRED` payments exist

**Orders (`orders.html`):**
- [ ] Table renders with orders from DB
- [ ] Status dropdown pre-selected to current order status
- [ ] Search filters by order number and email
- [ ] Pagination shows 20/page
- [ ] View button expands row with items, address, payment info

**Products (`products.html`):**
- [ ] Products table renders with image thumbnails (or grey placeholder)
- [ ] Total Stock column shows summed inventory
- [ ] Add Product modal opens, submits, new product appears
- [ ] Edit pre-fills all fields correctly
- [ ] Archive shows confirm dialog, updates row

**Inventory (`inventory.html`):**
- [ ] Alert banner appears (all 12 products × 4 sizes = 48 items, initial stock 10 — alert shows none ≤5)
- [ ] Click stock number → turns into input
- [ ] Enter to save → cell updates with new colour coding

**Payments (`payments.html`):**
- [ ] Four summary cards show EUR totals (€0.00 if no successful payments)
- [ ] Pending UPI section hidden when no VERIFICATION_REQUIRED payments exist
- [ ] Main table shows all payments with correct badges

**Customers (`customers.html`):**
- [ ] Table renders with registered customers
- [ ] `totalSpent` column shows `€0.00` (correct — test customer has no paid orders)
- [ ] View Orders button expands row with order sub-table

**Analytics (`analytics.html`):**
- [ ] Period toggle buttons functional
- [ ] Funnel renders (may show 0s if no analytics data yet)
- [ ] Revenue chart renders (flat if no paid orders)
- [ ] Revenue by method cards render

**Messages (`messages.html`):**
- [ ] Contact Messages tab shows 5 messages
- [ ] Click row → expands full message, auto-marks NEW → READ
- [ ] Early Access tab (empty — 0 requests in DB)
- [ ] Tab switching works cleanly

---

## Known Behaviour Notes

- **`user: null` on guest orders** — correct; orders placed without a registered account have `userId: null` and show email only in the orders table.
- **`totalSpent: 0` on test customer** — correct; the seeded test customer has no paid orders in the DB.
- **Revenue chart flat** — expected on a fresh DB with no `paymentStatus: 'PAID'` orders.
- **Server restart required after edits** — the 5 backend file changes require a server restart to take effect. Server was restarted during this task.
