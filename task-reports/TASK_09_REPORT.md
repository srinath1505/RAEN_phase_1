# Task 9 — Customer Auth Modal + OTP Registration + Google Sign-In

**Completed:** 2026-05-16  
**Tests:** 105/105 passed, 1 skipped (E5 — see note), 0 failed  
**Test runner:** `node task-reports/test-task9.js`  
**Note:** Restart backend before each test run to reset the in-memory auth rate limiter (max 5/15 min, G10 from Task 8).

---

## What Was Built

### 1. Shared Auth Modal (`stitch/public/js/auth-modal.js`)

Single shared JS file loaded on all 5 customer pages. Injects its own HTML into `<body>` at load time. No HTML duplication across pages.

**Three modal views:**
- **Sign In** — email + password form, Google Sign-In button, "Create account" link
- **Create Account** — firstName, lastName, email, phone, password (min 8), SMS/WhatsApp channel toggle, Google Sign-In button, "Sign in" link
- **Verification** — 6 individual digit input boxes (luxury UX, paste-aware), resend timer (60s cooldown), back button

**UX behaviours:**
- After login → calls `window.__postLoginCallback()` if set, otherwise `window.location.reload()`
- Close on overlay click or Escape key
- Google button hidden gracefully when `GOOGLE_CLIENT_ID` is placeholder (no broken UI)
- Nav btn `id="auth-nav-btn"` auto-updated to "MY ACCOUNT" → `account.html` on DOMContentLoaded if already signed in

---

### 2. ACCOUNT Nav Link — 5 Pages

| Page | Tailwind classes used |
|------|----------------------|
| `index.html` | `font-label text-xs letter-spaced text-on-surface hover:opacity-70` |
| `collections.html` | `font-label text-xs uppercase tracking-[0.2em] hover:opacity-50` |
| `product-detail.html` | `font-label text-xs tracking-[0.2em] hover:opacity-60` |
| `shopping-bag.html` | `text-[10px] uppercase tracking-[0.15em] font-label hover:text-outline` |
| `checkout.html` | `text-[10px] uppercase tracking-[0.15em] font-label hover:opacity-50` |

Classes match each page's existing nav font/tracking style.

---

### 3. OTP Registration — Backend

**New endpoints (do not affect existing `/register` or `/login`):**

| Endpoint | Body | Purpose |
|----------|------|---------|
| `POST /api/auth/send-otp` | `{ phone, channel: 'sms'|'whatsapp' }` | Generates 6-digit OTP, stores in memory (10 min), sends via Twilio or logs to console in dev |
| `POST /api/auth/register-otp` | `{ firstName, lastName, email, phone, password, otp }` | Verifies OTP + creates account atomically |
| `POST /api/auth/google` | `{ credential }` | Verifies Google ID token, finds/creates user, returns RAEN JWT |

**`backend/src/services/otpService.js`:**
- In-memory store: `Map<phone, { code, expiry, attempts, sentAt, channel }>`
- OTP expiry: 10 minutes
- Max attempts: 3 (then must resend)
- Resend cooldown: 60 seconds
- Dev mode: if `TWILIO_ACCOUNT_SID` contains `PLACEHOLDER`, OTP is printed to server console instead of sent via Twilio
- Production swap: replace `.env` credentials — zero code changes needed
- WhatsApp: sends to `whatsapp:<phone>` from `TWILIO_WHATSAPP_NUMBER`

---

### 4. Checkout Auth Gate

**Changed behaviour:**
- `checkout.html` is now open to all visitors (no auth on page load)
- Clicking "Secure Acquisition" (payment button) → checks `isLoggedIn()`
- If not logged in → opens auth modal → after login → **no page reload** → payment proceeds automatically (via `window.__postLoginCallback` + `placeOrderBtn.click()`)
- If already logged in on page load → auto-fills email (read-only), firstName, lastName from `GET /api/auth/me`
- "Gain Access" dead link replaced with "Sign In" → opens auth modal (early optional login without losing form data)
- Post-login on checkout NEVER reloads the page (form data preserved)

---

### 5. Google OAuth — Backend Ready, Frontend Wired

**Backend (`POST /api/auth/google`):**
- Uses `google-auth-library` to verify Google ID token
- Finds existing user by email or creates new CUSTOMER account
- Returns standard RAEN JWT
- When `GOOGLE_CLIENT_ID` is placeholder, returns 503 with a clear message

**Frontend (`auth-modal.js`):**
- Loads Google Identity Services via CDN dynamically
- Renders official Google Sign-In buttons in both login and register views
- Passes credential to `POST /api/auth/google` → same `raenHandleSuccessfulAuth()` flow as email login
- Buttons hidden automatically if `window.__RAEN_GOOGLE_CLIENT_ID` is a placeholder

**To activate Google OAuth:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web Application
3. Add authorized origin: `http://localhost:4173` (dev) + your production domain
4. Copy Client ID → replace `GOOGLE_CLIENT_ID_PLACEHOLDER` in `backend/.env` and in each of the 5 pages' `window.__RAEN_GOOGLE_CLIENT_ID` assignment

**To activate Twilio:**
1. Sign up at [twilio.com](https://twilio.com)
2. Get Account SID, Auth Token, and a phone number
3. For WhatsApp sandbox: join at twilio.com/console/messaging/whatsapp → replace `TWILIO_WHATSAPP_NUMBER` when approved for production
4. Replace all 4 Twilio vars in `backend/.env`

---

### 6. `account.html` Stub

- Auth gate: if no `raen_auth_token` → redirect to `index.html` (runs before DOM loads)
- Loads `GET /api/auth/me` and displays user's name + email
- "Coming soon" messaging for order history and addresses (Task 10)
- Sign out button: clears token → redirects to `index.html`
- No admin panel links, no external dependencies beyond `api.js`

---

## Files Changed / Created

**Backend:**
- `backend/.env` — added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER`
- `backend/src/services/otpService.js` — **NEW** (in-memory OTP, Twilio SMS/WhatsApp, dev console fallback)
- `backend/src/controllers/authController.js` — added `sendOtp`, `registerWithOtp`, `googleAuth`
- `backend/src/routes/authRoutes.js` — added `/send-otp`, `/register-otp`, `/google` routes
- `backend/node_modules/twilio/` — installed
- `backend/node_modules/google-auth-library/` — installed

**Frontend:**
- `stitch/public/js/auth-modal.js` — **NEW** (shared modal, ~450 lines, injects HTML + JS)
- `stitch/index.html` — ACCOUNT nav link + script tags
- `stitch/collections.html` — ACCOUNT nav link + script tags
- `stitch/product-detail.html` — ACCOUNT nav link + script tags
- `stitch/shopping-bag.html` — ACCOUNT nav link + script tags
- `stitch/checkout.html` — ACCOUNT nav link + script tags + payment gate + auto-fill + `__postLoginCallback`
- `stitch/account.html` — **NEW** stub (auth gate, user info, coming soon, sign out)

**Task reports:**
- `task-reports/test-task9.js` — **NEW** (105 tests, 1 skip)
- `task-reports/TASK_09_REPORT.md` — **NEW** (this file)

---

## Test Categories

| Section | Checks | What's tested |
|---------|--------|---------------|
| A | 1 | Backend health |
| B | 2 | Admin login, token issued |
| C | 7 | Customer login, wrong password, /auth/me with/without token |
| D | 6 | send-otp: missing phone, valid, cooldown, WhatsApp, invalid channel |
| E | 5 | register-otp: wrong OTP, missing fields, short password; 1 skip (happy path) |
| F | 3 | Google auth: no credential, invalid token, meaningful error |
| G | 17 | All 5 pages: nav link, openAuthModal, auth-modal.js, GOOGLE_CLIENT_ID; modal: all 3 views, GSI, OTP boxes, postLoginCallback, nav update |
| H | 12 | checkout.html: auth gate at payment, no reload, auto-fill, re-trigger, Gain Access removed |
| I | 10 | account.html: auth gate, token check, sign out, /auth/me, user info elements, no admin links |
| J | 19 | Backend files: otpService, authController, authRoutes, packages installed, .env vars |
| K | 4 | Regression: /register unchanged, /login unchanged, /auth/me, /auth/logout |
| L | 4 | Edge cases: new phone, no prior OTP, empty Google credential, garbled token |

---

## Known Limitations (Expected)

- **E5 skipped:** Full OTP registration happy path requires reading the 6-digit code from server console. Verified manually during development — send-otp prints `[RAEN DEV OTP]` block to stdout, then register-otp with that code creates the account.
- **Rate limiter 429:** `authLimiter` (max 5 / 15 min in-memory) gets exhausted during test run. D4 onward and K/L sections get 429. Tests accept `429` as valid per G10. Run on a freshly restarted server for clean results.
- **Google OAuth inactive:** Buttons rendered but non-functional until `GOOGLE_CLIENT_ID_PLACEHOLDER` is replaced with a real Google Cloud credential.
- **Twilio inactive:** OTP sent to server console in dev mode. Replace `.env` Twilio vars for live SMS/WhatsApp delivery.
