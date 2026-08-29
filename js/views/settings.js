/* ============================================================
   بصائرنا — settings, backup and account
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/settings', {
    back: true,
    title: () => T('settings'),
    render: renderSettings
  });

  async function renderSettings() {
    const me = Session.user;
    const page = UI.screen();

    /* ── account ──────────────────────────────────────── */
    page.appendChild(UI.card([
      el('div.hero', {},
        el('div.hero-text', {},
          el('p.hero-hello', {}, me.name),
          el('p.hero-date', {}, me.role === 'teacher' ? T('teacher') : T('student'))),
        UI.avatar(me, 44)),
      el('div.rowbtns', {},
        UI.button(T('changePin'), changePin, 'ghost'),
        UI.button(T('switchUser'), async () => {
          await Session.logout(); Router.go('/', { replace: true });
        }, 'ghost', { icon: 'logout' }))
    ]));

    /* ── appearance ───────────────────────────────────── */
    const theme = (await DB.setting('theme')) || 'light';
    page.appendChild(UI.card([
      UI.sectionTitle(T('appearance')),
      UI.field(T('theme'), UI.chips([
        { value: 'dark',  label: T('dark') },
        { value: 'light', label: T('light') }
      ], theme, async v => {
        document.documentElement.dataset.theme = v;
        await DB.setting('theme', v);
        const meta = document.querySelector('meta[name=theme-color]');
        if (meta) meta.content = v === 'light' ? '#F6F2E9' : '#07120F';
      })),
      UI.field('الأرقام', UI.chips([
        { value: 'ar', label: '١٢٣ عربية' },
        { value: 'en', label: '123 لاتينية' }
      ], U.useArabicDigits ? 'ar' : 'en', async v => {
        U.useArabicDigits = v === 'ar';
        await DB.setting('arabicDigits', U.useArabicDigits);
        UI.toast(T('saved'));
      }))
    ]));

    /* ── التقويم ──────────────────────────────────────── */
    page.appendChild(await calendarCard());

    /* ── install ──────────────────────────────────────── */
    const installCard = UI.card([
      UI.sectionTitle(T('installApp')),
      el('p.hint', {}, T('installHint'))
    ]);
    if (window.__installPrompt) {
      installCard.appendChild(UI.button(T('installApp'), async () => {
        const p = window.__installPrompt;
        if (!p) return;
        p.prompt();
        const res = await p.userChoice;
        if (res.outcome === 'accepted') { window.__installPrompt = null; Router.render(); }
      }, 'primary', { icon: 'down' }));
    } else if (window.matchMedia('(display-mode: standalone)').matches ||
               navigator.standalone) {
      installCard.appendChild(UI.badge('البرنامج مثبَّت على الجهاز', 'ok'));
    } else {
      installCard.appendChild(el('p.hint', {},
        'من متصفح الجهاز: افتح القائمة ثم اختر «إضافة إلى الشاشة الرئيسية».'));
    }
    page.appendChild(installCard);

    /* ── prayer slots (teacher only) ──────────────────── */
    if (Session.isTeacher) {
      page.appendChild(UI.card([
        UI.sectionTitle(T('prayerSlotsSettings')),
        el('p.hint', {},
          'الأوراق الثماني لكل يوم في الشجرة. لتغييرها عدّل قائمة prayerSlots في ملف js/config.js.'),
        el('div.slotlist', {}, CONFIG.prayerSlots.map(s =>
          el('div.slotlist-row', {},
            el('b', {}, s.name),
            UI.badge(s.kind === 'fard' ? 'فرض' : 'نافلة', s.kind === 'fard' ? 'ok' : 'gold'))))
      ]));
    }

    /* ── data ─────────────────────────────────────────── */
    const est = await DB.estimate();
    const dataCard = UI.card([
      UI.sectionTitle(T('dataAndBackup')),
      el('p.hint', {}, T('exportHint')),
      el('div.rowbtns', {},
        UI.button(T('exportData'), exportAll, 'ghost', { icon: 'share' }),
        UI.button(T('importData'), importAll, 'ghost', { icon: 'upload' }),
        Session.isStudent
          ? UI.button(T('shareWithTeacher'), exportMine, 'primary', { icon: 'share' })
          : null)
    ]);
    if (est && est.usage) {
      dataCard.appendChild(el('p.hint', {},
        `المساحة المستخدمة: ${U.bytes(est.usage)}` +
        (est.quota ? ` من ${U.bytes(est.quota)}` : '')));
    }
    if (!DB.persistent) {
      dataCard.appendChild(el('p.hint.hint--warn', {}, T('storageWarn')));
    } else {
      dataCard.appendChild(el('p.hint.hint--soft', {},
        'طريقة التخزين: ' + (DB.mode === 'idb' ? 'قاعدة بيانات المتصفح' : 'التخزين المحلي')));
    }
    page.appendChild(dataCard);

    /* ── about ────────────────────────────────────────── */
    page.appendChild(UI.card([
      UI.sectionTitle(T('about')),
      el('div.about', {},
        el('img.about-logo', { src: 'assets/logo.jpeg', alt: '' }),
        el('div', {},
          el('b', {}, CONFIG.app.fullName),
          el('p.hint', {}, CONFIG.app.tagline),
          el('p.hint', {}, 'الإصدار ' + U.num(CONFIG.app.version)),
          el('p.quote-text.about-dua', {}, 'اللهم اجعل القرآن ربيع قلوبنا')))
    ]));

    return page;
  }

  /* ── التقويم ──────────────────────────────────────────
     التواريخ المخزّنة ميلادية دائمًا — عليها يقوم الترتيب
     والمقارنة — وإنما يتغيّر ما يُعرض على الطالب.            */
  async function calendarCard() {
    const card = UI.card([UI.sectionTitle(T('calendar'))]);
    const preview = el('p.hint.hint--scope');

    function paintPreview() {
      preview.textContent = `${T('today')}: ${U.formatDate(U.todayKey())}` +
        (U.isHijri() ? `  ·  ${U.formatGregorian(U.todayKey())}` : '');
    }

    card.appendChild(UI.field(T('calendarSystem'), UI.chips([
      { value: 'hijri',     label: T('calHijri') },
      { value: 'gregorian', label: T('calGregorian') }
    ], U.calendar.system, async v => {
      U.setCalendar(v);
      await DB.setting('calendar', v);
      paintPreview();
      UI.toast(T('saved'));
    })));

    /* الهلال يختلف من بلد لبلد، فيُزاح التاريخ يومًا أو يومين. */
    card.appendChild(UI.field(T('hijriOffset'), UI.chips(
      [-2, -1, 0, 1, 2].map(n => ({
        value: n, label: n === 0 ? T('noOffset') : (n > 0 ? `+${U.num(n)}` : `−${U.num(-n)}`)
      })),
      U.calendar.offset, async v => {
        U.setCalendar(null, +v);
        await DB.setting('hijriOffset', +v);
        paintPreview();
        UI.toast(T('saved'));
      }), T('hijriOffsetHint')));

    paintPreview();
    card.appendChild(preview);
    card.appendChild(el('p.hint.hint--soft', {}, T('calendarNote')));
    return card;
  }

  /* ── actions ──────────────────────────────────────────── */
  async function changePin() {
    const value = await UI.prompt({
      title: T('changePin'), label: T('newPin'),
      value: Session.user.pin || '', hint: T('pinLength')
    });
    if (value === null) return;
    const pin = value.replace(/\D/g, '').slice(0, 4);
    await Users.update(Session.user.id, { pin });
    Session.user.pin = pin;
    UI.toast(T('saved'));
  }

  async function exportAll() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    U.download(`basairuna-backup-${U.todayKey()}.json`, blob);
    UI.toast(T('exported'));
  }

  async function exportMine() {
    const data = await DB.exportAll(Session.user.id);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const filename = `${Session.user.name}-${U.todayKey()}.json`;

    /* Prefer the system share sheet on phones. */
    if (navigator.canShare) {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: CONFIG.app.name, text: 'سجلاتي' });
          return;
        } catch (e) { if (e.name === 'AbortError') return; }
      }
    }
    U.download(filename, blob);
    UI.toast(T('exported'));
  }

  async function importAll() {
    if (!await UI.confirm(T('importWarn'))) return;
    const picker = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    document.body.appendChild(picker);
    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      picker.remove();
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const n = await DB.importAll(payload, { merge: true });
        UI.toast(T('imported') + ' — ' + U.num(n) + ' سجل');
        setTimeout(() => location.reload(), 900);
      } catch (err) {
        UI.toast('تعذّر الاستيراد: ' + err.message, 'warn', 4000);
      }
    });
    picker.click();
  }

  window.SettingsView = { exportAll, importAll };
})();
