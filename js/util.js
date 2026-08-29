/* ============================================================
   بصائرنا — small helpers used everywhere
   ============================================================ */

window.U = (function () {

  /* ── DOM ──────────────────────────────────────────────── */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* el('div.card#id', {onclick}, child, child…) */
  function el(spec, attrs, ...children) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
    const node = document.createElement(m[1] || 'div');
    (m[2] || '').split(/(?=[.#])/).filter(Boolean).forEach(tok => {
      if (tok[0] === '.') node.classList.add(tok.slice(1));
      else node.id = tok.slice(1);
    });
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node)) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    } else if (attrs !== undefined && attrs !== null) {
      children.unshift(attrs);
    }
    children.flat(3).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return node;
  }

  const clear = n => { while (n && n.firstChild) n.removeChild(n.firstChild); return n; };
  const esc = s => String(s === null || s === undefined ? '' : s)
    .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  /* ── ids ──────────────────────────────────────────────── */
  function uid(prefix) {
    const r = (crypto && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    return (prefix ? prefix + '_' : '') + r;
  }

  /* ── numbers ──────────────────────────────────────────── */
  const AR_DIGITS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  function num(n, arabicDigits) {
    const s = String(n);
    if (arabicDigits === false) return s;
    if (!U.useArabicDigits) return s;
    return s.replace(/\d/g, d => AR_DIGITS[+d]);
  }
  function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }

  /* ── dates ────────────────────────────────────────────
     A "key" is YYYY-MM-DD in local time — stable, sortable,
     and free of timezone drift.                            */
  function dateKey(d) {
    d = d || new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  const todayKey = () => dateKey(new Date());
  function parseKey(k) {
    const [y, m, d] = String(k).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(k, n) {
    const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d);
  }
  function diffDays(a, b) {
    return Math.round((parseKey(b) - parseKey(a)) / 86400000);
  }
  function daysInMonth(year, month /* 1-12 */) {
    return new Date(year, month, 0).getDate();
  }

  /* ── التقويم ──────────────────────────────────────────
     مفاتيح التخزين ميلادية دائمًا (YYYY-MM-DD) — لا يصحّ غير
     ذلك، فهي أساس الترتيب والمقارنة. وإنما يتغيّر ما يُعرض على
     الطالب: هجريّ أو ميلاديّ، حسب U.calendar.

     ورؤية الهلال تختلف من بلد لبلد، فـ hijriOffset يزيح التاريخ
     يومًا أو يومين ليوافق تقويم بلدك.                          */
  const CAL = { system: 'hijri', offset: 0 };

  function hijriParts(d) {
    const date = new Date(d || new Date());
    if (CAL.offset) date.setDate(date.getDate() + CAL.offset);
    try {
      const f = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'numeric', year: 'numeric'
      });
      const parts = {};
      f.formatToParts(date).forEach(p => { if (p.type !== 'literal') parts[p.type] = p.value; });
      /* Intl يعيد أرقامًا عربية-هندية؛ نحوّلها لنحسب بها. */
      const toInt = s => parseInt(String(s).replace(/[٠-٩]/g,
        c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))), 10);
      return { day: toInt(parts.day), month: toInt(parts.month), year: toInt(parts.year) };
    } catch (e) { return null; }
  }

  /* نصّ التاريخ الهجري كاملًا: الأحد ١٤ صفر ١٤٤٨ هـ */
  function hijri(d, { withWeekday = false, short = false } = {}) {
    const date = new Date(d || new Date());
    const p = hijriParts(date);
    if (!p) return '';
    const months = T('hijriMonths');
    const name = months[U.clamp(p.month - 1, 0, 11)];
    const body = short ? `${num(p.day)} ${name}`
                       : `${num(p.day)} ${name} ${num(p.year)} هـ`;
    return withWeekday ? `${T('weekdayNames')[date.getDay()]} ${body}` : body;
  }

  const isHijri = () => CAL.system === 'hijri';

  function formatDate(k) {
    const d = parseKey(k);
    if (isHijri()) return hijri(d, { withWeekday: true });
    const wd = T('weekdayNames')[d.getDay()];
    return `${wd} ${num(d.getDate())} ${T('monthNames')[d.getMonth()]} ${num(d.getFullYear())}`;
  }

  function formatDateShort(k) {
    const d = parseKey(k);
    if (isHijri()) return hijri(d, { short: true });
    return `${num(d.getDate())} ${T('monthNames')[d.getMonth()]}`;
  }

  /* الميلادي صراحةً، حين يُراد الاثنان معًا. */
  function formatGregorian(k) {
    const d = parseKey(k);
    return `${num(d.getDate())} ${T('monthNames')[d.getMonth()]} ${num(d.getFullYear())}`;
  }

  /* الشهر والسنة وحدهما — لعناوين الشجرة ونحوها. */
  function formatMonth(year, monthIndex) {
    if (!isHijri()) return `${T('monthNames')[monthIndex]} ${num(year)}`;
    const mid = hijriParts(new Date(year, monthIndex, 15));
    if (!mid) return T('monthNames')[monthIndex];
    return `${T('hijriMonths')[U.clamp(mid.month - 1, 0, 11)]} ${num(mid.year)}`;
  }

  function relativeDay(k) {
    const t = todayKey();
    if (k === t) return T('today');
    if (k === addDays(t, -1)) return T('yesterday');
    return formatDateShort(k);
  }

  function setCalendar(system, offset) {
    if (system) CAL.system = system;
    if (offset !== undefined) CAL.offset = +offset || 0;
  }

  function clockTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}:${String(m % 60).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function bytes(n) {
    if (!n) return '0';
    const u = ['بايت','ك.ب','م.ب','ج.ب'];
    let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return num(n.toFixed(i ? 1 : 0)) + ' ' + u[i];
  }

  /* ── misc ─────────────────────────────────────────────── */
  function debounce(fn, ms) {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms || 200); };
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const groupBy = (arr, fn) => arr.reduce((acc, x) => {
    const k = fn(x); (acc[k] = acc[k] || []).push(x); return acc;
  }, {});
  const sum = (arr, fn) => arr.reduce((a, x) => a + (fn ? fn(x) : x), 0);

  /* Deterministic pick — same input, same output all day long. */
  function pickOfDay(list, salt) {
    if (!list || !list.length) return null;
    const seed = todayKey() + (salt || '');
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return list[h % list.length];
  }

  function download(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function blobToDataUrl(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  async function dataUrlToBlob(url) { return (await fetch(url)).blob(); }

  return {
    $, $$, el, clear, esc, uid, num, pct, useArabicDigits: true,
    dateKey, todayKey, parseKey, addDays, diffDays, daysInMonth,
    formatDate, formatDateShort, formatGregorian, formatMonth, relativeDay,
    hijri, hijriParts, setCalendar, isHijri, get calendar() { return CAL; },
    clockTime, bytes,
    debounce, sleep, clamp, groupBy, sum, pickOfDay,
    download, blobToDataUrl, dataUrlToBlob
  };
})();
