// ════════════════════════════════════════════════════════════════
// firebasedb.js  –  Firebase Firestore fetch interceptor
// แทนที่ localdb.js โดยใช้ Firestore แทน localStorage
// โหลดหลังจาก firebase-app-compat.js, firebase-auth-compat.js,
// firebase-firestore-compat.js และ firebase-functions-compat.js
// ════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CFG = {
    apiKey: "AIzaSyB25rtI2AYoyg3pTsdGj7ni8Hy866Mma7o",
    authDomain: "cumulative-record.firebaseapp.com",
    projectId: "cumulative-record",
    storageBucket: "cumulative-record.firebasestorage.app",
    messagingSenderId: "345967778434",
    appId: "1:345967778434:web:8feb05e345ad1fd222b29b"
  };

  if (!firebase.apps.length) firebase.initializeApp(CFG);
  const fdb   = firebase.firestore();
  const fauth = firebase.auth();
  const ffns  = firebase.app().functions('asia-southeast1');
  // เก็บ session ต่อแท็บเท่านั้น (ปิดแท็บ = ออกจากระบบ) ให้ตรงกับพฤติกรรมเดิมของแอปที่ใช้ sessionStorage
  fauth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});

  // ต้องตรงกับ syntheticEmail() ใน functions/index.js และ scripts/migrate-users-to-auth.js
  const AUTH_EMAIL_DOMAIN = 'cumulative-record.local';
  function syntheticEmail(userId) {
    return `${String(userId).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function mkRes(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const ok   = d => mkRes(Object.assign({ success: true }, d));
  const fail = m => mkRes({ success: false, message: m }, 400);
  const now  = () => new Date().toISOString();

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem('user_session')); } catch { return null; }
  }

  // ── Firestore wrappers ───────────────────────────────────────────
  async function fGet(col, id) {
    const s = await fdb.collection(col).doc(String(id)).get();
    return s.exists ? { _id: s.id, ...s.data() } : null;
  }
  async function fAll(col, wheres) {
    let q = fdb.collection(col);
    (wheres || []).forEach(([f, o, v]) => { q = q.where(f, o, v); });
    const s = await q.get();
    return s.docs.map(d => ({ _id: d.id, ...d.data() }));
  }
  async function fSet(col, id, data)    { await fdb.collection(col).doc(String(id)).set(data); }
  async function fMerge(col, id, data)  { await fdb.collection(col).doc(String(id)).set(data, { merge: true }); }
  async function fUpdate(col, id, data) { await fdb.collection(col).doc(String(id)).update(data); }
  async function fDel(col, id)          { await fdb.collection(col).doc(String(id)).delete(); }
  async function fAdd(col, data)        { const r = await fdb.collection(col).add(data); return r.id; }

  // อ่านเฉพาะ N เอกสารล่าสุดตามลำดับฟิลด์ แทนการ fAll ทั้งคอลเลกชันแล้วมาเรียง/ตัดในเครื่อง
  async function fRecent(col, orderField, dir, lim) {
    const s = await fdb.collection(col).orderBy(orderField, dir).limit(lim).get();
    return s.docs.map(d => ({ _id: d.id, ...d.data() }));
  }

  async function nextSeq(key) {
    const ref = fdb.collection('meta').doc('counters');
    let seq = 1;
    await fdb.runTransaction(async t => {
      const s = await t.get(ref);
      const d = s.exists ? s.data() : {};
      seq = (d[key] || 0) + 1;
      t.set(ref, { [key]: seq }, { merge: true });
    });
    return seq;
  }

  async function logAct(userId, action, detail) {
    const u = await fGet('users', userId).catch(() => null);
    await fAdd('logs', {
      user_id: userId, full_name: u?.full_name || userId,
      role: u?.role || '', action, details: detail || '',
      created_at: now(), ip_address: ''
    });
  }

  // ── Default classroom seeds ──────────────────────────────────────
  const DEFAULT_ROOMS = [
    { room_code:'ชคธ67-11', room_name:'ชคธ.67-11', year_level:'pvc3' },
    { room_code:'ชคธ67-21', room_name:'ชคธ.67-21', year_level:'pvc3' },
    { room_code:'ชคธ68-11', room_name:'ชคธ.68-11', year_level:'pvc2' },
    { room_code:'ชคธ68-12', room_name:'ชคธ.68-12', year_level:'pvc2' },
    { room_code:'ชคธ68-21', room_name:'ชคธ.68-21', year_level:'pvc2' },
    { room_code:'ชคธ69-11', room_name:'ชคธ.69-11', year_level:'pvc1' },
    { room_code:'ชคธ69-12', room_name:'ชคธ.69-12', year_level:'pvc1' },
    { room_code:'สทธ68-11', room_name:'สทธ.68-11', year_level:'pvs2' },
    { room_code:'สทธ68-21', room_name:'สทธ.68-21', year_level:'pvs2' },
    { room_code:'สทธ68-22', room_name:'สทธ.68-22', year_level:'pvs2' },
    { room_code:'สทธ68-23', room_name:'สทธ.68-23', year_level:'pvs2' },
    { room_code:'สทธ68-31', room_name:'สทธ.68-31', year_level:'pvs2' },
    { room_code:'สทธ69-11', room_name:'สทธ.69-11', year_level:'pvs1' },
    { room_code:'สทธ69-2',  room_name:'สทธ.69-2',  year_level:'pvs1' },
    { room_code:'สทธ69-3',  room_name:'สทธ.69-3',  year_level:'pvs1' },
    { room_code:'สทธ69-4',  room_name:'สทธ.69-4',  year_level:'pvs1' },
  ];

  async function seedIfNeeded() {
    try {
      const admin = await fGet('users', 'admin001');
      if (admin) return;
      const yr = String(new Date().getFullYear() + 543);
      const batch = fdb.batch();
      // Default users
      const users = [
        { user_id:'admin001', password:'password', role:'admin', full_name:'ผู้ดูแลระบบ', email:'', department:'', is_active:1, created_at:now(), last_login:null },
        { user_id:'T001', password:'password', role:'teacher', full_name:'อาจารย์ที่ปรึกษา', email:'', department:'คอมพิวเตอร์ธุรกิจดิจิทัล', is_active:1, created_at:now(), last_login:null },
        { user_id:'6701010001', password:'password', role:'student', full_name:'นายทดสอบ ระบบ', email:'', department:'', is_active:1, created_at:now(), last_login:null },
      ];
      users.forEach(u => batch.set(fdb.collection('users').doc(u.user_id), u));
      // Demo profile
      batch.set(fdb.collection('profiles').doc('6701010001'), { user_id:'6701010001', student_code:'6701010001', classroom_id:null, year_level:'pvc1', prefix:'นาย', first_name_th:'ทดสอบ', last_name_th:'ระบบ', gender:'male', nationality:'', form_status:'not_started', form_submitted_at:null, friends:[], health_checkups:[] });
      // Settings
      batch.set(fdb.collection('settings').doc('main'), { college_name:'', department_name:'แผนกวิชาคอมพิวเตอร์ธุรกิจดิจิทัล', current_academic_year: yr, current_semester:'1' });
      // Classrooms
      DEFAULT_ROOMS.forEach((r, i) => {
        const id = i + 1;
        batch.set(fdb.collection('classrooms').doc(String(id)), { id, room_code:r.room_code, room_name:r.room_name, year_level:r.year_level, program:'คอมพิวเตอร์ธุรกิจดิจิทัล', academic_year:yr, semester:1, is_active:1 });
      });
      batch.set(fdb.collection('meta').doc('counters'), { classroom_seq: DEFAULT_ROOMS.length });
      await batch.commit();
      console.info('[FirebaseDB] Seeded initial data ✓');
    } catch (e) {
      console.warn('[FirebaseDB] Seed skipped (may already exist):', e.message);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // AUTH
  // ════════════════════════════════════════════════════════════════

  async function doLogin(body) {
    const { user_id, password } = body;
    if (!user_id || !password) return fail('กรุณากรอกข้อมูล');

    // ล็อกอินด้วยอีเมลสังเคราะห์ (lowercase เสมอ) แต่ user_id จริงอาจมีตัวพิมพ์ใหญ่-เล็กปนกัน
    // (เช่น "Teach001") ต้องใช้ user_id ตามที่บันทึกไว้ตอนสร้างบัญชี (จาก custom claims หลัง
    // ยืนยันตัวตนสำเร็จ) ไม่ใช่ตามที่พิมพ์ในฟอร์ม ไม่งั้น fGet('users', ...) จะหา doc ไม่เจอ
    // เพราะ Firestore doc id เทียบตัวพิมพ์ใหญ่-เล็กตรงตัว — claim ชื่อ "login_id" ไม่ใช่ "user_id"
    // เพราะ "user_id" เป็นชื่อที่ Firebase สงวนไว้เท่ากับ uid เสมอ (ถูกเขียนทับตอนออก token จริง)
    let canonicalUserId;
    try {
      const cred = await fauth.signInWithEmailAndPassword(syntheticEmail(user_id), password);
      const tokenResult = await cred.user.getIdTokenResult();
      canonicalUserId = tokenResult.claims.login_id || user_id;
    } catch (e) {
      return fail('รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }

    const u = await fGet('users', canonicalUserId);
    if (!u || !u.is_active) { await fauth.signOut(); return fail('รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); }
    fUpdate('users', canonicalUserId, { last_login: now() });
    logAct(canonicalUserId, 'login', 'เข้าสู่ระบบสำเร็จ');

    let extra = {};
    if (u.role === 'teacher') {
      const tc    = await fAll('tc', [['teacher_id','==',canonicalUserId]]);
      const rooms = await fAll('classrooms');
      const cids  = tc.map(t => t.classroom_id);
      extra.classrooms        = rooms.filter(r => cids.includes(r.id));
      extra.teacher_classrooms = cids;
    }
    if (u.role === 'student') {
      const p = await fGet('profiles', canonicalUserId);
      if (p) {
        const rooms = await fAll('classrooms');
        const room  = rooms.find(r => r.id === p.classroom_id);
        extra.student_code = p.student_code;
        extra.classroom    = room?.room_name;
        extra.year_level   = p.year_level;
        extra.form_status  = p.form_status;
      }
    }
    return ok({ message:'เข้าสู่ระบบสำเร็จ', data:{ user_id:u.user_id, role:u.role, full_name:u.full_name, email:u.email||'', ...extra } });
  }

  // ════════════════════════════════════════════════════════════════
  // ADMIN
  // ════════════════════════════════════════════════════════════════

  async function doAdminDashboard() {
    const [users, profiles, rooms, recentLogs] = await Promise.all([
      fAll('users'), fAll('profiles'), fAll('classrooms'), fRecent('logs', 'created_at', 'desc', 20)
    ]);
    const sub = profiles.filter(p => p.form_status==='submitted').length;
    const ns  = profiles.filter(p => p.form_status!=='submitted').length;
    const gm  = {};
    profiles.forEach(p => { const g = (p.gender==='female'||['นางสาว','นาง'].includes(p.prefix))?'female':'male'; gm[g]=(gm[g]||0)+1; });
    const nm = {};
    const NAT_KNOWN = ['ไทย','เวียดนาม','ลาว','กัมพูชา'];
    const NAT_ORDER = ['ไทย','เวียดนาม','ลาว','กัมพูชา','อื่นๆ','ไม่ระบุ'];
    profiles.forEach(p => { const raw=(p.nationality||'').trim(); const n=raw===''?'ไม่ระบุ':NAT_KNOWN.includes(raw)?raw:'อื่นๆ'; nm[n]=(nm[n]||0)+1; });
    const byNat = NAT_ORDER.filter(k=>nm[k]).map(k=>({nationality:k,cnt:nm[k]}));
    const YEAR_ORDER = ['pvc1','pvc2','pvc3','pvs1','pvs2'];
    const ym = {};
    profiles.forEach(p => { if (p.year_level) ym[p.year_level]=(ym[p.year_level]||0)+1; });
    return ok({ data:{
      stats:{ total_students:users.filter(u=>u.role==='student'&&u.is_active).length, total_teachers:users.filter(u=>u.role==='teacher'&&u.is_active).length, total_classrooms:rooms.filter(r=>r.is_active).length, submitted_forms:sub, pending_forms:ns },
      statusDist:[{form_status:'submitted',cnt:sub},{form_status:'not_started',cnt:ns}].filter(x=>x.cnt),
      byGender:Object.entries(gm).map(([gender,cnt])=>({gender,cnt})),
      byNationality:byNat,
      byYearLevel:YEAR_ORDER.map(k=>({year_level:k,cnt:ym[k]||0})),
      recentActivity:recentLogs,
    }});
  }

  async function doGetUsers(params) {
    const role   = params.get('role') || '';
    const search = (params.get('search')||'').toLowerCase();
    const [users, profiles, rooms] = await Promise.all([fAll('users'), fAll('profiles'), fAll('classrooms')]);
    const data = users.filter(u => {
      if (role   && u.role !== role) return false;
      if (search && !u.user_id.toLowerCase().includes(search) && !(u.full_name||'').toLowerCase().includes(search)) return false;
      return true;
    }).map(u => {
      const p = profiles.find(x=>x.user_id===u.user_id);
      const r = p ? rooms.find(x=>x.id===p.classroom_id) : null;
      const { password:_, ...safe } = u;
      return { ...safe, student_code:p?.student_code||null, room_name:r?.room_name||null, year_level:p?.year_level||null, department:u.department||null };
    });
    return ok({ data, total:data.length });
  }

  async function doDeleteUser(body, session) {
    const u = await fGet('users', body.user_id);
    if (!u) return fail('ไม่พบผู้ใช้');
    const newActive = u.is_active ? 0 : 1;
    await fUpdate('users', body.user_id, { is_active:newActive });
    const msg = newActive ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ระงับผู้ใช้สำเร็จ';
    logAct(session?.user_id, 'delete_user', msg + ' ' + body.user_id);
    return ok({ message:msg });
  }

  // ── Admin: Classrooms ─────────────────────────────────────────

  async function doAdminGetClassrooms() {
    const [rooms, profiles, tc, users] = await Promise.all([fAll('classrooms'), fAll('profiles'), fAll('tc'), fAll('users')]);
    const data = rooms.filter(r=>r.is_active).map(r => {
      const sts  = profiles.filter(p=>p.classroom_id===r.id);
      const tids = tc.filter(t=>t.classroom_id===r.id).map(t=>t.teacher_id);
      return { ...r, student_count:sts.length, submitted_count:sts.filter(p=>p.form_status==='submitted').length, teachers:tids.map(tid=>users.find(u=>u.user_id===tid)?.full_name||tid).join(', ') };
    });
    return ok({ data });
  }

  async function doCreateClassroom(body, session) {
    const rooms = await fAll('classrooms');
    if (rooms.find(r=>r.room_code===body.room_code)) return fail('รหัสห้องนี้มีอยู่แล้ว');
    const id = await nextSeq('classroom_seq');
    const r = { id, room_code:body.room_code, room_name:body.room_name, year_level:body.year_level, program:body.program||'คอมพิวเตอร์ธุรกิจดิจิทัล', academic_year:body.academic_year, semester:Number(body.semester||1), is_active:1 };
    await fSet('classrooms', String(id), r);
    logAct(session?.user_id, 'create_classroom', `สร้างห้อง ${body.room_code}`);
    return ok({ message:'สร้างห้องเรียนสำเร็จ', id });
  }

  async function doUpdateClassroom(body, session) {
    const r = await fGet('classrooms', String(body.id));
    if (!r) return fail('ไม่พบห้องเรียน');
    const updates = {};
    ['room_code','room_name','year_level','program','academic_year','semester','is_active'].forEach(f => { if (f in body) updates[f] = f==='semester'?Number(body[f]):f==='is_active'?Number(body[f]):body[f]; });
    await fUpdate('classrooms', String(body.id), updates);
    logAct(session?.user_id, 'update_classroom', `แก้ไขห้อง ${r.room_code}`);
    return ok({ message:'แก้ไขห้องเรียนสำเร็จ' });
  }

  async function doDeleteClassroom(body, session) {
    const r = await fGet('classrooms', String(body.id));
    if (!r) return fail('ไม่พบห้องเรียน');
    await fDel('classrooms', String(body.id));
    const tc = await fAll('tc', [['classroom_id','==',body.id]]);
    await Promise.all(tc.map(t => fDel('tc', t._id)));
    const profiles = await fAll('profiles', [['classroom_id','==',body.id]]);
    await Promise.all(profiles.map(p => fUpdate('profiles', p.user_id, { classroom_id:null })));
    logAct(session?.user_id, 'delete_classroom', `ลบห้อง ${r.room_code}`);
    return ok({ message:'ลบห้องเรียนสำเร็จ' });
  }

  async function doResetClassrooms(session) {
    const rooms = await fAll('classrooms');
    const tc    = await fAll('tc');
    const batch = fdb.batch();
    rooms.forEach(r => batch.delete(fdb.collection('classrooms').doc(r._id)));
    tc.forEach(t => batch.delete(fdb.collection('tc').doc(t._id)));
    await batch.commit();
    const profiles = await fAll('profiles');
    await Promise.all(profiles.filter(p=>p.classroom_id!=null).map(p => fUpdate('profiles', p.user_id, { classroom_id:null })));
    await fMerge('meta', 'counters', { classroom_seq:0 });
    logAct(session?.user_id, 'reset_classrooms', 'เคลียร์ห้องเรียนทั้งหมด');
    return ok({ message:'เคลียร์ห้องเรียนทั้งหมดสำเร็จ' });
  }

  async function doGetActivityLogs(params) {
    const role   = params.get('role')||'';
    const search = (params.get('search')||'').toLowerCase();
    const lim    = Number(params.get('limit')||50);
    const offset = Number(params.get('offset')||0);

    // มีตัวกรอง role หรือค้นหาข้อความ: Firestore ไม่รองรับ full-text search และการรวม
    // where+orderBy คนละฟิลด์ต้องมี composite index (โปรเจกต์นี้ยังไม่ได้สร้างไว้) จึงอ่านเฉพาะ
    // เอกสารที่ตรง role (ถ้ามี) แล้วเรียง/กรอง/แบ่งหน้าในเครื่องแทนการดึงทั้งคอลเลกชันเสมอ
    if (role || search) {
      let logs = role ? await fAll('logs', [['role','==',role]]) : await fAll('logs');
      logs.sort((a,b) => b.created_at.localeCompare(a.created_at));
      if (search) logs = logs.filter(l=>(l.full_name||'').toLowerCase().includes(search)||(l.action||'').includes(search));
      return ok({ data:logs.slice(offset,offset+lim), total:logs.length });
    }

    // กรณีปกติ (ไม่มีตัวกรอง): อ่านเฉพาะเท่าที่หน้านี้ต้องใช้ + นับจำนวนทั้งหมดด้วย count()
    // แทนการอ่านทุกเอกสารในคอลเลกชัน logs ที่โตขึ้นเรื่อยๆ ทุกครั้งที่มีการใช้งานระบบ
    const [pageSnap, countSnap] = await Promise.all([
      fdb.collection('logs').orderBy('created_at','desc').limit(offset+lim).get(),
      fdb.collection('logs').count().get()
    ]);
    const logs = pageSnap.docs.slice(offset).map(d => ({ _id:d.id, ...d.data() }));
    return ok({ data:logs, total:countSnap.data().count });
  }

  async function doGetSettings() {
    const s = await fGet('settings','main') || {};
    const entries = Object.entries(s).filter(([k])=>k!=='_id').map(([setting_key,setting_value])=>({setting_key,setting_value}));
    return ok({ data:entries });
  }

  async function doSaveSettings(body) {
    await fMerge('settings', 'main', body.settings||{});
    return ok({ message:'บันทึกการตั้งค่าสำเร็จ' });
  }

  async function doExportStudents() {
    const [profiles, rooms] = await Promise.all([fAll('profiles'), fAll('classrooms')]);
    const data = profiles.map(p => {
      const r = rooms.find(x=>x.id===p.classroom_id);
      return { รหัสนักศึกษา:p.student_code, ชื่อ:p.first_name_th, นามสกุล:p.last_name_th, ห้องเรียน:r?.room_name||'', สถานะ:p.form_status, จังหวัด:p.province||'' };
    });
    return ok({ data });
  }

  async function doGetClassroomTeachers(params) {
    const cid   = Number(params.get('classroom_id'));
    const tc    = await fAll('tc', [['classroom_id','==',cid]]);
    const users = await fAll('users');
    return ok({ data:tc.map(t=>({ teacher_id:t.teacher_id, full_name:users.find(u=>u.user_id===t.teacher_id)?.full_name||t.teacher_id })) });
  }

  async function doGetAllAssignments() {
    const [tc, users, rooms] = await Promise.all([fAll('tc'), fAll('users'), fAll('classrooms')]);
    return ok({ data:tc.map(t=>({ classroom_id:t.classroom_id, teacher_id:t.teacher_id, full_name:users.find(u=>u.user_id===t.teacher_id)?.full_name||t.teacher_id, room_name:rooms.find(r=>r.id===t.classroom_id)?.room_name||String(t.classroom_id) })) });
  }

  async function doAssignTeacher(body) {
    const cid = Number(body.classroom_id); const tid = body.teacher_id;
    const tc  = await fAll('tc', [['teacher_id','==',tid]]);
    if (!tc.find(t=>t.classroom_id===cid)) await fAdd('tc', { teacher_id:tid, classroom_id:cid });
    return ok({ message:'มอบหมายอาจารย์สำเร็จ' });
  }

  async function doBulkAssignTeacher(body) {
    const tids = body.teacher_ids || [];
    const cids = (body.classroom_ids || []).map(Number);
    const existing = await fAll('tc');
    let count = 0;
    await Promise.all(tids.flatMap(tid => cids.map(async cid => {
      if (!existing.find(t=>t.teacher_id===tid&&t.classroom_id===cid)) { await fAdd('tc',{teacher_id:tid,classroom_id:cid}); count++; }
    })));
    return ok({ message:`มอบหมายสำเร็จ ${count} รายการ` });
  }

  async function doUnassignTeacher(body) {
    const cid = Number(body.classroom_id); const tid = body.teacher_id;
    const tc  = await fAll('tc', [['teacher_id','==',tid]]);
    const rec = tc.find(t=>t.classroom_id===cid);
    if (rec) await fDel('tc', rec._id);
    return ok({ message:'ยกเลิกการมอบหมายสำเร็จ' });
  }

  // ════════════════════════════════════════════════════════════════
  // TEACHER
  // ════════════════════════════════════════════════════════════════

  async function doTeacherGetClassrooms(session) {
    const [rooms, profiles, tc] = await Promise.all([fAll('classrooms'), fAll('profiles'), fAll('tc')]);
    const myIds = session?.role==='admin' ? rooms.map(r=>r.id) : tc.filter(t=>t.teacher_id===session?.user_id).map(t=>t.classroom_id);
    const data = rooms.filter(r=>r.is_active&&myIds.includes(r.id)).map(r => {
      const sts = profiles.filter(p=>p.classroom_id===r.id);
      return { ...r, student_count:sts.length, submitted_count:sts.filter(p=>p.form_status==='submitted').length };
    });
    return ok({ data });
  }

  async function doGetAllClassrooms() {
    const rooms = await fAll('classrooms');
    const data  = rooms.filter(r=>r.is_active).map(r=>({ id:r.id, room_code:r.room_code, room_name:r.room_name, year_level:r.year_level, academic_year:r.academic_year })).sort((a,b)=>(a.year_level||'').localeCompare(b.year_level||'')||a.room_code.localeCompare(b.room_code));
    return ok({ data });
  }

  async function doGetStudents(params, session) {
    const cid    = params.get('classroom_id') ? Number(params.get('classroom_id')) : null;
    const search = (params.get('search')||'').toLowerCase();
    const [profiles, users, rooms, tc] = await Promise.all([fAll('profiles'), fAll('users'), fAll('classrooms'), fAll('tc')]);
    const allowedIds = session?.role==='admin' ? null : tc.filter(t=>t.teacher_id===session?.user_id).map(t=>t.classroom_id);
    const data = profiles.filter(p => {
      if (allowedIds && !allowedIds.includes(p.classroom_id)) return false;
      if (cid && p.classroom_id !== cid) return false;
      if (search) {
        const name = `${p.first_name_th||''} ${p.last_name_th||''}`.toLowerCase();
        if (!name.includes(search) && !(p.student_code||'').toLowerCase().includes(search)) return false;
      }
      return true;
    }).map(p => {
      const r = rooms.find(x=>x.id===p.classroom_id);
      const u = users.find(x=>x.user_id===p.user_id);
      return { ...p, room_name:r?.room_name||null, room_code:r?.room_code||null, year_level:r?.year_level||p.year_level, full_name:u?.full_name||'', last_login:u?.last_login||null };
    });
    return ok({ data, total:data.length });
  }

  async function doSearchStudents(params) {
    const search      = (params.get('search')||'').toLowerCase();
    const excl        = params.get('exclude_classroom') ? Number(params.get('exclude_classroom')) : null;
    const roomYearLvl = params.get('room_year_level') || null;
    if (!search) return ok({ data:[] });
    const [users, profiles, rooms] = await Promise.all([fAll('users'), fAll('profiles'), fAll('classrooms')]);
    const data = users.filter(u=>u.role==='student'&&u.is_active).filter(u => {
      const p = profiles.find(x=>x.user_id===u.user_id);
      const name = `${p?.first_name_th||''} ${p?.last_name_th||''}`.toLowerCase();
      if (!name.includes(search) && !(p?.student_code||'').toLowerCase().includes(search) && !u.full_name.toLowerCase().includes(search)) return false;
      if (excl && p?.classroom_id === excl) return false;
      if (roomYearLvl && p?.year_level !== roomYearLvl) return false;
      return true;
    }).map(u => {
      const p = profiles.find(x=>x.user_id===u.user_id);
      const r = rooms.find(x=>x.id===p?.classroom_id);
      return { user_id:u.user_id, full_name:u.full_name, student_code:p?.student_code||u.user_id, prefix:p?.prefix||'', first_name_th:p?.first_name_th||'', last_name_th:p?.last_name_th||'', gender:p?.gender||'', classroom_id:p?.classroom_id||null, year_level:p?.year_level||null, room_name:r?.room_name||null };
    }).slice(0, 25);
    return ok({ data });
  }

  async function doAddAdvisoryRoom(body, session) {
    const rooms = await fAll('classrooms');
    let cid = Number(body.classroom_id||0);
    if (!cid) {
      if (rooms.find(r=>r.room_code===body.room_code)) return fail('รหัสห้องนี้มีอยู่แล้ว');
      const id = await nextSeq('classroom_seq');
      const r  = { id, room_code:body.room_code, room_name:body.room_name, year_level:body.year_level, program:body.program||'คอมพิวเตอร์ธุรกิจดิจิทัล', academic_year:body.academic_year, semester:Number(body.semester||1), is_active:1 };
      await fSet('classrooms', String(id), r);
      cid = id;
    }
    const tid = (session?.role==='admin'&&body.teacher_id) ? body.teacher_id : session?.user_id;
    const tc  = await fAll('tc', [['teacher_id','==',tid]]);
    if (!tc.find(t=>t.classroom_id===cid)) await fAdd('tc', { teacher_id:tid, classroom_id:cid });
    logAct(session?.user_id, 'add_advisory_room', `เพิ่มห้องที่ปรึกษา ${cid}`);
    return ok({ message:'เพิ่มห้องที่ปรึกษาสำเร็จ', classroom_id:cid });
  }

  async function doAddStudentToClassroom(body, session) {
    const p = await fGet('profiles', body.student_id);
    if (!p) return fail('ไม่พบนักศึกษา');
    const r = await fGet('classrooms', String(body.classroom_id));
    if (!r || p.year_level !== r.year_level) return fail('ระดับชั้นของนักศึกษาไม่ตรงกับห้องเรียน ไม่สามารถเพิ่มได้');
    await fUpdate('profiles', body.student_id, { classroom_id:Number(body.classroom_id) });
    logAct(session?.user_id, 'add_student_to_classroom', `เพิ่มนักศึกษา ${body.student_id} เข้าห้อง ${body.classroom_id}`);
    return ok({ message:'เพิ่มนักศึกษาเข้าห้องสำเร็จ' });
  }

  async function doSendNotification(body, session) {
    const profiles = await fAll('profiles');
    let rids = body.recipient_ids || [];
    if (body.classroom_id) rids = profiles.filter(p=>p.classroom_id===Number(body.classroom_id)&&p.form_status!=='submitted').map(p=>p.user_id);
    if (!rids.length) return fail('ไม่มีนักศึกษาที่ต้องการแจ้งเตือน');
    await Promise.all(rids.map(rid => fAdd('notifs', { sender_id:session?.user_id, recipient_id:rid, title:body.title, message:body.message||'', type:body.type||'reminder', is_read:0, created_at:now() })));
    logAct(session?.user_id, 'send_notification', `ส่งแจ้งเตือน "${body.title}" ถึง ${rids.length} คน`);
    return ok({ message:`ส่งการแจ้งเตือนถึง ${rids.length} คนสำเร็จ`, sent_count:rids.length });
  }

  async function doTeacherDashboard(session) {
    const [profiles, rooms, tc] = await Promise.all([fAll('profiles'), fAll('classrooms'), fAll('tc')]);
    const myIds = session?.role==='admin' ? rooms.map(r=>r.id) : tc.filter(t=>t.teacher_id===session?.user_id).map(t=>t.classroom_id);
    const mine  = profiles.filter(p=>myIds.includes(p.classroom_id));
    const sm = {};
    mine.forEach(p=>{ sm[p.form_status]=(sm[p.form_status]||0)+1; });
    const byClassroom = rooms.filter(r=>myIds.includes(r.id)).map(r => {
      const sts = mine.filter(p=>p.classroom_id===r.id);
      return { ...r, total:sts.length, submitted:sts.filter(p=>p.form_status==='submitted').length, not_started:sts.filter(p=>p.form_status==='not_started').length };
    });
    return ok({ data:{ status_counts:Object.entries(sm).map(([form_status,cnt])=>({form_status,cnt})), by_classroom:byClassroom, by_province:[] } });
  }

  async function doViewStudent(params) {
    const uid = params.get('student_id');
    const [p, u, rooms] = await Promise.all([fGet('profiles', uid), fGet('users', uid), fAll('classrooms')]);
    if (!p) return mkRes({ success:false, message:'ไม่พบนักศึกษา' }, 404);
    const r = rooms.find(x=>x.id===p.classroom_id);
    const profile = { ...p, room_name:r?.room_name, room_code:r?.room_code, year_level:r?.year_level||p.year_level, full_name:u?.full_name, last_login:u?.last_login };
    return ok({ data:{ profile, friends:p.friends||[], health_checkups:p.health_checkups||[] } });
  }

  async function doDeleteRoom(params, session) {
    const cid = Number(params.get('room_id'));
    const tc  = await fAll('tc', [['teacher_id','==',session?.user_id]]);
    const rec = tc.find(t=>t.classroom_id===cid);
    if (rec) await fDel('tc', rec._id);
    const remaining = await fAll('tc', [['classroom_id','==',cid]]);
    if (!remaining.length) {
      await fDel('classrooms', String(cid));
      const profs = await fAll('profiles', [['classroom_id','==',cid]]);
      await Promise.all(profs.map(p => fUpdate('profiles', p.user_id, { classroom_id:null })));
    }
    logAct(session?.user_id, 'delete_advisory_room', `ลบห้องที่ปรึกษา ${cid}`);
    return ok({ message:'ลบห้องที่ปรึกษาแล้ว' });
  }

  async function doDeleteStudent(params, session) {
    const uid = params.get('user_id');
    const p   = await fGet('profiles', uid);
    if (p) await fUpdate('profiles', uid, { classroom_id:null });
    logAct(session?.user_id, 'remove_student_from_room', `ลบนักศึกษา ${uid} ออกจากห้อง`);
    return ok({ message:'ลบนักศึกษาออกจากห้องแล้ว' });
  }

  async function doGetTeachers() {
    const users = await fAll('users');
    return ok({ data:users.filter(u=>u.role==='teacher'&&u.is_active).map(u=>({ user_id:u.user_id, full_name:u.full_name, email:u.email||'' })) });
  }

  // ════════════════════════════════════════════════════════════════
  // STUDENT
  // ════════════════════════════════════════════════════════════════

  async function doGetProfile(params, session) {
    const uid = params.get('user_id') || session?.user_id;
    const [p, u, rooms, notifs] = await Promise.all([fGet('profiles', uid), fGet('users', uid), fAll('classrooms'), fAll('notifs', [['recipient_id','==',uid],['is_read','==',0]])]);
    if (!p) return fail('ไม่พบข้อมูลนักศึกษา');
    const r = rooms.find(x=>x.id===p.classroom_id);
    const profile = { ...p, room_name:r?.room_name, room_code:r?.room_code, year_level:r?.year_level||p.year_level, academic_year:r?.academic_year, class_semester:r?.semester, full_name:u?.full_name, classroom_id:p.classroom_id };
    return ok({ data:{ profile, friends:p.friends||[], health_checkups:p.health_checkups||[], unread_notifications:notifs.length } });
  }

  async function doSaveProfile(body, session) {
    const uid    = body.user_id || session?.user_id;
    const p      = await fGet('profiles', uid);
    const status = body.form_status || 'not_started';
    const FIELDS = ['prefix','first_name_th','last_name_th','first_name_en','last_name_en','nickname','gender','date_of_birth','race','nationality','religion','blood_type','id_card_number','address_no','village_no','alley','road','subdistrict','district','province','postal_code','phone','email','siblings_same_both','siblings_younger_same_both','siblings_diff_father','siblings_younger_diff','father_name','father_alive','father_deceased_when','father_occupation','father_workplace','father_income','father_education','father_address','father_phone','father_email','father_other','mother_name','mother_alive','mother_deceased_when','mother_occupation','mother_workplace','mother_income','mother_education','mother_address','mother_phone','mother_email','mother_other','parent_status','parent_status_detail','current_address','current_phone','current_email','address_type','nearby_place','living_with','living_relation','guardian_name','guardian_occupation','guardian_workplace','guardian_education','guardian_address','guardian_phone','guardian_email','counselor_name','counselor_relation','counselor_address','counselor_postal','counselor_phone','chronic_disease','past_disease','allergy','surgery_history','vision_condition','hearing_condition','dental_condition','mental_behavior','special_abilities','route_map','student_code_pvs','form_status'];
    const updates = { form_status:status };
    FIELDS.forEach(f => { if (f in body && f !== 'user_id') updates[f] = body[f]; });
    if (status === 'submitted') updates.form_submitted_at = now();
    if (Array.isArray(body.friends))         updates.friends         = body.friends;
    if (Array.isArray(body.health_checkups)) updates.health_checkups = body.health_checkups;
    if (p) { await fUpdate('profiles', uid, updates); }
    else   { await fSet('profiles', uid, { user_id:uid, ...updates }); }
    logAct(uid, 'submit_form', `ส่งระเบียนสะสม สถานะ: ${status}`);
    return ok({ message:status==='submitted'?'ส่งระเบียนสะสมสำเร็จ!':'บันทึกข้อมูลสำเร็จ!' });
  }

  async function doGetNotifications(session) {
    const notifs = await fAll('notifs', [['recipient_id','==',session?.user_id]]);
    notifs.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const recent = notifs.slice(0, 20);
    // Mark as read
    const unread = notifs.filter(n=>!n.is_read);
    await Promise.all(unread.map(n => fUpdate('notifs', n._id, { is_read:1 })));
    return ok({ data:recent });
  }

  // เรียก Cloud Function (onCall) แล้วห่อผลลัพธ์ให้เป็น Response เหมือน mkRes()
  // เพื่อให้โค้ดฝั่ง client เดิม (เช่น admin.html submitUser()) ใช้ await res.json() ได้เหมือนเดิม
  async function callFn(name, body) {
    try {
      const res = await ffns.httpsCallable(name)(body);
      return mkRes(res.data);
    } catch (e) {
      return fail(e.message || 'เกิดข้อผิดพลาด');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ROUTER
  // ════════════════════════════════════════════════════════════════
  async function route(urlStr, options) {
    const url     = new URL(urlStr, location.href);
    const params  = url.searchParams;
    const action  = params.get('action') || '';
    const method  = (options?.method || 'GET').toUpperCase();
    const session = getSession();
    let body = {};
    if (options?.body) { try { body = JSON.parse(options.body); } catch {} }
    const path = url.pathname.replace(/\\/g, '/');

    if (path.endsWith('login.php'))  return doLogin(body);
    if (path.endsWith('logout.php')) { await fauth.signOut(); sessionStorage.removeItem('user_session'); return ok({ message:'ออกจากระบบแล้ว' }); }
    if (path.endsWith('config.php')) return ok({ mode:'firebasedb' });

    if (path.endsWith('admin.php')) {
      if (action==='dashboard')              return doAdminDashboard();
      if (action==='get_users')              return doGetUsers(params);
      if (action==='create_user')            return callFn('createUser', body);
      if (action==='update_user')            return callFn('updateUser', body);
      if (action==='delete_user')            return doDeleteUser(body, session);
      if (action==='remove_user')            return callFn('removeUser', body);
      if (action==='bulk_remove_users')      return callFn('bulkRemoveUsers', body);
      if (action==='get_classrooms')         return doAdminGetClassrooms();
      if (action==='create_classroom')       return doCreateClassroom(body, session);
      if (action==='update_classroom')       return doUpdateClassroom(body, session);
      if (action==='delete_classroom')       return doDeleteClassroom(body, session);
      if (action==='reset_classrooms')       return doResetClassrooms(session);
      if (action==='get_activity_logs')      return doGetActivityLogs(params);
      if (action==='get_settings')           return doGetSettings();
      if (action==='save_settings')          return doSaveSettings(body);
      if (action==='export_students')        return doExportStudents();
      if (action==='import_students')        return callFn('importStudents', body);
      if (action==='import_teachers')        return callFn('importTeachers', body);
      if (action==='get_classroom_teachers') return doGetClassroomTeachers(params);
      if (action==='get_all_assignments')    return doGetAllAssignments();
      if (action==='assign_teacher')         return doAssignTeacher(body);
      if (action==='bulk_assign_teacher')    return doBulkAssignTeacher(body);
      if (action==='unassign_teacher')       return doUnassignTeacher(body);
    }

    if (path.endsWith('teacher.php')) {
      if (action==='get_classrooms')            return doTeacherGetClassrooms(session);
      if (action==='get_all_classrooms')        return doGetAllClassrooms();
      if (action==='get_students')              return doGetStudents(params, session);
      if (action==='search_students')           return doSearchStudents(params);
      if (action==='add_advisory_room')         return doAddAdvisoryRoom(body, session);
      if (action==='add_student_to_classroom')  return doAddStudentToClassroom(body, session);
      if (action==='send_notification')         return doSendNotification(body, session);
      if (action==='dashboard')                 return doTeacherDashboard(session);
      if (action==='view_student')              return doViewStudent(params);
      if (action==='delete_room')               return doDeleteRoom(params, session);
      if (action==='delete_student')            return doDeleteStudent(params, session);
      if (action==='get_teachers')              return doGetTeachers();
    }

    if (path.endsWith('student.php')) {
      if (action==='get_profile')        return doGetProfile(params, session);
      if (action==='save_profile')       return doSaveProfile(body, session);
      if (action==='get_notifications')  return doGetNotifications(session);
      if (action==='check_session')      return ok({ data:{ user_id:session?.user_id, role:session?.role, full_name:session?.full_name } });
    }

    return mkRes({ success:false, message:'Invalid action' }, 400);
  }

  // ════════════════════════════════════════════════════════════════
  // FETCH INTERCEPTOR
  // ════════════════════════════════════════════════════════════════
  const _fetch = window.fetch.bind(window);
  window.fetch = async function (url, options) {
    const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.href : String(url));
    if (!urlStr.includes('api/')) return _fetch(url, options);
    return route(urlStr, options);
  };

  // ── init ──────────────────────────────────────────────────────
  seedIfNeeded();
  console.info('[FirebaseDB] Initialized ✓');

})();
