const crypto = require('crypto');

/**
 * Generate a unique session ID for guest users
 */
function generateSessionId() {
  return `session_${crypto.randomBytes(16).toString('hex')}`;
}

module.exports = generateSessionId;
