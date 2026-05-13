const config = require('../config/env');

/**
 * Calculate order totals
 * @param {number} subtotal - Subtotal amount
 * @returns {{ subtotal, tax, shipping, total }}
 */
function calculateTotals(subtotal) {
  const tax = subtotal * config.pricing.taxRate;
  const shipping = config.pricing.shippingFlatRate;
  const total = subtotal + tax + shipping;
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    shipping: parseFloat(shipping.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

module.exports = calculateTotals;
