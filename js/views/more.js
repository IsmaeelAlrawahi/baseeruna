/* ============================================================
   بصائرنا — المزيد

   شريط التبويبات لا يتّسع لكل شيء، فما يُفتح بين الحين والحين
   مكانه هنا.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/more', {
    title: () => T('tabMore'),
    render: renderMore
  });

  const STUDENT_LINKS = [
    { to: '/profile', icon: 'users', label: () => T('profile'),  note: () => 'اسمك وصورتك وشعارك ومستواك' },
    { to: '/settings',icon: 'gear',  label: () => T('settings'), note: () => 'المظهر والتاريخ والنسخ الاحتياطي' }
  ];

  const TEACHER_LINKS = [
    { to: '/t/reciters', icon: 'mic',   label: () => T('recitersPage'), note: () => 'من يستمع إليهم الطلاب' },
    { to: '/adhkar',     icon: 'heart', label: () => T('adhkarPage'),   note: () => 'إضافة أذكار للطلاب' },
    { to: '/t/term',     icon: 'clock', label: () => T('term'),         note: () => 'بداية الفصل ونهايته' },
    { to: '/t/listen',   icon: 'play',  label: () => T('tabListen'),    note: () => 'التلاوات' },
    { to: '/profile',    icon: 'users', label: () => T('profile'),      note: () => 'اسمك وصورتك' },
    { to: '/settings',   icon: 'gear',  label: () => T('settings'),     note: () => 'المظهر والنسخ الاحتياطي' }
  ];

  async function renderMore() {
    const page = UI.screen();
    const links = Session.isTeacher ? TEACHER_LINKS : STUDENT_LINKS;

    const list = el('div.menu');
    links.forEach(l => {
      list.appendChild(el('a.menu-row', { href: '#' + l.to },
        el('span.menu-icon', {}, UI.icon(l.icon, 20)),
        el('span.menu-text', {},
          el('b', {}, l.label()),
          el('small', {}, l.note())),
        el('span.menu-chevron', {}, UI.icon('back', 16))));
    });
    page.appendChild(list);

    page.appendChild(el('div.rowbtns', {},
      UI.button(T('switchUser'), async () => {
        await Session.logout();
        Router.go('/', { replace: true });
      }, 'ghost', { icon: 'logout' })));

    return page;
  }

  /* ── ملفي الشخصي: الاسم والصورة والشعار ───────────────── */
  Router.register('/profile', {
    back: '/more',
    title: () => T('profile'),
    render: renderProfile
  });

  async function renderProfile() {
    const me = await Users.byId(Session.user.id);
    const page = UI.screen();

    /* ── الصورة ───────────────────────────────────────── */
    const photoCard = UI.card([UI.sectionTitle(T('profilePhoto'))]);
    const photoHost = el('div.photoedit');

    function paintPhoto() {
      U.clear(photoHost);
      photoHost.appendChild(UI.avatar(me, 96));

      const picker = el('input', {
        type: 'file', accept: 'image/*', hidden: true,
        onchange: async ev => {
          const file = ev.target.files && ev.target.files[0];
          ev.target.value = '';
          if (!file) return;
          try {
            await Photo.set(me.id, file);
            me.photo = (await Users.byId(me.id)).photo;
            Session.user = me;
            UI.toast(T('photoSaved'));
            paintPhoto();
          } catch (e) {
            UI.toast('تعذّر قراءة الصورة', 'warn');
          }
        }
      });

      photoHost.appendChild(el('div.photoedit-actions', {},
        UI.button(T('changePhoto'), () => picker.click(), 'ghost', { icon: 'upload' }),
        me.photo ? UI.button(T('removePhoto'), async () => {
          await Photo.clear(me.id);
          me.photo = null; Session.user = me;
          paintPhoto();
        }, 'ghost') : null,
        picker));
    }
    paintPhoto();
    photoCard.append(photoHost, el('p.hint', {}, T('photoHint')));
    page.appendChild(photoCard);

    /* ── الاسم ────────────────────────────────────────── */
    const nameIn = UI.input({ value: me.name });
    page.appendChild(UI.card([
      UI.field(T('myName'), nameIn),
      UI.button(T('save'), async () => {
        if (!nameIn.value.trim()) return UI.toast('اكتب اسمك', 'warn');
        await Users.update(me.id, { name: nameIn.value.trim() });
        Session.user.name = nameIn.value.trim();
        UI.toast(T('saved'));
      }, 'primary')
    ]));

    /* ── رمز الحلقة (للمعلّم) ─────────────────────────── */
    if (Session.isTeacher) {
      const codeBox = el('div.codebox', {},
        el('b.codebox-code', {}, me.code || '—'),
        UI.iconButton('share', async () => {
          const text = `${T('halaqahCode')}: ${me.code}`;
          try {
            if (navigator.share) await navigator.share({ text, title: CONFIG.app.name });
            else { await navigator.clipboard.writeText(text); UI.toast(T('copied')); }
          } catch (e) { /* أُلغيت المشاركة */ }
        }, { label: T('shareHalaqahCode') }));

      const students = await Users.students(me.id);
      page.appendChild(UI.card([
        UI.sectionTitle(T('myHalaqah'),
          UI.badge(`${U.num(students.length)} طالب`, 'soft')),
        UI.field(T('myHalaqahCode'), codeBox, T('halaqahCodeHint'))
      ]));
    }

    /* ── المستوى ──────────────────────────────────────── */
    if (Session.isStudent) {
      let level = me.level || PROGRAM.defaultLevel;
      page.appendChild(UI.card([
        UI.field(T('chooseLevel'), UI.chips(
          PROGRAM.levels.map(l => ({ value: l.id, label: `${l.name} — ${l.sub}` })),
          level, async v => {
            level = +v;
            await Users.update(me.id, { level });
            Session.user.level = level;
            me.level = level;
            UI.toast(T('saved'));
            Router.refreshTabs();
          }), T('levelHint'))
      ]));

      /* ── الشعار ─────────────────────────────────────── */
      page.appendChild(await mottoCard(me.id, true));
    }

    return page;
  }

  /* ── الشعار الأسبوعي ─────────────────────────────────── */
  async function mottoCard(userId, expanded) {
    const week = ProgramDays.weekKey();
    const motto = await Mottos.forWeek(userId, week);

    const card = UI.card([
      UI.sectionTitle(T('motto'),
        el('span.hint', {}, T('weekOf', U.formatDateShort(week))))
    ], 'card--motto');

    if (motto && motto.text) {
      card.appendChild(el('blockquote.motto', {},
        el('p', {}, motto.text)));
    } else {
      card.appendChild(el('p.hint', {}, T('noMotto')));
    }

    card.appendChild(UI.button(motto && motto.text ? T('editMotto') : T('setMotto'),
      () => openMottoSheet(userId, week, motto), 'ghost', { icon: 'edit' }));

    if (expanded) {
      const past = (await Mottos.history(userId)).filter(m => m.week !== week).slice(0, 6);
      if (past.length) {
        card.appendChild(el('div.motto-history', {},
          el('p.hint', {}, 'شعارات سابقة'),
          past.map(m => el('div.motto-old', {},
            el('small', {}, U.formatDateShort(m.week)),
            el('span', {}, m.text)))));
      }
    }
    return card;
  }

  function openMottoSheet(userId, week, existing) {
    const ta = el('textarea.input.input--quote', { rows: 3, placeholder: T('mottoPh') });
    ta.value = (existing && existing.text) || '';

    UI.sheet({
      title: T('motto'),
      body: el('div.form', {},
        el('p.hint', {}, T('weekOf', U.formatDateShort(week))),
        ta),
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            if (!ta.value.trim()) return UI.toast('اكتب شعارك أولًا', 'warn');
            await Mottos.set(userId, ta.value, week);
            a.close(); UI.toast(T('mottoSaved')); Router.render();
          } }
      ]
    });
  }

  /* ── الفصل الدراسي (للمعلّم) ──────────────────────────── */
  Router.register('/t/term', {
    role: 'teacher', back: '/more',
    title: () => T('term'),
    render: renderTerm
  });

  async function renderTerm() {
    const term = await Term.get();
    const page = UI.screen();

    const nameIn = UI.input({ value: term.name });
    const startIn = UI.input({ type: 'date', value: term.start });
    const endIn = UI.input({ type: 'date', value: term.end });

    const info = el('p.hint');
    function paintInfo() {
      const days = ProgramDays.daysBetween(startIn.value, endIn.value);
      const weeks = Math.max(1, Math.round(U.diffDays(startIn.value, endIn.value) / 7) + 1);
      info.textContent =
        `${U.num(days.length)} يوم متابعة · ${U.num(weeks)} أسبوع · ` +
        `${T('programDaysAre')}`;
    }
    startIn.addEventListener('change', paintInfo);
    endIn.addEventListener('change', paintInfo);
    paintInfo();

    page.appendChild(UI.card([
      UI.field('اسم الفصل', nameIn),
      el('div.field-row', {},
        UI.field(T('termStart'), startIn),
        UI.field(T('termEnd'), endIn)),
      info,
      UI.button(T('save'), async () => {
        if (endIn.value <= startIn.value) return UI.toast('تاريخ النهاية قبل البداية', 'warn');
        await Term.set({ name: nameIn.value.trim() || term.name,
                         start: startIn.value, end: endIn.value });
        UI.toast(T('saved'));
      }, 'primary')
    ]));

    /* ── مواعيد الملتقيات ─────────────────────────────── */
    const me = Session.user;
    const schedule = await Meetups.schedule(me.id);
    const meetCard = UI.card([
      UI.sectionTitle(T('meetupDates')),
      el('p.hint', {}, T('meetupDatesHint'))
    ]);
    PROGRAM.meetups.forEach(m => {
      const input = UI.input({ type: 'date', value: schedule[m.no] || '' });
      input.addEventListener('change', async () => {
        await Meetups.setSchedule(me.id, m.no, input.value || null);
        UI.toast(T('saved'));
      });
      meetCard.appendChild(UI.field(m.name, input));
    });
    page.appendChild(meetCard);

    page.appendChild(UI.card([
      UI.sectionTitle('أيام المتابعة'),
      el('p.hint', {}, T('programDaysAre') + ' — ولتغييرها عدّل PROGRAM.days في js/program.js'),
      el('div.chips', {}, T('weekdayNames').map((d, i) =>
        el('span.chip' + (PROGRAM.days.indexOf(i) !== -1 ? '.is-on' : ''), {}, d))),
      UI.sectionTitle(T('qiyam')),
      el('p.hint', {}, T('qiyamDays') + ' — ' + T('qiyamPrivate')),
      el('div.chips', {}, T('weekdayNames').map((d, i) =>
        el('span.chip' + (PROGRAM.qiyamDays.indexOf(i) !== -1 ? '.is-on' : ''), {}, d)))
    ]));

    return page;
  }

  window.MoreView = { mottoCard, openMottoSheet };
})();
