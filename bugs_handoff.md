# RAEN — Bugs Handoff Document

**Last updated:** 2026-05-19  
**Environment:** Production — `raenphase1-production.up.railway.app`  
**Repo:** `github.com/srinath1505/RAEN_phase_1`

---

## SECTION 1 — BUGS CLEARED (Confirmed Fixed & Pushed)

### Infrastructure / Deployment

| # | Bug | How It Was Caught | Fix Applied |
|---|-----|-------------------|-------------|
| I-1 | Backend crashed on startup with placeholder Razorpay keys | Server log on Railway | `razorpay.js` now guards `new Razorpay()` behind `isConfigured` check — null returned when keys are placeholders |
| I-2 | Helmet default CSP blocked Tailwind CDN, Google Fonts, Razorpay, PayPal scripts — entire site unstyled on any non-cached browser | Friend's laptop showed raw HTML | Explicit CSP directives added: `cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `accounts.google.com`, `checkout.razorpay.com`, `paypal.com` |
| I-3 | `NODE_ENV=production` root route returned JSON API info instead of serving `stitch/index.html` | Architecture review | Root `GET /` wrapped in `if (nodeEnv !== 'production')` block; `express.static('stitch/')` added for production only |
| I-4 | Backend served frontend only in production but Helmet CSP still blocked external resources | Combined CSP + static serve bug | Fixed together with I-2 |

### Authentication

| # | Bug | How It Was Caught | Fix Applied |
|---|-----|-------------------|-------------|
| A-1 | Admin login page (`admin/login.html`) had `const API = 'http://localhost:5000'` hardcoded — login always failed silently in production, all admin pages redirected to login with 499 errors | Railway HTTP logs showed 499 on every admin API call | Changed to `const API = (location.hostname === 'localhost' ...) ? 'http://localhost:5000' : ''` |
| A-2 | No sign-out button on any public-facing page (index, collections, product-detail, shopping-bag, checkout) — logged-in users had no way to log out except going to account.html | User reported can't sign out | `auth-modal.js` DOMContentLoaded now injects a `SIGN OUT` button next to `MY ACCOUNT` in the nav for all public pages when a user is logged in |
| A-3 | `account.html` sign-out buttons had no `type="button"` — could accidentally submit a form | Code review | Added `type="button"` to both sign-out buttons in account.html |
| A-4 | Sign-out only removed `raen_auth_token`, left `raen_session_id` and other state in localStorage | Code review | Sign-out now removes both `raen_auth_token` and `raen_session_id`; uses `window.location.replace` so back button doesn't return to auth-required page |
| A-5 | Google Sign-In silently fails in production — `accounts.google.com` origin not whitelisted in Google Cloud Console | Friend's system tested | **Action required by user** — not a code fix, Google Cloud Console config (see Section 3) |

### Payments

| # | Bug | How It Was Caught | Fix Applied |
|---|-----|-------------------|-------------|
| P-1 | PayPal checkout showed "PayPal approval URL not received" — `createPaypalPayment` service returned `{paypalOrderId, payment}` but never extracted `approvalUrl` from PayPal's `links` array | Live testing on production | `paymentService.js` now extracts `links.find(rel==='approve').href` and returns `approvalUrl` in both code paths |
| P-2 | UPI payment redirected to order-confirmation correctly but page crashed and showed "Unable to load order details" | Live testing — screenshot | All order-confirmation bugs (O-1 through O-5 below) fixed |
| P-3 | Razorpay shows "Failed to create Razorpay order" | Live testing | **Expected** — Razorpay keys are still `rzp_test_placeholder`. Will work once real keys are set. Not a code bug. |

### Order Confirmation Page

| # | Bug | How It Was Caught | Fix Applied |
|---|-----|-------------------|-------------|
| O-1 | Date showed "undefined NaN — undefined NaN, NaN" | Live screenshot | `apiGet('/orders/X')` returns `{order:{...}}` (api.js unwraps `data`). Code used `order.createdAt` directly. Fixed: `const order = result.order \|\| result` |
| O-2 | "Unable to load order details" crash — `addr.firstName`, `addr.streetAddress` undefined | Live screenshot | Checkout saves `fullName`, `addressLine1`, `addressLine2`. Fixed address fields to use correct names with fallbacks |
| O-3 | Payment method displayed blank | Code audit | `order.paymentMethod` doesn't exist on Order model — fixed to `order.payments?.[0]?.provider` |
| O-4 | Product images and names showed empty | Code audit | `item.product` is null (orderService uses `items:true` not full product include) — fixed to use denormalized `item.productName`, `item.image`, `item.lineTotal` |
| O-5 | Totals crashed — `order.subtotal.toLocaleString()` etc. | Code audit | All 4 total fields wrapped with `(order.subtotal \|\| 0)` guards |
| O-6 | `order.items.forEach()` without null guard | Code audit | Changed to `(order.items \|\| []).forEach()` |

### Frontend Pages

| # | Bug | How It Was Caught | Fix Applied |
|---|-----|-------------------|-------------|
| F-1 | Collections page — product prices from DB never loaded, stuck on static HTML hardcoded values | Code audit | `apiGet('/products')` returns `{products:[...]}` not an array — `products.forEach()` was crashing silently. Fixed: `const products = result.products \|\| result \|\| []` with `Array.isArray` guard |
| F-2 | Shopping bag — totals `reduce()` used `item.product.price` without null guard | Code audit | Fixed to `(item.product && item.product.price) \|\| item.unitPrice \|\| 0` |
| F-3 | Account page — `order.items[0]` without null guard could crash orders table | Code audit | Fixed to `(order.items \|\| [])[0]` |
| F-4 | Account page — `order.total.toFixed(2)` without null guard | Code audit | Fixed to `(order.total \|\| 0).toFixed(2)` |

### Email / SMTP

| # | Bug | How It Was Caught | Fix Applied |
|---|-----|-------------------|-------------|
| E-1 | Hostinger SMTP used `secure: false` — port 465 requires SSL (`secure: true`) | Pre-launch check | `mail.js` now uses `secure: port === 465` |
| E-2 | Wrong SMTP password `ILYcarrot$25` (reversed) | SMTP verify test failed | Corrected to `ILYcarrot25$` in `.env` and Railway Variables |

---

## SECTION 2 — KNOWN LIMITATIONS (Not Bugs, By Design or Pending)

| # | Item | Status |
|---|------|--------|
| L-1 | Razorpay payment — fails with "Failed to create Razorpay order" | **Pending real keys** — Razorpay only works after client provides live/test API keys. Currently placeholder. |
| L-2 | Google Sign-In buttons render but do nothing | **Pending Google Cloud Console config** — Railway URL must be added to authorized origins. See Section 3. |
| L-3 | Twilio SMS — only verified phone numbers receive OTPs (trial account restriction) | **Trial limitation** — add phone numbers to Twilio Verified Caller IDs. Resolved when Twilio account upgraded. |
| L-4 | WhatsApp OTP button shows "COMING SOON" | **By design** — WhatsApp Twilio integration deferred. SMS works. |
| L-5 | PayPal webhook signature verification is relaxed | **Pending** — PayPal webhook secret needs to be set in Railway vars once PayPal webhook URL is configured in PayPal dashboard. |
| L-6 | `PAYPAL_WEBHOOK_ID` is placeholder | **Pending** — set after PayPal webhook is configured in dashboard. |

---

## SECTION 3 — PENDING CONFIGURATION (One-Time Setup Required)

| # | What | Where | Steps |
|---|------|-------|-------|
| C-1 | Add Railway URL to Google OAuth authorized origins | Google Cloud Console | APIs & Services → Credentials → OAuth Client `359270964372-cs9...` → Authorized JavaScript origins → add `https://raenphase1-production.up.railway.app` → Save |
| C-2 | Set `FRONTEND_URL` in Railway to actual deployment URL | Railway → Variables | Set `FRONTEND_URL=https://raenphase1-production.up.railway.app` |
| C-3 | PayPal webhook URL in PayPal dashboard | PayPal Developer Dashboard | Apps → Live app → Webhooks → add `https://raenphase1-production.up.railway.app/api/payments/paypal/webhook` → copy Webhook ID → set `PAYPAL_WEBHOOK_ID` in Railway |
| C-4 | Razorpay keys | Razorpay Dashboard | After client provides → update `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in Railway vars → configure webhook URL in Razorpay dashboard |
| C-5 | Twilio upgrade for unrestricted SMS | Twilio Console | Add billing to remove trial restrictions OR add test phone numbers to Verified Caller IDs |

---

## SECTION 4 — AREAS TO VERIFY (Complete Bug-Free Checklist)

Work through every item below on the live Railway deployment. Mark ✅ when confirmed working.

---

### 4.1 — Homepage (`/index.html`)

- [ ] Page loads with correct RAEN styling (fonts, images, layout)
- [ ] Hero slider advances correctly
- [ ] "Discover the Piece" and product links go to `product-detail.html?slug=X`
- [ ] Newsletter subscribe form: enter email → success toast → no error
- [ ] Newsletter subscribe form: empty email → shows error, does not submit
- [ ] ACCOUNT button in nav → opens auth modal (Sign In view)
- [ ] After login: ACCOUNT becomes MY ACCOUNT (links to account.html) + SIGN OUT appears
- [ ] SIGN OUT button from nav → clears token → redirects to homepage → shows ACCOUNT again (not MY ACCOUNT)
- [ ] Shopping bag icon links to shopping-bag.html
- [ ] Collections / Archive nav links work
- [ ] Footer links all resolve (no 404 pages)
- [ ] Analytics: page view fires (check admin → Analytics → Page Views count increases)

---

### 4.2 — Collections (`/collections.html`)

- [ ] Page loads with all 12 product cards showing
- [ ] Product prices show **EUR amounts from DB** (not USD/hardcoded — bare-obsession €3,900, midnight-venom €2,400, etc.)
- [ ] Clicking a product card goes to `product-detail.html?slug=correct-slug`
- [ ] Discount badge and strikethrough price show for any product with `salePrice` or `discountPercent` set
- [ ] SIGN OUT visible in nav when logged in (after fix)
- [ ] Analytics: page view fires

---

### 4.3 — Product Detail (`/product-detail.html?slug=midnight-venom`)

- [ ] Product name, price, description load from DB (not placeholder "The Devastating Silk Column")
- [ ] Price shows correctly with comma formatting (€2,400.00)
- [ ] 5 product images display and carousel works
- [ ] Size buttons render (XS, S, M, L) — in-stock selectable, out-of-stock greyed
- [ ] Selecting a size activates the button style
- [ ] "Add to Bag" button without selecting size → shows error toast
- [ ] "Add to Bag" with size selected → shows success toast → bag icon updates
- [ ] Discount: test with a product that has discountPercent → strikethrough + gold price + "X% OFF" badge
- [ ] Related products links go to correct product slugs
- [ ] SIGN OUT visible when logged in
- [ ] Analytics: `add_to_cart` event fires on add to bag

---

### 4.4 — Shopping Bag (`/shopping-bag.html`)

- [ ] Cart loads items correctly (product name, image, size, quantity, EUR price)
- [ ] Subtotal, shipping (Complimentary), total display correctly
- [ ] Quantity + button increases quantity
- [ ] Quantity − button decreases quantity (remove at 0 or show confirm)
- [ ] Remove button removes item
- [ ] Empty cart shows "Your selection is empty" message and disabled checkout button
- [ ] Proceed to Checkout button goes to checkout.html
- [ ] Cart persists across page reloads (sessionId stored in localStorage)
- [ ] SIGN OUT visible when logged in

---

### 4.5 — Checkout (`/checkout.html`)

- [ ] Page loads with cart items in order summary (right panel)
- [ ] Subtotal, shipping (Complimentary), tax (€0), total show correctly
- [ ] All form fields present: email, first name, last name, address, apartment, city, state, postal code, country, phone
- [ ] Logged-in user: email auto-filled (read-only), firstName, lastName pre-filled
- [ ] Guest user: "Secure Acquisition" without login → auth modal opens
- [ ] After login from auth gate: modal closes, form data preserved, payment proceeds automatically (no page reload)
- [ ] All 3 payment options visible: Razorpay, PayPal, UPI
- [ ] **PayPal flow**: select PayPal → click Secure Acquisition → should redirect to PayPal sandbox approval page (after fix)
- [ ] **UPI flow**: select UPI → click Secure Acquisition → redirects to order-confirmation with `?paymentPending=true`
- [ ] **Razorpay flow**: currently shows "Failed to create Razorpay order" — expected until real keys set
- [ ] Missing required field → shows error toast, does not proceed
- [ ] Invalid email format → shows error toast
- [ ] Analytics: `checkout_started` fires on button click

---

### 4.6 — Order Confirmation (`/order-confirmation.html?orderNumber=RAEN-XXXX`)

- [ ] Order number displays correctly (e.g., RAEN-20260519-0001)
- [ ] Status displays correctly (Awaiting Payment / Payment Confirmed / etc.)
- [ ] Delivery date estimate shows real dates (e.g., "May 24 — May 27, 2026") — NOT "undefined NaN"
- [ ] Shipping address displays correctly: full name, address line 1, city, country
- [ ] Payment method displays (PayPal / UPI Manual Verification / Razorpay)
- [ ] Payment status displays (Payment Verification Pending / etc.)
- [ ] Product name and image display for each item — NOT blank/placeholder
- [ ] Subtotal, tax, shipping, total show correct EUR amounts — NOT crashing
- [ ] "Command More" button goes to collections.html
- [ ] "Enter the VIP List" goes to early-access.html
- [ ] UPI pending banner shows when `?paymentPending=true`
- [ ] Analytics: `checkout_completed` fires when arriving here after successful payment

---

### 4.7 — Account Page (`/account.html`)

**Auth & Nav**
- [ ] Visiting without token → immediate redirect to index.html (auth gate in `<head>`)
- [ ] MY ACCOUNT in nav links back to account.html when already there
- [ ] SIGN OUT in nav (top-right) → clears token → redirects to homepage
- [ ] SIGN OUT at page bottom → same behaviour

**Profile Section**
- [ ] Name, email, phone display correctly from DB
- [ ] "Edit Profile" button reveals edit form
- [ ] Cancel button returns to display mode
- [ ] Save valid profile update → success toast → display updates
- [ ] Save with invalid phone (no +, wrong format) → shows inline error, does not submit
- [ ] Email shown as read-only with "contact support" note

**Orders Section**
- [ ] Orders load and display in table (order number, date, items summary, total, status badge)
- [ ] Order number link goes to `order-confirmation.html?orderNumber=X`
- [ ] Cancel button appears for eligible orders (PENDING/PAID, within 48h)
- [ ] Cancel order → confirm dialog → cancels → table refreshes
- [ ] Empty state shows "No orders yet" CTA

**Addresses Section**
- [ ] Addresses load as cards with full name, address, phone
- [ ] "+ Add Address" button opens modal
- [ ] Save new address → appears in grid
- [ ] Edit existing address → modal pre-fills → save → updates card
- [ ] Delete address → confirm dialog → removes card
- [ ] State field is optional (international addresses work without state)

---

### 4.8 — Auth Modal (triggered from any public page)

**Sign In view**
- [ ] Modal opens when ACCOUNT is clicked (logged-out state)
- [ ] Email + password → correct credentials → modal closes → nav updates to MY ACCOUNT + SIGN OUT
- [ ] Wrong password → error message appears, modal stays open
- [ ] "Forgot password?" link → switches to Forgot Password view
- [ ] "Create an account" link → switches to Register view
- [ ] Google Sign-In button visible (disabled/toast if Client ID not activated) — see L-2
- [ ] Close (×) button closes modal
- [ ] Escape key closes modal
- [ ] Clicking overlay closes modal

**Create Account view**
- [ ] All fields present: first name, last name, email, phone, password, confirm password
- [ ] Password match indicator (✓ green / ✗ red) updates in real-time
- [ ] Password under 8 chars → validation error
- [ ] Phone in E.164 format required (+country code)
- [ ] SMS channel selected by default; WhatsApp shows "COMING SOON" badge
- [ ] Clicking WhatsApp → shows "WhatsApp verification will be available soon" message
- [ ] "Send Verification Code" → OTP sent via Twilio SMS → switches to Verification view
- [ ] "Sign in" link switches back to Sign In view

**Verification (OTP) view**
- [ ] 6 individual digit boxes display
- [ ] Paste of 6-digit code fills all boxes
- [ ] Backspace moves to previous box
- [ ] Auto-advances to next box on digit entry
- [ ] Correct OTP → account created → modal closes → logged in
- [ ] Wrong OTP → error message (shows remaining attempts)
- [ ] "Resend code" button: 60s cooldown timer shows, then re-enables
- [ ] Back button returns to Register view

**Forgot Password view**
- [ ] Enter email → OTP sent to registered phone → switches to OTP view
- [ ] Correct OTP → magic link sent to email → success state shown
- [ ] "Return to Sign In" button works

---

### 4.9 — Contact Page (`/contact.html`)

- [ ] Form renders (Name, Email, Message fields)
- [ ] Submit with all valid fields → success state replaces form (no resubmit possible)
- [ ] Submit with empty name → 422 validation error shown
- [ ] Submit with invalid email → 422 error shown
- [ ] Submit with empty message → 422 error shown
- [ ] Submission saved in DB (check admin → Messages)

---

### 4.10 — Early Access Page (`/early-access.html`)

- [ ] Form renders with all fields
- [ ] Submit valid form → success message
- [ ] Privacy consent checkbox required
- [ ] Submission saved in DB (check admin → Messages → Early Access tab)

---

### 4.11 — Admin — Login (`/admin/login.html`)

- [ ] Page loads standalone (no sidebar, no nav)
- [ ] Wrong credentials → error message
- [ ] Correct credentials (`admin@raen.design` / `RaenAdmin2024!`) → token stored → redirects to `admin/index.html`
- [ ] Visiting any admin page without token → redirects to `login.html`
- [ ] Enter key submits form

---

### 4.12 — Admin — Dashboard (`/admin/index.html`)

- [ ] Revenue stat cards load: Today, This Week, This Month, All-Time (€0.00 acceptable if no paid orders)
- [ ] Order status cards load: Pending, Paid, Processing, Shipped, Delivered, Cancelled
- [ ] Revenue chart renders (Chart.js) — flat line is OK on fresh DB
- [ ] Period toggle (7d / 30d / 90d) refreshes chart
- [ ] Low stock panel: items with stock ≤ 5 show with red/amber colour
- [ ] Top 5 products by revenue table loads
- [ ] Recent orders table loads
- [ ] UPI alert banner appears if any `VERIFICATION_REQUIRED` payments exist
- [ ] Sign Out button works → redirects to `admin/login.html`

---

### 4.13 — Admin — Orders (`/admin/orders.html`)

- [ ] Orders table loads with order number, customer, email, date, total, status
- [ ] Search by order number filters results
- [ ] Search by customer name filters results
- [ ] Pagination: 20 orders per page, next/prev buttons work
- [ ] Status dropdown pre-selected to current order status
- [ ] Changing status → confirm dialog → updates order
- [ ] Cancel button visible for cancellable orders (PENDING/PAID, <48h)
- [ ] Expand row → shows items, shipping address, payment method
- [ ] Sign Out works

---

### 4.14 — Admin — Products (`/admin/products.html`)

- [ ] Products table loads: image thumbnail, name, slug, price, stock total, status badge
- [ ] "Add Product" button opens modal
- [ ] Add Product: fill all fields → save → new product appears in table
- [ ] Add Product: negative price → 422 validation error
- [ ] Add Product: discountPercent > 100 → 422 validation error
- [ ] Edit product: click Edit → modal pre-fills all fields → save → row updates
- [ ] "Stats" modal: click Stats icon → shows 30-day page views, cart adds, conversion rate
- [ ] Archive product: click Archive → confirm dialog → row shows ARCHIVED status
- [ ] Sign Out works

---

### 4.15 — Admin — Inventory (`/admin/inventory.html`)

- [ ] Table loads: all product + size combinations with stock levels
- [ ] Alert banner shows for all items with stock ≤ 5 (red ≤ 2, amber ≤ 5)
- [ ] Click stock number → turns into editable input
- [ ] Enter saves new stock value → cell updates with colour coding
- [ ] Escape cancels edit → reverts to original value
- [ ] Bulk restock panel: select items, enter quantity, sequential PATCH calls, progress shows
- [ ] Sort by product name / stock columns
- [ ] Sign Out works

---

### 4.16 — Admin — Payments (`/admin/payments.html`)

- [ ] Summary cards load: Total Revenue (€), Razorpay, PayPal, UPI totals
- [ ] Pending UPI section hidden when no `VERIFICATION_REQUIRED` payments
- [ ] Pending UPI section shows payments needing approval when they exist
- [ ] Approve UPI payment → confirm dialog → payment status updates to SUCCESS
- [ ] Reject UPI payment → confirm dialog → payment status updates to FAILED, order CANCELLED
- [ ] Main payments table shows all payments with provider / status filter dropdowns
- [ ] Provider filter (All / Razorpay / PayPal / UPI) filters table
- [ ] Status filter (All / Created / Success / Failed / etc.) filters table
- [ ] Sign Out works

---

### 4.17 — Admin — Customers (`/admin/customers.html`)

- [ ] Customers table loads: name, email, phone, joined date, total spent, order count
- [ ] Search by name filters results
- [ ] Search by email filters results
- [ ] Sortable columns: click header to sort
- [ ] "View Orders" expands row showing last 5 orders for that customer
- [ ] `totalSpent` shows € amount (€0.00 for customers with no paid orders is correct)
- [ ] Sign Out works

---

### 4.18 — Admin — Analytics (`/admin/analytics.html`)

- [ ] Period toggle (7 / 30 / 90 days) loads data and updates all sections
- [ ] Funnel stat cards: Total Page Views, Unique Sessions, Add to Cart, Checkout Started, Checkout Completed
- [ ] Conversion funnel (5 steps) renders with percentages
- [ ] Revenue line chart renders (Chart.js)
- [ ] Revenue by payment method cards (Razorpay / PayPal / UPI)
- [ ] Top 5 products by views table
- [ ] Top 5 products by revenue table
- [ ] Sign Out works

---

### 4.19 — Admin — Messages (`/admin/messages.html`)

- [ ] Contact Messages tab loads with all submitted contact forms
- [ ] Click a row → expands full message → status auto-changes NEW → READ
- [ ] Status dropdown (NEW / READ / REPLIED) updates on change
- [ ] Reply button opens `mailto:` link pre-filled with customer email
- [ ] Early Access tab loads with all early-access requests
- [ ] Early Access row expand shows interest, budget, privacy consent
- [ ] Status dropdown (NEW / REVIEWED / APPROVED / REJECTED) updates
- [ ] Tab switching (Contact / Early Access) works cleanly
- [ ] Sign Out works

---

### 4.20 — Email Flows (SMTP — Hostinger)

Test by triggering each action and checking the recipient's inbox:

- [ ] Register new account → welcome/verification email received
- [ ] Forgot password → OTP email received
- [ ] Complete order (UPI/PayPal) → order confirmation email received
- [ ] Successful payment → payment receipt email received
- [ ] Contact form submit → notification to `hello@raen.design`

---

### 4.21 — Analytics Tracking (End-to-End)

Verify in Admin → Analytics after performing actions:

- [ ] Visit any page → Page Views count in analytics increases
- [ ] Add item to bag → `add_to_cart` event count increases
- [ ] Begin checkout → `checkout_started` event count increases
- [ ] Complete payment → `checkout_completed` event count increases
- [ ] Product detail page visit → product-specific page view tracked

---

### 4.22 — Security Basics

- [ ] `/api/admin/*` without token → returns 401 JSON (not 500 or HTML)
- [ ] `/api/account/*` without token → returns 401 JSON
- [ ] `/api/auth/login` with wrong password → returns 401 (not 500)
- [ ] Razorpay webhook without signature header → returns 400
- [ ] PayPal webhook without body → returns 400 or 200 gracefully
- [ ] Rate limiter: 6+ rapid login attempts → returns 429
- [ ] Admin page without `raen_auth_token` in localStorage → redirects to `admin/login.html`

---

## SECTION 5 — REMAINING TASKS BEFORE GO-LIVE

| Priority | Task | Owner |
|----------|------|-------|
| 🔴 HIGH | Add Railway URL to Google Cloud Console OAuth authorized origins (C-1) | Srinath |
| 🔴 HIGH | Set correct `FRONTEND_URL` in Railway variables to production URL (C-2) | Srinath |
| 🔴 HIGH | Provide Razorpay live/test API keys + configure webhook (C-4) | Client / Srinath |
| 🟡 MED | Configure PayPal webhook in PayPal dashboard + set `PAYPAL_WEBHOOK_ID` (C-3) | Srinath |
| 🟡 MED | Upgrade Twilio trial to remove verified-numbers restriction (C-5) | Srinath |
| 🟡 MED | Rotate `JWT_SECRET` to a fresh 64-byte hex value before public launch | Srinath |
| 🟢 LOW | Switch `PAYPAL_ENV` from `sandbox` to `live` when ready for real payments | Srinath |
| 🟢 LOW | Switch `TOKEN_STORE` to `redis` for high-traffic production (currently `db` — fine for launch) | Srinath |
| 🟢 LOW | Set up custom domain (`raen.design`) → add to CORS + Google OAuth + Railway networking | Client / Srinath |

---

## SECTION 6 — HOW TO RE-RUN AUTOMATED CHECKS

```bash
# 1. Make sure backend is running locally
cd backend && node src/server.js

# 2. From project root — runs 61 automated checks across all API layers
node task-reports/pre-launch-check.js

# 3. Twilio SMS test (send real SMS to a verified number)
node task-reports/test-twilio.js
```

Expected result: `61/61 PASSED · READY FOR PRODUCTION`

---

*Document maintained by development team. Update this file whenever a new bug is found or fixed.*
