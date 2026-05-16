/**
 * RAEN Task 10 — Customer Account Page
 * Test suite: backend endpoints + frontend static analysis
 * Run: node task-reports/test-task10.js
 * Requires: backend on :5000, stitch/ accessible as files
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE   = 'http://localhost:5000';
const STITCH = path.join(__dirname, '..', 'stitch');

// ── State ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const results = [];

// Unique per run to avoid email conflicts
const TS         = Date.now();
const USER1_EMAIL = `task10_u1_${TS}@test.raen`;
const USER2_EMAIL = `task10_u2_${TS}@test.raen`;
const TEST_PASS  = 'Raen@Task10Test!';

let adminToken  = null;
let user1Token  = null;
let user2Token  = null;
let createdAddressId = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
function req(method, url, body, token) {
  return new Promise((resolve) => {
    const parsed  = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const opts    = {
      hostname : parsed.hostname,
      port     : parsed.port || (isHttps ? 443 : 80),
      path     : parsed.pathname + parsed.search,
      method,
      headers  : { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const transport = isHttps ? https : http;
    const r = transport.request(opts, (res) => {
      let raw = '';
      res.on('data', d => { raw += d; });
      res.on('end', () => {
        let parsed2 = null;
        try { parsed2 = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed2, raw });
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: null, raw: e.message }));
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

function assert(name, cond, note) {
  if (cond) {
    passed++;
    results.push({ status: 'PASS', name });
  } else {
    failed++;
    results.push({ status: 'FAIL', name, note: note || '' });
    console.log(`  ✗ FAIL  ${name}${note ? '  ← ' + note : ''}`);
  }
}

function skip(name, reason) {
  skipped++;
  results.push({ status: 'SKIP', name, note: reason });
  console.log(`  ⊘ SKIP  ${name}  ← ${reason}`);
}

function fileContains(relPath, ...patterns) {
  const full = path.join(STITCH, relPath);
  if (!fs.existsSync(full)) return false;
  const src = fs.readFileSync(full, 'utf8');
  return patterns.every(p => src.includes(p));
}

function backendFileContains(relPath, ...patterns) {
  const full = path.join(__dirname, '..', 'backend', 'src', relPath);
  if (!fs.existsSync(full)) return false;
  const src = fs.readFileSync(full, 'utf8');
  return patterns.every(p => src.includes(p));
}

// ── A: Health ────────────────────────────────────────────────────────────────
async function runA() {
  console.log('\nA: Health');
  const r = await req('GET', `${BASE}/health`);
  assert('A1 — /health returns 200', r.status === 200);
}

// ── B: Auth setup (get tokens for admin + 2 customers) ───────────────────────
async function runB() {
  console.log('\nB: Auth setup');

  // Admin login
  const ra = await req('POST', `${BASE}/api/auth/login`, {
    email: 'admin@raen.design', password: 'RaenAdmin2024!'
  });
  adminToken = ra.body?.data?.token;
  assert('B1 — Admin login succeeds', ra.status === 200 && !!adminToken);

  // Register user 1
  const r1 = await req('POST', `${BASE}/api/auth/register`, {
    firstName: 'Alice', lastName: 'Task10', email: USER1_EMAIL, password: TEST_PASS
  });
  user1Token = r1.body?.data?.token;
  assert('B2 — User 1 registers (200/201)', [200, 201].includes(r1.status) && !!user1Token,
    `status=${r1.status}`);

  // Register user 2
  const r2 = await req('POST', `${BASE}/api/auth/register`, {
    firstName: 'Bob', lastName: 'Task10', email: USER2_EMAIL, password: TEST_PASS
  });
  user2Token = r2.body?.data?.token;
  assert('B3 — User 2 registers (200/201)', [200, 201].includes(r2.status) && !!user2Token,
    `status=${r2.status}`);
}

// ── C: GET /api/account/profile ───────────────────────────────────────────────
async function runC() {
  console.log('\nC: GET /api/account/profile');

  // Unauthenticated
  const r0 = await req('GET', `${BASE}/api/account/profile`);
  assert('C1 — No token → 401', r0.status === 401, `got ${r0.status}`);

  const r = await req('GET', `${BASE}/api/account/profile`, null, user1Token);
  assert('C2 — Returns 200', r.status === 200, `got ${r.status}`);
  const user = r.body?.data?.user;
  assert('C3 — Returns user object',       !!user);
  assert('C4 — Has firstName',             user?.firstName === 'Alice');
  assert('C5 — Has lastName',              user?.lastName  === 'Task10');
  assert('C6 — Has email',                 user?.email     === USER1_EMAIL);
  assert('C7 — Has phone field (null OK)', 'phone' in (user || {}));
  assert('C8 — No passwordHash exposed',   !('passwordHash' in (user || {})));
}

// ── D: PATCH /api/account/profile ────────────────────────────────────────────
async function runD() {
  console.log('\nD: PATCH /api/account/profile');

  // Missing required field
  const rMiss = await req('PATCH', `${BASE}/api/account/profile`,
    { firstName: 'Alice' }, user1Token);
  assert('D1 — Missing lastName → 400/422', [400, 422].includes(rMiss.status), `got ${rMiss.status}`);

  // Invalid phone: no leading +
  const rPhone1 = await req('PATCH', `${BASE}/api/account/profile`,
    { firstName: 'Alice', lastName: 'Task10', phone: '44123456789' }, user1Token);
  assert('D2 — Phone without + → 400/422', [400, 422].includes(rPhone1.status), `got ${rPhone1.status}`);

  // Invalid phone: too short
  const rPhone2 = await req('PATCH', `${BASE}/api/account/profile`,
    { firstName: 'Alice', lastName: 'Task10', phone: '+123' }, user1Token);
  assert('D3 — Phone too short → 400/422', [400, 422].includes(rPhone2.status), `got ${rPhone2.status}`);

  // Invalid phone: contains letters
  const rPhone3 = await req('PATCH', `${BASE}/api/account/profile`,
    { firstName: 'Alice', lastName: 'Task10', phone: '+44abc1234' }, user1Token);
  assert('D4 — Phone with letters → 400/422', [400, 422].includes(rPhone3.status), `got ${rPhone3.status}`);

  // Valid update with phone
  const rOk = await req('PATCH', `${BASE}/api/account/profile`,
    { firstName: 'Alicia', lastName: 'Raen10', phone: '+447911123456' }, user1Token);
  assert('D5 — Valid update → 200', rOk.status === 200, `got ${rOk.status}`);
  const updated = rOk.body?.data?.user;
  assert('D6 — firstName updated',  updated?.firstName === 'Alicia');
  assert('D7 — lastName updated',   updated?.lastName  === 'Raen10');
  assert('D8 — phone updated',      updated?.phone     === '+447911123456');
  assert('D9 — email unchanged',    updated?.email     === USER1_EMAIL);

  // Valid: phone cleared (null)
  const rClear = await req('PATCH', `${BASE}/api/account/profile`,
    { firstName: 'Alicia', lastName: 'Raen10', phone: null }, user1Token);
  assert('D10 — Phone cleared to null → 200', rClear.status === 200, `got ${rClear.status}`);
  assert('D11 — Phone is null after clear', rClear.body?.data?.user?.phone === null);

  // Valid: phone omitted (field stays unchanged)
  const rOmit = await req('PATCH', `${BASE}/api/account/profile`,
    { firstName: 'Alicia', lastName: 'Raen10' }, user1Token);
  assert('D12 — Omitting phone field → 200', rOmit.status === 200, `got ${rOmit.status}`);

  // No token
  const rNoAuth = await req('PATCH', `${BASE}/api/account/profile`,
    { firstName: 'X', lastName: 'Y' });
  assert('D13 — No token → 401', rNoAuth.status === 401, `got ${rNoAuth.status}`);
}

// ── E: GET /api/account/orders ────────────────────────────────────────────────
async function runE() {
  console.log('\nE: GET /api/account/orders');

  // No token
  const r0 = await req('GET', `${BASE}/api/account/orders`);
  assert('E1 — No token → 401', r0.status === 401, `got ${r0.status}`);

  // Fresh user: empty orders
  const r = await req('GET', `${BASE}/api/account/orders`, null, user1Token);
  assert('E2 — Returns 200',            r.status === 200, `got ${r.status}`);
  assert('E3 — Data has orders array',  Array.isArray(r.body?.data?.orders));
  assert('E4 — Fresh user has 0 orders', r.body?.data?.orders?.length === 0);

  // Admin also has orders array (even if empty or non-empty)
  const ra = await req('GET', `${BASE}/api/account/orders`, null, adminToken);
  assert('E5 — Admin token also works (role-agnostic endpoint)', ra.status === 200, `got ${ra.status}`);
  assert('E6 — Admin response has orders array', Array.isArray(ra.body?.data?.orders));

  // Order of items: if there are orders they should be sorted createdAt DESC
  // (verified structurally — can't force order creation in unit test scope)
  // This is a static analysis check instead:
  assert('E7 — orderService.getUserOrders sorts createdAt desc',
    backendFileContains('services/orderService.js', 'createdAt', 'desc'));
}

// ── F: POST /api/account/addresses ───────────────────────────────────────────
async function runF() {
  console.log('\nF: POST /api/account/addresses');

  // No token
  const r0 = await req('POST', `${BASE}/api/account/addresses`,
    { fullName: 'Alice', phone: '+447000000001', addressLine1: '1 Test St', city: 'London', postalCode: 'E1 1AA', country: 'United Kingdom' });
  assert('F1 — No token → 401', r0.status === 401, `got ${r0.status}`);

  // Missing required: fullName
  const rMiss1 = await req('POST', `${BASE}/api/account/addresses`,
    { phone: '+447000000001', addressLine1: '1 Test St', city: 'London', postalCode: 'E1 1AA', country: 'United Kingdom' },
    user1Token);
  assert('F2 — Missing fullName → 400/422', [400, 422].includes(rMiss1.status), `got ${rMiss1.status}`);

  // Missing required: phone
  const rMiss2 = await req('POST', `${BASE}/api/account/addresses`,
    { fullName: 'Alice T', addressLine1: '1 Test St', city: 'London', postalCode: 'E1 1AA', country: 'United Kingdom' },
    user1Token);
  assert('F3 — Missing phone → 400/422', [400, 422].includes(rMiss2.status), `got ${rMiss2.status}`);

  // Missing required: addressLine1
  const rMiss3 = await req('POST', `${BASE}/api/account/addresses`,
    { fullName: 'Alice T', phone: '+447000000001', city: 'London', postalCode: 'E1 1AA', country: 'United Kingdom' },
    user1Token);
  assert('F4 — Missing addressLine1 → 400/422', [400, 422].includes(rMiss3.status), `got ${rMiss3.status}`);

  // Valid WITHOUT state (international — Singapore has no state)
  const rSG = await req('POST', `${BASE}/api/account/addresses`,
    { fullName: 'Alice T', phone: '+6512345678', addressLine1: '1 Orchard Rd', city: 'Singapore', postalCode: '238858', country: 'Singapore' },
    user1Token);
  assert('F5 — Address without state accepted → 201', [200, 201].includes(rSG.status), `got ${rSG.status} ${JSON.stringify(rSG.body)}`);

  // Valid WITH state
  const rUK = await req('POST', `${BASE}/api/account/addresses`,
    {
      fullName: 'Alice Task10', phone: '+447911123456',
      addressLine1: '22 Baker Street', addressLine2: 'Flat 3B',
      city: 'London', state: 'England',
      postalCode: 'NW1 6XE', country: 'United Kingdom'
    },
    user1Token);
  assert('F6 — Full address with state → 201', [200, 201].includes(rUK.status), `got ${rUK.status} ${JSON.stringify(rUK.body)}`);
  createdAddressId = rUK.body?.data?.address?.id;
  assert('F7 — Returns address with id', !!createdAddressId);
  assert('F8 — addressLine1 correct', rUK.body?.data?.address?.addressLine1 === '22 Baker Street');
  assert('F9 — addressLine2 correct', rUK.body?.data?.address?.addressLine2 === 'Flat 3B');
  assert('F10 — state correct',       rUK.body?.data?.address?.state        === 'England');
}

// ── G: GET /api/account/addresses ────────────────────────────────────────────
async function runG() {
  console.log('\nG: GET /api/account/addresses');

  // No token
  const r0 = await req('GET', `${BASE}/api/account/addresses`);
  assert('G1 — No token → 401', r0.status === 401, `got ${r0.status}`);

  // User 1 sees their addresses (at least 2 created in F)
  const r = await req('GET', `${BASE}/api/account/addresses`, null, user1Token);
  assert('G2 — Returns 200', r.status === 200, `got ${r.status}`);
  const addrs = r.body?.data?.addresses;
  assert('G3 — Returns addresses array', Array.isArray(addrs));
  assert('G4 — User 1 has at least 2 addresses', addrs?.length >= 2, `got ${addrs?.length}`);

  // User 2 has 0 addresses
  const r2 = await req('GET', `${BASE}/api/account/addresses`, null, user2Token);
  assert('G5 — User 2 has 0 addresses (isolation)', r2.body?.data?.addresses?.length === 0,
    `got ${r2.body?.data?.addresses?.length}`);
}

// ── H: PATCH /api/account/addresses/:id ──────────────────────────────────────
async function runH() {
  console.log('\nH: PATCH /api/account/addresses/:id');

  if (!createdAddressId) {
    skip('H1-H5', 'No address id from F6');
    return;
  }

  // Wrong owner (user 2 tries to edit user 1's address)
  const rWrong = await req('PATCH', `${BASE}/api/account/addresses/${createdAddressId}`,
    { fullName: 'Hacker', phone: '+11234567890', addressLine1: 'Stolen St', city: 'Hack', postalCode: '00000', country: 'XX' },
    user2Token);
  assert('H1 — Wrong owner → 404', rWrong.status === 404, `got ${rWrong.status}`);

  // No token
  const rNoAuth = await req('PATCH', `${BASE}/api/account/addresses/${createdAddressId}`,
    { fullName: 'X', phone: '+11234567890', addressLine1: 'Y', city: 'Z', postalCode: '12345', country: 'XX' });
  assert('H2 — No token → 401', rNoAuth.status === 401, `got ${rNoAuth.status}`);

  // Valid edit
  const rOk = await req('PATCH', `${BASE}/api/account/addresses/${createdAddressId}`,
    {
      fullName: 'Alicia Raen', phone: '+447911999888',
      addressLine1: '22 Baker Street', addressLine2: 'Suite 1',
      city: 'London', state: 'Greater London',
      postalCode: 'NW1 6XE', country: 'United Kingdom'
    },
    user1Token);
  assert('H3 — Valid edit → 200', rOk.status === 200, `got ${rOk.status}`);
  assert('H4 — fullName updated',  rOk.body?.data?.address?.fullName === 'Alicia Raen');
  assert('H5 — state updated',     rOk.body?.data?.address?.state === 'Greater London');

  // Edit to remove state (set to empty / null)
  const rNoState = await req('PATCH', `${BASE}/api/account/addresses/${createdAddressId}`,
    {
      fullName: 'Alicia Raen', phone: '+447911999888',
      addressLine1: '1 Orchard Rd', city: 'Singapore',
      postalCode: '238858', country: 'Singapore'
    },
    user1Token);
  assert('H6 — Editing to remove state → 200', rNoState.status === 200, `got ${rNoState.status}`);
}

// ── I: DELETE /api/account/addresses/:id ─────────────────────────────────────
async function runI() {
  console.log('\nI: DELETE /api/account/addresses/:id');

  if (!createdAddressId) {
    skip('I1-I4', 'No address id from F6');
    return;
  }

  // Wrong owner
  const rWrong = await req('DELETE', `${BASE}/api/account/addresses/${createdAddressId}`,
    null, user2Token);
  assert('I1 — Wrong owner → 404', rWrong.status === 404, `got ${rWrong.status}`);

  // No token
  const rNoAuth = await req('DELETE', `${BASE}/api/account/addresses/${createdAddressId}`);
  assert('I2 — No token → 401', rNoAuth.status === 401, `got ${rNoAuth.status}`);

  // Valid delete
  const rOk = await req('DELETE', `${BASE}/api/account/addresses/${createdAddressId}`,
    null, user1Token);
  assert('I3 — Valid delete → 200', rOk.status === 200, `got ${rOk.status}`);

  // Confirm it's gone
  const rGone = await req('DELETE', `${BASE}/api/account/addresses/${createdAddressId}`,
    null, user1Token);
  assert('I4 — Second delete → 404', rGone.status === 404, `got ${rGone.status}`);
}

// ── J: Frontend — page structure ──────────────────────────────────────────────
async function runJ() {
  console.log('\nJ: Frontend — account.html structure');

  // Auth gate
  assert('J1  — Auth gate present (localStorage check)',
    fileContains('account.html', "localStorage.getItem('raen_auth_token')", "window.location.href = 'index.html'"));

  // Auth gate fires before DOM load (must be in <head>)
  const src = fs.readFileSync(path.join(STITCH, 'account.html'), 'utf8');
  const headEnd = src.indexOf('</head>');
  const authGatePos = src.indexOf("localStorage.getItem('raen_auth_token')");
  assert('J2  — Auth gate in <head> (before DOM)', authGatePos < headEnd && authGatePos !== -1);

  // No auth-modal.js
  assert('J3  — auth-modal.js NOT included (user already authenticated)',
    !fileContains('account.html', 'auth-modal.js'));

  // api.js included
  assert('J4  — api.js included', fileContains('account.html', 'public/js/api.js'));

  // Section nav strip
  assert('J5  — Section nav: PROFILE anchor',   fileContains('account.html', 'href="#profile"'));
  assert('J6  — Section nav: ORDERS anchor',    fileContains('account.html', 'href="#orders"'));
  assert('J7  — Section nav: ADDRESSES anchor', fileContains('account.html', 'href="#addresses"'));

  // Profile section
  assert('J8  — profile section id', fileContains('account.html', 'id="profile"'));
  assert('J9  — profile-display div', fileContains('account.html', 'id="profile-display"'));
  assert('J10 — profile-edit form',   fileContains('account.html', 'id="profile-edit"'));
  assert('J11 — edit-first input',    fileContains('account.html', 'id="edit-first"'));
  assert('J12 — edit-last input',     fileContains('account.html', 'id="edit-last"'));
  assert('J13 — edit-phone input',    fileContains('account.html', 'id="edit-phone"'));
  assert('J14 — showProfileEdit fn',  fileContains('account.html', 'showProfileEdit'));
  assert('J15 — hideProfileEdit fn',  fileContains('account.html', 'hideProfileEdit'));

  // Email is read-only (no email input field in edit form)
  assert('J16 — No email input in edit form (email is read-only)',
    !fileContains('account.html', 'id="edit-email"'));

  // E.164 client-side validation
  assert('J17 — Phone E.164 regex present', fileContains('account.html', '/^\\+\\d{7,}$/'));

  // Orders section
  assert('J18 — orders section id',     fileContains('account.html', 'id="orders"'));
  assert('J19 — orders-loading div',    fileContains('account.html', 'id="orders-loading"'));
  assert('J20 — orders-empty div',      fileContains('account.html', 'id="orders-empty"'));
  assert('J21 — orders-table-wrap div', fileContains('account.html', 'id="orders-table-wrap"'));
  assert('J22 — orders-tbody',          fileContains('account.html', 'id="orders-tbody"'));
  assert('J23 — Empty state CTA links to collections', fileContains('account.html', 'collections.html'));
  assert('J24 — Order links to order-confirmation.html', fileContains('account.html', 'order-confirmation.html'));

  // Addresses section
  assert('J25 — addresses section id',    fileContains('account.html', 'id="addresses"'));
  assert('J26 — addresses-loading div',   fileContains('account.html', 'id="addresses-loading"'));
  assert('J27 — addresses-empty div',     fileContains('account.html', 'id="addresses-empty"'));
  assert('J28 — addresses-grid div',      fileContains('account.html', 'id="addresses-grid"'));
  assert('J29 — add-address-link exists', fileContains('account.html', 'id="add-address-link"'));

  // Address modal
  assert('J30 — address-modal div',        fileContains('account.html', 'id="address-modal"'));
  assert('J31 — modal-title',              fileContains('account.html', 'id="modal-title"'));
  assert('J32 — addr-fullName input',      fileContains('account.html', 'id="addr-fullName"'));
  assert('J33 — addr-phone input',         fileContains('account.html', 'id="addr-phone"'));
  assert('J34 — addr-line1 input',         fileContains('account.html', 'id="addr-line1"'));
  assert('J35 — addr-line2 input',         fileContains('account.html', 'id="addr-line2"'));
  assert('J36 — addr-city input',          fileContains('account.html', 'id="addr-city"'));
  assert('J37 — addr-state input',         fileContains('account.html', 'id="addr-state"'));
  assert('J38 — addr-postal input',        fileContains('account.html', 'id="addr-postal"'));
  assert('J39 — addr-country input',       fileContains('account.html', 'id="addr-country"'));
  assert('J40 — addr-error div',           fileContains('account.html', 'id="addr-error"'));
  assert('J41 — openAddressModal fn',      fileContains('account.html', 'openAddressModal'));
  assert('J42 — closeAddressModal fn',     fileContains('account.html', 'closeAddressModal'));
  assert('J43 — confirmDeleteAddress fn',  fileContains('account.html', 'confirmDeleteAddress'));
  assert('J44 — state field is NOT required in HTML', !fileContains('account.html', 'id="addr-state" required'));

  // Sign out: appears in both nav AND bottom
  const signOutCount = (src.match(/raenSignOut|Sign Out/gi) || []).length;
  assert('J45 — Sign out appears in both nav and bottom of page', signOutCount >= 2);

  // Footer: 4-column grid
  assert('J46 — Full footer: Collection column',      fileContains('account.html', 'All Objects'));
  assert('J47 — Full footer: Customer Care column',   fileContains('account.html', 'Shipping'));
  assert('J48 — Full footer: Social column',          fileContains('account.html', 'Instagram'));
  assert('J49 — Full footer: copyright',              fileContains('account.html', '© 2026 RAEN'));

  // Analytics IIFE
  assert('J50 — Analytics tracking IIFE present', fileContains('account.html', '/api/analytics/pageview', 'raen_session'));

  // apiPatch used for profile (not apiPut — api.js has no apiPut)
  assert('J51 — apiPatch used for profile update', fileContains('account.html', "apiPatch('/account/profile'"));

  // apiPatch used for address update
  assert('J52 — apiPatch used for address update',   fileContains('account.html', "apiPatch('/account/addresses/"));

  // apiPost used for address create
  assert('J53 — apiPost used for address create',    fileContains('account.html', "apiPost('/account/addresses'"));

  // apiDelete used for address delete
  assert('J54 — apiDelete used for address delete',  fileContains('account.html', "apiDelete('/account/addresses/"));

  // apiGet used for profile
  assert('J55 — apiGet used for profile',   fileContains('account.html', "apiGet('/account/profile'"));

  // apiGet used for orders
  assert('J56 — apiGet used for orders',    fileContains('account.html', "apiGet('/account/orders'"));

  // apiGet used for addresses
  assert('J57 — apiGet used for addresses', fileContains('account.html', "apiGet('/account/addresses'"));
}

// ── K: Frontend — UI logic checks ─────────────────────────────────────────────
async function runK() {
  console.log('\nK: Frontend — UI behaviour checks');

  // Section nav active-state logic
  assert('K1 — IntersectionObserver used for section nav',
    fileContains('account.html', 'IntersectionObserver'));
  assert('K2 — snav-active class toggled',
    fileContains('account.html', 'snav-active'));

  // Items summary: "+ N more" pattern
  assert('K3 — Multi-item summary "+ N more" implemented',
    fileContains('account.html', '+ ', 'more'));

  // Single-item summary: product name + size + qty
  assert('K4 — Single-item summary format (productName, size, quantity)',
    fileContains('account.html', 'productName', 'first.size', 'quantity'));

  // Order link to order-confirmation.html
  assert('K5 — Order number links to order-confirmation.html',
    fileContains('account.html', 'order-confirmation.html?orderNumber='));

  // Status badge classes present
  assert('K6 — PENDING badge class defined',    fileContains('account.html', 'badge-PENDING'));
  assert('K7 — DELIVERED badge class defined',  fileContains('account.html', 'badge-DELIVERED'));
  assert('K8 — CANCELLED badge class defined',  fileContains('account.html', 'badge-CANCELLED'));

  // Modal: pre-fills on edit
  assert('K9  — addr-fullName pre-fill on edit',  fileContains('account.html', 'addr-fullName', 'addr.fullName'));
  assert('K10 — addr-state pre-fill on edit',     fileContains('account.html', 'addr-state', 'addr.state'));
  assert('K11 — addr-country pre-fill on edit',   fileContains('account.html', 'addr-country', 'addr.country'));

  // Escape key closes modal
  assert('K12 — Escape key closes modal', fileContains('account.html', "e.key === 'Escape'", 'closeAddressModal'));

  // Overlay click closes modal
  assert('K13 — Overlay click closes modal',
    fileContains('account.html', 'e.target === document.getElementById', 'closeAddressModal'));

  // Profile: phone validation client-side
  assert('K14 — Client-side phone error element used', fileContains('account.html', 'phone-error'));

  // Profile edit reveals edit form, hides display
  assert('K15 — showProfileEdit hides display div',
    fileContains('account.html', 'profile-display', 'display = \'none\''));

  // Expired token during loadProfile redirects to index.html
  assert('K16 — Expired token during load redirects to index.html',
    fileContains('account.html', "window.location.href = 'index.html'", 'localStorage.removeItem'));
}

// ── L: Backend static analysis ────────────────────────────────────────────────
async function runL() {
  console.log('\nL: Backend static analysis');

  // accountController: getProfile
  assert('L1 — getProfile exported',          backendFileContains('controllers/accountController.js', 'exports.getProfile'));
  assert('L2 — getProfile does DB lookup',    backendFileContains('controllers/accountController.js', 'prisma.user.findUnique', 'req.user.id'));
  assert('L3 — getProfile excludes passwordHash',
    backendFileContains('controllers/accountController.js', 'select', 'phone'));

  // accountController: updateProfile
  assert('L4 — updateProfile exported',       backendFileContains('controllers/accountController.js', 'exports.updateProfile'));
  assert('L5 — updateProfile uses prisma.user.update',
    backendFileContains('controllers/accountController.js', 'prisma.user.update'));
  assert('L6 — updateProfile scoped to req.user.id',
    backendFileContains('controllers/accountController.js', 'where: { id: req.user.id }'));

  // accountRoutes: profile endpoints
  assert('L7 — GET /profile route present',   backendFileContains('routes/accountRoutes.js', "router.get('/profile'"));
  assert('L8 — PATCH /profile route present', backendFileContains('routes/accountRoutes.js', 'accountController.updateProfile'));
  assert('L9 — E.164 validation in route',    backendFileContains('routes/accountRoutes.js', 'E.164'));
  assert('L10 — state NOT required in POST /addresses',
    !backendFileContains('routes/accountRoutes.js', "body('state').notEmpty"));

  // schema: state is nullable
  assert('L11 — schema: state String? (nullable)',
    backendFileContains('prisma/schema.prisma', 'state        String?'));

  // address controller: ownership check on update
  assert('L12 — updateAddress verifies ownership', backendFileContains('controllers/accountController.js',
    'prisma.address.findFirst', 'userId'));

  // address controller: ownership check on delete
  assert('L13 — deleteAddress verifies ownership', backendFileContains('controllers/accountController.js',
    'prisma.address.findFirst', 'where: { id, userId }'));

  // authMiddleware applied to all account routes
  assert('L14 — authMiddleware applied via router.use',
    backendFileContains('routes/accountRoutes.js', 'router.use(authMiddleware)'));
}

// ── M: Regression — existing account endpoints still work ─────────────────────
async function runM() {
  console.log('\nM: Regression — existing endpoints unchanged');

  // GET /orders still returns 200
  const rOrd = await req('GET', `${BASE}/api/account/orders`, null, user1Token);
  assert('M1 — GET /account/orders still returns 200', rOrd.status === 200, `got ${rOrd.status}`);

  // GET /addresses still returns 200
  const rAddr = await req('GET', `${BASE}/api/account/addresses`, null, user1Token);
  assert('M2 — GET /account/addresses still returns 200', rAddr.status === 200, `got ${rAddr.status}`);

  // GET /api/auth/me still works (existing auth endpoint not broken)
  const rMe = await req('GET', `${BASE}/api/auth/me`, null, user1Token);
  assert('M3 — GET /api/auth/me still returns 200', rMe.status === 200, `got ${rMe.status}`);

  // POST /api/auth/login still works (regression)
  const rLogin = await req('POST', `${BASE}/api/auth/login`,
    { email: USER1_EMAIL, password: TEST_PASS });
  assert('M4 — POST /api/auth/login still works', rLogin.status === 200, `got ${rLogin.status}`);

  // POST /api/auth/register still works (already tested in B but verify shape)
  assert('M5 — register still returns token',
    !!user1Token, 'user1Token was set in B2');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' RAEN Task 10 — Customer Account Page — Test Suite');
  console.log('═══════════════════════════════════════════════════════════');

  await runA();
  await runB();
  await runC();
  await runD();
  await runE();
  await runF();
  await runG();
  await runH();
  await runI();
  await runJ();
  await runK();
  await runL();
  await runM();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(` RESULTS  passed=${passed}  failed=${failed}  skipped=${skipped}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ✗  ${r.name}${r.note ? '  ← ' + r.note : ''}`);
    });
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
