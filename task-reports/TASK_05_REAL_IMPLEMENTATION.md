# Task 5 — Live Payment Gateway Implementation Guide

This document explains exactly what to change to move from placeholder credentials to production-ready Razorpay, PayPal, and UPI webhooks.

---

## Part 1 — Razorpay (Live)

### What you need from Razorpay Dashboard

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Settings → API Keys → Generate Key (use **Test** for staging, **Live** for production)
3. Settings → Webhooks → Add New Webhook

Collect:
- `RAZORPAY_KEY_ID` — starts with `rzp_test_` or `rzp_live_`
- `RAZORPAY_KEY_SECRET` — shown once on key creation
- `RAZORPAY_WEBHOOK_SECRET` — you set this when creating the webhook endpoint

### .env changes

```env
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### Razorpay Dashboard webhook setup

In the Razorpay webhook form:

| Field | Value |
|-------|-------|
| Webhook URL | `https://yourdomain.com/api/payments/razorpay/webhook` |
| Secret | Same string you put in `RAZORPAY_WEBHOOK_SECRET` |
| Events to subscribe | `payment.captured`, `payment.failed` (add `refund.processed` when refunds are implemented) |

### Code changes needed (none to webhook handler)

The webhook handler in `paymentController.js` is already production-ready. It:
- Reads `config.razorpay.webhookSecret` from `env.js` → pulls from `.env`
- Uses raw body for HMAC — **no change needed**
- Returns 400 on bad signature, 200 on processing errors

The only addition for full production robustness: handle `payment.failed` event:

```javascript
// Add inside the existing if-block in razorpayWebhook, after payment.captured:
if (event.event === 'payment.failed') {
  const razorpayOrderId = event.payload.payment.entity.order_id;
  const payment = await prisma.payment.findFirst({ where: { providerOrderId: razorpayOrderId } });
  if (payment) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    await prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'FAILED' } });
  }
}
```

### How to test with real Razorpay

1. Use test mode keys (`rzp_test_*`)
2. In Razorpay Dashboard → Webhooks → select your webhook → click "Test" → choose `payment.captured`
3. Razorpay sends a real signed event to your URL — your handler verifies the real HMAC
4. Alternatively: complete a payment with test card `4111 1111 1111 1111` (any CVV, any future expiry) — Razorpay fires the webhook automatically

---

## Part 2 — PayPal (Live)

### What you need from PayPal Developer

1. Go to [developer.paypal.com](https://developer.paypal.com)
2. Apps & Credentials → Create App (Sandbox first, then Live)
3. Under the app, find **Webhooks** → Add Webhook

Collect:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID` — shown after you create the webhook (new .env key needed)

### .env changes

```env
PAYPAL_CLIENT_ID=AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYPAL_CLIENT_SECRET=EXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYPAL_ENV=sandbox          # change to 'live' for production
PAYPAL_WEBHOOK_ID=XXXXXXXXXXXXXXXXXXX   # ADD THIS NEW KEY
```

### PayPal Dashboard webhook setup

In the PayPal webhook form:

| Field | Value |
|-------|-------|
| Webhook URL | `https://yourdomain.com/api/payments/paypal/webhook` |
| Events | `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED` |

### Code changes needed — full signature verification

The current handler has a `// TODO` placeholder for full verification. Here is the exact code to replace it:

**In `backend/src/config/env.js`**, add inside the `paypal` block:
```javascript
paypal: {
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  env: process.env.PAYPAL_ENV || 'sandbox',
  webhookId: process.env.PAYPAL_WEBHOOK_ID   // ADD THIS
},
```

**In `backend/src/controllers/paymentController.js`**, replace the TODO comment block with:
```javascript
// Full PayPal webhook signature verification
const paypalSdk = require('../config/paypal');
const verificationBody = {
  auth_algo: req.headers['paypal-auth-algo'],
  cert_url: req.headers['paypal-cert-url'],
  transmission_id: req.headers['paypal-transmission-id'],
  transmission_sig: req.headers['paypal-transmission-sig'],
  transmission_time: req.headers['paypal-transmission-time'],
  webhook_id: config.paypal.webhookId,
  webhook_event: JSON.parse(req.body.toString())
};

const paypalClient = new paypalSdk.core.PayPalHttpClient(
  config.paypal.env === 'live'
    ? new paypalSdk.core.LiveEnvironment(config.paypal.clientId, config.paypal.clientSecret)
    : new paypalSdk.core.SandboxEnvironment(config.paypal.clientId, config.paypal.clientSecret)
);
const verifyRequest = new paypalSdk.notifications.VerifyWebhookSignatureRequest();
verifyRequest.requestBody(verificationBody);
const verifyResponse = await paypalClient.execute(verifyRequest);
if (verifyResponse.result.verification_status !== 'SUCCESS') {
  console.error('PayPal webhook: invalid signature');
  return res.status(400).json({ error: 'Invalid signature' });
}
```

**Note:** The PayPal Node SDK must be checked for the exact import path — it varies by SDK version. The `@paypal/checkout-server-sdk` package (already in your dependencies) exposes `notifications.VerifyWebhookSignatureRequest` in some versions. If not available, use the REST API directly:
```javascript
// Direct REST call to verify PayPal webhook
const fetch = require('node-fetch');
const accessToken = await getPayPalAccessToken(); // from paypalService
const verifyRes = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(verificationBody)
});
const { verification_status } = await verifyRes.json();
if (verification_status !== 'SUCCESS') return res.status(400).json({ error: 'Invalid signature' });
```

### How to test with real PayPal

1. Use sandbox credentials and a sandbox buyer account
2. PayPal Dashboard → Webhooks → Simulate (choose `PAYMENT.CAPTURE.COMPLETED`)
3. Or complete a payment in your checkout with sandbox test card

---

## Part 3 — UPI (Live)

UPI in this codebase is **manual verification** (not an automated gateway webhook). The flow is:

1. Customer submits `upiReferenceId` via `POST /api/payments/upi/submit-proof`
2. Payment record is set to `VERIFICATION_REQUIRED`
3. Admin sees it in the Payments panel → manually clicks "Approve" or "Reject"
4. On approve: admin calls `PATCH /api/admin/payments/:id/approve` (Task 7 route)

### Live UPI setup

Update `.env`:
```env
UPI_ID=yourbusiness@ybl           # or @okaxis, @paytm, @icici etc.
UPI_MERCHANT_NAME=RAEN
UPI_PAYMENT_NOTE=RAEN Order Payment
```

The frontend generates a UPI deep-link using this data. No webhook is needed for manual flow.

### Automated UPI (Razorpay UPI / PayU) — future upgrade path

If you want automated UPI verification (no manual step), switch to Razorpay's UPI product:
- Razorpay handles UPI collect and automatically fires `payment.captured` when payment settles
- Your existing Razorpay webhook handler already covers this — no new code needed
- Change: replace manual UPI flow in `paymentService.js` with `razorpay.paymentLink.create()` or VPA collect flow
- Remove the admin "approve UPI" UI step from Task 8

---

## Part 4 — Refunds (Razorpay)

`razorpayService.js` has no `refundPayment` method. When `cancelOrder` in Task 7 calls `razorpayService.refundPayment(...)`, it is guarded with `razorpayService.refundPayment &&` so it silently skips.

To implement refunds, add to `backend/src/services/razorpayService.js`:

```javascript
async refundPayment(razorpayPaymentId, amount) {
  try {
    const refund = await razorpay.payments.refund(razorpayPaymentId, {
      amount: Math.round(amount * 100), // back to paise
      notes: { reason: 'Order cancelled by admin' }
    });
    return refund;
  } catch (error) {
    console.error('Razorpay refund error:', error);
    throw new Error('Failed to initiate refund');
  }
}
```

Then add a webhook handler for `refund.processed` in `razorpayWebhook`:
```javascript
if (event.event === 'refund.processed') {
  const razorpayPaymentId = event.payload.refund.entity.payment_id;
  const payment = await prisma.payment.findFirst({ where: { providerPaymentId: razorpayPaymentId } });
  if (payment) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
    await prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'REFUNDED' } });
  }
}
```

---

## Part 5 — Security checklist before going live

| Check | Status |
|-------|--------|
| `RAZORPAY_WEBHOOK_SECRET` is a strong random string (not "placeholder") | ⬜ |
| `RAZORPAY_KEY_SECRET` is a live key, not a test key | ⬜ |
| Webhook URL is HTTPS (not HTTP) | ⬜ |
| `express.raw()` is registered before `express.json()` in app.js | ✅ Done |
| HMAC comparison uses constant-time `crypto.timingSafeEqual()` | ⬜ Upgrade for production |
| Rate limiter on webhook routes (DoS protection) | ⬜ |
| Idempotency: check if event was already processed before updating DB | ⬜ Future task |
| `PAYPAL_WEBHOOK_ID` is set and full signature verification is enabled | ⬜ |
| Admin audit log includes real admin user ID (not order ID) | ✅ Done |

### Upgrade HMAC comparison to constant-time (before going live):

In `paymentController.js`, replace the signature check:
```javascript
// Current (vulnerable to timing attack):
if (!signature || signature !== expected) { ... }

// Production (constant-time, replace above with):
if (!signature) return res.status(400).json({ error: 'Invalid signature' });
const sigBuf = Buffer.from(signature, 'hex');
const expBuf = Buffer.from(expected, 'hex');
if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
  return res.status(400).json({ error: 'Invalid signature' });
}
```
