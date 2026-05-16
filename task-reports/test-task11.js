/**
 * RAEN Task 11 — Discount Pricing on Frontend
 * Test suite: backend discount data + frontend static analysis
 * Run: node task-reports/test-task11.js
 * Requires: backend on :5000
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
let adminToken = null;
let testProductId = null;
const TEST_SLUG = `task11-test-${Date.now()}`;

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

// ── A: Health ────────────────────────────────────────────────────────────────
async function runA() {
  console.log('\nA: Health');
  const r = await req('GET', `${BASE}/health`);
  assert('A1 — /health returns 200', r.status === 200);
}

// ── B: Admin login ────────────────────────────────────────────────────────────
async function runB() {
  console.log('\nB: Admin auth');
  const r = await req('POST', `${BASE}/api/auth/login`,
    { email: 'admin@raen.design', password: 'RaenAdmin2024!' });
  adminToken = r.body?.data?.token;
  assert('B1 — Admin login → 200', r.status === 200 && !!adminToken, `status=${r.status}`);
}

// ── C: Backend — products API returns discount fields ─────────────────────────
async function runC() {
  console.log('\nC: Product API returns salePrice and discountPercent');

  const r = await req('GET', `${BASE}/api/products`);
  assert('C1 — GET /api/products returns 200', r.status === 200, `got ${r.status}`);

  const products = r.body?.data?.products || r.body?.data || [];
  assert('C2 — Returns array of products', Array.isArray(products), `type=${typeof products}`);

  if (products.length > 0) {
    const p = products[0];
    assert('C3 — Product has salePrice field (null or number)', 'salePrice' in p,
      `keys=${Object.keys(p).join(',')}`);
    assert('C4 — Product has discountPercent field (null or number)', 'discountPercent' in p,
      `keys=${Object.keys(p).join(',')}`);
    assert('C5 — Product has price field', typeof p.price === 'number');
  } else {
    skip('C3', 'No products in DB');
    skip('C4', 'No products in DB');
    skip('C5', 'No products in DB');
  }

  // Single product endpoint
  const rSlug = await req('GET', `${BASE}/api/products/the-sovereign`);
  assert('C6 — GET /api/products/:slug returns 200', rSlug.status === 200, `got ${rSlug.status}`);
  const prod = rSlug.body?.data?.product || rSlug.body?.data;
  assert('C7 — Single product has salePrice field',      'salePrice'      in (prod || {}));
  assert('C8 — Single product has discountPercent field', 'discountPercent' in (prod || {}));
}

// ── D: Backend — create + verify discount product via admin API ───────────────
async function runD() {
  console.log('\nD: Admin API — create product with discountPercent, verify effective price logic');

  if (!adminToken) { skip('D1-D8', 'No admin token from B1'); return; }

  // Create a product with 20% discount
  const rCreate = await req('POST', `${BASE}/api/admin/products`, {
    name: `Task11 Test Product`,
    slug: TEST_SLUG,
    description: 'Test product for Task 11 discount pricing',
    category: 'Test',
    price: 1000,
    discountPercent: 20,
    status: 'ACTIVE',
    sizes: ['S', 'M'],
    images: []
  }, adminToken);
  testProductId = rCreate.body?.data?.product?.id;
  assert('D1 — Create product with 20% discount → 200/201',
    [200, 201].includes(rCreate.status), `got ${rCreate.status} ${JSON.stringify(rCreate.body)}`);
  assert('D2 — Created product has discountPercent = 20',
    rCreate.body?.data?.product?.discountPercent === 20);
  assert('D3 — Created product has price = 1000',
    rCreate.body?.data?.product?.price === 1000);

  // Verify the product is accessible via products API
  const rFetch = await req('GET', `${BASE}/api/products/${TEST_SLUG}`);
  assert('D4 — Discounted product fetchable by slug → 200', rFetch.status === 200);
  const p = rFetch.body?.data?.product || rFetch.body?.data;
  assert('D5 — Fetched product has discountPercent = 20', p?.discountPercent === 20);
  assert('D6 — Fetched product has price = 1000', p?.price === 1000);
  assert('D7 — salePrice is null (discountPercent used instead)', p?.salePrice === null || p?.salePrice === undefined);

  // Verify effective price math: 1000 * (1 - 20/100) = 800
  const effective = p?.discountPercent ? p.price * (1 - p.discountPercent / 100) : null;
  assert('D8 — Effective price = 800.00 (1000 × 0.80)', effective === 800);

  // Now update to use salePrice instead
  if (testProductId) {
    const rUpdate = await req('PATCH', `${BASE}/api/admin/products/${testProductId}`,
      { salePrice: 750 }, adminToken);
    assert('D9 — Update product with salePrice = 750 → 200', rUpdate.status === 200, `got ${rUpdate.status}`);
    const updated = rUpdate.body?.data?.product;
    assert('D10 — salePrice stored as 750', updated?.salePrice === 750);
  } else {
    skip('D9', 'No testProductId from D1');
    skip('D10', 'No testProductId from D1');
  }
}

// ── E: Backend — salePrice takes precedence over discountPercent ───────────────
async function runE() {
  console.log('\nE: salePrice vs discountPercent precedence (spec: salePrice wins)');

  const rFetch = await req('GET', `${BASE}/api/products/${TEST_SLUG}`);
  const p = rFetch.body?.data?.product || rFetch.body?.data;

  if (!p) { skip('E1-E3', 'Could not fetch test product'); return; }

  assert('E1 — Product has both salePrice and discountPercent set',
    p?.salePrice !== null && p?.discountPercent !== null,
    `salePrice=${p?.salePrice} discountPercent=${p?.discountPercent}`);

  // The spec formula: effectivePrice = salePrice || (discountPercent ? price*(1-dp/100) : null)
  // salePrice=750 wins over discountPercent=20 (which would give 800)
  const effectivePerSpec = p?.salePrice ||
    (p?.discountPercent ? p?.price * (1 - p?.discountPercent / 100) : null);
  assert('E2 — effectivePrice = salePrice (750) when both are set', effectivePerSpec === 750);
  assert('E3 — effectivePrice (750) < price (1000)', effectivePerSpec < p?.price);

  // Clean up: archive test product
  if (testProductId && adminToken) {
    await req('DELETE', `${BASE}/api/admin/products/${testProductId}`, null, adminToken);
  }
}

// ── F: Frontend — product-detail.html static analysis ────────────────────────
async function runF() {
  console.log('\nF: product-detail.html — discount price rendering');

  // effectivePrice formula
  assert('F1  — effectivePrice variable declared',
    fileContains('product-detail.html', 'effectivePrice'));
  assert('F2  — salePrice checked first in effectivePrice',
    fileContains('product-detail.html', 'product.salePrice'));
  assert('F3  — discountPercent fallback present',
    fileContains('product-detail.html', 'product.discountPercent', '1 - product.discountPercent / 100'));
  assert('F4  — effectivePrice < product.price guard present',
    fileContains('product-detail.html', 'effectivePrice && effectivePrice < product.price'));

  // Strikethrough original price
  assert('F5  — Strikethrough style on original price',
    fileContains('product-detail.html', 'text-decoration:line-through'));
  assert('F6  — Original price colour muted (#999)',
    fileContains('product-detail.html', 'color:#999'));

  // Gold effective price
  assert('F7  — Gold colour on effective price (#b8960c)',
    fileContains('product-detail.html', 'color:#b8960c'));

  // % OFF badge
  assert('F8  — discountPercent % OFF badge rendered',
    fileContains('product-detail.html', 'product.discountPercent', '% OFF'));

  // Fallback: plain price when no discount
  assert('F9  — Fallback plain price (else branch with textContent)',
    fileContains('product-detail.html', 'priceEl.textContent'));

  // Both innerHTML and textContent used (discount vs no-discount branches)
  assert('F10 — priceEl.innerHTML used for discount branch',
    fileContains('product-detail.html', 'priceEl.innerHTML'));

  // en-GB locale + 2 decimal places used for effective price
  assert('F11 — effectivePrice formatted with en-GB locale',
    fileContains('product-detail.html', 'effectivePrice', 'en-GB', 'minimumFractionDigits'));

  // priceEl selector unchanged (p.font-headline.italic)
  assert('F12 — priceEl selector unchanged (p.font-headline.italic)',
    fileContains('product-detail.html', "querySelector('p.font-headline.italic')"));
}

// ── G: Frontend — collections.html static analysis ────────────────────────────
async function runG() {
  console.log('\nG: collections.html — discount price rendering + slug fix');

  // Slug extraction fix
  assert('G1  — Slug extracted via regex (slug=X pattern)',
    fileContains('collections.html', "href.match(/slug=([^&]+)/)", 'slugMatch'));
  assert('G2  — Regex result used: slugMatch[1]',
    fileContains('collections.html', 'slugMatch[1]'));
  assert('G3  — Old broken .replace(".html","") removed as primary extraction',
    fileContains('collections.html', 'slugMatch ? slugMatch[1]'));

  // effectivePrice formula
  assert('G4  — effectivePrice declared in collections script',
    fileContains('collections.html', 'effectivePrice'));
  assert('G5  — product.salePrice checked first',
    fileContains('collections.html', 'product.salePrice'));
  assert('G6  — product.discountPercent fallback',
    fileContains('collections.html', 'product.discountPercent', '1 - product.discountPercent / 100'));
  assert('G7  — effectivePrice < product.price guard',
    fileContains('collections.html', 'effectivePrice && effectivePrice < product.price'));

  // Strikethrough
  assert('G8  — Strikethrough on original price',
    fileContains('collections.html', 'text-decoration:line-through'));
  assert('G9  — Muted colour on original (#999)',
    fileContains('collections.html', 'color:#999'));

  // Gold effective price
  assert('G10 — Gold colour on effective price (#b8960c)',
    fileContains('collections.html', 'color:#b8960c'));

  // % OFF badge
  assert('G11 — discountPercent % OFF badge in collections',
    fileContains('collections.html', 'discountPercent', '% OFF'));

  // Fallback textContent
  assert('G12 — Fallback plain textContent when no discount',
    fileContains('collections.html', 'priceEl.textContent'));

  // Both branches
  assert('G13 — priceEl.innerHTML used for discount branch',
    fileContains('collections.html', 'priceEl.innerHTML'));

  // en-GB locale
  assert('G14 — en-GB locale with 2 decimal places in collections',
    fileContains('collections.html', 'en-GB', 'minimumFractionDigits'));

  // product-price selector unchanged
  assert('G15 — .product-price selector still used',
    fileContains('collections.html', ".product-price"));
}

// ── H: Logic correctness — effectivePrice formula edge cases ─────────────────
async function runH() {
  console.log('\nH: effectivePrice formula correctness (Node.js simulation)');

  function effectivePrice(price, salePrice, discountPercent) {
    return salePrice ||
      (discountPercent ? price * (1 - discountPercent / 100) : null);
  }

  // salePrice set — should use it
  assert('H1 — salePrice=750 wins over discountPercent=20',
    effectivePrice(1000, 750, 20) === 750);

  // only discountPercent
  assert('H2 — discountPercent=20 gives 800 when no salePrice',
    effectivePrice(1000, null, 20) === 800);

  // only salePrice (no discountPercent)
  assert('H3 — salePrice=500 used when no discountPercent',
    effectivePrice(1000, 500, null) === 500);

  // neither — returns null (no discount shown)
  assert('H4 — null when neither salePrice nor discountPercent',
    effectivePrice(1000, null, null) === null);

  // effectivePrice >= price — no discount shown (guard: effectivePrice < price)
  const ep = effectivePrice(1000, 1200, null);
  assert('H5 — effectivePrice=1200 > price=1000 → guard blocks discount display',
    !(ep && ep < 1000));

  // discountPercent=0 — treated as falsy, no discount
  assert('H6 — discountPercent=0 treated as no discount (falsy)',
    effectivePrice(1000, null, 0) === null);

  // salePrice=0 — treated as falsy (falsy 0), falls through to discountPercent
  // This is the spec behaviour (salePrice || ...) — 0 is falsy in JS
  const ep0 = effectivePrice(1000, 0, 20);
  assert('H7 — salePrice=0 is falsy → discountPercent=20 used → 800',
    ep0 === 800);

  // discountPercent=100 — edge: effectivePrice=0, which is falsy, so no discount shown
  const ep100 = effectivePrice(1000, null, 100);
  assert('H8 — discountPercent=100 gives ep=0 (falsy) → guard blocks display',
    !ep100 || !(ep100 < 1000));

  // Real product prices — 20% off
  assert('H9 — €4,800 at 20% off = €3,840.00',
    effectivePrice(4800, null, 20) === 3840);

  assert('H10 — €2,400 at 15% off = €2,040.00',
    effectivePrice(2400, null, 15) === 2040);
}

// ── I: Regression — existing product detail and collections pages unbroken ──
async function runI() {
  console.log('\nI: Regression');

  // product-detail: priceEl selector still present
  assert('I1 — product-detail.html: priceEl selector still present',
    fileContains('product-detail.html', "querySelector('p.font-headline.italic')"));

  // product-detail: product fetch still via apiGet (uses template literal backtick)
  assert('I2 — product-detail.html: apiGet still used for product fetch',
    fileContains('product-detail.html', 'apiGet(`/products/'));

  // product-detail: add-to-cart tracking still present
  assert('I3 — product-detail.html: __trackCart add_to_cart still present',
    fileContains('product-detail.html', "__trackCart('add_to_cart'"));

  // collections: productMap still built
  assert('I4 — collections.html: productMap still built',
    fileContains('collections.html', 'productMap'));

  // collections: apiGet still used
  assert('I5 — collections.html: apiGet still used',
    fileContains('collections.html', "apiGet('/products')"));

  // collections: card href still updated to slug format
  assert('I6 — collections.html: href still updated to product-detail.html?slug=',
    fileContains('collections.html', 'product-detail.html?slug='));

  // collections: auth-modal.js still present
  assert('I7 — collections.html: auth-modal.js still included',
    fileContains('collections.html', 'auth-modal.js'));

  // product-detail: ACCOUNT nav link still present
  assert('I8 — product-detail.html: ACCOUNT nav link still present',
    fileContains('product-detail.html', 'openAuthModal'));

  // Backend products endpoint still returns 200 (regression)
  const r = await req('GET', `${BASE}/api/products`);
  assert('I9 — GET /api/products still returns 200', r.status === 200, `got ${r.status}`);

  // Backend single product endpoint still works
  const rSlug = await req('GET', `${BASE}/api/products/the-sovereign`);
  assert('I10 — GET /api/products/the-sovereign still returns 200', rSlug.status === 200, `got ${rSlug.status}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' RAEN Task 11 — Discount Pricing on Frontend — Test Suite');
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
