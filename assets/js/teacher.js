// ============================================
// teacher.js - Teacher Portal Logic
// ============================================

let teacherClassrooms = [];
let allStudents = [];
let allStudentsRaw = [];
let selectedStudentIds = [];
let currentRoom = null;

// ============================================
// INIT
// ============================================
async function initTeacher() {
  const session = getSession();
  if (!session || (session.role !== 'teacher' && session.role !== 'admin')) {
    window.location.replace('index.html');
    return;
  }

  document.getElementById('sidebar-name').textContent = session.full_name || '';
  if (document.getElementById('sidebar-role')) document.getElementById('sidebar-role').textContent = t(session.role);
  const av = document.getElementById('sidebar-avatar');
  if (av) av.textContent = (session.full_name || 'T').charAt(0).toUpperCase();
  if (session.role === 'admin') {
    const backBtn = document.getElementById('back-admin-btn');
    if (backBtn) backBtn.style.display = 'block';
  }

  await loadClassrooms();
  await loadStudents();
  switchView('classrooms');
  loadDashboard();
}

// ============================================
// LOAD CLASSROOMS
// ============================================
async function loadClassrooms() {
  try {
    const res = await fetch('api/teacher.php?action=get_classrooms', { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      teacherClassrooms = data.data;
      renderClassroomFilter();
      renderClassroomCards();
    }
  } catch {
    teacherClassrooms = [];
    renderClassroomFilter();
    renderClassroomCards();
  }
}

function renderClassroomFilter() {
  const sel = document.getElementById('filter-classroom');
  if (!sel) return;
  sel.innerHTML = `<option value="">${t('allRooms')}</option>`;
  teacherClassrooms.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.room_name}</option>`;
  });
}

function renderClassroomCards() {
  const container = document.getElementById('classroom-cards');
  if (!container) return;

  if (!teacherClassrooms.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)">
      ${t('noAdvisoryRoom')}<br><small>${t('noAdvisoryRoomHint')}</small>
    </div>`;
    return;
  }

  const q   = (document.getElementById('room-search-input')?.value || '').toLowerCase().trim();
  const ylf = document.getElementById('room-year-filter')?.value || '';
  const YL  = getYL();
  const filtered = teacherClassrooms.filter(c => {
    if (ylf && c.year_level !== ylf) return false;
    if (q) {
      const hay = `${c.room_name} ${c.room_code} ${YL[c.year_level]||''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)">
      ${t('noRoomMatch')}
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const roomStudents = allStudentsRaw.filter(s => s.classroom_id == c.id);
    const total     = roomStudents.length || c.student_count || 0;
    const submitted = roomStudents.filter(s => s.form_status === 'submitted').length || c.submitted_count || 0;
    const pending   = roomStudents.filter(s => s.form_status === 'not_started').length;
    const pct = total ? Math.round((submitted / total) * 100) : 0;
    const YL2 = getYL();
    return `
    <div class="card">
      <div class="card-body" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:0.95rem">${c.room_name}</div>
            <div style="font-size:0.75rem;color:var(--text-sub)">${YL2[c.year_level]||c.year_level} • ${c.room_code}</div>
          </div>
          ${getYearBadge(c.year_level)}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:6px">
          <span>${t('totalStudents')} <strong>${total}</strong></span>
          <span style="color:var(--success)">${t('filledLabel')} <strong>${submitted}</strong></span>
          <span style="color:var(--red-700)">${t('notFilledLabel')} <strong>${pending}</strong></span>
        </div>
        <div class="progress" style="margin-bottom:6px">
          <div class="progress-bar ${pct>=80?'green':pct>=50?'':'amber'}" style="width:${pct}%"></div>
        </div>
        <div style="text-align:right;font-size:0.7rem;color:var(--text-muted);margin-bottom:12px">${pct}% ${t('completedText')}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="viewRoom(${c.id})">${t('enterRoom')}</button>
          ${pending>0 ? `<button class="btn btn-outline btn-sm" onclick="sendToClassroomNotStarted('${c.room_name}',${c.id})">${t('notifyBtn')} (${pending})</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============================================
// LOAD STUDENTS
// ============================================
async function loadStudents() {
  showLoading();
  try {
    const res = await fetch('api/teacher.php?action=get_students', { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      allStudentsRaw = data.data;
    }
  } catch {
    allStudentsRaw = [];
  } finally {
    hideLoading();
  }
  applyFilters();
}


function filterStudentsLocally(students) {
  const get = id => (document.getElementById(id)?.value || '').trim();
  const search = get('search-input').toLowerCase();
  const status = get('filter-status');
  const year   = get('filter-year');
  const room   = get('filter-classroom');
  const gender = get('filter-gender');
  const nat    = get('filter-nationality');

  const NAT_KNOWN = ['ไทย','เวียดนาม','ลาว','กัมพูชา'];

  return students.filter(s => {
    const fullName = `${s.prefix||''}${s.first_name_th||''} ${s.last_name_th||''}`.toLowerCase();
    const code = (s.student_code || '').toLowerCase();
    if (search && !fullName.includes(search) && !code.includes(search)) return false;
    if (status && s.form_status !== status) return false;
    if (year   && String(s.year_level) !== year) return false;
    if (room   && String(s.classroom_id) !== room) return false;
    if (gender) {
      const sg = (s.gender==='female'||['นางสาว','นาง'].includes(s.prefix)) ? 'female' : 'male';
      if (sg !== gender) return false;
    }
    if (nat) {
      const raw = (s.nationality||'').trim();
      const bucket = raw===''?'ไม่ระบุ':NAT_KNOWN.includes(raw)?raw:'อื่นๆ';
      if (bucket !== nat) return false;
    }
    return true;
  });
}

function getGenderText(s) {
  if (s.gender === 'female') return t('female');
  if (['นางสาว','นาง'].includes(s.prefix)) return t('female');
  if (s.gender === 'male' || s.prefix === 'นาย') return t('male');
  return '-';
}

function renderStudentTable(students) {
  const tbody = document.getElementById('students-tbody');
  const count = document.getElementById('student-count');
  if (count) count.textContent = students.length;

  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">${t('noData')}</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const name = `${s.prefix||''}${s.first_name_th||''} ${s.last_name_th||''}`;
    const safeName = name.replace(/'/g, "\\'");
    return `
    <tr>
      <td style="text-align:center" class="td-check"><input type="checkbox" class="student-checkbox" value="${s.user_id}" onchange="toggleStudentSelect('${s.user_id}', this.checked)" style="accent-color:var(--primary)"></td>
      <td style="overflow:visible" class="td-name">
        <span style="display:block;font-weight:600;margin:0;padding:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:192px">${name}</span>
        <span style="display:block;font-size:0.78rem;color:var(--text-muted);margin:0;padding:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:192px">${s.student_code || '-'}</span>
      </td>
      <td style="text-align:center" data-label="${t('classroomHeader')}">${s.room_name || '-'}</td>
      <td style="text-align:center" data-label="${t('yearLevelHeader')}">${getYearBadge(s.year_level)}</td>
      <td style="text-align:center" data-label="${t('genderHeader')}">${getGenderText(s)}</td>
      <td style="text-align:center" data-label="${t('nationalityHeader')}">${s.nationality || '-'}</td>
      <td style="text-align:center" data-label="${t('statusHeader')}">${getStatusBadge(s.form_status)}</td>
      <td class="td-actions">
        <div class="table-actions">
          <button class="btn btn-sm btn-primary" onclick="viewStudent('${s.user_id}')">${t('viewDoc')}</button>
          ${s.form_status === 'not_started' ? `<button class="btn btn-sm btn-outline" onclick="sendToStudent('${s.user_id}','${safeName}')">${t('notifyBtn')}</button>` : ''}
          ${isIncomplete(s) ? `<button class="btn btn-sm btn-warning" onclick="sendIncompleteNotif('${s.user_id}','${safeName}')">${t('incompleteBtn')}</button>` : ''}
          ${s.form_status === 'submitted' ? `<button class="btn btn-sm btn-danger" onclick="sendWrongNotif('${s.user_id}','${safeName}')">${t('wrongFillBtn')}</button>` : ''}
        </div>
      </td>
    </tr>`}).join('');

  selectedStudentIds = [];
  updateSelectionUI();
}

function renderStats(stats) {
  const el = id => document.getElementById(id);
  if (el('stat-submitted')) el('stat-submitted').textContent = stats.submitted || 0;
  if (el('stat-not-started')) el('stat-not-started').textContent = stats.not_started || 0;
}

// ============================================
// ROOM DETAIL
// ============================================
function viewRoom(roomId) {
  currentRoom = teacherClassrooms.find(c => c.id == roomId) || null;
  if (!currentRoom) return;

  const students = allStudentsRaw.filter(s => s.classroom_id == roomId);
  const submitted = students.filter(s => s.form_status === 'submitted').length;
  const pending   = students.filter(s => s.form_status === 'not_started').length;

  const searchEl = document.getElementById('room-search');
  if (searchEl) searchEl.value = '';

  const el = id => document.getElementById(id);
  const YL = getYL();
  if (el('room-detail-name')) el('room-detail-name').textContent = currentRoom.room_name;
  if (el('room-detail-sub'))  el('room-detail-sub').textContent  = `${YL[currentRoom.year_level]||currentRoom.year_level} • ${currentRoom.room_code}`;
  if (el('room-stat-total'))     el('room-stat-total').textContent     = students.length;
  if (el('room-stat-submitted')) el('room-stat-submitted').textContent = submitted;
  if (el('room-stat-pending'))   el('room-stat-pending').textContent   = pending;

  renderRoomTable(students);
  renderRoomCharts(students);
  switchView('room-detail');
  document.querySelector('.nav-link[data-view="classrooms"]')?.classList.add('active');
  startRoomPolling(roomId);
}

function renderRoomTable(students) {
  const tbody = document.getElementById('room-students-tbody');
  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">${t('noStudentInRoom')}<br><small>${t('adminAddsStudentHint')}</small></td></tr>`;
    return;
  }
  tbody.innerHTML = students.map(s => {
    const name = `${s.prefix||''}${s.first_name_th||''} ${s.last_name_th||''}`;
    const safeName = name.replace(/'/g, "\\'");
    return `<tr>
      <td class="td-name"><div style="font-weight:600">${name}</div></td>
      <td style="font-size:.8rem;color:var(--text-sub)" data-label="${t('studentCodeHeader')}">${s.student_code||'-'}</td>
      <td data-label="${t('genderHeader')}">${getGenderText(s)}</td>
      <td data-label="${t('statusHeader')}">${getStatusBadge(s.form_status)}</td>
      <td class="td-actions">
        <div class="table-actions" style="justify-content:center">
          <button class="btn btn-sm btn-primary" onclick="viewStudent('${s.user_id}')">${t('viewDoc')}</button>
          ${s.form_status==='not_started'?`<button class="btn btn-sm btn-outline" onclick="sendToStudent('${s.user_id}','${safeName}')">${t('notifyBtn')}</button>`:''}
          ${isIncomplete(s)?`<button class="btn btn-sm btn-warning" onclick="sendIncompleteNotif('${s.user_id}','${safeName}')">${t('incompleteBtn')}</button>`:''}
          ${s.form_status==='submitted'?`<button class="btn btn-sm btn-danger" onclick="sendWrongNotif('${s.user_id}','${safeName}')">${t('wrongFillBtn')}</button>`:''}
          <button class="btn btn-sm" style="background:var(--red-50);color:var(--red-700);border:1px solid var(--red-200)" onclick="deleteStudent('${s.user_id}','${safeName}')">${t('removeUserBtn')}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterRoomStudents() {
  if (!currentRoom) return;
  const q = (document.getElementById('room-search')?.value || '').trim().toLowerCase();
  const all = allStudentsRaw.filter(s => s.classroom_id == currentRoom.id);
  const filtered = q ? all.filter(s => {
    const name = `${s.prefix||''}${s.first_name_th||''} ${s.last_name_th||''}`.toLowerCase();
    return name.includes(q) || (s.student_code||'').toLowerCase().includes(q);
  }) : all;
  renderRoomTable(filtered);
}

function renderRoomCharts(students) {
  if (!window.Chart) return;
  const submitted  = students.filter(s => s.form_status === 'submitted').length;
  const pending    = students.length - submitted;

  const sCtx = document.getElementById('roomStatusChart')?.getContext('2d');
  if (sCtx) {
    if (window._roomStatusChart) window._roomStatusChart.destroy();
    window._roomStatusChart = new Chart(sCtx, {
      type: 'pie',
      data: { labels: [t('filledLabel'),t('notFilledLabel')], datasets: [{ data: [submitted, pending], backgroundColor: ['#22c55e','#f97316'], borderWidth: 2 }] },
      options: { responsive: true, aspectRatio: 2, plugins: { legend: { position: 'bottom' }, ..._piePct } }
    });
  }

  const gm = { male: 0, female: 0 };
  students.forEach(s => { const g = (s.gender==='female'||['นางสาว','นาง'].includes(s.prefix)) ? 'female' : 'male'; gm[g]++; });
  const gCtx = document.getElementById('roomGenderChart')?.getContext('2d');
  if (gCtx) {
    if (window._roomGenderChart) window._roomGenderChart.destroy();
    window._roomGenderChart = new Chart(gCtx, {
      type: 'pie',
      data: { labels: [t('male'),t('female')], datasets: [{ data: [gm.male, gm.female], backgroundColor: ['#3b82f6','#ec4899'], borderWidth: 2 }] },
      options: { responsive: true, aspectRatio: 2, plugins: { legend: { position: 'bottom' }, ..._piePct } }
    });
  }

  const NAT_KNOWN = ['ไทย','เวียดนาม','ลาว','กัมพูชา'];
  const NAT_COLOR  = { ไทย:'#3b82f6', เวียดนาม:'#ef4444', ลาว:'#16a34a', กัมพูชา:'#f59e0b', อื่นๆ:'#8b5cf6', ไม่ระบุ:'#94a3b8' };
  const nm = {};
  students.forEach(s => { const raw=(s.nationality||'').trim(); const n=raw===''?'ไม่ระบุ':NAT_KNOWN.includes(raw)?raw:'อื่นๆ'; nm[n]=(nm[n]||0)+1; });
  const natKeys = ['ไทย','เวียดนาม','ลาว','กัมพูชา','อื่นๆ','ไม่ระบุ'].filter(k=>nm[k]);
  const nCtx = document.getElementById('roomNatChart')?.getContext('2d');
  if (nCtx) {
    if (window._roomNatChart) window._roomNatChart.destroy();
    window._roomNatChart = new Chart(nCtx, {
      type: 'bar',
      data: { labels: natKeys.map(k=>translateNat(k)), datasets: [{ label:t('totalLabel'), data: natKeys.map(k=>nm[k]), backgroundColor: natKeys.map(k=>NAT_COLOR[k]), borderRadius: 6 }] },
      options: { responsive: true, aspectRatio: 3, plugins: { legend: { display: false }, ..._barPct }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }
}

function openAddStudentModal() {
  if (!currentRoom) return;
  const searchEl = document.getElementById('add-std-search');
  if (searchEl) searchEl.value = '';
  const resultsEl = document.getElementById('add-std-results');
  if (resultsEl) resultsEl.innerHTML = `<div style="text-align:center;padding:36px 20px;color:var(--text-dim);font-size:.83rem">${t('typeToSearchText')}</div>`;
  openModal('add-student-modal');
}

async function searchStudentsForRoom() {
  const query = (document.getElementById('add-std-search')?.value || '').trim();
  const resultsEl = document.getElementById('add-std-results');
  if (!resultsEl) return;
  if (!query) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:36px 20px;color:var(--text-dim);font-size:.83rem">${t('typeToSearchText')}</div>`;
    return;
  }
  resultsEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim);font-size:.83rem">${t('searching')}</div>`;
  try {
    const params = new URLSearchParams({ action: 'search_students', search: query, exclude_classroom: currentRoom.id, room_year_level: currentRoom.year_level });
    const res = await fetch(`api/teacher.php?${params}`, { credentials: 'include' });
    const data = await res.json();
    renderAddStudentResults(data.data || []);
  } catch {
    resultsEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--red-700);font-size:.83rem">${t('searchConnError')}</div>`;
  }
}

function renderAddStudentResults(students) {
  const resultsEl = document.getElementById('add-std-results');
  if (!students.length) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:36px 20px;color:var(--text-dim);font-size:.83rem">${t('noStudentsFound')}</div>`;
    return;
  }
  resultsEl.innerHTML = students.map(s => {
    const name = `${s.prefix||''}${s.first_name_th||''} ${s.last_name_th||''}`.trim() || s.full_name || s.user_id;
    const safeId   = s.user_id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const safeName = name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const inRoom   = s.room_name
      ? `<span style="font-size:.72rem;color:var(--amber-700)">&#9679; ${t('inRoomLabel')} ${s.room_name}</span>`
      : `<span style="font-size:.72rem;color:var(--success)">&#9679; ${t('freeLabel')}</span>`;
    const yearBadge = s.year_level ? getYearBadge(s.year_level, 'font-size:.68rem') : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-weight:600;font-size:.87rem">${name} ${yearBadge}</div>
        <div style="margin-top:2px">${s.student_code||s.user_id} &nbsp;•&nbsp; ${inRoom}</div>
      </div>
      <button class="btn btn-sm btn-primary" style="flex-shrink:0;margin-left:12px" onclick="addStudentToRoom('${safeId}','${safeName}')">${t('addToRoomBtn')}</button>
    </div>`;
  }).join('');
}

async function addStudentToRoom(userId, name) {
  if (!currentRoom) return;
  try {
    const res = await fetch('api/teacher.php?action=add_student_to_classroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: userId, classroom_id: currentRoom.id }),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success) { showToast(t('failed'), data.message, 'error'); return; }
  } catch {
    showToast(t('error'), t('tryAgain'), 'warning');
  }
  showToast(t('success'), `${name}`, 'success');
  const existing = allStudentsRaw.find(s => s.user_id === userId);
  if (existing) {
    existing.classroom_id = currentRoom.id;
    existing.room_name = currentRoom.room_name;
    existing.year_level = existing.year_level || currentRoom.year_level;
  } else {
    await loadStudents();
  }
  viewRoom(currentRoom.id);
  renderClassroomCards();
  searchStudentsForRoom();
}

// ============================================
// ROOM SUBMISSION POLLING
// ============================================
let _roomPollTimer = null;
let _roomPollLastSubmitted = 0;

function startRoomPolling(roomId) {
  stopRoomPolling();
  _roomPollLastSubmitted = allStudentsRaw.filter(s => s.classroom_id == roomId && s.form_status === 'submitted').length;
  _roomPollTimer = setInterval(() => _pollRoomSubmissions(roomId), 15000);
}

function stopRoomPolling() {
  if (_roomPollTimer) { clearInterval(_roomPollTimer); _roomPollTimer = null; }
}

async function _pollRoomSubmissions(roomId) {
  try {
    const res = await fetch(`api/teacher.php?action=get_students&classroom_id=${roomId}`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const freshStudents = data.data || [];
    const newCount = freshStudents.filter(s => s.form_status === 'submitted').length;
    if (newCount > _roomPollLastSubmitted) {
      const diff = newCount - _roomPollLastSubmitted;
      showToast(t('studentSubmitAlert'), `${diff} ${t('personPH')}`, 'success', 5000);
      freshStudents.forEach(s => {
        const idx = allStudentsRaw.findIndex(r => r.user_id === s.user_id);
        if (idx >= 0) allStudentsRaw[idx] = Object.assign({}, allStudentsRaw[idx], s);
      });
      viewRoom(roomId);
    }
    _roomPollLastSubmitted = newCount;
  } catch {}
}

function sendRoomNotif() {
  if (!currentRoom) return;
  const ids = allStudentsRaw.filter(s => s.classroom_id == currentRoom.id && s.form_status === 'not_started').map(s => s.user_id);
  if (!ids.length) { showToast(t('notifications'), t('everyoneFilled'), 'info'); return; }
  document.getElementById('notif-recipient-info').textContent = `${t('notifyBtn')}: ${currentRoom.room_name} (${ids.length} ${t('personPH')})`;
  document.getElementById('notif-target-ids').value = ids.join(',');
  document.getElementById('notif-classroom-id').value = '';
  openModal('notif-modal');
}

function deleteRoom(roomId, roomName) {
  showConfirm(
    t('removeAdvisoryRoomTitle'),
    `"${roomName}"?`,
    async () => {
      try {
        const res = await fetch(`api/teacher.php?action=delete_room&room_id=${roomId}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!data.success) { showToast(t('failed'), data.message || t('tryAgain'), 'error'); return; }
        teacherClassrooms = teacherClassrooms.filter(c => c.id != roomId);
        allStudentsRaw    = allStudentsRaw.filter(s => s.classroom_id != roomId);
        renderClassroomCards();
        renderClassroomFilter();
        showToast(t('success'), `"${roomName}"`, 'success');
      } catch {
        showToast(t('failed'), t('tryAgain'), 'error');
      }
    },
    'danger'
  );
}

function deleteStudent(userId, name) {
  showConfirm(
    t('removeStudentTitle'),
    `"${name}"?`,
    async () => {
      try {
        const res = await fetch(`api/teacher.php?action=delete_student&user_id=${userId}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!data.success) { showToast(t('failed'), data.message || t('tryAgain'), 'error'); return; }
        allStudentsRaw = allStudentsRaw.filter(s => s.user_id !== userId);
        if (currentRoom) viewRoom(currentRoom.id);
        renderClassroomCards();
        showToast(t('success'), `"${name}"`, 'success');
      } catch {
        showToast(t('failed'), t('tryAgain'), 'error');
      }
    },
    'danger'
  );
}

// ============================================
// FILTER
// ============================================
function applyFilters() {
  allStudents = filterStudentsLocally(allStudentsRaw);
  const submitted = allStudents.filter(s => s.form_status === 'submitted').length;
  const notStart  = allStudents.filter(s => s.form_status === 'not_started').length;
  renderStudentTable(allStudents);
  renderStats({ submitted, not_started: notStart });
}

function resetFilters() {
  ['search-input','filter-status','filter-year','filter-classroom','filter-gender','filter-nationality'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyFilters();
}

function filterByClassroom(classroomId) {
  switchView('students');
  const sel = document.getElementById('filter-classroom');
  if (sel) { sel.value = classroomId; applyFilters(); }
}

// ============================================
// STUDENT SELECTION
// ============================================
function toggleStudentSelect(userId, checked) {
  if (checked) {
    selectedStudentIds.push(userId);
  } else {
    selectedStudentIds = selectedStudentIds.filter(id => id !== userId);
  }
  updateSelectionUI();
}

function selectAll(checked) {
  selectedStudentIds = checked ? allStudents.map(s => s.user_id) : [];
  document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = checked);
  updateSelectionUI();
}

function updateSelectionUI() {
  const bar = document.getElementById('selection-bar');
  const countEl = document.getElementById('selected-count');
  if (bar) bar.classList.toggle('show', selectedStudentIds.length > 0);
  if (countEl) countEl.textContent = selectedStudentIds.length;
}

// ============================================
// VIEW STUDENT
// ============================================
async function viewStudent(userId) {
  showLoading();
  const studentBase = allStudentsRaw.find(s => s.user_id === userId) || allStudents.find(s => s.user_id === userId) || {};
  try {
    const res = await fetch(`api/teacher.php?action=view_student&student_id=${userId}`, { credentials: 'include' });
    const d = await res.json();
    if (d.success) {
      openDocViewer(Object.assign({}, studentBase, d.data.profile, { friends: d.data.friends || [] }));
      return;
    }
    throw new Error('api fail');
  } catch {
    let formData = null;
    try { formData = JSON.parse(localStorage.getItem('student_form_' + userId)); } catch {}
    openDocViewer(Object.assign({}, studentBase, formData || {}));
  } finally {
    hideLoading();
  }
}

function openDocViewer(d) {
  const overlay = document.getElementById('doc-viewer-overlay');
  const pages   = document.getElementById('doc-viewer-pages');
  if (!overlay || !pages) return;

  const nameEl = document.getElementById('doc-viewer-name');
  const subEl  = document.getElementById('doc-viewer-sub');
  const name   = `${d.prefix||''}${d.first_name_th||''} ${d.last_name_th||''}`.trim() || t('unknownName');
  if (nameEl) nameEl.textContent = name;
  if (subEl)  subEl.textContent  = [d.room_name, d.student_code, d.form_status==='submitted'?t('filledLabel'):t('notFilledLabel')].filter(Boolean).join(' • ');

  if (d.form_status !== 'submitted') {
    pages.innerHTML = `
      <div style="padding:60px 20px;text-align:center;color:var(--text-muted)">
        <div style="font-size:3rem;margin-bottom:16px">📄</div>
        <div style="font-size:1rem;font-weight:600;color:var(--text)">${t('studentNotFilled')}</div>
        <div style="font-size:.85rem;margin-top:8px">${t('studentNotFilledHint')}</div>
      </div>`;
  } else {
    const docData = Object.assign({}, d, {
      _photoType: d._photoType || d.photo_type || 'pvs',
      _photoUrl:  d._photoUrl  || d.photo_url  || null,
      _mapUrl:    d._mapUrl    || d.route_map  || null,
      friends:    d.friends    || [],
    });
    pages.innerHTML =
      renderDocPage1(docData, { readonly: true }) +
      renderDocPage2(docData) +
      renderDocPage3(docData) +
      renderDocPage4(docData);
  }

  overlay.style.display = 'block';
  overlay.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function closeDocViewer() {
  const overlay = document.getElementById('doc-viewer-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

function printDocViewer() {
  document.body.classList.add('teacher-doc-printing');
  document.fonts.ready.then(() => {
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('teacher-doc-printing'), 800);
    }, 150);
  });
}


// ============================================
// INCOMPLETE CHECK
// ============================================
function isIncomplete(s) {
  if (s.form_status !== 'submitted') return false;
  const required = [s.first_name_th, s.last_name_th, s.gender, s.date_of_birth, s.phone, s.province, s.id_card_number, s.address_no, s.father_name, s.mother_name];
  return required.some(v => !v || String(v).trim() === '');
}

function sendIncompleteNotif(userId, name) {
  document.getElementById('notif-recipient-info').textContent = `${t('notifyBtn')}: ${name} (${t('incompleteBtn')})`;
  document.getElementById('notif-target-ids').value = userId;
  document.getElementById('notif-classroom-id').value = '';
  const titleEl = document.getElementById('notif-title-input');
  const msgEl   = document.getElementById('notif-message-input');
  if (titleEl) titleEl.value = t('incompleteBtn');
  if (msgEl)   msgEl.value  = t('studentNotFilledHint');
  openModal('notif-modal');
}

function sendWrongNotif(userId, name) {
  document.getElementById('notif-recipient-info').textContent = `${t('notifyBtn')}: ${name} (${t('wrongFillBtn')})`;
  document.getElementById('notif-target-ids').value = userId;
  document.getElementById('notif-classroom-id').value = '';
  const titleEl = document.getElementById('notif-title-input');
  const msgEl   = document.getElementById('notif-message-input');
  if (titleEl) titleEl.value = t('wrongFillBtn');
  if (msgEl)   msgEl.value  = t('wrongFillBtn');
  openModal('notif-modal');
}

// ============================================
// SEND NOTIFICATION
// ============================================
function sendToStudent(userId, name) {
  document.getElementById('notif-recipient-info').textContent = `${t('notifyBtn')}: ${name}`;
  document.getElementById('notif-target-ids').value = userId;
  document.getElementById('notif-classroom-id').value = '';
  openModal('notif-modal');
}

function sendToClassroom(classroomId) {
  document.getElementById('notif-recipient-info').textContent = `${t('notifyBtn')}: ${t('notFilledLabel')}`;
  document.getElementById('notif-target-ids').value = '';
  document.getElementById('notif-classroom-id').value = classroomId;
  openModal('notif-modal');
}

function sendToSelected() {
  if (!selectedStudentIds.length) {
    showToast(t('notifications'), t('selectStudentFirst'), 'warning');
    return;
  }
  document.getElementById('notif-recipient-info').textContent = `${t('notifyBtn')}: ${selectedStudentIds.length} ${t('personPH')}`;
  document.getElementById('notif-target-ids').value = selectedStudentIds.join(',');
  document.getElementById('notif-classroom-id').value = '';
  openModal('notif-modal');
}

async function submitNotification() {
  const title = document.getElementById('notif-title-input')?.value || '';
  const message = document.getElementById('notif-message-input')?.value || '';
  const type = document.getElementById('notif-type-select')?.value || 'reminder';
  const targetIds = document.getElementById('notif-target-ids')?.value || '';
  const classroomId = document.getElementById('notif-classroom-id')?.value || '';

  if (!title) { showToast(t('notifications'), t('pleaseEnterTitle'), 'warning'); return; }

  const payload = { title, message, type };
  if (classroomId) payload.classroom_id = classroomId;
  else payload.recipient_ids = targetIds.split(',').filter(Boolean);

  showLoading();
  try {
    const res = await fetch('api/teacher.php?action=send_notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    });
    const data = await res.json();
    showToast(data.success ? t('success') : t('failed'), data.message, data.success ? 'success' : 'error');
    if (data.success) closeModal('notif-modal');
  } catch {
    showToast(t('success'), `"${title}"`, 'success');
    closeModal('notif-modal');
  } finally {
    hideLoading();
  }
}

// ============================================
// ADD ADVISORY ROOM
// ============================================
function getYL() { return { pvc1:t('pvc1Label'), pvc2:t('pvc2Label'), pvc3:t('pvc3Label'), pvs1:t('pvs1Label'), pvs2:t('pvs2Label') }; }
function getYearBadge(yl, extraStyle='') { const YEAR_LABEL=getYL(); const cls = (yl||'').startsWith('pvs') ? 'badge-amber' : 'badge-blue'; return `<span class="badge ${cls}"${extraStyle?' style="'+extraStyle+'"':''}>${YEAR_LABEL[yl]||yl||'-'}</span>`; }

let _allRoomsCache = [];

async function openAddRoomModal() {
  const sel = document.getElementById('new-room-select');
  const infoEl = document.getElementById('new-room-info');
  if (infoEl) infoEl.style.display = 'none';
  sel.innerHTML = `<option value="">${t('loadingRooms')}</option>`;
  openModal('add-room-modal');

  try {
    const res = await fetch('api/teacher.php?action=get_all_classrooms', { credentials: 'include' });
    const data = await res.json();
    if (data.success && data.data.length) {
      _allRoomsCache = data.data;
      const YL = getYL();
      const groups = {};
      data.data.forEach(c => {
        const g = YL[c.year_level] || c.year_level;
        if (!groups[g]) groups[g] = [];
        groups[g].push(c);
      });
      sel.innerHTML = `<option value="">${t('selectRoomPH')}</option>`;
      Object.entries(groups).forEach(([label, rooms]) => {
        const og = document.createElement('optgroup');
        og.label = label;
        rooms.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `${c.room_code}  –  ${c.room_name}`;
          og.appendChild(opt);
        });
        sel.appendChild(og);
      });
      sel.onchange = () => {
        const YL2 = getYL();
        const c = _allRoomsCache.find(x => x.id == sel.value);
        if (c && infoEl) {
          document.getElementById('new-room-info-text').innerHTML =
            `<strong>${c.room_name}</strong> &nbsp;|&nbsp; ${YL2[c.year_level]||c.year_level} &nbsp;|&nbsp; ${t('academicYear')} ${c.academic_year}`;
          infoEl.style.display = 'block';
        } else if (infoEl) { infoEl.style.display = 'none'; }
      };
    } else {
      sel.innerHTML = `<option value="">${t('noClassroomInSystem')}</option>`;
    }
  } catch {
    sel.innerHTML = `<option value="">${t('loadFailed')}</option>`;
  }
}

async function submitAddAdvisoryRoom() {
  const classroomId = document.getElementById('new-room-select')?.value;
  if (!classroomId) {
    showToast(t('notifications'), t('pleaseSelectRoom'), 'warning');
    return;
  }

  try {
    const res = await fetch('api/teacher.php?action=add_advisory_room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classroom_id: parseInt(classroomId) }),
      credentials: 'include'
    });
    const data = await res.json();
    showToast(data.success ? t('success') : t('failed'), data.message, data.success ? 'success' : 'error');
    if (data.success) { closeModal('add-room-modal'); loadClassrooms(); }
  } catch {
    showToast(t('failed'), t('tryAgain'), 'error');
  }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    const res = await fetch('api/teacher.php?action=dashboard', { credentials: 'include' });
    const data = await res.json();
    if (data.success) renderDashboardCharts(data.data);
  } catch {
    renderDashboardCharts({ status_counts: [], by_classroom: [], by_province: [] });
  }
}

function renderRoomStatsTable(byClassroom) {
  const tbody = document.getElementById('room-stats-tbody');
  if (!tbody) return;
  if (!byClassroom.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted)">${t('noData')}</td></tr>`;
    return;
  }
  tbody.innerHTML = byClassroom.map(c => {
    const total     = c.total || 0;
    const submitted = c.submitted || 0;
    const notStart  = c.not_started || 0;
    const pct = total ? Math.round((submitted / total) * 100) : 0;
    return `<tr>
      <td style="font-weight:600">${c.room_name}</td>
      <td>${getYearBadge(c.year_level)}</td>
      <td style="text-align:center">${total}</td>
      <td style="text-align:center;color:var(--success);font-weight:600">${submitted}</td>
      <td style="text-align:center;color:var(--red-700);font-weight:600">${notStart}</td>
      <td style="min-width:120px">
        <div class="progress" style="margin-bottom:2px"><div class="progress-bar ${pct>=80?'green':pct>=50?'':'amber'}" style="width:${pct}%"></div></div>
        <div style="font-size:0.7rem;color:var(--text-muted);text-align:right">${pct}%</div>
      </td>
      <td>
        ${notStart > 0 ? `<button class="btn btn-sm btn-outline" onclick="sendToClassroomNotStarted('${c.room_name}',${c.id||0})">${t('notifyBtn')} (${notStart})</button>` : `<span style="color:var(--success);font-size:.8rem">${t('allDoneCheck')}</span>`}
      </td>
    </tr>`;
  }).join('');
}

// ── Tooltip helpers ──────────────────────────────────────────
const _piePct = { tooltip: { callbacks: { label: ctx => { const tot=ctx.dataset.data.reduce((a,b)=>a+b,0); const p=tot?Math.round(ctx.parsed/tot*100):0; return ` ${ctx.label}: ${ctx.parsed} ${t('personPH')} (${p}%)`; } } } };
const _barPct = { tooltip: { callbacks: { label: ctx => { const tot=ctx.dataset.data.reduce((a,b)=>a+b,0); const p=tot?Math.round(ctx.parsed.y/tot*100):0; return ` ${ctx.parsed.y} ${t('personPH')} (${p}%)`; } } } };
const _stackPct = { tooltip: { callbacks: { label: ctx => { const tot=ctx.chart.data.datasets.reduce((a,ds)=>a+(ds.data[ctx.dataIndex]||0),0); const p=tot?Math.round(ctx.parsed.y/tot*100):0; return ` ${ctx.dataset.label}: ${ctx.parsed.y} ${t('personPH')} (${p}%)`; } } } };

function renderDashboardCharts(data) {
  const statusCounts = { submitted: 0, not_started: 0 };
  (data.status_counts || []).forEach(s => { if (s.form_status !== 'draft') statusCounts[s.form_status] = parseInt(s.cnt); });

  const total = statusCounts.submitted + statusCounts.not_started;
  if (document.getElementById('dash-total'))     document.getElementById('dash-total').textContent     = total;
  if (document.getElementById('dash-submitted')) document.getElementById('dash-submitted').textContent = statusCounts.submitted;
  if (document.getElementById('dash-pending'))   document.getElementById('dash-pending').textContent   = statusCounts.not_started;

  if (window.Chart) {
    const statusCtx = document.getElementById('statusChart')?.getContext('2d');
    if (statusCtx) {
      if (window._statusChart) window._statusChart.destroy();
      window._statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: { labels: [t('filledLabel'),t('notFilledLabel')], datasets: [{ data: [statusCounts.submitted, statusCounts.not_started], backgroundColor: ['#16a34a','#ef4444'], borderWidth: 2 }] },
        options: { responsive: true, aspectRatio: 2, plugins: { legend: { position: 'bottom' }, ..._piePct } }
      });
    }

    const classCtx = document.getElementById('classroomChart')?.getContext('2d');
    const byClassroom = data.by_classroom || [];
    if (classCtx && byClassroom.length) {
      if (window._classChart) window._classChart.destroy();
      window._classChart = new Chart(classCtx, {
        type: 'bar',
        data: {
          labels: byClassroom.map(c => c.room_name),
          datasets: [
            { label: t('filledLabel'),    data: byClassroom.map(c => c.submitted),   backgroundColor: '#16a34a' },
            { label: t('notFilledLabel'), data: byClassroom.map(c => c.not_started), backgroundColor: '#ef4444' }
          ]
        },
        options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks:{stepSize:1} } }, plugins: { legend: { position: 'top' }, ..._stackPct } }
      });
    }

    const YEAR_ORDER  = ['pvc1','pvc2','pvc3','pvs1','pvs2'];
    const YEAR_COLORS = ['#3b82f6','#6366f1','#8b5cf6','#f59e0b','#ef4444'];
    const ym = {};
    allStudentsRaw.forEach(s => { if (s.year_level) ym[s.year_level] = (ym[s.year_level]||0)+1; });
    const YL = getYL();
    const yearCtx = document.getElementById('yearChart')?.getContext('2d');
    if (yearCtx) {
      if (window._yearChart) window._yearChart.destroy();
      window._yearChart = new Chart(yearCtx, {
        type: 'bar',
        data: { labels: YEAR_ORDER.map(k=>YL[k]), datasets: [{ label:t('totalStudents'), data: YEAR_ORDER.map(k=>ym[k]||0), backgroundColor: YEAR_COLORS, borderRadius: 6 }] },
        options: { responsive: true, aspectRatio: 3, plugins: { legend: { display: false }, ..._barPct }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    }

    const gm = { male: 0, female: 0 };
    allStudentsRaw.forEach(s => { const g = (s.gender==='female'||['นางสาว','นาง'].includes(s.prefix)) ? 'female' : 'male'; gm[g]++; });
    const genderCtx = document.getElementById('tcGenderChart')?.getContext('2d');
    if (genderCtx) {
      if (window._tcGenderChart) window._tcGenderChart.destroy();
      window._tcGenderChart = new Chart(genderCtx, {
        type: 'pie',
        data: { labels: [t('male'),t('female')], datasets: [{ data: [gm.male, gm.female], backgroundColor: ['#3b82f6','#ec4899'], borderWidth: 2 }] },
        options: { responsive: true, aspectRatio: 2, plugins: { legend: { position: 'bottom' }, ..._piePct } }
      });
    }

    const NAT_KNOWN = ['ไทย','เวียดนาม','ลาว','กัมพูชา'];
    const NAT_COLOR  = { ไทย:'#3b82f6', เวียดนาม:'#ef4444', ลาว:'#16a34a', กัมพูชา:'#f59e0b', อื่นๆ:'#8b5cf6', ไม่ระบุ:'#94a3b8' };
    const nm = {};
    allStudentsRaw.forEach(s => { const raw=(s.nationality||'').trim(); const n=raw===''?'ไม่ระบุ':NAT_KNOWN.includes(raw)?raw:'อื่นๆ'; nm[n]=(nm[n]||0)+1; });
    const natKeys = ['ไทย','เวียดนาม','ลาว','กัมพูชา','อื่นๆ','ไม่ระบุ'].filter(k=>nm[k]);
    const natCtx = document.getElementById('tcNatChart')?.getContext('2d');
    if (natCtx) {
      if (window._tcNatChart) window._tcNatChart.destroy();
      window._tcNatChart = new Chart(natCtx, {
        type: 'bar',
        data: { labels: natKeys.map(k=>translateNat(k)), datasets: [{ label:t('totalLabel'), data: natKeys.map(k=>nm[k]), backgroundColor: natKeys.map(k=>NAT_COLOR[k]), borderRadius: 6 }] },
        options: { responsive: true, aspectRatio: 3, plugins: { legend: { display: false }, ..._barPct }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    }
  }

  renderRoomStatsTable(data.by_classroom || []);
}

function sendToClassroomNotStarted(roomName, classroomId) {
  const ids = allStudentsRaw.filter(s => s.form_status === 'not_started' && (classroomId ? s.classroom_id == classroomId : true)).map(s => s.user_id);
  document.getElementById('notif-recipient-info').textContent = `${t('notifyBtn')}: ${roomName} (${ids.length} ${t('personPH')})`;
  document.getElementById('notif-target-ids').value = ids.join(',');
  document.getElementById('notif-classroom-id').value = '';
  openModal('notif-modal');
}

// Stop polling when navigating away from room-detail
const _baseSwitchView = typeof switchView === 'function' ? switchView : null;
window.switchView = function(viewName) {
  if (viewName !== 'room-detail') stopRoomPolling();
  if (_baseSwitchView) _baseSwitchView(viewName);
  if (viewName === 'dashboard') loadDashboard();
};

// Re-render charts when language changes so labels update
if (typeof onLangChange === 'function') {
  onLangChange(() => {
    renderClassroomCards();
    if (allStudents.length) renderStudentTable(allStudents);
    if (currentRoom) {
      const roomStudents = allStudentsRaw.filter(s => s.classroom_id == currentRoom.id);
      renderRoomTable(roomStudents);
      renderRoomCharts(roomStudents);
    }
    loadDashboard();
  });
}
