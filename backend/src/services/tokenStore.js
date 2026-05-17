/**
 * M3 fix — pluggable token store for OTP records and password-reset tokens.
 *
 * Backend is selected via TOKEN_STORE env var:
 *   memory  — in-memory Maps (dev default, lost on restart)
 *   db      — Neon/Postgres via Prisma (survives restarts, zero extra infra)
 *   redis   — Redis via ioredis (survives restarts, recommended for multi-instance prod)
 *
 * Switch: set TOKEN_STORE=db or TOKEN_STORE=redis in backend/.env, then restart server.
 * The DB tables (OtpRecord, ResetTokenRecord) are always present in the schema — the backend
 * just ignores them when TOKEN_STORE != 'db'.
 */

const backend = (process.env.TOKEN_STORE || 'memory').trim();

// ─── MEMORY BACKEND (current dev default) ────────────────────────────────────
const otpMap   = new Map();
const resetMap = new Map();

const memoryStore = {
  // OTP
  async getOtp(phone)           { return otpMap.get(phone) || null; },
  async setOtp(phone, record)   { otpMap.set(phone, record); },
  async deleteOtp(phone)        { otpMap.delete(phone); },
  // Reset token
  async getResetToken(token)            { return resetMap.get(token) || null; },
  async setResetToken(token, record)    { resetMap.set(token, record); },
  async deleteResetToken(token)         { resetMap.delete(token); },
  async deleteResetTokensByUserId(uid)  {
    for (const [t, r] of resetMap.entries()) {
      if (r.userId === uid) resetMap.delete(t);
    }
  }
};

// ─── DB BACKEND ───────────────────────────────────────────────────────────────
function makeDbStore() {
  const prisma = require('../config/db');

  function toRecord(r) {
    return {
      code:     r.code,
      expiry:   r.expiry.getTime(),
      attempts: r.attempts,
      channel:  r.channel,
      sentAt:   r.sentAt.getTime()
    };
  }

  return {
    async getOtp(phone) {
      const r = await prisma.otpRecord.findUnique({ where: { phone } });
      return r ? toRecord(r) : null;
    },
    async setOtp(phone, rec) {
      const data = {
        code:     rec.code,
        expiry:   new Date(rec.expiry),
        attempts: rec.attempts,
        channel:  rec.channel,
        sentAt:   new Date(rec.sentAt)
      };
      await prisma.otpRecord.upsert({ where: { phone }, update: data, create: { phone, ...data } });
    },
    async deleteOtp(phone) {
      await prisma.otpRecord.deleteMany({ where: { phone } }).catch(() => {});
    },

    async getResetToken(token) {
      const r = await prisma.resetTokenRecord.findUnique({ where: { token } });
      if (!r) return null;
      return { userId: r.userId, email: r.email, expiry: r.expiry.getTime() };
    },
    async setResetToken(token, rec) {
      await prisma.resetTokenRecord.create({
        data: { token, userId: rec.userId, email: rec.email, expiry: new Date(rec.expiry) }
      });
    },
    async deleteResetToken(token) {
      await prisma.resetTokenRecord.deleteMany({ where: { token } }).catch(() => {});
    },
    async deleteResetTokensByUserId(uid) {
      await prisma.resetTokenRecord.deleteMany({ where: { userId: uid } }).catch(() => {});
    }
  };
}

// ─── REDIS BACKEND ────────────────────────────────────────────────────────────
function makeRedisStore() {
  const Redis  = require('ioredis');
  const redis  = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  const OTP_TTL   = 10 * 60;   // 10 minutes in seconds
  const RESET_TTL = 60 * 60;   // 1 hour in seconds

  redis.on('error', (err) => console.error('[tokenStore/redis] connection error:', err.message));

  return {
    async getOtp(phone) {
      const val = await redis.get(`otp:${phone}`);
      return val ? JSON.parse(val) : null;
    },
    async setOtp(phone, record) {
      await redis.set(`otp:${phone}`, JSON.stringify(record), 'EX', OTP_TTL);
    },
    async deleteOtp(phone) {
      await redis.del(`otp:${phone}`);
    },

    async getResetToken(token) {
      const val = await redis.get(`reset:${token}`);
      return val ? JSON.parse(val) : null;
    },
    async setResetToken(token, record) {
      await redis.set(`reset:${token}`, JSON.stringify(record), 'EX', RESET_TTL);
    },
    async deleteResetToken(token) {
      await redis.del(`reset:${token}`);
    },
    async deleteResetTokensByUserId(uid) {
      // SCAN is non-blocking (unlike KEYS). Password resets are infrequent so O(n) is acceptable.
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', 'reset:*', 'COUNT', 100);
        cursor = next;
        for (const key of keys) {
          const val = await redis.get(key);
          if (val) {
            try {
              const r = JSON.parse(val);
              if (r.userId === uid) await redis.del(key);
            } catch {}
          }
        }
      } while (cursor !== '0');
    }
  };
}

// ─── Export selected backend ──────────────────────────────────────────────────
let store;
if (backend === 'redis') {
  store = makeRedisStore();
  console.log('[tokenStore] backend: redis');
} else if (backend === 'db') {
  store = makeDbStore();
  console.log('[tokenStore] backend: db (Prisma/Postgres)');
} else {
  store = memoryStore;
  if (backend !== 'memory') {
    console.warn(`[tokenStore] unknown backend "${backend}", falling back to memory`);
  }
}

module.exports = store;
