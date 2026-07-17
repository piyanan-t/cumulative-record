/**
 * One-time migration: create a real Firebase Auth account for every existing
 * Firestore `users` document, preserving today's password 1:1 (confirmed
 * plaintext in production — bcryptjs is never loaded on any page, so the
 * app's hashPass()/verifyPass() always fall through to their plaintext
 * branch), and set custom claims { role, login_id } used by Cloud Functions
 * and firestore.rules. Claim key is "login_id", NOT "user_id" — Firebase
 * reserves "user_id" internally (always equals uid in the minted token, silently
 * overriding any custom claim with that name), which is exactly the bug that
 * broke every login the first time this migration ran.
 *
 * Run LOCALLY, never deploy this file. Requires a service account key:
 *   1. Firebase Console → Project settings → Service accounts →
 *      Generate new private key → save as functions/service-account.json
 *      (already gitignored — do not commit it).
 *   2. node scripts/migrate-users-to-auth.js --dry-run   (review output first)
 *   3. node scripts/migrate-users-to-auth.js              (apply for real — safe to
 *      re-run; existing Auth accounts just get their custom claims refreshed)
 *   4. node scripts/migrate-users-to-auth.js --strip-passwords
 *      (run once, only after step 3 is verified working — removes the now
 *      redundant plaintext `password` field from every users/ doc)
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'functions', 'service-account.json');
const AUTH_EMAIL_DOMAIN = 'cumulative-record.local'; // ต้องตรงกับ functions/index.js และ assets/js/firebasedb.js
function syntheticEmail(userId) {
  return `${String(userId).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const STRIP_PASSWORDS = args.includes('--strip-passwords');

let serviceAccount;
try {
  serviceAccount = require(SERVICE_ACCOUNT_PATH);
} catch (e) {
  console.error(`ไม่พบไฟล์ service account key ที่ ${SERVICE_ACCOUNT_PATH}`);
  console.error('ดาวน์โหลดจาก Firebase Console → Project settings → Service accounts → Generate new private key');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();
const db = admin.firestore();

async function migrate() {
  const snap = await db.collection('users').get();
  console.log(`พบผู้ใช้ทั้งหมด ${snap.size} คน${DRY_RUN ? ' (โหมด dry-run — ยังไม่มีการเปลี่ยนแปลงจริง)' : ''}`);

  let created = 0, skipped = 0, failed = 0;
  for (const doc of snap.docs) {
    const u = doc.data();
    const userId = doc.id;
    const email = syntheticEmail(userId);

    // เช็คว่ามีบัญชี Auth อยู่แล้วหรือยัง "ก่อน" เช็คว่ามี password ในเอกสารไหม เพราะหลังรัน
    // --strip-passwords ไปแล้ว ทุกเอกสารจะไม่มีฟิลด์ password อีกต่อไป (แต่ยังต้อง refresh
    // custom claims ให้ผู้ใช้ที่มีบัญชีอยู่แล้วได้อยู่ ไม่ควรข้ามไปทั้งหมด)
    let existing = null;
    try { existing = await auth.getUserByEmail(email); } catch { /* not found, expected */ }
    if (existing) {
      console.log(`[มีอยู่แล้ว] ${userId} -> uid ${existing.uid}, จะอัปเดต custom claims ให้ตรงกัน`);
      if (!DRY_RUN) await auth.setCustomUserClaims(existing.uid, { role: u.role, login_id: userId });
      skipped++;
      continue;
    }

    if (!u.password) {
      console.warn(`[ข้าม] ${userId}: ไม่มีรหัสผ่านในเอกสาร ไม่สามารถสร้างบัญชีใหม่ได้`);
      skipped++;
      continue;
    }

    console.log(`[จะสร้าง] ${userId} (${u.role}) -> ${email}`);
    if (DRY_RUN) { created++; continue; }

    try {
      const rec = await auth.createUser({ email, password: u.password, displayName: u.full_name || userId });
      await auth.setCustomUserClaims(rec.uid, { role: u.role, login_id: userId });
      await db.collection('users').doc(userId).update({ uid: rec.uid });
      created++;
    } catch (e) {
      console.error(`[ล้มเหลว] ${userId}: ${e.message}`);
      failed++;
    }
  }

  console.log('\n สรุปผล ');
  console.log(`สร้างใหม่: ${created}, ข้าม/มีอยู่แล้ว: ${skipped}, ล้มเหลว: ${failed}`);
  if (DRY_RUN) console.log('\n(นี่คือ dry-run — รันใหม่โดยไม่ใส่ --dry-run เพื่อสร้างจริง)');
}

async function stripPasswords() {
  const snap = await db.collection('users').get();
  console.log(`กำลังลบฟิลด์ password ออกจากเอกสารผู้ใช้ ${snap.size} คน...`);
  const BATCH = 400;
  let cleaned = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const chunk = snap.docs.slice(i, i + BATCH);
    const batch = db.batch();
    chunk.forEach(doc => {
      if ('password' in doc.data()) {
        batch.update(doc.ref, { password: admin.firestore.FieldValue.delete() });
        cleaned++;
      }
    });
    await batch.commit();
  }
  console.log(`ลบฟิลด์ password ออกจาก ${cleaned} เอกสารเรียบร้อย`);
}

(async () => {
  if (STRIP_PASSWORDS) {
    await stripPasswords();
  } else {
    await migrate();
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
