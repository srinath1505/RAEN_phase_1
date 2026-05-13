# RAEN Phase 1 — Sprint Task List

**Goal:** Launch-ready store in 1-2 days  
**Scope:** Phase 1 only (8 deliverables)  
**Budget:** Rs. 65,000  

---

## Before You Start

1. Clone the repo and complete README setup steps
2. Confirm backend is running: `curl http://localhost:5000/health`
3. Confirm frontend loads: open http://localhost:4173
4. Have Prisma Studio open to verify DB changes: `npm run prisma:studio`

Do tasks **in order** — some depend on previous ones.

---

## TASK 1 — Fix Broken Product Links
**Time:** 30 minutes  
**Files:** `stitch/index.html`, `stitch/collections.html`

**What to do:**
- Find all `href="bare-obsession.html"`, `href="serpentine.html"`, etc. across every HTML file
- Replace each with `href="product-detail.html?slug=bare-obsession"` (match slug to filename)
- Run this to find all remaining old links after your changes:
  ```bash
  grep -r 'bare-obsession.html\|black-pearl.html\|crimson-vice.html\|emerald-sin.html\|midnight-venom.html\|poison-kiss.html\|serpentine.html\|taupe-wrap.html\|the-ivory-weapon.html\|the-provocateur.html\|the-sovereign.html\|velvet-scandal.html' stitch/
  ```
- Once grep returns nothing, delete all 12 old product HTML files from `stitch/`

**Done when:** No old `.html` product hrefs remain, clicking any product on homepage loads `product-detail.html`

---

## TASK 2 — Payment Webhooks + Database Transaction
**Time:** 3-4 hours  
**Files:** `backend/src/controllers/paymentController.js`, `backend/src/services/paymentService.js`

**Context:** Lines 101-118 in `paymentController.js` are stubs — they just return `{ received: true }`.

### Razorpay webhook (replace the stub):

```javascript
exports.razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expected) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    if (event.event === 'payment.captured') {
      const razorpayOrderId = event.payload.payment.entity.order_id;
      // Wrap everything in a transaction
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({ where: { razorpayOrderId } });
        if (!payment) throw new Error('Payment not found');
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } });
        await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED', paymentStatus: 'PAID' } });
        const orderItems = await tx.orderItem.findMany({ where: { orderId: payment.orderId } });
        for (const item of orderItems) {
          await tx.inventory.updateMany({
            where: { productId: item.productId, size: item.size },
            data: { stock: { decrement: item.quantity } }
          });
        }
      });
      // Send confirmation email (non-blocking)
      const order = await prisma.order.findUnique({
        where: { id: (await prisma.payment.findFirst({ where: { razorpayOrderId } })).orderId },
        include: { items: true }
      });
      emailService.sendOrderConfirmation(order).catch(console.error);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};
```

### PayPal webhook (same pattern):
- Verify `PayPal-Transmission-Sig` header using PayPal SDK
- On event `PAYMENT.CAPTURE.COMPLETED`: same transaction pattern as above
- Use `event.resource.supplementary_data.related_ids.order_id` to find your order

**Done when:** 
- Place a test order with Razorpay test card (4111 1111 1111 1111)
- Order status changes to CONFIRMED in Prisma Studio
- Confirmation email arrives in inbox

---

## TASK 3 — Contact Form Integration
**Time:** 20 minutes  
**File:** `stitch/contact.html`

**What to do:**
1. Add before `</body>`:
   ```html
   <script src="public/js/api.js"></script>
   ```
2. Find the form element and add a submit handler:
   ```javascript
   document.addEventListener('DOMContentLoaded', () => {
     const form = document.querySelector('form');
     if (!form) return;
     form.addEventListener('submit', async (e) => {
       e.preventDefault();
       const data = {
         name: form.querySelector('[name="name"]').value,
         email: form.querySelector('[name="email"]').value,
         subject: form.querySelector('[name="subject"]')?.value || 'Enquiry',
         message: form.querySelector('[name="message"]').value,
       };
       try {
         await apiPost('/contact', data);
         showToast('Message sent. We will be in touch.', 'success');
         form.reset();
       } catch (err) {
         showToast('Something went wrong. Please try again.', 'error');
       }
     });
   });
   ```

**Done when:** Submit contact form → message appears in Prisma Studio `ContactMessage` table

---

## TASK 4 — Admin Authorization Verification
**Time:** 30 minutes  
**File:** `backend/src/prisma/schema.prisma`, `backend/src/middleware/adminMiddleware.js`

**What to do:**
1. Read `adminMiddleware.js` — confirm it checks `user.role === 'ADMIN'`
2. Read the `User` model in `schema.prisma` — confirm `role` field exists with `ADMIN` enum value
3. Test admin route: 
   ```bash
   # Get a token by logging in as admin
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@raen.design","password":"YourSecurePassword123!"}'
   
   # Use token to hit admin route
   curl http://localhost:5000/api/admin/dashboard \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```
4. If admin route returns 401/403, the middleware needs fixing before building the dashboard UI

**Done when:** Admin login returns token and `/api/admin/dashboard` returns stats JSON

---

## TASK 5 — Admin Dashboard UI
**Time:** 6-8 hours  
**Files:** Create new folder `stitch/admin/` with 4 pages

### Pages to build:

**`stitch/admin/index.html`** — Dashboard home
- Stats cards: total orders, total revenue, pending orders, UPI verifications pending
- Fetch: `GET /api/admin/dashboard`
- Link to all other admin pages in sidebar nav

**`stitch/admin/orders.html`** — Order management
- Table: order number, customer email, total, status, date
- Fetch: `GET /api/admin/orders`
- Dropdown to update status: `PATCH /api/admin/orders/:id/status`
- Status options: PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED

**`stitch/admin/inventory.html`** — Stock management
- Table: product name, size, current stock
- Fetch: `GET /api/admin/inventory`
- Inline edit stock: `PATCH /api/admin/inventory/:id`

**`stitch/admin/payments.html`** — UPI payment approvals + customer list
- Pending UPI payments: `GET /api/admin/payments/pending-verification`
- Approve button: `PATCH /api/admin/payments/:id/approve`
- Reject button: `PATCH /api/admin/payments/:id/reject`
- Customer list below: `GET /api/admin/customers`

### Admin auth gate (add to top of every admin page script):
```javascript
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('raen_auth_token');
  if (!token) { window.location.href = '../index.html'; return; }
  // Proceed to load page data
});
```

### Admin UI style guidance:
- Keep it simple — black/white, clean table layout
- Does NOT need to match RAEN luxury aesthetic
- Functional over beautiful — this is internal tooling
- Use the same `api.js` helper for all fetch calls

**Done when:** 
- Can log in → navigate to `/admin/index.html` (via token in localStorage)
- Dashboard shows live order count and revenue
- Can update an order status
- Can update inventory stock number
- Can approve a UPI payment

---

## TASK 6 — Customer Login + Register Modal
**Time:** 3-4 hours  
**Files:** `stitch/index.html` (and replicate nav changes to all pages)

**What to do:**
1. Add a login/register icon to the nav (person icon or "Sign In" text)
2. Build a modal with two tabs: Login and Register
3. Login: `POST /api/auth/login` → store token via `setAuthToken(token)` (api.js handles this)
4. Register: `POST /api/auth/register` with `{ firstName, lastName, email, password }`
5. On success: close modal, update nav to show "My Account" link instead of "Sign In"
6. Logout: clear token with `removeAuthToken()`, reload page
7. On page load: check `getAuthToken()` — if exists, show account nav state

**Nav update needed on these pages:** `index.html`, `collections.html`, `product-detail.html`, `shopping-bag.html`, `checkout.html`

**Done when:** 
- Can register a new account
- Can log in and see nav change
- Token persists on page refresh
- Logout clears session

---

## TASK 7 — Customer Account + Order History Page
**Time:** 2-3 hours  
**File:** Create `stitch/account.html`

**What to build:**
- Redirect to homepage if no token found
- Profile section: `GET /api/account/profile` — show name, email
- Order history: `GET /api/account/orders` — table of past orders
  - Each row: order number (links to `order-confirmation.html?orderNumber=`), date, total, status badge
- Address management: `GET /api/account/addresses` — list saved addresses
  - Add address form: `POST /api/account/addresses`
  - Delete: `DELETE /api/account/addresses/:id`
- Logout button at bottom

**Done when:** Logged-in customer can see all their orders and manage addresses

---

## TASK 8 — Order Cancellation + Refund Flow
**Time:** 3-4 hours  
**Files:** `backend/src/controllers/adminController.js`, `backend/src/routes/adminRoutes.js`, `stitch/admin/orders.html`

### Backend — add to adminController.js:
```javascript
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id }, include: { payments: true, items: true }
    });
    if (!order) return error(res, 'Order not found', 404);

    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } });
      // Restore inventory
      for (const item of order.items) {
        await tx.inventory.updateMany({
          where: { productId: item.productId, size: item.size },
          data: { stock: { increment: item.quantity } }
        });
      }
      // Mark payment as refunded
      const payment = order.payments[0];
      if (payment) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      }
    });

    // Trigger Razorpay/PayPal refund (non-blocking)
    const payment = order.payments[0];
    if (payment?.razorpayPaymentId) {
      razorpayService.refundPayment(payment.razorpayPaymentId, order.total).catch(console.error);
    }

    return success(res, null, 'Order cancelled and refund initiated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
```

### Backend — add to adminRoutes.js:
```javascript
router.post('/orders/:id/cancel', adminMiddleware, adminController.cancelOrder);
```

### Frontend — add to `stitch/admin/orders.html`:
- Cancel button on each order row (only show for PENDING/CONFIRMED orders)
- On click: confirm dialog → `POST /api/admin/orders/:id/cancel` → refresh list

**Done when:** 
- Cancel button appears on eligible orders in admin
- Clicking cancel updates order to CANCELLED in DB
- Inventory stock is restored
- (Actual Razorpay refund requires webhook setup in Razorpay dashboard)

---

## Quick Test Checklist Before Marking Phase 1 Complete

Run through this end-to-end:

- [ ] Homepage loads, all product links work (no 404s)
- [ ] Collections page loads all 12 products from API
- [ ] Product detail page loads with correct product info
- [ ] Add to cart works, item appears in shopping bag
- [ ] Checkout form submits, Razorpay opens
- [ ] Complete a test payment (card: 4111 1111 1111 1111, any CVV/expiry)
- [ ] Order confirmation page shows order number
- [ ] Order confirmation email arrives in inbox
- [ ] Order appears in admin dashboard under Orders
- [ ] Admin can update order status to SHIPPED
- [ ] Admin can see and update inventory
- [ ] Customer can register a new account
- [ ] Customer can log in and see order history
- [ ] Contact form submits and appears in Prisma Studio
- [ ] Admin can cancel an order (inventory restored)

---

## Git Workflow for the Team

```bash
# Start your work
git pull origin main

# Create a branch for your task
git checkout -b task/webhooks        # example

# Work, then commit
git add .
git commit -m "Task 2: implement Razorpay and PayPal webhooks with DB transaction"

# Push and open a PR
git push origin task/webhooks
gh pr create --title "Task 2: Payment webhooks" --body "Closes webhook stubs, adds prisma transaction"
```

**Branch naming:** `task/task-number-short-description`  
**Commit messages:** `Task N: what you did`

---

## Contacts

For questions on backend API behaviour — check `backend/src/services/` first.  
For questions on frontend API calls — check `stitch/public/js/api.js`.  
For DB questions — run `npm run prisma:studio` and browse the tables live.
