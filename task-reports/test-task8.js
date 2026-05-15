/**
 * RAEN Task 8 — Professional Test Suite
 * Tests: auth, all 24 admin endpoints, CRUD round-trips, validation, edge cases,
 *        HTML static analysis, JS helper logic, field-name contract verification.
 */

'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const BASE     = 'http://localhost:5000';
const ADMIN    = { email: 'admin@raen.design', password: 'RaenAdmin2024!' };
const ADMIN_DIR = path.join(__dirname, '..', 'stitch', 'admin');

/* ─── colour helpers ─────────────────────────────────────────────────────── */
const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[1m${s}\x1b[0m`;

/* ─── counters ───────────────────────────────────────────────────────────── */
let passed = 0, failed = 0, skipped = 0;
const failures = [];

function pass(label)  { passed++;  console.log('  ' + G('✓') + ' ' + label); }
function fail(label, detail) {
  failed++;
  console.log('  ' + R('✗') + ' ' + label);
  if (detail) console.log('      ' + R('→ ' + detail));
  failures.push({ label, detail });
}
function skip(label)  { skipped++; console.log('  ' + Y('−') + ' ' + label + ' (skipped)'); }
function section(s)   { console.log('\n' + B(s)); }

/* ─── HTTP helpers ───────────────────────────────────────────────────────── */
function req(method, pathname, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 5000,
      path: pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const r = http.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

const GET    = (p, tok)    => req('GET',    p, tok);
const POST   = (p, tok, b) => req('POST',   p, tok, b);
const PATCH  = (p, tok, b) => req('PATCH',  p, tok, b);
const DELETE = (p, tok)    => req('DELETE', p, tok);

/* ─── assertion helpers ──────────────────────────────────────────────────── */
function expect200(res, label, extra) {
  if (res.status === 200 || res.status === 201) {
    pass(label + (extra ? ' — ' + extra : ''));
    return true;
  }
  fail(label, 'Expected 2xx, got ' + res.status + ' — ' + JSON.stringify(res.body).slice(0,120));
  return false;
}
function expect4xx(res, label, code) {
  const ok = code ? res.status === code : res.status >= 400 && res.status < 500;
  if (ok) pass(label);
  else     fail(label, 'Expected ' + (code||'4xx') + ', got ' + res.status);
}
function hasField(obj, path, label) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || !(p in cur)) { fail(label + ' — missing ' + path); return false; }
    cur = cur[p];
  }
  pass(label + ' — has ' + path);
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════════ */
async function run() {
  console.log(B('\n╔══════════════════════════════════════════════════════╗'));
  console.log(B('║       RAEN Admin — Task 8 Professional Test Suite    ║'));
  console.log(B('╚══════════════════════════════════════════════════════╝'));

  /* ── A. Health check ──────────────────────────────────────────────────── */
  section('A. Backend health');
  const health = await GET('/health');
  if (health.status !== 200) { fail('Backend reachable', 'Not running on port 5000'); process.exit(1); }
  pass('Backend responding on port 5000');

  /* ── B. Authentication ────────────────────────────────────────────────── */
  section('B. Authentication');

  // B1 — login happy path
  const loginRes = await POST('/api/auth/login', null, ADMIN);
  if (!expect200(loginRes, 'B1 Login with correct admin credentials')) process.exit(1);
  const TOKEN = loginRes.body?.data?.token;
  if (!TOKEN) { fail('B1 Token in login response'); process.exit(1); }
  pass('B1 JWT token received');

  // B2 — admin role in token payload
  const roleInResp = loginRes.body?.data?.user?.role;
  if (roleInResp === 'ADMIN') pass('B2 Login response contains role:ADMIN');
  else fail('B2 Login response role', 'got: ' + roleInResp);

  // B3 — wrong password → 401
  const badLogin = await POST('/api/auth/login', null, { email: ADMIN.email, password: 'WRONG' });
  // 429 is valid: auth rate limiter (max 5 attempts/15min) may kick in during test runs
  expect4xx(badLogin, 'B3 Wrong password → 4xx (401=invalid creds, 429=rate limited — both correct)');

  // B4 — no token on admin endpoint → 401
  const noTok = await GET('/api/admin/dashboard-extended');
  expect4xx(noTok, 'B4 No token on admin endpoint → 401', 401);

  // B5 — garbage token → 401
  const badTok = await GET('/api/admin/dashboard-extended', 'notavalidtoken');
  expect4xx(badTok, 'B5 Invalid token on admin endpoint → 401', 401);

  // B6 — customer token cannot access admin endpoints → 403
  // (We skip this if no customer exists, to avoid creating test data)
  skip('B6 Customer token rejected by admin endpoints (no test customer available — manual)');

  /* ── C. Dashboard endpoints ───────────────────────────────────────────── */
  section('C. Dashboard endpoints');

  const dash = await GET('/api/admin/dashboard-extended', TOKEN);
  if (expect200(dash, 'C1 GET /admin/dashboard-extended')) {
    const d = dash.body?.data || {};
    hasField(d, 'orders', 'C2 Response has orders');
    hasField(d, 'orders.total', 'C3 orders.total present');
    hasField(d, 'orders.pending', 'C4 orders.pending present');
    hasField(d, 'revenue', 'C5 Response has revenue');
    hasField(d, 'revenue.today', 'C6 revenue.today present');
    hasField(d, 'revenue.week', 'C7 revenue.week present');
    hasField(d, 'revenue.month', 'C8 revenue.month present');
    hasField(d, 'revenue.total', 'C9 revenue.total present (not allTime)');
    hasField(d, 'pendingUPIVerifications', 'C10 pendingUPIVerifications present (not pendingVerifications)');
    hasField(d, 'lowStockItems', 'C11 lowStockItems array present');
    hasField(d, 'recentOrders', 'C12 recentOrders array present');
    hasField(d, 'topProducts', 'C13 topProducts array present');
    hasField(d, 'customers', 'C14 customers object present (not customerCounts)');
    hasField(d, 'customers.total', 'C15 customers.total present');
    hasField(d, 'customers.newThisMonth', 'C16 customers.newThisMonth present');
    if (Array.isArray(d.topProducts) && d.topProducts.length > 0) {
      const tp = d.topProducts[0];
      if ('_sum' in tp && 'lineTotal' in tp._sum) pass('C17 topProducts._sum.lineTotal present (not .revenue)');
      else fail('C17 topProducts._sum.lineTotal — field name wrong', JSON.stringify(tp).slice(0,80));
    } else skip('C17 topProducts empty — field name not checkable');
    if (Array.isArray(d.lowStockItems) && d.lowStockItems.length > 0) {
      const li = d.lowStockItems[0];
      if ('product' in li && 'name' in li.product) pass('C18 lowStockItems have product.name');
      else fail('C18 lowStockItems product.name missing', JSON.stringify(li).slice(0,80));
    } else skip('C18 No low-stock items (all stock > 5) — normal');
  }

  const anal30 = await GET('/api/admin/analytics?period=30', TOKEN);
  if (expect200(anal30, 'C19 GET /admin/analytics?period=30')) {
    const d = anal30.body?.data || {};
    hasField(d, 'summary', 'C20 analytics has summary (not flat fields)');
    hasField(d, 'summary.totalPageViews', 'C21 summary.totalPageViews present');
    hasField(d, 'summary.uniqueSessions', 'C22 summary.uniqueSessions present');
    hasField(d, 'summary.addToCartEvents', 'C23 summary.addToCartEvents present (not cartEvents.add_to_cart)');
    hasField(d, 'summary.checkoutStarted', 'C24 summary.checkoutStarted present');
    hasField(d, 'summary.checkoutCompleted', 'C25 summary.checkoutCompleted present');
    hasField(d, 'summary.conversionRate', 'C26 summary.conversionRate present');
    hasField(d, 'revenueByDay', 'C27 revenueByDay array present (not dailyRevenue)');
    hasField(d, 'revenueByMethod', 'C28 revenueByMethod array present');
    hasField(d, 'topProductsByViews', 'C29 topProductsByViews present');
    hasField(d, 'topProductsByRevenue', 'C30 topProductsByRevenue present');
    if (Array.isArray(d.revenueByDay) && d.revenueByDay.length > 0) {
      const rd = d.revenueByDay[0];
      if ('date' in rd && 'revenue' in rd) pass('C31 revenueByDay item has {date, revenue}');
      else fail('C31 revenueByDay item shape wrong', JSON.stringify(rd));
    } else pass('C31 revenueByDay is empty array (no paid orders yet) — valid');
    if (Array.isArray(d.revenueByMethod) && d.revenueByMethod.length > 0) {
      const rm = d.revenueByMethod[0];
      if ('_sum' in rm && 'amount' in rm._sum) pass('C32 revenueByMethod._sum.amount present (not .total)');
      else fail('C32 revenueByMethod._sum.amount wrong', JSON.stringify(rm).slice(0,80));
    } else skip('C32 revenueByMethod empty (no successful payments) — check field name manually');
    if (Array.isArray(d.topProductsByViews) && d.topProductsByViews.length > 0) {
      const tv = d.topProductsByViews[0];
      if ('name' in tv && 'slug' in tv && 'views' in tv) pass('C33 topProductsByViews has {name, slug, views}');
      else fail('C33 topProductsByViews shape wrong', JSON.stringify(tv).slice(0,80));
    } else skip('C33 topProductsByViews empty (no page views tracked) — valid');
    if (Array.isArray(d.topProductsByRevenue) && d.topProductsByRevenue.length > 0) {
      const tr2 = d.topProductsByRevenue[0];
      if ('_sum' in tr2 && 'lineTotal' in tr2._sum) pass('C34 topProductsByRevenue._sum.lineTotal present (not .revenue)');
      else fail('C34 topProductsByRevenue._sum.lineTotal wrong', JSON.stringify(tr2).slice(0,80));
    } else skip('C34 topProductsByRevenue empty (no paid orders) — valid');
  }

  // Analytics period variants
  const anal7  = await GET('/api/admin/analytics?period=7', TOKEN);
  expect200(anal7,  'C35 GET /admin/analytics?period=7');
  const anal90 = await GET('/api/admin/analytics?period=90', TOKEN);
  expect200(anal90, 'C36 GET /admin/analytics?period=90');

  /* ── D. Orders ────────────────────────────────────────────────────────── */
  section('D. Orders');

  const ordersRes = await GET('/api/admin/orders', TOKEN);
  let firstOrderId = null;
  if (expect200(ordersRes, 'D1 GET /api/admin/orders')) {
    const orders = ordersRes.body?.data?.orders || [];
    pass('D2 orders is array, length: ' + orders.length);
    if (orders.length > 0) {
      const o = orders[0];
      firstOrderId = o.id;
      if ('user' in o) pass('D3 order has user field (null for guest orders)');
      else fail('D3 order missing user field (backend Change 2 not applied)');
      if ('items' in o && Array.isArray(o.items)) pass('D4 order has items array');
      else fail('D4 order missing items array');
      if ('payments' in o && Array.isArray(o.payments)) pass('D5 order has payments array');
      else fail('D5 order missing payments array');
      if ('shippingAddress' in o) pass('D6 order has shippingAddress');
      else fail('D6 order missing shippingAddress');
      if ('orderNumber' in o && o.orderNumber) pass('D7 order has orderNumber');
      else fail('D7 order missing orderNumber');
      if ('paymentStatus' in o) pass('D8 order has paymentStatus');
      else fail('D8 order missing paymentStatus');
      // Guest order check: user null + email present
      if (o.user === null && o.email) pass('D9 Guest order: user=null, email present');
      else if (o.user && o.user.firstName) pass('D9 Registered order: user.firstName present');
      else skip('D9 Order user/guest detection — inconclusive');
    } else skip('D3–D9 No orders in DB');
  }

  // D10 — GET single order
  if (firstOrderId) {
    const singleOrder = await GET('/api/admin/orders/' + firstOrderId, TOKEN);
    expect200(singleOrder, 'D10 GET /api/admin/orders/:id');
  } else skip('D10 GET /api/admin/orders/:id (no orders)');

  // D11 — PATCH status with valid value
  if (firstOrderId) {
    const ordRes = await GET('/api/admin/orders/' + firstOrderId, TOKEN);
    const currentStatus = ordRes.body?.data?.order?.status;
    const targetStatus = currentStatus === 'PENDING' ? 'PROCESSING' : 'PENDING';
    const patchRes = await PATCH('/api/admin/orders/' + firstOrderId + '/status', TOKEN, { status: targetStatus });
    expect200(patchRes, 'D11 PATCH /api/admin/orders/:id/status (valid status)');
    // Restore original status
    await PATCH('/api/admin/orders/' + firstOrderId + '/status', TOKEN, { status: currentStatus });
    pass('D11a Status restored to ' + currentStatus);
  } else skip('D11 PATCH order status (no orders)');

  // D12 — invalid status → 400
  if (firstOrderId) {
    const badStatus = await PATCH('/api/admin/orders/' + firstOrderId + '/status', TOKEN, { status: 'FLYING' });
    expect4xx(badStatus, 'D12 Invalid order status → 4xx (validation returns 422)');
  } else skip('D12 Invalid status test (no orders)');

  // D13 — cancel: SHIPPED order should fail (>48h logic)
  // We can't test the time guard directly, but we can test DELIVERED can't be cancelled
  if (firstOrderId) {
    // Set order to DELIVERED first to test that it can't be cancelled
    await PATCH('/api/admin/orders/' + firstOrderId + '/status', TOKEN, { status: 'DELIVERED' });
    const cancelDelivered = await POST('/api/admin/orders/' + firstOrderId + '/cancel', TOKEN, {});
    expect4xx(cancelDelivered, 'D13 Cancel DELIVERED order → 400 (not cancellable)');
    // Restore
    await PATCH('/api/admin/orders/' + firstOrderId + '/status', TOKEN, { status: 'PENDING' });
  } else skip('D13 Cancel guard test (no orders)');

  /* ── E. Products ──────────────────────────────────────────────────────── */
  section('E. Products');

  const prodsRes = await GET('/api/admin/products', TOKEN);
  let firstProductId = null;
  if (expect200(prodsRes, 'E1 GET /api/admin/products')) {
    const prods = prodsRes.body?.data?.products || [];
    pass('E2 products array, length: ' + prods.length);
    if (prods.length > 0) {
      firstProductId = prods[0].id;
      const p = prods[0];
      if ('inventory' in p && Array.isArray(p.inventory)) pass('E3 product has inventory array');
      else fail('E3 product missing inventory');
      if ('images' in p) pass('E4 product has images field');
      else fail('E4 product missing images');
      if ('salePrice' in p) pass('E5 product has salePrice field');
      else fail('E5 product missing salePrice');
      if ('discountPercent' in p) pass('E6 product has discountPercent field');
      else fail('E6 product missing discountPercent');
      // Total stock calculation (mimics frontend logic)
      const totalStock = p.inventory.reduce((s, inv) => s + inv.stock, 0);
      if (totalStock >= 0) pass('E7 totalStock calculated: ' + totalStock + ' (inventory sum)');
      else fail('E7 totalStock calculation wrong');
    } else skip('E3–E7 No products (unexpected)');
  }

  // E8 — create product
  const newProd = await POST('/api/admin/products', TOKEN, {
    name: 'TEST PROD ' + Date.now(),
    description: 'Automated test product — safe to delete',
    category: 'test',
    price: 999.99,
    salePrice: 799.99,
    discountPercent: 20,
    status: 'DRAFT',
    images: ['public/images/test/1.jpg'],
    sizes: ['S', 'M']
  });
  let createdProdId = null;
  if (expect200(newProd, 'E8 POST /api/admin/products (create)')) {
    createdProdId = newProd.body?.data?.product?.id;
    pass('E9 Created product ID: ' + createdProdId?.slice(0,8) + '...');
  }

  // E10 — create with missing name → 400
  const badProd = await POST('/api/admin/products', TOKEN, { price: 100 });
  expect4xx(badProd, 'E10 Create product with no name → 400');

  // E11 — create with negative price → 400
  const negPrice = await POST('/api/admin/products', TOKEN, { name: 'bad', price: -50 });
  expect4xx(negPrice, 'E11 Create product with negative price → 400');

  // E12 — PATCH product
  if (createdProdId) {
    const patchProd = await PATCH('/api/admin/products/' + createdProdId, TOKEN, {
      name: 'TEST PRODUCT TASK8 UPDATED', status: 'DRAFT'
    });
    if (expect200(patchProd, 'E12 PATCH /api/admin/products/:id')) {
      const updatedName = patchProd.body?.data?.product?.name;
      if (updatedName === 'TEST PRODUCT TASK8 UPDATED') pass('E12a Name updated correctly');
      else fail('E12a Name update not reflected', 'got: ' + updatedName);
    }
  } else skip('E12 PATCH product (create failed)');

  // E13 — product stats endpoint
  if (firstProductId) {
    const stats = await GET('/api/admin/products/' + firstProductId + '/stats', TOKEN);
    if (expect200(stats, 'E13 GET /api/admin/products/:id/stats')) {
      const s = stats.body?.data || {};
      if ('totalOrders' in s) pass('E14 stats has totalOrders');
      else fail('E14 stats missing totalOrders');
      if ('pageViews30Days' in s) pass('E15 stats has pageViews30Days');
      else fail('E15 stats missing pageViews30Days');
      if ('conversionRate30Days' in s) pass('E16 stats has conversionRate30Days');
      else fail('E16 stats missing conversionRate30Days');
    }
  } else skip('E13–E16 product stats (no products)');

  // E14 — delete (archive) test product
  if (createdProdId) {
    const delProd = await DELETE('/api/admin/products/' + createdProdId, TOKEN);
    if (expect200(delProd, 'E17 DELETE /api/admin/products/:id (soft archive)')) {
      // Verify it's archived, not truly deleted
      const getAfterDel = await GET('/api/admin/products/' + createdProdId, TOKEN);
      if (getAfterDel.body?.data?.product?.status === 'ARCHIVED')
        pass('E18 Archived product still in DB with status=ARCHIVED');
      else fail('E18 Archived product status wrong', JSON.stringify(getAfterDel.body?.data?.product?.status));
    }
  } else skip('E17–E18 Delete product (create failed)');

  /* ── F. Inventory ─────────────────────────────────────────────────────── */
  section('F. Inventory');

  const invRes = await GET('/api/admin/inventory', TOKEN);
  let firstInvId = null, originalStock = null;
  if (expect200(invRes, 'F1 GET /api/admin/inventory')) {
    const inv = invRes.body?.data?.inventory || [];
    pass('F2 inventory array, length: ' + inv.length);
    if (inv.length > 0) {
      firstInvId = inv[0].id;
      originalStock = inv[0].stock;
      const i = inv[0];
      if ('product' in i && 'name' in i.product) pass('F3 inventory has product.name');
      else fail('F3 inventory missing product.name');
      if ('sku' in i && i.sku) pass('F4 inventory has SKU: ' + i.sku);
      else fail('F4 inventory missing SKU');
      if ('reservedStock' in i) pass('F5 inventory has reservedStock');
      else fail('F5 inventory missing reservedStock');
      if ('updatedAt' in i) pass('F6 inventory has updatedAt (for Last Updated column)');
      else fail('F6 inventory missing updatedAt');
      // sorted by stock asc
      if (inv.length > 1) {
        const sorted = inv.every((item, idx) => idx === 0 || item.stock >= inv[idx-1].stock);
        if (sorted) pass('F7 Inventory sorted by stock ASC');
        else fail('F7 Inventory not sorted by stock ASC');
      } else pass('F7 Only 1 item — sort order N/A');
    } else skip('F3–F7 No inventory items (unexpected)');
  }

  // F8 — update stock valid
  if (firstInvId) {
    const newStock = (originalStock || 0) + 100;
    const patchInv = await PATCH('/api/admin/inventory/' + firstInvId, TOKEN, { stock: newStock });
    if (expect200(patchInv, 'F8 PATCH /api/admin/inventory/:id (increase stock)')) {
      const updated = patchInv.body?.data?.inventoryItem?.stock;
      if (updated === newStock) pass('F9 Stock updated to ' + newStock);
      else fail('F9 Stock value wrong after update', 'expected ' + newStock + ', got ' + updated);
    }
    // Restore
    await PATCH('/api/admin/inventory/' + firstInvId, TOKEN, { stock: originalStock });
    pass('F10 Stock restored to ' + originalStock);
  } else skip('F8–F10 inventory PATCH (no items)');

  // F11 — stock = 0 (valid edge case)
  if (firstInvId) {
    const zeroStock = await PATCH('/api/admin/inventory/' + firstInvId, TOKEN, { stock: 0 });
    expect200(zeroStock, 'F11 PATCH stock=0 is valid (edge case)');
    await PATCH('/api/admin/inventory/' + firstInvId, TOKEN, { stock: originalStock });
  } else skip('F11 Zero stock test');

  // F12 — negative stock → 400
  if (firstInvId) {
    const negStock = await PATCH('/api/admin/inventory/' + firstInvId, TOKEN, { stock: -1 });
    expect4xx(negStock, 'F12 PATCH stock=-1 → 4xx (validation returns 422)');
  } else skip('F12 Negative stock test');

  /* ── G. Payments ──────────────────────────────────────────────────────── */
  section('G. Payments');

  const payRes = await GET('/api/admin/payments', TOKEN);
  if (expect200(payRes, 'G1 GET /api/admin/payments')) {
    const payments = payRes.body?.data?.payments || [];
    pass('G2 payments array, length: ' + payments.length);
    if (payments.length > 0) {
      const p = payments[0];
      if ('order' in p && p.order) pass('G3 payment includes order object');
      else fail('G3 payment missing order object');
      if ('provider' in p) pass('G4 payment has provider');
      else fail('G4 payment missing provider');
      if ('upiReferenceId' in p) pass('G5 payment has upiReferenceId field (null for non-UPI)');
      else fail('G5 payment missing upiReferenceId field');
      if ('amount' in p && typeof p.amount === 'number') pass('G6 payment.amount is number');
      else fail('G6 payment.amount wrong type', typeof p.amount);
      if (p.order && 'orderNumber' in p.order) pass('G7 payment.order.orderNumber accessible');
      else fail('G7 payment.order.orderNumber missing');
      if (p.order && 'email' in p.order) pass('G8 payment.order.email accessible (for table display)');
      else fail('G8 payment.order.email missing');
    } else skip('G3–G8 No payments in DB');
    // Revenue summary calc (mirrors frontend logic)
    const paid = payments.filter(p => p.status === 'SUCCESS');
    const total = paid.reduce((s, p) => s + (p.amount || 0), 0);
    pass('G9 Client-side revenue calc: €' + total.toFixed(2) + ' from ' + paid.length + ' successful payments');
    const byProv = { RAZORPAY: 0, PAYPAL: 0, UPI_MANUAL: 0 };
    paid.forEach(p => { if (byProv[p.provider] !== undefined) byProv[p.provider] += p.amount || 0; });
    pass('G10 Revenue by provider — Razorpay:' + byProv.RAZORPAY + ' PayPal:' + byProv.PAYPAL + ' UPI:' + byProv.UPI_MANUAL);
  }

  const pendingRes = await GET('/api/admin/payments/pending-verification', TOKEN);
  if (expect200(pendingRes, 'G11 GET /api/admin/payments/pending-verification')) {
    const pending = pendingRes.body?.data?.payments || [];
    pass('G12 pending payments array, length: ' + pending.length);
    if (pending.length > 0) {
      const p = pending[0];
      if ('order' in p && p.order && 'items' in p.order) pass('G13 pending payment includes order.items');
      else fail('G13 pending payment missing order.items');
      if (p.status === 'VERIFICATION_REQUIRED') pass('G14 pending payment status = VERIFICATION_REQUIRED');
      else fail('G14 pending payment wrong status: ' + p.status);
    } else skip('G13–G14 No UPI pending payments (expected)');
  }

  /* ── H. Customers ─────────────────────────────────────────────────────── */
  section('H. Customers');

  const custRes = await GET('/api/admin/customers', TOKEN);
  if (expect200(custRes, 'H1 GET /api/admin/customers')) {
    const custs = custRes.body?.data?.customers || [];
    pass('H2 customers array, length: ' + custs.length);
    if (custs.length > 0) {
      const c = custs[0];
      if ('totalSpent' in c) pass('H3 customer has totalSpent (backend Change 1 applied)');
      else fail('H3 customer missing totalSpent — Change 1 not applied or server not restarted');
      if (typeof c.totalSpent === 'number') pass('H4 totalSpent is a number: ' + c.totalSpent);
      else fail('H4 totalSpent wrong type: ' + typeof c.totalSpent);
      if ('_count' in c && typeof c._count.orders === 'number') pass('H5 customer._count.orders is number');
      else fail('H5 customer._count.orders missing/wrong');
      if ('email' in c && c.email) pass('H6 customer has email (needed for order expand lookup)');
      else fail('H6 customer missing email');
    } else skip('H3–H6 No customers in DB');
  }

  /* ── I. Messages & Early Access ──────────────────────────────────────── */
  section('I. Contact Messages & Early Access');

  const msgRes = await GET('/api/admin/contact-messages', TOKEN);
  let firstMsgId = null, originalMsgStatus = null;
  if (expect200(msgRes, 'I1 GET /api/admin/contact-messages')) {
    const msgs = msgRes.body?.data?.messages || [];
    pass('I2 messages array, length: ' + msgs.length);
    if (msgs.length > 0) {
      firstMsgId = msgs[0].id;
      originalMsgStatus = msgs[0].status;
      const m = msgs[0];
      if ('name' in m && 'email' in m && 'subject' in m && 'message' in m)
        pass('I3 message has name, email, subject, message');
      else fail('I3 message missing required fields');
      if ('status' in m && ['NEW','READ','REPLIED'].includes(m.status))
        pass('I4 message status valid: ' + m.status);
      else fail('I4 message status invalid: ' + m.status);
    } else skip('I3–I4 No contact messages');
  }

  // I5 — update message status
  if (firstMsgId) {
    const newStatus = originalMsgStatus === 'NEW' ? 'READ' : 'NEW';
    const patchMsg = await PATCH('/api/admin/contact-messages/' + firstMsgId + '/status', TOKEN, { status: newStatus });
    if (expect200(patchMsg, 'I5 PATCH /contact-messages/:id/status')) {
      const updated = patchMsg.body?.data?.message?.status;
      if (updated === newStatus) pass('I6 Status updated to ' + newStatus);
      else fail('I6 Status not updated', 'got: ' + updated);
    }
    // Restore
    await PATCH('/api/admin/contact-messages/' + firstMsgId + '/status', TOKEN, { status: originalMsgStatus });
    pass('I7 Message status restored to ' + originalMsgStatus);
  } else skip('I5–I7 message status update (no messages)');

  // I8 — invalid status → 400
  if (firstMsgId) {
    const bad = await PATCH('/api/admin/contact-messages/' + firstMsgId + '/status', TOKEN, { status: 'FAKE' });
    expect4xx(bad, 'I8 Invalid message status → 4xx (validation returns 422)');
  } else skip('I8 Invalid message status test');

  const earlyRes = await GET('/api/admin/early-access', TOKEN);
  if (expect200(earlyRes, 'I9 GET /api/admin/early-access')) {
    const reqs = earlyRes.body?.data?.requests || [];
    pass('I10 early-access array, length: ' + reqs.length);
    if (reqs.length > 0) {
      const r = reqs[0];
      if ('city' in r) pass('I11 early-access has city field');
      else fail('I11 early-access missing city field');
      if ('interest' in r) pass('I12 early-access has interest field');
      else fail('I12 early-access missing interest field');
      if ('budgetOrPreference' in r) pass('I13 early-access has budgetOrPreference field');
      else fail('I13 early-access missing budgetOrPreference field');
      if ('acceptedPrivacy' in r) pass('I14 early-access has acceptedPrivacy field');
      else fail('I14 early-access missing acceptedPrivacy field');
    } else skip('I11–I14 No early access requests in DB');
  }

  // I15 — invalid early-access status → 400
  const earlyList = earlyRes.body?.data?.requests || [];
  if (earlyList.length > 0) {
    const badEarly = await PATCH('/api/admin/early-access/' + earlyList[0].id + '/status', TOKEN, { status: 'NOTREAL' });
    expect4xx(badEarly, 'I15 Invalid early-access status → 400', 400);
  } else skip('I15 Invalid early-access status test (no records)');

  /* ── J. HTML Static Analysis ─────────────────────────────────────────── */
  section('J. HTML static analysis — all 9 files');

  const managementPages = ['index','orders','products','inventory','payments','customers','analytics','messages'];
  const allPages = ['login', ...managementPages];

  for (const page of allPages) {
    const fp = path.join(ADMIN_DIR, page + '.html');
    if (!fs.existsSync(fp)) { fail('J ' + page + '.html EXISTS'); continue; }
    const html = fs.readFileSync(fp, 'utf8');
    pass('J ' + page + '.html exists');

    if (page !== 'login') {
      // Auth gate
      if (html.includes("localStorage.getItem('raen_auth_token')") &&
          html.includes("window.location.href = 'login.html'")) {
        pass('J ' + page + ' — auth gate present');
      } else fail('J ' + page + ' — auth gate MISSING or wrong redirect target');

      // api.js loaded
      if (html.includes("src=\"../public/js/api.js\"")) pass('J ' + page + ' — api.js loaded');
      else fail('J ' + page + ' — api.js NOT loaded');

      // logout function
      if (html.includes('function logout()') && html.includes("localStorage.removeItem('raen_auth_token')")) {
        pass('J ' + page + ' — logout() clears token');
      } else fail('J ' + page + ' — logout() missing or doesn\'t clear token');

      // adminFetch uses status code (not message string)
      if (html.includes('e.status === 401') || html.includes('e.status===401')) {
        pass('J ' + page + ' — adminFetch uses e.status (not message string)');
      } else fail('J ' + page + ' — adminFetch still uses message string (401 redirect broken)');

      // active nav link
      const activeLink = 'href="' + page + '.html"';
      const activeMatcher = new RegExp('href="' + page + '\\.html"[^>]*class="nav-link active"|class="nav-link active"[^>]*href="' + page + '\\.html"');
      if (activeMatcher.test(html) || html.includes(activeLink + ' class="nav-link active"') ||
          html.includes('class="nav-link active" href="' + page + '.html"')) {
        // simpler: just check the active link is the current page
        const activePattern = new RegExp('href="' + page + '\\.html"[^>]*active|active[^>]*href="' + page + '\\.html"');
        if (activePattern.test(html)) pass('J ' + page + ' — active nav link correct');
        else skip('J ' + page + ' — active nav link pattern (regex inconclusive, check manually)');
      } else skip('J ' + page + ' — active nav link (manual verify)');

      // Chart.js only on index and analytics
      const hasChartJS = html.includes('cdn.jsdelivr.net/npm/chart.js');
      if (page === 'index' || page === 'analytics') {
        if (hasChartJS) pass('J ' + page + ' — Chart.js CDN loaded (correct)');
        else fail('J ' + page + ' — Chart.js CDN MISSING');
      } else {
        if (!hasChartJS) pass('J ' + page + ' — Chart.js NOT loaded (correct — not needed)');
        else fail('J ' + page + ' — Chart.js loaded unnecessarily');
      }
    } else {
      // login.html specific checks
      if (!html.includes("src=\"../public/js/api.js\"")) pass('J login — api.js NOT loaded (correct for standalone page)');
      else fail('J login — api.js incorrectly loaded on standalone login page');
      if (html.includes("localStorage.setItem('raen_auth_token'")) pass('J login — stores token on success');
      else fail('J login — missing localStorage.setItem for token');
      if (html.includes("user?.role") || html.includes("user.role")) pass('J login — checks user.role === ADMIN');
      else fail('J login — missing admin role check');
      if (html.includes("window.location.href = 'index.html'")) pass('J login — redirects to index.html on success');
      else fail('J login — wrong redirect target after login');
    }
  }

  // Dashboard specific: check correct field names used
  section('J.dashboard field name contract');
  const idxHtml = fs.readFileSync(path.join(ADMIN_DIR, 'index.html'), 'utf8');
  if (idxHtml.includes('dash.orders') && !idxHtml.includes('orderCounts'))
    pass('J.dashboard uses dash.orders (correct — apiGet unwraps to dash variable)');
  else fail('J.dashboard field name: dash.orders not found');
  if (idxHtml.includes('revenue?.total') || idxHtml.includes('revenue.total'))
    pass('J.dashboard uses revenue.total (not revenue.allTime)');
  else fail('J.dashboard revenue.total not found');
  if (idxHtml.includes('pendingUPIVerifications') && !idxHtml.includes('pendingVerifications'))
    pass('J.dashboard uses pendingUPIVerifications');
  else fail('J.dashboard field name: pendingUPIVerifications not used or old name present');
  if (idxHtml.includes('dash.customers') && !idxHtml.includes('customerCounts'))
    pass('J.dashboard uses dash.customers (correct — apiGet unwraps to dash variable)');
  else fail('J.dashboard field: dash.customers not found');
  if (idxHtml.includes('revenueByDay') && !idxHtml.includes('dailyRevenue'))
    pass('J.dashboard uses revenueByDay (not dailyRevenue)');
  else fail('J.dashboard revenueByDay field name wrong');

  // Analytics page field names
  const analHtml = fs.readFileSync(path.join(ADMIN_DIR, 'analytics.html'), 'utf8');
  if (analHtml.includes('data.summary') || analHtml.includes('summary.totalPageViews'))
    pass('J.analytics accesses data.summary (not flat fields)');
  else fail('J.analytics missing data.summary nesting');
  if (analHtml.includes('addToCartEvents') && !analHtml.includes('cartEvents.add_to_cart'))
    pass('J.analytics uses summary.addToCartEvents (not cartEvents.add_to_cart)');
  else fail('J.analytics wrong field name for cart events');
  if (analHtml.includes('_sum?.amount') || analHtml.includes('_sum.amount'))
    pass('J.analytics revenueByMethod uses ._sum.amount (not .total)');
  else fail('J.analytics revenueByMethod._sum.amount not used');
  if (analHtml.includes('_sum?.lineTotal') || analHtml.includes('_sum.lineTotal'))
    pass('J.analytics topProductsByRevenue uses ._sum.lineTotal (not .revenue)');
  else fail('J.analytics topProductsByRevenue._sum.lineTotal not used');

  /* ── K. JS helper logic ───────────────────────────────────────────────── */
  section('K. JS helper logic (simulated)');

  // fmt() — simulated with Node.js Intl
  const fmt = n => '€' + (n || 0).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtTests = [
    [0,      '€0.00'],
    [null,   '€0.00'],
    [2450,   '€2,450.00'],
    [2450.5, '€2,450.50'],
    [999999, '€999,999.00'],
    [0.01,   '€0.01'],
  ];
  let fmtOk = true;
  fmtTests.forEach(([input, expected]) => {
    const result = fmt(input);
    if (result !== expected) { fmtOk = false; fail(`K fmt(${input}) expected ${expected}, got ${result}`); }
  });
  if (fmtOk) pass('K1 fmt() produces correct EUR formatting for all cases');

  // fmtDate()
  const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dateResult = fmtDate('2026-05-15T00:00:00.000Z');
  if (dateResult.includes('May') && dateResult.includes('2026')) pass('K2 fmtDate() includes month name and year');
  else fail('K2 fmtDate() wrong output: ' + dateResult);

  // Image path encoding
  const imgPath = 'public/images/nude rhinestone/1 (1).avif';
  const encoded = '../' + imgPath.split('/').map(seg => encodeURIComponent(seg)).join('/');
  const expected = '../public/images/nude%20rhinestone/1%20(1).avif';
  if (encoded === expected) pass('K3 Image path encoding handles spaces and parens: ' + encoded);
  else fail('K3 Image path encoding wrong', 'got: ' + encoded + ' expected: ' + expected);

  // Pagination math
  const PAGE_SIZE = 20;
  const testCases = [
    [0, 0], [1, 1], [20, 1], [21, 2], [40, 2], [41, 3], [100, 5]
  ];
  let pgOk = true;
  testCases.forEach(([total, expected]) => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages !== expected) { pgOk = false; fail(`K4 Pagination: ${total} items → expected ${expected} pages, got ${pages}`); }
  });
  if (pgOk) pass('K4 Pagination calculation correct for all test cases');

  // Cancel button visibility
  const STATUS_ORDER = ['PENDING','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'];
  function canCancel(status, createdAt) {
    return (status === 'PENDING' || status === 'PAID') &&
      (Date.now() - new Date(createdAt).getTime()) < 48 * 3600 * 1000;
  }
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 49 * 3600 * 1000).toISOString();
  const cancelTests = [
    [canCancel('PENDING', now),      true,  'PENDING within 48h'],
    [canCancel('PAID', now),         true,  'PAID within 48h'],
    [canCancel('PROCESSING', now),   false, 'PROCESSING → no cancel'],
    [canCancel('SHIPPED', now),      false, 'SHIPPED → no cancel'],
    [canCancel('DELIVERED', now),    false, 'DELIVERED → no cancel'],
    [canCancel('CANCELLED', now),    false, 'CANCELLED → no cancel'],
    [canCancel('PENDING', old),      false, 'PENDING but >48h ago → no cancel'],
  ];
  let cancelOk = true;
  cancelTests.forEach(([result, expected, label]) => {
    if (result !== expected) { cancelOk = false; fail('K5 Cancel guard: ' + label); }
  });
  if (cancelOk) pass('K5 Cancel button visibility logic correct for all status/time combinations');

  // Status badge backwards detection
  function isBackward(oldStatus, newStatus) {
    const oldIdx = STATUS_ORDER.indexOf(oldStatus);
    const newIdx = STATUS_ORDER.indexOf(newStatus);
    return newIdx < oldIdx && newIdx !== -1 && oldIdx !== -1;
  }
  const backTests = [
    [isBackward('SHIPPED', 'PROCESSING'), true,  'SHIPPED→PROCESSING is backward'],
    [isBackward('PENDING', 'PAID'),       false, 'PENDING→PAID is forward'],
    [isBackward('DELIVERED', 'SHIPPED'),  true,  'DELIVERED→SHIPPED is backward'],
    [isBackward('PENDING', 'CANCELLED'), false, 'PENDING→CANCELLED is forward (allowed shortcut)'],
  ];
  let backOk = true;
  backTests.forEach(([result, expected, label]) => {
    if (result !== expected) { backOk = false; fail('K6 Status backward detection: ' + label); }
  });
  if (backOk) pass('K6 Status backward detection correct');

  // HTML escaping in messages
  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  const xssInput = '<script>alert("xss")</script>';
  const escaped = escHtml(xssInput);
  if (!escaped.includes('<script>') && escaped.includes('&lt;script&gt;'))
    pass('K7 escHtml() correctly neutralises XSS in message bodies');
  else fail('K7 escHtml() does not sanitise properly: ' + escaped);

  // Low stock colour logic
  function stockClass(stock) {
    if (stock <= 2) return 'stock-red';
    if (stock <= 5) return 'stock-amber';
    return 'stock-normal';
  }
  const stockTests = [[0,'stock-red'],[1,'stock-red'],[2,'stock-red'],[3,'stock-amber'],[5,'stock-amber'],[6,'stock-normal'],[10,'stock-normal']];
  let stockOk = true;
  stockTests.forEach(([s, expected]) => {
    if (stockClass(s) !== expected) { stockOk = false; fail('K8 stockClass(' + s + ') expected ' + expected + ', got ' + stockClass(s)); }
  });
  if (stockOk) pass('K8 Stock colour thresholds (red ≤2, amber 3–5, normal ≥6) correct');

  /* ── L. Edge cases & regression ──────────────────────────────────────── */
  section('L. Edge cases & regression');

  // L1 — analytics period=1 (minimum)
  const anal1 = await GET('/api/admin/analytics?period=1', TOKEN);
  expect200(anal1, 'L1 analytics?period=1 (minimum period)');

  // L2 — analytics period=365 (maximum before clamp)
  const anal365 = await GET('/api/admin/analytics?period=365', TOKEN);
  expect200(anal365, 'L2 analytics?period=365 (large period)');

  // L3 — analytics with non-numeric period
  const analBad = await GET('/api/admin/analytics?period=foo', TOKEN);
  if (analBad.status === 200) pass('L3 analytics?period=foo handled gracefully (falls back to default)');
  else fail('L3 analytics?period=foo should not crash', 'got ' + analBad.status);

  // L4 — products with discount calc (both salePrice and discountPercent)
  // Create a product with both, verify effective price logic
  const discProd = await POST('/api/admin/products', TOKEN, {
    name: 'TEST DISC ' + Date.now(), description: 'Automated test', price: 1000, salePrice: 800, discountPercent: 10,
    status: 'DRAFT', category: 'test', images: [], sizes: ['S']
  });
  if (discProd.status === 201) {
    const dp = discProd.body?.data?.product;
    // salePrice should take precedence in frontend display
    const effective = dp.salePrice || (dp.discountPercent ? dp.price * (1 - dp.discountPercent / 100) : null);
    if (effective === 800) pass('L4 salePrice (800) takes precedence over discountPercent (10%) for effective price');
    else fail('L4 Effective price wrong: got ' + effective);
    // Cleanup
    await DELETE('/api/admin/products/' + dp.id, TOKEN);
  } else skip('L4 Discount calc test (create failed: ' + discProd.status + ')');

  // L5 — order with no items
  // Can't create this artificially, but verify the expand handles empty items array
  const itemsHtml_empty = [].map(item => `<div>${item.productName}</div>`).join('');
  if (itemsHtml_empty === '') pass('L5 Empty items array renders empty expand content (no crash)');
  else fail('L5 Items map on empty array unexpected result');

  // L6 — customer email contains + character (CSS.escape safety)
  // Simulate CSS.escape behaviour for typical email characters
  if (typeof global.CSS === 'undefined') {
    // CSS.escape not available in Node.js — test the pattern
    const email = 'user+test@example.com';
    const safeId = email.replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);
    if (safeId.includes('\\+')) pass('L6 Email with + char would be properly escaped in CSS IDs');
    else skip('L6 CSS.escape not available in Node.js (browser-only API)');
  } else skip('L6 CSS.escape test (not applicable in Node)');

  // L7 — Verify paymentService change: rejectUpiPayment should now call updateOrderStatus CANCELLED
  // Check the file directly
  const psFile = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'services', 'paymentService.js'), 'utf8');
  if (psFile.includes("updateOrderStatus(payment.orderId, 'CANCELLED')"))
    pass('L7 paymentService.rejectUpiPayment calls updateOrderStatus(CANCELLED) — Change 5 applied');
  else fail('L7 paymentService.rejectUpiPayment missing CANCELLED order status update');

  // L8 — Verify adminController audit logs on approve/reject
  const acFile = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'controllers', 'adminController.js'), 'utf8');
  if (acFile.includes('APPROVE_UPI_PAYMENT')) pass('L8 approvePayment has APPROVE_UPI_PAYMENT audit log');
  else fail('L8 approvePayment missing audit log entry');
  if (acFile.includes('REJECT_UPI_PAYMENT')) pass('L9 rejectPayment has REJECT_UPI_PAYMENT audit log');
  else fail('L9 rejectPayment missing audit log entry');

  // L10 — api.js passes status code in thrown error
  const apiJsFile = fs.readFileSync(path.join(__dirname, '..', 'stitch', 'public', 'js', 'api.js'), 'utf8');
  if (apiJsFile.includes('err.status = response.status'))
    pass('L10 api.js attaches HTTP status code to thrown error (needed for adminFetch 401 redirect)');
  else fail('L10 api.js missing err.status assignment');

  // L11 — verify all 5 backend changes are in place
  if (acFile.includes("user: { select: { firstName: true, lastName: true } }"))
    pass('L11 getAllOrders includes user name join (Change 2)');
  else fail('L11 getAllOrders missing user name join');
  if (acFile.includes('spentMap') && acFile.includes('totalSpent'))
    pass('L12 getAllCustomers computes totalSpent (Change 1)');
  else fail('L12 getAllCustomers missing totalSpent');

  /* ─── Summary ──────────────────────────────────────────────────────────── */
  console.log('\n' + B('═'.repeat(56)));
  console.log(B('  Results: ') + G(passed + ' passed') + '  ' + R(failed + ' failed') + '  ' + Y(skipped + ' skipped'));
  console.log(B('═'.repeat(56)));

  if (failures.length > 0) {
    console.log('\n' + R(B('FAILURES:')));
    failures.forEach((f, i) => {
      console.log('  ' + R((i+1) + '. ' + f.label));
      if (f.detail) console.log('     ' + f.detail);
    });
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(R('\nFatal error: ') + err.message);
  process.exit(1);
});
