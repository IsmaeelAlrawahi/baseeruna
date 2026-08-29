/* ============================================================
   بصائرنا — المسار

   الفصل طريقٌ يمشي فيه الطالب: كل أسبوع مرحلة، وكل يوم متابعة
   محطّة عليها. تُفتح المحطّة حين يبلغها يومها، وتُضيء حين يتمّ
   ما عليه فيها.

   المحطّة الفائتة لا تُقفل — للطالب أن يعود فيكتب تقريرها.
   ============================================================ */

(function () {
  const { el } = U;

  /* يبني المسار كاملًا؛ تستدعيه الصفحة الرئيسية. */
  async function build(userId) {
    const term = await Term.get();
    const today = U.todayKey();
    const reports = await Reports.range(userId, term.start, term.end);
    const byDate = new Map(reports.map(r => [r.date, r]));

    const user = await Users.byId(userId);
    const targets = Object.assign({}, PROGRAM.targets, (user && user.targets) || {});
    const nahwRows = await Nahw.forUser(userId);
    const nahwDone = new Set(nahwRows.filter(r => r.done).map(r => r.lesson));

    const wrap = el('div.path');

    /* أسابيع الفصل */
    const weeks = [];
    let w = ProgramDays.weekKey(term.start);
    let guard = 0;
    while (w <= term.end && guard++ < 60) {
      weeks.push(w);
      w = U.addDays(w, 7);
    }

    const currentWeek = ProgramDays.weekKey(today);
    let stepIndex = 0;

    /* مسار الطالب مسارُه هو، فتدخل فيه بنوده كلها.
       ويُعرَّف قبل الحلقة لا بعد `return`: الدوال تُرفع أما `const`
       فلا، فقراءتُه قبل سطره تُسقط الصفحة كلها. */
    const OWN = { includePrivate: true };

    weeks.forEach((weekKey, wi) => {
      const days = ProgramDays.daysOfWeek(weekKey).filter(d => d <= term.end);
      if (!days.length) return;

      const lesson = U.clamp(wi + 1, 1, PROGRAM.nahw.lessons);
      const isCurrent = weekKey === currentWeek;
      const weekDone = days.every(d => dayState(d) === 'done');

      /* ── لافتة الأسبوع ─────────────────────────────── */
      wrap.appendChild(el('div.path-unit' + (isCurrent ? '.is-current' : '') +
                          (weekDone ? '.is-done' : ''), {},
        el('div.path-unit-text', {},
          el('b', {}, T('weekNo', U.num(wi + 1))),
          el('span', {}, U.formatDateShort(weekKey))),
        el('a.path-unit-lesson' + (nahwDone.has(lesson) ? '.is-done' : ''), {
          href: '#/program', title: T('nahw')
        }, UI.icon(nahwDone.has(lesson) ? 'check' : 'book', 15),
           el('span', {}, T('nahwLesson', U.num(lesson))))));

      /* ── محطّات الأسبوع ────────────────────────────── */
      days.forEach(d => {
        const state = dayState(d);
        const node = el('div.path-step.state-' + state, {
          style: { '--lean': lean(stepIndex) }
        });
        stepIndex++;

        const btn = el('button.path-node', {
          type: 'button',
          disabled: state === 'locked',
          'aria-label': `${ProgramDays.dayName(d)} ${U.formatDateShort(d)}`,
          onclick: () => Router.go('/report/' + d)
        },
          el('span.path-node-face', {},
            state === 'done' ? UI.icon('star', 22)
              : state === 'today' ? UI.icon('check', 20)
              : state === 'partial' ? el('b', {}, U.num(doneCount(d)))
              : state === 'missed' ? UI.icon('x', 16)
              : UI.icon('clock', 16)));

        node.append(btn, el('span.path-label', {},
          el('b', {}, ProgramDays.dayName(d)),
          el('small', {}, U.num(U.parseKey(d).getDate()))));

        if (state === 'today') node.appendChild(el('span.path-here', {}, T('youAreHere')));
        wrap.appendChild(node);
      });
    });

    /* ── نهاية الطريق ─────────────────────────────────── */
    wrap.appendChild(el('div.path-end', {},
      el('span.path-trophy', {}, UI.icon('star', 26)),
      el('b', {}, T('endOfTerm')),
      el('span', {}, U.formatDateShort(term.end))));

    return wrap;

    /* ── الحالات ──────────────────────────────────────── */
    function doneCount(d) {
      const rec = byDate.get(d);
      return rec ? Reports.countDone(rec, targets, OWN) : 0;
    }

    function dayState(d) {
      if (d > today) return 'locked';
      const n = doneCount(d);
      if (n === Reports.dayItems(d, OWN).length) return 'done';
      if (d === today) return n > 0 ? 'partial-today' : 'today';
      return n > 0 ? 'partial' : 'missed';
    }

    /* ميلان المحطّة يمينًا وشمالًا ليصير الطريق متعرّجًا. */
    function lean(i) {
      const amp = 62;
      return Math.round(Math.sin(i * 0.9) * amp) + 'px';
    }
  }

  /* شريط تقدّم مختصر: كم محطّة أُتمّت من الفصل. */
  async function summary(userId) {
    const term = await Term.get();
    const today = U.todayKey();
    const to = today < term.end ? today : term.end;
    const days = ProgramDays.daysBetween(term.start, to);
    const reports = await Reports.range(userId, term.start, to);
    const byDate = new Map(reports.map(r => [r.date, r]));
    const user = await Users.byId(userId);
    const targets = Object.assign({}, PROGRAM.targets, (user && user.targets) || {});

    let done = 0;
    days.forEach(d => {
      const rec = byDate.get(d);
      if (rec && Reports.isComplete(rec, targets, { includePrivate: true })) done++;
    });

    const all = ProgramDays.daysBetween(term.start, term.end);
    return { done, elapsed: days.length, total: all.length,
             percent: U.pct(done, Math.max(1, days.length)) };
  }

  window.PathView = { build, summary };
})();
