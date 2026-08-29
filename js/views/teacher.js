/* ============================================================
   بصائرنا — the teacher's side: students, review inbox,
   motivation and class reports.
   ============================================================ */

(function () {
  const { el } = U;

  /* ══════════════════ STUDENT LIST ══════════════════════ */
  Router.register('/t/students', {
    role: 'teacher',
    title: () => T('students'),
    actions: () => [UI.iconButton('plus', () => openStudentSheet(), { label: T('addStudent') })],
    render: renderStudents
  });

  async function renderStudents() {
    const me = Session.user;
    const page = UI.screen();
    const students = await Users.students(me.id);

    /* class summary strip */
    const pending = await Entries.pending(me.id);
    page.appendChild(el('div.tstrip', {},
      stat(U.num(students.length), T('students')),
      stat(U.num(pending.length), T('awaitingReview'),
        pending.length ? () => Router.go('/t/inbox') : null),
      stat(U.num(new Date().getFullYear()), 'السنة')));

    if (!students.length) {
      page.appendChild(UI.empty('لم تُضف أي طالب بعد',
        UI.button(T('addStudent'), () => openStudentSheet(), 'primary', { icon: 'plus' })));
      return page;
    }

    const list = el('div.students');
    page.appendChild(list);

    for (const s of students) list.appendChild(await studentRow(s));

    page.appendChild(el('div.fab-space'));
    page.appendChild(el('button.fab', {
      type: 'button', onclick: () => openStudentSheet(), 'aria-label': T('addStudent')
    }, UI.icon('plus', 26)));

    return page;
  }

  function stat(value, label, onClick) {
    const node = el('div.tstat' + (onClick ? '.is-link' : ''), { onclick: onClick || null },
      el('b', {}, value), el('span', {}, label));
    return node;
  }

  async function studentRow(s) {
    const [streaks, commit, cov, recent] = await Promise.all([
      Streaks.both(s.id),
      Streaks.commitment(s.id, 30),
      Entries.coverage(s.id),
      Streaks.recentSalah(s.id, 10)
    ]);

    return el('article.studentcard', { onclick: () => Router.go('/t/student/' + s.id) },
      el('div.studentcard-head', {},
        UI.avatar(s, 46),
        el('div.studentcard-id', {},
          el('b', {}, s.name,
            s.selfSignup ? UI.badge(T('newStudent'), 'gold') : null),
          el('small', {}, ProgramDays.levelName(s) + ' · ' + (s.lastActiveAt
            ? U.relativeDay(U.dateKey(new Date(s.lastActiveAt)))
            : T('never')))),
        UI.ring(cov.percent, { size: 46, stroke: 5, label: U.num(cov.percent) })),

      el('div.studentcard-metrics', {},
        metric('fire', U.num(streaks.salah.current), T('salahStreak'), 'var(--teal-300)'),
        metric('fire', U.num(streaks.memo.current), T('memoStreak'), 'var(--gold-400)'),
        metric('check', U.num(commit.salahRate) + '٪', T('salahRate'), 'var(--teal-200)'),
        metric('book', U.num(cov.pages), T('pages'), 'var(--gold-300)')),

      UI.dotRow(recent, 'var(--teal-300)'));
  }

  const metric = (iconName, value, label, color) =>
    el('div.metric', { style: { '--metric-color': color } },
      UI.icon(iconName, 15), el('b', {}, value), el('span', {}, label));

  /* ══════════════════ STUDENT DETAIL ════════════════════ */
  Router.register('/t/student/:id', {
    role: 'teacher', back: '/t/students',
    title: () => T('overview'),
    render: renderStudentDetail
  });

  async function renderStudentDetail(params) {
    const s = await Users.byId(params.id);
    if (!s) return UI.empty('الطالب غير موجود');

    /* اسحب كل تقارير الطالب من السحابة قبل أي حساب (نتيجة/تغطية/دخول).
       المحلي وحده قد يتأخر فلا تظهر النتائج الحقيقية. */
    if (window.Sync) {
      await window.Sync.pullAllReportsForStudent(s.id);
      if (Session.user && Session.user.role === 'teacher') {
        const me = Session.user;
        const roster = await window.Sync.pullTeacherRoster(me.id);
        const fresh = roster.find(r => r.id === s.id);
        if (fresh) Object.assign(s, fresh);
      }
    }

    const page = UI.screen();

    /* header */
    page.appendChild(el('div.hero', {},
      el('div.hero-text', {},
        el('p.hero-hello', {}, s.name),
        el('p.hero-date', {}, s.lastActiveAt
          ? T('lastActive') + ': ' + U.relativeDay(U.dateKey(new Date(s.lastActiveAt)))
          : T('never'))),
      UI.avatar(s, 48)));

    page.appendChild(el('div.rowbtns', {},
      UI.button(T('tabProgram'), () => Router.go('/t/program/' + s.id), 'ghost', { icon: 'star' }),
      UI.button(T('resultDetails'), () => ResultsView.detailSheet(s), 'ghost', { icon: 'chart' }),
      UI.button(T('salahTree'), () => Router.go('/t/tree/' + s.id), 'ghost', { icon: 'tree' }),
      UI.button(T('adhkarPage'), () => Router.go('/t/adhkar/' + s.id), 'ghost', { icon: 'heart' }),
      UI.button(T('sendMotivation'), () => openMotivationSheet(s.id), 'ghost', { icon: 'heart' }),
      UI.button(T('studentTargets'), () => openTargetsSheet(s), 'ghost', { icon: 'star' }),
      UI.button(T('setGoal'), () => openGoalFor(s), 'ghost', { icon: 'star' }),
      UI.button(T('editStudent'), () => openStudentSheet(s), 'ghost', { icon: 'edit' })));

    /* ── نتيجة الفصل ──────────────────────────────────── */
    const score = await Score.forUser(s.id);
    page.appendChild(UI.card([
      UI.sectionTitle(T('myResult'),
        UI.button(T('resultDetails'), () => ResultsView.detailSheet(s), 'ghost')),
      el('div.cov', {},
        UI.ring(score.percent, {
          size: 84, label: U.num(score.total), sub: T('outOf', U.num(score.outOf))
        }),
        el('div.cov-figures', {},
          figure(U.num(score.submitted), 'تقرير'),
          figure(U.num(score.days), 'يوم متابعة'),
          figure(U.num(score.nahw.done), 'حلقة نحو')))
    ], 'card--cov'));

    /* streaks */
    const streaks = await Streaks.both(s.id);
    const [recS, recM] = await Promise.all([
      Streaks.recentSalah(s.id, 14), Streaks.recentMemo(s.id, 14)
    ]);
    page.appendChild(el('div.streak-row', {},
      el('div.streak-wrap', {},
        UI.streakCard(streaks.salah, T('salahStreak'), 'var(--teal-300)'),
        UI.dotRow(recS, 'var(--teal-300)')),
      el('div.streak-wrap', {},
        UI.streakCard(streaks.memo, T('memoStreak'), 'var(--gold-400)'),
        UI.dotRow(recM, 'var(--gold-400)'))));

    /* goal */
    const goal = await Goals.activeFor(s.id);
    const prog = await Goals.progress(goal);
    page.appendChild(UI.card([
      UI.sectionTitle(T('yourGoal'),
        UI.button(goal ? T('edit') : T('setGoal'), () => openGoalFor(s), 'ghost')),
      goal
        ? el('div.goal', {},
            UI.ring(prog.percent, { size: 84, label: U.num(prog.percent) + '٪' }),
            el('div.goal-info', {},
              el('h3', {}, goal.title),
              el('p.goal-line', {}, T('goalProgress', U.num(prog.done), U.num(prog.target),
                (CONFIG.goalUnits.find(u => u.id === goal.unit) || {}).name)),
              prog.daysLeft !== null
                ? el('p.goal-sub', {}, T('daysLeft', U.num(prog.daysLeft))) : null))
        : UI.empty(T('noGoal'))
    ], 'card--goal'));

    /* coverage — مجموع الحفظ الحقيقي من التقارير السحابية (بالصفحات).
       لا نعتمد على Entries.coverage لأن سجلات شاشة المعلّم مشتقة
       وقد لا تعكس مقدار التغطية الفعلي. */
    const memReports = await Reports.forUser(s.id);
    const totalPages = U.sum(memReports, r => +(r.quran.memorized || 0));
    const totalReviewed = U.sum(memReports, r => +(r.quran.reviewed || 0));
    const percent = U.pct(totalPages, QURAN.TOTAL_PAGES || 604);
    page.appendChild(UI.card([
      UI.sectionTitle(T('totalMemorized')),
      el('div.cov', {},
        UI.ring(percent, { size: 92, label: U.num(totalPages) + ' ص', sub: 'من المصحف' }),
        el('div.cov-figures', {},
          figure(U.num(totalPages), T('pages')),
          figure(U.num(totalReviewed), 'مراجعة'),
          figure(U.num(memReports.filter(r => r.submitted).length), 'تقرير مُرسل')))
    ], 'card--cov'));

    /* entries */
    const entries = await Entries.forUser(s.id);
    const listHost = el('div.entries');
    page.appendChild(UI.card([UI.sectionTitle(T('myEntries')), listHost]));

    if (!entries.length) listHost.appendChild(UI.empty(T('empty')));
    else {
      const byDay = U.groupBy(entries, e => e.date);
      Object.keys(byDay).sort().reverse().slice(0, 30).forEach(day => {
        listHost.appendChild(el('h3.day-head', {}, U.relativeDay(day)));
        byDay[day].forEach(e =>
          listHost.appendChild(reviewableRow(e, s)));
      });
    }

    /* danger zone */
    page.appendChild(el('div.dangerzone', {},
      UI.button(T('removeStudent'), async () => {
        if (!await UI.confirm(T('removeStudentWarn'), { danger: true, confirmLabel: T('delete') })) return;
        await Users.remove(s.id);
        UI.toast(T('deleted'));
        Router.go('/t/students');
      }, 'danger', { icon: 'trash' })));

    return page;
  }

  const figure = (value, label) =>
    el('div.figure', {}, el('b', {}, value), el('span', {}, label));

  function gauge(label, percent, color) {
    return el('div.gauge', {},
      el('div.gauge-head', {}, el('span', {}, label), el('b', {}, U.num(percent) + '٪')),
      UI.bar(percent, color));
  }

  /* ══════════════════ تقارير اليوم ══════════════════════
     كل طلاب الحلقة في يوم واحد: من أرسل ومن لم يرسل، وقيام
     الليل الذي لا يظهر لهم.
     ═══════════════════════════════════════════════════════ */
  Router.register('/t/day', {
    role: 'teacher',
    title: () => T('reportsInbox'),
    render: () => renderDay(ProgramDays.isProgramDay(U.todayKey())
      ? U.todayKey() : ProgramDays.lastProgramDay(U.todayKey()))
  });

  Router.register('/t/day/:date', {
    role: 'teacher', back: '/t/day',
    title: () => T('reportsInbox'),
    render: p => renderDay(p.date)
  });

  async function renderDay(date) {
    const me = Session.user;
    const page = UI.screen();
    const isQiyamDay = ProgramDays.isQiyamDay(date);
    if (window.Sync) await window.Sync.pullReportsForTeacher(me.id);
    const students = await Users.students(me.id);
    // تحديث لحظي كل 30ث — يُلغى عند مغادرة الصفحة عبر hashchange/visibility
    const timer = setInterval(async () => {
      if (!document.contains(page) || !(location.hash === '#/t/day' || location.hash.startsWith('#/t/day/'))) {
        clearInterval(timer); return;
      }
      if (document.visibilityState !== 'visible') return;
      if (window.Sync) { await window.Sync.pullReportsForTeacher(me.id); Router.render(); }
    }, 30000);
    const stopTimer = () => clearInterval(timer);
    window.addEventListener('hashchange', stopTimer, { once: true });
    page.addEventListener('DOMNodeRemoved', stopTimer, { once: true });

    page.appendChild(el('div.report-head', {},
      el('div', {},
        el('h2.report-day', {}, ProgramDays.dayName(date)),
        el('p.report-date', {}, U.formatDate(date))),
      UI.button('تحديث', async () => {
        if (window.Sync) await window.Sync.pullReportsForTeacher(me.id);
        Router.render();
      }, 'ghost', { icon: 'refresh' })));

    page.appendChild(dayStrip(date));

    if (!ProgramDays.isProgramDay(date)) {
      page.appendChild(UI.card([UI.empty(T('notProgramDay') + ' — ' + T('programDaysAre'))]));
      return page;
    }

    if (!students.length) { page.appendChild(UI.empty(T('empty'))); return page; }

    const recs = await Promise.all(students.map(s => Reports.get(s.id, date)));
    const list = el('div.daylist');
    students.forEach((s, idx) => {
      const rec = recs[idx];
      const targets = Object.assign({}, PROGRAM.targets, s.targets || {});
      const parts = Reports.scoreDay(rec, targets);
      const dayItems = Reports.dayItems(date, { includePrivate: true });
      const done = dayItems.filter(i => (parts[i.key] || 0) >= 1).length;
      const row = el('article.dayrow-student' + (rec.submitted ? '.is-in' : ''), {});
      row.appendChild(el('div.dayrow-main', {
        onclick: () => Router.go(`/t/report/${s.id}/${date}`)
      },
        UI.avatar(s, 40),
        el('div.dayrow-id', {},
          el('b', {}, s.name),
          el('small', {}, rec.submitted
            ? `${T('tasksDone', U.num(done), U.num(dayItems.length))} · ` +
              `حفظ ${U.num(rec.quran.memorized)} · مراجعة ${U.num(rec.quran.reviewed)}`
            : 'لم يرسل تقريره')),
        el('div.report-pips', {}, dayItems.map(i => {
          const v = parts[i.key] || 0;
          return el('i.pip' + (v >= 1 ? '.on' : (v > 0 ? '.half' : '')) +
                    (i.private ? '.pip--private' : ''), { title: i.name });
        }))));
      if (isQiyamDay) {
        row.appendChild(el('button.qiyam-toggle' + (rec.qiyam ? '.is-on' : ''), {
          type: 'button', title: T('qiyam'),
          onclick: async ev => {
            const btn = ev.currentTarget;
            const next = !rec.qiyam;
            const prev = rec.qiyam;
            rec.qiyam = next; btn.classList.toggle('is-on', next);
            try { await Reports.save(s.id, date, { qiyam: next }); }
            catch (e) { rec.qiyam = prev; btn.classList.toggle('is-on', prev); UI.toast('تعذر الحفظ', 'warn'); }
          }
        }, UI.icon('moon', 16), el('span', {}, T('qiyam'))));
      }
      list.appendChild(row);
    });
    page.appendChild(list);

    const submitted = (await Reports.submittedOn(date)).length;
    page.appendChild(el('p.hint', {},
      `وصل ${U.num(submitted)} من ${U.num(students.length)} تقرير` +
      (isQiyamDay ? ` · ${T('qiyam')}: ${T('qiyamPrivate')}` : '')));

    return page;
  }

  /* أيام المتابعة في أسبوع التاريخ المعروض. */
  function dayStrip(date) {
    const days = ProgramDays.daysOfWeek(ProgramDays.weekKey(date));
    const today = U.todayKey();
    return el('div.weekstrip', {}, days.map(d =>
      el('a.weekday' + (d === date ? '.is-current' : '') + (d > today ? '.is-future' : ''), {
        href: d > today ? undefined : '#/t/day/' + d,
        onclick: d > today ? (e => e.preventDefault()) : null
      },
        el('b', {}, ProgramDays.dayName(d)),
        el('span', {}, U.num(U.parseKey(d).getDate())))));
  }

  /* ══════════════════ REVIEW INBOX ══════════════════════ */
  Router.register('/t/inbox', {
    role: 'teacher',
    title: () => T('inbox'),
    render: renderInbox
  });

  async function renderInbox() {
    const me = Session.user;
    const page = UI.screen();
    const pending = await Entries.pending(me.id);

    page.appendChild(UI.sectionTitle(T('reviewQueue', U.num(pending.length))));

    if (!pending.length) {
      page.appendChild(UI.empty(T('noPending')));
      return page;
    }

    const students = await Users.students(me.id);
    const byId = new Map(students.map(s => [s.id, s]));
    const list = el('div.entries');
    pending.forEach(e => list.appendChild(reviewableRow(e, byId.get(e.userId))));
    page.appendChild(list);
    return page;
  }

  /* An entry row with the teacher's review controls attached. */
  function reviewableRow(e, student) {
    const surah = QURAN.get(e.surah) || { name: '؟' };
    const type = CONFIG.memorization.types.find(t => t.id === e.type) || {};
    const status = CONFIG.memorization.statuses.find(x => x.id === e.status) || {};
    const grade = e.grade && CONFIG.memorization.grades.find(g => g.id === e.grade);

    const row = el('article.entry.entry--review', {
      style: { '--entry-color': type.color || 'var(--accent)' }
    });

    row.appendChild(el('div.entry-main', {},
      el('div.entry-head', {},
        student ? el('span.entry-student', {}, student.name) : null,
        el('b.entry-surah', {}, surah.name),
        el('span.entry-range', {}, `${U.num(e.from)} – ${U.num(e.to)}`),
        UI.badge(type.name || '', 'soft')),
      el('p.entry-sub', {},
        U.relativeDay(e.date) + ' · ' +
        (e.derivedPages
          ? `${U.num(e.derivedPages)} صفحة`
          : T('pagesApprox', U.num(QURAN.pagesOf(e.surah, e.from, e.to))))),
      e.notes ? el('p.entry-notes', {}, e.notes) : null,
      e.teacherComment
        ? el('div.entry-comment', {}, el('b', {}, T('teacherComment') + ': '), el('span', {}, e.teacherComment))
        : null,
      el('div.entry-review', {},
        e.voiceId ? StudentView.voiceButton(e.voiceId) : el('span.hint', {}, 'بدون تسجيل'),
        UI.button(T('approve'), () => review(e, 'approved'), 'ok', { icon: 'check' }),
        UI.button(T('requestRedo'), () => review(e, 'redo'), 'ghost'),
        StudentView.deleteEntryButton(e))));

    const side = el('div.entry-side');
    if (grade) side.appendChild(UI.stars(grade.stars));
    side.appendChild(el('span.entry-status', { style: { color: status.color } }, status.name || ''));
    row.appendChild(side);
    return row;
  }

  async function review(entry, status) {
    let grade = entry.grade || 'good';
    let comment = entry.teacherComment || '';

    const body = el('div.form');
    body.appendChild(UI.field(T('grade'),
      UI.chips(CONFIG.memorization.grades.map(g => ({ value: g.id, label: g.name, color: g.color })),
        grade, v => { grade = v; })));

    const ta = el('textarea.input', { rows: 3, placeholder: T('writeComment') });
    ta.value = comment;
    ta.addEventListener('input', () => { comment = ta.value; });
    body.appendChild(UI.field(T('teacherComment'), ta));

    UI.sheet({
      title: status === 'approved' ? T('approve') : T('requestRedo'),
      body,
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: status === 'approved' ? 'primary' : 'danger', onClick: async a => {
            await Entries.review(entry.id, {
              status, grade, teacherComment: comment, reviewedBy: Session.user.id
            });
            a.close();
            UI.toast(T('saved'));
            Router.refreshTabs();
            Router.render();
          } }
      ]
    });
  }

  /* ══════════════════ MOTIVATION ════════════════════════ */
  Router.register('/t/motivation', {
    role: 'teacher',
    title: () => T('sendMotivation'),
    actions: () => [UI.iconButton('plus', () => openMotivationSheet(), { label: T('add') })],
    render: renderMotivation
  });

  async function renderMotivation() {
    const me = Session.user;
    const page = UI.screen();
    const list = await Motivations.byTeacher(me.id);
    const students = await Users.students(me.id);
    const byId = new Map(students.map(s => [s.id, s]));

    page.appendChild(el('p.hint', {},
      'تظهر هذه الكلمات في صفحة الطالب. الكلمة المثبّتة تظهر دائمًا، وغيرها تتناوب يومًا بعد يوم.'));

    if (!list.length) {
      page.appendChild(UI.empty('لم ترسل أي كلمة بعد',
        UI.button(T('sendMotivation'), () => openMotivationSheet(), 'primary', { icon: 'heart' })));
    } else {
      const host = el('div.motivations');
      list.forEach(m => {
        host.appendChild(el('article.motivation' + (m.pinned ? '.is-pinned' : ''), {},
          el('blockquote.quote', {},
            el('p.quote-text', {}, m.text),
            m.source ? el('cite.quote-src', {}, m.source) : null),
          el('div.motivation-meta', {},
            UI.badge(m.studentId ? (byId.get(m.studentId) || {}).name || '—' : T('allStudents'),
              m.studentId ? 'soft' : 'gold'),
            UI.badge((m.when || 'home') === 'report' ? T('whenReport') : T('whenHome'), 'neutral'),
            el('span.hint', {}, `${T('done')}: ${U.num(m.seenBy.length)}`),
            UI.iconButton('star', async () => {
              await Motivations.update(m.id, { pinned: !m.pinned });
              Router.render();
            }, { label: 'تثبيت', active: m.pinned }),
            UI.iconButton('edit', () => openMotivationSheet(m.studentId, m), { label: T('edit') }),
            UI.iconButton('trash', async () => {
              if (!await UI.confirm(T('confirmDelete'), { danger: true })) return;
              await Motivations.remove(m.id); UI.toast(T('deleted')); Router.render();
            }, { label: T('delete') }))));
      });
      page.appendChild(host);
    }

    page.appendChild(el('div.fab-space'));
    page.appendChild(el('button.fab', {
      type: 'button', onclick: () => openMotivationSheet(), 'aria-label': T('add')
    }, UI.icon('plus', 26)));
    return page;
  }

  async function openMotivationSheet(studentId, existing) {
    const me = Session.user;
    const students = await Users.students(me.id);
    let target = existing ? existing.studentId : (studentId || null);
    let text = existing ? existing.text : '';
    let source = existing ? existing.source : '';
    let when = existing ? (existing.when || 'home') : 'report';

    const body = el('div.form');

    body.appendChild(UI.field(T('motivationTo'), UI.select(
      [{ value: '', label: T('allStudents') }]
        .concat(students.map(s => ({ value: s.id, label: s.name }))),
      target || '', v => { target = v || null; })));

    body.appendChild(UI.field(T('motivationWhen'), UI.chips([
      { value: 'report', label: T('whenReport') },
      { value: 'home',   label: T('whenHome') }
    ], when, v => { when = v; })));

    const ta = el('textarea.input.input--quote', { rows: 3, placeholder: 'اكتب كلمتك…' });
    ta.value = text;
    ta.addEventListener('input', () => { text = ta.value; });
    body.appendChild(UI.field(T('motivationText'), ta));

    const src = UI.input({ placeholder: 'المصدر — اختياري' });
    src.value = source;
    src.addEventListener('input', () => { source = src.value; });
    body.appendChild(UI.field('المصدر', src, T('optional')));

    /* Ready-made phrases, so a busy teacher can send in one tap. */
    body.appendChild(UI.field('كلمات جاهزة', el('div.chips', {},
      CONFIG.defaultMotivation.slice(0, 5).map(d =>
        el('button.chip', { type: 'button', onclick: () => {
          ta.value = d.text; text = d.text; src.value = d.source; source = d.source;
        } }, d.text.slice(0, 22) + '…')))));

    UI.sheet({
      title: existing ? T('edit') : T('sendMotivation'),
      body, wide: true,
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            if (!text.trim()) return UI.toast('اكتب نص الكلمة أولًا', 'warn');
            if (existing) await Motivations.update(existing.id,
              { text, source, studentId: target, when });
            else await Motivations.create(
              { teacherId: me.id, studentId: target, text, source, when });
            a.close(); UI.toast(T('motivationSent'));
            if (Router.path().startsWith('/t/motivation')) Router.render();
          } }
      ]
    });
  }

  /* ── تم نقل /t/reports إلى reports-dashboard.js (السحابة كمصدر حقيقة) ──
     هذه الصفحة المحلية القديمة أصبحت /t/overview */
  Router.register('/t/overview', {
    role: 'teacher',
    title: () => T('tabReports'),
    render: renderReports
  });

  async function renderReports() {
    const me = Session.user;
    const page = UI.screen();
    const students = await Users.students(me.id);

    if (!students.length) { page.appendChild(UI.empty(T('empty'))); return page; }

    const rows = [];
    for (const s of students) {
      const [commit, cov, streaks] = await Promise.all([
        Streaks.commitment(s.id, 30), Entries.coverage(s.id), Streaks.both(s.id)
      ]);
      rows.push({ s, commit, cov, streaks });
    }

    /* class averages */
    const avg = k => Math.round(U.sum(rows, r => r.commit[k]) / rows.length);
    page.appendChild(UI.card([
      UI.sectionTitle(T('classSummary') + ' — ٣٠ يومًا'),
      el('div.metrics', {},
        gauge(T('salahRate'), avg('salahRate'), 'var(--teal-300)'),
        gauge(T('memoRate'), avg('memoRate'), 'var(--gold-400)'),
        gauge('الفروض', avg('fardRate'), 'var(--teal-200)')),
      el('p.hint', {}, `${T('topStudent')}: ` +
        rows.slice().sort((a, b) =>
          (b.commit.salahRate + b.commit.memoRate) - (a.commit.salahRate + a.commit.memoRate)
        )[0].s.name)
    ]));

    /* ranking table */
    const table = el('div.rank');
    table.appendChild(el('div.rank-row.rank-head', {},
      el('span', {}, T('studentName')),
      el('span', {}, T('salahRate')),
      el('span', {}, T('memoRate')),
      el('span', {}, T('pages'))));

    rows.sort((a, b) => b.cov.pages - a.cov.pages).forEach(r => {
      table.appendChild(el('div.rank-row', { onclick: () => Router.go('/t/student/' + r.s.id) },
        el('span.rank-name', {}, UI.avatar(r.s, 28), r.s.name),
        el('span', {}, U.num(r.commit.salahRate) + '٪'),
        el('span', {}, U.num(r.commit.memoRate) + '٪'),
        el('span', {}, U.num(r.cov.pages))));
    });
    page.appendChild(UI.card([UI.sectionTitle(T('students')), table]));

    page.appendChild(el('div.rowbtns', {},
      UI.button('تصدير تقرير الحلقة', exportReport, 'ghost', { icon: 'share' }),
      UI.button(T('recitersPage'), () => Router.go('/t/reciters'), 'ghost', { icon: 'mic' }),
      UI.button(T('adhkarPage'), () => Router.go('/adhkar'), 'ghost', { icon: 'heart' }),
      UI.button(T('tabListen'), () => Router.go('/t/listen'), 'ghost', { icon: 'play' })));

    async function exportReport() {
      const lines = ['الطالب,نسبة الصلاة,انتظام الحفظ,الصفحات,سلسلة الصلاة,سلسلة الحفظ'];
      rows.forEach(r => lines.push([
        r.s.name, r.commit.salahRate, r.commit.memoRate,
        r.cov.pages, r.streaks.salah.current, r.streaks.memo.current
      ].join(',')));
      /* BOM so Excel opens the Arabic correctly. */
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      U.download(`تقرير-الحلقة-${U.todayKey()}.csv`, blob);
      UI.toast(T('exported'));
    }

    return page;
  }

  /* ══════════════════ STUDENT EDITOR ════════════════════ */
  async function openStudentSheet(existing) {
    const me = Session.user;
    let name = existing ? existing.name : '';
    let pin = existing ? existing.pin : '';

    const body = el('div.form');
    const nameIn = UI.input({ placeholder: 'الاسم الكامل', value: name });
    nameIn.addEventListener('input', () => { name = nameIn.value; });
    body.appendChild(UI.field(T('studentName'), nameIn));

    const pinIn = UI.input({
      type: 'text', inputmode: 'numeric', maxlength: 4,
      placeholder: '١٢٣٤', value: pin
    });
    pinIn.addEventListener('input', () => {
      pinIn.value = pinIn.value.replace(/\D/g, '').slice(0, 4);
      pin = pinIn.value;
    });
    body.appendChild(UI.field(T('studentPin'), pinIn, T('pinLength') + ' — ' + T('optional')));

    let level = existing ? (existing.level || PROGRAM.defaultLevel) : PROGRAM.defaultLevel;
    body.appendChild(UI.field(T('chooseLevel'), UI.chips(
      PROGRAM.levels.map(l => ({ value: l.id, label: `${l.name} — ${l.sub}` })),
      level, v => { level = +v; }), T('levelHint')));

    /* رمز الدخول — به يدخل الطالب دون أن تُعرض الأسماء. */
    if (existing) {
      const codeBox = el('div.codebox', {},
        el('b.codebox-code', {}, existing.code || '—'),
        UI.iconButton('share', async () => {
          const text = `${T('loginCode')}: ${existing.code}` +
                       (existing.pin ? `\n${T('studentPin')}: ${existing.pin}` : '');
          try {
            if (navigator.share) await navigator.share({ text, title: CONFIG.app.name });
            else { await navigator.clipboard.writeText(text); UI.toast(T('copied')); }
          } catch (e) { /* المستخدم ألغى المشاركة */ }
        }, { label: T('shareCode') }),
        UI.iconButton('repeat', async () => {
          const all = await DB.all('users');
          const fresh = Users.makeCode(all);
          await Users.update(existing.id, { code: fresh });
          existing.code = fresh;
          codeBox.querySelector('.codebox-code').textContent = fresh;
          UI.toast(T('codeRenewed'));
        }, { label: T('renewCode') }));
      body.appendChild(UI.field(T('loginCode'), codeBox, T('loginCodeTeacherHint')));

      if (CONFIG.auth.googleClientId) {
        const gmailIn = UI.input({
          type: 'email', dir: 'ltr', value: existing.googleEmail || '',
          placeholder: 'name@gmail.com'
        });
        gmailIn.addEventListener('input', () => { draftEmail = gmailIn.value.trim(); });
        body.appendChild(UI.field(T('googleEmail'), gmailIn, T('googleEmailHint')));
      }
    }
    let draftEmail = existing ? (existing.googleEmail || '') : '';

    UI.sheet({
      title: existing ? T('editStudent') : T('addStudent'),
      body,
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            if (!name.trim()) return UI.toast('اكتب اسم الطالب', 'warn');
            if (existing) await Users.update(existing.id, {
              name: name.trim(), pin, level, googleEmail: draftEmail || null,
              selfSignup: false
            });
            else {
              const created = await Users.create({
                name, role: 'student', pin, level, teacherId: me.id });
              UI.toast(T('studentCreated', created.code), 'ok', 5000);
            }
            a.close(); Router.render();
          } }
      ]
    });
  }

  /* The goal editor is the same one the student sees, pointed at
     this student instead. One editor, one set of rules. */
  async function openGoalFor(student) {
    const current = await Goals.activeFor(student.id);
    StudentView.openGoalSheet(current, student);
  }

  /* ── مقادير خاصة بطالب ────────────────────────────────
     الحدود الدنيا في PROGRAM.targets تصلح للجميع؛ وهذه ترفعها
     لطالب بعينه دون أن تمسّ غيره. */
  async function openTargetsSheet(student) {
    const current = Object.assign({}, PROGRAM.targets, student.targets || {});
    const draft = Object.assign({}, current);

    const body = el('div.form');
    body.appendChild(el('p.hint', {}, T('targetsHint')));

    const rows = [
      ['quranMemorize', 'حفظ القرآن', 'صفحة', 0.25],
      ['quranReview',   'مراجعة القرآن', 'صفحة', 0.5],
      ['poetryVerses',  'أبيات الشعر', 'بيت', 1],
      ['readingMinutes','دقائق القراءة', 'دقيقة', 5]
    ];
    rows.forEach(([key, name, unit, step]) => {
      body.appendChild(UI.field(name, UI.stepper(draft[key], {
        step, min: 0, max: 500, unit,
        onChange: v => { draft[key] = v; }
      })));
    });

    UI.sheet({
      title: T('studentTargets') + ' — ' + student.name, body, wide: true,
      actions: [
        { label: 'إعادة الافتراضي', kind: 'ghost', onClick: async a => {
            await Users.update(student.id, { targets: null });
            a.close(); UI.toast(T('saved')); Router.render();
          } },
        { label: T('save'), kind: 'primary', onClick: async a => {
            await Users.update(student.id, { targets: draft });
            a.close(); UI.toast(T('saved')); Router.render();
          } }
      ]
    });
  }

  window.TeacherView = {
    openStudentSheet, openMotivationSheet, openGoalFor, openTargetsSheet
  };
})();
