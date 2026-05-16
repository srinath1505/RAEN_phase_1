const crypto = require('crypto');

// In-memory reset token store: { token: { userId, email, expiry } }
// In production, replace with Redis or a DB table for multi-instance support.
const resetStore = new Map();

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function generateResetToken(userId, email) {
  // Invalidate any existing token for this user first
  for (const [t, rec] of resetStore.entries()) {
    if (rec.userId === userId) resetStore.delete(t);
  }

  const token  = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  resetStore.set(token, { userId, email, expiry });
  return token;
}

function validateResetToken(token) {
  const record = resetStore.get(token);
  if (!record) return null;
  if (Date.now() > record.expiry) {
    resetStore.delete(token);
    return null;
  }
  return record;
}

// Validate AND remove (single-use)
function consumeResetToken(token) {
  const record = validateResetToken(token);
  if (record) resetStore.delete(token);
  return record;
}

module.exports = { generateResetToken, validateResetToken, consumeResetToken };
