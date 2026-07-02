// ============================================================
// Firebase Service Layer — replaces all PHP API calls
// ============================================================
import { db } from '../../firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit,
  writeBatch, serverTimestamp, increment, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Session helpers ──────────────────────────────────────────
export function getSession() {
  try { return JSON.parse(localStorage.getItem('user_session')); } catch { return null; }
}
export function setSession(data) {
  localStorage.setItem('user_session', JSON.stringify(data));
}
export function clearSession() {
  localStorage.removeItem('user_session');
}

// ── Password hashing (bcryptjs via CDN) ─────────────────────
function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}
function verifyPassword(plain, hash) {
  // Support plain text (legacy) and bcrypt
  if (!hash.startsWith('$2')) return plain === hash;
  return bcrypt.compareSync(plain, hash);
}

// ── Activity log ────────────────────────────────────────────
async function logActivity(userId, action, entityType = null, entityId = null, details = null) {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      user_id: userId, action, entity_type: entityType,
      entity_id: entityId, details, created_at: serverTimestamp()
    });
  } catch {}
}

// ============================================================
// AUTH
// ============================================================
export async function login(userId, password) {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, message: 'ไม่พบรหัสผู้ใช้นี้ในระบบ' };
  const u = snap.data();
  if (!u.is_active) return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' };
  if (!verifyPassword(password, u.password)) return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };

  await updateDoc(ref, { last_login: serverTimestamp() });
  await logActivity(userId, 'login', 'auth', null, 'เข้าสู่ระบบสำเร็จ');

  const session = { user_id: u.user_id, role: u.role, full_name: u.full_name, email: u.email };

  // Extra data for redirect
  const extra = {};
  if (u.role === 'student') {
    extra.classroom_id = u.classroom_id || null;
    extra.student_code = u.student_code || null;
    extra.form_status  = u.form_status  || 'not_started';
  }
  if (u.role === 'teacher') {
    const tcSnap = await getDocs(query(collection(db, 'teacher_classrooms'), where('teacher_id', '==', userId)));
    extra.classroom_ids = tcSnap.docs.map(d => d.data().classroom_id);
  }

  setSession(session);
  return { success: true, message: 'เข้าสู่ระบบสำเร็จ', data: { ...session, ...extra } };
}

export function logout() {
  clearSession();
  window.location.href = 'index.html';
}

export function requireAuth(allowedRoles) {
  const s = getSession();
  if (!s) { window.location.href = 'index.html'; return null; }
  if (allowedRoles && !allowedRoles.includes(s.role)) { window.location.href = 'index.html'; return null; }
  return s;
}

// ============================================================
// USERS (Admin)
// ============================================================
export async function getUsers({ role = null, search = null } = {}) {
  let q = collection(db, 'users');
  const snaps = await getDocs(query(q, orderBy('role'), orderBy('created_at', 'desc')));
  let users = snaps.docs.map(d => { const u = { ...d.data() }; delete u.password; return u; });
  if (role) users = users.filter(u => u.role === role);
  if (search) {
    const s = search.toLowerCase();
    users = users.filter(u =>
      (u.user_id||'').toLowerCase().includes(s) ||
      (u.full_name||'').toLowerCase().includes(s) ||
      (u.email||'').toLowerCase().includes(s)
    );
  }
  return { success: true, data: users, total: users.length };
}

export async function createUser(data) {
  const { user_id, password, role, full_name, email, phone, department,
          student_code, classroom_id, year_level, prefix, first_name_th, last_name_th } = data;
  if (!user_id || !full_name) return { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น' };
  if (!password) return { success: false, message: 'กรุณากรอกรหัสผ่าน' };

  const ref = doc(db, 'users', user_id);
  const existing = await getDoc(ref);
  if (existing.exists()) return { success: false, message: 'รหัสผู้ใช้นี้มีอยู่แล้ว' };

  const userData = {
    user_id, role: role||'student', full_name, email: email||'', phone: phone||'',
    department: department||'', is_active: true,
    password: hashPassword(password),
    created_at: serverTimestamp(), last_login: null
  };
  if (role === 'student') {
    Object.assign(userData, {
      student_code: student_code || user_id,
      classroom_id: classroom_id || null,
      year_level: year_level || 'pvc1',
      prefix: prefix || 'นาย',
      first_name_th: first_name_th || '',
      last_name_th: last_name_th || '',
      form_status: 'not_started'
    });
  }
  await setDoc(ref, userData);
  await logActivity(data.created_by||'system', 'create_user', 'user', user_id, `สร้างผู้ใช้: ${full_name} (${role})`);
  return { success: true, message: 'สร้างผู้ใช้สำเร็จ' };
}

export async function updateUser(userId, data) {
  const ref = doc(db, 'users', userId);
  const updates = {};
  const allowed = ['full_name','email','phone','department','is_active','year_level'];
  allowed.forEach(f => { if (f in data) updates[f] = data[f]; });
  if (data.password) updates.password = hashPassword(data.password);
  await updateDoc(ref, updates);
  return { success: true, message: 'อัปเดตผู้ใช้สำเร็จ' };
}

export async function toggleUserActive(userId) {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { success: false, message: 'ไม่พบผู้ใช้' };
  const newActive = !snap.data().is_active;
  await updateDoc(ref, { is_active: newActive });
  return { success: true, message: newActive ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ระงับบัญชีผู้ใช้สำเร็จ' };
}

export async function removeUser(userId, currentUserId) {
  if (userId === currentUserId) return { success: false, message: 'ไม่สามารถลบบัญชีของตัวเองได้' };
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', userId));
  // Remove student profile sub-data
  const tcSnap = await getDocs(query(collection(db, 'teacher_classrooms'), where('teacher_id', '==', userId)));
  tcSnap.docs.forEach(d => batch.delete(d.ref));
  const ffSnap = await getDocs(query(collection(db, 'student_friends'), where('user_id', '==', userId)));
  ffSnap.docs.forEach(d => batch.delete(d.ref));
  const hcSnap = await getDocs(query(collection(db, 'health_checkups'), where('user_id', '==', userId)));
  hcSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return { success: true, message: 'ลบผู้ใช้ออกจากระบบสำเร็จ' };
}

export async function bulkRemoveUsers(userIds, currentUserId) {
  const ids = userIds.filter(id => id !== currentUserId);
  if (!ids.length) return { success: false, message: 'ไม่มีรายการที่เลือก' };

  let deleted = 0;
  // Firestore batch limit = 500 ops; delete in chunks
  const CHUNK = 400;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const uid of chunk) {
      batch.delete(doc(db, 'users', uid));
    }
    await batch.commit();
    deleted += chunk.length;
  }
  await logActivity(currentUserId, 'bulk_remove_users', 'user', null, `ลบผู้ใช้จำนวน ${deleted} คน`);
  return { success: true, message: `ลบสำเร็จ ${deleted} คน` };
}

export async function importUsers(users, createdBy) {
  let success = 0, failed = 0;
  for (const u of users) {
    const res = await createUser({ ...u, created_by: createdBy });
    if (res.success) success++; else failed++;
  }
  return { success: true, results: { success, failed }, message: `นำเข้าสำเร็จ ${success} คน (ล้มเหลว ${failed} คน)` };
}

// ============================================================
// CLASSROOMS (Admin)
// ============================================================
export async function getClassrooms() {
  const snaps = await getDocs(query(collection(db, 'classrooms'), orderBy('academic_year', 'desc'), orderBy('room_name')));
  const classrooms = await Promise.all(snaps.docs.map(async d => {
    const c = { id: d.id, ...d.data() };
    // Count students
    const stuSnap = await getDocs(query(collection(db, 'users'), where('classroom_id', '==', d.id), where('role', '==', 'student')));
    c.student_count = stuSnap.size;
    // Get teacher name
    if (c.teacher_id) {
      const tSnap = await getDoc(doc(db, 'users', c.teacher_id));
      c.teacher_name = tSnap.exists() ? tSnap.data().full_name : '';
    } else { c.teacher_name = ''; }
    return c;
  }));
  return { success: true, data: classrooms };
}

export async function createClassroom(data) {
  const { room_name, room_code, academic_year, semester, year_level, department, teacher_id } = data;
  if (!room_name) return { success: false, message: 'กรุณาระบุชื่อห้องเรียน' };
  const ref = await addDoc(collection(db, 'classrooms'), {
    room_name, room_code: room_code||'', academic_year: Number(academic_year)||2568,
    semester: Number(semester)||1, year_level: year_level||'pvc1',
    department: department||'', teacher_id: teacher_id||null,
    created_at: serverTimestamp()
  });
  if (teacher_id) {
    await addDoc(collection(db, 'teacher_classrooms'), { teacher_id, classroom_id: ref.id, created_at: serverTimestamp() });
  }
  return { success: true, message: 'สร้างห้องเรียนสำเร็จ', id: ref.id };
}

export async function updateClassroom(id, data) {
  const ref = doc(db, 'classrooms', id);
  const snap = await getDoc(ref);
  const old = snap.data();
  const updates = {};
  ['room_name','room_code','academic_year','semester','year_level','department','teacher_id'].forEach(f => {
    if (f in data) updates[f] = data[f];
  });
  await updateDoc(ref, updates);

  // Update teacher_classrooms if teacher changed
  if ('teacher_id' in data && data.teacher_id !== old.teacher_id) {
    if (old.teacher_id) {
      const oldTc = await getDocs(query(collection(db, 'teacher_classrooms'),
        where('teacher_id','==',old.teacher_id), where('classroom_id','==',id)));
      oldTc.docs.forEach(async d => await deleteDoc(d.ref));
    }
    if (data.teacher_id) {
      await addDoc(collection(db, 'teacher_classrooms'), { teacher_id: data.teacher_id, classroom_id: id, created_at: serverTimestamp() });
    }
  }
  return { success: true, message: 'อัปเดตห้องเรียนสำเร็จ' };
}

export async function deleteClassroom(id) {
  await deleteDoc(doc(db, 'classrooms', id));
  const tcSnap = await getDocs(query(collection(db, 'teacher_classrooms'), where('classroom_id','==',id)));
  tcSnap.docs.forEach(async d => await deleteDoc(d.ref));
  return { success: true, message: 'ลบห้องเรียนสำเร็จ' };
}

// ============================================================
// STUDENTS (Teacher/Admin)
// ============================================================
export async function getStudents({ classroom_id = null, year_level = null, form_status = null, search = null, teacher_id = null } = {}) {
  let q = query(collection(db, 'users'), where('role', '==', 'student'));
  const snaps = await getDocs(q);
  let students = snaps.docs.map(d => { const u = { ...d.data() }; delete u.password; return u; });

  if (teacher_id) {
    const tcSnap = await getDocs(query(collection(db, 'teacher_classrooms'), where('teacher_id','==', teacher_id)));
    const cids = tcSnap.docs.map(d => d.data().classroom_id);
    students = students.filter(s => cids.includes(s.classroom_id));
  }
  if (classroom_id) students = students.filter(s => s.classroom_id === classroom_id);
  if (year_level)   students = students.filter(s => s.year_level === year_level);
  if (form_status)  students = students.filter(s => (s.form_status||'not_started') === form_status);
  if (search) {
    const sv = search.toLowerCase();
    students = students.filter(s =>
      (s.user_id||'').toLowerCase().includes(sv) ||
      (s.full_name||'').toLowerCase().includes(sv) ||
      (s.student_code||'').toLowerCase().includes(sv)
    );
  }

  // Attach classroom name
  const classSnap = await getDocs(collection(db, 'classrooms'));
  const classMap = {};
  classSnap.docs.forEach(d => { classMap[d.id] = d.data().room_name; });
  students.forEach(s => { s.room_name = classMap[s.classroom_id] || ''; });

  return { success: true, data: students, total: students.length };
}

// ============================================================
// STUDENT PROFILE (Student/Teacher/Admin)
// ============================================================
export async function getStudentProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return { success: false, message: 'ไม่พบข้อมูลนักศึกษา' };
  const profile = { ...snap.data() }; delete profile.password;

  // Classroom info
  if (profile.classroom_id) {
    const cSnap = await getDoc(doc(db, 'classrooms', profile.classroom_id));
    if (cSnap.exists()) { Object.assign(profile, { room_name: cSnap.data().room_name, room_code: cSnap.data().room_code }); }
  }

  // Friends
  const fSnap = await getDocs(query(collection(db, 'student_friends'), where('user_id','==',userId), orderBy('sort_order')));
  const friends = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Health checkups
  const hSnap = await getDocs(query(collection(db, 'health_checkups'), where('user_id','==',userId), orderBy('academic_year'), orderBy('semester')));
  const health_checkups = hSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Unread notifications
  const nSnap = await getDocs(query(collection(db, 'notifications'), where('recipient_id','==',userId), where('is_read','==',false)));
  const unread_notifications = nSnap.size;

  return { success: true, data: { profile, friends, health_checkups, unread_notifications } };
}

export async function saveStudentProfile(userId, data, currentUserId) {
  if (userId !== currentUserId) {
    const s = getSession();
    if (s?.role !== 'admin' && s?.role !== 'teacher') return { success: false, message: 'Permission denied' };
  }

  const profileFields = [
    'prefix','first_name_th','last_name_th','first_name_en','last_name_en','nickname',
    'gender','date_of_birth','race','nationality','religion','blood_type','id_card_number',
    'address_no','village_no','alley','road','subdistrict','district','province','postal_code',
    'phone','email','siblings_same_both','siblings_younger_same_both','siblings_diff_father','siblings_younger_diff',
    'father_name','father_alive','father_deceased_when','father_occupation','father_workplace',
    'father_income','father_education','father_address','father_phone','father_email','father_other',
    'mother_name','mother_alive','mother_deceased_when','mother_occupation','mother_workplace',
    'mother_income','mother_education','mother_address','mother_phone','mother_email','mother_other',
    'parent_status','parent_status_detail',
    'current_address','current_phone','current_email','address_type','nearby_place','living_with','living_relation',
    'guardian_name','guardian_occupation','guardian_workplace','guardian_education',
    'guardian_address','guardian_phone','guardian_email',
    'counselor_name','counselor_relation','counselor_address','counselor_postal','counselor_phone',
    'chronic_disease','past_disease','allergy','surgery_history',
    'vision_condition','hearing_condition','dental_condition','mental_behavior',
    'special_abilities','route_map','student_code_pvs','form_status'
  ];

  const updates = {};
  profileFields.forEach(f => { if (f in data) updates[f] = data[f]; });
  if (data.form_status === 'submitted') updates.form_submitted_at = serverTimestamp();

  await updateDoc(doc(db, 'users', userId), updates);

  // Save friends
  if (Array.isArray(data.friends)) {
    const fSnap = await getDocs(query(collection(db, 'student_friends'), where('user_id','==',userId)));
    const batch = writeBatch(db);
    fSnap.docs.forEach(d => batch.delete(d.ref));
    data.friends.forEach((f, i) => {
      if (f.friend_name) {
        const ref = doc(collection(db, 'student_friends'));
        batch.set(ref, { user_id: userId, friend_name: f.friend_name||'', friend_school: f.friend_school||'', friend_phone: f.friend_phone||'', sort_order: i });
      }
    });
    await batch.commit();
  }

  // Save health checkups
  if (Array.isArray(data.health_checkups)) {
    const hSnap = await getDocs(query(collection(db, 'health_checkups'), where('user_id','==',userId)));
    const batch2 = writeBatch(db);
    hSnap.docs.forEach(d => batch2.delete(d.ref));
    data.health_checkups.forEach(hc => {
      const ref = doc(collection(db, 'health_checkups'));
      batch2.set(ref, { user_id: userId, academic_year: hc.academic_year||'', semester: Number(hc.semester)||1, checkup_date: hc.checkup_date||null, height: Number(hc.height)||null, weight: Number(hc.weight)||null, vision_left: hc.vision_left||'', vision_right: hc.vision_right||'', blood_pressure: hc.blood_pressure||'', notes: hc.notes||'' });
    });
    await batch2.commit();
  }

  await logActivity(userId, 'save_profile', 'record', null, `บันทึกระเบียนสะสม สถานะ: ${data.form_status||'in_progress'}`);
  return { success: true, message: data.form_status === 'submitted' ? 'ส่งระเบียนสะสมสำเร็จ!' : 'บันทึกข้อมูลสำเร็จ!' };
}

// ============================================================
// NOTIFICATIONS (Teacher → Student)
// ============================================================
export async function getNotifications(userId) {
  const snaps = await getDocs(query(collection(db, 'notifications'), where('recipient_id','==',userId), orderBy('created_at','desc'), limit(20)));
  const notes = await Promise.all(snaps.docs.map(async d => {
    const n = { id: d.id, ...d.data() };
    if (n.sender_id) {
      const sSnap = await getDoc(doc(db, 'users', n.sender_id));
      n.sender_name = sSnap.exists() ? sSnap.data().full_name : '';
    }
    return n;
  }));
  // Mark all as read
  const batch = writeBatch(db);
  snaps.docs.forEach(d => { if (!d.data().is_read) batch.update(d.ref, { is_read: true }); });
  await batch.commit();
  return { success: true, data: notes };
}

export async function sendNotification(senderId, recipientId, message, type = 'info') {
  await addDoc(collection(db, 'notifications'), { sender_id: senderId, recipient_id: recipientId, message, type, is_read: false, created_at: serverTimestamp() });
  return { success: true, message: 'ส่งข้อความสำเร็จ' };
}

// ============================================================
// ACTIVITY LOGS (Admin)
// ============================================================
export async function getActivityLogs({ limit: lim = 50 } = {}) {
  const snaps = await getDocs(query(collection(db, 'activity_logs'), orderBy('created_at','desc'), limit(lim)));
  const logs = await Promise.all(snaps.docs.map(async d => {
    const l = { id: d.id, ...d.data() };
    if (l.user_id) {
      const uSnap = await getDoc(doc(db, 'users', l.user_id));
      l.full_name = uSnap.exists() ? uSnap.data().full_name : l.user_id;
    }
    return l;
  }));
  return { success: true, data: logs };
}

// ============================================================
// TEACHER HELPERS
// ============================================================
export async function getTeacherClassrooms(teacherId) {
  const tcSnap = await getDocs(query(collection(db, 'teacher_classrooms'), where('teacher_id','==',teacherId)));
  const ids = tcSnap.docs.map(d => d.data().classroom_id);
  if (!ids.length) return { success: true, data: [] };
  const snaps = await getDocs(collection(db, 'classrooms'));
  const classrooms = snaps.docs.filter(d => ids.includes(d.id)).map(d => ({ id: d.id, ...d.data() }));
  return { success: true, data: classrooms };
}

export async function updateStudentFormStatus(teacherId, studentId, status, comment = '') {
  await updateDoc(doc(db, 'users', studentId), { form_status: status });
  if (comment) await sendNotification(teacherId, studentId, comment);
  return { success: true, message: 'อัปเดตสถานะสำเร็จ' };
}
