// ============================================================
// App.js - Common Utilities
// ============================================================

const API_BASE = 'api/';

// ── Theme ──────────────────────────────────────────────────
let currentTheme = localStorage.getItem('theme') || 'light';

function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  _updateThemeIcon();
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', currentTheme);
  document.documentElement.setAttribute('data-theme', currentTheme);
  _updateThemeIcon();
}

function _updateThemeIcon() {
  document.querySelectorAll('.theme-toggle-icon').forEach(el => {
    el.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  });
}

// ── Language ────────────────────────────────────────────────
function initLangBtn() {
  document.querySelectorAll('.lang-toggle-label').forEach(el => {
    el.textContent = currentLang === 'th' ? 'EN' : 'TH';
  });
}

function toggleLanguage() {
  setLanguage(currentLang === 'th' ? 'en' : 'th');
  document.querySelectorAll('.lang-toggle-label').forEach(el => {
    el.textContent = currentLang === 'th' ? 'EN' : 'TH';
  });
}

// ── API ─────────────────────────────────────────────────────
async function apiCall(endpoint, method = 'GET', data = null, showLoader = false) {
  if (showLoader) showLoading();
  try {
    const options = {method, headers:{'Content-Type':'application/json'}, credentials:'include'};
    if (data && method !== 'GET') options.body = JSON.stringify(data);
    const res = await fetch(endpoint, options);
    const json = await res.json();
    if (!res.ok && res.status === 401) { window.location.replace('index.html'); return null; }
    return json;
  } catch (err) {
    console.error('API Error:', err);
    showToast(t('error'), err.message, 'error');
    return null;
  } finally {
    if (showLoader) hideLoading();
  }
}

// ── Toast ────────────────────────────────────────────────────
function showToast(title, message = '', type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container') || _mkToastContainer();
  const typeClass = {success:'t-success', error:'t-error', warning:'t-warning', info:'t-info'}[type] || 't-info';
  const toast = document.createElement('div');
  toast.className = `toast ${typeClass}`;
  toast.innerHTML = `
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <span class="toast-close" onclick="this.parentElement.remove()">&#x2715;</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.style.opacity = '0', duration - 300);
  setTimeout(() => toast.remove(), duration);
}

function _mkToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// ── Loading ──────────────────────────────────────────────────
function showLoading(msg = '') {
  let el = document.getElementById('loading-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-screen';
    el.className = 'loading-screen';
    el.innerHTML = `<div class="spinner"></div><span>${msg || t('loading')}</span>`;
    document.body.appendChild(el);
  }
  el.classList.add('show');
}

function hideLoading() {
  document.getElementById('loading-screen')?.classList.remove('show');
}

// ── Modal ────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Confirm Dialog ───────────────────────────────────────────
function showConfirm(title, message, onConfirm, type = 'danger') {
  let modal = document.getElementById('confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h3 class="modal-title" id="confirm-title"></h3>
        </div>
        <div class="modal-body" id="confirm-msg" style="color:var(--text-sub)"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('confirm-modal')">${t('cancel')}</button>
          <button class="btn" id="confirm-ok-btn">${t('confirm')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = message;
  const btn = document.getElementById('confirm-ok-btn');
  btn.className = `btn btn-${type}`;
  btn.textContent = t('confirm');
  btn.onclick = () => { closeModal('confirm-modal'); onConfirm(); };
  openModal('confirm-modal');
}

// ── Sidebar ──────────────────────────────────────────────────
function initSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const syncBackdrop = () => backdrop.classList.toggle('show', sidebar.classList.contains('open'));
  const closeSidebar = () => { sidebar.classList.remove('open'); syncBackdrop(); };

  backdrop.addEventListener('click', closeSidebar);

  toggle.addEventListener('click', () => {
    if (window.innerWidth > 768) {
      document.body.classList.toggle('sidebar-collapsed');
    } else {
      sidebar.classList.toggle('open');
      syncBackdrop();
    }
  });

  document.addEventListener('click', e => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggle.contains(e.target))
      closeSidebar();
  });
}

// ── Session ──────────────────────────────────────────────────
function getSession() {
  try { return JSON.parse(sessionStorage.getItem('user_session')); } catch { return null; }
}
function setSession(data) { sessionStorage.setItem('user_session', JSON.stringify(data)); }
function clearSession() { sessionStorage.removeItem('user_session'); }

async function logout() {
  showLoading();
  await apiCall(API_BASE + 'logout.php', 'POST');
  clearSession();
  window.location.replace('index.html');
}

// ── Dates ────────────────────────────────────────────────────
function formatDate(dateStr, lang = currentLang) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  if (lang === 'th') {
    const m = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear() + 543}`;
  }
  return d.toLocaleDateString('en-US', {day:'2-digit', month:'short', year:'numeric'});
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}`;
}

function calculateAge(dobStr) {
  if (!dobStr) return '';
  const dob = new Date(dobStr), today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const NAT_KEY_MAP = {
  'ไทย': 'natThai', 'เวียดนาม': 'natVietnamese',
  'ลาว': 'natLao', 'กัมพูชา': 'natCambodian',
  'อื่นๆ': 'natOthers', 'ไม่ระบุ': 'natUnspecified',
};
function translateNat(nat) {
  if (!nat) return t('natUnspecified');
  return NAT_KEY_MAP[nat] ? t(NAT_KEY_MAP[nat]) : nat;
}

const DEPT_EN_MAP = {
  'คอมพิวเตอร์ธุรกิจดิจิทัล': 'Digital Business Technology',
  'แผนกวิชาคอมพิวเตอร์ธุรกิจดิจิทัล': 'Digital Business Technology',
};
function translateDept(dept) {
  if (!dept) return '-';
  if (currentLang === 'en') return DEPT_EN_MAP[dept.trim()] || dept;
  return dept;
}

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (currentLang === 'en') {
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)} hr ago`;
    if (diff < 604800) return `${Math.floor(diff/86400)} days ago`;
  } else {
    if (diff < 60) return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff/60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff/3600)} ชั่วโมงที่แล้ว`;
    if (diff < 604800) return `${Math.floor(diff/86400)} วันที่แล้ว`;
  }
  return formatDate(dateStr);
}

// ── Badges ───────────────────────────────────────────────────
function getStatusBadge(status) {
  const map = {
    submitted:  `<span class="badge badge-green">${t('statusSubmitted')}</span>`,
    draft:      `<span class="badge badge-amber">${t('statusDraft')}</span>`,
    not_started:`<span class="badge badge-gray">${t('statusNotStarted')}</span>`
  };
  return map[status] || `<span class="badge badge-gray">${t('statusNotStarted')}</span>`;
}

function getRoleBadge(role) {
  const map = {
    student: `<span class="badge badge-blue">${t('student')}</span>`,
    teacher: `<span class="badge badge-amber">${t('teacher')}</span>`,
    admin:   `<span class="badge badge-red">${t('admin')}</span>`
  };
  return map[role] || `<span class="badge badge-gray">${role}</span>`;
}

// ── Notification Badge ───────────────────────────────────────
function updateNotifBadge(count) {
  document.querySelectorAll('.notif-badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  });
}

// ── Export CSV ───────────────────────────────────────────────
function exportCSV(data, filename) {
  if (!data?.length) { showToast(t('noData'), '', 'warning'); return; }
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(row =>
    keys.map(k => `"${(row[k]||'').toString().replace(/"/g,'""')}"`).join(',')
  )].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'})),
    download: `${filename}.csv`
  });
  a.click();
}

// ── Print ────────────────────────────────────────────────────
function printDocument() { window.print(); }

// ── Debounce ─────────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ── View Switching ───────────────────────────────────────────
function switchView(viewName) {
  document.querySelectorAll('.view, .view-split').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(i => i.classList.remove('active'));

  const pane = document.getElementById(`view-${viewName}`);
  if (pane) pane.classList.add('active');

  const navLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);
  if (navLink) navLink.classList.add('active');

  if (window.innerWidth < 768) {
    document.querySelector('.sidebar')?.classList.remove('open');
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLangBtn();
  initSidebar();
  updateAllText();

  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', () => showConfirm(t('logout'), 'คุณต้องการออกจากระบบใช่หรือไม่?', logout, 'danger'));
  });
  document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
  document.querySelectorAll('[data-action="toggle-lang"]').forEach(btn => {
    btn.addEventListener('click', toggleLanguage);
  });
  document.querySelectorAll('.nav-link[data-view]').forEach(item => {
    item.addEventListener('click', () => switchView(item.getAttribute('data-view')));
  });
});
