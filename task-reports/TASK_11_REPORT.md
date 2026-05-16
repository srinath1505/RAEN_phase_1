# Task 11 — Discount Pricing on Frontend

**Status:** COMPLETE ✅  
**Test results:** 70/70 passed, 0 failed, 0 skipped  
**Test runner:** `node task-reports/test-task11.js`

---

## What Was Done

Added discount price rendering to `product-detail.html` and `collections.html`. Also fixed a pre-existing broken slug extraction in `collections.html` that was silently preventing any dynamic price updates from taking effect.

---

## Files Changed

| File | Change |
|------|--------|
| `stitch/product-detail.html` | Replaced single price line with discount-aware block: strikethrough original + gold effective price + "X% OFF" badge |
| `stitch/collections.html` | Fixed broken slug extraction (regex replacing broken `.replace('.html','')`); added same discount price logic to product cards |

No backend changes — `salePrice` and `discountPercent` were already on the Product model and returned by `GET /api/products` and `GET /api/products/:slug` (Task 1).

---

## Price Rendering Logic (both pages)

```javascript
const effectivePrice = product.salePrice ||
    (product.discountPercent ? product.price * (1 - product.discountPercent / 100) : null);

if (effectivePrice && effectivePrice < product.price) {
    // Discount active: strikethrough original + gold effective + optional % badge
    priceEl.innerHTML =
        '<span style="text-decoration:line-through;color:#999;...">€original</span>' +
        '<span style="color:#b8960c;">€effective</span>' +
        (product.discountPercent ? '<span ...>X% OFF</span>' : '');
} else {
    // No discount: plain price
    priceEl.textContent = `€${price}`;
}
```

**Precedence:** `salePrice` wins over `discountPercent` (per spec). If `salePrice` is set, `discountPercent` badge is not shown (since % is unknown from a raw sale price).

**Guard:** `effectivePrice && effectivePrice < product.price` — if `effectivePrice` is zero/falsy, or somehow ≥ price, no discount UI is shown.

**Locale:** both pages use `toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` for consistent EUR formatting (e.g. `€2,400.00`).

---

## Pre-existing Bug Fixed (collections.html)

The slug extraction at line 887 used:
```javascript
const slug = href.replace('.html', '');
```

After Task 4 changed all hrefs to `product-detail.html?slug=the-sovereign`, this produced `product-detail?slug=the-sovereign` — which never matched any product in `productMap`. As a result, **no product cards were being updated dynamically** — static dollar prices (`$4,800`, `$2,400`, etc.) were showing instead of EUR prices from the DB.

Fixed to:
```javascript
const slugMatch = href.match(/slug=([^&]+)/);
const slug = slugMatch ? slugMatch[1] : href.replace('.html', '');
```

This correctly extracts `the-sovereign` from `product-detail.html?slug=the-sovereign`. All 12 product cards now receive DB prices and discount logic.

---

## Test Coverage

| Group | Description | Tests |
|-------|-------------|-------|
| A | Health check | 1 |
| B | Admin auth (token for product CRUD) | 1 |
| C | GET /api/products and /api/products/:slug return salePrice + discountPercent fields | 8 |
| D | Admin creates product with discountPercent=20; verifies price=1000, effective=800; updates with salePrice=750 | 10 |
| E | salePrice=750 wins over discountPercent=20 per spec formula; effectivePrice < price guard holds | 3 |
| F | product-detail.html: effectivePrice formula, strikethrough, gold colour, % OFF badge, fallback, innerHTML/textContent branches, locale, selector unchanged | 12 |
| G | collections.html: slug regex fix, effectivePrice formula, strikethrough, gold colour, % OFF badge, fallback, both branches, locale, .product-price selector | 15 |
| H | Node.js simulation: salePrice wins, discountPercent fallback, no discount (null), effectivePrice≥price guard, 0 edge cases, real product prices | 10 |
| I | Regression: priceEl selector, apiGet call, trackCart, productMap, apiGet in collections, href update, auth-modal, ACCOUNT link, /api/products endpoints | 10 |
| **Total** | | **70** |
