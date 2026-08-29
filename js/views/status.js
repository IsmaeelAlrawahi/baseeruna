/* ============================================================
   بصائرنا — حال الطلبة

   من أتمّ ما عليه اليوم ومن لم يتمّ. يراها الجميع، طلابًا ومعلّمًا،
   بلا درجات ولا ترتيب — إنما إتمامٌ أو تقصير.

   وقيام الليل عمودٌ لا يظهر إلا للمعلّم.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/status', {
    title: () => T('studentsStatus'),
    render: () => renderStatus(null)
  });

  Router.register('/status/:date', {
    back: '/status',
    title: () => T('studentsStatus'),
    render: p => renderStatus(p.date)
  });

  async function renderStatus(dateParam) {
    const me = Session.user;
    const isTeacher = Session.isTeacher;
    const page = UI.screen(null, 'page--status');

    const today = U.todayKey();
    const date = dateParam || (ProgramDays.isProgramDay(today)
      ? today : ProgramDays.lastProgramDay(today));

    /* Everyone in the halaqah, whoever is looking. */
    const teacherId = isTeacher ? me.id : (me.teacherId || null);
    const students = await Users.students(teacherId);

    page.appendChild(el('div.report-head', {},
      el('div', {},
        el('h2.report-day', {}, ProgramDays.dayName(date)),
        el('p.report-date', {}, U.formatDate(date)))));

    page.appendChild(weekStrip(date));

    if (!ProgramDays.isProgramDay(date)) {
      page.appendChild(UI.card([UI.empty(T('notProgramDay') + ' — ' + T('programDaysAre'))]));
      return page;
    }

    if (!students.length) { page.appendChild(UI.empty(T('empty'))); return page; }

    /* ── gather ───────────────────────────────────────── */
    /* البنود العامّة وحدها — بلا قيام الليل. لو دخل في العدّ هنا
       لعرفه كل من رأى الجدول من عدد العلامات نفسه. */
    const rows = [];
    for (const s of students) {
      const rec = await Reports.get(s.id, date);
      const targets = Object.assign({}, PROGRAM.targets, s.targets || {});
      const parts = Reports.scoreDay(rec, targets);
      const items = Reports.dayItems(date, { includePrivate: false });
      const keys = items.map(i => i.key);
      const done = keys.filter(k => (parts[k] || 0) >= 1).length;
      rows.push({
        user: s, rec, parts, keys, done,
        complete: done === keys.length,
        submitted: rec.submitted
      });
    }

    const finished = rows.filter(r => r.complete);
    const isQiyamDay = ProgramDays.isQiyamDay(date);

    /* ── من أتمّ ──────────────────────────────────────── */
    const banner = UI.card([], 'card--status');
    if (finished.length) {
      banner.append(
        el('div.status-banner', {},
          el('span.status-banner-mark', {}, UI.icon('star', 22)),
          el('p', {}, T('finishedToday', namesOf(finished.map(r => r.user)))),
        ),
        el('p.hint', {}, T('finishedCount', U.num(finished.length), U.num(rows.length))));
    } else {
      banner.appendChild(UI.empty(T('noneFinishedYet')));
    }
    page.appendChild(banner);

    /* ── الجدول ───────────────────────────────────────── */
    const labels = { quranMemorize: 'حفظ', quranReview: 'مراجعة', poetry: 'شعر', reading: 'قراءة' };

    const card = UI.card([UI.sectionTitle(T('studentsStatus'))]);
    const head = el('div.statusrow.statusrow--head', {},
      el('span.status-name', {}, T('studentName')),
      el('span.status-cells', {},
        ['quranMemorize','quranReview','poetry','reading'].map(k =>
          el('i.status-label', {}, labels[k]))),
      isQiyamDay && isTeacher ? el('span.status-qiyam', {}, T('qiyam')) : null);
    card.appendChild(head);

    const list = el('div.statuslist');
    rows.forEach(r => {
      const row = el('div.statusrow' + (r.complete ? '.is-complete' : ''), {
        onclick: isTeacher ? () => Router.go(`/t/report/${r.user.id}/${date}`) : null
      });

      row.appendChild(el('span.status-name', {},
        UI.avatar(r.user, 32),
        el('span', {}, r.user.name),
        r.complete ? el('i.status-tick', {}, UI.icon('check', 13)) : null));

      row.appendChild(el('span.status-cells', {}, r.keys.map(k =>
        el('i.status-cell' + ((r.parts[k] || 0) >= 1 ? '.on'
            : ((r.parts[k] || 0) > 0 ? '.half' : '')), { title: labels[k] }))));

      /* قيام الليل — للمعلّم وحده */
      if (isQiyamDay && isTeacher) {
        row.appendChild(el('button.status-qiyam' + (r.rec.qiyam ? '.is-on' : ''), {
          type: 'button', title: T('qiyam'),
          onclick: async ev => {
            ev.stopPropagation();
            /* الزرّ يُمسَك قبل الانتظار — currentTarget يصير null بعده. */
            const btn = ev.currentTarget;
            const next = !r.rec.qiyam;
            r.rec.qiyam = next;
            btn.classList.toggle('is-on', next);
            await Reports.save(r.user.id, date, { qiyam: next });
          }
        }, UI.icon('moon', 14)));
      }

      list.appendChild(row);
    });
    card.appendChild(list);

    if (isQiyamDay && isTeacher) {
      card.appendChild(el('p.hint.hint--warn', {}, T('qiyamTeacherNote')));
    }
    card.appendChild(el('p.hint', {},
      `${T('submittedCount', U.num(rows.filter(r => r.submitted).length), U.num(rows.length))}`));

    page.appendChild(card);
    return page;
  }

  /* "فلان وفلان أتمّوا ما عليهم" */
  function namesOf(users) {
    const names = users.map(u => u.name);
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ' و' + names[1];
    return names.slice(0, -1).join('، ') + ' و' + names[names.length - 1];
  }

  function weekStrip(date) {
    const days = ProgramDays.daysOfWeek(ProgramDays.weekKey(date));
    const today = U.todayKey();
    return el('div.weekstrip', {}, days.map(d =>
      el('a.weekday' + (d === date ? '.is-current' : '') + (d > today ? '.is-future' : ''), {
        href: d > today ? null : '#/status/' + d
      },
        el('b', {}, ProgramDays.dayName(d)),
        el('span', {}, U.num(U.parseKey(d).getDate())))));
  }

  /* ── بطاقة مختصرة للصفحة الرئيسية ─────────────────────
     من أتمّ ما عليه اليوم، بلا جدول ولا تفاصيل. */
  async function homeCard(viewerId) {
    const me = Session.user;
    const today = U.todayKey();
    const date = ProgramDays.isProgramDay(today) ? today : ProgramDays.lastProgramDay(today);
    const teacherId = Session.isTeacher ? me.id : (me.teacherId || null);
    const students = await Users.students(teacherId);

    const card = UI.card([
      UI.sectionTitle(T('studentsStatus'),
        el('a.link', { href: '#/status' }, T('more')))
    ], 'card--status');

    if (!students.length) { card.appendChild(UI.empty(T('empty'))); return card; }

    const finished = [];
    for (const s of students) {
      const rec = await Reports.get(s.id, date);
      const targets = Object.assign({}, PROGRAM.targets, s.targets || {});
      /* البنود العامّة وحدها — قيام الليل لا يدخل فيما يراه الجميع. */
      if (Reports.isComplete(rec, targets)) finished.push(s);
    }

    if (finished.length) {
      card.appendChild(el('div.status-banner', {},
        el('span.status-banner-mark', {}, UI.icon('star', 20)),
        el('p', {}, T('finishedToday', namesOf(finished)))));
    } else {
      card.appendChild(el('p.hint', {}, T('noneFinishedYet')));
    }

    /* صفّ الصور: من أتمّ مضيء ومن لم يتمّ باهت. */
    const faces = el('div.status-faces');
    students.forEach(s => {
      const done = finished.some(f => f.id === s.id);
      faces.appendChild(el('div.status-face' + (done ? '.is-done' : ''), {
        title: s.name
      }, UI.avatar(s, 34)));
    });
    card.append(faces,
      el('p.hint', {}, T('finishedCount', U.num(finished.length), U.num(students.length))));

    return card;
  }

  window.StatusView = { namesOf, homeCard };
})();
