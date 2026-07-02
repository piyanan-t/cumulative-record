// ═══════════════════════════════════════════════════════════════
// localdb.js  –  localStorage database + fetch interceptor
// เมื่อ XAMPP ไม่ได้เปิด ระบบจะใช้ localStorage แทน MySQL
// โหลดไฟล์นี้ก่อน script อื่น ๆ ทุกไฟล์
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── helpers ──────────────────────────────────────────────────
  const P = 'ldb_';
  const db = {
    get: k => { try { return JSON.parse(localStorage.getItem(P + k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch {} },
    getOr: (k, d) => { const v = db.get(k); return v !== null ? v : (db.set(k, d), d); },
  };

  function nextId(table) {
    const s = db.getOr('_seq', {});
    const id = (s[table] || 1);
    s[table] = id + 1;
    db.set('_seq', s);
    return id;
  }

  function now() { return new Date().toISOString(); }

  function getSessionUser() {
    try { return JSON.parse(sessionStorage.getItem('user_session')); } catch { return null; }
  }

  function log(userId, action, detail) {
    const logs = db.getOr('logs', []);
    const users = db.getOr('users', []);
    const u = users.find(x => x.user_id === userId);
    logs.unshift({ id: nextId('log'), user_id: userId, full_name: u?.full_name || userId, role: u?.role || '', action, details: detail, created_at: now(), ip_address: '127.0.0.1' });
    if (logs.length > 500) logs.length = 500;
    db.set('logs', logs);
  }

  // ── mock Response ─────────────────────────────────────────────
  function res(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  function ok(data) { return res({ success: true, ...data }); }
  function fail(msg) { return res({ success: false, message: msg }, 400); }

  // ── seed 16 default classrooms ───────────────────────────────
  function seedDefaultClassrooms() {
    const currentYear = (new Date().getFullYear() + 543).toString();
    const OBSOLETE_CODES = ['ชทธ67-11','ชทธ67-12','ชทธ67-21','ชทธ67-22','ชทธ68-11','ชทธ68-12','ชทธ68-21','ชทธ68-22','ชทธ69-11','ชทธ69-12','ชทธ69-21','ชทธ69-22','สทธ68-11','สทธ68-12','สทธ69-12','สทธ69-21','สทธ69-22'];
    const DEFAULTS = [
      {room_code:'ชคธ67-11',room_name:'ชคธ.67-11',year_level:'pvc3',academic_year:currentYear,semester:1},
      {room_code:'ชคธ67-21',room_name:'ชคธ.67-21',year_level:'pvc3',academic_year:currentYear,semester:1},
      {room_code:'ชคธ68-11',room_name:'ชคธ.68-11',year_level:'pvc2',academic_year:currentYear,semester:1},
      {room_code:'ชคธ68-12',room_name:'ชคธ.68-12',year_level:'pvc2',academic_year:currentYear,semester:1},
      {room_code:'ชคธ68-21',room_name:'ชคธ.68-21',year_level:'pvc2',academic_year:currentYear,semester:1},
      {room_code:'ชคธ69-11',room_name:'ชคธ.69-11',year_level:'pvc1',academic_year:currentYear,semester:1},
      {room_code:'ชคธ69-12',room_name:'ชคธ.69-12',year_level:'pvc1',academic_year:currentYear,semester:1},
      {room_code:'สทธ68-11',room_name:'สทธ.68-11',year_level:'pvs2',academic_year:currentYear,semester:1},
      {room_code:'สทธ68-21',room_name:'สทธ.68-21',year_level:'pvs2',academic_year:currentYear,semester:1},
      {room_code:'สทธ68-22',room_name:'สทธ.68-22',year_level:'pvs2',academic_year:currentYear,semester:1},
      {room_code:'สทธ68-23',room_name:'สทธ.68-23',year_level:'pvs2',academic_year:currentYear,semester:1},
      {room_code:'สทธ68-31',room_name:'สทธ.68-31',year_level:'pvs2',academic_year:currentYear,semester:1},
      {room_code:'สทธ69-11',room_name:'สทธ.69-11',year_level:'pvs1',academic_year:currentYear,semester:1},
      {room_code:'สทธ69-2', room_name:'สทธ.69-2', year_level:'pvs1',academic_year:currentYear,semester:1},
      {room_code:'สทธ69-3', room_name:'สทธ.69-3', year_level:'pvs1',academic_year:currentYear,semester:1},
      {room_code:'สทธ69-4', room_name:'สทธ.69-4', year_level:'pvs1',academic_year:currentYear,semester:1},
    ];
    let rooms = db.getOr('classrooms', []);
    rooms = rooms.filter(r => !OBSOLETE_CODES.includes(r.room_code));
    let changed = true;
    DEFAULTS.forEach(d => {
      const idx = rooms.findIndex(r => r.room_code === d.room_code);
      if (idx < 0) {
        rooms.push({ id: nextId('classrooms'), program: 'คอมพิวเตอร์ธุรกิจดิจิทัล', is_active: 1, ...d });
      } else {
        rooms[idx] = { ...rooms[idx], room_name: d.room_name, year_level: d.year_level, academic_year: currentYear };
      }
    });
    if (changed) db.set('classrooms', rooms);
    db.set('_classrooms_seeded_v2', true);
  }

  // ── init data ─────────────────────────────────────────────────
  function initData() {
    if (!db.get('_init_v3')) {
      // Fresh install — ไม่มีข้อมูลเดิม
      ['users','classrooms','profiles','tc','notifs','logs','settings','_seq','_init_v2','_classrooms_seeded_v1','_classrooms_seeded_v2'].forEach(k => localStorage.removeItem(P + k));

      db.set('users', [
        { user_id: 'admin001', password: 'password', role: 'admin', full_name: 'ผู้ดูแลระบบ', is_active: 1, created_at: now(), last_login: null },
        { user_id: 'T001', password: 'password', role: 'teacher', full_name: 'อาจารย์ที่ปรึกษา', department: 'คอมพิวเตอร์ธุรกิจดิจิทัล', is_active: 1, created_at: now(), last_login: null },
        { user_id: '6701010001', password: 'password', role: 'student', full_name: 'นายทดสอบ ระบบ', is_active: 1, created_at: now(), last_login: null },
      ]);
      db.set('classrooms', []);
      db.set('profiles', [
        { id: 1, user_id: '6701010001', student_code: '6701010001', classroom_id: null, year_level: 'pvc1', prefix: 'นาย', first_name_th: 'ทดสอบ', last_name_th: 'ระบบ', gender: 'male', nationality: '', form_status: 'not_started', form_submitted_at: null },
      ]);
      db.set('tc', []);
      db.set('notifs', []);
      db.set('logs', []);
      db.set('settings', { college_name: '', department_name: 'แผนกวิชาคอมพิวเตอร์ธุรกิจดิจิทัล', current_academic_year: (new Date().getFullYear() + 543).toString(), current_semester: '1' });
      db.set('_seq', { classrooms: 1, profiles: 2, notifs: 1, log: 1 });
      db.set('_init_v3', true);
    }

    // Migration: เพิ่ม demo accounts โดยไม่ล้างข้อมูลเดิม
    if (!db.get('_migrated_demo')) {
      const users = db.getOr('users', []);
      const admin = users.find(u => u.user_id === 'admin001');
      if (admin && admin.password === 'admin1234') admin.password = 'password';
      if (!users.find(u => u.user_id === 'T001')) {
        users.push({ user_id: 'T001', password: 'password', role: 'teacher', full_name: 'อาจารย์ที่ปรึกษา', department: 'คอมพิวเตอร์ธุรกิจดิจิทัล', is_active: 1, created_at: now(), last_login: null });
      }
      if (!users.find(u => u.user_id === '6701010001')) {
        users.push({ user_id: '6701010001', password: 'password', role: 'student', full_name: 'นายทดสอบ ระบบ', is_active: 1, created_at: now(), last_login: null });
        const profiles = db.getOr('profiles', []);
        profiles.push({ id: nextId('profiles'), user_id: '6701010001', student_code: '6701010001', classroom_id: null, year_level: 'pvc1', prefix: 'นาย', first_name_th: 'ทดสอบ', last_name_th: 'ระบบ', gender: 'male', nationality: '', form_status: 'not_started', form_submitted_at: null });
        db.set('profiles', profiles);
      }
      db.set('users', users);
      db.set('_migrated_demo', true);
    }
  }

  // ════════════════════════════════════════════════════════════
  // HANDLERS
  // ════════════════════════════════════════════════════════════

  // ── Login ─────────────────────────────────────────────────────
  function doLogin(body) {
    const { user_id, password } = body;
    const users = db.getOr('users', []);
    const u = users.find(x => x.user_id === user_id && x.password === password && x.is_active);
    if (!u) return fail('รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');

    // update last_login
    db.set('users', users.map(x => x.user_id === user_id ? { ...x, last_login: now() } : x));

    let extra = {};
    if (u.role === 'teacher') {
      const tc = db.getOr('tc', []);
      const rooms = db.getOr('classrooms', []);
      extra.classrooms = tc.filter(t => t.teacher_id === user_id).map(t => rooms.find(r => r.id === t.classroom_id)).filter(Boolean);
      extra.teacher_classrooms = extra.classrooms.map(r => r.id);
    }
    if (u.role === 'student') {
      const p = db.getOr('profiles', []).find(x => x.user_id === user_id);
      const rooms = db.getOr('classrooms', []);
      const room = p ? rooms.find(r => r.id === p.classroom_id) : null;
      if (p) { extra.student_code = p.student_code; extra.classroom = room?.room_name; extra.year_level = room?.year_level; extra.form_status = p.form_status; }
    }

    localStorage.setItem('ldb_auth', 'local');
    log(user_id, 'login', 'เข้าสู่ระบบสำเร็จ');
    return ok({ message: 'เข้าสู่ระบบสำเร็จ', data: { user_id: u.user_id, role: u.role, full_name: u.full_name, email: u.email || '', ...extra } });
  }

  // ── Admin: Dashboard ──────────────────────────────────────────
  function doAdminDashboard() {
    const profiles = db.getOr('profiles', []);
    const users    = db.getOr('users', []);
    const rooms    = db.getOr('classrooms', []);
    const logs     = db.getOr('logs', []);

    const sub = profiles.filter(p => p.form_status === 'submitted').length;
    const ns  = profiles.filter(p => p.form_status !== 'submitted').length;

    const gm = {};
    profiles.forEach(p => { const g = (p.gender==='female'||['นางสาว','นาง'].includes(p.prefix)) ? 'female' : 'male'; gm[g] = (gm[g]||0)+1; });
    const nm = {};
    const NAT_KNOWN = ['ไทย','เวียดนาม','ลาว','กัมพูชา'];
    const NAT_ORDER = ['ไทย','เวียดนาม','ลาว','กัมพูชา','อื่นๆ','ไม่ระบุ'];
    profiles.forEach(p => { const raw=(p.nationality||'').trim(); const n=raw===''?'ไม่ระบุ':NAT_KNOWN.includes(raw)?raw:'อื่นๆ'; nm[n]=(nm[n]||0)+1; });
    const byNatSorted = NAT_ORDER.filter(k=>nm[k]).map(k=>({nationality:k,cnt:nm[k]}));
    const YEAR_ORDER = ['pvc1','pvc2','pvc3','pvs1','pvs2'];
    const ym = {};
    profiles.forEach(p => { if (p.year_level) ym[p.year_level] = (ym[p.year_level]||0)+1; });
    const byYearLevel = YEAR_ORDER.map(k => ({ year_level: k, cnt: ym[k]||0 }));

    return ok({ data: {
      stats: { total_students: users.filter(u=>u.role==='student'&&u.is_active).length, total_teachers: users.filter(u=>u.role==='teacher'&&u.is_active).length, total_classrooms: rooms.filter(r=>r.is_active).length, submitted_forms: sub, pending_forms: ns },
      statusDist: [{ form_status:'submitted',cnt:sub },{ form_status:'not_started',cnt:ns }].filter(x=>x.cnt),
      byGender: Object.entries(gm).map(([gender,cnt])=>({gender,cnt})),
      byNationality: byNatSorted,
      byYearLevel,
      recentActivity: logs.slice(0,20),
    }});
  }

  // ── Admin: Users ──────────────────────────────────────────────
  function doGetUsers(params) {
    const role   = params.get('role') || '';
    const search = (params.get('search')||'').toLowerCase();
    const users    = db.getOr('users', []);
    const profiles = db.getOr('profiles', []);
    const rooms    = db.getOr('classrooms', []);

    const data = users.filter(u => {
      if (role && u.role !== role) return false;
      if (search && !u.user_id.toLowerCase().includes(search) && !u.full_name.toLowerCase().includes(search)) return false;
      return true;
    }).map(u => {
      const p = profiles.find(x=>x.user_id===u.user_id);
      const r = p ? rooms.find(x=>x.id===p.classroom_id) : null;
      const { password:_, ...safe } = u;
      return { ...safe, student_code: p?.student_code||null, room_name: r?.room_name||null, year_level: p?.year_level||null, department: u.department||null };
    });

    return ok({ data, total: data.length });
  }

  function doCreateUser(body, session) {
    const users = db.getOr('users', []);
    if (users.find(u => u.user_id === body.user_id)) return fail('รหัสผู้ใช้นี้มีอยู่แล้ว');
    if (!body.user_id || !body.full_name) return fail('กรุณากรอกข้อมูลที่จำเป็น');
    if (!body.password) return fail('กรุณากรอกรหัสผ่าน');

    const newUser = { user_id: body.user_id, password: body.password, role: body.role||'student', full_name: body.full_name, email: body.email||'', department: body.department||'', is_active: body.is_active!==undefined?Number(body.is_active):1, created_at: now(), last_login: null };
    users.push(newUser);
    db.set('users', users);

    if (newUser.role === 'student') {
      const profiles = db.getOr('profiles', []);
      const nameParts = newUser.full_name.replace(/นาย|นางสาว|นาง/g,'').trim().split(/\s+/);
      profiles.push({ id: nextId('profiles'), user_id: newUser.user_id, student_code: body.student_code||newUser.user_id, classroom_id: null, year_level: body.year_level||'pvc1', prefix: body.prefix||(newUser.full_name.startsWith('นางสาว')?'นางสาว':newUser.full_name.startsWith('นาง')?'นาง':'นาย'), first_name_th: nameParts[0]||'', last_name_th: nameParts.slice(1).join(' ')||'', gender: body.gender||'', nationality:'', form_status:'not_started', form_submitted_at:null });
      db.set('profiles', profiles);
    }

    log(session?.user_id, 'create_user', `สร้างผู้ใช้ ${newUser.user_id}`);
    return ok({ message: 'สร้างผู้ใช้สำเร็จ' });
  }

  function doUpdateUser(body, session) {
    const users = db.getOr('users', []);
    const i = users.findIndex(u => u.user_id === body.user_id);
    if (i < 0) return fail('ไม่พบผู้ใช้');
    users[i] = { ...users[i], full_name: body.full_name??users[i].full_name, role: body.role??users[i].role, department: body.department??users[i].department, is_active: body.is_active!==undefined?Number(body.is_active):users[i].is_active };
    if (body.password) users[i].password = body.password;
    db.set('users', users);
    if (body.year_level !== undefined) {
      const profiles = db.getOr('profiles', []);
      const pi = profiles.findIndex(p=>p.user_id===body.user_id);
      if (pi>=0) { profiles[pi] = { ...profiles[pi], year_level: body.year_level }; db.set('profiles', profiles); }
    }
    log(session?.user_id, 'update_user', `แก้ไขผู้ใช้ ${body.user_id}`);
    return ok({ message: 'แก้ไขผู้ใช้สำเร็จ' });
  }

  function doDeleteUser(body, session) {
    const users = db.getOr('users', []);
    const i = users.findIndex(u => u.user_id === body.user_id);
    if (i < 0) return fail('ไม่พบผู้ใช้');
    const newActive = users[i].is_active ? 0 : 1;
    users[i] = { ...users[i], is_active: newActive };
    db.set('users', users);
    const msg = newActive ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ระงับผู้ใช้สำเร็จ';
    log(session?.user_id, 'delete_user', msg + ' ' + body.user_id);
    return ok({ message: msg });
  }

  function doRemoveUser(body, session) {
    if (!body.user_id) return fail('ไม่พบ user_id');
    const users = db.getOr('users', []);
    if (!users.find(u => u.user_id === body.user_id)) return fail('ไม่พบผู้ใช้');
    db.set('users', users.filter(u => u.user_id !== body.user_id));
    const profiles = db.getOr('profiles', []);
    db.set('profiles', profiles.filter(p => p.user_id !== body.user_id));
    try { localStorage.removeItem('student_form_' + body.user_id); } catch {}
    log(session?.user_id, 'remove_user', `ลบผู้ใช้ ${body.user_id} ถาวร`);
    return ok({ message: 'ลบผู้ใช้ออกจากระบบสำเร็จ' });
  }

  // ── Admin: Classrooms ─────────────────────────────────────────
  function doAdminGetClassrooms() {
    const rooms    = db.getOr('classrooms', []);
    const profiles = db.getOr('profiles', []);
    const tc       = db.getOr('tc', []);
    const users    = db.getOr('users', []);

    const data = rooms.filter(r=>r.is_active).map(r => {
      const sts = profiles.filter(p=>p.classroom_id===r.id);
      const tids = tc.filter(t=>t.classroom_id===r.id).map(t=>t.teacher_id);
      return { ...r, student_count: sts.length, submitted_count: sts.filter(p=>p.form_status==='submitted').length, teachers: tids.map(tid=>users.find(u=>u.user_id===tid)?.full_name||tid).join(', ') };
    });

    return ok({ data });
  }

  function doCreateClassroom(body, session) {
    const rooms = db.getOr('classrooms', []);
    if (rooms.find(r=>r.room_code===body.room_code)) return fail('รหัสห้องนี้มีอยู่แล้ว');
    const r = { id: nextId('classrooms'), room_code: body.room_code, room_name: body.room_name, year_level: body.year_level, program: body.program||'คอมพิวเตอร์ธุรกิจดิจิทัล', academic_year: body.academic_year, semester: Number(body.semester||1), is_active: 1 };
    rooms.push(r);
    db.set('classrooms', rooms);
    log(session?.user_id, 'create_classroom', `สร้างห้อง ${body.room_code}`);
    return ok({ message: 'สร้างห้องเรียนสำเร็จ', id: r.id });
  }

  function doUpdateClassroom(body, session) {
    const rooms = db.getOr('classrooms', []);
    const i = rooms.findIndex(r=>r.id===Number(body.id));
    if (i<0) return fail('ไม่พบห้องเรียน');
    rooms[i] = { ...rooms[i], ...body, id: rooms[i].id, is_active: body.is_active!==undefined?Number(body.is_active):rooms[i].is_active };
    db.set('classrooms', rooms);
    log(session?.user_id, 'update_classroom', `แก้ไขห้อง ${rooms[i].room_code}`);
    return ok({ message: 'แก้ไขห้องเรียนสำเร็จ' });
  }

  function doDeleteClassroom(body, session) {
    const rooms = db.getOr('classrooms', []);
    const cid = Number(body.id);
    const room = rooms.find(r=>r.id===cid);
    if (!room) return fail('ไม่พบห้องเรียน');
    db.set('classrooms', rooms.filter(r=>r.id!==cid));
    const tc = db.getOr('tc', []);
    db.set('tc', tc.filter(t=>t.classroom_id!==cid));
    const profiles = db.getOr('profiles', []);
    db.set('profiles', profiles.map(p=>p.classroom_id===cid?{...p,classroom_id:null}:p));
    log(session?.user_id, 'delete_classroom', `ลบห้อง ${room.room_code}`);
    return ok({ message: 'ลบห้องเรียนสำเร็จ' });
  }

  function doResetClassrooms(session) {
    db.set('classrooms', []);
    db.set('tc', []);
    const profiles = db.getOr('profiles', []);
    db.set('profiles', profiles.map(p=>({...p, classroom_id: null})));
    const seq = db.getOr('_seq', {});
    seq.classrooms = 1;
    db.set('_seq', seq);
    log(session?.user_id, 'reset_classrooms', 'เคลียร์ห้องเรียนทั้งหมด');
    return ok({ message: 'เคลียร์ห้องเรียนทั้งหมดสำเร็จ' });
  }

  function doGetActivityLogs(params) {
    const role   = params.get('role')||'';
    const search = (params.get('search')||'').toLowerCase();
    const limit  = Number(params.get('limit')||50);
    const offset = Number(params.get('offset')||0);
    let logs = db.getOr('logs', []);
    if (role)   logs = logs.filter(l=>l.role===role);
    if (search) logs = logs.filter(l=>(l.full_name||'').toLowerCase().includes(search)||(l.action||'').includes(search));
    return ok({ data: logs.slice(offset,offset+limit), total: logs.length });
  }

  function doGetSettings() {
    const s = db.getOr('settings', {});
    return ok({ data: Object.entries(s).map(([setting_key,setting_value])=>({setting_key,setting_value})) });
  }

  function doSaveSettings(body) {
    const s = db.getOr('settings', {});
    Object.assign(s, body.settings||{});
    db.set('settings', s);
    return ok({ message: 'บันทึกการตั้งค่าสำเร็จ' });
  }

  function doExportStudents() {
    const profiles = db.getOr('profiles', []);
    const rooms    = db.getOr('classrooms', []);
    const data = profiles.map(p => {
      const r = rooms.find(x=>x.id===p.classroom_id);
      let fd = {}; try { fd = JSON.parse(localStorage.getItem('student_form_'+p.user_id))||{}; } catch {}
      return { รหัสนักศึกษา: p.student_code, ชื่อ: p.first_name_th, นามสกุล: p.last_name_th, ห้องเรียน: r?.room_name||'', สถานะ: p.form_status, จังหวัด: p.province||fd.province||'' };
    });
    return ok({ data });
  }

  // ── Teacher: Classrooms ───────────────────────────────────────
  function doTeacherGetClassrooms(session) {
    const rooms    = db.getOr('classrooms', []);
    const profiles = db.getOr('profiles', []);
    const tc       = db.getOr('tc', []);

    const myIds = session?.role==='admin' ? rooms.map(r=>r.id) : tc.filter(t=>t.teacher_id===session?.user_id).map(t=>t.classroom_id);

    const data = rooms.filter(r=>r.is_active&&myIds.includes(r.id)).map(r => {
      const sts = profiles.filter(p=>p.classroom_id===r.id);
      return { ...r, student_count: sts.length, submitted_count: sts.filter(p=>p.form_status==='submitted').length };
    });

    return ok({ data });
  }

  // ── Teacher: Students ─────────────────────────────────────────
  function doGetStudents(params, session) {
    const cid    = params.get('classroom_id') ? Number(params.get('classroom_id')) : null;
    const search = (params.get('search')||'').toLowerCase();
    const profiles = db.getOr('profiles', []);
    const users    = db.getOr('users', []);
    const rooms    = db.getOr('classrooms', []);
    const tc       = db.getOr('tc', []);

    const allowedIds = session?.role==='admin' ? null : tc.filter(t=>t.teacher_id===session?.user_id).map(t=>t.classroom_id);

    const data = profiles.filter(p => {
      if (allowedIds && !allowedIds.includes(p.classroom_id)) return false;
      if (cid && p.classroom_id !== cid) return false;
      if (search) {
        const name = `${p.first_name_th} ${p.last_name_th}`.toLowerCase();
        if (!name.includes(search) && !(p.student_code||'').toLowerCase().includes(search)) return false;
      }
      return true;
    }).map(p => {
      const r = rooms.find(x=>x.id===p.classroom_id);
      const u = users.find(x=>x.user_id===p.user_id);
      let fd = {}; try { fd = JSON.parse(localStorage.getItem('student_form_'+p.user_id))||{}; } catch {}
      return { ...p, room_name: r?.room_name||null, room_code: r?.room_code||null, year_level: r?.year_level||p.year_level, full_name: u?.full_name||'', last_login: u?.last_login||null, province: p.province||fd.province||'', nationality: p.nationality||fd.nationality||'', gender: p.gender||fd.gender||'', race: p.race||fd.race||'', religion: p.religion||fd.religion||'', id_card_number: p.id_card_number||fd.id_card_number||'', address_no: p.address_no||fd.address_no||'', father_name: p.father_name||fd.father_name||'', mother_name: p.mother_name||fd.mother_name||'' };
    });

    return ok({ data, total: data.length });
  }

  function doSearchStudents(params) {
    const search       = (params.get('search')||'').toLowerCase();
    const excl         = params.get('exclude_classroom') ? Number(params.get('exclude_classroom')) : null;
    const roomYearLvl  = params.get('room_year_level') || null;
    if (!search) return ok({ data: [] });

    const users    = db.getOr('users', []);
    const profiles = db.getOr('profiles', []);
    const rooms    = db.getOr('classrooms', []);

    const data = users.filter(u => u.role==='student' && u.is_active).filter(u => {
      const p = profiles.find(x=>x.user_id===u.user_id);
      const name = `${p?.first_name_th||''} ${p?.last_name_th||''}`.toLowerCase();
      const code = (p?.student_code||u.user_id).toLowerCase();
      if (!name.includes(search) && !code.includes(search) && !u.full_name.toLowerCase().includes(search)) return false;
      if (excl && p?.classroom_id === excl) return false;
      if (roomYearLvl && p?.year_level !== roomYearLvl) return false;
      return true;
    }).map(u => {
      const p = profiles.find(x=>x.user_id===u.user_id);
      const r = rooms.find(x=>x.id===p?.classroom_id);
      return { user_id: u.user_id, full_name: u.full_name, student_code: p?.student_code||u.user_id, prefix: p?.prefix||'', first_name_th: p?.first_name_th||'', last_name_th: p?.last_name_th||'', gender: p?.gender||'', classroom_id: p?.classroom_id||null, year_level: p?.year_level||null, room_name: r?.room_name||null };
    }).slice(0, 25);

    return ok({ data });
  }

  function doAddAdvisoryRoom(body, session) {
    const rooms = db.getOr('classrooms', []);
    let cid = Number(body.classroom_id||0);

    if (!cid) {
      if (rooms.find(r=>r.room_code===body.room_code)) return fail('รหัสห้องนี้มีอยู่แล้ว');
      const r = { id: nextId('classrooms'), room_code: body.room_code, room_name: body.room_name, year_level: body.year_level, program: body.program||'คอมพิวเตอร์ธุรกิจดิจิทัล', academic_year: body.academic_year, semester: Number(body.semester||1), is_active: 1 };
      rooms.push(r);
      db.set('classrooms', rooms);
      cid = r.id;
    }

    const tc  = db.getOr('tc', []);
    const tid = (session?.role==='admin' && body.teacher_id) ? body.teacher_id : session?.user_id;
    if (!tc.find(t=>t.teacher_id===tid && t.classroom_id===cid)) {
      tc.push({ teacher_id: tid, classroom_id: cid });
      db.set('tc', tc);
    }

    log(session?.user_id, 'add_advisory_room', `เพิ่มห้องที่ปรึกษา ${cid}`);
    return ok({ message: 'เพิ่มห้องที่ปรึกษาสำเร็จ', classroom_id: cid });
  }

  function doAddStudentToClassroom(body, session) {
    const profiles = db.getOr('profiles', []);
    const rooms    = db.getOr('classrooms', []);
    const i = profiles.findIndex(p=>p.user_id===body.student_id);
    if (i<0) return fail('ไม่พบนักศึกษา');
    const room = rooms.find(r=>r.id===Number(body.classroom_id));
    if (!room || profiles[i].year_level !== room.year_level) return fail('ระดับชั้นของนักศึกษาไม่ตรงกับห้องเรียน ไม่สามารถเพิ่มได้');
    profiles[i] = { ...profiles[i], classroom_id: Number(body.classroom_id) };
    db.set('profiles', profiles);
    log(session?.user_id, 'add_student_to_classroom', `เพิ่มนักศึกษา ${body.student_id} เข้าห้อง ${body.classroom_id}`);
    return ok({ message: 'เพิ่มนักศึกษาเข้าห้องสำเร็จ' });
  }

  function doDeleteRoom(params, session) {
    const cid = Number(params.get('room_id'));
    const tc = db.getOr('tc', []);
    const newTc = tc.filter(t=>!(t.classroom_id===cid && t.teacher_id===session?.user_id));
    db.set('tc', newTc);
    // ถ้าไม่มีอาจารย์คนอื่นในห้องนี้แล้ว ให้ลบ classroom ออกจาก DB และ unassign นักศึกษา
    if (!newTc.find(t=>t.classroom_id===cid)) {
      const rooms = db.getOr('classrooms', []);
      db.set('classrooms', rooms.filter(r=>r.id!==cid));
      const profiles = db.getOr('profiles', []);
      db.set('profiles', profiles.map(p=>p.classroom_id===cid?{...p,classroom_id:null}:p));
    }
    log(session?.user_id, 'delete_advisory_room', `ลบห้องที่ปรึกษา ${cid}`);
    return ok({ message: 'ลบห้องที่ปรึกษาแล้ว' });
  }

  function doDeleteStudent(params, session) {
    const uid = params.get('user_id');
    const profiles = db.getOr('profiles', []);
    const i = profiles.findIndex(p=>p.user_id===uid);
    if (i>=0) { profiles[i] = { ...profiles[i], classroom_id: null }; db.set('profiles', profiles); }
    log(session?.user_id, 'remove_student_from_room', `ลบนักศึกษา ${uid} ออกจากห้อง`);
    return ok({ message: 'ลบนักศึกษาออกจากห้องแล้ว' });
  }

  function doSendNotification(body, session) {
    const notifs   = db.getOr('notifs', []);
    const profiles = db.getOr('profiles', []);
    let rids = body.recipient_ids || [];
    if (body.classroom_id) rids = profiles.filter(p=>p.classroom_id===Number(body.classroom_id)&&p.form_status!=='submitted').map(p=>p.user_id);
    if (!rids.length) return fail('ไม่มีนักศึกษาที่ต้องการแจ้งเตือน');
    rids.forEach(rid => notifs.push({ id: nextId('notifs'), sender_id: session?.user_id, recipient_id: rid, title: body.title, message: body.message||'', type: body.type||'reminder', is_read: 0, created_at: now() }));
    db.set('notifs', notifs);
    log(session?.user_id, 'send_notification', `ส่งแจ้งเตือน "${body.title}" ถึง ${rids.length} คน`);
    return ok({ message: `ส่งการแจ้งเตือนถึง ${rids.length} คนสำเร็จ`, sent_count: rids.length });
  }

  function doTeacherDashboard(session) {
    const profiles = db.getOr('profiles', []);
    const rooms    = db.getOr('classrooms', []);
    const tc       = db.getOr('tc', []);
    const myIds    = session?.role==='admin' ? rooms.map(r=>r.id) : tc.filter(t=>t.teacher_id===session?.user_id).map(t=>t.classroom_id);
    const mine     = profiles.filter(p=>myIds.includes(p.classroom_id));
    const sm = {};
    mine.forEach(p=>{ sm[p.form_status]=(sm[p.form_status]||0)+1; });
    const byClassroom = rooms.filter(r=>myIds.includes(r.id)).map(r => {
      const sts = mine.filter(p=>p.classroom_id===r.id);
      return { ...r, total: sts.length, submitted: sts.filter(p=>p.form_status==='submitted').length, not_started: sts.filter(p=>p.form_status==='not_started').length };
    });
    return ok({ data: { status_counts: Object.entries(sm).map(([form_status,cnt])=>({form_status,cnt})), by_classroom: byClassroom, by_province: [] } });
  }

  function doViewStudent(params) {
    const uid      = params.get('student_id');
    const profiles = db.getOr('profiles', []);
    const rooms    = db.getOr('classrooms', []);
    const users    = db.getOr('users', []);
    const p = profiles.find(x=>x.user_id===uid);
    if (!p) return res({ success: false, message: 'ไม่พบนักศึกษา' }, 404);
    const r = rooms.find(x=>x.id===p.classroom_id);
    const u = users.find(x=>x.user_id===uid);
    let fd = {}; try { fd = JSON.parse(localStorage.getItem('student_form_'+uid))||{}; } catch {}
    const profile = { ...p, ...fd, room_name: r?.room_name, room_code: r?.room_code, year_level: r?.year_level||p.year_level, full_name: u?.full_name, last_login: u?.last_login };
    return ok({ data: { profile, friends: fd.friends||[], health_checkups: fd.health_checkups||[] } });
  }

  // ── Student: Profile ──────────────────────────────────────────
  function doGetProfile(params, session) {
    const uid      = params.get('user_id') || session?.user_id;
    const profiles = db.getOr('profiles', []);
    const rooms    = db.getOr('classrooms', []);
    const users    = db.getOr('users', []);
    const notifs   = db.getOr('notifs', []);
    const p = profiles.find(x=>x.user_id===uid);
    if (!p) return fail('ไม่พบข้อมูลนักศึกษา');
    const r = rooms.find(x=>x.id===p.classroom_id);
    const u = users.find(x=>x.user_id===uid);
    let fd = {}; try { fd = JSON.parse(localStorage.getItem('student_form_'+uid))||{}; } catch {}
    const profile = { ...p, ...fd, room_name: r?.room_name, room_code: r?.room_code, year_level: r?.year_level||p.year_level, academic_year: r?.academic_year, class_semester: r?.semester, full_name: u?.full_name, classroom_id: p.classroom_id };
    const unread = notifs.filter(n=>n.recipient_id===uid&&!n.is_read).length;
    return ok({ data: { profile, friends: fd.friends||[], health_checkups: fd.health_checkups||[], unread_notifications: unread } });
  }

  function doSaveProfile(body, session) {
    const uid      = body.user_id || session?.user_id;
    const profiles = db.getOr('profiles', []);
    const i        = profiles.findIndex(p=>p.user_id===uid);
    const status   = body.form_status || 'not_started';
    const isSubmit = status === 'submitted';

    // Save full form data to student_form key (for doc viewer)
    const formKey = 'student_form_' + uid;
    let existing = {}; try { existing = JSON.parse(localStorage.getItem(formKey))||{}; } catch {}
    localStorage.setItem(formKey, JSON.stringify({ ...existing, ...body }));

    if (i >= 0) {
      profiles[i] = { ...profiles[i], form_status: status, form_submitted_at: isSubmit ? now() : profiles[i].form_submitted_at, gender: body.gender||profiles[i].gender, nationality: body.nationality||profiles[i].nationality, province: body.province||profiles[i].province, first_name_th: body.first_name_th||profiles[i].first_name_th, last_name_th: body.last_name_th||profiles[i].last_name_th, prefix: body.prefix||profiles[i].prefix };
      db.set('profiles', profiles);
    }

    log(uid, 'submit_form', `ส่งระเบียนสะสม สถานะ: ${status}`);
    return ok({ message: isSubmit ? 'ส่งระเบียนสะสมสำเร็จ!' : 'บันทึกข้อมูลสำเร็จ!' });
  }

  function doGetNotifications(session) {
    const notifs = db.getOr('notifs', []);
    const myNotifs = notifs.filter(n=>n.recipient_id===session?.user_id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,20);
    // mark read
    db.set('notifs', notifs.map(n=>n.recipient_id===session?.user_id?{...n,is_read:1}:n));
    return ok({ data: myNotifs });
  }

  // ════════════════════════════════════════════════════════════
  // ROUTER
  // ════════════════════════════════════════════════════════════
  async function route(urlStr, options) {
    const url     = new URL(urlStr, location.href);
    const params  = url.searchParams;
    const action  = params.get('action') || '';
    const method  = (options?.method || 'GET').toUpperCase();
    const session = getSessionUser();
    let body = {};
    if (options?.body) { try { body = JSON.parse(options.body); } catch {} }

    const path = url.pathname.replace(/\\/g, '/');

    if (path.endsWith('login.php'))   return doLogin(body);
    if (path.endsWith('logout.php'))  { localStorage.removeItem('ldb_auth'); log(session?.user_id,'logout','ออกจากระบบ'); return ok({ message: 'ออกจากระบบแล้ว' }); }
    if (path.endsWith('config.php'))  return ok({ mode: 'localdb' });

    if (path.endsWith('admin.php')) {
      if (action==='dashboard')         return doAdminDashboard();
      if (action==='get_users')         return doGetUsers(params);
      if (action==='create_user')       return doCreateUser(body, session);
      if (action==='update_user')       return doUpdateUser(body, session);
      if (action==='delete_user')       return doDeleteUser(body, session);
      if (action==='remove_user')       return doRemoveUser(body, session);
      if (action==='bulk_remove_users') {
        const ids = (body.user_ids || []).filter(id => id !== session?.user_id);
        if (!ids.length) return fail('ไม่มีรายการที่เลือก');
        const toDelete = new Set(ids);
        let users = db.getOr('users', []);
        const before = users.length;
        users = users.filter(u => !toDelete.has(u.user_id));
        db.set('users', users);
        db.set('profiles', db.getOr('profiles', []).filter(p => !toDelete.has(p.user_id)));
        toDelete.forEach(uid => { try { localStorage.removeItem('student_form_' + uid); } catch {} });
        const deleted = before - users.length;
        log(session?.user_id, 'bulk_remove_users', `ลบผู้ใช้จำนวน ${deleted} คน`);
        return ok({ message: `ลบสำเร็จ ${deleted} คน` });
      }
      if (action==='get_classrooms')    return doAdminGetClassrooms();
      if (action==='create_classroom')  return doCreateClassroom(body, session);
      if (action==='update_classroom')  return doUpdateClassroom(body, session);
      if (action==='delete_classroom')  return doDeleteClassroom(body, session);
      if (action==='reset_classrooms')  return doResetClassrooms(session);
      if (action==='get_activity_logs') return doGetActivityLogs(params);
      if (action==='get_settings')      return doGetSettings();
      if (action==='save_settings')     return doSaveSettings(body);
      if (action==='export_students')   return doExportStudents();
      if (action==='import_students') {
        const students = body.students || [];
        const cid = body.classroom_id ? Number(body.classroom_id) : null;
        const yl  = body.year_level || 'pvc1';
        const users    = db.getOr('users', []);
        const profiles = db.getOr('profiles', []);
        const results  = { success: 0, failed: 0, errors: [] };
        students.forEach(s => {
          const code = String(s.student_code||'').trim();
          if (!code) { results.failed++; return; }
          if (users.find(u => u.user_id === code)) { results.failed++; results.errors.push(`รหัส ${code} มีอยู่แล้ว`); return; }
          const prefix = s.prefix || '';
          const fn = s.first_name_th || '';
          const ln = s.last_name_th  || '';
          users.push({ user_id: code, password: 'irpct1234!', role: 'student', full_name: (prefix+fn+' '+ln).trim(), is_active: 1, created_at: now(), last_login: null });
          const gender = s.gender || (['นางสาว','นาง'].includes(prefix) ? 'female' : (prefix === 'นาย' ? 'male' : ''));
          profiles.push({ id: nextId('profiles'), user_id: code, student_code: code, classroom_id: cid, year_level: yl, prefix, first_name_th: fn, last_name_th: ln, gender, nationality: '', form_status: 'not_started', form_submitted_at: null });
          results.success++;
        });
        db.set('users', users); db.set('profiles', profiles);
        log(session?.user_id, 'import_students', `นำเข้า ${results.success} คน`);
        return ok({ results, message: `นำเข้าสำเร็จ ${results.success} คน${results.failed?`, ล้มเหลว ${results.failed} คน`:''}` });
      }
      if (action==='import_teachers') {
        const teachers = body.teachers || [];
        const users = db.getOr('users', []);
        const results = { success: 0, failed: 0, errors: [] };
        teachers.forEach(t => {
          const uid = String(t.user_id||'').trim();
          if (!uid) { results.failed++; return; }
          if (users.find(u => u.user_id === uid)) { results.failed++; results.errors.push(`รหัส ${uid} มีอยู่แล้ว`); return; }
          const prefix = t.prefix     || 'นาย';
          const fname  = t.first_name || '';
          const lname  = t.last_name  || '';
          users.push({ user_id: uid, password: t.password||'teacher@1234', role: 'teacher', full_name: (prefix+fname+' '+lname).trim(), department: t.department||'', is_active: 1, created_at: now(), last_login: null });
          results.success++;
        });
        db.set('users', users);
        log(session?.user_id, 'import_teachers', `นำเข้าอาจารย์ ${results.success} คน`);
        return ok({ results, message: `นำเข้าสำเร็จ ${results.success} คน${results.failed?`, ล้มเหลว ${results.failed} คน`:''}` });
      }
      if (action==='get_classroom_teachers') {
        const cid   = Number(params.get('classroom_id'));
        const tc    = db.getOr('tc', []);
        const users = db.getOr('users', []);
        return ok({ data: tc.filter(t=>t.classroom_id===cid).map(t=>({ teacher_id:t.teacher_id, full_name:users.find(u=>u.user_id===t.teacher_id)?.full_name||t.teacher_id })) });
      }
      if (action==='get_all_assignments') {
        const tc    = db.getOr('tc', []);
        const users = db.getOr('users', []);
        const rooms = db.getOr('classrooms', []);
        return ok({ data: tc.map(t=>({ classroom_id:t.classroom_id, teacher_id:t.teacher_id, full_name:users.find(u=>u.user_id===t.teacher_id)?.full_name||t.teacher_id, room_name:rooms.find(r=>r.id===t.classroom_id)?.room_name||String(t.classroom_id) })) });
      }
      if (action==='assign_teacher') {
        const cid = Number(body.classroom_id); const tid = body.teacher_id;
        const tc  = db.getOr('tc', []);
        if (!tc.find(t=>t.teacher_id===tid&&t.classroom_id===cid)) { tc.push({teacher_id:tid,classroom_id:cid}); db.set('tc',tc); }
        return ok({ message: 'มอบหมายอาจารย์สำเร็จ' });
      }
      if (action==='bulk_assign_teacher') {
        const tids = body.teacher_ids || [];
        const cids = (body.classroom_ids || []).map(Number);
        const tc   = db.getOr('tc', []);
        let count  = 0;
        tids.forEach(tid => { cids.forEach(cid => {
          if (!tc.find(t=>t.teacher_id===tid&&t.classroom_id===cid)) { tc.push({teacher_id:tid,classroom_id:cid}); count++; }
        }); });
        db.set('tc', tc);
        return ok({ message: `มอบหมายสำเร็จ ${count} รายการ` });
      }
      if (action==='unassign_teacher') {
        const cid = Number(body.classroom_id); const tid = body.teacher_id;
        db.set('tc', db.getOr('tc',[]).filter(t=>!(t.teacher_id===tid&&t.classroom_id===cid)));
        return ok({ message: 'ยกเลิกการมอบหมายสำเร็จ' });
      }
    }

    if (path.endsWith('teacher.php')) {
      if (action==='get_classrooms')            return doTeacherGetClassrooms(session);
      if (action==='get_all_classrooms') {
        const rooms = db.getOr('classrooms', []);
        const data  = rooms.filter(r=>r.is_active).map(r=>({id:r.id,room_code:r.room_code,room_name:r.room_name,year_level:r.year_level,academic_year:r.academic_year})).sort((a,b)=>a.year_level.localeCompare(b.year_level)||a.room_code.localeCompare(b.room_code));
        return ok({ data });
      }
      if (action==='get_students')             return doGetStudents(params, session);
      if (action==='search_students')          return doSearchStudents(params);
      if (action==='add_advisory_room')        return doAddAdvisoryRoom(body, session);
      if (action==='add_student_to_classroom') return doAddStudentToClassroom(body, session);
      if (action==='send_notification')        return doSendNotification(body, session);
      if (action==='dashboard')                return doTeacherDashboard(session);
      if (action==='view_student')             return doViewStudent(params);
      if (action==='delete_room')              return doDeleteRoom(params, session);
      if (action==='delete_student')           return doDeleteStudent(params, session);
      if (action==='get_teachers') {
        const users = db.getOr('users',[]);
        return ok({ data: users.filter(u=>u.role==='teacher'&&u.is_active).map(u=>({user_id:u.user_id,full_name:u.full_name,email:u.email})) });
      }
    }

    if (path.endsWith('student.php')) {
      if (action==='get_profile')    return doGetProfile(params, session);
      if (action==='save_profile')   return doSaveProfile(body, session);
      if (action==='get_notifications') return doGetNotifications(session);
      if (action==='check_session')  return ok({ data: { user_id: session?.user_id, role: session?.role, full_name: session?.full_name } });
    }

    return res({ success: false, message: 'Invalid action' }, 400);
  }

  // ════════════════════════════════════════════════════════════
  // FETCH INTERCEPTOR
  // ════════════════════════════════════════════════════════════
  const _fetch = window.fetch.bind(window);
  let _mode = null; // null=unknown, 'php'=XAMPP, 'local'=localStorage

  async function probeServer() {
    if (_mode) return;
    if (location.protocol === 'file:') { _mode = 'local'; return; }
    // ถ้า login ผ่าน localdb จะมี flag นี้ → ใช้ local เสมอ
    if (localStorage.getItem('ldb_auth') === 'local') { _mode = 'local'; return; }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await _fetch('api/login.php', { method: 'HEAD', signal: ctrl.signal, credentials: 'include' });
      clearTimeout(t);
      // ถ้า PHP มี session ที่ valid → ใช้ PHP, ถ้าไม่มี → ใช้ local
      _mode = (r.ok || r.status === 405) ? 'php' : 'local';
    } catch {
      _mode = 'local';
    }
    if (_mode === 'local') console.info('[LocalDB] ใช้ localStorage database');
  }

  window.fetch = async function(url, options) {
    const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.href : String(url));
    if (!urlStr.includes('api/')) return _fetch(url, options);
    await probeServer();
    if (_mode === 'php') {
      try {
        const r = await _fetch(url, options);
        // PHP ส่ง 401 (ไม่มี session) แต่เรามี JS session → switch localdb
        if (r.status === 401 && getSessionUser()) {
          _mode = 'local';
          localStorage.setItem('ldb_auth', 'local');
          return route(urlStr, options);
        }
        return r;
      } catch { _mode = 'local'; return route(urlStr, options); }
    }
    return route(urlStr, options);
  };

  // ── init ──────────────────────────────────────────────────────
  initData();
  seedDefaultClassrooms();

})();
