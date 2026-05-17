const crypto     = require('crypto');
const tokenStore = require('./tokenStore');

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

async function generateResetToken(userId, email) {
  await tokenStore.deleteResetTokensByUserId(userId); // invalidate any prior token for this user

  const token  = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  await tokenStore.setResetToken(token, { userId, email, expiry });
  return token;
}

async function validateResetToken(token) {
  const record = await tokenStore.getResetToken(token);
  if (!record) return null;
  if (Date.now() > record.expiry) {
    await tokenStore.deleteResetToken(token);
    return null;
  }
  return record;
}

// Validate AND remove (single-use)
async function consumeResetToken(token) {
  const record = await validateResetToken(token);
  if (record) await tokenStore.deleteResetToken(token);
  return record;
}

module.exports = { generateResetToken, validateResetToken, consumeResetToken };
