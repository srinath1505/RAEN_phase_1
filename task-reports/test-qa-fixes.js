#!/usr/bin/env node
/**
 * task-reports/test-qa-fixes.js
 * Comprehensive QA test suite — all fixes: C1–C4, M1–M2, N1–N4, N5
 * Covers backend logic, static analysis, live API, edge cases, and regressions.
 *
 * Run: node task-reports/test-qa-fixes.js
 * Requires: backend running on port 5000
 */

'use strict';

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const BASE   = 'http://localhost:5000';
const ROOT   = path.join(__dirname, '..');

let passed = 0, failed = 0, skipped = 0;
const failures = [];
let currentSection = '';

// ── HTTP helper ──────────────────────────────────────────────────────────────
function req(method, url, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u       = new URL(url);
    const bodyStr = body != null ? JSON.stringify(body) : null;
    const opts    = {
      hostname : u.hostname,
      port     : parseInt(u.port) || 80,
      path     : u.pathname + u.search,
      method,
      headers  : {
        'Content-Type'   : 'application/json',
        ...extraHeaders,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: null, raw: d }); }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

// ── Test runner ──────────────────────────────────────────────────────────────
function section(name) {
  currentSection = name;
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`);
}

async function t(name, fn) {
  try {
    const result = await fn();
    if (result === 'SKIP') {
      console.log(`  ⊘  ${name}`);
      skipped++;
    } else if (result) {
      console.log(`  ✓  ${name}`);
      passed++;
    } else {
      console.log(`  ✗  ${name}`);
      failed++;
      failures.push(`[${currentSection}] ${name}`);
    }
  } catch (e) {
    console.log(`  ✗  ${name} — ${e.message}`);
    failed++;
    failures.push(`[${currentSection}] ${name} — ${e.message}`);
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────
function src(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function decodeJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

function getPrisma() {
  const { PrismaClient } = require(path.join(ROOT, 'backend/node_modules/@prisma/client'));
  return new PrismaClient({ log: [] });
}

// ── State shared across sections ─────────────────────────────────────────────
let adminToken     = null;
let customerToken  = null;
let transTestId    = null;   // order used for N1 transition tests
let termTestId     = null;   // order used for terminal-state tests
let custOwnedOrder = null;   // customer-owned order for N4 tests
let custUserId     = null;

// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  RAEN — QA Fixes Comprehensive Test Suite (C1–C4, M1–M2, N1–N4)');
  console.log('═══════════════════════════════════════════════════════════════════');

  // ── A: Health ─────────────────────────────────────────────────────────────
  section('A: Health & Server Startup');

  await t('A1: Health endpoint returns 200 and ok status', async () => {
    const r = await req('GET', `${BASE}/health`);
    return r.status === 200 && r.body?.status === 'ok';
  });

  // ── B: N3 — JWT self-contained ────────────────────────────────────────────
  section('B: N3 — JWT Self-Contained Token Payload');

  await t('B1: Admin login returns 200 with token', async () => {
    const r = await req('POST', `${BASE}/api/auth/login`, {
      email: 'admin@raen.design', password: 'RaenAdmin2024!'
    });
    if (r.status === 200 && r.body?.data?.token) {
      adminToken = r.body.data.token;
      return true;
    }
    return false;
  });

  await t('B2: Token payload has all 5 fields: id, email, firstName, lastName, role', async () => {
    if (!adminToken) return 'SKIP';
    const p = decodeJwt(adminToken);
    return !!(p.id && p.email && p.firstName && p.lastName && p.role);
  });

  await t('B3: Token payload does NOT contain legacy userId field', async () => {
    if (!adminToken) return 'SKIP';
    const p = decodeJwt(adminToken);
    return !p.userId;
  });

  await t('B4: Token role is ADMIN', async () => {
    if (!adminToken) return 'SKIP';
    return decodeJwt(adminToken).role === 'ADMIN';
  });

  await t('B5: /auth/me works with new token — response includes user fields', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/auth/me`, null, { Authorization: `Bearer ${adminToken}` });
    return r.status === 200 && r.body?.data?.user?.email === 'admin@raen.design';
  });

  await t('B6: /auth/me without token returns 401', async () => {
    const r = await req('GET', `${BASE}/api/auth/me`);
    return r.status === 401;
  });

  await t('B7: /auth/me with garbage token returns 401', async () => {
    const r = await req('GET', `${BASE}/api/auth/me`, null, { Authorization: 'Bearer garbage.token.here' });
    return r.status === 401;
  });

  await t('B8: Admin routes work with new token (adminMiddleware reads role from token)', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/orders`, null, { Authorization: `Bearer ${adminToken}` });
    return r.status === 200;
  });

  await t('B9: Customer register generates new-format token (has id, not userId)', async () => {
    const email = `qa_n3_${Date.now()}@test.com`;
    const r = await req('POST', `${BASE}/api/auth/register`, {
      firstName: 'QA', lastName: 'N3Test', email, password: 'QATest1234!'
    });
    if (r.status !== 201) return false;
    const token = r.body?.data?.token;
    if (!token) return false;
    customerToken = token;
    const p = decodeJwt(token);
    return !!(p.id && p.email && p.role === 'CUSTOMER' && !p.userId);
  });

  await t('B10: authMiddleware dual-path code — decoded.id and decoded.userId both handled', async () => {
    const code = src('backend/src/middleware/authMiddleware.js');
    return code.includes('decoded.id') && code.includes('decoded.userId') &&
           code.includes('Legacy token format');
  });

  await t('B11: authService.generateToken takes user object (not just id string)', async () => {
    const code = src('backend/src/services/authService.js');
    return code.includes('generateToken(user)') &&
           code.includes('id: user.id') && code.includes('role: user.role');
  });

  await t('B12: authController.googleAuth uses authService.generateToken (not direct jwt.sign)', async () => {
    const code = src('backend/src/controllers/authController.js');
    return !code.includes("jwt.sign({ userId: user.id }") &&
            code.includes('authService.generateToken');
  });

  // ── C: N1 — Status transition guard ──────────────────────────────────────
  section('C: N1 — Admin Order Status Transition Guard');

  // Create a fresh PENDING order for transition testing
  await t('C0: Setup — create fresh PENDING order for transition tests', async () => {
    try {
      const prisma = getPrisma();
      const order  = await prisma.order.create({
        data: {
          orderNumber  : `QA-N1-${Date.now()}`,
          email        : `qa_n1_${Date.now()}@test.com`,
          phone        : '+44123456789',
          status       : 'PENDING',
          paymentStatus: 'UNPAID',
          subtotal: 100, tax: 0, shipping: 0, total: 100, currency: 'EUR',
          shippingAddress: {}
        }
      });
      transTestId = order.id;
      await prisma.$disconnect();
      return true;
    } catch (e) { return false; }
  });

  const hdr  = () => ({ Authorization: `Bearer ${adminToken}` });
  const sUrl = id => `${BASE}/api/admin/orders/${id}/status`;

  await t('C1: PENDING → DELIVERED blocked — invalid jump (400)', async () => {
    if (!transTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(transTestId), { status: 'DELIVERED' }, hdr());
    return r.status === 400 && r.body?.message?.includes('Cannot move order from PENDING to DELIVERED');
  });

  await t('C2: PENDING → REFUNDED blocked (400)', async () => {
    if (!transTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(transTestId), { status: 'REFUNDED' }, hdr());
    return r.status === 400;
  });

  await t('C3: PENDING → PROCESSING allowed (200)', async () => {
    if (!transTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(transTestId), { status: 'PROCESSING' }, hdr());
    return r.status === 200 && r.body?.data?.order?.status === 'PROCESSING';
  });

  await t('C4: PROCESSING → PENDING blocked — backward move (400)', async () => {
    if (!transTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(transTestId), { status: 'PENDING' }, hdr());
    return r.status === 400 && r.body?.message?.includes('Cannot move order from PROCESSING to PENDING');
  });

  await t('C5: PROCESSING → SHIPPED allowed (200)', async () => {
    if (!transTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(transTestId), { status: 'SHIPPED' }, hdr());
    return r.status === 200 && r.body?.data?.order?.status === 'SHIPPED';
  });

  await t('C6: SHIPPED → CANCELLED allowed — N1 amendment for lost/customs/damage (200)', async () => {
    if (!transTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(transTestId), { status: 'CANCELLED' }, hdr());
    return r.status === 200 && r.body?.data?.order?.status === 'CANCELLED';
  });

  await t('C7: CANCELLED is terminal — CANCELLED → PROCESSING blocked (400)', async () => {
    if (!transTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(transTestId), { status: 'PROCESSING' }, hdr());
    return r.status === 400;
  });

  // Second order for DELIVERED terminal test
  await t('C8: Setup — second order for DELIVERED terminal test', async () => {
    try {
      const prisma = getPrisma();
      const order  = await prisma.order.create({
        data: {
          orderNumber  : `QA-N1B-${Date.now()}`,
          email        : `qa_n1b_${Date.now()}@test.com`,
          phone        : '+44123456789',
          status       : 'SHIPPED',
          paymentStatus: 'PAID',
          subtotal: 200, tax: 0, shipping: 0, total: 200, currency: 'EUR',
          shippingAddress: {}
        }
      });
      termTestId = order.id;
      await prisma.$disconnect();
      return true;
    } catch (e) { return false; }
  });

  await t('C9: SHIPPED → DELIVERED allowed (200)', async () => {
    if (!termTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(termTestId), { status: 'DELIVERED' }, hdr());
    return r.status === 200 && r.body?.data?.order?.status === 'DELIVERED';
  });

  await t('C10: DELIVERED is terminal — DELIVERED → SHIPPED blocked (400)', async () => {
    if (!termTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(termTestId), { status: 'SHIPPED' }, hdr());
    return r.status === 400;
  });

  await t('C11: DELIVERED → PENDING blocked (400)', async () => {
    if (!termTestId || !adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl(termTestId), { status: 'PENDING' }, hdr());
    return r.status === 400;
  });

  await t('C12: Non-existent order status update returns 404', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl('00000000-0000-0000-0000-000000000000'), { status: 'PROCESSING' }, hdr());
    return r.status === 404;
  });

  // ── D: C2 — PayPal webhook verification ──────────────────────────────────
  section('D: C2 — PayPal Webhook Signature Verification');

  await t('D1: .env has PAYPAL_WEBHOOK_ID key', async () => {
    return src('backend/.env').includes('PAYPAL_WEBHOOK_ID=');
  });

  await t('D2: PAYPAL_WEBHOOK_ID value is PAYPAL_WEBHOOK_ID_PLACEHOLDER', async () => {
    return src('backend/.env').includes('PAYPAL_WEBHOOK_ID=PAYPAL_WEBHOOK_ID_PLACEHOLDER');
  });

  await t('D3: env.js paypal block has webhookId field', async () => {
    const code = src('backend/src/config/env.js');
    return code.includes('webhookId: process.env.PAYPAL_WEBHOOK_ID');
  });

  await t('D4: paymentController.js defines verifyPaypalWebhookSignature function', async () => {
    const code = src('backend/src/controllers/paymentController.js');
    return code.includes('async function verifyPaypalWebhookSignature');
  });

  await t('D5: Verification calls PayPal /v1/notifications/verify-webhook-signature', async () => {
    return src('backend/src/controllers/paymentController.js').includes('verify-webhook-signature');
  });

  await t('D6: Verification step 1 gets access token from /v1/oauth2/token', async () => {
    return src('backend/src/controllers/paymentController.js').includes('/v1/oauth2/token');
  });

  await t('D7: Verification skipped when webhookId includes PLACEHOLDER (matches project pattern)', async () => {
    const code = src('backend/src/controllers/paymentController.js');
    return code.includes("includes('PLACEHOLDER')") && code.includes('verification skipped');
  });

  await t('D8: Verification failure returns 400 (not 200)', async () => {
    const code = src('backend/src/controllers/paymentController.js');
    return code.includes("res.status(400).json({ error: 'Webhook signature verification failed' })");
  });

  await t('D9: PayPal webhook live call with placeholder returns 200 (event processed)', async () => {
    const r = await req('POST', `${BASE}/api/payments/paypal/webhook`,
      { event_type: 'UNKNOWN', resource: {} });
    return r.status === 200;
  });

  await t('D10: Razorpay webhook with wrong signature still returns 400 (no regression)', async () => {
    // Must send raw body — use a plain fetch-style approach
    return new Promise(resolve => {
      const body = JSON.stringify({ test: true });
      const r = http.request({
        hostname: '127.0.0.1', port: 5000,
        path: '/api/payments/razorpay/webhook', method: 'POST',
        headers: {
          'Content-Type'           : 'application/octet-stream',
          'Content-Length'         : Buffer.byteLength(body),
          'x-razorpay-signature'   : 'wrongsig'
        }
      }, res => resolve(res.statusCode === 400));
      r.on('error', () => resolve(false));
      r.write(body);
      r.end();
    });
  });

  // ── E: C4 + M2 — Exchange rate helpers ────────────────────────────────────
  section('E: C4 & M2 — Live Exchange Rate Helpers');

  await t('E1: paymentService.js has getExchangeRate helper using Frankfurter API', async () => {
    const code = src('backend/src/services/paymentService.js');
    return code.includes('getExchangeRate') && code.includes('api.frankfurter.app');
  });

  await t('E2: createRazorpayPayment applies EUR→INR rate (order.total * inrRate)', async () => {
    const code = src('backend/src/services/paymentService.js');
    const method = code.slice(code.indexOf('async createRazorpayPayment'), code.indexOf('async verifyRazorpayPayment'));
    return method.includes("getExchangeRate('EUR', 'INR', 90)") && method.includes('inrAmount');
  });

  await t('E3: inrAmount passed to razorpayService.createOrder — not order.total directly', async () => {
    const code = src('backend/src/services/paymentService.js');
    const method = code.slice(code.indexOf('async createRazorpayPayment'), code.indexOf('async verifyRazorpayPayment'));
    return method.includes('razorpayService.createOrder(inrAmount') && !method.includes('razorpayService.createOrder(order.total');
  });

  await t('E4: getExchangeRate has 3-second timeout and fallback', async () => {
    const code = src('backend/src/services/paymentService.js');
    return code.includes('req.setTimeout(3000') && code.includes('req.destroy()') && code.includes('resolve(fallback)');
  });

  await t('E5: createPaypalPayment uses getExchangeRate(EUR, USD, 1.10) — not hardcoded * 1.1', async () => {
    const code = src('backend/src/services/paymentService.js');
    const method = code.slice(code.indexOf('async createPaypalPayment'), code.indexOf('async capturePaypalPayment'));
    return method.includes("getExchangeRate('EUR', 'USD', 1.10)") &&
           !method.includes('order.total * 1.1');
  });

  await t('E6: Live Frankfurter EUR→INR rate is numeric and > 50 (skipped if API rate-limited)', async () => {
    return new Promise(resolve => {
      const r = https.get('https://api.frankfurter.app/latest?from=EUR&to=INR', res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const rate = JSON.parse(d).rates?.INR;
            if (rate) { resolve(rate > 50); } else { resolve('SKIP'); }
          } catch { resolve('SKIP'); } // API returned HTML (rate-limited) — skip, not fail
        });
      });
      r.on('error', () => resolve('SKIP'));
      r.setTimeout(8000, () => { r.destroy(); resolve('SKIP'); });
    });
  });

  await t('E7: Live Frankfurter EUR→USD rate is numeric and between 0.8 and 2.0 (skipped if rate-limited)', async () => {
    return new Promise(resolve => {
      const r = https.get('https://api.frankfurter.app/latest?from=EUR&to=USD', res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const rate = JSON.parse(d).rates?.USD;
            if (rate) { resolve(rate > 0.8 && rate < 2.0); } else { resolve('SKIP'); }
          } catch { resolve('SKIP'); } // API returned HTML (rate-limited) — skip, not fail
        });
      });
      r.on('error', () => resolve('SKIP'));
      r.setTimeout(8000, () => { r.destroy(); resolve('SKIP'); });
    });
  });

  // ── F: M1 — Transaction wrapping ─────────────────────────────────────────
  section('F: M1 — Transaction Wrapping in verify/capture Paths');

  await t('F1: verifyRazorpayPayment wraps DB ops in prisma.$transaction', async () => {
    const code   = src('backend/src/services/paymentService.js');
    const start  = code.indexOf('async verifyRazorpayPayment');
    const end    = code.indexOf('async createPaypalPayment');
    return code.slice(start, end).includes('prisma.$transaction');
  });

  await t('F2: verifyRazorpayPayment — signature check is BEFORE (outside) the transaction', async () => {
    const code   = src('backend/src/services/paymentService.js');
    const start  = code.indexOf('async verifyRazorpayPayment');
    const txPos  = code.indexOf('prisma.$transaction', start);
    const sigPos = code.indexOf('verifySignature', start);
    return sigPos > 0 && txPos > 0 && sigPos < txPos;
  });

  await t('F3: verifyRazorpayPayment transaction updates payment, order, and inventory', async () => {
    const code   = src('backend/src/services/paymentService.js');
    const start  = code.indexOf('async verifyRazorpayPayment');
    const end    = code.indexOf('async createPaypalPayment');
    const method = code.slice(start, end);
    return method.includes("status: 'SUCCESS'") &&
           method.includes("paymentStatus: 'PAID'") &&
           method.includes('stock: { decrement: item.quantity }');
  });

  await t('F4: verifyRazorpayPayment — cart clear and email are OUTSIDE the transaction', async () => {
    const code   = src('backend/src/services/paymentService.js');
    const start  = code.indexOf('async verifyRazorpayPayment');
    const end    = code.indexOf('async createPaypalPayment');
    const method = code.slice(start, end);
    const txEnd  = method.lastIndexOf('});');
    const after  = method.slice(txEnd);
    return after.includes('clearCart') && after.includes('sendOrderConfirmation');
  });

  await t('F5: capturePaypalPayment wraps DB ops in prisma.$transaction', async () => {
    const code  = src('backend/src/services/paymentService.js');
    const start = code.indexOf('async capturePaypalPayment');
    const end   = code.indexOf('async createUpiPayment');
    return code.slice(start, end).includes('prisma.$transaction');
  });

  await t('F6: capturePaypalPayment — external PayPal capture call is BEFORE the transaction', async () => {
    const code     = src('backend/src/services/paymentService.js');
    const start    = code.indexOf('async capturePaypalPayment');
    const txPos    = code.indexOf('prisma.$transaction', start);
    const capturePos = code.indexOf('paypalService.captureOrder', start);
    return capturePos > 0 && txPos > 0 && capturePos < txPos;
  });

  // ── G: C1 — Gateway refund ────────────────────────────────────────────────
  section('G: C1 — Gateway Refund Implementation');

  await t('G1: razorpayService.refundPayment method exists', async () => {
    const code = src('backend/src/services/razorpayService.js');
    return code.includes('async refundPayment(providerPaymentId)');
  });

  await t('G2: razorpayService.refundPayment calls razorpay.payments.refund with full-refund (empty body)', async () => {
    const code = src('backend/src/services/razorpayService.js');
    return code.includes('razorpay.payments.refund(providerPaymentId, {})');
  });

  await t('G3: paypalService.refundPayment method exists', async () => {
    const code = src('backend/src/services/paypalService.js');
    return code.includes('async refundPayment(captureId)');
  });

  await t('G4: paypalService.refundPayment uses CapturesRefundRequest', async () => {
    const code = src('backend/src/services/paypalService.js');
    return code.includes('CapturesRefundRequest(captureId)');
  });

  await t('G5: adminController.js imports razorpayService and paypalService at module level (not inline)', async () => {
    const lines = src('backend/src/controllers/adminController.js').split('\n').slice(0, 12).join('\n');
    return lines.includes("require('../services/razorpayService')") &&
           lines.includes("require('../services/paypalService')");
  });

  await t('G6: cancelOrder (admin) no longer uses the broken && guard pattern', async () => {
    return !src('backend/src/controllers/adminController.js').includes('razorpayService.refundPayment &&');
  });

  await t('G7: cancelOrder (admin) calls Razorpay refund when provider is RAZORPAY', async () => {
    const code = src('backend/src/controllers/adminController.js');
    const fn   = code.slice(code.indexOf('exports.cancelOrder'));
    return fn.includes("payment.provider === 'RAZORPAY'") &&
           fn.includes('razorpayService.refundPayment(payment.providerPaymentId)');
  });

  await t('G8: cancelOrder (admin) calls PayPal refund when provider is PAYPAL', async () => {
    const code = src('backend/src/controllers/adminController.js');
    const fn   = code.slice(code.indexOf('exports.cancelOrder'));
    return fn.includes("payment.provider === 'PAYPAL'") &&
           fn.includes('paypalService.refundPayment(payment.providerPaymentId)');
  });

  await t('G9: cancelOrder (account) also calls Razorpay and PayPal refund non-blocking', async () => {
    const code = src('backend/src/controllers/accountController.js');
    return code.includes("payment.provider === 'RAZORPAY'") &&
           code.includes("payment.provider === 'PAYPAL'") &&
           code.includes('razorpayService.refundPayment') &&
           code.includes('paypalService.refundPayment');
  });

  await t('G10: refundPayment guarded by payment.status === SUCCESS (only refund successful payments)', async () => {
    const code = src('backend/src/controllers/adminController.js');
    const fn   = code.slice(code.indexOf('exports.cancelOrder'));
    return fn.includes("payment?.status === 'SUCCESS'");
  });

  // ── H: C3 — Cancellation email ────────────────────────────────────────────
  section('H: C3 — Cancellation Email');

  await t('H1: emailService.sendOrderCancellation method is defined', async () => {
    return src('backend/src/services/emailService.js').includes('async sendOrderCancellation(order)');
  });

  await t('H2: sendOrderCancellation sends to order.email with correct subject', async () => {
    const code = src('backend/src/services/emailService.js');
    const fn   = code.slice(code.indexOf('async sendOrderCancellation'));
    return fn.includes('Order Cancelled -') && fn.includes('order.orderNumber') && fn.includes('this.sendEmail(order.email');
  });

  await t('H3: sendOrderCancellation includes conditional refund note (only when REFUNDED)', async () => {
    const code = src('backend/src/services/emailService.js');
    const fn   = code.slice(code.indexOf('async sendOrderCancellation'));
    return fn.includes("paymentStatus === 'REFUNDED'") && fn.includes('full refund');
  });

  await t('H4: sendOrderCancellation is non-blocking in adminController.cancelOrder', async () => {
    const code = src('backend/src/controllers/adminController.js');
    return code.includes('emailService.sendOrderCancellation') && code.includes('.catch(err =>');
  });

  await t('H5: sendOrderCancellation is non-blocking in accountController.cancelOrder', async () => {
    const code = src('backend/src/controllers/accountController.js');
    return code.includes('emailService.sendOrderCancellation') && code.includes('.catch(err =>');
  });

  await t('H6: sendOrderCancellation called AFTER $transaction (outside the tx block)', async () => {
    const code  = src('backend/src/controllers/adminController.js');
    const fn    = code.slice(code.indexOf('exports.cancelOrder'), code.indexOf('exports.getDashboardExtended'));
    const txEnd = fn.lastIndexOf('});');
    const emailCall = fn.indexOf('emailService.sendOrderCancellation', txEnd);
    return emailCall > 0;
  });

  // ── I: N2 — Payment deduplication ────────────────────────────────────────
  section('I: N2 — Payment Record Deduplication');

  await t('I1: createRazorpayPayment checks for existing CREATED record before creating', async () => {
    const code   = src('backend/src/services/paymentService.js');
    const method = code.slice(code.indexOf('async createRazorpayPayment'), code.indexOf('async verifyRazorpayPayment'));
    return method.includes('findFirst') &&
           method.includes("provider: 'RAZORPAY'") &&
           method.includes("status: 'CREATED'");
  });

  await t('I2: createRazorpayPayment updates existingPayment.providerOrderId if found', async () => {
    const code   = src('backend/src/services/paymentService.js');
    const method = code.slice(code.indexOf('async createRazorpayPayment'), code.indexOf('async verifyRazorpayPayment'));
    return method.includes('existingPayment') && method.includes('providerOrderId: razorpayOrder.id');
  });

  await t('I3: createPaypalPayment checks for existing CREATED record before creating', async () => {
    const code   = src('backend/src/services/paymentService.js');
    const method = code.slice(code.indexOf('async createPaypalPayment'), code.indexOf('async capturePaypalPayment'));
    return method.includes('findFirst') &&
           method.includes("provider: 'PAYPAL'") &&
           method.includes("status: 'CREATED'");
  });

  await t('I4: createPaypalPayment updates existingPayment.providerOrderId if found', async () => {
    const code   = src('backend/src/services/paymentService.js');
    const method = code.slice(code.indexOf('async createPaypalPayment'), code.indexOf('async capturePaypalPayment'));
    return method.includes('existingPayment') && method.includes('providerOrderId: paypalOrder.id');
  });

  // ── J: N4 — Customer self-cancel ─────────────────────────────────────────
  section('J: N4 — Customer Self-Cancel Endpoint');

  await t('J1: POST /api/account/orders/:id/cancel route is registered', async () => {
    const code = src('backend/src/routes/accountRoutes.js');
    return code.includes("router.post('/orders/:id/cancel'") && code.includes('accountController.cancelOrder');
  });

  await t('J2: accountController exports cancelOrder', async () => {
    return src('backend/src/controllers/accountController.js').includes('exports.cancelOrder');
  });

  await t('J3: Cancel endpoint requires auth — 401 without token', async () => {
    const r = await req('POST', `${BASE}/api/account/orders/fake-id/cancel`, {});
    return r.status === 401;
  });

  await t('J4: Cancel returns 404 for order not belonging to this user', async () => {
    if (!customerToken) return 'SKIP';
    const r = await req('POST', `${BASE}/api/account/orders/00000000-0000-0000-0000-000000000000/cancel`,
      {}, { Authorization: `Bearer ${customerToken}` });
    return r.status === 404 && r.body?.message === 'Order not found';
  });

  await t('J5: cancelOrder uses findFirst with both id and userId (ownership check)', async () => {
    const code = src('backend/src/controllers/accountController.js');
    const fn   = code.slice(code.indexOf('exports.cancelOrder'));
    return fn.includes('findFirst') && (fn.includes('{ id, userId }') || fn.includes('id, userId: req.user.id'));
  });

  await t('J6: cancelOrder only allows PENDING/PAID/PROCESSING/SHIPPED statuses', async () => {
    const code = src('backend/src/controllers/accountController.js');
    const fn   = code.slice(code.indexOf('exports.cancelOrder'));
    return fn.includes("['PENDING', 'PAID', 'PROCESSING', 'SHIPPED'].includes(order.status)");
  });

  await t('J7: cancelOrder has 48-hour window guard', async () => {
    const code = src('backend/src/controllers/accountController.js');
    const fn   = code.slice(code.indexOf('exports.cancelOrder'));
    return fn.includes('hoursSinceOrder > 48');
  });

  await t('J8: cancelOrder wraps DB mutations in $transaction', async () => {
    const code = src('backend/src/controllers/accountController.js');
    const fn   = code.slice(code.indexOf('exports.cancelOrder'));
    return fn.includes('prisma.$transaction');
  });

  await t('J9: cancelOrder restores inventory (stock increment) inside transaction', async () => {
    const code = src('backend/src/controllers/accountController.js');
    const fn   = code.slice(code.indexOf('exports.cancelOrder'));
    return fn.includes('stock: { increment: item.quantity }');
  });

  await t('J10: cancelOrder logs CUSTOMER_CANCEL to AdminAuditLog for admin visibility', async () => {
    return src('backend/src/controllers/accountController.js').includes("action: 'CUSTOMER_CANCEL'");
  });

  // Live end-to-end test with a real customer-owned order
  await t('J11: Setup — create customer-owned PENDING order for live cancel test', async () => {
    try {
      const prisma = getPrisma();
      const user   = await prisma.user.findFirst({
        where: { role: 'CUSTOMER' }, orderBy: { createdAt: 'desc' }
      });
      if (!user) { await prisma.$disconnect(); return false; }
      custUserId = user.id;

      custOwnedOrder = await prisma.order.create({
        data: {
          orderNumber  : `QA-CUST-${Date.now()}`,
          email        : user.email,
          phone        : '+44123456789',
          userId       : user.id,
          status       : 'PENDING',
          paymentStatus: 'UNPAID',
          subtotal: 150, tax: 0, shipping: 0, total: 150, currency: 'EUR',
          shippingAddress: {}
        }
      });
      await prisma.$disconnect();
      return true;
    } catch (e) { return false; }
  });

  await t('J12: Admin token cannot cancel customer order — ownership check returns 404', async () => {
    // Admin userId ≠ order userId → findFirst returns null → 404
    if (!custOwnedOrder || !adminToken) return 'SKIP';
    const r = await req('POST',
      `${BASE}/api/account/orders/${custOwnedOrder.id}/cancel`, {}, hdr());
    return r.status === 404;
  });

  // ── K: Admin cancelOrder fixes — live API ──────────────────────────────────
  section('K: Admin Cancel Order Live — C1 + C3 + N1 Amendment');

  await t('K1: SHIPPED not in admin cancelOrder exclusion list (N1 amendment)', async () => {
    const code  = src('backend/src/controllers/adminController.js');
    const fn    = code.slice(code.indexOf('exports.cancelOrder'), code.indexOf('exports.getDashboardExtended'));
    const guard = fn.match(/\[['A-Z_, ]+\]\.includes\(order\.status\)/);
    return guard && !guard[0].includes('SHIPPED');
  });

  await t('K2: Admin cancel on DELIVERED order returns 400 (terminal)', async () => {
    if (!termTestId || !adminToken) return 'SKIP';
    const r = await req('POST', `${BASE}/api/admin/orders/${termTestId}/cancel`, {}, hdr());
    return r.status === 400;
  });

  await t('K3: Admin cancel respects 48-hour guard on old orders', async () => {
    if (!adminToken) return 'SKIP';
    try {
      const prisma = getPrisma();
      const old    = await prisma.order.create({
        data: {
          orderNumber  : `QA-OLD48-${Date.now()}`,
          email        : `qa_old48_${Date.now()}@test.com`,
          phone        : '+44123456789',
          status       : 'PENDING',
          paymentStatus: 'UNPAID',
          subtotal: 100, tax: 0, shipping: 0, total: 100, currency: 'EUR',
          shippingAddress: {},
          createdAt    : new Date(Date.now() - 73 * 3600000) // 73h ago
        }
      });
      await prisma.$disconnect();

      const r = await req('POST', `${BASE}/api/admin/orders/${old.id}/cancel`, {}, hdr());
      return r.status === 400 && r.body?.message?.includes('48 hours');
    } catch (e) { return false; }
  });

  await t('K4: Admin cancel non-existent order returns 404', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('POST', `${BASE}/api/admin/orders/00000000-0000-0000-0000-000000000000/cancel`, {}, hdr());
    return r.status === 404;
  });

  // ── L: Regression — existing features not broken ──────────────────────────
  section('L: Regression Checks — No Existing Features Broken');

  await t('L1: Admin token still grants access to admin routes', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/orders`, null, hdr());
    return r.status === 200;
  });

  await t('L2: Customer token blocked from admin routes (403)', async () => {
    if (!customerToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/orders`, null, { Authorization: `Bearer ${customerToken}` });
    return r.status === 403;
  });

  await t('L3: Wrong password still returns 401', async () => {
    const r = await req('POST', `${BASE}/api/auth/login`, {
      email: 'admin@raen.design', password: 'definitely-wrong'
    });
    return r.status === 401;
  });

  await t('L4: Products endpoint returns 12 ACTIVE products', async () => {
    const r = await req('GET', `${BASE}/api/products`);
    return r.status === 200 && Array.isArray(r.body?.data?.products) &&
           r.body.data.products.length === 12;
  });

  await t('L5: Admin dashboard-extended returns complete data shape', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/dashboard-extended`, null, hdr());
    const d = r.body?.data;
    return r.status === 200 && d?.orders && d?.revenue && d?.lowStockItems !== undefined;
  });

  await t('L6: Analytics endpoint returns summary, revenueByDay, topProductsByViews', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/analytics?period=30`, null, hdr());
    const d = r.body?.data;
    return r.status === 200 && d?.summary && Array.isArray(d?.revenueByDay) &&
           Array.isArray(d?.topProductsByViews);
  });

  await t('L7: Contact form POST still works', async () => {
    const r = await req('POST', `${BASE}/api/contact`, {
      name: 'QA Regression', email: 'qa@test.com',
      subject: 'QA Test', message: 'Regression test message from QA suite'
    });
    return r.status === 200 || r.status === 201;
  });

  await t('L8: Account profile requires auth (401 without token)', async () => {
    const r = await req('GET', `${BASE}/api/account/profile`);
    return r.status === 401;
  });

  await t('L9: Account orders requires auth (401 without token)', async () => {
    const r = await req('GET', `${BASE}/api/account/orders`);
    return r.status === 401;
  });

  await t('L10: Account profile returns 200 with valid customer token', async () => {
    if (!customerToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/account/profile`, null, { Authorization: `Bearer ${customerToken}` });
    return r.status === 200 && r.body?.data?.user?.email;
  });

  await t('L11: Admin inventory endpoint returns 200', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/inventory`, null, hdr());
    return r.status === 200;
  });

  await t('L12: OTP send-otp endpoint still responds correctly', async () => {
    const r = await req('POST', `${BASE}/api/auth/send-otp`, { phone: '+441234567890', channel: 'sms' });
    return r.status === 200;
  });

  await t('L13: Logout returns 200', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('POST', `${BASE}/api/auth/logout`, null, hdr());
    return r.status === 200;
  });

  await t('L14: Admin customers endpoint returns 200', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/customers`, null, hdr());
    return r.status === 200;
  });

  await t('L15: Admin payments endpoint returns 200', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/payments`, null, hdr());
    return r.status === 200;
  });

  // ── M: Frontend static analysis ───────────────────────────────────────────
  section('M: Frontend Static Analysis — account.html Cancel UI');

  await t('M1: account.html has cancelOrder async function', async () => {
    return src('stitch/account.html').includes('async function cancelOrder(orderId)');
  });

  await t('M2: cancelOrder calls apiPost to /account/orders/:id/cancel', async () => {
    const code = src('stitch/account.html');
    return code.includes("apiPost('/account/orders/' + orderId + '/cancel'");
  });

  await t('M3: Cancel button only rendered for PENDING/PAID/PROCESSING/SHIPPED', async () => {
    const code = src('stitch/account.html');
    return code.includes("['PENDING', 'PAID', 'PROCESSING', 'SHIPPED'].includes(order.status)");
  });

  await t('M4: Cancel button only shown within 48-hour window', async () => {
    const code = src('stitch/account.html');
    return code.includes('withinWindow') && code.includes('48 * 3600000');
  });

  await t('M5: Cancel button has a confirm dialog before proceeding', async () => {
    return src('stitch/account.html').includes("confirm('Cancel this order?");
  });

  await t('M6: cancelOrder calls loadOrders() to refresh the table after success', async () => {
    const code = src('stitch/account.html');
    const fn   = code.slice(code.indexOf('async function cancelOrder'));
    return fn.includes('await loadOrders()');
  });

  await t('M7: Orders table has a 6th Actions column header', async () => {
    return src('stitch/account.html').includes('<th style="padding:10px 16px;"></th>');
  });

  await t('M8: Cancel row cell is always rendered (empty when not cancellable)', async () => {
    const code = src('stitch/account.html');
    return code.includes("'<td style=\"padding:14px 16px;white-space:nowrap;\">' + cancelCell + '</td>'");
  });

  await t('M9: showToast used for success and error feedback in cancelOrder', async () => {
    const code = src('stitch/account.html');
    const fn   = code.slice(code.indexOf('async function cancelOrder'));
    return fn.includes("showToast(") && fn.includes("'success'") && fn.includes("'error'");
  });

  // ── N: Document updates (N5) ──────────────────────────────────────────────
  section('N: N5 — Document Update Verification');

  await t('N1: HANDOFF.md git log shows Task 11 as the most recent commit', async () => {
    const code = src('HANDOFF.md');
    return code.includes('feat(frontend): Task 11 complete');
  });

  await t('N2: HANDOFF.md QA section marks all Critical/Major findings as resolved', async () => {
    const code = src('HANDOFF.md');
    return code.includes('C1') && code.includes('C2') && code.includes('C3') && code.includes('C4') &&
           code.includes('All Critical and Major findings resolved');
  });

  await t('N3: QA_FINDINGS_REPORT.md marks C1 RESOLVED', async () => {
    return src('QA_FINDINGS_REPORT.md').includes('C1 — Gateway refund ✅ RESOLVED');
  });

  await t('N4: QA_FINDINGS_REPORT.md marks C2 RESOLVED', async () => {
    return src('QA_FINDINGS_REPORT.md').includes('C2 — PayPal webhook verification ✅ RESOLVED');
  });

  await t('N5: QA_FINDINGS_REPORT.md marks C4 RESOLVED', async () => {
    return src('QA_FINDINGS_REPORT.md').includes('C4 — EUR→INR conversion ✅ RESOLVED');
  });

  await t('N6: QA_FINDINGS_REPORT.md marks N4 RESOLVED', async () => {
    return src('QA_FINDINGS_REPORT.md').includes('N4 — Customer self-cancel ✅ RESOLVED');
  });

  await t('N7: QA_FINDINGS_REPORT.md summary table has C1 and N4 rows marked resolved', async () => {
    const code = src('QA_FINDINGS_REPORT.md');
    return code.includes('| C1 — Gateway refund | ❌ Not implemented | ✅ Implemented |') &&
           code.includes('| N4 — Customer self-cancel |') &&
           code.includes('✅ Full endpoint with refund + email |');
  });

  // ── O: Security edge cases ────────────────────────────────────────────────
  section('O: Security & Edge Cases');

  await t('O1: Customer cannot access admin endpoints (403)', async () => {
    if (!customerToken) return 'SKIP';
    const r = await req('GET', `${BASE}/api/admin/dashboard-extended`, null, { Authorization: `Bearer ${customerToken}` });
    return r.status === 403;
  });

  await t('O2: Unauthenticated request to admin endpoint returns 401', async () => {
    const r = await req('GET', `${BASE}/api/admin/orders`);
    return r.status === 401;
  });

  await t('O3: Cancel with non-UUID order ID returns 4xx (not 500)', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('POST', `${BASE}/api/admin/orders/not-a-uuid/cancel`, {}, hdr());
    return r.status >= 400 && r.status < 500;
  });

  await t('O4: updateOrderStatus missing status body handled gracefully (400/404/422)', async () => {
    if (!adminToken) return 'SKIP';
    const r = await req('PATCH', sUrl('00000000-0000-0000-0000-000000000000'), {}, hdr());
    // 422 = express-validator fires before controller (valid); 400/404 = controller-level guard
    return r.status === 400 || r.status === 404 || r.status === 422;
  });

  await t('O5: Razorpay webhook with wrong signature returns 400', async () => {
    return new Promise(resolve => {
      const body = JSON.stringify({ event: 'payment.captured' });
      const r = http.request({
        hostname: '127.0.0.1', port: 5000,
        path: '/api/payments/razorpay/webhook', method: 'POST',
        headers: {
          'Content-Type'       : 'application/octet-stream',
          'Content-Length'     : Buffer.byteLength(body),
          'x-razorpay-signature': 'wrong-sig'
        }
      }, res => resolve(res.statusCode === 400));
      r.on('error', () => resolve(false));
      r.write(body);
      r.end();
    });
  });

  await t('O6: emailService.sendOrderCancellation handles missing paymentStatus gracefully', async () => {
    // Email template uses conditional — should not crash when paymentStatus is undefined
    const code = src('backend/src/services/emailService.js');
    const fn   = code.slice(code.indexOf('async sendOrderCancellation'));
    return fn.includes("paymentStatus === 'REFUNDED'") && fn.includes('Number(order.total).toFixed(2)');
  });

  // ─────────────────────────────────────────────────────────────────────────
  const total = passed + failed + skipped;
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  RESULTS  passed: ${passed}  failed: ${failed}  skipped: ${skipped}  total: ${total}`);
  if (failures.length) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(`    • ${f}`));
  } else {
    console.log('\n  All tests passed ✓');
  }
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
})();
