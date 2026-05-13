# RAEN Phase 1 — Implementation Plan

**Target repo:** https://github.com/srinath1505/RAEN_phase_1  
**Workflow:** Execute → Analyse → Test → Pass → Commit & Push → Next task  
**Branch:** main  

---

## Pre-flight (one-time setup)

Add the target repo as a remote before starting:

```bash
git remote add phase1 https://github.com/srinath1505/RAEN_phase_1.git
git push phase1 main
```

---

## Task 1 — Prisma Schema Additions

### What changes
- Add `salePrice Float?` and `discountPercent Int?` to `Product` model
- Add new model `PageView` (id, path, productId?, sessionId, userAgent?, referer?, createdAt + 3 indexes)
- Add new model `CartEvent` (id, event, sessionId, productId?, orderId?, createdAt + 3 indexes)
- Run migration: `npx prisma migrate dev --name "add_discount_analytics"`
- Re-run `npx prisma generate`

### Files touched
- `backend/src/prisma/schema.prisma`

### Analysis after completion
- Migration file created under `backend/src/prisma/migrations/`
- Prisma client regenerated with new models
- DB tables `page_views` and `cart_events` exist in Neon

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1.1 | Schema has `salePrice` field on Product | `grep 'salePrice' schema.prisma` | Field present |
| T1.2 | Schema has `discountPercent` field on Product | `grep 'discountPercent' schema.prisma` | Field present |
| T1.3 | PageView model defined | `grep 'model PageView' schema.prisma` | Model present |
| T1.4 | CartEvent model defined | `grep 'model CartEvent' schema.prisma` | Model present |
| T1.5 | Migration ran cleanly | `npx prisma migrate status` | All migrations applied |
| T1.6 | Prisma client has PageView | Node REPL: `prisma.pageView.findMany()` | Returns `[]` (empty, no error) |
| T1.7 | Prisma client has CartEvent | Node REPL: `prisma.cartEvent.findMany()` | Returns `[]` (empty, no error) |
| T1.8 | Product model accepts salePrice | `curl PATCH /api/admin/products/:id` with salePrice | 200 OK |

### Commit message
```
feat(db): Task 1 complete — add salePrice/discountPercent to Product, add PageView and CartEvent models
```

---

## Task 2 — Analytics Tracking Backend

### What changes
- Create `backend/src/controllers/analyticsController.js` with `trackPageView` and `trackCartEvent`
- Create `backend/src/routes/analyticsRoutes.js` (POST /pageview, POST /cart-event)
- Register in `backend/src/app.js`: `app.use('/api/analytics', analyticsRoutes)` before error middleware

### Files touched
- `backend/src/controllers/analyticsController.js` (new)
- `backend/src/routes/analyticsRoutes.js` (new)
- `backend/src/app.js`

### Analysis after completion
- Both endpoints respond 200 even on bad input (never block the user)
- `sessionId` and `path` are required for pageview; `event` and `sessionId` for cart-event
- Controller silently swallows DB errors

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T2.1 | Route file exists | `ls backend/src/routes/analyticsRoutes.js` | File found |
| T2.2 | Controller file exists | `ls backend/src/controllers/analyticsController.js` | File found |
| T2.3 | Route registered in app.js | `grep 'analytics' backend/src/app.js` | Line present |
| T2.4 | POST /api/analytics/pageview with valid body | `curl -X POST /api/analytics/pageview -d '{path:"/",sessionId:"test"}'` | `{"ok":true}` |
| T2.5 | POST /api/analytics/pageview with missing sessionId | curl with no sessionId | `{"ok":false}` status 400 |
| T2.6 | POST /api/analytics/cart-event with valid body | `curl -X POST /api/analytics/cart-event -d '{event:"add_to_cart",sessionId:"test"}'` | `{"ok":true}` |
| T2.7 | POST /api/analytics/cart-event with missing event | curl with no event | `{"ok":false}` status 400 |
| T2.8 | PageView record created in DB | After T2.4, `prisma.pageView.findFirst()` | Record exists with correct path/sessionId |
| T2.9 | CartEvent record created in DB | After T2.6, `prisma.cartEvent.findFirst()` | Record exists with correct event/sessionId |

### Commit message
```
feat(api): Task 2 complete — analytics tracking endpoints (pageview + cart-event)
```

---

## Task 3 — Add Tracking Script to All Frontend Pages

### What changes
Add the analytics tracking `<script>` block to the `<head>` of every page:
- `stitch/index.html`
- `stitch/collections.html`
- `stitch/product-detail.html`
- `stitch/shopping-bag.html`
- `stitch/checkout.html`
- `stitch/order-confirmation.html`
- `stitch/contact.html`
- `stitch/early-access.html`
- `stitch/about.html`
- `stitch/faq.html`
- `stitch/care-guide.html`
- `stitch/shipping-returns.html`
- `stitch/press.html`
- `stitch/sustainability.html`
- `stitch/size-guide.html`
- `stitch/journal.html`

Also wire up cart-event calls:
- `product-detail.html` — `window.__trackCart('add_to_cart', product.id)` after add-to-cart success
- `checkout.html` — `window.__trackCart('checkout_started')` on checkout init
- `checkout.html` — `window.__trackCart('checkout_completed', null, order.orderNumber)` on payment success

### Analysis after completion
- `window.__raenSession` and `window.__trackCart` are globally available on all pages
- Session ID persisted in `localStorage` key `raen_session`
- Tracking requests are fire-and-forget (keepalive: true, .catch(() => {}))

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T3.1 | Script present in index.html | `grep 'raen_session' stitch/index.html` | Match found |
| T3.2 | Script present in all 16 pages | `grep -rL 'raen_session' stitch/*.html` | No files listed (all have it) |
| T3.3 | `__trackCart` wired in product-detail | `grep '__trackCart' stitch/product-detail.html` | Match found |
| T3.4 | `checkout_started` wired in checkout | `grep 'checkout_started' stitch/checkout.html` | Match found |
| T3.5 | `checkout_completed` wired in checkout | `grep 'checkout_completed' stitch/checkout.html` | Match found |
| T3.6 | Browser test — visit index.html | Open page, check Network tab | POST to /api/analytics/pageview fires |
| T3.7 | Session persists across pages | Check localStorage in browser | `raen_session` key set to `sess_xxx` |
| T3.8 | PageView count increases | Visit 3 pages, query DB | `prisma.pageView.count()` >= 3 |

### Commit message
```
feat(frontend): Task 3 complete — analytics tracking script added to all 16 frontend pages
```

---

## Task 4 — Fix Broken Product Links + Delete Old Static Pages

### What changes
Replace all old static product hrefs across ALL HTML files:
- `href="bare-obsession.html"` → `href="product-detail.html?slug=bare-obsession"`
- Same pattern for all 12 slugs: `serpentine`, `midnight-venom`, `crimson-vice`, `black-pearl`, `emerald-sin`, `poison-kiss`, `taupe-wrap`, `the-ivory-weapon`, `the-provocateur`, `the-sovereign`, `velvet-scandal`

Delete old static files:
- `stitch/bare-obsession.html`, `stitch/black-pearl.html`, `stitch/crimson-vice.html`
- `stitch/emerald-sin.html`, `stitch/midnight-venom.html`, `stitch/poison-kiss.html`
- `stitch/serpentine.html`, `stitch/taupe-wrap.html`, `stitch/the-ivory-weapon.html`
- `stitch/the-provocateur.html`, `stitch/the-sovereign.html`, `stitch/velvet-scandal.html`

### Files touched
- `stitch/index.html`, `stitch/collections.html` (primary), plus any other pages with product links
- 12 files deleted

### Analysis after completion
- Zero remaining hrefs pointing to old static product HTML files
- All product links go through `product-detail.html?slug=<slug>` which fetches from API
- Clicking any product card loads real data from DB

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T4.1 | No old hrefs in index.html | `grep -c 'bare-obsession.html\|serpentine.html' stitch/index.html` | 0 |
| T4.2 | No old hrefs in collections.html | same grep for collections | 0 |
| T4.3 | No old hrefs anywhere | `grep -r '\.html' stitch/ --include="*.html" \| grep -E 'obsession\|pearl\|crimson\|emerald\|venom\|kiss\|serpentine\|taupe\|ivory\|provocateur\|sovereign\|velvet' \| grep href` | Empty output |
| T4.4 | 12 static files deleted | `ls stitch/bare-obsession.html` | File not found (exit 1) |
| T4.5 | product-detail links have ?slug= | `grep -c 'product-detail.html?slug=' stitch/index.html` | >= 1 |
| T4.6 | Browser test — click product on homepage | Opens product-detail.html?slug=velvet-scandal | Product data loads from API |
| T4.7 | Browser test — click product on collections | Opens product-detail.html?slug=bare-obsession | Product data loads from API |

### Commit message
```
fix(frontend): Task 4 complete — fix all product links to use product-detail.html?slug=, delete 12 old static pages
```

---

## Task 5 — Payment Webhooks with Database Transactions

### What changes
Replace stubs in `backend/src/controllers/paymentController.js` (lines ~102–118):

**Razorpay webhook** (`razorpayWebhook`):
- Verify HMAC-SHA256 signature against `RAZORPAY_WEBHOOK_SECRET`
- On `payment.captured` event: `prisma.$transaction` to update Payment → SUCCESS, Order → PAID, decrement Inventory, create AdminAuditLog
- Non-blocking email via `emailService.sendOrderConfirmation`

**PayPal webhook** (`paypalWebhook`):
- On `PAYMENT.CAPTURE.COMPLETED` event: `prisma.$transaction` to update Payment → SUCCESS, Order → PAID, decrement Inventory
- Non-blocking email

### Files touched
- `backend/src/controllers/paymentController.js`

### Analysis after completion
- Invalid Razorpay signatures return 400 (not 200) — critical for security
- All DB updates are atomic (either all succeed or all roll back)
- Inventory is decremented only after payment confirmed (not at order creation)
- Email errors are logged but never bubble up to block the 200 response

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T5.1 | Razorpay webhook with invalid signature | `curl POST /api/payments/webhook/razorpay` with wrong sig | 400 `{"error":"Invalid signature"}` |
| T5.2 | Razorpay webhook with missing signature header | curl with no `x-razorpay-signature` | 400 |
| T5.3 | Razorpay webhook with valid signature, payment.captured | Simulate with correct HMAC | 200 `{"received":true}` |
| T5.4 | Order status updated after T5.3 | `prisma.order.findFirst()` | status: PAID, paymentStatus: PAID |
| T5.5 | Inventory decremented after T5.3 | `prisma.inventory.findFirst()` for purchased size | stock decreased by order qty |
| T5.6 | AdminAuditLog created after T5.3 | `prisma.adminAuditLog.findFirst({where:{action:'PAYMENT_CONFIRMED'}})` | Record exists |
| T5.7 | PayPal webhook PAYMENT.CAPTURE.COMPLETED | Simulate PayPal event body | 200, order PAID |
| T5.8 | PayPal webhook unknown event type | Send `event_type: 'OTHER'` | 200 (no-op, not error) |
| T5.9 | Webhook function signature check (code review) | `grep 'RAZORPAY_WEBHOOK_SECRET' paymentController.js` | Present |

### Commit message
```
feat(payments): Task 5 complete — Razorpay and PayPal webhooks with DB transactions, inventory sync, and audit logging
```

---

## Task 6 — Contact Form API Integration

### What changes
In `stitch/contact.html`:
1. Add `<script src="public/js/api.js"></script>` before `</body>` if not present
2. Add tracking script to `<head>` (if not already done by Task 3)
3. Add form submit handler: intercept submit, `apiPost('/contact', data)`, replace form with confirmation message on success, show toast on error

### Files touched
- `stitch/contact.html`

### Analysis after completion
- Form submit no longer navigates/reloads the page
- Sends `{ name, email, subject, message }` to `POST /api/contact`
- On success: entire form replaced with "YOUR MESSAGE HAS BEEN RECEIVED" text
- On error: button re-enables, toast shown with fallback email address
- If contact has no explicit `subject` field in HTML, defaults to 'Customer Enquiry'

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T6.1 | api.js script tag present | `grep 'api.js' stitch/contact.html` | Match found |
| T6.2 | Submit handler prevents default | Code review: `e.preventDefault()` | Present |
| T6.3 | POST /api/contact with valid data | `curl -X POST /api/contact -d '{name,email,subject,message}'` | 201 or 200 success |
| T6.4 | ContactMessage created in DB | After T6.3, `prisma.contactMessage.findFirst()` | Record with correct name/email |
| T6.5 | Browser — fill form, submit | Open contact.html in browser | Form replaced with confirmation text |
| T6.6 | Browser — check network | DevTools Network tab | POST to /api/contact fires with form data |
| T6.7 | Backend — admin can see message | `GET /api/admin/contact-messages` | New message appears with status NEW |
| T6.8 | Submit with empty required fields | Leave name blank, submit | Browser validation stops submission (required attribute) |

### Commit message
```
feat(frontend): Task 6 complete — contact form connected to API with success/error handling
```

---

## Task 7 — Expanded Admin Backend Endpoints

### What changes
Add to `backend/src/controllers/adminController.js`:
- `getAnalytics` — 10 parallel Prisma queries, returns funnel stats + chart data
- `createProduct` — with salePrice/discountPercent + auto inventory creation per size + audit log
- `updateProduct` — partial update with salePrice/discountPercent support + audit log
- `deleteProduct` — soft delete (archives) + audit log
- `getProductStats` — per-product analytics + revenue
- `cancelOrder` — transaction: cancel order + restore inventory + mark payment REFUNDED + trigger gateway refund + audit log
- `getDashboardExtended` — 15 parallel queries for full dashboard data

Add to `backend/src/routes/adminRoutes.js`:
- `GET /admin/dashboard-extended`
- `GET /admin/analytics`
- `PUT /admin/products/:id` (note: existing route is PATCH, will add PUT as alias or update)
- `GET /admin/products/:id/stats`
- `POST /admin/orders/:id/cancel`

### Files touched
- `backend/src/controllers/adminController.js`
- `backend/src/routes/adminRoutes.js`

### Analysis after completion
- All endpoints protected by `authMiddleware` + `adminMiddleware` (existing)
- `cancelOrder` restores inventory atomically — no partial states
- `getAnalytics` uses the `PageView` and `CartEvent` tables from Task 1
- `getDashboardExtended` exposes revenue by today/week/month/total plus low stock alerts

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T7.1 | GET /api/admin/dashboard-extended (no auth) | curl without token | 401 |
| T7.2 | GET /api/admin/dashboard-extended (admin token) | curl with admin Bearer token | 200, `{orders, revenue, lowStockItems, ...}` |
| T7.3 | GET /api/admin/analytics?period=30 | curl with token | 200, `{summary, topProductsByViews, revenueByDay, ...}` |
| T7.4 | GET /api/admin/analytics?period=7 | curl with token | 200, revenueByDay has 7 entries |
| T7.5 | POST /api/admin/products with full data | curl with token + body | 201, product created with salePrice |
| T7.6 | Inventory auto-created after T7.5 | `prisma.inventory.findMany({where:{productId:newId}})` | One record per size |
| T7.7 | PUT /api/admin/products/:id with discountPercent | curl with token | 200, product.discountPercent updated |
| T7.8 | DELETE /api/admin/products/:id | curl with token | 200, product.status = ARCHIVED |
| T7.9 | GET /api/admin/products/:id/stats | curl with token | 200, `{product, totalRevenue, pageViews30Days, ...}` |
| T7.10 | POST /api/admin/orders/:id/cancel on PENDING order | curl with token | 200, order CANCELLED, inventory restored |
| T7.11 | POST /api/admin/orders/:id/cancel on DELIVERED order | curl with token | 400 `Cannot cancel...` |
| T7.12 | AdminAuditLog created for each action | Check after T7.5, T7.7, T7.8, T7.10 | Log entries present |

### Commit message
```
feat(api): Task 7 complete — admin endpoints for analytics, product CRUD with discounts, order cancellation, extended dashboard
```

---

## Task 8 — Admin Dashboard UI (8 pages)

### What changes
Create `stitch/admin/` folder with 8 pages, each with:
- Auth gate (redirect if no token)
- Shared sidebar + styles + logout function
- Real API data via `../public/js/api.js`

Pages:
1. `index.html` — Dashboard (stat cards + revenue chart + recent orders + low stock + top products)
2. `orders.html` — Orders table with filters, inline expand, status update, cancel
3. `products.html` — Products table with add/edit modal, stats panel, archive
4. `inventory.html` — Inventory table with inline stock editing, bulk action
5. `payments.html` — UPI verification tab + all payments tab
6. `customers.html` — Customer list with expandable order history
7. `analytics.html` — Funnel stats + 3 Chart.js charts + 2 revenue tables
8. `messages.html` — Contact messages + early access requests

### Files touched
- `stitch/admin/index.html` (new)
- `stitch/admin/orders.html` (new)
- `stitch/admin/products.html` (new)
- `stitch/admin/inventory.html` (new)
- `stitch/admin/payments.html` (new)
- `stitch/admin/customers.html` (new)
- `stitch/admin/analytics.html` (new)
- `stitch/admin/messages.html` (new)

### Analysis after completion
- No admin page is accessible without a valid admin JWT in localStorage
- All pages use `../public/js/api.js` (relative path from admin subfolder)
- Chart.js loaded from CDN only on analytics.html and index.html
- All destructive actions have `confirm()` dialogs

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T8.1 | Auth gate — open index.html without token | Clear localStorage, open admin/index.html | Redirected to ../index.html |
| T8.2 | Dashboard loads with admin token | Set token, open admin/index.html | Revenue cards populated, chart renders |
| T8.3 | Revenue chart renders | Browser visual check on index.html | Gold line chart visible |
| T8.4 | Low stock alert visible | Set a product stock to 2 in DB | Red row appears in low stock table |
| T8.5 | UPI pending alert banner | Create a VERIFICATION_REQUIRED payment | Alert banner shows count |
| T8.6 | Orders page loads and filters | Open orders.html, change status filter | Table re-fetches with filter |
| T8.7 | Order status update | Select new status from dropdown | PATCH fires, badge updates |
| T8.8 | Cancel order from UI | Click Cancel → confirm | POST /orders/:id/cancel fires, row updates |
| T8.9 | Products page — add product modal | Click "Add New Product" | Modal opens with empty form |
| T8.10 | Products page — create product | Fill modal, save | POST fires, new row appears |
| T8.11 | Products page — edit product | Click Edit → change name → save | PUT fires, row updates |
| T8.12 | Products page — archive | Click Archive → confirm | DELETE fires, row removed |
| T8.13 | Products page — stats panel | Click Stats | Panel shows pageViews/revenue |
| T8.14 | Inventory inline edit | Click stock number → type new value → Enter | PATCH fires, value updates |
| T8.15 | Payments — UPI approve | Click Approve on pending row | PATCH fires, row removed |
| T8.16 | Analytics page — period selector | Change to 7 days | All charts and stats refresh |
| T8.17 | Analytics — 3 charts render | Visual check | Revenue line, doughnut, horizontal bar |
| T8.18 | Messages — mark read | Click Mark Read on contact | PATCH fires, badge changes |
| T8.19 | Early access — approve | Click Approve | PATCH fires, status updates |
| T8.20 | Sidebar active state | Check each page | Current page nav item highlighted |
| T8.21 | 13" laptop check | Resize to 1280px | No horizontal scroll, readable |

### Commit message
```
feat(admin): Task 8 complete — full admin dashboard UI with 8 pages (dashboard, orders, products, inventory, payments, customers, analytics, messages)
```

---

## Task 9 — Customer Login / Register Modal

### What changes
Add to: `index.html`, `collections.html`, `product-detail.html`, `shopping-bag.html`, `checkout.html`

- Add "ACCOUNT" nav link before bag icon
- Add auth modal HTML with Sign In / Create Account tabs
- Add modal script: `openAuthModal`, `closeAuthModal`, `switchTab`
- On login success: store token via `setAuthToken`, reload page
- On register success: store token, reload page
- On page load: if token exists, change button to "MY ACCOUNT" linking to `account.html`

### Files touched
- `stitch/index.html`
- `stitch/collections.html`
- `stitch/product-detail.html`
- `stitch/shopping-bag.html`
- `stitch/checkout.html`

### Analysis after completion
- Auth state is consistent across all 5 pages
- `setAuthToken` and `apiPost` come from `stitch/public/js/api.js` (already loaded on all pages)
- Modal is accessible but not visible by default
- Closing modal via × button or clicking outside (optional enhancement)

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T9.1 | ACCOUNT link present in index.html | `grep 'auth-nav-btn' stitch/index.html` | Match found |
| T9.2 | ACCOUNT link present on all 5 pages | `grep -L 'auth-nav-btn' stitch/{index,collections,product-detail,shopping-bag,checkout}.html` | No files listed |
| T9.3 | Auth modal HTML present | `grep 'auth-modal' stitch/index.html` | Match found |
| T9.4 | Open modal — click ACCOUNT | Browser: click ACCOUNT | Modal appears |
| T9.5 | Tab switching | Click CREATE ACCOUNT tab | Register form shown, sign in hidden |
| T9.6 | Login with valid credentials | Use admin@raen.design + RaenAdmin2024! | Token stored, page reloads, nav shows MY ACCOUNT |
| T9.7 | Login with wrong password | Enter wrong password | Error message shown below button |
| T9.8 | Register with new email | Fill register form with new email | Token stored, page reloads |
| T9.9 | Register with duplicate email | Use existing email | Error message shown |
| T9.10 | Logged-in state: nav shows MY ACCOUNT | After T9.6, reload any of 5 pages | Button says MY ACCOUNT, links to account.html |
| T9.11 | MY ACCOUNT is not a modal trigger | Click MY ACCOUNT | Navigates to account.html, not opens modal |

### Commit message
```
feat(frontend): Task 9 complete — customer login/register modal on all main pages with token persistence
```

---

## Task 10 — Customer Account Page

### What changes
Create `stitch/account.html` with:
- Auth gate: redirect to `index.html` if no token
- Profile section: display name + email, edit name/phone form → `PUT /api/account/profile`
- Order history table: order number (link to confirmation), date, items, total, status badge → `GET /api/account/orders`
- Addresses section: list + add (POST) + delete (DELETE) → `/api/account/addresses`
- Sign Out button: clear token → redirect to index.html
- Same header/footer design as other RAEN pages

### Files touched
- `stitch/account.html` (new)

### Analysis after completion
- Page is completely blank/redirected for unauthenticated users
- All API calls include Bearer token via `api.js`'s `apiGet`/`apiPost`/`apiDelete`
- Order numbers link to `order-confirmation.html?orderNumber=X`

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T10.1 | account.html exists | `ls stitch/account.html` | File found |
| T10.2 | Auth gate works | Open without token | Redirected to index.html |
| T10.3 | Profile loads | Open with valid token | Name and email displayed |
| T10.4 | Edit profile | Change first name, save | PUT /api/account/profile fires, success message |
| T10.5 | Order history loads | GET /api/account/orders | Orders listed in table |
| T10.6 | Order number is a link | Check DOM | `<a href="order-confirmation.html?orderNumber=...">` |
| T10.7 | Add address | Fill address form, save | POST /api/account/addresses, address card appears |
| T10.8 | Delete address | Click delete on address card | DELETE fires, card removed |
| T10.9 | Sign out | Click Sign Out | Token cleared, redirected to index.html |
| T10.10 | Account page accessible from nav | After login, click MY ACCOUNT | Lands on account.html |

### Commit message
```
feat(frontend): Task 10 complete — customer account page with profile, order history, and address management
```

---

## Task 11 — Discount Pricing on Product Detail and Collections

### What changes
In `stitch/product-detail.html` — update price display logic:
- Compute `effectivePrice = product.salePrice || (discountPercent ? price * (1 - pct/100) : null)`
- If effectivePrice < price: show strikethrough original + gold effective price + "X% OFF" badge
- Else: show plain price

In `stitch/collections.html` — same logic for product cards:
- Show sale price with strikethrough original on product cards

### Files touched
- `stitch/product-detail.html`
- `stitch/collections.html`

### Analysis after completion
- If both `salePrice` and `discountPercent` are set, `salePrice` takes precedence
- Products with no discount show price unchanged
- The `%OFF` badge only shows when `discountPercent` is set (not just salePrice)
- Prices are always formatted to 2 decimal places with EUR symbol

### Test cases
| # | Test | Method | Expected |
|---|------|--------|----------|
| T11.1 | effectivePrice logic present | `grep 'effectivePrice' stitch/product-detail.html` | Match found |
| T11.2 | Same logic in collections | `grep 'effectivePrice' stitch/collections.html` | Match found |
| T11.3 | Set salePrice via admin | PUT /api/admin/products/:id with salePrice=900 (price=1450) | DB updated |
| T11.4 | Product detail shows strikethrough | Open product-detail.html?slug=that-product | €1450.00 strikethrough + €900.00 in gold |
| T11.5 | Collections card shows strikethrough | Open collections.html | Same product card shows sale price |
| T11.6 | Set discountPercent=20, clear salePrice | PUT with discountPercent=20, salePrice=null | Computed: price*0.8 used |
| T11.7 | Product detail shows % OFF badge | After T11.6, open detail page | "20% OFF" badge visible |
| T11.8 | Product with no discount | Product where both salePrice and discountPercent null | Single plain price, no strikethrough |

### Commit message
```
feat(frontend): Task 11 complete — discount pricing (salePrice + discountPercent) displayed on product detail and collections pages
```

---

## Git Push Protocol (after each task)

```bash
# Stage all changes for this task
git add -A

# Commit with task-specific message (from each section above)
git commit -m "<message from task section>"

# Push to the phase 1 safety repo
git push phase1 main

# Also push to original remote (optional but recommended)
git push origin main
```

If push fails due to no upstream:
```bash
git push --set-upstream phase1 main
```

---

## Summary Table

| Task | Scope | Files Changed | Key Risk |
|------|-------|---------------|----------|
| 1 | DB schema | 1 schema file | Migration must succeed on Neon cloud DB |
| 2 | Backend | 2 new files + app.js | Route registration order (before error middleware) |
| 3 | Frontend | 16 HTML files | Must not break existing `<head>` scripts |
| 4 | Frontend | 2+ HTML files + 12 deleted | grep verification must return empty |
| 5 | Backend | paymentController.js | HMAC verification must use raw body, not parsed JSON |
| 6 | Frontend | contact.html | Form field name/id matching for data extraction |
| 7 | Backend | adminController.js + routes | AdminAuditLog foreign key is userId (not orderId) |
| 8 | Frontend | 8 new files | api.js relative path `../public/js/api.js` from admin/ |
| 9 | Frontend | 5 HTML files | `setAuthToken` must exist in api.js |
| 10 | Frontend | 1 new file | Account API endpoints must already work |
| 11 | Frontend | 2 HTML files | effectivePrice must not NaN on undefined fields |
