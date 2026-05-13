// Task 5 — Webhook test runner
// Run from anywhere: node task-reports/test-webhook.js
// Assumes: backend running on port 5000, seed-webhook-test.js already run

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');

require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND, '.env') });
const { PrismaClient } = require(path.join(BACKEND, 'node_modules', '@prisma', 'client'));

const crypto = require('crypto');
const http = require('http');
const prisma = new PrismaClient();

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const RAZORPAY_ORDER_ID = 'order_TEST12345678';
const RAZORPAY_PAYMENT_ID = 'pay_TEST' + Date.now();

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        ...headers,
        'Content-Length': bodyBuf ? bodyBuf.length : 0
      }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ statusCode: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function buildCapturedEvent(razorpayOrderId, razorpayPaymentId) {
  return JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: razorpayPaymentId,
          order_id: razorpayOrderId,
          amount: 10000,
          currency: 'INR',
          status: 'captured'
        }
      }
    }
  });
}

function sign(body) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function pass(msg) { console.log('    ✓', msg); }
function fail(msg) { console.log('    ✗', msg); }
function info(msg) { console.log('    ~', msg); }

// ── test suite ────────────────────────────────────────────────────────────────

async function runTests() {
  let allPassed = true;

  console.log('\n════════════════════════════════════════════════');
  console.log('  Task 5 — Payment Webhook Test Suite');
  console.log('════════════════════════════════════════════════\n');

  // ── TEST 0: Health check ──────────────────────────────────────────────────
  console.log('[0] Health check');
  try {
    const res = await makeRequest('GET', '/health', null, {});
    if (res.body?.status === 'ok') pass('Backend running on port 5000');
    else { fail('Backend not running — start it first: cd backend && node src/server.js'); process.exit(1); }
  } catch {
    fail('Cannot connect to localhost:5000 — start backend first'); process.exit(1);
  }

  // ── TEST 1: Pre-conditions ────────────────────────────────────────────────
  console.log('\n[1] Pre-conditions');
  const testOrder = await prisma.order.findFirst({ where: { orderNumber: 'TEST-WEBHOOK-001' } });
  if (!testOrder) {
    fail('Test order not found — run: node task-reports/seed-webhook-test.js');
    await prisma.$disconnect(); process.exit(1);
  }
  pass(`Test order found: id=${testOrder.id}, status=${testOrder.status}, paymentStatus=${testOrder.paymentStatus}`);

  const testPayment = await prisma.payment.findFirst({ where: { providerOrderId: RAZORPAY_ORDER_ID } });
  if (testPayment) pass(`Test payment found: id=${testPayment.id}, status=${testPayment.status}`);
  else { fail('Test payment not found'); allPassed = false; }

  const preInv = await prisma.inventory.findFirst({
    where: { product: { slug: 'bare-obsession' }, size: 'M' }
  });
  const preStock = preInv?.stock ?? null;
  info(`bare-obsession / M stock before tests: ${preStock}`);

  // ── TEST 2: Missing signature → 400 ──────────────────────────────────────
  console.log('\n[2] Missing signature → should return 400');
  const body1 = buildCapturedEvent(RAZORPAY_ORDER_ID, RAZORPAY_PAYMENT_ID);
  const res2 = await makeRequest('POST', '/api/payments/razorpay/webhook', body1, {
    'Content-Type': 'application/json'
  });
  if (res2.statusCode === 400) pass('No signature returns 400');
  else { fail(`Expected 400, got ${res2.statusCode}`); allPassed = false; }

  // ── TEST 3: Wrong signature → 400 ────────────────────────────────────────
  console.log('\n[3] Invalid signature → should return 400');
  const res3 = await makeRequest('POST', '/api/payments/razorpay/webhook', body1, {
    'Content-Type': 'application/json',
    'x-razorpay-signature': 'deadbeefdeadbeefdeadbeefdeadbeef'
  });
  if (res3.statusCode === 400) pass('Invalid signature returns 400');
  else { fail(`Expected 400, got ${res3.statusCode}`); allPassed = false; }

  const orderAfterBad = await prisma.order.findFirst({ where: { orderNumber: 'TEST-WEBHOOK-001' } });
  if (orderAfterBad.status === 'PENDING' && orderAfterBad.paymentStatus === 'UNPAID') {
    pass('DB unchanged after rejected webhooks');
  } else {
    fail(`DB changed after invalid signature: status=${orderAfterBad.status}`); allPassed = false;
  }

  // ── TEST 4: Valid payment.captured → 200 + DB updates ────────────────────
  console.log('\n[4] Valid payment.captured webhook → should return 200 and update DB');
  const body4 = buildCapturedEvent(RAZORPAY_ORDER_ID, RAZORPAY_PAYMENT_ID);
  const sig4 = sign(body4);
  const res4 = await makeRequest('POST', '/api/payments/razorpay/webhook', body4, {
    'Content-Type': 'application/json',
    'x-razorpay-signature': sig4
  });

  if (res4.statusCode === 200 && res4.body?.received === true) {
    pass('Returns 200 { received: true }');
  } else {
    fail(`Expected 200 {received:true}, got ${res4.statusCode} ${JSON.stringify(res4.body)}`);
    allPassed = false;
  }

  await new Promise(r => setTimeout(r, 800));

  const order4 = await prisma.order.findFirst({ where: { orderNumber: 'TEST-WEBHOOK-001' } });
  const payment4 = await prisma.payment.findFirst({ where: { providerOrderId: RAZORPAY_ORDER_ID } });
  const postInv = await prisma.inventory.findFirst({
    where: { product: { slug: 'bare-obsession' }, size: 'M' }
  });

  console.log('\n    [DB Verification]');
  if (order4?.status === 'PAID') pass('Order.status = PAID');
  else { fail(`Order.status = ${order4?.status}`); allPassed = false; }

  if (order4?.paymentStatus === 'PAID') pass('Order.paymentStatus = PAID');
  else { fail(`Order.paymentStatus = ${order4?.paymentStatus}`); allPassed = false; }

  if (payment4?.status === 'SUCCESS') pass('Payment.status = SUCCESS');
  else { fail(`Payment.status = ${payment4?.status}`); allPassed = false; }

  if (payment4?.providerPaymentId === RAZORPAY_PAYMENT_ID) {
    pass(`Payment.providerPaymentId = ${payment4.providerPaymentId}`);
  } else {
    fail(`Payment.providerPaymentId mismatch: ${payment4?.providerPaymentId}`); allPassed = false;
  }

  if (preStock !== null && postInv !== null) {
    if (postInv.stock === preStock - 1) {
      pass(`Inventory decremented: ${preStock} → ${postInv.stock}`);
    } else {
      fail(`Inventory not decremented: pre=${preStock}, post=${postInv.stock}`); allPassed = false;
    }
  } else {
    info('Inventory check skipped (record not found)');
  }

  const audit = await prisma.adminAuditLog.findFirst({
    where: { action: 'PAYMENT_CONFIRMED', entityType: 'Payment', entityId: payment4?.id }
  });
  if (audit) pass(`AdminAuditLog entry created: id=${audit.id}`);
  else info('AdminAuditLog not created (no ADMIN user in DB — expected with placeholder env)');

  // ── TEST 5: Replay (idempotency) → 200, no duplicate DB change ───────────
  console.log('\n[5] Replay same orderId → should return 200 without crashing');
  const stockBeforeReplay = (await prisma.inventory.findFirst({
    where: { product: { slug: 'bare-obsession' }, size: 'M' }
  }))?.stock;

  const replayBody = buildCapturedEvent(RAZORPAY_ORDER_ID, RAZORPAY_PAYMENT_ID + '_replay');
  const replaySig = sign(replayBody);
  const res5 = await makeRequest('POST', '/api/payments/razorpay/webhook', replayBody, {
    'Content-Type': 'application/json',
    'x-razorpay-signature': replaySig
  });

  if (res5.statusCode === 200) pass('Replay returns 200 (no crash)');
  else { fail(`Replay returned ${res5.statusCode}`); allPassed = false; }

  await new Promise(r => setTimeout(r, 500));
  const stockAfterReplay = (await prisma.inventory.findFirst({
    where: { product: { slug: 'bare-obsession' }, size: 'M' }
  }))?.stock;

  if (stockAfterReplay === stockBeforeReplay) {
    pass('Inventory unchanged after replay (transaction rolled back)');
  } else {
    fail(`Inventory changed on replay: ${stockBeforeReplay} → ${stockAfterReplay}`); allPassed = false;
  }

  // ── TEST 6: Unknown event type → 200 no-op ───────────────────────────────
  console.log('\n[6] Unknown event type → should return 200 silently');
  const unknownBody = JSON.stringify({ event: 'order.paid', payload: {} });
  const res6 = await makeRequest('POST', '/api/payments/razorpay/webhook', unknownBody, {
    'Content-Type': 'application/json',
    'x-razorpay-signature': sign(unknownBody)
  });
  if (res6.statusCode === 200) pass('Unknown event type returns 200 (no-op)');
  else { fail(`Expected 200, got ${res6.statusCode}`); allPassed = false; }

  // ── TEST 7: PayPal webhook → 200 ─────────────────────────────────────────
  console.log('\n[7] PayPal PAYMENT.CAPTURE.COMPLETED → should return 200');
  const paypalBody = JSON.stringify({
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: 'CAPTURE_TEST_001',
      supplementary_data: { related_ids: { order_id: 'PAYPAL_ORDER_NONEXISTENT' } },
      amount: { value: '100.00', currency_code: 'EUR' }
    }
  });
  const res7 = await makeRequest('POST', '/api/payments/paypal/webhook', paypalBody, {
    'Content-Type': 'application/json'
  });
  if (res7.statusCode === 200) pass('PayPal webhook returns 200 (processing error caught internally)');
  else { fail(`Expected 200, got ${res7.statusCode}`); allPassed = false; }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log(allPassed ? '  ALL TESTS PASSED ✓' : '  SOME TESTS FAILED ✗');
  console.log('════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  prisma.$disconnect();
  process.exit(1);
});
