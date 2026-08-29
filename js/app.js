/* ============================================================
   بصائرنا — startup
   ============================================================ */

(async function boot() {

  const splash = document.getElementById('splash');
  const app = document.getElementById('app');

  try {
    /* ── auto-update guard ──────────────────────────────
       Administrative mode: every device must run the newest build.
       We store the last build the device actually ran, then on each
       boot compare it with the build baked into this code
       (CONFIG.app.cacheVersion). If they differ, a newer/older build
       is in play on the server, so we clear the stale service-worker
       cache and force a full reload — no manual refresh needed. */
    if ('caches' in window && location.protocol.startsWith('http')) {
      const lastRan = await DB.setting('lastBuildVersion');
      const thisBuild = CONFIG.app.cacheVersion;
      if (lastRan && lastRan !== thisBuild) {
        console.info('[بصائرنا] نسخة أحدث على السيرفر (' + thisBuild +
          ')، تنظيف الكاش القديم (' + lastRan + ') وإعادة التحميل');
        // أمسح كل كاش الـ service worker القديم كي لا يبقى ملف قديم.
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch (e) {
          console.warn('[بصائرنا] تعذّر مسح الكاش', e);
        }
        // سجّل أننا بصدد تحديث، وأعد التحميل بعد وقفة قصيرة ليتمكن
        // السكربت الجديد من التسجيل.
        await DB.setting('lastBuildVersion', thisBuild);
        setTimeout(() => location.reload(), 120);
        return;
      }
      await DB.setting('lastBuildVersion', thisBuild);
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

    /* ── first run ────────────────────────────────────── */
    const users = await DB.all('users');
    if (!users.length) {
      const teacher = await Users.create({
        name: CONFIG.firstRun.teacherName,
        role: 'teacher',
        pin: CONFIG.firstRun.teacherPin
      });
      await DB.setting('firstRunAt', Date.now());
      /* الكتب المرفقة تُزرع في المكتبة أول تشغيل. */
      await Library.seed(teacher.id);
      console.info('[بصائرنا] أُنشئ حساب المعلّم — الرمز السري:',
        CONFIG.firstRun.teacherPin, '· رمز الدخول:', teacher.code);
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
