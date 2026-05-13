# RAEN Phase 1 — Complete Claude Execution Prompt

Copy everything below this line and paste it into a fresh Claude session.

---

## CONTEXT — READ THIS FIRST

You are completing Phase 1 of a luxury fashion e-commerce platform called RAEN. The project is already cloned and running locally. Here is the exact state of the codebase:

**What exists and works:**
- Node.js + Express backend running on port 5000
- PostgreSQL database with Prisma ORM — 13 models, seeded with 12 products
- Payment integrations: Razorpay, PayPal, UPI — all at service layer
- JWT auth, bcrypt, rate limiting, CORS, Helmet — all configured
- Email service with 7 templates — coded, needs SMTP credentials
- Frontend pages: collections, product-detail, shopping-bag, checkout, order-confirmation, early-access — all connected to backend API
- `stitch/public/js/api.js` — API helper with auth token management, session IDs, apiGet/apiPost/apiPatch/apiDelete methods, showToast

**What is broken or missing (your job):**
1. Product links on homepage and collections page point to old static HTML files
2. Payment webhooks are stubs — they receive but do nothing (paymentController.js lines 101–118)
3. Contact form (contact.html) has no API connection
4. Admin dashboard UI does not exist at all
5. Customer login/register UI does not exist
6. Customer account + order history page does not exist
7. Order cancellation and refund flow does not exist

**Tech stack constraints — do not deviate:**
- Frontend: Pure HTML + Tailwind CSS (via CDN already in pages) + Vanilla JavaScript
- Backend: Node.js + Express + Prisma
- No React, no Vue, no bundler, no new npm packages unless absolutely required
- For charts in admin: use Chart.js via CDN `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
- All admin pages live in `stitch/admin/` folder
- Use the existing `stitch/public/js/api.js` for all API calls from the frontend

**Prisma schema — key models you will use:**
```
Product: id, slug, name, description, category, price, currency, status (ACTIVE/DRAFT/ARCHIVED), images (Json array of paths), sizes (Json array), salePrice (Float? — ADD THIS), discountPercent (Int? — ADD THIS), createdAt, updatedAt
Inventory: id, productId, size, stock, reservedStock, sku
Order: id, orderNumber, userId?, email, phone, status (PENDING/PAID/PROCESSING/SHIPPED/DELIVERED/CANCELLED/REFUNDED), paymentStatus (UNPAID/PENDING_VERIFICATION/PAID/FAILED/REFUNDED), subtotal, tax, shipping, total, currency, shippingAddress (Json), createdAt, updatedAt
OrderItem: id, orderId, productId, productName, productSlug, size, quantity, unitPrice, lineTotal, image?
Payment: id, orderId, provider (RAZORPAY/PAYPAL/UPI_MANUAL), providerOrderId?, providerPaymentId?, amount, currency, status (CREATED/PENDING/SUCCESS/FAILED/REFUNDED/VERIFICATION_REQUIRED), createdAt
User: id, firstName, lastName, email, passwordHash, phone, role (CUSTOMER/ADMIN), createdAt
AdminAuditLog: id, adminUserId, action, entityType, entityId?, metadata (Json?), createdAt
ContactMessage: id, name, email, subject, message, status (NEW/READ/REPLIED), createdAt
EarlyAccessRequest: id, firstName, lastName, email, status (NEW/REVIEWED/APPROVED/REJECTED), createdAt
```

**File locations:**
- Backend entry: `backend/src/server.js`
- Backend app: `backend/src/app.js`
- Controllers: `backend/src/controllers/`
- Services: `backend/src/services/`
- Routes: `backend/src/routes/`
- Prisma schema: `backend/src/prisma/schema.prisma`
- Frontend pages: `stitch/`
- Admin pages (create): `stitch/admin/`
- API helper: `stitch/public/js/api.js`

---

## TASK 1 — DATABASE SCHEMA ADDITIONS

First, add these fields to the Prisma schema and run a migration.

### Add to Product model in `backend/src/prisma/schema.prisma`:
```prisma
salePrice       Float?
discountPercent Int?
```

### Add entirely new model PageView:
```prisma
model PageView {
  id        String   @id @default(uuid())
  path      String
  productId String?
  sessionId String
  userAgent String?
  referer   String?
  createdAt DateTime @default(now())

  @@index([path])
  @@index([productId])
  @@index([createdAt])
}
```

### Add entirely new model CartEvent:
```prisma
model CartEvent {
  id        String   @id @default(uuid())
  event     String   // "add_to_cart" | "remove_from_cart" | "checkout_started" | "checkout_completed"
  sessionId String
  productId String?
  orderId   String?
  createdAt DateTime @default(now())

  @@index([event])
  @@index([productId])
  @@index([createdAt])
}
```

### Run migration:
```bash
cd backend
npx prisma migrate dev --schema=./src/prisma/schema.prisma --name "add_discount_analytics"
npx prisma generate --schema=./src/prisma/schema.prisma
cd ..
```

---

## TASK 2 — ANALYTICS TRACKING BACKEND

Create `backend/src/controllers/analyticsController.js`:

```javascript
const prisma = require('../config/db');
const { success } = require('../utils/apiResponse');

exports.trackPageView = async (req, res) => {
  try {
    const { path, productId, sessionId } = req.body;
    if (!path || !sessionId) return res.status(400).json({ ok: false });
    await prisma.pageView.create({
      data: {
        path,
        productId: productId || null,
        sessionId,
        userAgent: req.headers['user-agent'] || null,
        referer: req.headers['referer'] || null,
      }
    });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true }); // never block the user
  }
};

exports.trackCartEvent = async (req, res) => {
  try {
    const { event, sessionId, productId, orderId } = req.body;
    if (!event || !sessionId) return res.status(400).json({ ok: false });
    await prisma.cartEvent.create({ data: { event, sessionId, productId, orderId } });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true });
  }
};
```

Create `backend/src/routes/analyticsRoutes.js`:
```javascript
const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');
router.post('/pageview', ctrl.trackPageView);
router.post('/cart-event', ctrl.trackCartEvent);
module.exports = router;
```

Register in `backend/src/app.js` — add before the error middleware:
```javascript
app.use('/api/analytics', require('./routes/analyticsRoutes'));
```

---

## TASK 3 — ADD TRACKING SCRIPT TO ALL FRONTEND PAGES

Add this script block to the `<head>` of EVERY page in `stitch/` (index.html, collections.html, product-detail.html, shopping-bag.html, checkout.html, order-confirmation.html, contact.html, early-access.html, and all static pages):

```html
<script>
(function(){
  const sid = localStorage.getItem('raen_session') || (()=>{
    const s = 'sess_' + Math.random().toString(36).slice(2);
    localStorage.setItem('raen_session', s);
    return s;
  })();
  const base = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000' : '';
  const path = window.location.pathname + window.location.search;
  const productId = new URLSearchParams(window.location.search).get('slug') || null;
  fetch(base + '/api/analytics/pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, sessionId: sid, productId }),
    keepalive: true
  }).catch(() => {});
  window.__raenSession = sid;
  window.__trackCart = (event, productId, orderId) => {
    fetch(base + '/api/analytics/cart-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, sessionId: sid, productId, orderId }),
      keepalive: true
    }).catch(() => {});
  };
})();
</script>
```

Then in `stitch/product-detail.html`, after a successful "Add to Cart" call, add:
```javascript
window.__trackCart('add_to_cart', product.id);
```

In `stitch/checkout.html`, when checkout starts, add:
```javascript
window.__trackCart('checkout_started', null, null);
```

After a successful payment, add:
```javascript
window.__trackCart('checkout_completed', null, order.orderNumber);
```

---

## TASK 4 — FIX BROKEN PRODUCT LINKS

In `stitch/index.html` and `stitch/collections.html`, find every `href` pointing to old static product pages like `bare-obsession.html`, `serpentine.html`, etc. and replace with the correct format:

```
href="bare-obsession.html"  →  href="product-detail.html?slug=bare-obsession"
href="serpentine.html"      →  href="product-detail.html?slug=serpentine"
href="midnight-venom.html"  →  href="product-detail.html?slug=midnight-venom"
href="crimson-vice.html"    →  href="product-detail.html?slug=crimson-vice"
href="black-pearl.html"     →  href="product-detail.html?slug=black-pearl"
```

Apply same pattern to all 12 product slugs across ALL HTML files.

Verify with:
```bash
grep -r '\.html' stitch/ --include="*.html" | grep -E 'obsession|pearl|crimson|emerald|venom|kiss|serpentine|taupe|ivory|provocateur|sovereign|velvet' | grep href
```

Output must be empty. Then delete all 12 old static product HTML files:
```bash
rm stitch/bare-obsession.html stitch/black-pearl.html stitch/crimson-vice.html stitch/emerald-sin.html stitch/midnight-venom.html stitch/poison-kiss.html stitch/serpentine.html stitch/taupe-wrap.html stitch/the-ivory-weapon.html stitch/the-provocateur.html stitch/the-sovereign.html stitch/velvet-scandal.html
```

---

## TASK 5 — PAYMENT WEBHOOKS WITH DATABASE TRANSACTIONS

Replace the stub webhook handlers in `backend/src/controllers/paymentController.js` (currently lines 101–118 — both `razorpayWebhook` and `paypalWebhook` just return `{ received: true }`).

### Razorpay webhook:
```javascript
exports.razorpayWebhook = async (req, res) => {
  try {
    const crypto = require('crypto');
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body).digest('hex');

    if (!signature || signature !== expected) {
      console.error('Razorpay webhook: invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    if (event.event === 'payment.captured') {
      const razorpayOrderId = event.payload.payment.entity.order_id;
      const razorpayPaymentId = event.payload.payment.entity.id;
      const amount = event.payload.payment.entity.amount / 100; // paise to INR

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { providerOrderId: razorpayOrderId }
        });
        if (!payment) throw new Error('Payment record not found for order: ' + razorpayOrderId);

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS', providerPaymentId: razorpayPaymentId }
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID', paymentStatus: 'PAID' }
        });

        const orderItems = await tx.orderItem.findMany({
          where: { orderId: payment.orderId }
        });

        for (const item of orderItems) {
          await tx.inventory.updateMany({
            where: { productId: item.productId, size: item.size },
            data: { stock: { decrement: item.quantity } }
          });
        }

        await tx.adminAuditLog.create({
          data: {
            adminUserId: payment.orderId, // system log
            action: 'PAYMENT_CONFIRMED',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: { razorpayOrderId, razorpayPaymentId, amount }
          }
        });
      });

      // Non-blocking email
      const order = await prisma.order.findUnique({
        where: { id: (await prisma.payment.findFirst({ where: { providerOrderId: razorpayOrderId } })).orderId },
        include: { items: true }
      });
      const emailService = require('../services/emailService');
      emailService.sendOrderConfirmation(order).catch(err => console.error('Email error:', err));
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Razorpay webhook error:', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
```

### PayPal webhook:
```javascript
exports.paypalWebhook = async (req, res) => {
  try {
    const event = req.body;
    // Verify webhook signature using PayPal SDK
    const paypalClient = require('../config/paypal');
    // For production: verify transmission signature
    // For now: verify event type and process
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const paypalOrderId = event.resource.supplementary_data?.related_ids?.order_id
        || event.resource.id;
      const captureId = event.resource.id;
      const amount = parseFloat(event.resource.amount?.value || 0);

      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { providerOrderId: paypalOrderId }
        });
        if (!payment) throw new Error('Payment not found for PayPal order: ' + paypalOrderId);

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS', providerPaymentId: captureId }
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID', paymentStatus: 'PAID' }
        });

        const orderItems = await tx.orderItem.findMany({ where: { orderId: payment.orderId } });
        for (const item of orderItems) {
          await tx.inventory.updateMany({
            where: { productId: item.productId, size: item.size },
            data: { stock: { decrement: item.quantity } }
          });
        }
      });

      const order = await prisma.order.findUnique({
        where: { id: (await prisma.payment.findFirst({ where: { providerOrderId: paypalOrderId } })).orderId },
        include: { items: true }
      });
      const emailService = require('../services/emailService');
      emailService.sendOrderConfirmation(order).catch(console.error);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayPal webhook error:', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
```

---

## TASK 6 — CONTACT FORM INTEGRATION

In `stitch/contact.html`:
1. Ensure `<script src="public/js/api.js"></script>` is before `</body>`
2. Add the tracking script from Task 3 to the `<head>`
3. Find the form element. Add this script:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
      const fields = ['name', 'email', 'subject', 'message'];
      const data = {};
      fields.forEach(f => {
        const el = form.querySelector(`[name="${f}"], #${f}`);
        if (el) data[f] = el.value.trim();
      });
      if (!data.subject) data.subject = 'Customer Enquiry';
      await apiPost('/contact', data);
      form.innerHTML = '<p style="text-align:center;padding:2rem;letter-spacing:0.1em;">YOUR MESSAGE HAS BEEN RECEIVED.<br>WE WILL BE IN TOUCH WITHIN 48 HOURS.</p>';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Send';
      showToast('Unable to send. Please email hello@raen.design directly.', 'error');
    }
  });
});
```

---

## TASK 7 — EXPANDED ADMIN BACKEND ENDPOINTS

Add these endpoints to `backend/src/controllers/adminController.js` and `backend/src/routes/adminRoutes.js`:

### Analytics endpoint (add to adminController.js):
```javascript
exports.getAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalPageViews,
      uniqueSessions,
      productPageViews,
      addToCartEvents,
      checkoutStarted,
      checkoutCompleted,
      topProducts,
      dailyRevenue,
      revenueByMethod,
      topProductsByRevenue,
    ] = await Promise.all([
      prisma.pageView.count({ where: { createdAt: { gte: since } } }),
      prisma.pageView.groupBy({ by: ['sessionId'], where: { createdAt: { gte: since } }, _count: true }).then(r => r.length),
      prisma.pageView.count({ where: { createdAt: { gte: since }, path: { contains: 'product-detail' } } }),
      prisma.cartEvent.count({ where: { createdAt: { gte: since }, event: 'add_to_cart' } }),
      prisma.cartEvent.count({ where: { createdAt: { gte: since }, event: 'checkout_started' } }),
      prisma.cartEvent.count({ where: { createdAt: { gte: since }, event: 'checkout_completed' } }),
      prisma.pageView.groupBy({
        by: ['productId'],
        where: { createdAt: { gte: since }, productId: { not: null } },
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 10
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: since }, paymentStatus: 'PAID' },
        select: { createdAt: true, total: true }
      }),
      prisma.payment.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since }, status: 'SUCCESS' },
        _sum: { amount: true },
        _count: true
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: { createdAt: { gte: since }, paymentStatus: 'PAID' } },
        _sum: { lineTotal: true, quantity: true },
        _count: true,
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 10
      }),
    ]);

    // Enrich top products with names
    const productIds = topProducts.map(p => p.productId).filter(Boolean);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, slug: true }
    });
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    // Build daily revenue chart data
    const revenueByDay = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 86400000);
      revenueByDay[d.toISOString().slice(0, 10)] = 0;
    }
    dailyRevenue.forEach(o => {
      const day = o.createdAt.toISOString().slice(0, 10);
      if (revenueByDay[day] !== undefined) revenueByDay[day] += o.total;
    });

    return success(res, {
      summary: {
        totalPageViews,
        uniqueSessions,
        productPageViews,
        addToCartEvents,
        checkoutStarted,
        checkoutCompleted,
        conversionRate: uniqueSessions > 0 ? ((checkoutCompleted / uniqueSessions) * 100).toFixed(2) : 0,
        cartToCheckout: addToCartEvents > 0 ? ((checkoutStarted / addToCartEvents) * 100).toFixed(2) : 0,
      },
      topProductsByViews: topProducts.map(p => ({
        productId: p.productId,
        name: productMap[p.productId]?.name || 'Unknown',
        slug: productMap[p.productId]?.slug || '',
        views: p._count.productId
      })),
      topProductsByRevenue,
      revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
      revenueByMethod,
    }, 'Analytics retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
```

### Product CRUD with discount (add/update adminController.js):
```javascript
exports.createProduct = async (req, res) => {
  try {
    const { name, slug, description, category, price, salePrice, discountPercent, status, images, sizes } = req.body;
    const product = await prisma.product.create({
      data: { name, slug, description, category, price: parseFloat(price), salePrice: salePrice ? parseFloat(salePrice) : null, discountPercent: discountPercent ? parseInt(discountPercent) : null, status: status || 'ACTIVE', images: images || [], sizes: sizes || ['XS','S','M','L'] }
    });
    if (sizes) {
      for (const size of sizes) {
        await prisma.inventory.create({
          data: { productId: product.id, size, stock: 10, sku: `${slug}-${size}`.toUpperCase() }
        });
      }
    }
    await prisma.adminAuditLog.create({ data: { adminUserId: req.user.id, action: 'CREATE_PRODUCT', entityType: 'Product', entityId: product.id } });
    return success(res, { product }, 'Product created', 201);
  } catch (err) { return error(res, err.message, 400); }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, salePrice, discountPercent, status, images, sizes } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;
    if (price !== undefined) data.price = parseFloat(price);
    if (salePrice !== undefined) data.salePrice = salePrice ? parseFloat(salePrice) : null;
    if (discountPercent !== undefined) data.discountPercent = discountPercent ? parseInt(discountPercent) : null;
    if (status !== undefined) data.status = status;
    if (images !== undefined) data.images = images;
    if (sizes !== undefined) data.sizes = sizes;
    const product = await prisma.product.update({ where: { id }, data });
    await prisma.adminAuditLog.create({ data: { adminUserId: req.user.id, action: 'UPDATE_PRODUCT', entityType: 'Product', entityId: id, metadata: data } });
    return success(res, { product }, 'Product updated');
  } catch (err) { return error(res, err.message, 400); }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await prisma.adminAuditLog.create({ data: { adminUserId: req.user.id, action: 'ARCHIVE_PRODUCT', entityType: 'Product', entityId: id } });
    return success(res, null, 'Product archived');
  } catch (err) { return error(res, err.message, 400); }
};

exports.getProductStats = async (req, res) => {
  try {
    const { id } = req.params;
    const since30 = new Date(Date.now() - 30 * 86400000);
    const [product, orderItems, pageViews, cartAdds] = await Promise.all([
      prisma.product.findUnique({ where: { id }, include: { inventory: true } }),
      prisma.orderItem.findMany({ where: { productId: id, order: { paymentStatus: 'PAID' } }, include: { order: { select: { createdAt: true, total: true } } } }),
      prisma.pageView.count({ where: { productId: id, createdAt: { gte: since30 } } }),
      prisma.cartEvent.count({ where: { productId: id, event: 'add_to_cart', createdAt: { gte: since30 } } }),
    ]);
    const totalRevenue = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalUnitsSold = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    return success(res, { product, totalOrders: orderItems.length, totalRevenue, totalUnitsSold, pageViews30Days: pageViews, cartAdds30Days: cartAdds, conversionRate30Days: pageViews > 0 ? ((cartAdds / pageViews) * 100).toFixed(2) : 0 }, 'Product stats retrieved');
  } catch (err) { return error(res, err.message, 400); }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id }, include: { payments: true, items: true } });
    if (!order) return error(res, 'Order not found', 404);
    if (['CANCELLED', 'REFUNDED', 'DELIVERED'].includes(order.status)) return error(res, `Cannot cancel order with status ${order.status}`, 400);

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED', paymentStatus: order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus } });
      for (const item of order.items) {
        await tx.inventory.updateMany({ where: { productId: item.productId, size: item.size }, data: { stock: { increment: item.quantity } } });
      }
      const payment = order.payments[0];
      if (payment && payment.status === 'SUCCESS') {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      }
      await tx.adminAuditLog.create({ data: { adminUserId: req.user.id, action: 'CANCEL_ORDER', entityType: 'Order', entityId: id, metadata: { previousStatus: order.status } } });
    });

    // Attempt gateway refund (non-blocking)
    const payment = order.payments[0];
    if (payment?.providerPaymentId && payment.provider === 'RAZORPAY') {
      const razorpayService = require('../services/razorpayService');
      razorpayService.refundPayment && razorpayService.refundPayment(payment.providerPaymentId, order.total).catch(console.error);
    }
    return success(res, null, 'Order cancelled and inventory restored');
  } catch (err) { return error(res, err.message, 400); }
};

exports.getDashboardExtended = async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - 7);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalOrders, pendingOrders, processingOrders, shippedOrders, deliveredOrders,
      todayRevenue, weekRevenue, monthRevenue, totalRevenue,
      pendingUPI, lowStockItems, recentOrders, topProducts, totalCustomers, newCustomersThisMonth
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: today } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: thisWeekStart } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: thisMonthStart } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true } }),
      prisma.payment.count({ where: { status: 'VERIFICATION_REQUIRED' } }),
      prisma.inventory.findMany({ where: { stock: { lte: 3 } }, include: { product: { select: { name: true, slug: true } } }, orderBy: { stock: 'asc' }, take: 10 }),
      prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { items: { take: 1 } } }),
      prisma.orderItem.groupBy({ by: ['productId', 'productName'], where: { order: { paymentStatus: 'PAID' } }, _sum: { lineTotal: true, quantity: true }, orderBy: { _sum: { lineTotal: 'desc' } }, take: 5 }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: thisMonthStart } } }),
    ]);

    return success(res, {
      orders: { total: totalOrders, pending: pendingOrders, processing: processingOrders, shipped: shippedOrders, delivered: deliveredOrders },
      revenue: { today: todayRevenue._sum.total || 0, week: weekRevenue._sum.total || 0, month: monthRevenue._sum.total || 0, total: totalRevenue._sum.total || 0 },
      pendingUPIVerifications: pendingUPI,
      lowStockItems,
      recentOrders,
      topProducts,
      customers: { total: totalCustomers, newThisMonth: newCustomersThisMonth }
    }, 'Dashboard data retrieved');
  } catch (err) { return error(res, err.message, 400); }
};
```

### Add these routes to `backend/src/routes/adminRoutes.js`:
```javascript
router.get('/dashboard-extended', adminMiddleware, adminController.getDashboardExtended);
router.get('/analytics', adminMiddleware, adminController.getAnalytics);
router.post('/products', adminMiddleware, adminController.createProduct);
router.put('/products/:id', adminMiddleware, adminController.updateProduct);
router.delete('/products/:id', adminMiddleware, adminController.deleteProduct);
router.get('/products/:id/stats', adminMiddleware, adminController.getProductStats);
router.post('/orders/:id/cancel', adminMiddleware, adminController.cancelOrder);
```

---

## TASK 8 — ADMIN DASHBOARD UI (SHOPIFY-LEVEL)

Create the folder `stitch/admin/` and build all pages below. Every admin page must:
1. Start with the auth gate (redirect if no token)
2. Load a consistent sidebar
3. Use Chart.js from CDN for charts
4. Use the same `../public/js/api.js` helper

### Shared sidebar HTML (paste at top of `<body>` in every admin page):
```html
<nav id="admin-sidebar" style="position:fixed;top:0;left:0;height:100vh;width:220px;background:#1a1a1a;color:#fff;padding:0;z-index:100;display:flex;flex-direction:column;">
  <div style="padding:20px 16px;border-bottom:1px solid #333;">
    <div style="font-size:11px;letter-spacing:0.2em;color:#b8960c;font-weight:700;">RAEN ADMIN</div>
  </div>
  <div style="flex:1;overflow-y:auto;padding:8px 0;">
    <a href="index.html" class="nav-item">Dashboard</a>
    <a href="orders.html" class="nav-item">Orders</a>
    <a href="products.html" class="nav-item">Products</a>
    <a href="inventory.html" class="nav-item">Inventory</a>
    <a href="payments.html" class="nav-item">Payments</a>
    <a href="customers.html" class="nav-item">Customers</a>
    <a href="analytics.html" class="nav-item">Analytics</a>
    <a href="messages.html" class="nav-item">Messages</a>
  </div>
  <div style="padding:16px;border-top:1px solid #333;">
    <button onclick="logout()" style="width:100%;padding:8px;background:#333;color:#fff;border:none;cursor:pointer;letter-spacing:0.1em;font-size:11px;">SIGN OUT</button>
  </div>
</nav>
<style>
  body { margin:0; font-family:Helvetica,Arial,sans-serif; background:#f5f5f5; }
  .nav-item { display:block;padding:10px 16px;color:#ccc;text-decoration:none;font-size:12px;letter-spacing:0.08em;transition:all 0.2s; }
  .nav-item:hover,.nav-item.active { background:#2a2a2a;color:#fff; }
  .main { margin-left:220px;padding:24px;min-height:100vh; }
  .card { background:#fff;border-radius:4px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08); }
  .stat-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px; }
  .stat-card { background:#fff;padding:20px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-top:3px solid #b8960c; }
  .stat-value { font-size:24px;font-weight:700;color:#1a1a1a;margin:4px 0; }
  .stat-label { font-size:11px;letter-spacing:0.1em;color:#888;text-transform:uppercase; }
  table { width:100%;border-collapse:collapse;font-size:13px; }
  th { text-align:left;padding:10px 12px;background:#f8f8f8;border-bottom:2px solid #e5e5e5;font-size:11px;letter-spacing:0.1em;color:#555; }
  td { padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#333; }
  tr:hover td { background:#fafafa; }
  .badge { display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600;letter-spacing:0.05em; }
  .badge-pending { background:#fff3cd;color:#856404; }
  .badge-paid { background:#d4edda;color:#155724; }
  .badge-shipped { background:#cce5ff;color:#004085; }
  .badge-delivered { background:#d4edda;color:#155724; }
  .badge-cancelled { background:#f8d7da;color:#721c24; }
  .badge-active { background:#d4edda;color:#155724; }
  .badge-draft { background:#e2e3e5;color:#383d41; }
  .btn { padding:8px 16px;border:none;cursor:pointer;font-size:12px;letter-spacing:0.08em;border-radius:3px; }
  .btn-primary { background:#1a1a1a;color:#fff; }
  .btn-gold { background:#b8960c;color:#fff; }
  .btn-danger { background:#dc3545;color:#fff; }
  .btn-sm { padding:4px 10px;font-size:11px; }
  input,select,textarea { width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:3px;font-size:13px;box-sizing:border-box; }
  label { display:block;font-size:11px;letter-spacing:0.08em;color:#555;margin-bottom:4px;text-transform:uppercase; }
  .form-group { margin-bottom:16px; }
  .page-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px; }
  .page-title { font-size:20px;font-weight:700;color:#1a1a1a;letter-spacing:0.05em; }
  .alert { padding:12px 16px;border-radius:3px;margin-bottom:16px;font-size:13px; }
  .alert-warning { background:#fff3cd;color:#856404;border:1px solid #ffc107; }
  .alert-danger { background:#f8d7da;color:#721c24;border:1px solid #dc3545; }
</style>
<script>
  // Auth gate
  const _token = localStorage.getItem('raen_auth_token');
  if (!_token) window.location.href = '../index.html';
  function logout() { localStorage.removeItem('raen_auth_token'); window.location.href = '../index.html'; }
  // Highlight current nav
  document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-item').forEach(a => {
      if (a.getAttribute('href') === page) a.classList.add('active');
    });
  });
</script>
```

---

### `stitch/admin/index.html` — Main Dashboard

Build a full Shopify-style dashboard with:

**Revenue stat cards (4 across):**
- Today's Revenue (EUR)
- This Week's Revenue
- This Month's Revenue
- Total Revenue All Time

**Order stat cards (5 across):**
- Total Orders
- Pending
- Processing
- Shipped
- Delivered

**Revenue Line Chart (Chart.js, last 30 days):**
- Fetch from `GET /api/admin/analytics?period=30`
- X axis: dates, Y axis: revenue EUR
- Line color: `#b8960c` (gold)

**Three column lower section:**
- Column 1 (40%): Recent Orders table (order number, customer email, total, status badge, date)
- Column 2 (30%): Low Stock Alerts (product name, size, stock count — red if ≤ 2, amber if ≤ 5)
- Column 3 (30%): Top 5 Products by Revenue (product name, total revenue)

**UPI Pending Verification alert banner** — if pendingUPIVerifications > 0, show red alert: "X UPI payments awaiting approval → View Payments"

Fetch from `GET /api/admin/dashboard-extended`.

---

### `stitch/admin/orders.html` — Order Management

**Filters bar (top):**
- Status dropdown: All / Pending / Paid / Processing / Shipped / Delivered / Cancelled / Refunded
- Date range: This week / This month / Last 3 months / All time
- Search box: filter by order number or customer email

**Orders table columns:**
Order # | Customer | Items | Total | Payment | Status | Date | Actions

**Actions per row:**
- "View" button → opens inline expandable row showing: shipping address, all order items with product name/size/qty/price, payment method
- Status dropdown to change: select new status → PATCH `/api/admin/orders/:id/status` body `{ status }`
- "Cancel" button (only if status is PENDING, PAID, or PROCESSING) → confirm dialog → POST `/api/admin/orders/:id/cancel`

**Pagination:** 20 per page, prev/next buttons.

Fetch: `GET /api/admin/orders`

---

### `stitch/admin/products.html` — Product Management

**Top bar:** Page title "Products" + "Add New Product" button (opens modal)

**Products table columns:**
Image (small 40px thumbnail from first image in JSON array) | Name | Price | Sale Price | Discount % | Status | Orders | Stock | Actions

**Actions per row:**
- "Edit" → opens edit modal pre-filled with product data
- "Stats" → opens stats panel showing: total orders, total revenue, page views (30d), cart adds (30d), conversion rate. Fetch `GET /api/admin/products/:id/stats`
- "Archive" → confirm dialog → DELETE `/api/admin/products/:id` (which archives, not true delete)

**Add/Edit Product Modal fields:**
- Name (text)
- Slug (text, auto-generated from name on add, editable)
- Description (textarea)
- Category (text)
- Price EUR (number)
- Sale Price EUR (number, optional — leave blank to clear discount)
- Discount % (number, optional — e.g. enter 20 for 20% off)
- Status (select: ACTIVE / DRAFT / ARCHIVED)
- Available Sizes (checkboxes: XS, S, M, L)
- Images (textarea, one path per line — team will add real file upload later)

On save: POST `/api/admin/products` (new) or PUT `/api/admin/products/:id` (edit).

**Important:** If both salePrice and discountPercent are provided, salePrice takes precedence. Show the effective display price on the table.

---

### `stitch/admin/inventory.html` — Inventory Management

**Low stock alert banner** if any item ≤ 3 stock.

**Table columns:**
Product Name | Size | SKU | In Stock | Reserved | Available (stock - reserved) | Last Updated | Edit

**Inline edit stock:** Click on stock number → turns into an input field → press Enter or click Save → PATCH `/api/admin/inventory/:id` body `{ stock: newValue }`.

**Bulk actions:**
- "Set all low stock to 10" button (any with stock ≤ 3) → confirm dialog → loop PATCH calls

**Sort by:** Product name, Stock (asc/desc).

Fetch: `GET /api/admin/inventory`

---

### `stitch/admin/payments.html` — Payments & UPI Approvals

**Tab 1: UPI Pending Verification**

Table columns: Order # | Customer Email | Amount | UPI Ref ID | Submitted At | Actions

Actions:
- "Approve" → PATCH `/api/admin/payments/:id/approve` → show success, remove row
- "Reject" → PATCH `/api/admin/payments/:id/reject` → confirm dialog → remove row

Fetch: `GET /api/admin/payments/pending-verification`

**Tab 2: All Payments**

Table columns: Order # | Provider (badge: RAZORPAY/PAYPAL/UPI) | Amount EUR | Status | Date

Filter by provider and status.

**Revenue summary cards:**
- Total Paid (all time)
- Razorpay total
- PayPal total
- UPI total

Fetch: `GET /api/admin/payments`

---

### `stitch/admin/customers.html` — Customer Management

**Stats cards:**
- Total Customers
- New This Month

**Search:** filter by name or email (client-side on loaded data).

**Table columns:**
Name | Email | Phone | Orders | Total Spent | Joined | View

"View" → expandable row showing their last 5 orders.

Fetch: `GET /api/admin/customers`

---

### `stitch/admin/analytics.html` — Full Analytics Dashboard

**Period selector:** 7 days / 30 days / 90 days (updates all charts)

**Funnel stats cards (5 across):**
- Total Page Views
- Unique Sessions
- Product Page Views
- Add to Cart Events
- Completed Purchases

**Conversion funnel visual** (horizontal bar or stepped):
Sessions → Product Views → Cart Adds → Checkout Started → Completed
Show percentage at each step.

**3 Charts (Chart.js):**

Chart 1 — Revenue Over Time (line chart, gold line):
- X: dates, Y: EUR revenue per day

Chart 2 — Revenue by Payment Method (doughnut):
- Razorpay / PayPal / UPI, show amounts and percentages

Chart 3 — Top Products by Views (horizontal bar):
- Product names on Y axis, view count on X axis

**Two tables below charts:**

Table 1 — Top Products by Revenue:
Rank | Product | Orders | Units Sold | Revenue EUR

Table 2 — Top Products by Page Views (30d):
Rank | Product | Views | Cart Adds | Conversion %

Fetch all from: `GET /api/admin/analytics?period=30` (update period from selector).

---

### `stitch/admin/messages.html` — Inbox

**Tab 1: Contact Messages**

Table: Name | Email | Subject | Status badge | Date | Actions
Actions: "Mark Read" → PATCH status, "Reply" → opens mailto: link, full message expandable inline.

Fetch: `GET /api/admin/contact-messages`

**Tab 2: Early Access Requests**

Table: Name | Email | City | Interest | Status | Date | Actions
Actions: "Approve" / "Reject" → PATCH `/api/admin/early-access/:id/status`

Fetch: `GET /api/admin/early-access`

---

## TASK 9 — CUSTOMER LOGIN / REGISTER MODAL

Add to `stitch/index.html` (and identical code to collections.html, product-detail.html, shopping-bag.html, checkout.html):

**Nav change:** Find the shopping bag icon link in the nav. Before it, add a person icon or "Account" text link:
```html
<a id="auth-nav-btn" href="#" onclick="openAuthModal()" style="font-family:Helvetica;font-size:11px;letter-spacing:0.15em;color:inherit;text-decoration:none;">ACCOUNT</a>
```

**Modal HTML** (add before `</body>`):
```html
<div id="auth-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;">
  <div style="background:#fff;width:100%;max-width:400px;padding:40px;position:relative;margin:20px;">
    <button onclick="closeAuthModal()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;">×</button>
    <div style="display:flex;gap:0;margin-bottom:24px;border-bottom:1px solid #e5e5e5;">
      <button id="tab-login" onclick="switchTab('login')" style="flex:1;padding:10px;border:none;background:none;cursor:pointer;font-size:11px;letter-spacing:0.15em;border-bottom:2px solid #1a1a1a;">SIGN IN</button>
      <button id="tab-register" onclick="switchTab('register')" style="flex:1;padding:10px;border:none;background:none;cursor:pointer;font-size:11px;letter-spacing:0.15em;border-bottom:2px solid transparent;">CREATE ACCOUNT</button>
    </div>
    <!-- Login form -->
    <form id="login-form">
      <div style="margin-bottom:16px;"><label style="font-size:11px;letter-spacing:0.1em;display:block;margin-bottom:4px;">EMAIL</label><input type="email" id="login-email" required style="width:100%;padding:10px;border:1px solid #ddd;box-sizing:border-box;font-size:13px;"></div>
      <div style="margin-bottom:24px;"><label style="font-size:11px;letter-spacing:0.1em;display:block;margin-bottom:4px;">PASSWORD</label><input type="password" id="login-password" required style="width:100%;padding:10px;border:1px solid #ddd;box-sizing:border-box;font-size:13px;"></div>
      <button type="submit" style="width:100%;padding:12px;background:#1a1a1a;color:#fff;border:none;cursor:pointer;font-size:11px;letter-spacing:0.2em;">SIGN IN</button>
      <p id="login-error" style="color:#dc3545;font-size:12px;margin-top:8px;display:none;"></p>
    </form>
    <!-- Register form -->
    <form id="register-form" style="display:none;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div><label style="font-size:11px;letter-spacing:0.1em;display:block;margin-bottom:4px;">FIRST NAME</label><input type="text" id="reg-first" required style="width:100%;padding:10px;border:1px solid #ddd;box-sizing:border-box;font-size:13px;"></div>
        <div><label style="font-size:11px;letter-spacing:0.1em;display:block;margin-bottom:4px;">LAST NAME</label><input type="text" id="reg-last" required style="width:100%;padding:10px;border:1px solid #ddd;box-sizing:border-box;font-size:13px;"></div>
      </div>
      <div style="margin-bottom:16px;"><label style="font-size:11px;letter-spacing:0.1em;display:block;margin-bottom:4px;">EMAIL</label><input type="email" id="reg-email" required style="width:100%;padding:10px;border:1px solid #ddd;box-sizing:border-box;font-size:13px;"></div>
      <div style="margin-bottom:24px;"><label style="font-size:11px;letter-spacing:0.1em;display:block;margin-bottom:4px;">PASSWORD</label><input type="password" id="reg-password" required minlength="8" style="width:100%;padding:10px;border:1px solid #ddd;box-sizing:border-box;font-size:13px;"></div>
      <button type="submit" style="width:100%;padding:12px;background:#1a1a1a;color:#fff;border:none;cursor:pointer;font-size:11px;letter-spacing:0.2em;">CREATE ACCOUNT</button>
      <p id="reg-error" style="color:#dc3545;font-size:12px;margin-top:8px;display:none;"></p>
    </form>
  </div>
</div>
<script>
function openAuthModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }
function switchTab(tab) {
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').style.borderBottomColor = tab === 'login' ? '#1a1a1a' : 'transparent';
  document.getElementById('tab-register').style.borderBottomColor = tab === 'register' ? '#1a1a1a' : 'transparent';
}
document.addEventListener('DOMContentLoaded', () => {
  // Check if logged in
  const token = localStorage.getItem('raen_auth_token');
  const authBtn = document.getElementById('auth-nav-btn');
  if (token && authBtn) {
    authBtn.textContent = 'MY ACCOUNT';
    authBtn.setAttribute('href', 'account.html');
    authBtn.removeAttribute('onclick');
  }
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    try {
      const { data } = await apiPost('/auth/login', {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
      });
      setAuthToken(data.token);
      closeAuthModal();
      window.location.reload();
    } catch (err) {
      errEl.textContent = 'Invalid email or password.';
      errEl.style.display = 'block';
    }
  });
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('reg-error');
    errEl.style.display = 'none';
    try {
      const { data } = await apiPost('/auth/register', {
        firstName: document.getElementById('reg-first').value,
        lastName: document.getElementById('reg-last').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
      });
      setAuthToken(data.token);
      closeAuthModal();
      window.location.reload();
    } catch (err) {
      errEl.textContent = err.message || 'Registration failed. Try a different email.';
      errEl.style.display = 'block';
    }
  });
});
</script>
```

---

## TASK 10 — CUSTOMER ACCOUNT PAGE

Create `stitch/account.html`:

Complete page with same header/footer as other RAEN pages. Sections:

**Profile section:**
- Show: Full name, email
- Edit name/phone form → PUT `/api/account/profile`

**Order History section:**
Table: Order # (links to order-confirmation.html?orderNumber=X) | Date | Items | Total EUR | Status badge

Fetch: `GET /api/account/orders`

**Addresses section:**
List saved addresses as cards. Each has edit/delete.
- Add address: form (line1, line2, city, state, country, postcode)
- POST `/api/account/addresses`
- DELETE `/api/account/addresses/:id`

**Sign Out button** at bottom → clear token → redirect to index.html

**Auth gate at top of script:**
```javascript
const token = localStorage.getItem('raen_auth_token');
if (!token) window.location.href = 'index.html';
```

---

## TASK 11 — EXPOSE DISCOUNT PRICING ON PRODUCT DETAIL PAGE

In `stitch/product-detail.html`, after fetching product data, update the price display logic:

```javascript
// After fetching product:
const effectivePrice = product.salePrice || 
  (product.discountPercent ? product.price * (1 - product.discountPercent / 100) : null);

if (effectivePrice && effectivePrice < product.price) {
  priceEl.innerHTML = `
    <span style="text-decoration:line-through;color:#999;margin-right:8px;">€${product.price.toFixed(2)}</span>
    <span style="color:#b8960c;">€${effectivePrice.toFixed(2)}</span>
    ${product.discountPercent ? `<span style="font-size:11px;letter-spacing:0.1em;color:#b8960c;margin-left:8px;">${product.discountPercent}% OFF</span>` : ''}
  `;
} else {
  priceEl.textContent = `€${product.price.toFixed(2)}`;
}
```

Also update collections.html product cards with same logic.

---

## EXECUTION ORDER

Follow this exact order — each step depends on the previous:

1. Task 1 — Prisma migration (schema changes first, everything else depends on this)
2. Task 2 — Analytics backend routes (needed for tracking)
3. Task 3 — Add tracking script to all pages
4. Task 4 — Fix broken product links + delete old pages
5. Task 5 — Payment webhooks (test with Razorpay test webhook)
6. Task 6 — Contact form
7. Task 7 — Admin backend endpoints
8. Task 8 — All admin UI pages (use dashboard-extended endpoint)
9. Task 9 — Login/register modal (add to all nav pages)
10. Task 10 — Account page
11. Task 11 — Discount pricing on frontend

---

## TESTING AFTER EACH TASK

After Task 1: `npx prisma studio` → confirm PageView and CartEvent tables exist, Product has salePrice/discountPercent
After Task 4: `grep -r 'bare-obsession.html' stitch/` must return nothing
After Task 5: Trigger test webhook from Razorpay dashboard → order status changes in DB
After Task 8: Open `http://localhost:4173/admin/index.html` → dashboard loads with real data
After Task 9: Register a test account → token stored → nav shows "MY ACCOUNT"
After all tasks: Run full purchase test. Razorpay test card: 4111 1111 1111 1111, any CVV, any future expiry.

---

## STYLE GUIDELINES FOR ADMIN PAGES

- Font: Helvetica (system fallback)
- Primary dark: `#1a1a1a`
- Gold accent: `#b8960c`
- Background: `#f5f5f5`
- Cards: `#ffffff` with `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`
- Keep it functional — this is internal tooling, not a luxury consumer page
- Responsive minimum: must work on a 13" laptop (1280px)
- No animations or transitions needed in admin
- Every destructive action (cancel order, delete product, reject payment) must show a `confirm()` dialog before proceeding
