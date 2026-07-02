// ============================================================
// student.js - Student Portal Logic
// ============================================================

let studentData = null;
let currentPage = 1;
let friendsData = [];
let healthData = [];
let canvasDrawing = false;
let lastX = 0, lastY = 0;
let drawColor = '#000000';
let drawSize = 3;
let isEraser = false;
let docPhotoType = 'pvs'; // 'pvs' = ปวส. | 'pvc' = ปวช.
let studentPhotoDataUrl = null;
let mapPhotoDataUrl = null;
let autoSaveTimer = null;
const AUTOSAVE_DELAY = 1200;

function handlePhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    studentPhotoDataUrl = e.target.result;
    const nameEl = document.getElementById('photo-filename');
    const thumbWrap = document.getElementById('photo-preview-thumb');
    const thumbImg = document.getElementById('photo-thumb-img');
    const clearBtn = document.getElementById('photo-clear-btn');
    if (nameEl) nameEl.textContent = file.name;
    if (thumbImg) thumbImg.src = e.target.result;
    if (thumbWrap) thumbWrap.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'inline-block';
    triggerPreview();
  };
  reader.readAsDataURL(file);
}

function clearStudentPhoto() {
  studentPhotoDataUrl = null;
  const nameEl = document.getElementById('photo-filename');
  const thumbWrap = document.getElementById('photo-preview-thumb');
  const clearBtn = document.getElementById('photo-clear-btn');
  if (nameEl) nameEl.textContent = t('noPhotoText');
  if (thumbWrap) thumbWrap.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
  triggerPreview();
}

function handleMapUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    mapPhotoDataUrl = e.target.result;
    const nameEl = document.getElementById('map-filename');
    const thumbWrap = document.getElementById('map-preview-thumb');
    const thumbImg = document.getElementById('map-thumb-img');
    const clearBtn = document.getElementById('map-clear-btn');
    if (nameEl) nameEl.textContent = file.name;
    if (thumbImg) thumbImg.src = e.target.result;
    if (thumbWrap) thumbWrap.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'inline-block';
    triggerPreview();
  };
  reader.readAsDataURL(file);
}

function clearMapPhoto() {
  mapPhotoDataUrl = null;
  const nameEl = document.getElementById('map-filename');
  const thumbWrap = document.getElementById('map-preview-thumb');
  const clearBtn = document.getElementById('map-clear-btn');
  if (nameEl) nameEl.textContent = t('noPhotoText');
  if (thumbWrap) thumbWrap.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
  triggerPreview();
}

function setDocPhotoType(type) {
  docPhotoType = type;
  const pvs = document.getElementById('code-pvs-wrap');
  const pvc = document.getElementById('code-pvc-wrap');
  if (pvs) pvs.style.display = type === 'pvs' ? 'block' : 'none';
  if (pvc) pvc.style.display = type === 'pvc' ? 'block' : 'none';
  triggerPreview();
}

// ── Init ────────────────────────────────────────────────────
async function initStudent() {
  const session = getSession();
  if (!session || (session.role !== 'student' && session.role !== 'admin')) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('sidebar-name').textContent = session.full_name || '';
  document.getElementById('sidebar-userid').textContent = session.user_id || '';
  const av = document.getElementById('sidebar-avatar');
  if (av) av.textContent = (session.full_name || 'S').charAt(0).toUpperCase();
  if (session.role === 'admin') {
    const backBtn = document.getElementById('back-admin-btn');
    if (backBtn) backBtn.style.display = 'block';
  }

  await loadStudentData(session.user_id);
  switchView('form');

  window.addEventListener('beforeunload', flushAutoSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAutoSave();
  });
}

// ── Load Data ────────────────────────────────────────────────
async function loadStudentData(userId) {
  showLoading();
  try {
    const res = await fetch(`api/student.php?action=get_profile&user_id=${userId}`, {credentials:'include'});
    const data = await res.json();
    if (data.success) {
      studentData = data.data.profile;
      friendsData = data.data.friends || [];
      healthData  = data.data.health_checkups || [];
      updateNotifBadge(data.data.unread_notifications || 0);
    }
  } catch {
    const session = getSession();
    const saved = JSON.parse(localStorage.getItem('student_form_' + session.user_id) || 'null');
    studentData = saved || {
      user_id: session.user_id,
      full_name: session.full_name,
      student_code: session.student_code || '67010010011',
      form_status: 'not_started',
      prefix: 'นาย',
      first_name_th: (session.full_name || '').replace(/^(นาย|นางสาว|นาง)\s*/,'').split(' ')[0] || '',
      last_name_th:  (session.full_name || '').replace(/^(นาย|นางสาว|นาง)\s*/,'').split(' ').slice(1).join(' ') || '',
      room_name: 'คบ.ดิจิทัล 1/1',
      year_level: 1,
    };
  } finally {
    hideLoading();
    if (studentData?.form_status === 'submitted' || studentData?.form_status === 'draft') {
      populateAllForms();
      renderFriendsTable();
      restoreMediaPreviews();
      if (studentData?.form_status === 'draft') showToast(t('autoSaved'), t('draftRestoredMsg'), 'info');
    }
    updateFormStatus();
    updatePreview(1);
  }
}

// ── Restore photo/map previews & photo type from saved draft ──
function restoreMediaPreviews() {
  const d = studentData;
  if (!d) return;

  if (d._photoType) {
    docPhotoType = d._photoType;
    const pvs = document.getElementById('code-pvs-wrap');
    const pvc = document.getElementById('code-pvc-wrap');
    if (pvs) pvs.style.display = docPhotoType === 'pvs' ? 'block' : 'none';
    if (pvc) pvc.style.display = docPhotoType === 'pvc' ? 'block' : 'none';
  }
  const photoTypeRadio = document.querySelector(`input[name="photo_type"][value="${d._photoType || 'pvs'}"]`);
  if (photoTypeRadio) photoTypeRadio.checked = true;

  if (d._photoUrl) {
    studentPhotoDataUrl = d._photoUrl;
    const nameEl = document.getElementById('photo-filename');
    const thumbWrap = document.getElementById('photo-preview-thumb');
    const thumbImg = document.getElementById('photo-thumb-img');
    const clearBtn = document.getElementById('photo-clear-btn');
    if (nameEl) nameEl.textContent = t('photoSaved');
    if (thumbImg) thumbImg.src = d._photoUrl;
    if (thumbWrap) thumbWrap.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'inline-block';
  }

  if (d._mapUrl) {
    mapPhotoDataUrl = d._mapUrl;
    const nameEl = document.getElementById('map-filename');
    const thumbWrap = document.getElementById('map-preview-thumb');
    const thumbImg = document.getElementById('map-thumb-img');
    const clearBtn = document.getElementById('map-clear-btn');
    if (nameEl) nameEl.textContent = t('photoSaved');
    if (thumbImg) thumbImg.src = d._mapUrl;
    if (thumbWrap) thumbWrap.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'inline-block';
  }
}

// ── Populate Forms ───────────────────────────────────────────
function populateAllForms() {
  if (!studentData) return;
  const d = studentData;
  setVal('student_code', d.student_code);
  setVal('classroom_display', d.room_name);
  setVal('year_level_display', d.year_level ? `ปวส. ${d.year_level}` : '');

  ['prefix','first_name_th','last_name_th','first_name_en','last_name_en','nickname','gender',
   'date_of_birth','race','nationality','religion','blood_type','id_card_number',
   'address_no','village_no','alley','road','subdistrict','district','province',
   'postal_code','phone','email','siblings_same_both','siblings_younger_same_both',
   'siblings_diff_father','siblings_younger_diff','student_code_pvs',
   'father_name','father_deceased_when','father_occupation','father_workplace',
   'father_income','father_education','father_address','father_phone','father_email','father_other',
   'mother_name','mother_deceased_when','mother_occupation','mother_workplace',
   'mother_income','mother_education','mother_address','mother_phone','mother_email','mother_other',
   'parent_status_detail','current_address','current_phone','current_email','address_type',
   'nearby_place','living_with','living_relation','guardian_name','guardian_occupation',
   'guardian_workplace','guardian_education','guardian_address','guardian_phone','guardian_email',
   'counselor_name','counselor_relation','counselor_address','counselor_postal','counselor_phone',
   'chronic_disease','past_disease','allergy','surgery_history','vision_condition',
   'hearing_condition','dental_condition','mental_behavior','special_abilities'
  ].forEach(f => setVal(f, d[f]));

  ['father_alive','mother_alive','parent_status'].forEach(name => {
    if (d[name]) {
      const r = document.querySelector(`input[name="${name}"][value="${d[name]}"]`);
      if (r) r.checked = true;
    }
  });

}

function setVal(name, val) {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el || val === null || val === undefined) return;
  el.value = val;
}

// ── Friends Table ────────────────────────────────────────────
function renderFriendsTable() {
  const tbody = document.getElementById('friends-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!friendsData.length) { addFriendRow(); return; }
  friendsData.forEach(f => addFriendRow(f.friend_name, f.friend_school, f.friend_phone));
}

function addFriendRow(name='', school='', phone='') {
  const tbody = document.getElementById('friends-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" name="friend_name[]" value="${name}" placeholder="ชื่อ-นามสกุล" oninput="triggerPreview()"></td>
    <td><input type="text" name="friend_school[]" value="${school}" placeholder="โรงเรียน/ชั้น/ห้อง" oninput="triggerPreview()"></td>
    <td><input type="text" name="friend_phone[]" value="${phone}" placeholder="ที่อยู่/เบอร์โทร" oninput="triggerPreview()"></td>
    <td><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove();triggerPreview()">&#x2715;</button></td>
  `;
  tbody.appendChild(tr);
}

function getFriendsData() {
  const names = [...document.querySelectorAll('[name="friend_name[]"]')];
  const schools = [...document.querySelectorAll('[name="friend_school[]"]')];
  const phones  = [...document.querySelectorAll('[name="friend_phone[]"]')];
  return names.map((n,i) => n.value.trim() ? {
    friend_name: n.value.trim(),
    friend_school: schools[i]?.value || '',
    friend_phone: phones[i]?.value || ''
  } : null).filter(Boolean);
}

// ── Print (override app.js) ──────────────────────────────────
function printDocument() {
  const container = document.getElementById('preview-container');
  if (!container) { window.print(); return; }

  const d = collectFormData();
  container.innerHTML =
    renderDocPage1(d) +
    renderDocPage2(d) +
    renderDocPage3(d) +
    renderDocPage4(d);

  // รอให้ font และ layout render เสร็จก่อนสั่งพิมพ์
  document.fonts.ready.then(() => {
    setTimeout(() => {
      window.print();
      setTimeout(() => updatePreview(currentPage), 1000);
    }, 200);
  });
}

// ── Page Navigation ──────────────────────────────────────────
function goToPage(page) {
  currentPage = page;
  document.querySelectorAll('.step-btn').forEach((b,i) => b.classList.toggle('active', i+1===page));
  document.querySelectorAll('.form-page').forEach((p,i) => p.style.display = i+1===page ? 'block' : 'none');
  updatePreview(page);
  document.querySelector('.split-left')?.scrollTo(0, 0);
}

// ── Collect Data ─────────────────────────────────────────────
function collectFormData() {
  const data = {};
  document.querySelectorAll('#student-form [name]').forEach(el => {
    const name = el.name;
    if (name.endsWith('[]')) return;
    if (el.type === 'radio') { if (el.checked) data[name] = el.value; }
    else data[name] = el.value;
  });
  data._photoType = docPhotoType;
  data._photoUrl  = studentPhotoDataUrl || null;
  data._mapUrl    = mapPhotoDataUrl || null;
  data.friends    = getFriendsData();
  return data;
}

// ── Save / Submit ────────────────────────────────────────────
async function submitForm() {
  showConfirm(t('confirmSubmit'), t('confirmSubmitMsg'), async () => {
    const data = collectFormData();
    data.form_status = 'submitted';
    await saveForm(data, 'submitted');
  }, 'primary');
}

async function saveForm(data, status, silent = false) {
  if (!silent) showLoading();
  const session = getSession();
  data.user_id = session?.user_id;
  try {
    const res = await fetch('api/student.php?action=save_profile', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data),
      credentials: 'include'
    });
    const result = await res.json();
    if (result.success) {
      if (!silent) showToast(t('saveSuccess'), result.message, 'success');
      if (studentData) studentData.form_status = status;
      updateFormStatus();
    } else if (!silent) {
      showToast(t('error'), result.message, 'error');
    }
  } catch {
    localStorage.setItem('student_form_' + session?.user_id, JSON.stringify({...data, form_status: status}));
    if (!silent) showToast(t('saveSuccess'), t('demoModeSaved'), 'success');
    if (studentData) studentData.form_status = status;
    updateFormStatus();
  } finally {
    if (!silent) hideLoading();
  }
}

function updateFormStatus() {
  const status = studentData?.form_status || 'not_started';
  const el = document.getElementById('form-status-badge');
  if (el) el.innerHTML = getStatusBadge(status);
  const btn = document.getElementById('submit-btn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = status === 'submitted' ? t('resubmitForm') : t('submitForm');
  }
}

// ── Preview ──────────────────────────────────────────────────
function triggerPreview() {
  updatePreview(currentPage);
  scheduleAutoSave();
}

// ── Auto Save ────────────────────────────────────────────────
function scheduleAutoSave() {
  if (!studentData || studentData.form_status === 'submitted') return;
  clearTimeout(autoSaveTimer);
  const el = document.getElementById('autosave-indicator');
  if (el) el.textContent = t('autoSaving');
  autoSaveTimer = setTimeout(() => { autoSaveTimer = null; autoSaveDraft(); }, AUTOSAVE_DELAY);
}

async function autoSaveDraft() {
  if (!studentData || studentData.form_status === 'submitted') return;
  const data = collectFormData();
  data.form_status = 'draft';
  persistDraftLocally(data, 'draft');
  await saveForm(data, 'draft', true);
  const el = document.getElementById('autosave-indicator');
  if (el) el.textContent = `${t('autoSaved')} ${new Date().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}`;
}

// เก็บข้อมูลลง localStorage ทันที (sync) กันข้อมูลหายตอนปิดหน้า/สลับแท็บก่อนที่ debounce จะทำงาน
function persistDraftLocally(data, status) {
  const session = getSession();
  if (!session?.user_id) return;
  const key = 'student_form_' + session.user_id;
  let existing = {};
  try { existing = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
  localStorage.setItem(key, JSON.stringify({ ...existing, ...data, form_status: status }));
}

function flushAutoSave() {
  // มีการแก้ไขค้างอยู่ (debounce ยังไม่ทำงาน) เท่านั้นถึงจะสั่งบันทึกทันที กันข้อมูลหายตอนปิดแท็บ/สลับหน้า
  if (!autoSaveTimer) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  autoSaveDraft();
}

function updatePreview(page) {
  const container = document.getElementById('preview-container');
  if (!container) return;
  const d = collectFormData();
  const renderers = [null, renderDocPage1, renderDocPage2, renderDocPage3, renderDocPage4];
  container.innerHTML = renderers[page] ? renderers[page](d) : '';
}

// ── Notifications ─────────────────────────────────────────────
async function loadNotifications() {
  try {
    const res = await fetch('api/student.php?action=get_notifications', {credentials:'include'});
    const data = await res.json();
    if (data.success) renderNotifications(data.data);
  } catch {
    renderNotifications([]);
  }
}

function renderNotifications(notifs) {
  ['notif-list','notif-list-drop'].forEach(id => {
    const list = document.getElementById(id);
    if (!list) return;
    if (!notifs.length) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim)">${t('noNotifications')}</div>`;
      return;
    }
    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${!n.is_read ? 'unread' : ''}">
        <div class="nt">${n.title}</div>
        <div class="nm">${n.message}</div>
        <div class="ns">${timeAgo(n.created_at)}${n.sender_name ? ` • โดย ${n.sender_name}` : ''}</div>
      </div>
    `).join('');
    updateNotifBadge(0);
  });
}

function toggleNotifDropdown() {
  const dd = document.getElementById('notif-dropdown');
  if (!dd) return;
  const wasOpen = dd.classList.contains('open');
  dd.classList.toggle('open');
  if (!wasOpen) loadNotifications();
}
