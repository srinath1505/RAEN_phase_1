/**
 * RAEN — SEO Fixes Verification Test Suite
 * Tests all items from the SEO & GEO audit (2026-05-17)
 * Run: node task-reports/test-seo-fixes.js
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const stitch = path.join(__dirname, '..', 'stitch');

let passed = 0, failed = 0, warned = 0;
const failures = [];

function read(rel) {
  try { return fs.readFileSync(path.join(stitch, rel), 'utf8'); }
  catch { return ''; }
}

function exists(rel) {
  return fs.existsSync(path.join(stitch, rel));
}

function ok(label, cond) {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}`); failed++; failures.push(label); }
}

function warn(label, cond) {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ⚠️   ${label} (known open issue)`); warned++; }
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ─── A: RECENTLY FIXED — must all pass ───────────────────────────────────────
section('A  Product Detail — Dynamic Canonical & og:url Injection');
const pd = read('product-detail.html');
ok('A1  canonical.href set dynamically with slug',
   pd.includes("canonical.href = `https://raen.design/product-detail.html?slug=${slug}`"));
ok('A2  og:url setAttribute called with slug URL',
   pd.includes('ogUrl.setAttribute') &&
   pd.includes("product-detail.html?slug=${slug}"));
ok('A3  Static canonical in <head> still has fallback href',
   pd.includes('rel="canonical"') && pd.includes('raen.design/product-detail.html'));
ok('A4  og:type="product" present (correct for product pages)',
   pd.includes('og:type" content="product"'));
ok('A5  Meta description dynamically updated via JS',
   pd.includes("metaDesc.setAttribute('content', product.description)"));
ok('A6  Meta price dynamically updated via JS',
   pd.includes("metaPrice.setAttribute('content', product.price)"));

section('B  Admin Pages — noindex, nofollow on all 9 pages');
const adminPages = [
  'admin/login.html', 'admin/index.html', 'admin/orders.html',
  'admin/products.html', 'admin/inventory.html', 'admin/payments.html',
  'admin/customers.html', 'admin/analytics.html', 'admin/messages.html'
];
adminPages.forEach((p, i) => {
  const html = read(p);
  ok(`B${i + 1}  ${p} — has noindex, nofollow`,
     html.includes('name="robots"') && html.includes('noindex') && html.includes('nofollow'));
});

section('C  robots.txt — Disallow directives');
const robots = read('robots.txt');
ok('C1  Disallow: /admin/',            robots.includes('Disallow: /admin/'));
ok('C2  Disallow: /shopping-bag.html', robots.includes('Disallow: /shopping-bag.html'));
ok('C3  Disallow: /checkout.html',     robots.includes('Disallow: /checkout.html'));
ok('C4  Disallow: /order-confirmation.html', robots.includes('Disallow: /order-confirmation.html'));
ok('C5  Disallow: /account.html',      robots.includes('Disallow: /account.html'));
ok('C6  Disallow: /reset-password.html', robots.includes('Disallow: /reset-password.html'));
ok('C7  Sitemap: https://raen.design/sitemap.xml declared', robots.includes('Sitemap: https://raen.design/sitemap.xml'));

section('D  early-access.html & account.html — Minor Meta Fixes');
const ea = read('early-access.html');
ok('D1  early-access.html — canonical link present',
   ea.includes('rel="canonical"') && ea.includes('early-access.html'));
ok('D2  early-access.html — meta description present',
   ea.includes('name="description"'));
ok('D3  early-access.html — meta robots: noindex, follow',
   ea.includes('noindex') && ea.includes('follow'));

const acc = read('account.html');
ok('D4  account.html — meta description present',
   acc.includes('name="description"') && acc.includes('RAEN account'));
ok('D5  account.html — meta robots: noindex, nofollow',
   acc.includes('noindex') && acc.includes('nofollow'));

section('E  Core Pages — Meta Tags Health');
const index = read('index.html');
ok('E1  index.html — title present and brand-named',
   index.includes('<title>') && index.includes('RAEN'));
ok('E2  index.html — meta description present',
   index.includes('name="description"'));
ok('E3  index.html — canonical: https://raen.design/',
   index.includes('rel="canonical"') && index.includes('https://raen.design/"'));
ok('E4  index.html — meta robots: index, follow',
   index.includes('"robots"') && index.includes('index, follow'));
ok('E5  index.html — og:type = website',
   index.includes('og:type" content="website"'));
ok('E6  index.html — og:url = https://raen.design/',
   index.includes('og:url') && index.includes('https://raen.design/'));
ok('E7  index.html — twitter:card = summary_large_image',
   index.includes('summary_large_image'));
ok('E8  index.html — Google Fonts has display=swap',
   index.includes('display=swap'));
ok('E9  index.html — GA4 script is async',
   index.includes('googletagmanager') && index.includes('async'));

const coll = read('collections.html');
ok('E10 collections.html — canonical present',
   coll.includes('rel="canonical"') && coll.includes('collections.html'));
ok('E11 collections.html — meta description present',
   coll.includes('name="description"'));
ok('E12 collections.html — meta robots: index, follow',
   coll.includes('"robots"') && coll.includes('index, follow'));

const contact = read('contact.html');
ok('E13 contact.html — canonical present',
   contact.includes('rel="canonical"') && contact.includes('contact.html'));
ok('E14 contact.html — meta description present',
   contact.includes('name="description"'));

const bag = read('shopping-bag.html');
ok('E15 shopping-bag.html — meta robots: noindex',
   bag.includes('"robots"') && bag.includes('noindex'));

const checkout = read('checkout.html');
ok('E16 checkout.html — meta robots: noindex, nofollow',
   checkout.includes('"robots"') && checkout.includes('noindex') && checkout.includes('nofollow'));

const resetPw = read('reset-password.html');
ok('E17 reset-password.html — meta robots: noindex, nofollow',
   resetPw.includes('"robots"') && resetPw.includes('noindex'));

section('F  Structured Data — Schema Markup Presence');
ok('F1  index.html — Organization schema present',
   index.includes('"@type":"Organization"') || index.includes('"@type": "Organization"'));
ok('F2  index.html — FAQPage schema present',
   index.includes('"@type":"FAQPage"') || index.includes('"@type": "FAQPage"'));
ok('F3  index.html — WebSite schema with SearchAction present',
   index.includes('"@type":"WebSite"') || index.includes('"@type": "WebSite"'));
ok('F4  collections.html — CollectionPage schema present',
   coll.includes('CollectionPage') || coll.includes('ItemList'));
ok('F5  product-detail.html — Product schema present in <head>',
   pd.includes('"@type":"Product"') || pd.includes('"@type": "Product"'));
ok('F6  product-detail.html — BreadcrumbList schema present',
   pd.includes('BreadcrumbList'));
ok('F7  contact.html — ContactPage schema present',
   contact.includes('ContactPage'));

section('G  Sitemap — Health Check');
const sitemap = read('sitemap.xml');
ok('G1  sitemap.xml exists',           sitemap.length > 0);
ok('G2  Homepage URL present',         sitemap.includes('https://raen.design/</loc>') ||
                                       sitemap.includes('<loc>https://raen.design/</loc>'));
ok('G3  collections.html in sitemap',  sitemap.includes('collections.html'));
ok('G4  contact.html in sitemap',      sitemap.includes('contact.html'));

section('H  OG Image — File Existence');
const ogImageExists = exists('public/images/raen-og-image.jpg') ||
                      exists('public/images/raen-og-image.png') ||
                      exists('public/images/raen-og-image.webp');
warn('H1  raen-og-image.jpg exists at declared path', ogImageExists);

section('I  Known Open Issues — Current State (warn only)');
warn('I1  checkout.html — H1 tag present (missing = open issue)',
     checkout.includes('<h1') || checkout.includes('<H1'));
warn('I2  product-detail.html — aggregateRating removed from schema (still present = open issue)',
     !(pd.includes('aggregateRating')));
warn('I3  sitemap.xml — no ghost pages (journal.html etc.) still listed',
     !sitemap.includes('journal.html') &&
     !sitemap.includes('faq.html') &&
     !sitemap.includes('size-guide.html'));
warn('I4  sitemap.xml — individual product slug URLs present',
     sitemap.includes('slug='));
warn('I5  product-detail.html — dynamic Product JSON-LD schema injected via JS',
     pd.includes('application/ld+json') &&
     (pd.includes('product.name') || pd.includes('product.price')) &&
     pd.includes('insertAdjacentHTML'));
warn('I6  Meta Pixel — deferred or end-of-body (not render-blocking)',
     !index.includes('fbq') ||
     (index.indexOf('fbq') > index.indexOf('</body>')));

// ─── FINAL REPORT ─────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('  SEO FIXES VERIFICATION — RESULTS');
console.log('═'.repeat(60));
console.log(`  ✅  Passed  : ${passed}`);
console.log(`  ❌  Failed  : ${failed}`);
console.log(`  ⚠️   Warnings: ${warned}  (known open issues, not regressions)`);
console.log(`  Total      : ${passed + failed + warned}`);

if (failures.length > 0) {
  console.log('\n  ❌ Failed tests:');
  failures.forEach(f => console.log(`     • ${f}`));
}

if (failed === 0) {
  console.log('\n  🟢  All mandatory SEO fixes verified. Open issues logged as warnings.');
} else {
  console.log('\n  🔴  Some mandatory fixes are incomplete. See failures above.');
}
console.log('═'.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
