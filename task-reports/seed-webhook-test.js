// Task 5 — Test data seeder
// Run from anywhere: node task-reports/seed-webhook-test.js
// (uses absolute paths so it doesn't depend on CWD)

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');

// Load dotenv and Prisma from backend's node_modules (not CWD)
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND, '.env') });
const { PrismaClient } = require(path.join(BACKEND, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

async function main() {
  // Look up a real product (FK required on OrderItem.productId)
  const product = await prisma.product.findUnique({ where: { slug: 'bare-obsession' } });
  if (!product) {
    console.error('ERROR: bare-obsession product not found. Ensure products are seeded first.');
    process.exit(1);
  }

  // Clean up any leftover test data from a previous run
  await prisma.order.deleteMany({ where: { orderNumber: 'TEST-WEBHOOK-001' } });

  const order = await prisma.order.create({
    data: {
      orderNumber: 'TEST-WEBHOOK-001',
      email: 'test@raen.design',
      phone: '+91-9999999999',
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      subtotal: 100,
      tax: 0,
      shipping: 0,
      total: 100,
      currency: 'INR',
      shippingAddress: {
        line1: '123 Test Street',
        city: 'Mumbai',
        country: 'IN',
        postcode: '400001'
      },
      items: {
        create: [{
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          size: 'M',
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
        }]
      },
      payments: {
        create: [{
          provider: 'RAZORPAY',
          providerOrderId: 'order_TEST12345678',
          amount: 100,
          currency: 'INR',
          status: 'CREATED',
        }]
      }
    }
  });

  console.log('Seeded test order:', order.orderNumber, '(id:', order.id + ')');
  console.log('Payment providerOrderId: order_TEST12345678');
  console.log('Ready — run: node task-reports/test-webhook.js');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
