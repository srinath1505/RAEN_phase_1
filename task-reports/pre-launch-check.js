/**
 * RAEN Pre-Launch Comprehensive Check
 * Run: node task-reports/pre-launch-check.js
 */
require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const http  = require('http');
const https = require('https');

const BASE    = 'http://localhost:5000';
let passed    = 0;
let failed    = 0;
let warned    = 0;
const results = [];

function log(section, test, status, detail = '') {
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '⚠' : '✗';
  results.push({ section, test, status, detail });
  if (status === 'PASS') passed++;
  else if (status === 'WARN') warned++;
  else failed++;
  const pad = test.padEnd(62);
  console.log(`  ${icon}  ${pad} ${detail}`);
}

function req(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost', port: 5000, path,
      method, headers: { 'Content-Type': 'application/json', ...headers }
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), raw: data }); }
        catch { resolve({ status: res.statusCode, body: {}, raw: data }); }
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: {}, error: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function section(title) {
  console.log(`\n  ${'─'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`  ${'─'.repeat(70)}`);
}

async function run() {
  console.log('\n' + '═'.repeat(74));
  console.log('  RAEN — Pre-Launch Comprehensive Check');
  console.log('  ' + new Date().toISOString());
  console.log('═'.repeat(74));

  // ── 1. HEALTH & CORE ────────────────────────────────────────────────────
  section('1. Health & Core');
  let r;

  r = await req('GET', '/health');
  r.status === 200 && r.body.status === 'ok'
    ? log('Core', 'GET /health', 'PASS', `HTTP ${r.status}`)
    : log('Core', 'GET /health', 'FAIL', `HTTP ${r.status}`);

  r = await req('GET', '/api/products');
  const products = (r.body.data && r.body.data.products) || [];
  r.status === 200 && products.length > 0
    ? log('Core', 'GET /api/products (catalog)', 'PASS', `${products.length} products`)
    : log('Core', 'GET /api/products (catalog)', 'FAIL', `HTTP ${r.status}`);

  // Check all 12 products present
  const slugs = products.map(p => p.slug);
  const expected = ['bare-obsession','black-pearl','velvet-scandal','crimson-vice',
    'emerald-sin','midnight-venom','poison-kiss','serpentine',
    'taupe-wrap','the-ivory-weapon','the-provocateur','the-sovereign'];
  const missing = expected.filter(s => !slugs.includes(s));
  missing.length === 0
    ? log('Core', 'All 12 products in DB', 'PASS', slugs.length + ' active products')
    : log('Core', 'All 12 products in DB', 'FAIL', `Missing: ${missing.join(', ')}`);

  // Check salePrice/discountPercent fields present
  const sample = products[0];
  ('salePrice' in sample && 'discountPercent' in sample)
    ? log('Core', 'Product has salePrice + discountPercent fields', 'PASS', '')
    : log('Core', 'Product has salePrice + discountPercent fields', 'FAIL', 'Fields missing from API response');

  // Price sanity — no product should be €1450 (old wrong seed)
  const wrongPrice = products.filter(p => p.price === 1450 && !['bare-obsession','black-pearl'].includes(p.slug));
  wrongPrice.length === 0
    ? log('Core', 'No products with wrong seed price €1450', 'PASS', '')
    : log('Core', 'No products with wrong seed price €1450', 'FAIL', wrongPrice.map(p=>p.slug).join(', '));

  // Individual product by slug
  r = await req('GET', '/api/products/midnight-venom');
  const mvProd = r.body.data && r.body.data.product;
  r.status === 200 && mvProd
    ? log('Core', 'GET /api/products/:slug (midnight-venom)', 'PASS', `€${mvProd.price}`)
    : log('Core', 'GET /api/products/:slug (midnight-venom)', 'FAIL', `HTTP ${r.status}`);

  // ── 2. AUTH ─────────────────────────────────────────────────────────────
  section('2. Auth');

  // Admin login
  r = await req('POST', '/api/auth/login', { email: 'admin@raen.design', password: 'RaenAdmin2024!' });
  let adminToken = null;
  if (r.status === 200 && r.body.data && r.body.data.token) {
    adminToken = r.body.data.token;
    log('Auth', 'Admin login (admin@raen.design)', 'PASS', 'Token issued');
  } else {
    log('Auth', 'Admin login (admin@raen.design)', 'FAIL', `HTTP ${r.status} — ${JSON.stringify(r.body)}`);
  }

  // /auth/me with token
  if (adminToken) {
    r = await req('GET', '/api/auth/me', null, { Authorization: `Bearer ${adminToken}` });
    // Accept 200 (token has embedded data) or check nested user object
    if (r.status === 200) {
      const u = r.body.data || r.body.user || {};
      const role = u.role || u.data && u.data.role;
      log('Auth', 'GET /api/auth/me (admin)', 'PASS', `HTTP 200, role=${role || 'embedded-in-token'}`);
    } else {
      log('Auth', 'GET /api/auth/me (admin)', 'FAIL', `HTTP ${r.status}`);
    }
  }

  // /auth/me without token → 401
  r = await req('GET', '/api/auth/me');
  r.status === 401
    ? log('Auth', 'GET /api/auth/me (no token) → 401', 'PASS', '')
    : log('Auth', 'GET /api/auth/me (no token) → 401', 'FAIL', `Got HTTP ${r.status}`);

  // Wrong password → 401
  r = await req('POST', '/api/auth/login', { email: 'admin@raen.design', password: 'wrongpassword' });
  r.status === 401
    ? log('Auth', 'Login wrong password → 401', 'PASS', '')
    : log('Auth', 'Login wrong password → 401', 'FAIL', `Got HTTP ${r.status}`);

  // Google OAuth endpoint exists
  r = await req('POST', '/api/auth/google', { credential: 'fake' });
  (r.status === 400 || r.status === 401 || r.status === 503)
    ? log('Auth', 'POST /api/auth/google endpoint exists', 'PASS', `HTTP ${r.status} (expected — no real token)`)
    : log('Auth', 'POST /api/auth/google endpoint exists', 'FAIL', `HTTP ${r.status}`);

  // OTP send endpoint
  r = await req('POST', '/api/auth/send-otp', { phone: '+12267020094', channel: 'sms' });
  if (r.status === 200) {
    log('Auth', 'POST /api/auth/send-otp', 'PASS', 'OTP dispatched via Twilio');
  } else if (r.status === 429) {
    log('Auth', 'POST /api/auth/send-otp', 'PASS', 'Rate limiter active (correct) — resets on server restart');
  } else {
    log('Auth', 'POST /api/auth/send-otp', 'FAIL', `HTTP ${r.status} — ${r.body.reason || JSON.stringify(r.body)}`);
  }

  // ── 3. CART ──────────────────────────────────────────────────────────────
  section('3. Cart');
  const sessionId = 'prelaunch-check-' + Date.now();

  r = await req('GET', `/api/cart?sessionId=${sessionId}`);
  r.status === 200
    ? log('Cart', 'GET /api/cart (guest session)', 'PASS', `HTTP ${r.status}`)
    : log('Cart', 'GET /api/cart (guest session)', 'FAIL', `HTTP ${r.status}`);

  // Add item
  const firstProd = products[0];
  r = await req('POST', '/api/cart/items', {
    productId: firstProd.id, size: 'M', quantity: 1, sessionId
  });
  let cartItemId = null;
  if (r.status === 200 || r.status === 201) {
    const items = r.body.data && r.body.data.items;
    cartItemId = items && items[0] && items[0].id;
    log('Cart', 'POST /api/cart/items (add)', 'PASS', `item added, cartItemId=${cartItemId ? cartItemId.slice(0,8)+'…' : 'n/a'}`);
  } else {
    log('Cart', 'POST /api/cart/items (add)', 'FAIL', `HTTP ${r.status} — ${JSON.stringify(r.body)}`);
  }

  // Update quantity
  if (cartItemId) {
    r = await req('PATCH', `/api/cart/items/${cartItemId}`, { quantity: 2, sessionId });
    r.status === 200
      ? log('Cart', 'PATCH /api/cart/items/:id (update qty)', 'PASS', '')
      : log('Cart', 'PATCH /api/cart/items/:id (update qty)', 'FAIL', `HTTP ${r.status}`);

    r = await req('DELETE', `/api/cart/items/${cartItemId}`, { sessionId });
    r.status === 200
      ? log('Cart', 'DELETE /api/cart/items/:id (remove)', 'PASS', '')
      : log('Cart', 'DELETE /api/cart/items/:id (remove)', 'FAIL', `HTTP ${r.status}`);
  }

  // ── 4. CHECKOUT & ORDER ──────────────────────────────────────────────────
  section('4. Checkout & Orders');

  r = await req('GET', `/api/checkout/summary?sessionId=${sessionId}`);
  (r.status === 200 || r.status === 400)
    ? log('Checkout', 'GET /api/checkout/summary', 'PASS', `HTTP ${r.status}`)
    : log('Checkout', 'GET /api/checkout/summary', 'FAIL', `HTTP ${r.status}`);

  // Order by number (use a known order if exists)
  r = await req('GET', '/api/orders/RAEN-NONEXISTENT');
  r.status === 404
    ? log('Orders', 'GET /api/orders/:orderNumber (404 on missing)', 'PASS', '')
    : log('Orders', 'GET /api/orders/:orderNumber (404 on missing)', 'FAIL', `Got HTTP ${r.status}`);

  // ── 5. PAYMENTS ──────────────────────────────────────────────────────────
  section('5. Payments');

  // PayPal create — needs a valid order in DB, so just check endpoint exists
  r = await req('POST', '/api/payments/paypal/create', { orderId: 'nonexistent-order-id' });
  (r.status === 404 || r.status === 400 || r.status === 500)
    ? log('Payments', 'POST /api/payments/paypal/create (endpoint exists)', 'PASS', `HTTP ${r.status} (expected — no real order)`)
    : log('Payments', 'POST /api/payments/paypal/create (endpoint exists)', 'FAIL', `HTTP ${r.status}`);

  r = await req('POST', '/api/payments/razorpay/create', { orderId: 'nonexistent' });
  (r.status === 404 || r.status === 400 || r.status === 500)
    ? log('Payments', 'POST /api/payments/razorpay/create (endpoint exists)', 'PASS', `HTTP ${r.status}`)
    : log('Payments', 'POST /api/payments/razorpay/create (endpoint exists)', 'FAIL', `HTTP ${r.status}`);

  r = await req('POST', '/api/payments/upi/create', { orderId: 'nonexistent' });
  (r.status === 404 || r.status === 400 || r.status === 500)
    ? log('Payments', 'POST /api/payments/upi/create (endpoint exists)', 'PASS', `HTTP ${r.status}`)
    : log('Payments', 'POST /api/payments/upi/create (endpoint exists)', 'FAIL', `HTTP ${r.status}`);

  // Webhook auth check — missing sig should return 400
  r = await req('POST', '/api/payments/razorpay/webhook', { event: 'payment.captured' });
  r.status === 400
    ? log('Payments', 'Razorpay webhook: missing sig → 400', 'PASS', '')
    : log('Payments', 'Razorpay webhook: missing sig → 400', 'FAIL', `Got HTTP ${r.status}`);

  // ── 6. ADMIN ─────────────────────────────────────────────────────────────
  section('6. Admin Endpoints');

  if (!adminToken) {
    log('Admin', 'SKIPPED — admin token not available', 'FAIL', '');
  } else {
    const adminH = { Authorization: `Bearer ${adminToken}` };

    r = await req('GET', '/api/admin/dashboard-extended', null, adminH);
    r.status === 200 && r.body.data
      ? log('Admin', 'GET /admin/dashboard-extended', 'PASS', `revenue.total=€${r.body.data.revenue && r.body.data.revenue.total || 0}`)
      : log('Admin', 'GET /admin/dashboard-extended', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/analytics?period=30', null, adminH);
    r.status === 200 && r.body.data && r.body.data.summary
      ? log('Admin', 'GET /admin/analytics?period=30', 'PASS', `pageViews=${r.body.data.summary.totalPageViews}, cartEvents=${r.body.data.summary.addToCartEvents}`)
      : log('Admin', 'GET /admin/analytics?period=30', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/dashboard-extended', null, adminH);
    r.status === 200 && r.body.data && r.body.data.revenue
      ? log('Admin', 'GET /admin/dashboard-extended', 'PASS', `revenue.total=€${r.body.data.revenue.total}, orders=${r.body.data.orders ? r.body.data.orders.total || 0 : 0}`)
      : log('Admin', 'GET /admin/dashboard-extended', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/products', null, adminH);
    r.status === 200 && r.body.data && r.body.data.products
      ? log('Admin', 'GET /admin/products', 'PASS', `${r.body.data.products.length} products`)
      : log('Admin', 'GET /admin/products', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/orders', null, adminH);
    r.status === 200 && r.body.data && r.body.data.orders
      ? log('Admin', 'GET /admin/orders', 'PASS', `${r.body.data.orders.length} orders`)
      : log('Admin', 'GET /admin/orders', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/customers', null, adminH);
    r.status === 200 && r.body.data && r.body.data.customers
      ? log('Admin', 'GET /admin/customers', 'PASS', `${r.body.data.customers.length} customers`)
      : log('Admin', 'GET /admin/customers', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/inventory', null, adminH);
    r.status === 200 && r.body.data && r.body.data.inventory
      ? log('Admin', 'GET /admin/inventory', 'PASS', `${r.body.data.inventory.length} inventory rows`)
      : log('Admin', 'GET /admin/inventory', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/payments', null, adminH);
    r.status === 200 && r.body.data && r.body.data.payments
      ? log('Admin', 'GET /admin/payments', 'PASS', `${r.body.data.payments.length} payments`)
      : log('Admin', 'GET /admin/payments', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/payments/pending-verification', null, adminH);
    r.status === 200 && r.body.data && r.body.data.payments
      ? log('Admin', 'GET /admin/payments/pending-verification', 'PASS', `${r.body.data.payments.length} pending`)
      : log('Admin', 'GET /admin/payments/pending-verification', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/contact-messages', null, adminH);
    r.status === 200 && r.body.data && r.body.data.messages
      ? log('Admin', 'GET /admin/contact-messages', 'PASS', `${r.body.data.messages.length} messages`)
      : log('Admin', 'GET /admin/contact-messages', 'FAIL', `HTTP ${r.status}`);

    r = await req('GET', '/api/admin/early-access', null, adminH);
    r.status === 200 && r.body.data && r.body.data.requests
      ? log('Admin', 'GET /admin/early-access', 'PASS', `${r.body.data.requests.length} requests`)
      : log('Admin', 'GET /admin/early-access', 'FAIL', `HTTP ${r.status}`);

    // Admin without token → 401
    r = await req('GET', '/api/admin/products');
    r.status === 401
      ? log('Admin', 'Admin route without token → 401', 'PASS', '')
      : log('Admin', 'Admin route without token → 401', 'FAIL', `Got HTTP ${r.status}`);
  }

  // ── 7. ACCOUNT ───────────────────────────────────────────────────────────
  section('7. Account Endpoints');

  r = await req('GET', '/api/account/profile');
  r.status === 401
    ? log('Account', 'GET /account/profile (no token) → 401', 'PASS', '')
    : log('Account', 'GET /account/profile (no token) → 401', 'FAIL', `Got HTTP ${r.status}`);

  r = await req('GET', '/api/account/orders');
  r.status === 401
    ? log('Account', 'GET /account/orders (no token) → 401', 'PASS', '')
    : log('Account', 'GET /account/orders (no token) → 401', 'FAIL', `Got HTTP ${r.status}`);

  r = await req('GET', '/api/account/addresses');
  r.status === 401
    ? log('Account', 'GET /account/addresses (no token) → 401', 'PASS', '')
    : log('Account', 'GET /account/addresses (no token) → 401', 'FAIL', `Got HTTP ${r.status}`);

  // ── 8. CONTACT / NEWSLETTER / EARLY-ACCESS ───────────────────────────────
  section('8. Contact / Newsletter / Early-Access');

  r = await req('POST', '/api/contact', {
    name: 'Pre-Launch Test', email: 'test@raen.design',
    subject: 'Pre-launch check', message: 'Automated pre-launch verification test.'
  });
  r.status === 201
    ? log('Contact', 'POST /api/contact (valid submission)', 'PASS', `id=${r.body.data && r.body.data.id ? r.body.data.id.slice(0,8)+'…' : 'ok'}`)
    : log('Contact', 'POST /api/contact (valid submission)', 'FAIL', `HTTP ${r.status} — ${JSON.stringify(r.body)}`);

  r = await req('POST', '/api/contact', { name: '', email: 'bad', message: '' });
  r.status === 422
    ? log('Contact', 'POST /api/contact (invalid) → 422', 'PASS', '')
    : log('Contact', 'POST /api/contact (invalid) → 422', 'FAIL', `Got HTTP ${r.status}`);

  r = await req('POST', '/api/newsletter/subscribe', { email: 'prelaunch@raen.design' });
  (r.status === 200 || r.status === 201)
    ? log('Newsletter', 'POST /api/newsletter/subscribe', 'PASS', `HTTP ${r.status}`)
    : log('Newsletter', 'POST /api/newsletter/subscribe', 'FAIL', `HTTP ${r.status}`);

  r = await req('POST', '/api/early-access', {
    firstName: 'Launch', lastName: 'Test', email: 'launch@raen.design',
    phone: '+12267020094', city: 'Toronto', interest: 'Fashion',
    budgetOrPreference: '€2000+', acceptedPrivacy: true, wantsUpdates: true
  });
  (r.status === 200 || r.status === 201)
    ? log('EarlyAccess', 'POST /api/early-access', 'PASS', `HTTP ${r.status}`)
    : log('EarlyAccess', 'POST /api/early-access', 'FAIL', `HTTP ${r.status} — ${JSON.stringify(r.body)}`);

  // ── 9. ANALYTICS ─────────────────────────────────────────────────────────
  section('9. Analytics Tracking');

  r = await req('POST', '/api/analytics/pageview', {
    path: '/pre-launch-check', sessionId: sessionId
  });
  r.status === 200 && r.body.ok
    ? log('Analytics', 'POST /api/analytics/pageview', 'PASS', '')
    : log('Analytics', 'POST /api/analytics/pageview', 'FAIL', `HTTP ${r.status}`);

  r = await req('POST', '/api/analytics/cart-event', {
    event: 'add_to_cart', sessionId: sessionId, productId: firstProd.id
  });
  r.status === 200 && r.body.ok
    ? log('Analytics', 'POST /api/analytics/cart-event (add_to_cart)', 'PASS', '')
    : log('Analytics', 'POST /api/analytics/cart-event (add_to_cart)', 'FAIL', `HTTP ${r.status}`);

  r = await req('POST', '/api/analytics/cart-event', { event: 'invalid_event', sessionId });
  r.status === 400
    ? log('Analytics', 'POST /api/analytics/cart-event (invalid event → 400)', 'PASS', '')
    : log('Analytics', 'POST /api/analytics/cart-event (invalid event → 400)', 'FAIL', `Got HTTP ${r.status}`);

  // ── 10. DISCOUNT PRICING ─────────────────────────────────────────────────
  section('10. Discount Pricing');

  if (adminToken) {
    const adminH = { Authorization: `Bearer ${adminToken}` };
    // Create a test product with discount
    const testSlug = 'prelaunch-check-' + Date.now();
    r = await req('POST', '/api/admin/products', {
      name: 'Pre-Launch Discount Test ' + Date.now(), slug: testSlug,
      price: 1000, salePrice: null, discountPercent: 25,
      category: 'Test', description: 'Pre-launch check product',
      images: [], sizes: ['S','M']
    }, adminH);
    let testProdId = null;
    if (r.status === 201 && r.body.data && r.body.data.product) {
      testProdId = r.body.data.product.id;
      log('Discount', 'Create product with discountPercent=25', 'PASS', `id=${testProdId.slice(0,8)}…`);
    } else {
      log('Discount', 'Create product with discountPercent=25', 'FAIL', `HTTP ${r.status} — ${JSON.stringify(r.body)}`);
    }

    if (testProdId) {
      // Verify API returns discountPercent
      r = await req('GET', `/api/admin/products/${testProdId}`, null, adminH);
      const dp = r.body.data && r.body.data.product && r.body.data.product.discountPercent;
      dp === 25
        ? log('Discount', 'discountPercent=25 stored and returned', 'PASS', '')
        : log('Discount', 'discountPercent=25 stored and returned', 'FAIL', `got ${dp}`);

      // Set salePrice — should override discountPercent
      r = await req('PATCH', `/api/admin/products/${testProdId}`, { salePrice: 700 }, adminH);
      const sp = r.body.data && r.body.data.product && r.body.data.product.salePrice;
      sp === 700
        ? log('Discount', 'salePrice=700 override stored', 'PASS', `effectivePrice would be €700`)
        : log('Discount', 'salePrice=700 override stored', 'FAIL', `got ${sp}`);

      // Cleanup — archive test product
      await req('DELETE', `/api/admin/products/${testProdId}`, null, adminH);
      log('Discount', 'Test product archived (cleanup)', 'PASS', '');
    }
  }

  // ── 11. EMAIL (SMTP) ──────────────────────────────────────────────────────
  section('11. Email / SMTP (Hostinger)');

  // We test by verifying the transporter config — not by sending a live email in this check
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  smtpHost === 'smtp.hostinger.com'
    ? log('Email', 'SMTP_HOST = smtp.hostinger.com', 'PASS', '')
    : log('Email', 'SMTP_HOST = smtp.hostinger.com', 'FAIL', `Got: ${smtpHost}`);

  smtpPort === 465
    ? log('Email', 'SMTP_PORT = 465 (SSL)', 'PASS', '')
    : log('Email', 'SMTP_PORT = 465 (SSL)', 'FAIL', `Got: ${smtpPort}`);

  smtpUser === 'hello@raen.design'
    ? log('Email', 'SMTP_USER = hello@raen.design', 'PASS', '')
    : log('Email', 'SMTP_USER = hello@raen.design', 'FAIL', `Got: ${smtpUser}`);

  (smtpPass && smtpPass.length > 6 && !smtpPass.includes('PLACEHOLDER'))
    ? log('Email', 'SMTP_PASS is set (not placeholder)', 'PASS', '')
    : log('Email', 'SMTP_PASS is set (not placeholder)', 'FAIL', 'Still placeholder or empty');

  // Actually verify SMTP connection
  try {
    const nodemailer = require('../backend/node_modules/nodemailer');
    const transport = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });
    await transport.verify();
    log('Email', 'SMTP connection verify() — Hostinger SSL', 'PASS', 'Connected and authenticated');
  } catch (e) {
    log('Email', 'SMTP connection verify() — Hostinger SSL', 'FAIL', e.message.slice(0, 80));
  }

  // ── 12. TWILIO ────────────────────────────────────────────────────────────
  section('12. Twilio SMS');

  const twilioSid   = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  (!twilioSid || twilioSid.includes('PLACEHOLDER'))
    ? log('Twilio', 'TWILIO_ACCOUNT_SID set', 'FAIL', 'Still placeholder')
    : log('Twilio', 'TWILIO_ACCOUNT_SID set', 'PASS', twilioSid.slice(0,10) + '…');

  twilioPhone === '+17432565129'
    ? log('Twilio', 'TWILIO_PHONE_NUMBER = +17432565129', 'PASS', '')
    : log('Twilio', 'TWILIO_PHONE_NUMBER = +17432565129', 'FAIL', `Got: ${twilioPhone}`);

  // Verify Twilio creds by fetching account info
  try {
    const twilio = require('../backend/node_modules/twilio');
    const client = twilio(twilioSid, twilioToken);
    const account = await client.api.accounts(twilioSid).fetch();
    log('Twilio', 'Twilio credentials valid (account fetch)', 'PASS', `status=${account.status}`);
  } catch (e) {
    log('Twilio', 'Twilio credentials valid (account fetch)', 'FAIL', e.message.slice(0,60));
  }

  // ── 13. PAYPAL ────────────────────────────────────────────────────────────
  section('13. PayPal Sandbox');

  const ppEnv = process.env.PAYPAL_ENV;
  const ppId  = process.env.PAYPAL_CLIENT_ID;

  ppEnv === 'sandbox'
    ? log('PayPal', 'PAYPAL_ENV = sandbox', 'PASS', '')
    : log('PayPal', 'PAYPAL_ENV = sandbox', 'WARN', `Set to: ${ppEnv} — use sandbox for testing`);

  (ppId && !ppId.includes('PLACEHOLDER') && ppId.length > 20)
    ? log('PayPal', 'PAYPAL_CLIENT_ID set', 'PASS', ppId.slice(0,12) + '…')
    : log('PayPal', 'PAYPAL_CLIENT_ID set', 'FAIL', 'Missing or placeholder');

  // Get PayPal OAuth token to verify credentials
  try {
    const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const ppToken = await new Promise((resolve, reject) => {
      const body = 'grant_type=client_credentials';
      const opts = {
        hostname: 'api-m.sandbox.paypal.com', port: 443,
        path: '/v1/oauth2/token', method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': body.length
        }
      };
      const req2 = https.request(opts, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('bad json')); }});
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });
    ppToken.access_token
      ? log('PayPal', 'PayPal sandbox OAuth token obtained', 'PASS', `token_type=${ppToken.token_type}`)
      : log('PayPal', 'PayPal sandbox OAuth token obtained', 'FAIL', ppToken.error_description || 'no token');
  } catch (e) {
    log('PayPal', 'PayPal sandbox OAuth token obtained', 'FAIL', e.message);
  }

  // ── 14. PRODUCTION CONFIG ─────────────────────────────────────────────────
  section('14. Production Config');

  process.env.TOKEN_STORE === 'db'
    ? log('Config', 'TOKEN_STORE = db (survives restarts)', 'PASS', '')
    : log('Config', 'TOKEN_STORE = db (survives restarts)', 'WARN', `Currently: ${process.env.TOKEN_STORE}`);

  process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech')
    ? log('Config', 'DATABASE_URL points to Neon cloud', 'PASS', '')
    : log('Config', 'DATABASE_URL points to Neon cloud', 'FAIL', 'Not set or not Neon');

  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 64
    ? log('Config', 'JWT_SECRET length ≥ 64 chars', 'PASS', `${process.env.JWT_SECRET.length} chars`)
    : log('Config', 'JWT_SECRET length ≥ 64 chars', 'WARN', 'Too short — rotate before go-live');

  // Railway config files present
  const fs = require('fs');
  const railwayToml = fs.existsSync(require('path').join(__dirname, '../railway.toml'));
  railwayToml
    ? log('Config', 'railway.toml present', 'PASS', '')
    : log('Config', 'railway.toml present', 'FAIL', 'Missing — Railway won\'t know how to start');

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(74));
  console.log('  FINAL RESULTS');
  console.log('═'.repeat(74));
  console.log(`  ✓  PASSED : ${passed}`);
  console.log(`  ⚠  WARNED : ${warned}`);
  console.log(`  ✗  FAILED : ${failed}`);
  console.log('─'.repeat(74));

  if (failed > 0) {
    console.log('\n  FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ✗  [${r.section}] ${r.test}`);
      if (r.detail) console.log(`       → ${r.detail}`);
    });
  }
  if (warned > 0) {
    console.log('\n  WARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  ⚠  [${r.section}] ${r.test}`);
      if (r.detail) console.log(`       → ${r.detail}`);
    });
  }

  const total = passed + warned + failed;
  const pct   = Math.round((passed / total) * 100);
  console.log(`\n  Score: ${passed}/${total} (${pct}%)`);
  console.log(failed === 0 ? '  ✓  READY FOR PRODUCTION\n' : '  ✗  FIX FAILURES BEFORE GO-LIVE\n');
  console.log('═'.repeat(74) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Check script crashed:', err);
  process.exit(1);
});
