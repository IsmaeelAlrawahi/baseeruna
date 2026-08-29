/* ============================================================
   بصائرنا — startup
   ============================================================ */

(async function boot() {

  const splash = document.getElementById('splash');
  const app = document.getElementById('app');

  try {
    /* ── auto-update guard (v26: يمسح الكاش فقط) ──────
       كان v21-v25 يمسح IndexedDB كاملاً عند كل نسخة، فيُفقد
       roster المعلّم ويُخلق معلّمون مكررون. الآن: Supabase هو
       مصدر الحقيقة، والمحلي cache فقط، فنمسح cache الخدمة فقط. */
    if ('caches' in window && location.protocol.startsWith('http')) {
      const STORE_KEY = 'basairuna.lastBuildVersion.v2';
      const lastRan = localStorage.getItem(STORE_KEY);
      const thisBuild = CONFIG.app.cacheVersion;
      if (lastRan && lastRan !== thisBuild) {
        console.info('[بصائرنا] نسخة جديدة (' + thisBuild + '): مسح كاش الخدمة وإعادة التحميل');
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch (e) { console.warn('[بصائرنا] تعذّر مسح الكاش', e); }
        localStorage.setItem(STORE_KEY, thisBuild);
        /* لأن الـ service worker يستخدم stale-while-revalidate، كان يعرض
           ملفات قديمة حتى بعد النسخة الجديدة. نعيد التحميل مرة واحدة هنا
           حتى يشتغل فعلاً بأحدث الكود (إصلاح الدخول بالكود من الأجهزة الأخرى). */
        if (sessionStorage.getItem('basairuna.reloaded') !== thisBuild) {
          sessionStorage.setItem('basairuna.reloaded', thisBuild);
          location.reload();
        }
        return;
      } else {
        localStorage.setItem(STORE_KEY, thisBuild);
      }
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

  /* ── keep the day fresh — يتحدث كل يوم تلقائيًا حتى لو بقيت الصفحة مفتوحة ── */
  let lastDay = U.todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (U.todayKey() !== lastDay) { lastDay = U.todayKey(); Router.render(); }
  });
  // فحص منتصف الليل حتى لو لم يخف التطبيق
  setInterval(() => {
    const now = U.todayKey();
    if (now !== lastDay) { lastDay = now; if (document.visibilityState === 'visible') Router.render(); }
  }, 60000);

  /* ── stop the whole page bouncing while the tree pans ── */
  document.addEventListener('touchmove', ev => {
    if (ev.target.closest && ev.target.closest('.tree-canvas')) ev.preventDefault();
  }, { passive: false });

})();
