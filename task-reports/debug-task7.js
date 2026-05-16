const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND, '.env') });
const { PrismaClient } = require(path.join(BACKEND, 'node_modules', '@prisma', 'client'));
const http = require('http');
const prisma = new PrismaClient({ log: [] });

function req(method, urlPath, body, token) {
  return new Promise((resolve) => {
    const b = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: 'localhost', port: 5000, path: urlPath, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': b ? Buffer.byteLength(b) : 0, ...(token ? { 'Authorization': 'Bearer ' + token } : {}) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (b) r.write(b); r.end();
  });
}

async function test() {
  console.log('Step 1: pre-run cleanup via Prisma...');
  try {
    const d1 = await prisma.order.deleteMany({ where: { orderNumber: { startsWith: 'TEST-CANCEL-' } } });
    console.log('Orders deleted:', d1.count);
    const d2 = await prisma.product.deleteMany({ where: { slug: { startsWith: 'pro-test-gown-' } } });
    console.log('Products deleted:', d2.count);
  } catch (e) { console.log('Cleanup error:', e.message); }

  console.log('\nStep 2: admin login HTTP request...');
  const r = await req('POST', '/api/auth/login', { email: 'admin@raen.design', password: 'RaenAdmin2024!' });
  console.log('HTTP status:', r.status);
  console.log('Response success:', r.body?.success);
  console.log('data keys:', Object.keys(r.body?.data || {}));
  console.log('token present:', !!r.body?.data?.token);
  console.log('token value (first 20):', (r.body?.data?.token || '').slice(0, 20));

  await prisma.$disconnect();
}

test().catch(e => { console.error('Fatal:', e.message); prisma.$disconnect(); });
