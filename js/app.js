/* ============================================================
   بصائرنا — startup
   ============================================================ */

(async function boot() {

  const splash = document.getElementById('splash');
  const app = document.getElementById('app');

  try {
    /* ── auto-update guard (v2: يمسح كل البيانات المحلية) ──
       Administrative mode: every device must run the newest build
       from a clean slate. We pin the last build in localStorage
       (NOT IndexedDB, so it survives a wipe), and whenever the
       running build differs we:
         1) wipe ALL local data (IndexedDB + service-worker cache)
         2) force a full reload
       This clears any stale student/teacher rows left on devices
       from earlier experimental versions, so the cloud is the only
       trusted source going forward. */
    if ('caches' in window && location.protocol.startsWith('http')) {
      const STORE_KEY = 'basairuna.lastBuildVersion.v2';
      const lastRan = localStorage.getItem(STORE_KEY);
      const thisBuild = CONFIG.app.cacheVersion;
      if (lastRan && lastRan !== thisBuild) {
        console.info('[بصائرنا] نسخة جديدة (' + thisBuild +
          '): مسح جميع البيانات المحلية القديمة وإعادة التحميل');

        // 1) امسح كل بيانات IndexedDB (تتضمّن الجدول المحلي).
        try {
          const dbs = await indexedDB.databases ? indexedDB.databases() : [];
          const names = Array.isArray(dbs)
            ? dbs.map(d => d.name)
            : ['basairuna'];
          for (const n of names) indexedDB.deleteDatabase(n);
        } catch (e) {
          console.warn('[بصائرنا] تعذّر مسح IndexedDB', e);
        }
        // 2) امسح كل كاش الـ service worker.
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch (e) {
          console.warn('[بصائرنا] تعذّر مسح الكاش', e);
        }

        // سجّل النسخة الجديدة في localStorage وأعد التحميل.
        localStorage.setItem(STORE_KEY, thisBuild);
        setTimeout(() => location.reload(), 150);
        return;
      }
      localStorage.setItem(STORE_KEY, thisBuild);
    }

    /* ── storage ──────────────────────────────────────── */
    const mode = await DB.open();
    if (mode === 'memory') {
      console.warn('[بصائرنا] لا يوجد تخزين دائم — لن تُحفظ البيانات بعد إغلاق الصفحة.');
    }

    /* Ask the browser not to evict the data when space runs low. */
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist(); });
    }

    /* ── first run ──────────────────────────────────────
       لا نُنشئ معلمًا تلقائيًا أبدًا (كان هذا مصدر تراكم
       معلمين مكررين عبر الأجهزة). المعلمون الحقيقيون يُنشؤون
       صراحةً عبر «معلّم جديد» الذي يعطي لكلٍّ رمز حلقة خاص به. */
    const hasAny = await DB.all('users');
    if (!hasAny.length) {
      await DB.setting('firstRunAt', Date.now());
    }

    /* ── migrations ───────────────────────────────────
       Accounts made before login codes existed get one now, so
       nobody is locked out by the change. */
    const everyone = await DB.all('users');
    const needCode = everyone.filter(u => !u.code);
    if (needCode.length) {
      for (const u of needCode) {
        u.code = Users.makeCode(everyone);
        await DB.put('users', u);
      }
      console.info('[بصائرنا] أُنشئت رموز دخول لـ', needCode.length, 'حساب');
    }

    /* الكتب المرفقة تُزرع لكل معلّم في حلقته. */
    for (const t of everyone.filter(u => u.role === 'teacher')) await Library.seed(t.id);

    /* ── preferences ──────────────────────────────────── */
    const theme = (await DB.setting('theme')) || 'light';
    document.documentElement.dataset.theme = theme;
    const metaTheme = document.querySelector('meta[name=theme-color]');
    if (metaTheme) metaTheme.content = theme === 'light' ? '#F6F2E9' : '#07120F';

    const arabicDigits = await DB.setting('arabicDigits');
    if (arabicDigits !== undefined) U.useArabicDigits = !!arabicDigits;

    /* التقويم المعروض — هجريّ افتراضًا، مع إزاحة لرؤية الهلال. */
    U.setCalendar(
      (await DB.setting('calendar')) || 'hijri',
      (await DB.setting('hijriOffset')) || 0);

    /* ── session ──────────────────────────────────────── */
    await Session.restore();
    if (Session.user) document.body.dataset.role = Session.user.role;

    /* ── audio ────────────────────────────────────────── */
    await Player.init();
    PlayerBar.mount();

    /* ── go ───────────────────────────────────────────── */
    if (!location.hash) {
      location.replace('#' + (Session.user
        ? (Session.isTeacher ? '/t/students' : '/home')
        : '/'));
    }
    Router.start();

    app.hidden = false;
    /* A timer rather than requestAnimationFrame: rAF never fires in a
       background tab, which would leave the splash covering the app
       until the student happened to look at it. */
    setTimeout(() => {
      splash.classList.add('is-done');
      setTimeout(() => splash.remove(), 500);
    }, 60);

  } catch (err) {
    console.error('[بصائرنا] فشل بدء التشغيل', err);
    splash.innerHTML =
      '<div class="splash-error"><p>تعذّر بدء البرنامج</p><code></code>' +
      '<button onclick="location.reload()">إعادة المحاولة</button></div>';
    splash.querySelector('code').textContent = err.message || String(err);
  }

  /* ── service worker: offline + background audio ───────
     Boot is async, so by the time this runs the load event has
     usually already fired — waiting for it would mean never
     registering, and never working offline. */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const register = () => navigator.serviceWorker.register('sw.js')
      .catch(e => console.warn('[بصائرنا] تعذّر تسجيل عامل الخدمة', e));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  /* ── install prompt ─────────────────────────────────── */
  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    window.__installPrompt = ev;
  });
  window.addEventListener('appinstalled', () => { window.__installPrompt = null; });

  /* ── keep the day fresh when the app is left open ───── */
  let lastDay = U.todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (U.todayKey() !== lastDay) { lastDay = U.todayKey(); Router.render(); }
  });

  /* ── stop the whole page bouncing while the tree pans ── */
  document.addEventListener('touchmove', ev => {
    if (ev.target.closest && ev.target.closest('.tree-canvas')) ev.preventDefault();
  }, { passive: false });

})();
