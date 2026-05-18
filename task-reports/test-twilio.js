/**
 * Twilio SMS test — run from project root:
 *   node task-reports/test-twilio.js
 */
require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const twilio = require('../backend/node_modules/twilio');

const SID   = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM  = process.env.TWILIO_PHONE_NUMBER;
const TO    = '+12267020094';

console.log('\n════════════════════════════════════════');
console.log('  RAEN — Twilio SMS Verification Test   ');
console.log('════════════════════════════════════════');
console.log(`  Account SID : ${SID}`);
console.log(`  From        : ${FROM}`);
console.log(`  To          : ${TO}`);
console.log('────────────────────────────────────────\n');

if (!SID || SID.includes('PLACEHOLDER')) {
  console.error('✗  TWILIO_ACCOUNT_SID is not set in .env');
  process.exit(1);
}

const client = twilio(SID, TOKEN);

async function run() {
  try {
    console.log('Sending SMS...');
    const msg = await client.messages.create({
      body: 'RAEN: Your test verification code is 123456. Twilio is working correctly!',
      from: FROM,
      to: TO
    });
    console.log('\n✓  Message sent successfully!');
    console.log(`   SID    : ${msg.sid}`);
    console.log(`   Status : ${msg.status}`);
    console.log('\n════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n✗  Send failed.');
    console.error(`   Code    : ${err.code}`);
    console.error(`   Message : ${err.message}`);

    if (err.code === 21608) {
      console.error('\n   → FIX: The number +12267020094 is not verified.');
      console.error('   → Go to: Twilio Console → Phone Numbers → Manage → Verified Caller IDs');
      console.error('   → Click "Add a new Caller ID" and add +12267020094');
      console.error('   → Twilio will call or text it once to confirm, then re-run this script.\n');
    } else if (err.code === 21211) {
      console.error('\n   → FIX: Invalid "To" phone number format.\n');
    } else if (err.code === 20003) {
      console.error('\n   → FIX: Authentication failed — check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.\n');
    }
    process.exit(1);
  }
}

run();
