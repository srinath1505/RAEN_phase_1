const crypto = require('crypto');

/**
 * Generate a unique order number
 */
function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RAEN-${timestamp}-${random}`;
}

module.exports = generateOrderNumber;
