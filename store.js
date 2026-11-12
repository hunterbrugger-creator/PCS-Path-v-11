// PCS Path data layer.
//
// The app talks to one object, DB, with the same methods in both modes:
//   - Demo mode (no Supabase keys in config.js): a small database kept in
//     this browser's localStorage, pre-filled with the demo people.
//   - Live mode: Supabase (Postgres + sign-in). Writes made while offline
//     are queued and sent when the connection comes back.
(function () {
  'use strict';
  var CFG = window.PCS_CONFIG || {};
  // Adding ?demo to the address opens the demo even when a database is configured.
  var FORCE_DEMO = /[?&]demo\b/.test(location.search);
  var LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey) && !FORCE_DEMO;
  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

  var TABLES = ['bases', 'offices', 'profiles', 'tasks', 'task_progress', 'tips', 'messages',
    'notifications', 'appt_requests', 'slots', 'role_requests', 'reminder_rules', 'sponsor_prep',
    'task_files', 'member_files'];

  function newId() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) { /* insecure context */ } }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function nn(v) { return v === undefined ? null : v; }
  function matches(row, m) { for (var k in m) { if (nn(row[k]) !== nn(m[k])) return false; } return true; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage full or blocked */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------------
  // Demo mode: a local database in this browser
  // ------------------------------------------------------------------
  var LKEY = 'pcspath.demo.v1', LUID = 'pcspath.demo.uid';

  function Local() { this.mode = 'demo'; this.db = null; }
  Local.prototype._load = function () {
    if (this.db) return;
    var raw = lsGet(LKEY);
    if (raw) { try { this.db = JSON.parse(raw); } catch (e) { this.db = null; } }
    if (!this.db || this.db.version !== 2) { this.db = window.PCS_SEED.build(); this._save(); }
  };
  Local.prototype._save = function () { lsSet(LKEY, JSON.stringify(this.db)); };
  Local.prototype.reset = function () { lsDel(LKEY); lsDel(LUID); this.db = null; this._load(); };
  Local.prototype.session = async function () {
    this._load();
    var id = lsGet(LUID);
    return id && this.db.profiles.some(function (p) { return p.id === id; }) ? id : null;
  };
  Local.prototype.signIn = async function (email, pass) {
    this._load();
    var a = this.db.auth.find(function (x) { return x.email === email; });
    if (!a) throw new Error('No account found for that email. Create one to get started.');
    if (a.pass !== pass) throw new Error('Email or password is wrong.');
    lsSet(LUID, a.id);
    return a.id;
  };
  Local.prototype.signUp = async function (email, pass, meta) {
    this._load();
    if (this.db.auth.some(function (x) { return x.email === email; })) throw new Error('An account with that email already exists. Sign in instead.');
    var id = newId();
    this.db.auth.push({ id: id, email: email, pass: pass });
    // Mirrors the database trigger in live mode: new profiles start pending.
    this.db.profiles.push({
      id: id, email: email, name: meta.name || email, unit: meta.unit || null, base_id: meta.base_id || null,
      roles: ['member'], status: 'pending', office_id: null, dir: meta.dir || 'out',
      gaining_base: meta.gaining_base || null, depart: meta.depart || null, rnltd: meta.rnltd || null,
      move_type: meta.move_type || null, flags: meta.flags || {}, docs: {}, sponsor_id: null,
      handoff: 'pending', return_note: null, created_at: new Date().toISOString()
    });
    this._save();
    lsSet(LUID, id);
    return { id: id, needsConfirm: false };
  };
  Local.prototype.signOut = async function () { lsDel(LUID); };
  Local.prototype.resetPassword = async function () { throw new Error('Demo accounts all use the password "demo".'); };
  Local.prototype.updatePassword = async function () { };
  Local.prototype.listBases = async function () {
    this._load();
    return clone(this.db.bases).sort(function (a, b) { return a.name.localeCompare(b.name); });
  };
  Local.prototype.loadAll = async function () {
    this._load();
    var out = {}, db = this.db;
    TABLES.forEach(function (t) { out[t] = clone(db[t] || []); });
    return out;
  };
  // Demo files live in localStorage as data URLs, so keep them small.
  Local.prototype.uploadFile = async function (bucket, path, file) {
    this._load();
    if (file.size > 2.5 * 1024 * 1024) throw new Error('In demo mode files must be under 2.5 MB. The real app allows 10 MB.');
    var data = await new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(new Error('Could not read that file.')); };
      r.readAsDataURL(file);
    });
    this.db.files = this.db.files || {};
    var key = bucket + '/' + path;
    this.db.files[key] = data;
    try { localStorage.setItem(LKEY, JSON.stringify(this.db)); } catch (e) {
      delete this.db.files[key];
      throw new Error('This browser has no room left for demo files. Remove some or reset the demo.');
    }
  };
  Local.prototype.fileUrl = async function (bucket, path) {
    this._load();
    var data = (this.db.files || {})[bucket + '/' + path];
    if (!data) throw new Error('That file is no longer in this browser.');
    var blob = await (await fetch(data)).blob();
    return URL.createObjectURL(blob);
  };
  Local.prototype.removeFile = async function (bucket, path) {
    this._load();
    if (this.db.files) delete this.db.files[bucket + '/' + path];
    this._save();
  };
  Local.prototype.insert = async function (table, rows) {
    this._load();
    var t = this.db[table] = this.db[table] || [];
    rows.forEach(function (r) { t.push(clone(r)); });
    this._save();
  };
  Local.prototype.insertIgnore = async function (table, rows, keys) {
    this._load();
    var t = this.db[table];
    rows.forEach(function (r) {
      var dup = t.some(function (x) { return keys.every(function (k) { return r[k] != null && x[k] === r[k]; }); });
      if (!dup) t.push(clone(r));
    });
    this._save();
  };
  Local.prototype.upsert = async function (table, row, keys) {
    this._load();
    var m = {}; keys.forEach(function (k) { m[k] = row[k]; });
    this.db[table] = this.db[table] || [];
    var ex = this.db[table].find(function (x) { return matches(x, m); });
    if (ex) Object.assign(ex, clone(row)); else this.db[table].push(clone(row));
    this._save();
  };
  Local.prototype.update = async function (table, match, patch) {
    this._load();
    (this.db[table] || []).forEach(function (r) { if (matches(r, match)) Object.assign(r, clone(patch)); });
    this._save();
  };
  Local.prototype.remove = async function (table, match) {
    this._load();
    this.db[table] = (this.db[table] || []).filter(function (r) { return !matches(r, match); });
    // Mirror "on delete cascade" for the one place the app relies on it.
    if (table === 'tasks' && match.id) {
      this.db.task_progress = this.db.task_progress.filter(function (r) { return r.task_id !== match.id; });
      this.db.appt_requests = this.db.appt_requests.filter(function (r) { return r.task_id !== match.id; });
    }
    this._save();
  };
  Local.prototype.cache = function () { };
  Local.prototype.flush = async function () { return 0; };
  Local.prototype.pending = function () { return 0; };

  // ------------------------------------------------------------------
  // Live mode: Supabase
  // ------------------------------------------------------------------
  var CACHE = 'pcspath.cache.', OUTBOX = 'pcspath.outbox';

  function isNetwork(e) {
    var m = String(e && e.message || e);
    return /Failed to fetch|NetworkError|Load failed|network/i.test(m);
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('Could not load the Supabase library. Check your internet connection.')); };
      document.head.appendChild(s);
    });
  }

  function Live() {
    this.mode = 'live';
    this.uid = null;
    this.onRecovery = null;
    var self = this;
    this.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    this.sb.auth.onAuthStateChange(function (ev) {
      if (ev === 'PASSWORD_RECOVERY' && self.onRecovery) self.onRecovery();
    });
  }
  function err(r) { if (r.error) throw new Error(r.error.message); return r.data; }

  Live.prototype.session = async function () {
    var r = await this.sb.auth.getSession();
    this.uid = r.data && r.data.session ? r.data.session.user.id : null;
    return this.uid;
  };
  Live.prototype.signIn = async function (email, password) {
    var r = await this.sb.auth.signInWithPassword({ email: email, password: password });
    if (r.error) {
      var m = r.error.message;
      if (/invalid login/i.test(m)) m = 'Email or password is wrong.';
      if (/not confirmed/i.test(m)) m = 'Confirm your email first. Check your inbox for the link.';
      throw new Error(m);
    }
    this.uid = r.data.user.id;
    return this.uid;
  };
  Live.prototype.signUp = async function (email, password, meta) {
    var r = await this.sb.auth.signUp({
      email: email, password: password,
      options: { data: meta, emailRedirectTo: location.origin + location.pathname }
    });
    if (r.error) throw new Error(r.error.message);
    if (r.data.session) this.uid = r.data.user.id;
    return { id: r.data.user ? r.data.user.id : null, needsConfirm: !r.data.session };
  };
  Live.prototype.signOut = async function () {
    if (this.uid) lsDel(CACHE + this.uid);
    lsDel(OUTBOX);
    await this.sb.auth.signOut();
    this.uid = null;
  };
  Live.prototype.resetPassword = async function (email) {
    err(await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
  };
  Live.prototype.updatePassword = async function (p) { err(await this.sb.auth.updateUser({ password: p })); };
  Live.prototype.listBases = async function () {
    return err(await this.sb.from('bases').select('*').order('name'));
  };
  Live.prototype._fetchAll = async function (table) {
    var all = [], from = 0, size = 1000;
    for (;;) {
      var r = await this.sb.from(table).select('*').range(from, from + size - 1);
      // A table that does not exist yet (an optional SQL step not run) reads as empty.
      if (r.error && (r.error.code === 'PGRST205' || r.error.code === '42P01' || /does not exist|could not find the table/i.test(r.error.message))) return [];
      var rows = err(r);
      all = all.concat(rows);
      if (rows.length < size) return all;
      from += size;
    }
  };
  Live.prototype.loadAll = async function () {
    var key = CACHE + this.uid, self = this;
    var cached = function () { var c = lsGet(key); return c ? JSON.parse(c) : null; };
    if (navigator.onLine === false) { var c0 = cached(); if (c0) return c0; }
    try {
      var res = await Promise.all(TABLES.map(function (t) { return self._fetchAll(t); }));
      var out = {};
      TABLES.forEach(function (t, i) { out[t] = res[i]; });
      lsSet(key, JSON.stringify(out));
      return out;
    } catch (e) {
      var c1 = cached();
      if (c1 && isNetwork(e)) return c1;
      throw e;
    }
  };
  Live.prototype.uploadFile = async function (bucket, path, file) {
    if (navigator.onLine === false) throw new Error('Connect to the internet to upload files.');
    var r = await this.sb.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (r.error) {
      var m = r.error.message;
      if (/bucket not found/i.test(m)) m = 'File storage is not set up yet. Run supabase/files.sql (SETUP.md step 2b).';
      if (/mime type|not supported/i.test(m)) m = 'That type of file is not allowed. Use a PDF, photo or Word document.';
      if (/exceeded|too large|payload/i.test(m)) m = 'That file is too big. The limit is 10 MB.';
      throw new Error(m);
    }
  };
  Live.prototype.fileUrl = async function (bucket, path) {
    if (bucket === 'forms') return this.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    var r = await this.sb.storage.from(bucket).createSignedUrl(path, 600);
    if (r.error) throw new Error(r.error.message);
    return r.data.signedUrl;
  };
  Live.prototype.removeFile = async function (bucket, path) {
    var r = await this.sb.storage.from(bucket).remove([path]);
    if (r.error) throw new Error(r.error.message);
  };
  Live.prototype.cache = function (S) { if (this.uid && S) lsSet(CACHE + this.uid, JSON.stringify(S)); };

  Live.prototype._run = async function (op) {
    var q = this.sb.from(op.table), r;
    if (op.op === 'insert') r = await q.insert(op.rows);
    else if (op.op === 'insertIgnore') r = await q.upsert(op.rows, { onConflict: op.keys.join(','), ignoreDuplicates: true });
    else if (op.op === 'upsert') r = await q.upsert(op.row, { onConflict: op.keys.join(',') });
    else if (op.op === 'update') {
      r = await q.update(op.patch).match(op.match).select();
      if (!r.error && r.data && r.data.length === 0) throw new Error('You do not have permission to change this.');
    } else if (op.op === 'remove') {
      r = await q.delete().match(op.match).select();
      if (!r.error && r.data && r.data.length === 0) throw new Error('You do not have permission to remove this.');
    }
    if (r && r.error) throw new Error(r.error.message);
  };
  Live.prototype._queue = function (op) {
    var q = []; try { q = JSON.parse(lsGet(OUTBOX) || '[]'); } catch (e) { q = []; }
    q.push(op); lsSet(OUTBOX, JSON.stringify(q));
  };
  Live.prototype.pending = function () {
    try { return JSON.parse(lsGet(OUTBOX) || '[]').length; } catch (e) { return 0; }
  };
  Live.prototype._do = async function (op) {
    if (navigator.onLine === false) { this._queue(op); return; }
    try { await this._run(op); } catch (e) { if (isNetwork(e)) { this._queue(op); return; } throw e; }
  };
  Live.prototype.flush = async function () {
    var q = []; try { q = JSON.parse(lsGet(OUTBOX) || '[]'); } catch (e) { q = []; }
    if (!q.length) return 0;
    var left = [], sent = 0;
    for (var i = 0; i < q.length; i++) {
      try { await this._run(q[i]); sent++; } catch (e) {
        if (isNetwork(e)) { left = q.slice(i); break; }
        console.warn('Dropped a queued change that the server refused:', q[i], e);
      }
    }
    lsSet(OUTBOX, JSON.stringify(left));
    return sent;
  };
  Live.prototype.insert = function (table, rows) { return this._do({ op: 'insert', table: table, rows: rows }); };
  Live.prototype.insertIgnore = function (table, rows, keys) { return this._do({ op: 'insertIgnore', table: table, rows: rows, keys: keys }); };
  Live.prototype.upsert = function (table, row, keys) { return this._do({ op: 'upsert', table: table, row: row, keys: keys }); };
  Live.prototype.update = function (table, match, patch) { return this._do({ op: 'update', table: table, match: match, patch: patch }); };
  Live.prototype.remove = function (table, match) { return this._do({ op: 'remove', table: table, match: match }); };

  // ------------------------------------------------------------------
  window.PCS_TABLES = TABLES;
  window.PCS_DB_READY = (async function () {
    var db;
    if (LIVE) {
      if (!window.supabase) await loadScript(SUPABASE_JS);
      db = new Live();
    } else {
      db = new Local();
    }
    db.newId = newId;
    db.matches = matches;
    return db;
  })();
})();
