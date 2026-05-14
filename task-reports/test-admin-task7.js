// Task 7 — Professional test suite
// Run from backend/: cd backend && node ../task-reports/test-admin-task7.js

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND, '.env') });
const { PrismaClient } = require(path.join(BACKEND, 'node_modules', '@prisma', 'client'));
const http = require('http');
const prisma = new PrismaClient({ log: [] });

function req(method, urlPath, body, token) {
  return new Promise((resolve) => {
    const b = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 5000, path: urlPath, method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': b ? Buffer.byteLength(b) : 0,
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    };
    const r = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (b) r.write(b); r.end();
  });
}

let total = 0, passed = 0;
function check(label, ok) {
  total++;
  if (ok) { passed++; console.log('  ✓', label); }
  else { console.log('  ✗', label); process.exitCode = 1; }
}
function section(t) { console.log('\n[' + t + ']'); }

async function run() {
  let adminToken, customerToken, testProductId;
  // Unique slug per run so repeat runs never collide with soft-archived products
  const RUN_SLUG = 'pro-test-gown-' + Date.now();
  const RUN_NAME = 'Pro Test Gown ' + Date.now();

  // Pre-run cleanup — remove any leftover test products from previous runs
  await prisma.product.deleteMany({ where: { slug: { startsWith: 'pro-test-gown-' } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: 'TEST-CANCEL-' } } });

  // ── AUTH SETUP ────────────────────────────────────────────────────────────
  section('Auth setup');
  const loginRes = await req('POST', '/api/auth/login', { email: 'admin@raen.design', password: 'RaenAdmin2024!' });
  adminToken = loginRes.body?.data?.token;
  check('Admin login returns token', !!adminToken);

  // Always try register first, then login — extract token from whichever succeeds
  const CUST_EMAIL = 'testcustomer_task7@raen.design';
  const CUST_PASS  = 'Password123!';
  const regRes = await req('POST', '/api/auth/register', { firstName: 'Test', lastName: 'Customer', email: CUST_EMAIL, password: CUST_PASS });
  customerToken = regRes.body?.data?.token;
  if (!customerToken) {
    const lc = await req('POST', '/api/auth/login', { email: CUST_EMAIL, password: CUST_PASS });
    customerToken = lc.body?.data?.token || lc.body?.token;
  }
  check('Customer token obtained', !!customerToken);

  // ── AUTH PROTECTION ───────────────────────────────────────────────────────
  section('Auth / Authorization');
  const noTok = await req('GET', '/api/admin/dashboard-extended', null, null);
  check('No token → 401', noTok.status === 401);

  const badTok = await req('GET', '/api/admin/dashboard-extended', null, 'totallyinvalidtoken');
  check('Invalid token → 401', badTok.status === 401);

  const custTok = await req('GET', '/api/admin/dashboard-extended', null, customerToken);
  check('Customer token on admin route → 403', custTok.status === 403);

  // ── MANUAL CHECK 1: DASHBOARD-EXTENDED ───────────────────────────────────
  section('Manual Check 1 — GET /dashboard-extended');
  const dash = await req('GET', '/api/admin/dashboard-extended', null, adminToken);
  check('Returns 200', dash.status === 200);
  const d = dash.body?.data;
  check('Has revenue.today', d?.revenue?.today !== undefined);
  check('Has revenue.week', d?.revenue?.week !== undefined);
  check('Has revenue.month', d?.revenue?.month !== undefined);
  check('Has revenue.total', d?.revenue?.total !== undefined);
  check('Has orders.total', d?.orders?.total !== undefined);
  check('orders has all 4 sub-keys', ['pending', 'processing', 'shipped', 'delivered'].every(k => d?.orders?.[k] !== undefined));
  check('recentOrders is array (max 10)', Array.isArray(d?.recentOrders) && d.recentOrders.length <= 10);
  const sample = d?.recentOrders?.[0];
  check('recentOrders items are full arrays (no take:1)', !sample || Array.isArray(sample?.items));
  check('lowStockItems is array', Array.isArray(d?.lowStockItems));
  check('lowStockItems all have stock <= 5', d?.lowStockItems?.every(i => i.stock <= 5) !== false);
  check('Has customers.total and newThisMonth', d?.customers?.total !== undefined && d?.customers?.newThisMonth !== undefined);
  check('Has pendingUPIVerifications', d?.pendingUPIVerifications !== undefined);
  check('Has topProducts array', Array.isArray(d?.topProducts));

  // ── MANUAL CHECK 2: ANALYTICS STRUCTURE ──────────────────────────────────
  section('Manual Check 2 — GET /analytics?period=30');
  const an30 = await req('GET', '/api/admin/analytics?period=30', null, adminToken);
  check('Returns 200', an30.status === 200);
  const s = an30.body?.data?.summary;
  const expectedKeys = ['totalPageViews', 'uniqueSessions', 'productPageViews', 'addToCartEvents', 'checkoutStarted', 'checkoutCompleted', 'conversionRate', 'cartToCheckout'];
  check('Summary has exactly 8 keys', s && Object.keys(s).length === 8);
  check('All 8 summary keys present', expectedKeys.every(k => k in (s || {})));
  check('revenueByDay has 30 entries', an30.body?.data?.revenueByDay?.length === 30);
  check('topProductsByViews is array', Array.isArray(an30.body?.data?.topProductsByViews));
  check('topProductsByRevenue is array', Array.isArray(an30.body?.data?.topProductsByRevenue));
  check('revenueByMethod is array', Array.isArray(an30.body?.data?.revenueByMethod));

  // ── ANALYTICS: PERIOD CLAMPING ────────────────────────────────────────────
  section('Analytics — period clamping extremes');
  const an7 = await req('GET', '/api/admin/analytics?period=7', null, adminToken);
  check('period=7 → 7 revenueByDay entries', an7.body?.data?.revenueByDay?.length === 7);

  const an365 = await req('GET', '/api/admin/analytics?period=365', null, adminToken);
  check('period=365 → 365 entries (max)', an365.body?.data?.revenueByDay?.length === 365);

  const an366 = await req('GET', '/api/admin/analytics?period=366', null, adminToken);
  check('period=366 → clamped to 365', an366.body?.data?.revenueByDay?.length === 365);

  const an0 = await req('GET', '/api/admin/analytics?period=0', null, adminToken);
  check('period=0 → clamped to 1', an0.body?.data?.revenueByDay?.length === 1);

  const anNeg = await req('GET', '/api/admin/analytics?period=-99', null, adminToken);
  check('period=-99 → clamped to 1', anNeg.body?.data?.revenueByDay?.length === 1);

  const anNaN = await req('GET', '/api/admin/analytics?period=abc', null, adminToken);
  check('period=abc (NaN) → defaults to 30', anNaN.body?.data?.revenueByDay?.length === 30);

  const anFloat = await req('GET', '/api/admin/analytics?period=7.9', null, adminToken);
  check('period=7.9 (float) → parseInt → 7 entries', anFloat.body?.data?.revenueByDay?.length === 7);

  // ── PRODUCT CRUD: NORMAL FLOW ─────────────────────────────────────────────
  section('Product CRUD — normal flow');
  const p1 = await req('POST', '/api/admin/products', {
    name: RUN_NAME, category: 'gown', price: 3200,
    salePrice: 2800, discountPercent: 12, status: 'DRAFT',
    description: 'Extreme test product'
  }, adminToken);
  check('Create with all fields → 201', p1.status === 201);
  check('slug auto-generated from name', !!p1.body?.data?.product?.slug);
  check('salePrice stored correctly', p1.body?.data?.product?.salePrice === 2800);
  check('discountPercent stored correctly', p1.body?.data?.product?.discountPercent === 12);
  check('status is DRAFT as sent', p1.body?.data?.product?.status === 'DRAFT');
  testProductId = p1.body?.data?.product?.id;

  const invRows = await prisma.inventory.findMany({ where: { productId: testProductId } });
  check('4 inventory rows auto-created (XS/S/M/L)', invRows.length === 4);
  check('All rows have stock=10', invRows.every(r => r.stock === 10));
  check('SKUs are uppercased correctly', invRows.every(r => r.sku.endsWith('-' + r.size)));

  const pGet = await req('GET', '/api/admin/products/' + testProductId, null, adminToken);
  check('GET /products/:id → 200', pGet.status === 200);
  check('Response includes inventory array', Array.isArray(pGet.body?.data?.product?.inventory));

  const pStats = await req('GET', '/api/admin/products/' + testProductId + '/stats', null, adminToken);
  check('GET /products/:id/stats → 200', pStats.status === 200);
  check('Stats has totalOrders, totalRevenue, pageViews30Days', ['totalOrders', 'totalRevenue', 'pageViews30Days', 'cartAdds30Days', 'conversionRate30Days'].every(k => pStats.body?.data?.[k] !== undefined));

  const pPatch = await req('PATCH', '/api/admin/products/' + testProductId, { price: 3500, salePrice: 3000 }, adminToken);
  check('PATCH price and salePrice → 200', pPatch.status === 200);
  check('price updated to 3500', pPatch.body?.data?.product?.price === 3500);
  check('salePrice updated to 3000', pPatch.body?.data?.product?.salePrice === 3000);
  check('discountPercent unchanged at 12', pPatch.body?.data?.product?.discountPercent === 12);

  // ── PRODUCT CRUD: VALIDATION EXTREMES ────────────────────────────────────
  section('Product CRUD — validation extremes');
  const pNoName = await req('POST', '/api/admin/products', { price: 1000 }, adminToken);
  check('Missing name → 422', pNoName.status === 422);

  const pNoPrice = await req('POST', '/api/admin/products', { name: 'No Price' }, adminToken);
  check('Missing price → 422', pNoPrice.status === 422);

  const pNegPrice = await req('POST', '/api/admin/products', { name: 'Neg Price', price: -1 }, adminToken);
  check('price=-1 → 422', pNegPrice.status === 422);

  const pDisc0 = await req('PATCH', '/api/admin/products/' + testProductId, { discountPercent: 0 }, adminToken);
  check('discountPercent=0 → 200 (valid lower bound)', pDisc0.status === 200);

  const pDisc100 = await req('PATCH', '/api/admin/products/' + testProductId, { discountPercent: 100 }, adminToken);
  check('discountPercent=100 → 200 (valid upper bound)', pDisc100.status === 200);

  const pDisc101 = await req('PATCH', '/api/admin/products/' + testProductId, { discountPercent: 101 }, adminToken);
  check('discountPercent=101 → 422', pDisc101.status === 422);

  const pDiscNeg = await req('PATCH', '/api/admin/products/' + testProductId, { discountPercent: -1 }, adminToken);
  check('discountPercent=-1 → 422', pDiscNeg.status === 422);

  const pSale0 = await req('PATCH', '/api/admin/products/' + testProductId, { salePrice: 0 }, adminToken);
  check('salePrice=0 → 200, cleared to null', pSale0.status === 200 && pSale0.body?.data?.product?.salePrice === null);

  const pSaleNeg = await req('PATCH', '/api/admin/products/' + testProductId, { salePrice: -50 }, adminToken);
  check('salePrice=-50 → 422', pSaleNeg.status === 422);

  // ── PRODUCT CRUD: EDGE CASES ──────────────────────────────────────────────
  section('Product CRUD — edge cases');
  const pDup = await req('POST', '/api/admin/products', { name: RUN_NAME, price: 1000 }, adminToken);
  check('Duplicate slug → 400 (Prisma unique constraint)', pDup.status === 400);

  const p404 = await req('GET', '/api/admin/products/00000000-0000-0000-0000-000000000000', null, adminToken);
  check('GET non-existent product → 404', p404.status === 404);

  const pStats404 = await req('GET', '/api/admin/products/00000000-0000-0000-0000-000000000000/stats', null, adminToken);
  check('GET stats non-existent product → 404', pStats404.status === 404);

  const pRouteOrder = await req('GET', '/api/admin/products/' + testProductId + '/stats', null, adminToken);
  check('Route order correct: /stats not captured as /:id', pRouteOrder.body?.data?.totalOrders !== undefined);

  const pArchive = await req('DELETE', '/api/admin/products/' + testProductId, null, adminToken);
  check('DELETE → soft archive, 200', pArchive.status === 200);
  check("Message says 'archived' not 'deleted'", pArchive.body?.message === 'Product archived');

  const pPostArchive = await req('GET', '/api/admin/products/' + testProductId, null, adminToken);
  check('Product still accessible after archive', pPostArchive.status === 200);
  check('Status = ARCHIVED (not actually deleted)', pPostArchive.body?.data?.product?.status === 'ARCHIVED');

  const pArchiveAgain = await req('DELETE', '/api/admin/products/' + testProductId, null, adminToken);
  check('Archive already-archived → 200 (idempotent)', pArchiveAgain.status === 200);

  const auditCreate = await prisma.adminAuditLog.findFirst({ where: { action: 'CREATE_PRODUCT', entityId: testProductId } });
  check('AuditLog entry for CREATE_PRODUCT', !!auditCreate);
  const auditArchive = await prisma.adminAuditLog.findFirst({ where: { action: 'ARCHIVE_PRODUCT', entityId: testProductId } });
  check('AuditLog entry for ARCHIVE_PRODUCT', !!auditArchive);

  // ── CANCEL ORDER: NORMAL FLOW ─────────────────────────────────────────────
  section('cancelOrder — normal flow with inventory verification');
  const product = await prisma.product.findUnique({ where: { slug: 'bare-obsession' } });
  const preInvS = await prisma.inventory.findFirst({ where: { productId: product.id, size: 'S' } });

  const freshOrder = await prisma.order.create({
    data: {
      orderNumber: 'TEST-CANCEL-EXTREME-001',
      email: 'test@raen.design', phone: '+91-9999999999',
      status: 'PENDING', paymentStatus: 'UNPAID',
      subtotal: 200, tax: 0, shipping: 0, total: 200, currency: 'INR',
      shippingAddress: {},
      items: { create: [{ productId: product.id, productName: product.name, productSlug: product.slug, size: 'S', quantity: 2, unitPrice: 100, lineTotal: 200 }] }
    }
  });

  const cancelRes = await req('POST', '/api/admin/orders/' + freshOrder.id + '/cancel', null, adminToken);
  check('Cancel PENDING order → 200', cancelRes.status === 200);
  check("Response message correct", cancelRes.body?.message === 'Order cancelled and inventory restored');

  await new Promise(r => setTimeout(r, 600));
  const postInvS = await prisma.inventory.findFirst({ where: { productId: product.id, size: 'S' } });
  check('Inventory restored (+2)', postInvS?.stock === (preInvS?.stock || 0) + 2);

  const cancelledOrder = await prisma.order.findUnique({ where: { id: freshOrder.id } });
  check('Order.status = CANCELLED in DB', cancelledOrder?.status === 'CANCELLED');
  check('Order.paymentStatus unchanged (UNPAID had no payment)', cancelledOrder?.paymentStatus === 'UNPAID');

  const auditCancel = await prisma.adminAuditLog.findFirst({ where: { action: 'CANCEL_ORDER', entityId: freshOrder.id } });
  check('AuditLog entry for CANCEL_ORDER', !!auditCancel);
  check('AuditLog metadata has previousStatus', auditCancel?.metadata?.previousStatus === 'PENDING');

  // ── CANCEL ORDER: GUARD RAILS ─────────────────────────────────────────────
  section('cancelOrder — guard rails');
  const cancelAgain = await req('POST', '/api/admin/orders/' + freshOrder.id + '/cancel', null, adminToken);
  check('Double cancel → 400', cancelAgain.status === 400);
  check('Error message mentions status', cancelAgain.body?.message?.includes('CANCELLED'));

  const oldOrder = await prisma.order.create({
    data: {
      orderNumber: 'TEST-CANCEL-OLD-001',
      email: 'test@raen.design', phone: '+91-9999999999',
      status: 'PENDING', paymentStatus: 'UNPAID',
      subtotal: 100, tax: 0, shipping: 0, total: 100, currency: 'INR',
      shippingAddress: {},
      createdAt: new Date(Date.now() - 49 * 3600000),
      items: { create: [{ productId: product.id, productName: product.name, productSlug: product.slug, size: 'L', quantity: 1, unitPrice: 100, lineTotal: 100 }] }
    }
  });
  const oldCancel = await req('POST', '/api/admin/orders/' + oldOrder.id + '/cancel', null, adminToken);
  check('Order > 48h old → 400', oldCancel.status === 400);
  check("Error mentions '48 hours'", oldCancel.body?.message?.includes('48'));

  const shippedOrder = await prisma.order.create({
    data: {
      orderNumber: 'TEST-CANCEL-SHIPPED-001',
      email: 'test@raen.design', phone: '+91-9999999999',
      status: 'SHIPPED', paymentStatus: 'PAID',
      subtotal: 100, tax: 0, shipping: 0, total: 100, currency: 'INR',
      shippingAddress: {},
      items: { create: [{ productId: product.id, productName: product.name, productSlug: product.slug, size: 'L', quantity: 1, unitPrice: 100, lineTotal: 100 }] }
    }
  });
  const shippedCancel = await req('POST', '/api/admin/orders/' + shippedOrder.id + '/cancel', null, adminToken);
  check('Cancel SHIPPED order → 400', shippedCancel.status === 400);

  const deliveredOrder = await prisma.order.create({
    data: {
      orderNumber: 'TEST-CANCEL-DELIVERED-001',
      email: 'test@raen.design', phone: '+91-9999999999',
      status: 'DELIVERED', paymentStatus: 'PAID',
      subtotal: 100, tax: 0, shipping: 0, total: 100, currency: 'INR',
      shippingAddress: {},
      items: { create: [{ productId: product.id, productName: product.name, productSlug: product.slug, size: 'L', quantity: 1, unitPrice: 100, lineTotal: 100 }] }
    }
  });
  const deliveredCancel = await req('POST', '/api/admin/orders/' + deliveredOrder.id + '/cancel', null, adminToken);
  check('Cancel DELIVERED order → 400', deliveredCancel.status === 400);

  const ghostCancel = await req('POST', '/api/admin/orders/00000000-0000-0000-0000-000000000000/cancel', null, adminToken);
  check('Cancel non-existent order → 404', ghostCancel.status === 404);

  // 47-hour order — still within window, should cancel
  const almostOldOrder = await prisma.order.create({
    data: {
      orderNumber: 'TEST-CANCEL-47H-001',
      email: 'test@raen.design', phone: '+91-9999999999',
      status: 'PENDING', paymentStatus: 'UNPAID',
      subtotal: 100, tax: 0, shipping: 0, total: 100, currency: 'INR',
      shippingAddress: {},
      createdAt: new Date(Date.now() - 47 * 3600000),
      items: { create: [{ productId: product.id, productName: product.name, productSlug: product.slug, size: 'XS', quantity: 1, unitPrice: 100, lineTotal: 100 }] }
    }
  });
  const almostOldCancel = await req('POST', '/api/admin/orders/' + almostOldOrder.id + '/cancel', null, adminToken);
  check('Order exactly 47h old → 200 (still within window)', almostOldCancel.status === 200);

  // ── CLEANUP ───────────────────────────────────────────────────────────────
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: 'TEST-CANCEL-' } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: 'pro-test-gown-' } } });

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log('  ' + passed + '/' + total + ' tests passed' + (passed === total ? '  ✓ ALL PASSED' : '  ✗ SOME FAILED'));
  console.log('════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

run().catch(e => { console.error('Fatal:', e.message); prisma.$disconnect(); process.exit(1); });
