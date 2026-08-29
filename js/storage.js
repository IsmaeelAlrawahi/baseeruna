/* ============================================================
   بصائرنا — storage layer

   Tries IndexedDB first (handles audio blobs, no size ceiling),
   falls back to localStorage, and finally to memory so the app
   still renders even from a file:// preview.

   Adding a new store: put its name in SCHEMA with the indexes you
   want and bump DB_VERSION. Nothing else needs to change.
   ============================================================ */

window.DB = (function () {

  const DB_NAME = 'basairuna';
  /* Raising this runs the upgrade below, which adds any store or
     index missing from SCHEMA. Existing records are left alone. */
  const DB_VERSION = 5;

  const SCHEMA = {
    users:       { keyPath: 'id', indexes: [['role','role'], ['teacherId','teacherId']] },
    entries:     { keyPath: 'id', indexes: [['userId','userId'], ['date','date'],
                                            ['userDate','userDate'], ['status','status']] },
    salah:       { keyPath: 'id', indexes: [['userId','userId'], ['date','date'],
                                            ['userDate','userDate']] },
    voice:       { keyPath: 'id', indexes: [['userId','userId']] },
    tracks:      { keyPath: 'id', indexes: [['userId','userId'], ['kind','kind'],
                                            ['reciterId','reciterId']] },
    motivations: { keyPath: 'id', indexes: [['studentId','studentId'], ['createdAt','createdAt']] },
    goals:       { keyPath: 'id', indexes: [['userId','userId'], ['active','active']] },
    badges:      { keyPath: 'id', indexes: [['userId','userId']] },
    reciters:    { keyPath: 'id', indexes: [['teacherId','teacherId']] },
    adhkar:      { keyPath: 'id', indexes: [['category','category'], ['teacherId','teacherId']] },
    adhkarLog:   { keyPath: 'id', indexes: [['userId','userId'], ['date','date'],
                                            ['userDate','userDate']] },

    /* ── the daily programme ──────────────────────────── */
    reports:     { keyPath: 'id', indexes: [['userId','userId'], ['date','date'],
                                            ['userDate','userDate'], ['submitted','submitted']] },
    poems:       { keyPath: 'id', indexes: [['userId','userId'], ['active','active']] },
    books:       { keyPath: 'id', indexes: [['userId','userId'], ['active','active']] },
    /* مكتبة الحلقة — كتب يضعها المعلّم ويقرؤها الطلاب */
    library:     { keyPath: 'id', indexes: [['teacherId','teacherId']] },
    nahw:        { keyPath: 'id', indexes: [['userId','userId'], ['lesson','lesson']] },
    meetups:     { keyPath: 'id', indexes: [['userId','userId'], ['no','no']] },
    mottos:      { keyPath: 'id', indexes: [['userId','userId'], ['week','week']] },
    files:       { keyPath: 'id', indexes: [['userId','userId'], ['kind','kind']] },

    kv:          { keyPath: 'key', indexes: [] }
  };

  let db = null;
  let mode = 'memory';        /* 'idb' | 'local' | 'memory' */
  let memory = {};            /* store -> Map */
  const listeners = new Set();

  Object.keys(SCHEMA).forEach(s => { memory[s] = new Map(); });

  /* ── open ─────────────────────────────────────────────── */
  function open() {
    return new Promise(resolve => {
      let settled = false;
      const finish = m => { if (!settled) { settled = true; mode = m; resolve(m); } };

      if (!('indexedDB' in window)) return finish(fallback());

      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { return finish(fallback()); }

      /* Private mode / opaque origins can hang instead of erroring. */
      const guard = setTimeout(() => finish(fallback()), 3000);

      req.onupgradeneeded = ev => {
        const d = ev.target.result;
        for (const name in SCHEMA) {
          const def = SCHEMA[name];
          const store = d.objectStoreNames.contains(name)
            ? req.transaction.objectStore(name)
            : d.createObjectStore(name, { keyPath: def.keyPath });
          def.indexes.forEach(([idxName, keyPath]) => {
            if (!store.indexNames.contains(idxName)) store.createIndex(idxName, keyPath);
          });
        }
      };
      req.onsuccess = () => {
        clearTimeout(guard);
        db = req.result;
        db.onversionchange = () => { db.close(); db = null; };
        finish('idb');
      };
      req.onerror = () => { clearTimeout(guard); finish(fallback()); };
      req.onblocked = () => { clearTimeout(guard); finish(fallback()); };
    });
  }

  function fallback() {
    try {
      localStorage.setItem('__probe', '1');
      localStorage.removeItem('__probe');
      loadLocal();
      return 'local';
    } catch (e) { return 'memory'; }
  }

  const LS_KEY = 'basairuna:data';
  function loadLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      for (const s in SCHEMA) {
        memory[s] = new Map((raw[s] || []).map(r => [r[SCHEMA[s].keyPath], r]));
      }
    } catch (e) { /* start empty */ }
  }
  const saveLocal = U.debounce(() => {
    if (mode !== 'local') return;
    try {
      const out = {};
      for (const s in SCHEMA) out[s] = Array.from(memory[s].values());
      localStorage.setItem(LS_KEY, JSON.stringify(out));
    } catch (e) {
      /* Over quota — most likely a big voice note. Keep running in
         memory rather than losing the session. */
      console.warn('[بصائرنا] تعذّر الحفظ في التخزين المحلي', e);
      UI && UI.toast && UI.toast(T('storageWarn'), 'warn');
    }
  }, 250);

  /* ── primitives ───────────────────────────────────────── */
  function tx(store, mode2, fn) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('no idb'));
      let out;
      const t = db.transaction(store, mode2);
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
      const r = fn(t.objectStore(store));
      if (r) r.onsuccess = e => { out = e.target.result; };
    });
  }

  async function put(store, rec) {
    rec.updatedAt = Date.now();
    if (mode === 'idb') { await tx(store, 'readwrite', s => s.put(rec)); }
    else { memory[store].set(rec[SCHEMA[store].keyPath], rec); saveLocal(); }
    emit(store, 'put', rec);
    return rec;
  }

  async function putAll(store, recs) {
    if (!recs.length) return recs;
    const now = Date.now();
    recs.forEach(r => { r.updatedAt = now; });
    if (mode === 'idb') await tx(store, 'readwrite', s => { recs.forEach(r => s.put(r)); });
    else { recs.forEach(r => memory[store].set(r[SCHEMA[store].keyPath], r)); saveLocal(); }
    emit(store, 'put', recs);
    return recs;
  }

  async function get(store, key) {
    if (mode === 'idb') return (await tx(store, 'readonly', s => s.get(key))) || null;
    return memory[store].get(key) || null;
  }

  async function all(store) {
    if (mode === 'idb') return (await tx(store, 'readonly', s => s.getAll())) || [];
    return Array.from(memory[store].values());
  }

  async function where(store, index, value) {
    if (mode === 'idb') {
      try {
        return (await tx(store, 'readonly', s => s.index(index).getAll(value))) || [];
      } catch (e) { /* index missing — scan instead */ }
    }
    const keyPath = (SCHEMA[store].indexes.find(i => i[0] === index) || [])[1] || index;
    return (await all(store)).filter(r => r[keyPath] === value);
  }

  async function remove(store, key) {
    if (mode === 'idb') await tx(store, 'readwrite', s => s.delete(key));
    else { memory[store].delete(key); saveLocal(); }
    emit(store, 'delete', key);
  }

  async function removeWhere(store, fn) {
    const rows = (await all(store)).filter(fn);
    for (const r of rows) await remove(store, r[SCHEMA[store].keyPath]);
    return rows.length;
  }

  async function clearStore(store) {
    if (mode === 'idb') await tx(store, 'readwrite', s => s.clear());
    else { memory[store].clear(); saveLocal(); }
    emit(store, 'clear');
  }

  /* ── settings (kv) ────────────────────────────────────── */
  async function setting(key, value) {
    if (value === undefined) {
      const r = await get('kv', key);
      return r ? r.value : undefined;
    }
    await put('kv', { key, value });
    return value;
  }

  /* ── change notifications ─────────────────────────────── */
  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit(store, action, payload) {
    listeners.forEach(fn => { try { fn(store, action, payload); } catch (e) { console.error(e); } });
  }

  /* ── backup ───────────────────────────────────────────
     Blobs become data URLs so the whole thing is one JSON file
     that survives email, WhatsApp and USB sticks alike.       */
  async function exportAll(filterUserId) {
    const out = { app: 'basairuna', version: CONFIG.app.version, exportedAt: Date.now(), stores: {} };
    for (const name in SCHEMA) {
      let rows = await all(name);
      if (filterUserId && name !== 'kv') {
        rows = rows.filter(r =>
          r.userId === filterUserId || r.studentId === filterUserId || r.id === filterUserId);
      }
      out.stores[name] = await Promise.all(rows.map(async r => {
        const copy = Object.assign({}, r);
        for (const k in copy) {
          if (copy[k] instanceof Blob) {
            copy[k] = { __blob: true, type: copy[k].type, data: await U.blobToDataUrl(copy[k]) };
          }
        }
        return copy;
      }));
    }
    return out;
  }

  async function importAll(payload, { merge = true } = {}) {
    if (!payload || payload.app !== 'basairuna') throw new Error('ملف غير صالح');
    let count = 0;
    for (const name in payload.stores) {
      if (!SCHEMA[name]) continue;
      if (!merge) await clearStore(name);
      const rows = await Promise.all(payload.stores[name].map(async r => {
        const copy = Object.assign({}, r);
        for (const k in copy) {
          const v = copy[k];
          if (v && typeof v === 'object' && v.__blob) copy[k] = await U.dataUrlToBlob(v.data);
        }
        return copy;
      }));
      /* Last write wins, compared by updatedAt. */
      const existing = new Map((await all(name)).map(r => [r[SCHEMA[name].keyPath], r]));
      const toWrite = rows.filter(r => {
        const prev = existing.get(r[SCHEMA[name].keyPath]);
        return !prev || (r.updatedAt || 0) >= (prev.updatedAt || 0);
      });
      await putAll(name, toWrite);
      count += toWrite.length;
    }
    return count;
  }

  async function estimate() {
    if (navigator.storage && navigator.storage.estimate) {
      try { return await navigator.storage.estimate(); } catch (e) {}
    }
    return null;
  }

  return {
    open, put, putAll, get, all, where, remove, removeWhere, clear: clearStore,
    setting, on, exportAll, importAll, estimate,
    get mode() { return mode; },
    get persistent() { return mode !== 'memory'; },
    SCHEMA
  };
})();
