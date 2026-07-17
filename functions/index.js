const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

const auth = admin.auth();
const db = admin.firestore();

// ต้องตรงกับ syntheticEmail() ฝั่ง client (assets/js/firebasedb.js) และ scripts/migrate-users-to-auth.js
const AUTH_EMAIL_DOMAIN = 'cumulative-record.local';
function syntheticEmail(userId) {
  return `${String(userId).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

function now() { return new Date().toISOString(); }

function requireAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบ');
  if (request.auth.token.role !== 'admin') throw new HttpsError('permission-denied', 'ต้องเป็นผู้ดูแลระบบเท่านั้น');
}

async function logAct(userId, action, detail) {
  try {
    const u = userId ? (await db.collection('users').doc(userId).get()).data() : null;
    await db.collection('logs').add({
      user_id: userId || '', full_name: u?.full_name || userId || '',
      role: u?.role || '', action, details: detail || '',
      created_at: now(), ip_address: ''
    });
  } catch (e) { console.warn('logAct failed', e); }
}

// ── createUser ──────────────────────────────────────────────────
// มิเรอร์ doCreateUser เดิมใน assets/js/firebasedb.js:236-249 แต่สร้างบัญชี
// Firebase Auth + ตั้ง custom claims แทนการเก็บ password ใน Firestore ตรงๆ
exports.createUser = onCall(async (request) => {
  requireAdmin(request);
  const body = request.data || {};
  if (!body.user_id || !body.full_name) throw new HttpsError('invalid-argument', 'กรุณากรอกข้อมูลที่จำเป็น');
  if (!body.password) throw new HttpsError('invalid-argument', 'กรุณากรอกรหัสผ่าน');

  const userId = String(body.user_id).trim();
  const existing = await db.collection('users').doc(userId).get();
  if (existing.exists) throw new HttpsError('already-exists', 'รหัสผู้ใช้นี้มีอยู่แล้ว');

  const role = body.role || 'student';
  let uid;
  try {
    const userRecord = await auth.createUser({
      email: syntheticEmail(userId),
      password: body.password,
      displayName: body.full_name,
    });
    uid = userRecord.uid;
    await auth.setCustomUserClaims(uid, { role, login_id: userId });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'รหัสผู้ใช้นี้มีอยู่แล้ว');
    throw new HttpsError('internal', 'สร้างบัญชีผู้ใช้ไม่สำเร็จ: ' + e.message);
  }

  const u = {
    user_id: userId, uid, role, full_name: body.full_name,
    email: body.email || '', department: body.department || '',
    is_active: body.is_active !== undefined ? Number(body.is_active) : 1,
    created_at: now(), last_login: null,
  };
  await db.collection('users').doc(userId).set(u);

  if (role === 'student') {
    const parts = u.full_name.replace(/นาย|นางสาว|นาง/g, '').trim().split(/\s+/);
    await db.collection('profiles').doc(userId).set({
      user_id: userId,
      student_code: body.student_code || userId,
      classroom_id: null,
      year_level: body.year_level || 'pvc1',
      prefix: body.prefix || (u.full_name.startsWith('นางสาว') ? 'นางสาว' : u.full_name.startsWith('นาง') ? 'นาง' : 'นาย'),
      first_name_th: body.first_name_th || parts[0] || '',
      last_name_th: body.last_name_th || parts.slice(1).join(' ') || '',
      gender: body.gender || '', nationality: '',
      form_status: 'not_started', form_submitted_at: null,
      friends: [], health_checkups: [],
    });
  }

  await logAct(request.auth.token.login_id, 'create_user', `สร้างผู้ใช้ ${userId}`);
  return { success: true, message: 'สร้างผู้ใช้สำเร็จ' };
});

// ── updateUser ──────────────────────────────────────────────────
// มิเรอร์ doUpdateUser เดิม (firebasedb.js:251-263)
exports.updateUser = onCall(async (request) => {
  requireAdmin(request);
  const body = request.data || {};
  if (!body.user_id) throw new HttpsError('invalid-argument', 'ไม่พบ user_id');
  const userId = String(body.user_id).trim();

  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'ไม่พบผู้ใช้');
  const u = snap.data();

  let authUser;
  try {
    authUser = await auth.getUserByEmail(syntheticEmail(userId));
  } catch (e) {
    throw new HttpsError('not-found', 'ไม่พบบัญชีผู้ใช้ใน Firebase Auth (อาจยังไม่ได้ทำ migration)');
  }

  const newRole = body.role ?? u.role;
  const authUpdates = {};
  if (body.password) authUpdates.password = body.password;
  if (body.full_name) authUpdates.displayName = body.full_name;
  if (Object.keys(authUpdates).length) await auth.updateUser(authUser.uid, authUpdates);
  if (newRole !== u.role) await auth.setCustomUserClaims(authUser.uid, { role: newRole, login_id: userId });

  const updates = {
    full_name: body.full_name ?? u.full_name,
    role: newRole,
    department: body.department ?? u.department,
    is_active: body.is_active !== undefined ? Number(body.is_active) : u.is_active,
  };
  await db.collection('users').doc(userId).update(updates);

  if (body.year_level !== undefined) {
    const p = await db.collection('profiles').doc(userId).get();
    if (p.exists) await db.collection('profiles').doc(userId).update({ year_level: body.year_level });
  }

  await logAct(request.auth.token.login_id, 'update_user', `แก้ไขผู้ใช้ ${userId}`);
  return { success: true, message: 'แก้ไขผู้ใช้สำเร็จ' };
});

// ── removeUser (hard delete) ───────────────────────────────────
// มิเรอร์ doRemoveUser เดิม (firebasedb.js:275-287)
exports.removeUser = onCall(async (request) => {
  requireAdmin(request);
  const body = request.data || {};
  if (!body.user_id) throw new HttpsError('invalid-argument', 'ไม่พบ user_id');
  const userId = String(body.user_id).trim();

  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'ไม่พบผู้ใช้');

  try {
    const authUser = await auth.getUserByEmail(syntheticEmail(userId));
    await auth.deleteUser(authUser.uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') console.warn('removeUser: auth delete failed', e);
  }

  const batch = db.batch();
  batch.delete(db.collection('users').doc(userId));
  batch.delete(db.collection('profiles').doc(userId));
  await batch.commit();

  const tc = await db.collection('tc').where('teacher_id', '==', userId).get();
  await Promise.all(tc.docs.map(d => d.ref.delete()));

  await logAct(request.auth.token.login_id, 'remove_user', `ลบผู้ใช้ ${userId} ถาวร`);
  return { success: true, message: 'ลบผู้ใช้ออกจากระบบสำเร็จ' };
});

// ── bulkRemoveUsers ─────────────────────────────────────────────
// มิเรอร์ doBulkRemoveUsers เดิม (firebasedb.js:289-309)
exports.bulkRemoveUsers = onCall(async (request) => {
  requireAdmin(request);
  const body = request.data || {};
  const ids = (body.user_ids || []).filter(id => id !== request.auth.token.login_id);
  if (!ids.length) throw new HttpsError('invalid-argument', 'ไม่มีรายการที่เลือก');

  for (const userId of ids) {
    try {
      const authUser = await auth.getUserByEmail(syntheticEmail(userId));
      await auth.deleteUser(authUser.uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') console.warn(`bulkRemoveUsers: auth delete failed for ${userId}`, e);
    }
  }

  const CHUNK = 250;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const batch = db.batch();
    chunk.forEach(uid => {
      batch.delete(db.collection('users').doc(uid));
      batch.delete(db.collection('profiles').doc(uid));
    });
    await batch.commit();
    deleted += chunk.length;
  }

  const allTc = await db.collection('tc').get();
  const toRemoveTc = allTc.docs.filter(d => ids.includes(d.data().teacher_id));
  await Promise.all(toRemoveTc.map(d => d.ref.delete()));

  await logAct(request.auth.token.login_id, 'bulk_remove_users', `ลบผู้ใช้จำนวน ${deleted} คน`);
  return { success: true, message: `ลบสำเร็จ ${deleted} คน` };
});

// ── importStudents ──────────────────────────────────────────────
// มิเรอร์ doImportStudents เดิม (firebasedb.js:415-446)
exports.importStudents = onCall(async (request) => {
  requireAdmin(request);
  const body = request.data || {};
  const students = body.students || [];
  const cid = body.classroom_id ? Number(body.classroom_id) : null;
  const yl = body.year_level || 'pvc1';
  const results = { success: 0, failed: 0, errors: [] };

  const codes = students.map(s => String(s.student_code || '').trim());
  const existingSet = new Set();
  // Firestore 'in' รองรับสูงสุด 30 ค่า/ครั้ง จึงเช็คทีละก้อน
  for (let i = 0; i < codes.length; i += 30) {
    const chunk = codes.slice(i, i + 30).filter(Boolean);
    if (!chunk.length) continue;
    const snap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.docs.forEach(d => existingSet.add(d.id));
  }

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const code = codes[i];
    if (!code) { results.failed++; continue; }
    if (existingSet.has(code)) { results.failed++; results.errors.push(`รหัส ${code} มีอยู่แล้ว`); continue; }

    const prefix = s.prefix || '';
    const fn = s.first_name_th || '';
    const ln = s.last_name_th || '';
    const gender = s.gender || (['นางสาว', 'นาง'].includes(prefix) ? 'female' : (prefix === 'นาย' ? 'male' : ''));
    const fullName = (prefix + fn + ' ' + ln).trim();

    let uid;
    try {
      const rec = await auth.createUser({ email: syntheticEmail(code), password: 'irpct1234!', displayName: fullName });
      uid = rec.uid;
      await auth.setCustomUserClaims(uid, { role: 'student', login_id: code });
    } catch (e) {
      results.failed++; results.errors.push(`รหัส ${code}: ${e.message}`); continue;
    }

    const batch = db.batch();
    batch.set(db.collection('users').doc(code), { user_id: code, uid, role: 'student', full_name: fullName, is_active: 1, created_at: now(), last_login: null });
    batch.set(db.collection('profiles').doc(code), { user_id: code, student_code: code, classroom_id: cid, year_level: yl, prefix, first_name_th: fn, last_name_th: ln, gender, nationality: '', form_status: 'not_started', form_submitted_at: null, friends: [], health_checkups: [] });
    await batch.commit();

    existingSet.add(code);
    results.success++;
  }

  await logAct(request.auth.token.login_id, 'import_students', `นำเข้า ${results.success} คน`);
  return { success: true, results, message: `นำเข้าสำเร็จ ${results.success} คน${results.failed ? `, ล้มเหลว ${results.failed} คน` : ''}` };
});

// ── importTeachers ──────────────────────────────────────────────
// มิเรอร์ doImportTeachers เดิม (firebasedb.js:448-472)
exports.importTeachers = onCall(async (request) => {
  requireAdmin(request);
  const body = request.data || {};
  const teachers = body.teachers || [];
  const results = { success: 0, failed: 0, errors: [] };

  const uids = teachers.map(t => String(t.user_id || '').trim());
  const existingSet = new Set();
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30).filter(Boolean);
    if (!chunk.length) continue;
    const snap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.docs.forEach(d => existingSet.add(d.id));
  }

  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    const userId = uids[i];
    if (!userId) { results.failed++; continue; }
    if (existingSet.has(userId)) { results.failed++; results.errors.push(`รหัส ${userId} มีอยู่แล้ว`); continue; }

    const prefix = t.prefix || 'อ.';
    const fn = t.first_name || '';
    const ln = t.last_name || '';
    const fullName = (prefix + fn + ' ' + ln).trim();
    const password = t.password || 'teacher@1234';

    let uid;
    try {
      const rec = await auth.createUser({ email: syntheticEmail(userId), password, displayName: fullName });
      uid = rec.uid;
      await auth.setCustomUserClaims(uid, { role: 'teacher', login_id: userId });
    } catch (e) {
      results.failed++; results.errors.push(`รหัส ${userId}: ${e.message}`); continue;
    }

    await db.collection('users').doc(userId).set({ user_id: userId, uid, role: 'teacher', full_name: fullName, department: t.department || '', is_active: 1, created_at: now(), last_login: null });

    existingSet.add(userId);
    results.success++;
  }

  await logAct(request.auth.token.login_id, 'import_teachers', `นำเข้าอาจารย์ ${results.success} คน`);
  return { success: true, results, message: `นำเข้าสำเร็จ ${results.success} คน${results.failed ? `, ล้มเหลว ${results.failed} คน` : ''}` };
});
