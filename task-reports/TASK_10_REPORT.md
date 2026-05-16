# Task 10 — Customer Account Page

**Status:** COMPLETE ✅  
**Test results:** 149/149 passed, 0 failed, 0 skipped  
**Test runner:** `node task-reports/test-task10.js`

---

## What Was Done

Replaced the Task 9 stub `stitch/account.html` ("Coming soon") with a fully functional customer account page. Added two missing backend endpoints. Fixed a schema constraint that broke international addresses.

---

## Files Changed

### Backend

| File | Change |
|------|--------|
| `backend/src/prisma/schema.prisma` | `state String` → `state String?` — makes state/province optional for international markets (Singapore, UAE, etc.) |
| `backend/src/controllers/accountController.js` | Added `getProfile` (DB lookup returning firstName, lastName, email, phone — no passwordHash) and `updateProfile` (PATCH with E.164 phone validation, scoped to `req.user.id`) |
| `backend/src/routes/accountRoutes.js` | Added `GET /profile` and `PATCH /profile` routes with express-validator (firstName required, lastName required, phone optional with E.164 regex). Removed `body('state').notEmpty()` from `POST /addresses` validator. Kept existing `GET /orders`, `GET /addresses`, `POST /addresses`, `PATCH /addresses/:id`, `DELETE /addresses/:id`. |

DB schema change applied via `npx prisma db push`.

### Frontend

| File | Change |
|------|--------|
| `stitch/account.html` | Full replacement — see sections below |

---

## account.html — Full Feature List

### Auth & Nav
- **Auth gate:** In `<head>` before DOM — immediate redirect to `index.html` if no `raen_auth_token` in localStorage
- **No auth-modal.js:** User is already authenticated; no modal needed
- **Main nav:** Logo + Collections/Archive (left), MY ACCOUNT + bag + SIGN OUT (right). Sign out appears both in nav (top-right) and as a discreet text link at the bottom of page content (F14)
- **Analytics IIFE:** Tracks page views to `/api/analytics/pageview` consistent with all other RAEN pages (Task 3 pattern)

### In-Page Section Nav
- Sticky strip at `top: 80px` (below the fixed main nav)
- Three anchors: PROFILE / ORDERS / ADDRESSES
- `IntersectionObserver` highlights the active section as the user scrolls (`snav-active` class)

### Profile Section
- **Display mode (default):** Full name, email (read-only), phone — shown in a bordered white card
- **Edit mode (toggle):** "Edit Profile" button reveals the edit form inline; "Cancel" restores display mode
- **Fields editable:** `firstName`, `lastName`, `phone` only
- **Email:** Displayed read-only with note "To change your email, contact support at hello@raen.design"
- **Phone validation (client + server):** E.164 format (`+` followed by ≥7 digits). Client shows inline error without submitting; server returns 422 on invalid format
- **Success feedback:** `showToast('Profile updated', 'success')` — no inline message clutter
- **API:** `GET /api/account/profile` on load, `PATCH /api/account/profile` on save

### Order History Section
- **Loading state** → **table** or **empty state** based on API response
- **Empty state:** "No orders yet." + understated CTA "Browse the Collection" → `collections.html`
- **Table columns:** Order # (links to `order-confirmation.html?orderNumber=X`), Date (DD Mon YYYY), Items, Total EUR, Status badge
- **Items summary:** Single item → `"Midnight Venom (M) × 1"`; multi-item → `"Midnight Venom + 2 more"`
- **Status badges:** Luxury minimal — thin 1px border, muted colour palette per status (PENDING amber, PAID/DELIVERED green, PROCESSING/SHIPPED blue, CANCELLED red, REFUNDED grey). No solid pills.
- **API:** `GET /api/account/orders` — all orders, `createdAt DESC`, with items included
- **Data isolation:** Only orders where `userId = req.user.id` (guest orders excluded by design)

### Addresses Section
- **Loading state** → **cards grid** or **empty state**
- **Empty state:** "No saved addresses." + understated `"+ Add Address"` text link
- **Cards:** Each shows fullName, address lines, city/state/postcode/country, phone — with Edit and Delete actions
- **"+ Add Address" link** in section heading (shown after addresses load)
- **Modal (add/edit):** Centered white card on dark overlay; all address fields with state/addressLine2 marked optional; closes on × button, Cancel button, Escape key, or overlay click; pre-fills all fields when editing
- **Ownership enforcement:** Server returns 404 (not 403) for PATCH/DELETE on another user's address
- **Confirmation dialog:** `confirm()` before delete
- **Toast feedback** on add, edit, delete
- **API:** `GET /api/account/addresses`, `POST /api/account/addresses`, `PATCH /api/account/addresses/:id`, `DELETE /api/account/addresses/:id`

### Footer
Full 4-column black footer from `index.html`: RAEN logo + description, Collection links, Customer Care links, Social links, copyright row.

---

## Discrepancies Found vs. Handoff Assumptions

| # | Finding | Resolution |
|---|---------|------------|
| 1 | `accountController.js` and `accountRoutes.js` already existed (handoff said "assume zero") | Used existing code; added only the two missing endpoints |
| 2 | `Address` model already in schema — field names differ from user's Q1 spec (`addressLine1` not `line1`, `postalCode` not `postcode`, has `fullName` + `phone`) | Used actual schema field names throughout |
| 3 | Schema had `state String` (required) — contradicted F13 answer (optional) | Changed to `state String?`, removed required validator from route, ran `prisma db push` |
| 4 | `isDefault Boolean` exists in schema and controller — user said no default concept in UI | Controller support untouched; not exposed in UI |
| 5 | Existing address update route is `PATCH`, not `PUT` | Kept `PATCH`; used `apiPatch()` in frontend |
| 6 | `api.js` has no `apiPut` — only `apiGet/apiPost/apiPatch/apiDelete` | Profile update route uses `PATCH /api/account/profile` + `apiPatch()` |

---

## Test Coverage

| Group | Description | Tests |
|-------|-------------|-------|
| A | Health check | 1 |
| B | Auth setup (admin + 2 test users) | 3 |
| C | GET /account/profile — shape, fields, no passwordHash, 401 without token | 8 |
| D | PATCH /account/profile — valid update, phone validation (no +, too short, letters), null clear, field omission, 401 | 13 |
| E | GET /account/orders — 401, empty array, schema, sort order (static) | 7 |
| F | POST /account/addresses — 401, missing required fields, no state OK, state OK, response shape | 10 |
| G | GET /account/addresses — 401, array shape, user isolation | 5 |
| H | PATCH /account/addresses/:id — wrong owner 404, 401, valid edit, state removal | 6 |
| I | DELETE /account/addresses/:id — wrong owner 404, 401, valid delete, double-delete 404 | 4 |
| J | Frontend page structure — auth gate in head, no auth-modal, api.js, section nav anchors, all form ids, modal fields, sign out ×2, footer, analytics, API call patterns | 57 |
| K | Frontend UI logic — IntersectionObserver, multi-item summary, order link, badge classes, modal pre-fill, Escape close, overlay close, phone error element, token expiry redirect | 16 |
| L | Backend static analysis — getProfile, updateProfile, route registrations, E.164 validator, state nullable, ownership checks, router.use(authMiddleware) | 14 |
| M | Regression — existing account/orders, account/addresses, auth/me, auth/login, register all unbroken | 5 |
| **Total** | | **149** |
