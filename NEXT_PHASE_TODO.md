# RAEN — Next Phase To-Do List
**Compiled:** 2026-05-17
**Sources:** Master frontend task list + SEO_REPORT.md open issues (O1–O18)
**Current SEO Score:** 72/100 — target 88/100 after all items complete

> Items are cross-referenced with SEO_REPORT.md issue IDs (O1–O18) where applicable.
> Check off each item here AND mark as resolved in SEO_REPORT.md when done.

---

## 🔴 LAUNCH BLOCKERS
*Nothing goes live without every item in this section complete.*

- [ ] **Dynamic `collections.html`** — replace hardcoded product grid with API fetch from `GET /api/products`. New admin products must appear automatically. *(SEO: O6)*
- [ ] **Dynamic `index.html` featured products** — homepage product carousel/grid also hardcoded. Fetch from API, render same card layout dynamically. *(SEO: O6)*
- [ ] **Remove fake `aggregateRating` from Product schema** — `product-detail.html` has hardcoded 4.9★ / 28 reviews with no review system. Google's guidelines prohibit fabricated ratings — risk of manual penalty and removal from rich results. Delete the entire `aggregateRating` block from the JSON-LD. *(SEO: O1)*
- [ ] **Dynamic Product JSON-LD schema** — Product schema in `<head>` is a static placeholder (`The Devastating Silk Column / €1450`) for every product. Inject correct `name`, `description`, `price`, and `availability` via JS after the API call resolves. *(SEO: O2)*
- [x] **Fix `sitemap.xml`** *(SEO: O3 + O4 — resolved 2026-05-17)*
  - [x] ~~Remove ghost pages~~ — audit error corrected: all 8 pages (`about`, `faq`, `size-guide`, `sustainability`, `press`, `shipping-returns`, `care-guide`, `journal`) confirmed to exist on disk. Entries are valid and kept.
  - [x] Removed generic `product-detail.html` template URL
  - [x] Added 12 individual product slug URLs (`?slug=the-sovereign` through `?slug=the-provocateur`)
  - [x] Added `privacy-policy.html` and `terms-of-service.html` (existed but were missing)
  - [x] Updated all `<lastmod>` dates to `2026-05-17`
- [ ] **Cookie consent banner** — GDPR legally requires explicit opt-in before GA4 and Meta Pixel fire. Selling in EUR to EU customers means EU law applies. Build a banner that: blocks GA4/Pixel until accepted, stores consent in localStorage, shows on first visit only. No third-party cookie SaaS needed — a simple custom banner is sufficient.
- [ ] **404 page** (`stitch/404.html`) — doesn't exist. Every broken URL, deleted product, or typo dumps the user on a raw browser error with no RAEN branding and no way back. Build a branded 404 with nav header, footer, and a CTA back to collections.
- [ ] **OG social image** — all pages reference `https://raen.design/images/raen-og-image.jpg` but the file doesn't exist. Design a 1200×630px brand image and save it as `stitch/public/images/raen-og-image.jpg`. Every social share is currently a blank card. *(SEO: O5)*

---

## 🟡 HIGH PRIORITY
*Fix before soft launch / first real customer traffic.*

### Functional
- [ ] **Checkout H1** — `checkout.html` has no `<h1>` tag at all. Add one (e.g. `<h1 class="sr-only">Checkout</h1>` if visually hidden is preferred for design). Broken semantic hierarchy on the highest-converting page. *(SEO: O8)*
- [ ] **Move Meta Pixel to end of `<body>`** — currently a synchronous render-blocking `<script>` in `<head>` on every page. Cut LCP time by moving the entire Pixel init block just above `</body>`. Zero tracking impact. *(SEO: O7)*
- [ ] **Checkout — review & fix issues** — full UX audit pass: form validation messages, payment method switching, error states, mobile layout, order summary accuracy, discount code flow.

### Legal
- [ ] **Terms & Conditions review** (`terms-of-service.html`) — verify legal language covers: jurisdiction (India vs EU), dispute resolution, returns/refund policy, payment terms, product descriptions disclaimer, limitation of liability. Needs a legal eye before launch.
- [ ] **Privacy Policy review** (`privacy-policy.html`) — verify GDPR compliance: lists all cookies by name and purpose (GA4, Meta Pixel), data retention periods, third-party processors named (Neon, Railway, Twilio, PayPal, Razorpay), right to erasure, Data Protection Officer contact. Must match the cookie consent banner scope exactly.

### SEO / GEO
- [ ] **Product specifications block** — add a "Specifications" collapsible section per product on `product-detail.html`: fabric composition (%), weight, lining, care instructions, country of origin, construction notes. Keep brand copy for humans; this block feeds AI engines. *(SEO: O9)*
- [ ] **FAQ rewrite in factual language** — `index.html` FAQ schema answers currently use brand voice ("RAEN ships to every corner of the globe"). Rewrite each answer as a plain factual sentence AI engines can quote directly. *(SEO: O10)*

### Frontend
- [ ] **Frontend beautifying** — full UI polish pass across all customer-facing pages:
  - [ ] Consistent spacing/typography — audit against design system
  - [ ] Hover states and transitions on all interactive elements
  - [ ] Loading skeleton states (product cards, cart, account page)
  - [ ] Empty states (empty cart, no orders, no addresses)
  - [ ] Error states (API failure messages, payment errors)
  - [ ] Mobile responsiveness audit (test on 375px, 390px, 414px viewports)
  - [ ] Dark/light contrast check on all text
  - [ ] Button and CTA consistency across pages

---

## 🟢 BEFORE FULL PUBLIC LAUNCH
*Should be done before scaling traffic or running paid ads.*

### Performance
- [ ] **`width` + `height` on all `<img>` tags** — browser can't reserve layout space without explicit dimensions, causing Cumulative Layout Shift (CLS). Add to every img across all pages. *(SEO: O11)*
- [ ] **Convert hero JPEG images to AVIF/WebP** — `hero (1-5).jpeg` are the largest Largest Contentful Paint (LCP) candidates on the homepage. Replacing with AVIF reduces LCP time meaningfully.
- [ ] **Replace Tailwind CDN with compiled CSS** — CDN build is ~3MB (entire framework). A production Tailwind compile outputs only used classes (~20KB). Significant LCP improvement for first-time visitors on slow connections. *(SEO: O14)*

### Accessibility
- [ ] **Skip navigation link** — add `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>` as first element in `<body>` on all pages. Keyboard users and screen readers must otherwise tab through the entire nav on every page. *(SEO: O12)*
- [ ] **ARIA labels on nav icon buttons** — cart icon and account icon in nav are `<a>` tags without descriptive text. Add `aria-label="Shopping bag"` and `aria-label="My account"`. Screen readers currently read the URL path. *(SEO: O13)*
- [ ] **Auth modal accessibility** — `auth-modal.js` injects HTML dynamically. Verify `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to modal title, and focus trapping (Tab key stays within modal, Escape closes it).

### GEO
- [ ] **"Best for" use-case statements on product pages** — add explicit occasion copy per product (e.g. "Ideal for black-tie galas, award ceremonies, and red carpet events"). AI engines surface products in "best evening gown for [occasion]" queries — without this copy, RAEN products won't appear. *(SEO: O9 extension)*
- [ ] **Add named designer/founder to Organization schema** — add `founder` or `employee` (Creative Director) to the Organization JSON-LD on `index.html`. Strengthens entity recognition in AI knowledge graphs, same way Valentino/McQueen maintain AI citation frequency. *(SEO: O17)*

---

## 📋 CONTENT PAGES — REVIEW & COMPLETE
*These pages exist in the codebase but contain placeholder or thin content. Content review needed before they can be linked publicly or added to the sitemap.*

- [ ] **`about.html`** — brand story, founding narrative, philosophy, creative direction. Should answer: who founded RAEN, where, when, why. Luxury buyers research brand provenance.
- [ ] **`faq.html`** — standalone FAQ page (separate from the homepage FAQPage schema). Richer, longer-form answers than the schema version. Consider Q&A on: sizing, alterations, bespoke orders, authentication, celebrity/press enquiries.
- [ ] **`size-guide.html`** — measurement tables (bust/waist/hips in cm and inches), how to measure guide, fit notes per silhouette type (column, wrap, ballgown), size run (XS–XL or numbered). One of the highest-traffic pages for luxury fashion.
- [ ] **`shipping-returns.html`** — specific delivery timelines by region (not "we ship everywhere"), carrier names, tracking instructions, return window (X days), condition requirements for returns, refund timeline, exchange process.
- [ ] **`care-guide.html`** — fabric-specific care per material used in RAEN pieces (silk, lace, wool, sequin, pearl-embellished). Dry clean only vs hand wash guidance. Storage instructions. Professional alteration recommendations.
- [ ] **`sustainability.html`** — materials sourcing, ethical supply chain claims, certifications (if any), packaging materials, carbon offset commitments. Luxury buyers increasingly audit this before purchasing.
- [ ] **`press.html`** — media coverage list (publications, stylists, celebrities), press kit download (high-res images, brand guidelines, press release), press contact email.
- [ ] **`journal.html`** — editorial/blog landing page. Currently empty = zero GEO value. First 3 articles recommended: (1) "How to dress for a black-tie gala", (2) "The RAEN guide to Italian silk", (3) "Behind the Atelier: how a RAEN piece is made". *(SEO: O15)*

---

## 📈 SEO / GEO — LONG-TERM
*Strategic improvements for post-launch, within 1–3 months.*

- [ ] **Dynamic sitemap generation endpoint** — once products are API-driven, add `GET /sitemap.xml` to the backend that queries Neon for all ACTIVE products and returns live XML. New products appear in Google within hours of creation, not the next manual sitemap update.
- [ ] **Real review system** *(SEO: O18)* — even a minimal admin-moderated star rating (1–5, optional text) unlocks Google rich results (star ratings in search snippets) legally. Currently no review mechanism exists and the fabricated rating has been removed. Build post-launch once there are real customers.
- [ ] **Product variant schema** — as inventory grows, add separate `Offer` blocks per size with individual `availability` status. Allows Google to surface "available in size M" type rich results.
- [ ] **Wikipedia / Wikidata entity** — once RAEN has press coverage and public profile, create or claim a Wikidata entity (`raen.design` as `website`). AI engines use Wikidata for entity disambiguation — strengthens brand entity confidence in AI knowledge graphs.
- [ ] **"Who is this for" content** — add a "Perfect for" or "The RAEN Woman" section answering body type, occasion, and lifestyle questions. Addresses queries like "luxury dresses for hourglass figure" or "evening gowns for tall women".
- [ ] **Hreflang tags** — if the site expands to serve Arabic, French, or other language markets (given areaServed includes Dubai, Monaco, Milan), add `hreflang` alternate tags to indicate regional variants.
- [ ] **Structured data — product variants** — when sizes/variants have different pricing or availability, use separate `Offer` entries per variant in Product schema rather than a single `Offer`.

---

## 🔧 TECHNICAL DEBT
*Infrastructure improvements that pay off at scale.*

- [ ] **M3 — switch TOKEN_STORE to `db`** before production deployment — currently `TOKEN_STORE=memory` means OTP and password-reset tokens are wiped on every server restart. Set `TOKEN_STORE=db` in Railway environment variables at launch. Redis upgrade can follow later.
- [ ] **PAYPAL_WEBHOOK_ID** — still `PLACEHOLDER` in `.env`. Get the real webhook ID from PayPal Developer Dashboard → My Apps → Webhooks. Without it, PayPal webhook signature verification is bypassed (C2 fix is in place but dormant until real ID is set).
- [ ] **Razorpay credentials** — not provided by client. Razorpay checkout is disabled until `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are supplied.
- [ ] **PayPal live credentials** — currently sandbox. Client needs to provide live `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` before real payments can be processed.
- [ ] **SMTP real credentials** — still placeholder (`your-email@gmail.com`). Order confirmation emails, password reset emails, and cancellation emails are silently skipped. Client must provide Gmail address + 16-char App Password.
- [ ] **Twilio FROM number** — `+917397262888` is a personal number. Twilio cannot send FROM a personal SIM. Client must purchase a Twilio phone number from twilio.com → Phone Numbers → Buy a number, then update `TWILIO_PHONE_NUMBER` in `.env`.
- [ ] **JWT_SECRET** — already rotated in this session ✅. Confirm the same value is used in Railway when deploying — do NOT generate a new one for production or all existing sessions become invalid.
- [ ] **Google OAuth production domain** — add `https://raen.design` and `https://www.raen.design` to Authorized JavaScript Origins in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID. Currently only `http://localhost:4173` is authorized.

---

## ✅ COMPLETED THIS SESSION
*For reference — already done, no action needed.*

- [x] M3 token store fix — tokenStore.js adapter (memory/db/redis)
- [x] JWT_SECRET rotated to 128-char cryptographic random value
- [x] Google OAuth Client ID wired on all 5 customer-facing pages
- [x] Product detail — dynamic canonical + og:url per slug
- [x] Admin pages (9) — noindex, nofollow added
- [x] robots.txt — /admin/, /account.html, /reset-password.html disallowed
- [x] early-access.html — canonical tag added
- [x] account.html — meta description added
- [x] api.js — `window.__RAEN_API_URL` production override
- [x] HANDOFF.md — credentials section sanitised (refer to backend/.env)
- [x] SEO_REPORT.md — full audit report (72/100)
- [x] task-reports/test-seo-fixes.js — 55/55 passing test suite
- [x] task-reports/SEO_FIXES_REPORT.md — detailed test report
- [x] sitemap.xml — fixed: 12 product slug URLs added, privacy/terms added, template URL removed, lastmod updated
- [x] Audit correction: O3 "ghost pages" finding was wrong — all 8 pages confirmed to exist

---

## Score Tracker

| Milestone | Score | Achieved |
|-----------|-------|---------|
| Baseline audit | 69/100 | ✅ 2026-05-17 |
| After this session's fixes | 72/100 | ✅ 2026-05-17 |
| After launch blockers complete | ~80/100 | ⬜ |
| After high-priority complete | ~84/100 | ⬜ |
| After full public launch items | ~88/100 | ⬜ |
| After long-term SEO/GEO | ~93/100 | ⬜ |
