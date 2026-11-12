// PCS Path app.
//
// Every screen draws from S, a snapshot of the database loaded at sign-in,
// and every change goes through DB (store.js), which is either the in-browser
// demo database or Supabase. After a change the current screen is redrawn.
'use strict';

let DB = null, S = null, me = null, role = null;
const ui = {
  dir: null, filt: 'todo', inbox: 'all', mdir: 'out', open: {}, tipOpen: {}, formOpen: {}, tabs: {},
  wk: 0, cso: null, edit: null, spm: null, suStep: 1, returnFor: null, roleEdit: null
};

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------
const ROLE_META = {
  member: { n: 'Member', d: 'Your own PCS checklist', i: 'ti-user-circle', bg: '#E6F1FB', fg: '#1A5FA8' },
  sponsor: { n: 'Sponsor', d: 'Your inbound member', i: 'ti-friends', bg: '#FBEEE0', fg: '#8A4B10' },
  worker: { n: 'Office worker', d: 'Sign off members at your office', i: 'ti-clipboard-check', bg: '#E9F3DD', fg: '#3C6E12' },
  lead: { n: 'Office lead admin', d: 'Scheduling, requests, office setup', i: 'ti-shield-half', bg: '#E1F5EE', fg: '#0A5344' },
  counsel: { n: 'Base counselor', d: 'Out-processing caseload', i: 'ti-user-check', bg: '#E6F1FB', fg: '#0D4680' },
  mpf: { n: 'Base MPF super admin', d: 'Profiles, master list, users', i: 'ti-building', bg: '#E9F3DD', fg: '#3C6E12' },
  cmd: { n: 'Commander', d: 'Squadron dashboards', i: 'ti-chart-bar', bg: '#E6F1FB', fg: '#0D4680' },
  global: { n: 'Global admin', d: 'Platform oversight', i: 'ti-shield-lock', bg: '#EEEDFE', fg: '#554CBB' }
};
const ROLE_ORDER = ['member', 'sponsor', 'worker', 'lead', 'counsel', 'cmd', 'mpf', 'global'];
const FLAG_OPTS = [
  ['fam', 'Travelling with family', 'Adds family medical and education clearance'],
  ['efmp', 'EFMP enrolled', 'Adds EFMP family needs assessment'],
  ['pov', 'Shipping a vehicle', 'Adds POV export and Pass and Registration'],
  ['pet', 'Bringing pets', 'Adds veterinary and pet travel clearance'],
  ['dorm', 'Living in the dorms', 'Adds unaccompanied housing inspection'],
  ['sipr', 'I hold a SIPR token', 'Adds token turn-in'],
  ['cust', 'I am a custodian or monitor', 'Equipment, bench stock, GPC or records'],
  ['moto', 'I ride a motorcycle', 'Adds MUSTT profile transfer'],
  ['air', 'I am aircrew or a jumper', 'Adds HARM records']
];
const TAG_LABEL = { fam: 'family', efmp: 'EFMP', pov: 'vehicle', pet: 'pets', dorm: 'dorm resident', sipr: 'SIPR token', cust: 'custodian', moto: 'motorcycle', air: 'aircrew' };
const MOVE_TYPES = ['OCONUS to OCONUS', 'OCONUS to CONUS', 'CONUS to OCONUS', 'CONUS to CONUS'];
const SCREENS = { member: 's-member', sponsor: 's-sponsor', worker: 's-worker', lead: 's-lead', counsel: 's-counsel', mpf: 's-mpf', cmd: 's-cmd', global: 's-global' };
const TABS = {
  member: ['m', ['tasks', 'inbox', 'docs', 'tips', 'me'], 'on'],
  sponsor: ['s', ['mem', 'prep', 'msg'], 'son'],
  worker: ['w', ['queue', 'req', 'hist', 'tips'], 'bon'],
  lead: ['l', ['sched', 'req', 'queue', 'office', 'tips'], 'lon'],
  counsel: ['c', ['mem', 'so', 'appt', 'tips'], 'con'],
  mpf: ['b', ['prof', 'tasks', 'appt', 'inb', 'users'], 'bon'],
  cmd: ['d', ['out', 'in', 'tips'], 'con'],
  global: ['g', ['health', 'bases', 'req', 'tips'], 'gon']
};
const NOTE_STYLE = {
  reminder: ['ti-bell', '#E6F1FB', '#0D4680'], overdue: ['ti-alert-triangle', '#FCEBEB', '#A32D2D'],
  message: ['ti-message', '#FBEEE0', '#8A4B10'], handoff: ['ti-plane', '#EEEDFE', '#554CBB'],
  signoff: ['ti-circle-check', '#E9F3DD', '#356210'], system: ['ti-info-circle', '#E6F1FB', '#0D4680']
};
const AV_COLORS = [['#B5D4F4', '#0D4680'], ['#C0DD97', '#356210'], ['#CECBF6', '#3C3489'], ['#F5C4B3', '#712B13'], ['#9FE1CB', '#0A5344'], ['#FAEEDA', '#7A4809']];
const RISK = { high: ['pr', 'High risk'], medium: ['pa', 'Attention'], low: ['pn', 'On track'] };
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------
const el = id => document.getElementById(id);
const val = id => { const e = el(id); return e ? e.value : ''; };
const checked = id => { const e = el(id); return !!(e && e.checked); };
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
const pill = (c, t) => `<span class="pill ${c}">${esc(t)}</span>`;
const emp = (i, t) => `<div class="emp"><i class="ti ${i}" aria-hidden="true"></i>${esc(t)}</div>`;
const dmr = (i, t) => `<div class="dmr"><i class="ti ${i}" aria-hidden="true"></i><span>${esc(t)}</span></div>`;
const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
const toggle = (attrs, on, label) => `<label class="tgl"><input type="checkbox" ${attrs}${on ? ' checked' : ''}><span class="tsl"></span><span class="sr">${esc(label)}</span></label>`;

let toastTimer;
function toast(msg, kind) {
  const t = el('toast');
  t.textContent = msg;
  t.className = 'toast on' + (kind === 'err' ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, kind === 'err' ? 5200 : 3400);
}
function show(id) {
  document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id));
  window.scrollTo(0, 0);
}
function busy(btnId, on, label) {
  const b = el(btnId); if (!b) return;
  if (on) { b.dataset.label = b.textContent; b.textContent = label || 'Working'; b.disabled = true; }
  else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
}

// Dates are stored as 'YYYY-MM-DD' and shown as '16 AUG 2026'.
const pad2 = n => (n < 10 ? '0' : '') + n;
const iso = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
function parseISO(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
const today = () => iso(new Date());
function addDays(s, n) { const d = parseISO(s); if (!d) return null; d.setDate(d.getDate() + n); return iso(d); }
function diffDays(a, b) { const x = parseISO(a), y = parseISO(b); return x && y ? Math.round((y - x) / 86400000) : null; }
function fmt(s) { const d = parseISO(s); return d ? pad2(d.getDate()) + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : 'not set'; }
function fmtShort(s) { const d = parseISO(s); return d ? pad2(d.getDate()) + ' ' + MON[d.getMonth()] : ''; }
function rel(s) {
  const d = diffDays(today(), s); if (d === null) return '';
  if (d === 0) return 'today'; if (d === 1) return 'tomorrow'; if (d === -1) return 'yesterday';
  return d > 0 ? 'in ' + d + ' days' : Math.abs(d) + ' days ago';
}
function when(ts) {
  if (!ts) return '';
  const d = new Date(ts), di = iso(d), gap = diffDays(di, today());
  const day = gap === 0 ? 'Today' : gap === 1 ? 'Yesterday' : fmtShort(di);
  return day + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function slotLabel(s) { const d = parseISO(s.slot_day); return d ? DOW[d.getDay()] + ' ' + fmtShort(s.slot_day) + ', ' + s.slot_time : s.slot_time; }
function weekStart(n) { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * n); return iso(d); }
function firstSentence(s) { s = String(s || ''); const i = s.indexOf('. '); return i > 0 ? s.slice(0, i + 1) : s; }
function initials(name) {
  const s = String(name || '').replace(/^(Mr|Mrs|Ms|Dr|A1C|Amn|AB|SrA|SSgt|TSgt|MSgt|SMSgt|CMSgt|2d Lt|2Lt|1st Lt|1Lt|Capt|Maj|Lt Col|Col|Brig Gen|Maj Gen|Lt Gen|Gen)\.?\s+/i, '');
  const p = s.split(/[\s,]+/).filter(Boolean);
  if (p.length >= 2) return (p[1].charAt(0) + p[0].charAt(0)).toUpperCase();
  return s.substring(0, 2).toUpperCase();
}
function avatar(p) {
  const key = String((p && p.id) || (p && p.name) || '?');
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const c = AV_COLORS[h % AV_COLORS.length];
  return `<div class="av" style="background:${c[0]};color:${c[1]}" aria-hidden="true">${esc(initials(p ? p.name : '?'))}</div>`;
}
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
function sortByName(a, b) { return String(a.name).localeCompare(String(b.name)); }

// ---------------------------------------------------------------------
// Data helpers (all read from the snapshot S)
// ---------------------------------------------------------------------
const P = id => S.profiles.find(p => p.id === id);
const B = id => S.bases.find(b => b.id === id);
const O = id => S.offices.find(o => o.id === id);
const TK = id => S.tasks.find(t => t.id === id);
const baseName = id => (B(id) || {}).name || 'Not yet assigned';
const hasRole = r => !!me && me.status === 'active' && (me.roles || []).includes(r);
const myOffice = () => (me && me.office_id ? O(me.office_id) : null);
const members = () => S.profiles.filter(p => p.status === 'active' && (p.roles || []).includes('member'));
const inBase = p => (p.dir === 'in' ? p.base_id : p.gaining_base);
const unlockedIn = p => p.dir === 'in' || p.handoff === 'complete';

function tasksFor(p, dir) {
  const base = dir === 'out' ? p.base_id : inBase(p);
  if (!base || (dir === 'out' && p.dir === 'in')) return [];
  const f = p.flags || {};
  return S.tasks.filter(t => t.base_id === base && t.dir === dir && (!t.tag || f[t.tag]))
    .sort((a, b) => (dir === 'out' ? b.offset_days - a.offset_days : a.offset_days - b.offset_days) || (a.sort - b.sort));
}
function dueOf(p, t) { return t.dir === 'out' ? addDays(p.depart, -t.offset_days) : addDays(p.rnltd, t.offset_days); }
function progOf(p, t) { return S.task_progress.find(r => r.member_id === p.id && r.task_id === t.id); }
function stateOf(p, t) {
  const r = progOf(p, t); if (r) return r.status;
  const d = dueOf(p, t);
  return d && d < today() ? 'overdue' : 'open';
}
const isFinal = s => s === 'done' || s === 'na';
function stats(p, dir) {
  const list = tasksFor(p, dir); let done = 0, over = 0, sub = 0;
  list.forEach(t => { const s = stateOf(p, t); if (isFinal(s)) done++; else if (s === 'overdue') over++; else if (s === 'submitted') sub++; });
  return { total: list.length, done, over, sub, pct: list.length ? Math.round(done / list.length * 100) : 0 };
}
function risk(p) {
  const s = stats(p, 'out'), days = diffDays(today(), p.depart);
  if (s.over >= 3 || (days !== null && days <= 14 && s.pct < 75)) return 'high';
  if (s.over > 0 || (days !== null && days <= 30 && s.pct < 50)) return 'medium';
  return 'low';
}
const riskRank = { high: 0, medium: 1, low: 2 };

// ---------------------------------------------------------------------
// Writes: save through DB, then update the snapshot
// ---------------------------------------------------------------------
const NO_ID = { task_progress: true };
const HAS_CREATED = { tips: 1, messages: 1, notifications: 1, appt_requests: 1, role_requests: 1, sponsor_prep: 1, task_files: 1, member_files: 1 };
function prep(table, r) {
  r = Object.assign({}, r);
  if (!NO_ID[table] && !r.id) r.id = DB.newId();
  if (HAS_CREATED[table] && !r.created_at) r.created_at = new Date().toISOString();
  return r;
}
function saved() { DB.cache(S); if (navigator.onLine === false) toast('Saved on this device. It syncs when you reconnect.'); }
async function ins(table, rows) {
  rows = (Array.isArray(rows) ? rows : [rows]).map(r => prep(table, r));
  try { await DB.insert(table, rows); S[table].push(...rows); saved(); return rows; } catch (e) { return fail(e); }
}
async function upd(table, match, patch) {
  try { await DB.update(table, match, patch); S[table].forEach(r => { if (DB.matches(r, match)) Object.assign(r, patch); }); saved(); return true; } catch (e) { return fail(e); }
}
async function del(table, match) {
  try {
    await DB.remove(table, match);
    S[table] = S[table].filter(r => !DB.matches(r, match));
    if (table === 'tasks' && match.id) S.task_progress = S.task_progress.filter(r => r.task_id !== match.id);
    saved(); return true;
  } catch (e) { return fail(e); }
}
async function ups(table, row, keys) {
  try {
    await DB.upsert(table, row, keys);
    const m = {}; keys.forEach(k => { m[k] = row[k]; });
    const ex = S[table].find(r => DB.matches(r, m));
    if (ex) Object.assign(ex, row); else S[table].push(Object.assign({}, row));
    saved(); return true;
  } catch (e) { return fail(e); }
}
async function fail(e) {
  console.error(e);
  toast('Could not save. ' + ((e && e.message) || ''), 'err');
  try { await reload(); renderCurrent(); } catch (_) { /* keep what we have */ }
  return false;
}
// Notifications. A dedupe key stops the same reminder being sent twice.
async function notifyMany(list) {
  const rows = list.filter(n => n.user_id).map(n => prep('notifications', Object.assign({ kind: 'system', body: '', is_read: false, dedupe_key: null }, n)))
    .filter(n => !(n.dedupe_key && S.notifications.some(x => x.user_id === n.user_id && x.dedupe_key === n.dedupe_key)));
  if (!rows.length) return;
  try {
    await DB.insertIgnore('notifications', rows, ['user_id', 'dedupe_key']);
    rows.forEach(r => { if (r.user_id === me.id) S.notifications.push(r); });
    DB.cache(S);
  } catch (e) { console.warn('Notification not sent', e); }
}
const notify = (user_id, kind, title, body, dedupe_key) => notifyMany([{ user_id, kind, title, body, dedupe_key: dedupe_key || null }]);

async function reload() {
  S = await DB.loadAll();
  (window.PCS_TABLES || []).forEach(t => { if (!Array.isArray(S[t])) S[t] = []; });
  S.profiles.forEach(p => { p.roles = p.roles || []; p.flags = p.flags || {}; p.docs = p.docs || {}; });
  if (me) me = P(me.id) || null;
}

// ---------------------------------------------------------------------
// Start-up, sign in, sign up
// ---------------------------------------------------------------------
async function boot() {
  try { DB = await window.PCS_DB_READY; } catch (e) {
    el('bootmsg').innerHTML = '<i class="ti ti-plug-connected-x" aria-hidden="true"></i>' + esc(e.message) + '<button class="ibtn" onclick="location.reload()">Try again</button>';
    return;
  }
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(() => {});
  DB.onRecovery = async () => {
    const p = window.prompt('Choose a new password (at least 8 characters)');
    if (!p || p.length < 8) { toast('Password not changed. It needs at least 8 characters.', 'err'); return; }
    try { await DB.updatePassword(p); toast('Password updated.'); } catch (e) { toast(e.message, 'err'); }
  };
  window.addEventListener('online', async () => {
    setOnline(true);
    const n = await DB.flush();
    if (me) { try { await reload(); renderCurrent(); } catch (_) { /* stay on cached data */ } }
    if (n) toast('Back online. ' + n + ' change' + (n > 1 ? 's' : '') + ' synced.');
  });
  window.addEventListener('offline', () => setOnline(false));
  if (navigator.onLine === false) setOnline(false);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && me && navigator.onLine !== false && DB.mode === 'live') {
      try { await reload(); renderCurrent(); } catch (_) { /* ignore */ }
    }
  });
  renderLoginExtras();
  try {
    if (navigator.onLine !== false) await DB.flush();
    const uid = await DB.session();
    if (uid) { await enterAs(uid); return; }
  } catch (e) { console.error(e); toast(e.message || 'Could not load your data.', 'err'); }
  show('s-login');
}
function setOnline(v) { el('offbar').classList.toggle('on', !v); }

function renderLoginExtras() {
  const mb = el('modebar'), dl = el('demolist');
  if (DB.mode !== 'demo') {
    mb.className = 'modebar';
    dl.innerHTML = '<div style="text-align:center"><a class="lbtn" href="?demo" style="text-decoration:none"><i class="ti ti-flask" aria-hidden="true"></i> Try the demo with example people</a></div>';
    return;
  }
  const live = !!(window.PCS_CONFIG && window.PCS_CONFIG.supabaseUrl);
  mb.className = 'modebar on';
  mb.innerHTML = '<i class="ti ti-flask" style="font-size:14px" aria-hidden="true"></i><span>Demo mode. Example data, saved in this browser only.' + (live ? ' <a href="./" style="color:inherit">Go to the real app</a>' : '') + '</span>';
  dl.innerHTML = '<div class="slbl" style="padding-left:0">Demo accounts &middot; password: demo</div><div class="stack" style="margin-top:8px">' +
    window.PCS_SEED.demoAccounts.map(a => `<button type="button" class="acct" onclick="quick('${esc(a.email)}')"><i class="ti ${a.i}" style="font-size:17px;color:${a.c}" aria-hidden="true"></i><span><span class="an">${esc(a.n)}</span><span class="ad">${esc(a.d)}</span></span></button>`).join('') +
    '</div><button type="button" class="ibtn" style="width:100%;margin-top:9px" onclick="resetDemo()">Reset demo data</button>';
}
function togglePw(id, btn) {
  const inp = el(id), showing = inp.type === 'text';
  inp.type = showing ? 'password' : 'text';
  btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
  btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  btn.innerHTML = `<i class="ti ${showing ? 'ti-eye' : 'ti-eye-off'}" aria-hidden="true"></i>`;
}
function quick(email) { el('lg-email').value = email; el('lg-pass').value = 'demo'; doLogin(); }
async function resetDemo() {
  if (!window.confirm('Reset the demo? Every change made in this browser is erased.')) return;
  DB.reset(); me = null; role = null; toast('Demo data reset.');
}
async function doLogin() {
  const email = val('lg-email').trim().toLowerCase(), pass = val('lg-pass');
  if (!email) { toast('Enter your email to sign in.', 'err'); return; }
  if (!pass) { toast('Enter your password.', 'err'); return; }
  busy('lg-go', true, 'Signing in');
  try { const uid = await DB.signIn(email, pass); el('lg-pass').value = ''; await enterAs(uid); }
  catch (e) { toast(e.message || 'Sign in failed.', 'err'); }
  finally { busy('lg-go', false); }
}
async function forgot() {
  const email = val('lg-email').trim();
  if (DB.mode === 'demo') { toast('Demo accounts all use the password "demo".'); return; }
  if (!email) { toast('Enter your email first, then tap Forgot password.', 'err'); return; }
  try { await DB.resetPassword(email); toast('Check your email for a link to reset your password.'); } catch (e) { toast(e.message, 'err'); }
}
async function signOut() {
  try { await DB.signOut(); } catch (e) { console.warn(e); }
  me = null; role = null; S = null; ui.tabs = {}; ui.dir = null; ui.open = {};
  show('s-login');
}
async function enterAs(uid) {
  await reload();
  me = P(uid);
  if (!me) {
    toast('Your profile was not found. If you just set up the database, check SETUP.md step 3.', 'err');
    await DB.signOut(); show('s-login'); return;
  }
  role = null; ui.tabs = {}; ui.dir = null;
  if (me.status !== 'active') { showPending(); return; }
  if (me.roles.length === 1) enterRole(me.roles[0]); else showRoles();
}

function baseOptions(bases, selected, emptyLabel) {
  return (emptyLabel ? opt('', emptyLabel, !selected) : '') + bases.map(b => opt(b.id, b.name, b.id === selected)).join('');
}
async function startSignup() {
  let bases;
  try { bases = await DB.listBases(); } catch (e) { toast('Could not load the list of bases. Check your connection.', 'err'); return; }
  el('su-base').innerHTML = baseOptions(bases.filter(b => b.live), null, 'Choose your base');
  el('su-gain').innerHTML = baseOptions(bases, null, 'Not yet assigned');
  el('su-flags').innerHTML = FLAG_OPTS.map(f => `<div class="rule"><div style="flex:1"><div class="rt">${esc(f[1])}</div><div class="ts">${esc(f[2])}</div></div>${toggle('id="su-f-' + f[0] + '"', false, f[1])}</div>`).join('');
  ui.suStep = 1; suShow(); suDirChanged(); show('s-signup');
}
function suShow() {
  [1, 2, 3].forEach(i => { el('su-' + i).classList.toggle('on', i === ui.suStep); el('sb' + i).classList.toggle('on', i <= ui.suStep); });
  el('su-step').textContent = { 1: 'Step 1 of 3 · Who you are', 2: 'Step 2 of 3 · Your move', 3: 'Step 3 of 3 · What applies to you' }[ui.suStep];
  window.scrollTo(0, 0);
}
function suDirChanged() {
  const d = val('su-dir');
  el('su-gainwrap').style.display = d === 'in' ? 'none' : '';
  el('su-depwrap').style.display = d === 'in' ? 'none' : '';
}
function suValidate(step) {
  if (step === 1) {
    if (!val('su-name').trim()) return 'Add your rank and name to continue.';
    if (!/^\S+@\S+\.\S+$/.test(val('su-email').trim())) return 'Add a valid work email to continue.';
    if (val('su-pass').length < 8) return 'Choose a password of at least 8 characters.';
    if (val('su-pass2') !== val('su-pass')) return 'The two passwords do not match. Tap the eye to check them.';
    if (!val('su-base')) return 'Choose your current base.';
  }
  if (step === 2) return moveError(val('su-dir'), val('su-dep'), val('su-rnltd'));
  return null;
}
function moveError(dir, dep, rnltd) {
  if (dir !== 'in' && !dep) return 'Add your projected departure date.';
  if (dir === 'in' && !rnltd) return 'Add your RNLTD, the date you report to this base.';
  if (dep && rnltd && rnltd < dep) return 'Your RNLTD is before your departure date. Check both dates.';
  return null;
}
function suNext(n) {
  if (n > ui.suStep) { for (let s = ui.suStep; s < n; s++) { const err = suValidate(s); if (err) { toast(err, 'err'); return; } } }
  ui.suStep = n; suShow();
}
async function submitProfile() {
  const err = suValidate(1) || suValidate(2);
  if (err) { toast(err, 'err'); return; }
  const flags = {}; FLAG_OPTS.forEach(f => { flags[f[0]] = checked('su-f-' + f[0]); });
  const dir = val('su-dir');
  const meta = {
    name: val('su-name').trim(), unit: val('su-unit').trim(), base_id: val('su-base'), dir,
    gaining_base: dir === 'in' ? '' : val('su-gain'), depart: dir === 'in' ? '' : val('su-dep'),
    rnltd: val('su-rnltd'), move_type: val('su-type'), flags
  };
  const email = val('su-email').trim().toLowerCase();
  busy('su-go', true, 'Submitting');
  try {
    const r = await DB.signUp(email, val('su-pass'), meta);
    el('su-pass').value = ''; el('su-pass2').value = '';
    if (r.needsConfirm) {
      show('s-login'); el('lg-email').value = email;
      toast('Almost done. Check your email and tap the confirmation link, then sign in.');
      return;
    }
    await enterAs(r.id);
  } catch (e) { toast(e.message, 'err'); }
  finally { busy('su-go', false); }
}

// Pending or sent-back profiles
function showPending() {
  show('s-pending');
  const p = me, returned = p.status === 'returned';
  el('pd-name').textContent = p.name;
  el('pd-sub').textContent = (returned ? 'Sent back by ' : 'Waiting on ') + baseName(p.base_id) + ' MPF';
  let h = '';
  if (returned) {
    h += `<div class="card" style="border-color:#F2C4C4"><div class="row"><i class="ti ti-arrow-back-up" style="font-size:22px;color:#A32D2D" aria-hidden="true"></i><div style="flex:1"><div class="tn">Your MPF asked for changes</div><div class="ts" style="line-height:1.6">${esc(p.return_note || 'Check your details below and resubmit.')}</div></div></div></div>`;
    h += `<div class="card"><div class="dlbl">Your move</div>${moveEditor('pe', p)}<div class="dlbl" style="margin-top:4px">What applies to you</div>${FLAG_OPTS.map(f => `<div class="rule"><div style="flex:1"><div class="rt">${esc(f[1])}</div></div>${toggle('id="pe-f-' + f[0] + '"', p.flags[f[0]], f[1])}</div>`).join('')}</div>`;
    h += `<button class="pbtn bblue" id="pe-go" onclick="resubmit()">Resubmit for review</button>`;
  } else {
    h += `<div class="card" style="text-align:center;padding:26px 16px"><i class="ti ti-clock-hour-4" style="font-size:34px;color:#7A4809" aria-hidden="true"></i><div class="tn" style="margin-top:11px">MPF is reviewing your profile</div><div class="ts" style="line-height:1.6">They confirm your unit, dates and orders before your checklist unlocks. Most profiles clear within one duty day. You get a notification the moment it does.</div></div>`;
    h += `<div class="card"><div class="dlbl">What you submitted</div>${profileSummary(p)}</div>`;
    h += `<div class="card soft"><div class="tn">While you wait</div><div class="ts" style="line-height:1.6">If your orders are already final, email them to your CSS now. That is the single thing most likely to hold up your review.</div></div>`;
    h += `<button class="pbtn bblue" onclick="checkAgain()">Check again</button>`;
  }
  h += `<button class="ibtn" style="width:100%" onclick="signOut()">Sign out</button>`;
  el('pd-body').innerHTML = h;
}
function profileSummary(p) {
  const opts = FLAG_OPTS.filter(f => p.flags[f[0]]).map(f => TAG_LABEL[f[0]]);
  const dirTxt = p.dir === 'in' ? 'In-processing at ' + baseName(p.base_id) : (p.dir === 'both' ? 'Mid-move, ' : 'Out-processing, ') + baseName(p.base_id) + ' to ' + baseName(p.gaining_base);
  return dmr('ti-user', p.name + (p.unit ? ', ' + p.unit : '')) + dmr('ti-plane-departure', dirTxt) +
    (p.dir !== 'in' ? dmr('ti-calendar', 'Departs ' + fmt(p.depart)) : '') + dmr('ti-calendar-event', 'RNLTD ' + fmt(p.rnltd)) +
    dmr('ti-list-check', opts.length ? opts.join(', ') : 'No extra circumstances selected');
}
async function checkAgain() { await enterAs(me.id); if (me && me.status === 'pending') toast('Still waiting on MPF review.'); }
async function resubmit() {
  const m = readMove('pe'); const err = moveError(m.dir, m.depart, m.rnltd);
  if (err) { toast(err, 'err'); return; }
  const flags = {}; FLAG_OPTS.forEach(f => { flags[f[0]] = checked('pe-f-' + f[0]); });
  if (await upd('profiles', { id: me.id }, Object.assign(m, { flags, status: 'pending', return_note: null }))) { toast('Resubmitted. Your MPF has been asked to review it again.'); showPending(); }
}

// Shared editor for departure details
function moveEditor(pre, p) {
  const bases = S.bases.slice().sort(sortByName);
  return `<label class="fl" for="${pre}-dir">What are you doing</label><select class="fs" id="${pre}-dir">${opt('out', 'Out-processing', p.dir === 'out')}${opt('in', 'In-processing', p.dir === 'in')}${opt('both', 'Both, mid-move', p.dir === 'both')}</select>
<label class="fl" for="${pre}-gain">Gaining base</label><select class="fs" id="${pre}-gain">${baseOptions(bases, p.gaining_base, 'Not yet assigned')}</select>
<div class="g2"><div><label class="fl" for="${pre}-dep">Departure date</label><input class="fi" type="date" id="${pre}-dep" value="${esc(p.depart || '')}"></div><div><label class="fl" for="${pre}-rnltd">RNLTD</label><input class="fi" type="date" id="${pre}-rnltd" value="${esc(p.rnltd || '')}"></div></div>
<label class="fl" for="${pre}-type">Move type</label><select class="fs" id="${pre}-type">${MOVE_TYPES.map(t => opt(t, t, p.move_type === t)).join('')}</select>`;
}
function readMove(pre) {
  return { dir: val(pre + '-dir'), gaining_base: val(pre + '-gain') || null, depart: val(pre + '-dep') || null, rnltd: val(pre + '-rnltd') || null, move_type: val(pre + '-type') };
}

// ---------------------------------------------------------------------
// Roles and tabs
// ---------------------------------------------------------------------
function showRoles() {
  show('s-roles');
  el('rl-name').textContent = me.name;
  el('rl-sub').textContent = (me.unit ? me.unit + ' · ' : '') + 'choose how you want to work';
  el('rolelist').innerHTML = ROLE_ORDER.filter(r => me.roles.includes(r)).map(r => {
    const m = ROLE_META[r];
    const extra = r === 'member' && me.depart ? ' · departs ' + fmt(me.depart) : '';
    return `<button class="rolecard" onclick="enterRole('${r}')"><span class="ricon" style="background:${m.bg}"><i class="ti ${m.i}" style="font-size:19px;color:${m.fg}" aria-hidden="true"></i></span><span style="flex:1"><span class="tn" style="display:block">${esc(m.n)}</span><span class="ts" style="display:block">${esc(m.d + extra)}</span></span><i class="ti ti-chevron-right" style="font-size:16px;color:var(--t3)" aria-hidden="true"></i></button>`;
  }).join('');
}
function switchRole() { if (me && me.roles.length > 1) showRoles(); else signOut(); }
function enterRole(r) {
  role = r;
  show(SCREENS[r]);
  if (r === 'member') {
    if (!ui.dir) ui.dir = me.dir === 'in' ? 'in' : 'out';
    runReminders().then(() => { if (role === 'member') drawInbox(); });
  }
  drawRole();
  tab(ui.tabs[r] || TABS[r][1][0]);
  // A brand-new base gets the starter checklist automatically, no button needed.
  if (r === 'mpf' && me.base_id && !ui.autoStarter && !S.tasks.some(t => t.base_id === me.base_id)) { ui.autoStarter = true; loadStarter(); }
}
function tab(t) {
  const cfg = TABS[role]; if (!cfg) return;
  const pre = cfg[0], cls = cfg[2];
  ui.tabs[role] = t;
  cfg[1].forEach(id => {
    const a = el(pre + 't-' + id), b = el(pre + 'n-' + id);
    if (a) a.classList.toggle('on', id === t);
    if (b) { b.classList.toggle(cls, id === t); if (id === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  });
}
function drawRole() {
  ({ member: drawMember, sponsor: drawSponsor, worker: drawWorker, lead: drawLead, counsel: drawCounsel, mpf: drawMpf, cmd: drawCmd, global: drawGlobal })[role]();
}
function renderCurrent() {
  if (!me) return;
  if (me.status !== 'active') { showPending(); return; }
  if (role && me.roles.includes(role)) drawRole();
  else if (role) { showRoles(); toast('Your roles have changed.'); }
}
function toggleForm(key) { ui.formOpen[key] = !ui.formOpen[key]; drawRole(); }

// ---------------------------------------------------------------------
// Member
// ---------------------------------------------------------------------
function drawMember() {
  drawMemberHeader(); drawJourney(); drawTaskList(); drawInbox(); drawDocs();
  drawTipList('mtips', memberTips(), { showLabel: true }); drawProfileTab();
}
function drawMemberHeader() {
  const p = me;
  if (p.dir === 'in') ui.dir = 'in';
  el('mdirtog').style.display = p.dir === 'in' ? 'none' : 'flex';
  ['out', 'in'].forEach(d => { const b = el('mo-' + d); b.classList.toggle('on', ui.dir === d); b.setAttribute('aria-pressed', ui.dir === d ? 'true' : 'false'); });
  el('mhdr').style.background = ui.dir === 'out' ? '#1A5FA8' : '#554CBB';
  el('m-name').textContent = p.name;
  el('mhsub').textContent = ui.dir === 'out' ? 'Departs ' + fmt(p.depart) + ' · ' + baseName(p.base_id) : baseName(inBase(p)) + ' · RNLTD ' + fmt(p.rnltd);
  const s = stats(p, ui.dir);
  el('mpgf').style.width = s.pct + '%';
  el('mpg').setAttribute('aria-valuenow', s.pct);
  el('mpgl').textContent = s.done + ' of ' + s.total + ' complete' + (s.over ? ' · ' + s.over + ' overdue' : '') + (s.sub ? ' · ' + s.sub + ' waiting on offices' : '');
}
function drawJourney() {
  const p = me, e = el('jrny');
  if (p.dir === 'in') {
    e.innerHTML = `<div class="jleg"><div class="jbase">${esc(baseName(p.base_id))}</div><div class="jsub">RNLTD ${esc(fmt(p.rnltd))}</div></div><span class="jstat pp">In-processing</span>`;
    return;
  }
  const st = p.handoff === 'complete' ? '<span class="jstat pn">Handed off</span>' : '<span class="jstat pa">Pending final out</span>';
  e.innerHTML = `<div class="jleg"><div class="jbase">${esc(baseName(p.base_id))}</div><div class="jsub">Departs ${esc(fmt(p.depart))}</div></div><i class="ti ti-arrow-narrow-right jarrow" aria-hidden="true"></i><div class="jleg"><div class="jbase">${esc(baseName(p.gaining_base))}</div><div class="jsub">RNLTD ${esc(fmt(p.rnltd))}</div></div>${st}`;
}
function setDir(d) { ui.dir = d; drawMember(); }
function setFilt(f) {
  ui.filt = f;
  ['todo', 'all', 'done'].forEach(id => { const b = el('mf-' + id); b.classList.toggle('on', id === f); b.setAttribute('aria-pressed', id === f ? 'true' : 'false'); });
  drawTaskList();
}
function drawTaskList() {
  const p = me, dir = ui.dir, box = el('mlist');
  let h = '';
  if (dir === 'in' && !inBase(p)) { box.innerHTML = emp('ti-map-pin', 'Add your gaining base in Profile to see your in-processing checklist.'); return; }
  if (dir === 'out' && !p.depart) h += `<div class="card soft"><div class="ts">Add your departure date in Profile so we can work out your due dates.</div></div>`;
  const locked = dir === 'in' && !unlockedIn(p);
  if (locked) h += `<div class="card soft"><div class="row"><i class="ti ti-lock" style="font-size:20px;color:#554CBB" aria-hidden="true"></i><div style="flex:1"><div class="tn">${esc(baseName(p.gaining_base))} is holding your checklist</div><div class="ts">It unlocks when ${esc(baseName(p.base_id))} MPF signs your final out. Anything you already cleared carries over.</div></div></div></div>`;
  const list = tasksFor(p, dir);
  if (!list.length) { box.innerHTML = h + emp('ti-list', baseName(dir === 'out' ? p.base_id : inBase(p)) + ' has not published its ' + (dir === 'out' ? 'out' : 'in') + '-processing list in PCS Path yet.'); return; }
  const shown = list.filter(t => { const s = stateOf(p, t); return ui.filt === 'all' || (ui.filt === 'todo' ? !isFinal(s) : isFinal(s)); });
  if (!shown.length) { box.innerHTML = h + emp('ti-circle-check', ui.filt === 'done' ? 'Nothing completed yet' : 'You are all caught up'); return; }
  box.innerHTML = h + shown.map(t => taskCard(p, t, locked)).join('');
}
function taskCard(p, t, locked) {
  const s = stateOf(p, t), open = !!ui.open[t.id], due = dueOf(p, t), r = progOf(p, t), off = t.office_id ? O(t.office_id) : null, fin = isFinal(s);
  const badge = s === 'done' ? pill('pn', 'Complete') : s === 'na' ? pill('pgy', 'Not needed') : s === 'submitted' ? pill('pa', 'Waiting on office') : s === 'overdue' ? pill('pr', 'Overdue') : pill('pi', due ? fmtShort(due) : 'No date');
  const mark = `<span class="chk${fin ? ' ck' : s === 'overdue' ? ' od' : s === 'submitted' ? ' sb' : ''}" aria-hidden="true">${fin ? '<i class="ti ti-check"></i>' : s === 'submitted' ? '<i class="ti ti-hourglass"></i>' : ''}</span>`;
  const hours = (off && off.hours) || t.hours, phone = (off && off.phone) || t.phone;
  let rows = dmr('ti-building', t.office_name || (off && off.name) || '') + dmr('ti-map-pin', t.loc || (off && off.building) || '');
  if (hours) rows += dmr('ti-clock', hours);
  if (phone) rows += `<div class="dmr"><i class="ti ti-phone" aria-hidden="true"></i><span>DSN ${esc(phone)}</span></div>`;
  if (off && off.status && off.status !== 'Open') rows += dmr('ti-alert-circle', 'Office status right now: ' + off.status);
  if (due && !fin) rows += dmr('ti-calendar', 'Due ' + fmt(due) + ' (' + rel(due) + ')');
  if (t.carry && t.dir === 'out') rows += dmr('ti-arrow-right-circle', 'Records carry over to ' + baseName(p.gaining_base));
  if (t.carry && t.dir === 'in') rows += dmr('ti-link', 'Bring the records you carried from ' + baseName(p.base_id));
  if (t.triggers_handoff) rows += dmr('ti-plane', 'Signing this releases your record to ' + baseName(p.gaining_base));
  if (fin && r && r.signed_name) rows += dmr('ti-writing-sign', r.signed_name);
  if (s === 'submitted') rows += dmr('ti-hourglass', 'You marked your part done. ' + (off ? off.name : 'Your counselor') + ' confirms and signs it off.');
  const bk = myBooking(p.id, t.id);
  const pendingReq = !bk && S.appt_requests.find(a => a.member_id === p.id && a.task_id === t.id && a.status === 'pending');
  if (bk) rows += dmr('ti-calendar-check', 'Appointment: ' + slotLabel(bk.slot) + ' at ' + (t.loc || (off && off.building) || 'the office'));
  if (pendingReq) rows += dmr('ti-calendar-event', 'Appointment requested. The office will offer you a time.');
  let btns = '', picker = '';
  if (!fin && !locked) {
    if (s === 'submitted') btns += `<button class="ibtn" onclick="undoMine('${t.id}')">Undo, I am not done</button>`;
    else btns += `<button class="pbtn ${t.dir === 'out' ? 'bblue' : 'bpurp'}" onclick="markMine('${t.id}')">I have done my part</button>`;
    if (off && bk) btns += `<button class="ibtn" onclick="cancelBooking('${bk.appt.id}')">Cancel appointment</button>`;
    else if (off && ui.book !== t.id) btns += `<button class="ibtn" onclick="openBook('${t.id}')"><i class="ti ti-calendar-plus" aria-hidden="true"></i> Book a time</button>`;
    if (off && ui.book === t.id && !bk) picker = bookPicker(t, off);
  }
  btns = picker + (btns ? '<div class="brow">' + btns + '</div>' : '');
  const nf = formsFor(t.id).length + myFilesFor(p.id, t.id).length;
  return `<div class="card${fin ? ' dim' : ''}"><button class="trow" aria-expanded="${open}" onclick="tapTask('${t.id}')">${mark}<span class="tb"><span class="tn">${esc(t.name)}</span><span class="ts">${esc(t.office_name || '')}${t.loc ? ' · ' + esc(t.loc) : ''}${nf ? ' · <i class="ti ti-paperclip" aria-hidden="true"></i>' + nf + '<span class="sr"> files</span>' : ''}</span></span>${badge}</button><div class="tdet${open ? ' on' : ''}"><div class="dlbl">What this is</div><div class="dtxt">${esc(t.descr)}</div><div class="dmeta">${rows}</div>${memberFilesBlock(p, t, locked)}${btns}</div></div>`;
}

// ---------------------------------------------------------------------
// Files: blank forms on tasks (bucket "forms") and member uploads ("uploads")
// ---------------------------------------------------------------------
const MAX_FILE = 10 * 1024 * 1024;
const FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.heic,.doc,.docx,application/pdf,image/*';
const formsFor = taskId => S.task_files.filter(f => f.task_id === taskId).sort((a, b) => String(a.name).localeCompare(String(b.name)));
const myFilesFor = (memberId, taskId) => S.member_files.filter(f => f.member_id === memberId && (!taskId || f.task_id === taskId)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
function safeName(n) { return String(n || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80); }
function fmtSize(b) { if (!b && b !== 0) return ''; return b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 / 1024).toFixed(1) + ' MB'; }
function fileIcon(name) { return /\.pdf$/i.test(name) ? 'ti-file-type-pdf' : /\.(png|jpe?g|heic)$/i.test(name) ? 'ti-photo' : /\.docx?$/i.test(name) ? 'ti-file-type-doc' : 'ti-file'; }
function fileLine(f, openFn, removeFn) {
  return `<div class="fileln"><i class="ti ${fileIcon(f.name)} ft" aria-hidden="true"></i><span class="fn">${esc(f.name)} <span class="fz">${esc(fmtSize(f.size))}</span></span><button class="ibtn" onclick="${openFn}('${f.id}')">Open</button>${removeFn ? `<button class="ibtn dg" aria-label="Remove ${esc(f.name)}" onclick="${removeFn}('${f.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>` : ''}</div>`;
}
function uploadButton(label, handler, arg) {
  return `<button class="ibtn" onclick="this.nextElementSibling.click()"><i class="ti ti-upload" aria-hidden="true"></i> ${esc(label)}</button><input type="file" accept="${FILE_ACCEPT}" hidden onchange="${handler}('${arg}',this)">`;
}
function memberFilesBlock(p, t, locked) {
  const forms = formsFor(t.id), mine = myFilesFor(p.id, t.id), s = stateOf(p, t);
  let h = '';
  if (forms.length) h += `<div class="dlbl">Forms for this task</div><div class="fbox">${forms.map(f => fileLine(f, 'openForm')).join('')}</div>`;
  if (mine.length) h += `<div class="dlbl">Your files</div><div class="fbox">${mine.map(f => fileLine(f, 'openUpload', isFinal(s) ? null : 'removeUpload')).join('')}</div>`;
  if (!locked && !isFinal(s)) h += `<div class="brow" style="margin-bottom:12px">${uploadButton('Upload a file', 'uploadMine', t.id)}<span class="ts" style="margin:0;flex:1">PDF, photo or Word, up to 10 MB. Pilot: no SSNs or medical details.</span></div>`;
  return h;
}
function uploadsChips(memberId, taskId) {
  const files = myFilesFor(memberId, taskId);
  return files.length ? `<div class="chips" style="margin-top:6px">${files.map(f => `<button class="chipbtn" onclick="openUpload('${f.id}')"><i class="ti ti-paperclip" aria-hidden="true"></i><span>${esc(f.name)}</span></button>`).join('')}</div>` : '';
}
async function openFileUrl(bucket, path) {
  const w = window.open('', '_blank');
  try {
    const url = await DB.fileUrl(bucket, path);
    if (w) w.location.href = url; else location.href = url;
  } catch (e) { if (w) w.close(); toast('Could not open that file. ' + e.message, 'err'); }
}
function openForm(id) { const f = S.task_files.find(x => x.id === id); if (f) openFileUrl('forms', f.path); }
function openUpload(id) { const f = S.member_files.find(x => x.id === id); if (f) openFileUrl('uploads', f.path); }
function checkFile(f) {
  if (!f) return false;
  if (f.size > MAX_FILE) { toast('That file is too big. The limit is 10 MB.', 'err'); return false; }
  if (navigator.onLine === false) { toast('Connect to the internet to upload files.', 'err'); return false; }
  return true;
}
async function uploadMine(taskId, input) {
  const f = input.files[0]; input.value = '';
  if (!checkFile(f)) return;
  const t = TK(taskId), id = DB.newId(), path = me.id + '/' + taskId + '/' + id + '-' + safeName(f.name);
  toast('Uploading ' + f.name);
  try { await DB.uploadFile('uploads', path, f); } catch (e) { toast('Upload failed. ' + e.message, 'err'); return; }
  if (await ins('member_files', { id, member_id: me.id, task_id: taskId, name: f.name, path, size: f.size })) {
    const off = t.office_id ? O(t.office_id) : null;
    toast('Uploaded. ' + (off ? off.name : 'Your counselor') + ' can see it. Tap "I have done my part" when you are ready.');
    ui.open[taskId] = true; drawRole();
  }
}
async function removeUpload(id) {
  const f = S.member_files.find(x => x.id === id);
  if (!f || !window.confirm('Delete "' + f.name + '"? This cannot be undone.')) return;
  try { await DB.removeFile('uploads', f.path); } catch (e) { toast('Could not delete the file. ' + e.message, 'err'); return; }
  if (await del('member_files', { id })) { toast('File deleted.'); drawRole(); }
}
async function attachForm(taskId, input) {
  const f = input.files[0]; input.value = '';
  if (!checkFile(f)) return;
  const t = TK(taskId), id = DB.newId(), path = t.base_id + '/' + taskId + '/' + id + '-' + safeName(f.name);
  toast('Uploading ' + f.name);
  try { await DB.uploadFile('forms', path, f); } catch (e) { toast('Upload failed. ' + e.message, 'err'); return; }
  if (await ins('task_files', { id, task_id: taskId, name: f.name, path, size: f.size, uploaded_by: me.id })) { toast('Form attached. Members see it on "' + t.name + '".'); drawRole(); }
}
async function removeForm(id) {
  const f = S.task_files.find(x => x.id === id);
  if (!f || !window.confirm('Remove the form "' + f.name + '" from this task for everyone?')) return;
  try { await DB.removeFile('forms', f.path); } catch (e) { toast('Could not delete the file. ' + e.message, 'err'); return; }
  if (await del('task_files', { id })) { toast('Form removed.'); drawRole(); }
}
function formsManager(t) {
  const forms = formsFor(t.id);
  return `<div class="dlbl" style="margin-top:11px">Blank forms members can open</div>${forms.length ? `<div class="fbox">${forms.map(f => fileLine(f, 'openForm', 'removeForm')).join('')}</div>` : ''}<div class="brow">${uploadButton(forms.length ? 'Attach another form' : 'Attach a form', 'attachForm', t.id)}<span class="ts" style="margin:0;flex:1">Blank forms only. Anyone with the link can open them.</span></div>`;
}
function tapTask(id) { ui.open[id] = !ui.open[id]; drawTaskList(); }
async function markMine(taskId) {
  const t = TK(taskId);
  const ok = await ups('task_progress', { member_id: me.id, task_id: taskId, status: 'submitted', signed_by: null, signed_name: null, updated_at: new Date().toISOString() }, ['member_id', 'task_id']);
  if (ok) { toast('Marked. ' + ((t.office_id && O(t.office_id)) ? O(t.office_id).name : 'Your counselor') + ' will confirm and sign it off.'); drawMember(); }
}
async function undoMine(taskId) {
  if (await del('task_progress', { member_id: me.id, task_id: taskId, status: 'submitted' })) { toast('Undone.'); drawMember(); }
}
// ---------------------------------------------------------------------
// Appointments. Every office takes bookings on a weekly schedule, by
// default Monday to Friday 0800-1600 in 30-minute slots, with no setup.
// Slot rows only exist for times that are booked or blocked.
// ---------------------------------------------------------------------
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function officeSched(off) {
  return { days: String((off && off.open_days) || '12345'), open: (off && off.open_time) || '08:00', close: (off && off.close_time) || '16:00', len: parseInt((off && off.slot_minutes) || 30, 10) || 30 };
}
const toMin = hm => { const m = /^(\d{1,2}):(\d{2})/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : 0; };
const fromMin = n => pad2(Math.floor(n / 60)) + ':' + pad2(n % 60);
const hhmm = hm => String(hm || '').replace(':', '');
function schedLabel(off) {
  const s = officeSched(off), d = s.days.split('').map(Number).sort();
  const days = d.join('') === '12345' ? 'Mon–Fri' : d.map(x => DOW_SHORT[x]).join(', ');
  return days + ', ' + hhmm(s.open) + '–' + hhmm(s.close) + ', ' + s.len + '-minute appointments';
}
function timesFor(off, day) {
  const s = officeSched(off), d = parseISO(day);
  if (!d || !s.days.includes(String(d.getDay()))) return [];
  const out = [];
  for (let m = toMin(s.open); m + s.len <= toMin(s.close); m += s.len) out.push(fromMin(m));
  return out;
}
const slotAt = (offId, day, time) => S.slots.find(x => x.office_id === offId && x.slot_day === day && x.slot_time === time);
function freeTimes(off, day) {
  const now = new Date(), nowHm = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  return timesFor(off, day).filter(tm => { const r = slotAt(off.id, day, tm); return !(r && (r.member_id || r.blocked)) && !(day === today() && tm <= nowHm); });
}
function openDays(off, max) {
  const out = [];
  for (let i = 0; i < 42 && out.length < max; i++) { const d = addDays(today(), i), times = freeTimes(off, d); if (times.length) out.push({ day: d, times }); }
  return out;
}
function myBooking(memberId, taskId) {
  const appt = S.appt_requests.find(a => a.member_id === memberId && a.task_id === taskId && a.status === 'confirmed' && a.slot_id);
  const slot = appt && S.slots.find(x => x.id === appt.slot_id);
  return slot && slot.slot_day >= today() ? { appt, slot } : null;
}
function openBook(taskId) { ui.book = taskId; ui.bookDay = null; drawTaskList(); }
function bookPicker(t, off) {
  const days = openDays(off, 15);
  if (!days.length) return `<div class="af" style="margin-bottom:12px"><div class="ts" style="margin:0">${esc(off.name)} has no free times in the next six weeks. Call DSN ${esc(off.phone || t.phone || '')}.</div><div class="brow" style="margin-top:10px"><button class="ibtn" onclick="ui.book=null;drawTaskList()">Close</button></div></div>`;
  const day = days.find(d => d.day === ui.bookDay) ? ui.bookDay : days[0].day, times = days.find(d => d.day === day).times;
  return `<div class="af" style="margin-bottom:12px"><h4>Book ${esc(off.name)}</h4><div class="g2"><div><label class="fl" for="bk-day">Day</label><select class="fs" id="bk-day" onchange="ui.bookDay=this.value;drawTaskList()">${days.map(d => opt(d.day, DOW_SHORT[parseISO(d.day).getDay()] + ' ' + fmtShort(d.day) + (d.day === today() ? ' (today)' : ''), d.day === day)).join('')}</select></div><div><label class="fl" for="bk-time">Time</label><select class="fs" id="bk-time">${times.map(tm => opt(tm, hhmm(tm))).join('')}</select></div></div><div class="brow"><button class="pbtn ${t.dir === 'out' ? 'bblue' : 'bpurp'}" id="bk-go" onclick="bookTime('${t.id}')">Book it</button><button class="ibtn" onclick="ui.book=null;drawTaskList()">Cancel</button></div><div class="fhint" style="margin:8px 0 0">${esc(schedLabel(off))}. Your appointment is confirmed straight away.</div></div>`;
}
function bookErr(e) {
  const m = String(e && e.message || e);
  if (/duplicate|unique/i.test(m)) return 'Someone just took that time. Pick another one.';
  if (/row-level security|permission/i.test(m)) return 'Booking is not switched on yet. Your admin needs to run supabase/appointments.sql (SETUP.md step 2c).';
  return 'Could not book. ' + m;
}
async function bookTime(taskId) {
  const t = TK(taskId), off = O(t.office_id), day = val('bk-day'), time = val('bk-time');
  if (!day || !time) return;
  if (!freeTimes(off, day).includes(time)) { toast('Someone just took that time. Pick another one.', 'err'); drawTaskList(); return; }
  if (navigator.onLine === false) { toast('Connect to the internet to book an appointment.', 'err'); return; }
  busy('bk-go', true, 'Booking');
  const slot = { id: DB.newId(), office_id: off.id, slot_day: day, slot_time: time, member_id: me.id, blocked: false };
  try { await DB.insert('slots', [slot]); } catch (e) { toast(bookErr(e), 'err'); await reload(); drawMember(); return; }
  S.slots.push(slot);
  for (const a of S.appt_requests.filter(x => x.member_id === me.id && x.task_id === taskId && x.status === 'pending')) await del('appt_requests', { id: a.id });
  await ins('appt_requests', { member_id: me.id, task_id: taskId, office_id: off.id, note: '', status: 'confirmed', slot_id: slot.id });
  ui.book = null;
  toast('Booked: ' + off.name + ', ' + slotLabel(slot) + '.');
  drawMember();
}
async function cancelBooking(apptId) {
  const a = S.appt_requests.find(x => x.id === apptId), slot = a && S.slots.find(x => x.id === a.slot_id);
  if (!a || !window.confirm('Cancel this appointment' + (slot ? ' on ' + slotLabel(slot) : '') + '?')) return;
  if (slot && !(await del('slots', { id: slot.id }))) return;
  if (await del('appt_requests', { id: apptId })) { toast('Appointment cancelled. The time is free for someone else.'); drawMember(); }
}

// Inbox
function myNotes() { return S.notifications.filter(n => n.user_id === me.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); }
function setInbox(f) {
  ui.inbox = f;
  ['all', 'reminder', 'message'].forEach(id => { const b = el('ib-' + id); b.classList.toggle('on', id === f); b.setAttribute('aria-pressed', id === f ? 'true' : 'false'); });
  drawInbox();
}
function drawInbox() {
  const notes = myNotes(), unread = notes.filter(n => !n.is_read).length;
  const bg = el('mbadge'); bg.textContent = unread; bg.classList.toggle('on', unread > 0);
  const box = el('minbox'), comp = el('mcomp');
  if (ui.inbox === 'message') {
    const sp = me.sponsor_id ? P(me.sponsor_id) : null;
    comp.style.display = me.sponsor_id ? 'flex' : 'none';
    if (!me.sponsor_id) { box.innerHTML = emp('ti-friends', 'No sponsor assigned yet. The MPF at ' + baseName(inBase(me)) + ' assigns one when your record arrives.'); return; }
    box.innerHTML = `<div class="card soft"><div class="row">${avatar(sp)}<div style="flex:1"><div class="tn">${esc(sp ? sp.name : 'Your sponsor')}</div><div class="ts">Your sponsor at ${esc(baseName(inBase(me)))}</div></div></div></div>` + threadHTML(me.id);
    return;
  }
  comp.style.display = 'none';
  const list = notes.filter(n => ui.inbox === 'all' || n.kind === 'reminder' || n.kind === 'overdue');
  if (!list.length) { box.innerHTML = emp('ti-inbox', 'Nothing here'); return; }
  box.innerHTML = (unread ? `<div class="linkrow"><span class="ts" style="margin:0">${unread} unread</span><button class="lbtn" onclick="readAll()">Mark all read</button></div>` : '') +
    list.map(n => {
      const st = NOTE_STYLE[n.kind] || NOTE_STYLE.system;
      return `<button class="inb${n.is_read ? '' : ' unread'}" onclick="readNote('${n.id}')"><span class="inbi" style="background:${st[1]}"><i class="ti ${st[0]}" style="font-size:17px;color:${st[2]}" aria-hidden="true"></i></span><span style="flex:1"><span class="tn" style="display:block">${esc(n.title)}${n.is_read ? '' : '<span class="sr"> (unread)</span>'}</span><span class="ts" style="display:block">${esc(n.body)}</span><span style="display:block;font-size:10.5px;color:var(--t3);margin-top:6px">${esc(when(n.created_at))}</span></span></button>`;
    }).join('');
}
async function readNote(id) {
  const n = S.notifications.find(x => x.id === id);
  if (n && !n.is_read) await upd('notifications', { id }, { is_read: true });
  if (n && n.kind === 'message') { setInbox('message'); return; }
  drawInbox();
}
async function readAll() {
  for (const n of myNotes().filter(x => !x.is_read)) await upd('notifications', { id: n.id }, { is_read: true });
  drawInbox();
}

// Member <-> sponsor messages
function threadHTML(memberId) {
  const msgs = S.messages.filter(m => m.member_id === memberId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  if (!msgs.length) return emp('ti-message', 'No messages yet. Say hello.');
  return msgs.map(m => {
    const mine = m.sender_id === me.id, who = mine ? 'You' : ((P(m.sender_id) || {}).name || '');
    return `<div class="mw${mine ? ' mine' : ''}"><div class="msg ${mine ? 'me' : 'them'}">${esc(m.body)}</div><div class="msgt">${esc(who)} · ${esc(when(m.created_at))}</div></div>`;
  }).join('');
}
async function sendMsg(memberId, inputId) {
  const inp = el(inputId), v = inp.value.trim();
  if (!v || !memberId) return;
  if (!(await ins('messages', { member_id: memberId, sender_id: me.id, body: v }))) return;
  inp.value = '';
  const m = P(memberId), to = memberId === me.id ? me.sponsor_id : memberId;
  if (to) notify(to, 'message', 'New message from ' + me.name, v.slice(0, 160));
  drawRole();
  if (m) inp.focus();
}

// Documents to carry
function drawDocs() {
  const p = me, d = p.docs || {};
  const base = [
    ['orders', 'Ten printed copies of your PCS orders', 'Nearly every office asks for one. Keep a copy on your phone too.'],
    ['checklist', 'Printed out-processing checklist', 'Wet signatures collect on this at squadron final out'],
    ['itinerary', 'Flight itinerary', 'Needed by CSS, finance and passenger travel'],
    ['passport', 'No-fee passport', 'Apply through MPF as soon as orders drop'],
    ['lease', 'Lease or landlord clearance letter', 'If you live off base']
  ];
  const carry = tasksFor(p, 'out').filter(t => t.carry).map(t => ['task-' + t.id, t.name, 'Hand carry to ' + baseName(p.gaining_base)]);
  const row = x => `<div class="rule"><div style="flex:1"><div class="rt">${esc(x[1])}</div><div class="ts">${esc(x[2])}</div></div>${toggle(`onchange="flipDoc('${esc(x[0])}',this.checked)"`, d[x[0]], x[1])}</div>`;
  const files = myFilesFor(p.id);
  const filesCard = `<div class="card"><div class="tn">Your uploaded files</div><div class="ts" style="margin-bottom:6px">Only you and the offices that sign you off can open these. Upload files from inside a task.</div>${files.length ? files.map(f => { const t = TK(f.task_id); return fileLine(Object.assign({}, f, { name: f.name + (t ? ' · ' + t.name : '') }), 'openUpload'); }).join('') : '<div class="ts">Nothing uploaded yet.</div>'}</div>`;
  const forms = S.task_files.filter(f => { const t = TK(f.task_id); return t && (t.base_id === p.base_id || t.base_id === inBase(p)) && (!t.tag || (p.flags || {})[t.tag]); });
  const formsCard = forms.length ? `<div class="card"><div class="tn">Forms you can open</div><div class="ts" style="margin-bottom:6px">Blank forms your offices attached to tasks.</div>${forms.map(f => fileLine(Object.assign({}, f, { name: f.name + ' · ' + (TK(f.task_id) || {}).name }), 'openForm')).join('')}</div>` : '';
  el('mdocs').innerHTML = formsCard + filesCard + `<div class="card"><div class="tn">Have these ready</div><div class="ts" style="margin-bottom:6px">Tick each one off as you get it.</div>${base.map(row).join('')}</div>` +
    (carry.length ? `<div class="card"><div class="tn">Records that travel with you</div><div class="ts" style="margin-bottom:6px">Collect these before you leave ${esc(baseName(p.base_id))}.</div>${carry.map(row).join('')}</div>` : '');
}
async function flipDoc(k, v) { const docs = Object.assign({}, me.docs, { [k]: v }); await upd('profiles', { id: me.id }, { docs }); }

// Tips (shared by every role)
function memberTips() {
  const bases = [me.base_id, inBase(me)];
  return S.tips.filter(t => (!t.base_id || bases.includes(t.base_id)) && (t.applies === 'both' || t.applies === ui.dir));
}
function drawTipList(cid, list, o) {
  o = o || {};
  const box = el(cid); if (!box) return;
  list = list.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  let h = list.length ? '' : emp('ti-bulb', 'No tips yet');
  h += list.map(tp => {
    const key = cid + tp.id, open = !!ui.tipOpen[key];
    const yc = tp.applies === 'out' ? 'tout' : tp.applies === 'in' ? 'tin' : 'tbo';
    const yl = tp.applies === 'out' ? 'Out-processing' : tp.applies === 'in' ? 'In-processing' : 'Both';
    const canDel = o.canRemove && (tp.author_id === me.id || hasRole('global') || (hasRole('mpf') && tp.base_id === me.base_id));
    return `<div class="tipc"><button class="trow" aria-expanded="${open}" onclick="tapTip('${key}')"><span class="tb"><span class="tn">${esc(tp.title)}</span><span style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap"><span class="ttag ${yc}">${yl}</span>${o.showLabel ? '<span class="tbadge">' + esc(tp.label || '') + '</span>' : ''}</span></span><i class="ti ti-chevron-${open ? 'up' : 'down'}" style="font-size:15px;color:var(--t3)" aria-hidden="true"></i></button><div class="tipb${open ? ' on' : ''}">${esc(tp.body)}${canDel ? `<div><button class="ibtn dg" style="margin-top:10px" onclick="delTip('${tp.id}')">Remove</button></div>` : ''}</div></div>`;
  }).join('');
  if (o.tier) {
    const fk = 'tip-' + cid, f = 'tf' + cid;
    h += ui.formOpen[fk] ? `<div class="af"><h4>New tip</h4><label class="fl" for="${f}-t">Title</label><input class="fi" id="${f}-t" placeholder="Short headline"><label class="fl" for="${f}-b">Detail</label><textarea class="fi" id="${f}-b" placeholder="What members need to know"></textarea><label class="fl" for="${f}-y">Applies to</label><select class="fs" id="${f}-y">${opt('out', 'Out-processing')}${opt('in', 'In-processing')}${opt('both', 'Both')}</select><div class="brow"><button class="pbtn ${o.btn || 'bgreen'}" onclick="addTip('${cid}','${o.tier}')">Publish tip</button><button class="ibtn" onclick="toggleForm('${fk}')">Cancel</button></div></div>`
      : `<button class="pbtn ${o.btn || 'bgreen'}" onclick="toggleForm('${fk}')">Add tip</button>`;
  }
  box.innerHTML = h;
}
function tapTip(key) { ui.tipOpen[key] = !ui.tipOpen[key]; drawRole(); }
function tipLabel(tier) {
  if (tier === 'office') return (myOffice() || {}).name || 'Office';
  if (tier === 'counsel') return 'Base counselor';
  if (tier === 'cmd') return 'Commander' + (me.unit ? ', ' + me.unit : '');
  if (tier === 'global') return 'Global';
  return 'Base MPF';
}
async function addTip(cid, tier) {
  const f = 'tf' + cid, title = val(f + '-t').trim();
  if (!title) { toast('Give the tip a title.', 'err'); return; }
  const row = { base_id: tier === 'global' ? null : me.base_id, tier, label: tipLabel(tier), title, body: val(f + '-b').trim(), applies: val(f + '-y') || 'both', author_id: me.id };
  if (!(await ins('tips', row))) return;
  ui.formOpen['tip-' + cid] = false;
  toast('Tip published. Members see it in their Tips tab.');
  drawRole();
}
async function delTip(id) {
  if (!window.confirm('Remove this tip for everyone?')) return;
  if (await del('tips', { id })) { toast('Tip removed.'); drawRole(); }
}

// Member profile
function drawProfileTab() {
  const p = me;
  let h = `<div class="card"><div class="row">${avatar(p)}<div style="flex:1"><div class="tn">${esc(p.name)}</div><div class="ts">${esc((p.unit ? p.unit + ' · ' : '') + baseName(p.base_id))}</div></div>${pill('pn', 'Approved')}</div></div>`;
  h += `<div class="card"><div class="dlbl">Your move</div><div class="ts" style="margin:0 0 10px">Change these if your orders change. Due dates update straight away.</div>${moveEditor('mp', p)}<button class="pbtn bblue" onclick="saveMove()">Save move details</button></div>`;
  h += `<div class="card"><div class="dlbl">What applies to you</div><div class="ts" style="margin-bottom:8px">These control which tasks show on your checklist.</div>` +
    FLAG_OPTS.map(f => `<div class="rule"><div style="flex:1"><div class="rt">${esc(f[1])}</div><div class="ts">${esc(f[2])}</div></div>${toggle(`onchange="flipFlag('${f[0]}',this.checked)"`, p.flags[f[0]], f[1])}</div>`).join('') + '</div>';
  h += roleRequestCard();
  h += shareButton('Know someone else PCSing? Share PCS Path');
  h += `<button class="ibtn" style="width:100%" onclick="switchRole()">${me.roles.length > 1 ? 'Switch role' : 'Sign out'}</button>`;
  el('mprofile').innerHTML = h;
}
async function saveMove() {
  const m = readMove('mp'), err = moveError(m.dir, m.depart, m.rnltd);
  if (err) { toast(err, 'err'); return; }
  if (await upd('profiles', { id: me.id }, m)) { if (m.dir === 'in') ui.dir = 'in'; toast('Saved. Your due dates are updated.'); drawMember(); }
}
async function flipFlag(k, v) {
  const flags = Object.assign({}, me.flags, { [k]: v });
  if (await upd('profiles', { id: me.id }, { flags })) { toast('Checklist updated.'); drawMember(); tab('me'); }
}
function roleRequestCard() {
  const mine = S.role_requests.filter(r => r.user_id === me.id && r.status === 'pending');
  const avail = ROLE_ORDER.filter(r => !me.roles.includes(r) && r !== 'member' && r !== 'global');
  let h = `<div class="card"><div class="dlbl">Ask for another role</div>`;
  h += mine.map(r => `<div class="frow" style="border-top:none;padding-top:0">${pill('pa', 'Pending')}<span class="ts" style="margin:0">${esc(ROLE_META[r.wanted_role] ? ROLE_META[r.wanted_role].n : r.wanted_role)}</span></div>`).join('');
  if (!avail.length) return h + '<div class="ts">You hold every role you can request.</div></div>';
  h += `<div class="ts" style="margin-bottom:8px">For example, office worker at your section or sponsor for an inbound Airman. Your MPF approves it.</div><label class="fl" for="rq-role">Role</label><select class="fs" id="rq-role">${avail.map(r => opt(r, ROLE_META[r].n)).join('')}</select><label class="fl" for="rq-why">Why</label><input class="fi" id="rq-why" placeholder="Taking over as Medical Records lead"><button class="ibtn" style="width:100%" onclick="requestRole()">Send request</button></div>`;
  return h;
}
async function requestRole() {
  const r = val('rq-role'), why = val('rq-why').trim();
  if (!why) { toast('Add a short reason for your MPF.', 'err'); return; }
  const row = { user_id: me.id, name: me.name, base_id: me.base_id, current_roles: me.roles.map(x => ROLE_META[x].n).join(', '), wanted_role: r, reason: why, status: 'pending' };
  if (await ins('role_requests', row)) { toast('Request sent to ' + (r === 'mpf' ? 'a global admin' : 'your MPF') + '.'); drawRole(); }
}

// Automatic reminders, sent in the app when a member opens it.
async function runReminders() {
  const p = me; if (!p || !p.roles.includes('member')) return;
  const rules = {}; S.reminder_rules.filter(r => r.base_id === p.base_id).forEach(r => { rules[r.rule_key] = r.enabled; });
  const on = k => rules[k] !== false, td = today(), out = [];
  if (p.dir !== 'in' && p.depart) {
    const list = tasksFor(p, 'out');
    if (on('day1') && list.length) out.push({ kind: 'reminder', title: 'Out-processing has started', body: 'Start with ' + list[0].name + '. It has the longest lead time.', dedupe_key: 'day1' });
    const dd = diffDays(td, p.depart), s = stats(p, 'out');
    if (on('thirty') && dd !== null && dd <= 30 && dd >= 0 && s.total > s.done) out.push({ kind: 'reminder', title: dd + ' days to go', body: (s.total - s.done) + ' tasks still open. Your final out needs everything cleared.', dedupe_key: 'thirty' });
    list.forEach(t => {
      const st = stateOf(p, t), due = dueOf(p, t);
      if (st === 'overdue' && on('overdue')) out.push({ kind: 'overdue', title: t.name + ' is overdue', body: 'It was due ' + fmt(due) + '. ' + firstSentence(t.descr), dedupe_key: 'over-' + t.id + '-' + due });
      else if (st === 'open' && on('three') && due) {
        const d = diffDays(td, due);
        if (d >= 0 && d <= 3) out.push({ kind: 'reminder', title: t.name + ' due ' + rel(due), body: firstSentence(t.descr), dedupe_key: 'due3-' + t.id + '-' + due });
      }
    });
  }
  if (on('arrival') && p.rnltd && td >= p.rnltd && unlockedIn(p) && inBase(p)) {
    const first = tasksFor(p, 'in').slice(0, 3).map(t => t.name).join(', ');
    if (first) out.push({ kind: 'reminder', title: 'Welcome to ' + baseName(inBase(p)), body: 'Your first stops: ' + first + '.', dedupe_key: 'arrival-' + p.rnltd });
  }
  await notifyMany(out.map(n => Object.assign({ user_id: p.id }, n)));
}

// ---------------------------------------------------------------------
// Sponsor
// ---------------------------------------------------------------------
function drawSponsor() {
  el('sp-name').textContent = 'Sponsor · ' + me.name;
  const list = S.profiles.filter(p => p.sponsor_id === me.id).sort(sortByName);
  if (!list.find(m => m.id === ui.spm)) ui.spm = list[0] ? list[0].id : null;
  const m = ui.spm ? P(ui.spm) : null;
  el('sp-sub').textContent = list.length > 1 ? list.length + ' inbound members' : 'Your inbound member';
  el('scomp').style.display = m ? 'flex' : 'none';
  if (!m) {
    const e = emp('ti-friends', 'No inbound member is assigned to you yet. Your MPF assigns sponsors from the Inbound tab.');
    el('smem').innerHTML = e; el('sprep').innerHTML = e; el('smsgs').innerHTML = e; return;
  }
  const picker = list.length > 1 ? `<label class="fl" for="sp-pick">Member</label><select class="fs" id="sp-pick" onchange="ui.spm=this.value;drawSponsor()">${list.map(x => opt(x.id, x.name, x.id === m.id)).join('')}</select>` : '';
  const f = m.flags || {}, so = stats(m, 'out'), prepItems = S.sponsor_prep.filter(x => x.member_id === m.id), pd = prepItems.filter(x => x.done).length;
  let rows = dmr('ti-calendar', 'RNLTD ' + fmt(m.rnltd)) + dmr('ti-plane-departure', 'Leaves ' + baseName(m.base_id) + ' ' + fmt(m.depart));
  if (f.fam) rows += dmr('ti-users', 'Travelling with family' + (f.efmp ? ', EFMP enrolled' : ''));
  if (f.pet) rows += dmr('ti-paw', 'Bringing pets');
  if (f.pov) rows += dmr('ti-car', 'Shipping a vehicle');
  if (f.dorm) rows += dmr('ti-home', 'Dorm resident');
  const hand = m.handoff === 'complete' ? pill('pn', 'Record released') : pill('pa', 'Out-processing');
  el('smem').innerHTML = picker + `<div class="card"><div class="row">${avatar(m)}<div style="flex:1"><div class="tn">${esc(m.name)}</div><div class="ts">Inbound from ${esc(baseName(m.base_id))}</div></div>${hand}</div><div class="dmeta" style="margin-top:11px;margin-bottom:0">${rows}</div></div>` +
    `<div class="card"><div class="tn">Their out-processing progress</div><div class="ts">You see the shape of it, not their documents.</div><div class="frow"><div style="flex:1"><div class="rt">${so.done} of ${so.total} complete</div><div class="ts">${so.over ? so.over + ' overdue at ' + esc(baseName(m.base_id)) : 'Nothing overdue'}</div></div>${so.over ? pill('pa', 'Behind') : pill('pn', 'On track')}</div><div class="frow" style="padding-bottom:0"><div style="flex:1"><div class="rt">Arrival readiness</div><div class="ts">${pd} of ${prepItems.length} prep items done</div></div>${prepItems.length && pd === prepItems.length ? pill('pn', 'Ready') : pill('pa', 'In progress')}</div></div>`;
  let ph = prepItems.map(x => `<div class="card${x.done ? ' dim' : ''}"><div class="row"><button class="chk${x.done ? ' ck' : ''}" aria-pressed="${x.done}" aria-label="${x.done ? 'Mark not done' : 'Mark done'}: ${esc(x.title)}" onclick="togglePrep('${x.id}')">${x.done ? '<i class="ti ti-check"></i>' : ''}</button><div style="flex:1"><div class="tn">${esc(x.title)}</div><div class="ts">${esc(x.body || '')}</div></div><button class="ibtn" aria-label="Remove ${esc(x.title)}" onclick="delPrep('${x.id}')"><i class="ti ti-x" aria-hidden="true"></i></button></div></div>`).join('');
  if (!prepItems.length) ph += emp('ti-list-check', 'Nothing on the list yet.');
  ph += ui.formOpen.prep ? `<div class="af"><h4>New prep item</h4><label class="fl" for="pp-t">What needs doing</label><input class="fi" id="pp-t" placeholder="Book airport pickup"><label class="fl" for="pp-b">Detail</label><input class="fi" id="pp-b" placeholder="Optional"><div class="brow"><button class="pbtn bspon" onclick="addPrep()">Add to list</button><button class="ibtn" onclick="toggleForm('prep')">Cancel</button></div></div>` : `<button class="pbtn bspon" onclick="toggleForm('prep')">Add prep item</button>`;
  el('sprep').innerHTML = ph;
  el('smsgs').innerHTML = threadHTML(m.id);
}
async function togglePrep(id) { const x = S.sponsor_prep.find(i => i.id === id); if (await upd('sponsor_prep', { id }, { done: !x.done })) { toast(!x.done ? 'Marked not done.' : 'Marked done.'); drawSponsor(); } }
async function delPrep(id) { if (await del('sponsor_prep', { id })) drawSponsor(); }
async function addPrep() {
  const t = val('pp-t').trim(); if (!t) { toast('Say what needs doing.', 'err'); return; }
  if (await ins('sponsor_prep', { member_id: ui.spm, title: t, body: val('pp-b').trim(), done: false })) { ui.formOpen.prep = false; drawSponsor(); }
}

// ---------------------------------------------------------------------
// Office worker and office lead
// ---------------------------------------------------------------------
function noOffice() { return emp('ti-building', 'You are not linked to an office yet. Ask your MPF to set your office in Users.'); }
function queueFor(officeId) {
  const out = [];
  members().forEach(m => {
    if (m.id === me.id) return;
    const items = [];
    ['out', 'in'].forEach(dir => {
      if (dir === 'in' && !unlockedIn(m)) return;
      tasksFor(m, dir).forEach(t => {
        if (t.office_id !== officeId) return;
        const s = stateOf(m, t); if (isFinal(s)) return;
        items.push({ t, s, due: dueOf(m, t) });
      });
    });
    if (items.length) out.push({ m, items, sub: items.some(i => i.s === 'submitted'), over: items.some(i => i.s === 'overdue'), due: items.map(i => i.due || '9999').sort()[0] });
  });
  return out.sort((a, b) => (b.sub - a.sub) || (b.over - a.over) || String(a.due).localeCompare(String(b.due)));
}
function drawQueue(cid) {
  const off = myOffice(), box = el(cid);
  if (!off) { box.innerHTML = noOffice(); return; }
  const q = queueFor(off.id);
  if (!q.length) { box.innerHTML = emp('ti-circle-check', 'Nobody is waiting on ' + off.name + '.'); return; }
  box.innerHTML = q.map(({ m, items }) => `<div class="card"><div class="row">${avatar(m)}<div style="flex:1"><div class="tn">${esc(m.name)}</div><div class="ts">${m.dir === 'in' || m.handoff === 'complete' ? 'RNLTD ' + esc(fmt(m.rnltd)) : 'Departs ' + esc(fmt(m.depart))}</div></div></div>` +
    items.map(i => `<div class="frow"><div style="flex:1"><div style="font-size:12.5px;font-weight:600">${esc(i.t.name)}</div><div class="ts">${i.s === 'submitted' ? 'Member says their part is done' : i.due ? 'Due ' + esc(fmt(i.due)) : ''}</div>${uploadsChips(m.id, i.t.id)}</div>${i.s === 'submitted' ? pill('pa', 'Ready') : i.s === 'overdue' ? pill('pr', 'Overdue') : ''}</div><div class="brow" style="justify-content:flex-end;padding-bottom:4px"><button class="ibtn" onclick="signOff('${m.id}','${i.t.id}','na')">Not needed</button><button class="sbtn" onclick="signOff('${m.id}','${i.t.id}','done')">Sign off</button></div>`).join('') + '</div>').join('');
}
async function signOff(memberId, taskId, status) {
  const m = P(memberId), t = TK(taskId), off = myOffice();
  const who = (off ? off.name : ROLE_META[role].n) + ' on ' + fmtShort(today());
  const ok = await ups('task_progress', { member_id: memberId, task_id: taskId, status, signed_by: me.id, signed_name: status === 'na' ? 'Marked not needed by ' + who : 'Signed by ' + who, updated_at: new Date().toISOString() }, ['member_id', 'task_id']);
  if (!ok) return;
  const notes = [{ user_id: memberId, kind: 'signoff', title: t.name + (status === 'na' ? ' marked not needed' : ' signed off'), body: 'By ' + me.name + (off ? ', ' + off.name : '') + '.' }];
  if (t.triggers_handoff && status === 'done' && m.handoff !== 'complete' && m.gaining_base) {
    if (await upd('profiles', { id: memberId }, { handoff: 'complete' })) {
      notes.push({ user_id: memberId, kind: 'handoff', title: 'Your record is on its way to ' + baseName(m.gaining_base), body: 'Your in-processing checklist at ' + baseName(m.gaining_base) + ' is unlocked. Anything marked as carrying over goes with you.', dedupe_key: 'handoff' });
      if (m.sponsor_id) notes.push({ user_id: m.sponsor_id, kind: 'handoff', title: m.name + ' has finished out-processing', body: 'Their record is released to ' + baseName(m.gaining_base) + '.' });
    }
  }
  await notifyMany(notes);
  toast((status === 'na' ? 'Marked not needed. ' : 'Signed off. ') + m.name.split(',')[0] + ' has been notified.');
  drawRole();
}
function setBadge(id, n) { const b = el(id); if (b) { b.textContent = n; b.classList.toggle('on', n > 0); } }
// Office workers and leads answer their own office's requests. The MPF and
// counselor see every office at the base, so nothing sits unseen when an
// office has nobody linked to it yet.
function apptOffices() {
  if (role === 'worker' || role === 'lead') { const o = myOffice(); return o ? [o] : []; }
  return S.offices.filter(o => o.base_id === me.base_id).sort(sortByName);
}
const staffedOffice = o => S.profiles.some(p => p.office_id === o.id && p.status === 'active' && (p.roles.includes('worker') || p.roles.includes('lead')));
const canManageOffice = offId => ((role === 'worker' || role === 'lead') && me.office_id === offId) || role === 'mpf';
function drawAppts(cid, badgeId) {
  const offs = apptOffices(), box = el(cid), own = role === 'worker' || role === 'lead';
  if (!offs.length) { setBadge(badgeId, 0); box.innerHTML = own ? noOffice() : emp('ti-building', 'No offices at this base yet. The starter checklist adds them.'); return; }
  const ids = new Set(offs.map(o => o.id));
  const reqs = S.appt_requests.filter(a => ids.has(a.office_id) && a.status === 'pending').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const booked = S.appt_requests.map(a => ({ a, s: a.status === 'confirmed' && S.slots.find(x => x.id === a.slot_id) }))
    .filter(x => x.s && ids.has(x.a.office_id) && x.s.slot_day >= today()).sort((x, y) => (x.s.slot_day + x.s.slot_time).localeCompare(y.s.slot_day + y.s.slot_time));
  setBadge(badgeId, reqs.length + booked.filter(x => x.s.slot_day === today()).length);
  let h = `<div class="ts" style="margin:0 0 2px;line-height:1.5">${own ? 'Members book themselves into open times. ' + esc(schedLabel(offs[0])) + '.' : 'Bookings for every office at ' + esc(baseName(me.base_id)) + '. Members book themselves into open times, so there is nothing to approve.'}</div>`;
  if (reqs.length) {
    h += '<div class="dlbl" style="margin-top:6px">Waiting for a time</div>' + reqs.map(a => {
      const m = P(a.member_id) || { name: 'Member' }, t = TK(a.task_id), off = O(a.office_id) || { name: 'Office' }, days = O(a.office_id) ? openDays(off, 10) : [];
      const choices = days.flatMap(d => d.times.slice(0, 16).map(tm => [d.day + '|' + tm, DOW_SHORT[parseISO(d.day).getDay()] + ' ' + fmtShort(d.day) + ', ' + hhmm(tm)]));
      const act = canManageOffice(a.office_id) ? `${choices.length ? `<label class="fl" for="as-${a.id}" style="margin-top:10px">Book them in at</label><select class="fs" id="as-${a.id}">${choices.map(c => opt(c[0], c[1])).join('')}</select>` : ''}<div class="brow"><button class="sbtn" style="flex:1" onclick="answerAppt('${a.id}',true)">Book it</button><button class="ibtn dg" onclick="answerAppt('${a.id}',false)">Decline</button></div>` : '';
      return `<div class="card"><div class="row">${avatar(m)}<div style="flex:1"><div class="tn">${esc(m.name)}</div><div class="ts">${esc(t ? t.name : '')} · asked ${esc(when(a.created_at))}</div></div>${own ? '' : pill('pl', off.name)}</div>${act}</div>`;
    }).join('');
  }
  h += '<div class="dlbl" style="margin-top:6px">Upcoming appointments</div>';
  h += booked.length ? '<div class="card">' + booked.slice(0, 60).map((x, i) => {
    const m = P(x.a.member_id) || { name: 'Member' }, t = TK(x.a.task_id), off = O(x.a.office_id) || { name: '' };
    return `<div class="frow"${i === 0 ? ' style="border-top:none;padding-top:0"' : ''}>${avatar(m)}<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600">${esc(m.name)}</div><div class="ts">${esc(slotLabel(x.s))}${x.s.slot_day === today() ? ' (today)' : ''} · ${esc(t ? t.name : '')}${own ? '' : ' · ' + esc(off.name)}</div>${uploadsChips(x.a.member_id, x.a.task_id)}</div>${canManageOffice(x.a.office_id) ? `<button class="ibtn dg" onclick="officeCancel('${x.a.id}')">Cancel</button>` : ''}</div>`;
  }).join('') + '</div>' : emp('ti-calendar-check', 'Nothing booked yet.');
  box.innerHTML = h;
}
async function answerAppt(id, yes) {
  const a = S.appt_requests.find(x => x.id === id), off = O(a.office_id) || { name: 'The office' }, t = TK(a.task_id);
  if (!yes) {
    if (await upd('appt_requests', { id }, { status: 'declined' })) {
      await notify(a.member_id, 'system', off.name + ' could not book you in', 'Book another time from the task, or call DSN ' + (off.phone || 'the office') + '.');
      toast('Declined. The member has been told.'); drawRole();
    }
    return;
  }
  const pick = val('as-' + id);
  if (!pick) { toast('No free times to offer. Change the office hours in the Office tab.', 'err'); return; }
  const [day, time] = pick.split('|'), slot = { id: DB.newId(), office_id: a.office_id, slot_day: day, slot_time: time, member_id: a.member_id, blocked: false };
  try { await DB.insert('slots', [slot]); } catch (e) { toast(bookErr(e), 'err'); await reload(); drawRole(); return; }
  S.slots.push(slot);
  if (!(await upd('appt_requests', { id }, { status: 'confirmed', slot_id: slot.id }))) return;
  await notify(a.member_id, 'system', 'Appointment booked: ' + off.name, slotLabel(slot) + ' at ' + (off.building || 'the office') + '.');
  toast('Booked. The member has been notified.'); drawRole();
}
async function officeCancel(apptId) {
  const a = S.appt_requests.find(x => x.id === apptId), slot = S.slots.find(x => x.id === a.slot_id), off = O(a.office_id) || { name: 'The office' };
  if (!window.confirm('Cancel this appointment? The member is told to book another time.')) return;
  if (!(await upd('appt_requests', { id: apptId }, { status: 'declined' }))) return;
  if (slot) await del('slots', { id: slot.id });
  await notify(a.member_id, 'system', off.name + ' cancelled your appointment', (slot ? slotLabel(slot) + ' is cancelled. ' : '') + 'Book another time from the task.');
  toast('Cancelled. The member has been told.'); drawRole();
}
function drawHistory(cid) {
  const off = myOffice(), box = el(cid);
  if (!off) { box.innerHTML = noOffice(); return; }
  const ids = new Set(S.tasks.filter(t => t.office_id === off.id).map(t => t.id));
  const rows = S.task_progress.filter(r => ids.has(r.task_id) && isFinal(r.status)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 40);
  if (!rows.length) { box.innerHTML = emp('ti-history', 'No sign-offs yet.'); return; }
  box.innerHTML = '<div class="card">' + rows.map((r, i) => { const m = P(r.member_id) || { name: 'Member' }, t = TK(r.task_id); return `<div class="frow"${i === 0 ? ' style="border-top:none;padding-top:0"' : ''}>${avatar(m)}<div style="flex:1"><div style="font-size:12.5px;font-weight:600">${esc(m.name)}</div><div class="ts">${esc(t ? t.name : '')} · ${esc(r.signed_name || '')}</div></div>${r.status === 'na' ? pill('pgy', 'Not needed') : pill('pn', 'Signed')}</div>`; }).join('') + '</div>';
}
function officeTips() { const off = myOffice(); return S.tips.filter(t => t.tier === 'office' && t.base_id === me.base_id && (!off || t.label === off.name)); }
function drawWorker() {
  const off = myOffice();
  el('wk-name').textContent = me.name;
  el('wk-sub').textContent = (off ? off.name : 'No office linked') + ' · sign-off queue';
  drawQueue('wqueue'); drawAppts('wreq', 'wbadge'); drawHistory('whist');
  drawTipList('wtips', officeTips(), { tier: 'office', btn: 'bgreen', canRemove: true });
}
function drawLead() {
  const off = myOffice();
  el('ld-name').textContent = 'Office lead · ' + (off ? off.name : 'no office');
  el('ld-sub').textContent = me.name;
  drawSched(); drawAppts('lreq', 'lbadge'); drawQueue('lqueue'); drawOfficeForm();
  drawTipList('ltips', officeTips(), { tier: 'office', btn: 'blead', canRemove: true });
}
function drawSched() {
  const off = myOffice(), box = el('lsched');
  if (!off) { box.innerHTML = noOffice(); return; }
  const ws = weekStart(ui.wk), now = new Date(), nowHm = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  let days = '';
  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i), times = timesFor(off, day);
    if (!times.length) continue;
    const past = day < today(), booked = times.filter(tm => { const r = slotAt(off.id, day, tm); return r && r.member_id; }).length;
    const blockedAll = times.every(tm => { const r = slotAt(off.id, day, tm); return r && (r.blocked || r.member_id); });
    const cells = times.map(tm => {
      const r = slotAt(off.id, day, tm), gone = past || (day === today() && tm <= nowHm);
      if (r && r.member_id) { const m = P(r.member_id); return `<div class="slot bk">${hhmm(tm)}<span class="sm">${esc(m ? m.name.split(',')[0].replace(/^\S+\s/, '') : 'Booked')}</span></div>`; }
      if (gone) return `<div class="slot blk" style="opacity:.5">${hhmm(tm)}</div>`;
      return `<button class="slot${r && r.blocked ? ' blk' : ''}" aria-pressed="${!!(r && r.blocked)}" aria-label="${hhmm(tm)} ${r && r.blocked ? 'blocked, tap to reopen' : 'open, tap to block'}" onclick="toggleTime('${day}','${tm}')">${hhmm(tm)}</button>`;
    }).join('');
    days += `<div class="card"><div class="row" style="justify-content:space-between"><div><div class="tn">${DOW_SHORT[parseISO(day).getDay()]} ${esc(fmtShort(day))}${day === today() ? ' (today)' : ''}</div><div class="ts">${booked} booked</div></div>${past ? '' : `<button class="ibtn" onclick="blockDay('${day}',${!blockedAll})">${blockedAll ? 'Reopen day' : 'Block whole day'}</button>`}</div><div class="slotg" style="grid-template-columns:repeat(4,1fr)">${cells}</div></div>`;
  }
  box.innerHTML = `<div class="card soft"><div class="ts" style="margin:0;line-height:1.55">Members book themselves into open times. ${esc(schedLabel(off))}. Tap a time to block it, for example for lunch or training, and tap again to reopen it. Change hours in the Office tab.</div></div>` +
    `<div class="row" style="justify-content:space-between"><button class="ibtn" aria-label="Previous week" onclick="wk(-1)"${ui.wk <= 0 ? ' disabled' : ''}><i class="ti ti-chevron-left" aria-hidden="true"></i></button><span style="font-size:12.5px;font-weight:600">Week of ${esc(fmtShort(ws))}</span><button class="ibtn" aria-label="Next week" onclick="wk(1)"${ui.wk >= 12 ? ' disabled' : ''}><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div>` +
    (days || emp('ti-calendar', 'The office is closed all of this week.')) + '<div class="legend">Blue: booked · Crossed out: blocked or past</div>';
}
function wk(d) { ui.wk = Math.max(0, Math.min(12, ui.wk + d)); drawSched(); }
async function toggleTime(day, time) {
  const off = myOffice(), r = slotAt(off.id, day, time);
  if (r && r.member_id) return;
  const ok = r ? await del('slots', { id: r.id }) : await ins('slots', { office_id: off.id, slot_day: day, slot_time: time, member_id: null, blocked: true });
  if (ok) drawSched();
}
async function blockDay(day, block) {
  const off = myOffice();
  if (block) {
    const free = freeTimes(off, day);
    for (const tm of free) { const r = slotAt(off.id, day, tm); if (r) await upd('slots', { id: r.id }, { blocked: true }); }
    const rows = free.filter(tm => !slotAt(off.id, day, tm)).map(tm => ({ office_id: off.id, slot_day: day, slot_time: tm, member_id: null, blocked: true }));
    if (!rows.length || await ins('slots', rows)) toast(fmtShort(day) + ' blocked. Existing bookings stay.');
  } else {
    for (const r of S.slots.filter(x => x.office_id === off.id && x.slot_day === day && x.blocked && !x.member_id)) await del('slots', { id: r.id });
    toast(fmtShort(day) + ' reopened.');
  }
  drawSched();
}
function drawOfficeForm() {
  const off = myOffice(), box = el('loffice');
  if (!off) { box.innerHTML = noOffice(); return; }
  const st = ['Open', 'At lunch', 'Long wait', 'Closed today'], sc = officeSched(off);
  const canSched = DB.mode === 'demo' || 'open_days' in off;
  const sched = canSched ? `<div class="card"><div class="tn">Appointment hours</div><div class="ts" style="margin-bottom:10px">Members can only book inside these hours.</div><div class="chips" style="margin-bottom:11px">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="cbx" style="margin:0 6px 0 0"><input type="checkbox" id="od-${d}"${sc.days.includes(String(d)) ? ' checked' : ''}> ${DOW_SHORT[d]}</label>`).join('')}</div><div class="g2"><div><label class="fl" for="of-open">Opens</label><input class="fi" type="time" id="of-open" value="${esc(sc.open)}"></div><div><label class="fl" for="of-close">Closes</label><input class="fi" type="time" id="of-close" value="${esc(sc.close)}"></div></div><label class="fl" for="of-len">Appointment length</label><select class="fs" id="of-len">${[15, 20, 30, 45, 60].map(n => opt(n, n + ' minutes', n === sc.len)).join('')}</select><button class="pbtn blead" onclick="saveSchedule()">Save hours</button></div>`
    : `<div class="card soft"><div class="ts" style="margin:0">Appointments run ${esc(schedLabel(off))}. To change them, your admin runs supabase/appointments.sql (SETUP.md step 2c).</div></div>`;
  box.innerHTML = `<div class="card"><label class="fl" for="of-n">Office name</label><input class="fi" id="of-n" value="${esc(off.name)}"><label class="fl" for="of-b">Building</label><input class="fi" id="of-b" value="${esc(off.building || '')}"><label class="fl" for="of-p">Phone (DSN)</label><input class="fi" id="of-p" value="${esc(off.phone || '')}"><label class="fl" for="of-h">Hours shown to members</label><input class="fi" id="of-h" value="${esc(off.hours || '')}"><label class="fl" for="of-s">Current status</label><select class="fs" id="of-s">${st.map(s => opt(s, s, off.status === s)).join('')}</select><div class="fhint">Members see your hours, phone and any status other than Open on every task your office signs off.</div><button class="pbtn blead" onclick="saveOffice()">Save changes</button></div>` + sched + officeFormsCards(off);
}
async function saveSchedule() {
  const off = myOffice(), days = [0, 1, 2, 3, 4, 5, 6].filter(d => checked('od-' + d)).join(''), open = val('of-open'), close = val('of-close'), len = parseInt(val('of-len'), 10);
  if (!days) { toast('Pick at least one day.', 'err'); return; }
  if (!open || !close || toMin(close) - toMin(open) < len) { toast('Closing time must be after opening time.', 'err'); return; }
  if (await upd('offices', { id: off.id }, { open_days: days, open_time: open, close_time: close, slot_minutes: len })) { toast('Saved. Members now see ' + schedLabel(O(off.id)) + '.'); drawLead(); }
}
function officeFormsCards(off) {
  const tasks = S.tasks.filter(t => t.office_id === off.id).sort((a, b) => a.dir.localeCompare(b.dir) || (a.sort - b.sort));
  if (!tasks.length) return `<div class="card soft"><div class="ts" style="margin:0">No tasks on the master list are signed off by ${esc(off.name)} yet, so there is nowhere to attach forms. Ask your MPF to link tasks to this office.</div></div>`;
  return `<div class="slbl" style="padding-left:0">Forms for your tasks</div>` + tasks.map(t => `<div class="card"><div class="tn">${esc(t.name)}</div><div class="ts">${t.dir === 'out' ? 'Out-processing' : 'In-processing'}</div>${formsManager(t)}</div>`).join('');
}
async function saveOffice() {
  const off = myOffice(), name = val('of-n').trim();
  if (!name) { toast('The office needs a name.', 'err'); return; }
  const patch = { name, building: val('of-b').trim(), phone: val('of-p').trim(), hours: val('of-h').trim(), status: val('of-s') };
  if (await upd('offices', { id: off.id }, patch)) { toast('Saved. Member checklists show the new details.'); drawLead(); }
}

// ---------------------------------------------------------------------
// Base counselor
// ---------------------------------------------------------------------
function caseload() { return members().filter(m => m.base_id === me.base_id && m.dir !== 'in' && m.id !== me.id).sort((a, b) => (riskRank[risk(a)] - riskRank[risk(b)]) || String(a.depart).localeCompare(String(b.depart))); }
function drawCounsel() {
  el('cn-name').textContent = 'Counselor · ' + me.name;
  el('cn-sub').textContent = baseName(me.base_id) + ' out-processing caseload';
  const list = caseload();
  el('clist').innerHTML = list.length ? list.map(m => { const s = stats(m, 'out'), r = RISK[risk(m)]; return `<button class="rolecard" onclick="openCase('${m.id}')">${avatar(m)}<span style="flex:1"><span class="tn" style="display:block">${esc(m.name)}</span><span class="ts" style="display:block">Departs ${esc(fmt(m.depart))} · ${s.pct}% complete${s.over ? ' · ' + s.over + ' overdue' : ''}${s.sub ? ' · ' + s.sub + ' to confirm' : ''}</span></span>${pill(r[0], r[1])}</button>`; }).join('') : emp('ti-users', 'Nobody is out-processing at ' + baseName(me.base_id) + ' right now.');
  if (!list.find(m => m.id === ui.cso)) ui.cso = list[0] ? list[0].id : null;
  const m = ui.cso ? P(ui.cso) : null;
  if (!m) { el('cso').innerHTML = emp('ti-clipboard-check', 'No members to sign off.'); }
  else {
    const open = tasksFor(m, 'out').map(t => ({ t, s: stateOf(m, t) })).filter(x => !isFinal(x.s)).sort((a, b) => (b.s === 'submitted') - (a.s === 'submitted'));
    el('cso').innerHTML = `<label class="fl" for="cso-pick">Member</label><select class="fs" id="cso-pick" onchange="ui.cso=this.value;drawCounsel()">${list.map(x => opt(x.id, x.name, x.id === m.id)).join('')}</select>` +
      (open.length ? '<div class="card">' + open.map((x, i) => { const off = x.t.office_id ? O(x.t.office_id) : null; return `<div class="frow"${i === 0 ? ' style="border-top:none;padding-top:0"' : ''}><div style="flex:1"><div style="font-size:12.5px;font-weight:600">${esc(x.t.name)}</div><div class="ts">${x.s === 'submitted' ? 'Member says their part is done' : 'Due ' + esc(fmt(dueOf(m, x.t)))}${off ? ' · usually ' + esc(off.name) : ''}</div>${uploadsChips(m.id, x.t.id)}</div>${x.s === 'submitted' ? pill('pa', 'Ready') : x.s === 'overdue' ? pill('pr', 'Overdue') : ''}</div><div class="brow" style="justify-content:flex-end;padding-bottom:4px"><button class="ibtn" onclick="signOff('${m.id}','${x.t.id}','na')">Not needed</button><button class="sbtn" onclick="signOff('${m.id}','${x.t.id}','done')">Sign off</button></div>`; }).join('') + '</div>' : emp('ti-circle-check', m.name + ' has nothing left to sign.'));
  }
  drawAppts('cappt', 'cbadge');
  drawTipList('ctips', S.tips.filter(t => t.tier === 'counsel' && t.base_id === me.base_id), { tier: 'counsel', btn: 'bcoun', canRemove: true });
}
function openCase(id) { ui.cso = id; drawCounsel(); tab('so'); }

// ---------------------------------------------------------------------
// Base MPF super admin
// ---------------------------------------------------------------------
function drawMpf() {
  el('mp-name').textContent = me.name;
  el('mp-sub').textContent = baseName(me.base_id) + ' MPF';
  drawProfiles(); drawMaster(); drawRules(); drawAppts('bappt', 'abadge'); drawInbound(); drawUsers();
}
function shareButton(label) {
  return `<a class="ibtn" href="share.html" style="display:block;text-align:center;text-decoration:none;padding:9px"><i class="ti ti-share" aria-hidden="true"></i> ${esc(label)}</a>`;
}
function drawProfiles() {
  const pend = S.profiles.filter(p => p.status === 'pending' && p.base_id === me.base_id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const bg = el('bbadge'); bg.textContent = pend.length; bg.classList.toggle('on', pend.length > 0);
  const invite = shareButton('Invite members: text, email or QR code');
  const setup = setupCard();
  if (!pend.length) { el('bprof').innerHTML = setup + emp('ti-user-check', 'No profiles waiting') + invite; return; }
  const all = pend.length > 1 ? `<button class="pbtn bgreen" onclick="approveAll()">Approve all ${pend.length}</button>` : '';
  el('bprof').innerHTML = setup + invite + all + pend.map(a => `<div class="card"><div class="row">${avatar(a)}<div style="flex:1"><div class="tn">${esc(a.name)}</div><div class="ts">${esc(a.unit || 'No unit')} · ${esc(a.email)}</div></div>${pill('pa', 'Pending')}</div><div class="dmeta" style="margin-top:11px">${profileSummary(a)}</div>` +
    (ui.returnFor === a.id ? `<label class="fl" for="rt-${a.id}">What needs fixing</label><textarea class="fi" id="rt-${a.id}" placeholder="Your departure date does not match your orders"></textarea><div class="brow"><button class="pbtn bgreen" onclick="returnProfile('${a.id}')">Send back with note</button><button class="ibtn" onclick="ui.returnFor=null;drawProfiles()">Cancel</button></div>`
      : `<div class="brow"><button class="sbtn" style="flex:1" onclick="approveProfile('${a.id}')">Approve and unlock</button><button class="ibtn dg" onclick="ui.returnFor='${a.id}';drawProfiles()">Send back</button></div>`) + '</div>').join('');
}
// A short checklist for getting a base going. It ticks itself off.
function setupCard() {
  const base = me.base_id, b = B(base), offs = S.offices.filter(o => o.base_id === base);
  const staffed = offs.filter(staffedOffice).length;
  const others = S.profiles.filter(p => p.base_id === base && p.id !== me.id && p.roles.includes('member')).length;
  const items = [
    [S.tasks.some(t => t.base_id === base), 'Checklist and offices loaded', 'Tasks, ' + offs.length + ' offices, reminders and tips. Edit anything in Master list.', `<button class="ibtn" onclick="tab('tasks')">Master list</button>`],
    [!!(b && b.live), 'Base open for sign-ups', hasRole('global') ? 'Lets members pick ' + baseName(base) + ' when they sign up.' : 'A global admin switches this on.', hasRole('global') ? `<button class="sbtn" onclick="openMyBase()">Open it</button>` : ''],
    [true, 'Appointments ready', 'Every office takes bookings ' + (offs[0] ? schedLabel(offs[0]) : 'Mon–Fri, 0800–1600') + '. Members book themselves.', `<button class="ibtn" onclick="tab('appt')">Appts</button>`],
    [offs.length > 0 && staffed === offs.length, 'Offices staffed (' + staffed + ' of ' + offs.length + ')', 'Optional. Until an office has a worker, you and the counselor handle its sign-offs and appointments.', `<button class="ibtn" onclick="tab('users')">Users</button>`],
    [S.profiles.some(p => p.base_id === base && p.status === 'active' && p.roles.includes('sponsor')), 'At least one sponsor', 'Tick Sponsor on someone in Users, then pick them as a member’s sponsor.', `<button class="ibtn" onclick="tab('users')">Users</button>`],
    [others > 0, 'Members invited', 'Text the link or show the QR code at a briefing.', `<a class="ibtn" href="share.html" style="text-decoration:none">Share</a>`]
  ];
  const done = items.filter(i => i[0]).length;
  if (done === items.length && ui.setupHidden !== false) return '';
  if (ui.setupHidden) return `<button class="lbtn" onclick="ui.setupHidden=false;drawProfiles()">Show getting started (${done} of ${items.length} done)</button>`;
  return `<div class="card"><div class="row" style="margin-bottom:6px"><div style="flex:1"><div class="tn">Getting started</div><div class="ts">${done} of ${items.length} done</div></div><button class="lbtn" onclick="ui.setupHidden=true;drawProfiles()">Hide</button></div>` +
    items.map(i => `<div class="rule"><span class="chk${i[0] ? ' ck' : ''}" aria-hidden="true">${i[0] ? '<i class="ti ti-check"></i>' : ''}</span><div style="flex:1"><div class="rt">${esc(i[1])}<span class="sr">${i[0] ? ', done' : ', not done'}</span></div><div class="ts">${esc(i[2])}</div></div>${i[0] ? '' : i[3]}</div>`).join('') + '</div>';
}
async function openMyBase() { if (await upd('bases', { id: me.base_id }, { live: true })) { toast(baseName(me.base_id) + ' is open for sign-ups.'); drawRole(); } }
async function approveAll() {
  const pend = S.profiles.filter(p => p.status === 'pending' && p.base_id === me.base_id);
  if (!window.confirm('Approve all ' + pend.length + ' profiles? Check the details first if you are not sure.')) return;
  for (const p of pend) await approveProfile(p.id, true);
  toast(pend.length + ' profiles approved. Their checklists are live.'); drawMpf();
}
async function approveProfile(id, quiet) {
  const a = P(id);
  if (!(await upd('profiles', { id }, { status: 'active', return_note: null }))) return;
  const first = tasksFor(a, a.dir === 'in' ? 'in' : 'out')[0];
  await notify(id, 'system', 'Your profile is approved', 'Your checklist at ' + baseName(a.base_id) + ' is live.' + (first ? ' Start with ' + first.name + '.' : ''), 'approved');
  if (!quiet) { toast(a.name + ' approved. Their checklist is live.'); drawMpf(); }
}
async function returnProfile(id) {
  const note = val('rt-' + id).trim();
  if (!note) { toast('Say what needs fixing so they know what to change.', 'err'); return; }
  if (await upd('profiles', { id }, { status: 'returned', return_note: note })) { ui.returnFor = null; toast('Sent back with your note.'); drawMpf(); }
}
function setMDir(d) { ui.mdir = d; ui.edit = null; ['out', 'in'].forEach(x => { const b = el('bo-' + x); b.classList.toggle('on', x === d); b.setAttribute('aria-pressed', x === d ? 'true' : 'false'); }); drawMaster(); }
function drawMaster() {
  const base = me.base_id;
  const all = S.tasks.filter(t => t.base_id === base);
  const list = all.filter(t => t.dir === ui.mdir).sort((a, b) => (ui.mdir === 'out' ? b.offset_days - a.offset_days : a.offset_days - b.offset_days) || (a.sort - b.sort));
  let h = '';
  if (!all.length) h += `<div class="card soft"><div class="tn">Start from a ready-made checklist</div><div class="ts" style="margin-bottom:10px;line-height:1.55">Loads about 55 out-processing and 9 in-processing tasks, 8 offices, reminder rules and starter tips, based on the RAF Mildenhall checklist. Edit the details for ${esc(baseName(base))} afterwards.</div><button class="pbtn bgreen" id="st-go" onclick="loadStarter()">Load starter checklist</button></div>`;
  h += list.map(t => {
    if (ui.edit === t.id) return taskForm(t);
    const off = t.office_id ? O(t.office_id) : null;
    let flags = '';
    if (t.tag) flags += pill('pgy', 'Only if ' + (TAG_LABEL[t.tag] || t.tag));
    if (t.carry) flags += pill('pp', 'Carries over');
    if (t.triggers_handoff) flags += pill('pi', 'Triggers handoff');
    if (off) flags += pill('pl', 'Signed by ' + off.name);
    let meta = dmr('ti-map-pin', t.loc || '');
    if (t.hours) meta += dmr('ti-clock', t.hours);
    if (t.phone) meta += dmr('ti-phone', 'DSN ' + t.phone);
    const due = ui.mdir === 'out' ? (t.offset_days === 0 ? 'Departure day' : t.offset_days + 'd before') : (t.offset_days === 0 ? 'Arrival day' : t.offset_days + 'd after');
    return `<div class="card"><div class="row" style="margin-bottom:9px"><div style="flex:1"><div class="tn">${esc(t.name)}</div><div class="ts">${esc(t.office_name || '')}</div></div>${pill('pm', due)}</div>${flags ? `<div class="chips" style="margin-bottom:9px">${flags}</div>` : ''}<div class="dmeta">${meta}</div><div style="font-size:12.5px;color:var(--t2);line-height:1.6">${esc(t.descr)}</div>${formsManager(t)}<div class="brow" style="margin-top:11px"><button class="ibtn" onclick="ui.edit='${t.id}';drawMaster()">Edit</button><button class="ibtn dg" onclick="delMaster('${t.id}')">Remove</button></div></div>`;
  }).join('');
  if (all.length && !list.length) h += emp('ti-list', 'No ' + ui.mdir + '-processing tasks yet.');
  h += ui.edit === 'new' ? taskForm(null) : `<button class="pbtn bgreen" onclick="ui.edit='new';drawMaster()">Add task to master list</button>`;
  el('blist').innerHTML = h;
}
function taskForm(t) {
  const offs = S.offices.filter(o => o.base_id === me.base_id).sort(sortByName), x = t || {};
  return `<div class="af"><h4>${t ? 'Edit task' : 'New task'}</h4>
<label class="fl" for="tf-n">Task name</label><input class="fi" id="tf-n" value="${esc(x.name || '')}" placeholder="Clear base library">
<label class="fl" for="tf-d">Description</label><textarea class="fi" id="tf-d" placeholder="What this task is and what the member needs to do or bring">${esc(x.descr || '')}</textarea>
<label class="fl" for="tf-o">Office shown to members</label><input class="fi" id="tf-o" value="${esc(x.office_name || '')}" placeholder="Base Library">
<label class="fl" for="tf-oid">Who signs it off</label><select class="fs" id="tf-oid">${opt('', 'Counselor or CSS', !x.office_id)}${offs.map(o => opt(o.id, o.name + ' (in PCS Path)', x.office_id === o.id)).join('')}</select>
<div class="g2"><div><label class="fl" for="tf-loc">Location</label><input class="fi" id="tf-loc" value="${esc(x.loc || '')}" placeholder="Bldg 425"></div><div><label class="fl" for="tf-p">Phone</label><input class="fi" id="tf-p" value="${esc(x.phone || '')}" placeholder="238-2352"></div></div>
<label class="fl" for="tf-h">Hours</label><input class="fi" id="tf-h" value="${esc(x.hours || '')}" placeholder="1000-1700 Monday to Saturday">
<label class="fl" for="tf-off">${ui.mdir === 'out' ? 'Due, days before departure' : 'Due, days after RNLTD'}</label><input class="fi" id="tf-off" type="number" min="0" max="365" value="${x.offset_days != null ? x.offset_days : 30}">
<label class="fl" for="tf-tag">Show to</label><select class="fs" id="tf-tag">${opt('', 'Everyone', !x.tag)}${FLAG_OPTS.map(f => opt(f[0], 'Only: ' + f[1], x.tag === f[0])).join('')}</select>
<label class="cbx"><input type="checkbox" id="tf-carry"${x.carry ? ' checked' : ''}> Records carry over to the next base</label>
${ui.mdir === 'out' ? `<label class="cbx"><input type="checkbox" id="tf-th"${x.triggers_handoff ? ' checked' : ''}> Signing this releases the member's record to the gaining base</label>` : ''}
<div class="brow"><button class="pbtn bgreen" onclick="saveTask('${t ? t.id : ''}')">${t ? 'Save changes' : 'Save to master list'}</button><button class="ibtn" onclick="ui.edit=null;drawMaster()">Cancel</button></div></div>`;
}
async function saveTask(id) {
  const name = val('tf-n').trim(), off = parseInt(val('tf-off'), 10);
  if (!name) { toast('Give the task a name.', 'err'); return; }
  if (isNaN(off) || off < 0 || off > 365) { toast('Due days must be between 0 and 365.', 'err'); return; }
  const row = { name, descr: val('tf-d').trim() || 'No description added yet.', office_name: val('tf-o').trim() || null, office_id: val('tf-oid') || null, loc: val('tf-loc').trim() || null, hours: val('tf-h').trim() || null, phone: val('tf-p').trim() || null, offset_days: off, tag: val('tf-tag') || null, carry: checked('tf-carry'), triggers_handoff: ui.mdir === 'out' && checked('tf-th') };
  let ok;
  if (id) ok = await upd('tasks', { id }, row);
  else ok = await ins('tasks', Object.assign(row, { base_id: me.base_id, dir: ui.mdir, sort: S.tasks.reduce((m, t) => Math.max(m, t.sort || 0), 0) + 1 }));
  if (ok) { ui.edit = null; toast(id ? 'Saved. Members see the change now.' : 'Added. Every member at this base now sees this task.'); drawMaster(); }
}
async function delMaster(id) {
  const t = TK(id);
  if (!window.confirm('Remove "' + t.name + '" from the master list? It disappears from every member checklist, along with its sign-offs.')) return;
  if (await del('tasks', { id })) { toast('Task removed from the master list.'); drawMaster(); }
}
async function loadStarter() {
  const base = me.base_id, b = B(base);
  if (S.tasks.some(t => t.base_id === base)) { toast('This base already has a checklist.'); return; }
  busy('st-go', true, 'Loading');
  const existing = {}; S.offices.filter(o => o.base_id === base).forEach(o => { existing[o.name] = o.id; });
  const st = window.PCS_SEED.starter(base, { country: b && b.country, existingOffices: existing, author: me.id });
  const haveRules = S.reminder_rules.some(r => r.base_id === base);
  const ok = (!st.offices.length || await ins('offices', st.offices)) && await ins('tasks', st.tasks) &&
    (haveRules || await ins('reminder_rules', st.rules)) && await ins('tips', st.tips);
  if (ok) toast('Starter checklist loaded. Review each task and edit the details for ' + baseName(base) + '.');
  drawMpf();
}
function drawRules() {
  const rules = S.reminder_rules.filter(r => r.base_id === me.base_id);
  el('brules').innerHTML = rules.length ? '<div class="card">' + rules.map(r => `<div class="rule"><div style="flex:1"><div class="rt">${esc(r.title)}</div><div class="ts">${esc(r.body)}</div></div>${toggle(`onchange="toggleRule('${r.id}',this.checked)"`, r.enabled, r.title)}</div>`).join('') + '</div>' : emp('ti-bell', 'Reminder rules arrive with the starter checklist.');
}
async function toggleRule(id, v) { const r = S.reminder_rules.find(x => x.id === id); if (await upd('reminder_rules', { id }, { enabled: v })) toast(r.title + (v ? ' is on.' : ' is off.')); }
function drawInbound() {
  const list = members().filter(m => m.gaining_base === me.base_id && m.dir !== 'in').sort((a, b) => String(a.rnltd).localeCompare(String(b.rnltd)));
  const sponsors = S.profiles.filter(p => p.base_id === me.base_id && p.status === 'active' && p.roles.includes('sponsor')).sort(sortByName);
  if (!list.length) { el('binbound').innerHTML = emp('ti-plane-arrival', 'Nobody is inbound to ' + baseName(me.base_id) + ' yet.'); return; }
  el('binbound').innerHTML = list.map(m => {
    const arrived = m.rnltd && m.rnltd <= today();
    const st = arrived ? pill('pn', 'Arrived') : m.handoff === 'complete' ? pill('pp', 'En route') : pill('pa', 'Out-processing');
    const sp = m.sponsor_id ? P(m.sponsor_id) : null, si = stats(m, 'in');
    const spHtml = sp ? dmr('ti-friends', 'Sponsor ' + sp.name) : sponsors.length ? `<label class="fl" for="sa-${m.id}" style="margin-top:10px">Assign a sponsor</label><div class="brow"><select class="fs" id="sa-${m.id}" style="flex:1;margin:0">${sponsors.map(s => opt(s.id, s.name)).join('')}</select><button class="sbtn" onclick="assignSponsor('${m.id}')">Assign</button></div>` : `<div class="ts" style="margin-top:8px">No sponsors at this base yet. Give someone the Sponsor role in Users.</div>`;
    return `<div class="card"><div class="row">${avatar(m)}<div style="flex:1"><div class="tn">${esc(m.name)}</div><div class="ts">From ${esc(baseName(m.base_id))} · RNLTD ${esc(fmt(m.rnltd))}</div></div>${st}</div><div class="ts" style="margin-top:8px">${m.handoff === 'complete' ? 'In-processing ' + si.pct + '% complete' : 'Record arrives when ' + esc(baseName(m.base_id)) + ' signs their final out'}</div>${spHtml}</div>`;
  }).join('');
}
async function assignSponsor(memberId) {
  const sid = val('sa-' + memberId), m = P(memberId), s = P(sid);
  if (!sid) return;
  if (!(await upd('profiles', { id: memberId }, { sponsor_id: sid }))) return;
  await notifySponsorPair(m, s);
  toast('Sponsor assigned and both of them notified.'); drawMpf();
}
function drawUsers() {
  const base = me.base_id;
  const reqs = S.role_requests.filter(r => r.status === 'pending' && (r.base_id === base || hasRole('global')));
  const ub = el('ubadge'); ub.textContent = reqs.length; ub.classList.toggle('on', reqs.length > 0);
  const offs = S.offices.filter(o => o.base_id === base).sort(sortByName);
  let h = '';
  if (reqs.length) h += '<div class="dlbl" style="margin-top:4px">Role requests</div>' + reqs.map(roleReqCard).join('');
  const users = S.profiles.filter(p => p.base_id === base).sort(sortByName);
  h += '<div class="dlbl" style="margin-top:8px">People</div>';
  h += users.map(p => {
    const pills = ROLE_ORDER.filter(r => p.roles.includes(r)).map(r => pill('pgy', ROLE_META[r].n)).join('');
    const off = p.office_id ? O(p.office_id) : null;
    const st = p.status === 'pending' ? pill('pa', 'Pending') : p.status === 'returned' ? pill('pr', 'Sent back') : '';
    let card = `<div class="card"><div class="row">${avatar(p)}<div style="flex:1"><div class="tn">${esc(p.name)}</div><div class="ts">${esc(p.unit || '')}${off ? ' · ' + esc(off.name) : ''}</div></div>${st}</div><div class="chips" style="margin-top:9px">${pills}</div>`;
    if (ui.roleEdit === p.id) {
      card += '<div class="af" style="margin-top:11px"><h4>Roles</h4>' + ROLE_ORDER.map(r => {
        const lock = (r === 'mpf' || r === 'global') && !hasRole('global');
        return `<label class="cbx"><input type="checkbox" id="re-${r}"${p.roles.includes(r) ? ' checked' : ''}${lock || (p.id === me.id && r === 'mpf') ? ' disabled' : ''}> ${esc(ROLE_META[r].n)}${lock ? ' (global admin only)' : ''}</label>`;
      }).join('') + `<label class="fl" for="re-office">Office, for workers and leads</label><select class="fs" id="re-office">${opt('', 'None', !p.office_id)}${offs.map(o => opt(o.id, o.name, p.office_id === o.id)).join('')}</select>${sponsorPicker(p)}<div class="brow"><button class="pbtn bgreen" onclick="saveRoles('${p.id}')">Save</button><button class="ibtn" onclick="ui.roleEdit=null;drawUsers()">Cancel</button></div></div>`;
    } else if (p.status === 'active') {
      const sp = p.sponsor_id ? P(p.sponsor_id) : null;
      if (p.roles.includes('member')) card += `<div class="ts" style="margin-top:8px"><i class="ti ti-friends" aria-hidden="true"></i> Sponsor: ${esc(sp ? sp.name : 'none assigned')}</div>`;
      card += `<div class="brow" style="margin-top:10px"><button class="ibtn" onclick="ui.roleEdit='${p.id}';drawUsers()">Edit roles, office and sponsor</button></div>`;
    }
    return card + '</div>';
  }).join('');
  el('busers').innerHTML = h;
}
function roleReqCard(r) {
  const needsGlobal = (r.wanted_role === 'mpf' || r.wanted_role === 'global') && !hasRole('global');
  return `<div class="card"><div class="tn">${esc(r.name)}</div><div class="ts">${esc(r.current_roles || '')} → ${esc(ROLE_META[r.wanted_role] ? ROLE_META[r.wanted_role].n : r.wanted_role)}${hasRole('global') && r.base_id ? ' · ' + esc(baseName(r.base_id)) : ''}</div><div style="font-size:12.5px;color:var(--t2);line-height:1.55;margin:8px 0 11px">${esc(r.reason || '')}</div>${needsGlobal ? '<div class="ts">A global admin decides this one.</div>' : `<div class="brow"><button class="sbtn" style="flex:1" onclick="decideRole('${r.id}',true)">Approve</button><button class="ibtn dg" onclick="decideRole('${r.id}',false)">Deny</button></div>`}</div>`;
}
async function decideRole(id, yes) {
  const r = S.role_requests.find(x => x.id === id), p = P(r.user_id), label = ROLE_META[r.wanted_role] ? ROLE_META[r.wanted_role].n : r.wanted_role;
  if (yes) {
    if (!p) { toast('That person is not visible to you.', 'err'); return; }
    const roles = p.roles.includes(r.wanted_role) ? p.roles : p.roles.concat([r.wanted_role]);
    if (!(await upd('profiles', { id: p.id }, { roles }))) return;
  }
  if (!(await upd('role_requests', { id }, { status: yes ? 'approved' : 'denied' }))) return;
  await notify(r.user_id, 'system', yes ? 'You are now ' + label : 'Role request not approved', yes ? 'Sign out and back in, then pick ' + label + ' from your roles.' : 'Your request to become ' + label + ' was not approved. Ask your MPF if you have questions.');
  toast(yes ? r.name + ' approved as ' + label + '.' + ((r.wanted_role === 'worker' || r.wanted_role === 'lead') ? ' Set their office in Users.' : '') : 'Request denied.');
  drawRole();
}
// Sponsors: anyone with the Sponsor role at this base, or at the member's gaining base.
function sponsorCandidates(p) {
  return S.profiles.filter(s => s.id !== p.id && s.status === 'active' && s.roles.includes('sponsor') && (s.base_id === me.base_id || (p.gaining_base && s.base_id === p.gaining_base))).sort(sortByName);
}
function sponsorPicker(p) {
  if (!p.roles.includes('member')) return '';
  const list = sponsorCandidates(p), cur = p.sponsor_id ? P(p.sponsor_id) : null;
  if (cur && !list.includes(cur)) list.unshift(cur);
  if (!list.length) return `<div class="dlbl">Sponsor</div><div class="ts" style="margin-bottom:11px">Nobody has the Sponsor role yet. Tick Sponsor on someone's roles first, then come back here.</div>`;
  return `<label class="fl" for="re-sp">Sponsor${p.gaining_base ? ' (helps them settle in at ' + esc(baseName(p.gaining_base)) + ')' : ''}</label><select class="fs" id="re-sp">${opt('', 'No sponsor', !p.sponsor_id)}${list.map(s => opt(s.id, s.name + (s.base_id !== me.base_id ? ' · ' + baseName(s.base_id) : ''), s.id === p.sponsor_id)).join('')}</select>`;
}
async function saveRoles(id) {
  const p = P(id), roles = ROLE_ORDER.filter(r => checked('re-' + r) || (el('re-' + r) && el('re-' + r).disabled && p.roles.includes(r)));
  if (!roles.length) { toast('Pick at least one role.', 'err'); return; }
  const office = val('re-office') || null;
  const patch = { roles, office_id: office };
  const spEl = el('re-sp'), newSp = spEl ? (spEl.value || null) : p.sponsor_id;
  const spChanged = spEl && newSp !== (p.sponsor_id || null);
  if (spChanged) patch.sponsor_id = newSp;
  if ((roles.includes('worker') || roles.includes('lead')) && !office) toast('Tip: workers and leads need an office to see a queue.');
  if (!(await upd('profiles', { id }, patch))) return;
  if (spChanged && newSp) await notifySponsorPair(p, P(newSp));
  ui.roleEdit = null; toast(spChanged && newSp ? 'Saved. Sponsor assigned and both of them notified.' : 'Saved.'); drawUsers();
}
async function notifySponsorPair(m, s) {
  const where = baseName(m.gaining_base || m.base_id);
  await notifyMany([
    { user_id: m.id, kind: 'system', title: 'Meet your sponsor, ' + s.name.split(',')[0], body: 'Your sponsor helps you get set up at ' + where + '. Say hello in Inbox, Sponsor.', dedupe_key: 'sponsor-' + s.id },
    { user_id: s.id, kind: 'system', title: 'You are sponsoring ' + m.name, body: 'They report to ' + where + (m.rnltd ? ' by ' + fmt(m.rnltd) : '') + '. Your prep list and messages are under Sponsor.', dedupe_key: 'sponsoring-' + m.id }
  ]);
}

// ---------------------------------------------------------------------
// Commander
// ---------------------------------------------------------------------
function metric(label, value, color, sub) { return `<div class="met"><div class="ml">${esc(label)}</div><div class="mv" style="color:${color}">${esc(value)}</div><div class="ms">${esc(sub)}</div></div>`; }
function memberRow(m, right, sub) { return `<div class="card"><div class="row">${avatar(m)}<div style="flex:1"><div class="tn">${esc(m.name)}</div><div class="ts">${esc(sub)}</div></div>${right}</div></div>`; }
function bottlenecks(list) {
  const by = {};
  list.forEach(m => tasksFor(m, 'out').forEach(t => {
    const s = stateOf(m, t); if (s !== 'overdue' && s !== 'submitted') return;
    const k = t.office_name || 'Other'; by[k] = by[k] || { n: k, m: 0, o: 0 };
    if (s === 'overdue') by[k].m++; else by[k].o++;
  }));
  return Object.values(by).sort((a, b) => (b.m + b.o) - (a.m + a.o)).slice(0, 6);
}
function bottleneckHTML(rows) {
  if (!rows.length) return emp('ti-mood-happy', 'Nothing overdue and nothing waiting on an office.');
  const mx = Math.max(...rows.map(o => o.m + o.o));
  return rows.map(o => `<div class="bnr"><div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px"><span>${esc(o.n)}</span><span style="color:var(--t3)">${o.m + o.o} task${o.m + o.o > 1 ? 's' : ''}</span></div><div class="bnt" role="img" aria-label="${o.m} overdue on the member side, ${o.o} waiting on the office"><div class="bbl" style="width:${Math.round(o.m / mx * 100)}%"></div><div class="bred" style="width:${Math.round(o.o / mx * 100)}%"></div></div></div>`).join('') +
    '<div style="font-size:11.5px;color:var(--t2)"><span style="color:#3B8DE0;font-weight:600">Blue</span> overdue, member has not done their part · <span style="color:#E24B4A;font-weight:600">Red</span> member done, waiting on the office</div>';
}
function drawCmd() {
  el('cd-name').textContent = 'Commander · ' + (me.unit || baseName(me.base_id));
  el('cd-sub').textContent = baseName(me.base_id);
  const unit = members().filter(m => m.base_id === me.base_id && m.dir !== 'in' && (!me.unit || m.unit === me.unit) && m.id !== me.id);
  const leaving = unit.filter(m => !m.depart || m.depart >= today());
  const avg = leaving.length ? Math.round(leaving.reduce((s, m) => s + stats(m, 'out').pct, 0) / leaving.length) : 0;
  const clean = leaving.filter(m => stats(m, 'out').over === 0).length;
  const attn = leaving.filter(m => risk(m) !== 'low').sort((a, b) => riskRank[risk(a)] - riskRank[risk(b)]);
  el('dout').innerHTML = `<div class="mg">${metric('Departing', leaving.length, '#1A5FA8', 'members')}${metric('Avg. completion', avg + '%', '#1D9E75', 'of their checklist')}${metric('Nothing overdue', leaving.length ? Math.round(clean / leaving.length * 100) + '%' : '–', !leaving.length || clean / leaving.length >= 0.8 ? '#1D9E75' : clean / leaving.length >= 0.5 ? '#B7791F' : '#A32D2D', clean + ' of ' + leaving.length + ' members')}${metric('Need attention', attn.length, attn.length ? '#A32D2D' : '#1D9E75', 'members')}</div>` +
    `<div class="slbl">Where tasks are stuck</div><div class="pad" style="padding-top:8px">${bottleneckHTML(bottlenecks(leaving))}</div>` +
    `<div class="slbl">Members needing attention</div><div class="pad" style="padding-top:8px">${attn.length ? attn.map(m => { const s = stats(m, 'out'), r = RISK[risk(m)]; return memberRow(m, pill(r[0], r[1]), 'Departs ' + fmt(m.depart) + ' · ' + s.pct + '% · ' + s.over + ' overdue'); }).join('') : emp('ti-circle-check', 'Everyone is on track.')}</div>`;
  const inb = members().filter(m => m.gaining_base === me.base_id && m.dir !== 'in');
  const withSp = inb.filter(m => m.sponsor_id).length;
  const arrived = inb.filter(m => m.rnltd && m.rnltd <= today());
  const ia = inb.filter(m => !m.sponsor_id || (m.rnltd && m.rnltd <= today() && stats(m, 'in').pct < 25));
  el('din').innerHTML = `<div class="mg">${metric('Inbound', inb.length, '#554CBB', 'members')}${metric('Arrived', arrived.length, '#1A5FA8', 'past RNLTD')}${metric('With sponsor', withSp + ' of ' + inb.length, withSp === inb.length ? '#1D9E75' : '#7A4809', 'assigned')}${metric('Need attention', ia.length, ia.length ? '#A32D2D' : '#1D9E75', 'members')}</div>` +
    `<div class="slbl">Inbound members</div><div class="pad" style="padding-top:8px">${inb.length ? inb.map(m => memberRow(m, ia.includes(m) ? pill('pa', !m.sponsor_id ? 'No sponsor' : 'Slow start') : pill('pn', 'On track'), 'From ' + baseName(m.base_id) + ' · RNLTD ' + fmt(m.rnltd) + (m.handoff === 'complete' ? ' · ' + stats(m, 'in').pct + '%' : ''))).join('') : emp('ti-plane-arrival', 'Nobody inbound yet.')}</div>`;
  drawTipList('dtips', S.tips.filter(t => t.tier === 'cmd' && t.base_id === me.base_id), { tier: 'cmd', btn: 'bcoun', canRemove: true });
}

// ---------------------------------------------------------------------
// Global admin
// ---------------------------------------------------------------------
function drawGlobal() {
  el('gl-name').textContent = me.name;
  const live = S.bases.filter(b => b.live), act = members();
  const leaving = act.filter(m => m.dir !== 'in' && (!m.depart || m.depart >= today()));
  const inFlight = act.filter(m => m.dir !== 'in' && m.handoff !== 'complete' && m.gaining_base).length;
  const over = act.reduce((s, m) => s + stats(m, 'out').over, 0);
  const bn = bottlenecks(act);
  el('ghealth').innerHTML = `<div class="mg">${metric('Active bases', live.length, '#1A5FA8', S.bases.length + ' on the platform')}${metric('Handoffs pending', inFlight, '#554CBB', 'base to base')}${metric('Out-processing', leaving.length, '#1D9E75', 'members')}${metric('Overdue tasks', over, over ? '#A32D2D' : '#1D9E75', 'all bases')}</div>` +
    `<div class="slbl">Top bottlenecks AF-wide</div><div class="pad" style="padding-top:8px">${bottleneckHTML(bn)}${bn.length ? `<div class="note">${esc(bn[0].n)} has the most stuck tasks right now. ${bn[0].m >= bn[0].o ? 'Most are on the member side, so a reminder or tip is likely to help.' : 'Most are waiting on the office, so staffing or scheduling is the likely fix.'}</div>` : ''}</div>`;
  el('gbases').innerHTML = S.bases.slice().sort(sortByName).map(b => {
    const mpfs = S.profiles.filter(p => p.base_id === b.id && p.roles.includes('mpf')).map(p => p.name.split(',')[0]);
    const n = act.filter(m => m.base_id === b.id).length;
    return `<div class="card"><div class="row"><div style="flex:1"><div class="tn">${esc(b.name)}</div><div class="ts">${esc(b.country || '')} · MPF ${esc(mpfs.join(', ') || 'not assigned')} · ${n} member${n === 1 ? '' : 's'}</div></div>${pill(b.live ? 'pn' : 'pa', b.live ? 'Active' : 'Not onboarded')}</div><div class="brow" style="margin-top:10px"><button class="ibtn" onclick="toggleBase('${esc(b.id)}')">${b.live ? 'Turn off sign-ups' : 'Activate base'}</button></div></div>`;
  }).join('') + (ui.formOpen.base ? `<div class="af"><h4>Add a base</h4><label class="fl" for="nb-n">Name</label><input class="fi" id="nb-n" placeholder="Spangdahlem AB"><label class="fl" for="nb-c">Country</label><input class="fi" id="nb-c" placeholder="Germany"><div class="brow"><button class="pbtn bglob" onclick="addBase()">Add base</button><button class="ibtn" onclick="toggleForm('base')">Cancel</button></div></div>` : `<button class="pbtn bglob" onclick="toggleForm('base')">Add a base</button>`);
  const reqs = S.role_requests.filter(r => r.status === 'pending' && (r.wanted_role === 'mpf' || r.wanted_role === 'global'));
  const gb = el('gbadge'); gb.textContent = reqs.length; gb.classList.toggle('on', reqs.length > 0);
  el('greq').innerHTML = reqs.length ? reqs.map(roleReqCard).join('') : emp('ti-inbox', 'No pending requests for MPF or global admin rights.');
  drawTipList('gtips', S.tips.filter(t => t.tier === 'global'), { tier: 'global', btn: 'bglob', canRemove: true });
}
async function toggleBase(id) { const b = B(id); if (await upd('bases', { id }, { live: !b.live })) { toast(b.name + (b.live ? ' is active. Members can sign up there.' : ' is off. New members cannot pick it.')); drawGlobal(); } }
async function addBase() {
  const name = val('nb-n').trim(); if (!name) { toast('Give the base a name.', 'err'); return; }
  let id = slug(name.replace(/\b(AB|AFB|RAF|JB|JBSA)\b/g, '')) || slug(name);
  if (B(id)) id = id + '-' + S.bases.length;
  if (await ins('bases', { id, name, country: val('nb-c').trim() || null, live: false })) { ui.formOpen.base = false; toast(name + ' added. Activate it once its MPF is ready.'); drawGlobal(); }
}

boot();
