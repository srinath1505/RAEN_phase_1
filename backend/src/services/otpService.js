const twilio = require('twilio');

// In-memory OTP store: { phone: { code, expiry, attempts, channel } }
// In production, replace with Redis for multi-instance support.
const otpStore = new Map();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromPhone = process.env.TWILIO_PHONE_NUMBER || '';
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

const isDevMode = !accountSid || accountSid.includes('PLACEHOLDER');

let twilioClient = null;
if (!isDevMode) {
  twilioClient = twilio(accountSid, authToken);
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalisePhone(phone) {
  // Ensure phone starts with +
  const stripped = phone.replace(/\s+/g, '');
  return stripped.startsWith('+') ? stripped : '+' + stripped;
}

async function sendOtp(phone, channel = 'sms') {
  const normPhone = normalisePhone(phone);

  const existing = otpStore.get(normPhone);
  if (existing && Date.now() < existing.sentAt + RESEND_COOLDOWN_MS) {
    const remainingSecs = Math.ceil((existing.sentAt + RESEND_COOLDOWN_MS - Date.now()) / 1000);
    throw new Error(`Please wait ${remainingSecs} seconds before requesting a new code.`);
  }

  const code = generateOtp();
  const expiry = Date.now() + OTP_EXPIRY_MS;

  otpStore.set(normPhone, { code, expiry, attempts: 0, channel, sentAt: Date.now() });

  if (isDevMode) {
    console.log(`\n[RAEN DEV OTP] ─────────────────────────`);
    console.log(`  Phone   : ${normPhone}`);
    console.log(`  Channel : ${channel}`);
    console.log(`  Code    : ${code}`);
    console.log(`  Expires : ${new Date(expiry).toISOString()}`);
    console.log(`─────────────────────────────────────────\n`);
    return { success: true, dev: true };
  }

  const messageBody = `Your RAEN verification code is: ${code}\nValid for 10 minutes. Do not share this code.`;

  if (channel === 'whatsapp') {
    const toWhatsApp = `whatsapp:${normPhone}`;
    await twilioClient.messages.create({ body: messageBody, from: fromWhatsApp, to: toWhatsApp });
  } else {
    await twilioClient.messages.create({ body: messageBody, from: fromPhone, to: normPhone });
  }

  return { success: true };
}

function verifyOtp(phone, code) {
  const normPhone = normalisePhone(phone);
  const record = otpStore.get(normPhone);

  if (!record) {
    return { valid: false, reason: 'No verification code found. Please request a new one.' };
  }
  if (Date.now() > record.expiry) {
    otpStore.delete(normPhone);
    return { valid: false, reason: 'Verification code has expired. Please request a new one.' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  record.attempts += 1;

  if (record.code !== String(code).trim()) {
    const remaining = MAX_ATTEMPTS - record.attempts;
    return {
      valid: false,
      reason: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Please request a new code.'
    };
  }

  otpStore.delete(normPhone);
  return { valid: true };
}

function clearOtp(phone) {
  otpStore.delete(normalisePhone(phone));
}

module.exports = { sendOtp, verifyOtp, clearOtp, normalisePhone };
