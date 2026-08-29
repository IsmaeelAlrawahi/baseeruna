/* ============================================================
   بصائرنا — the student's home and memorization log
   ============================================================ */

(function () {
  const { el } = U;

  /* ══════════════════ HOME ══════════════════════════════ */
  Router.register('/home', {
    role: 'student',
    title: () => T('tabHome'),
    render: renderHome
  });

  async function renderHome() {
    const me = Session.user;
    const page = UI.screen();

    /* ── greeting ─────────────────────────────────────── */
    const hour = new Date().getHours();
    page.appendChild(el('div.hero', {},
      el('div.hero-text', {},
        el('p.hero-hello', {}, (hour < 12 ? T('greetingMorning') : T('greetingEvening')) + '، ' + me.name),
        el('p.hero-date', {}, U.formatDate(U.todayKey())),
        el('p.hero-date-g', {}, U.isHijri()
          ? U.formatGregorian(U.todayKey())
          : U.hijri(new Date()))),
      UI.avatar(me, 48)));

    /* ── تقدّم الفصل والسلاسل ─────────────────────────── */
    const [pathSum, streaks] = await Promise.all([
      PathView.summary(me.id), Streaks.both(me.id)
    ]);
    page.appendChild(el('div.homestats', {},
      el('div.homestat', {},
        UI.icon('star', 18),
        el('b', {}, U.num(pathSum.done)),
        el('span', {}, T('stagesDone'))),
      el('div.homestat', {},
        UI.icon('fire', 18),
        el('b', {}, U.num(streaks.memo.current)),
        el('span', {}, T('memoStreak'))),
      el('div.homestat', {},
        UI.icon('tree', 18),
        el('b', {}, U.num(streaks.salah.current)),
        el('span', {}, T('salahStreak')))));

    /* ── شعار الأسبوع — أول ما يقع عليه بصره ──────────── */
    page.appendChild(await MoreView.mottoCard(me.id, false));

    /* ── تقرير اليوم ──────────────────────────────────── */
    page.appendChild(await todayReportCard(me));

    /* ── الهدف ونصيب اليوم منه ────────────────────────── */
    const goal = await Goals.activeFor(me.id);
    const prog = await Goals.progress(goal);
    page.appendChild(goalCard(goal, prog));
    if (goal) {
      const daily = await Goals.dailyPlan(goal, prog);
      if (daily) page.appendChild(dailyCard(goal, prog, daily));
    }

    /* ── حال الطلبة ───────────────────────────────────── */
    page.appendChild(await StatusView.homeCard(me.id));

    /* ── a word from the teacher ──────────────────────── */
    page.appendChild(await motivationCard(me));

    /* ── المسار ───────────────────────────────────────── */
    page.appendChild(UI.sectionTitle(T('thePath'),
      el('span.hint', {}, T('stagesOf', U.num(pathSum.done), U.num(pathSum.total)))));
    page.appendChild(await PathView.build(me.id));

    /* Celebrate anything earned since the last visit. */
    const fresh = (await Badges.forUser(me.id)).filter(b => !b.seen);
    if (fresh.length) setTimeout(() => UI.celebrate(fresh[0]), 600);

    return page;
  }

  const figure = (value, label) =>
    el('div.figure', {}, el('b', {}, value), el('span', {}, label));

  function goalCard(goal, prog) {
    if (!goal) {
      return UI.card([
        UI.sectionTitle(T('yourGoal')),
        UI.empty(T('noGoal'),
          UI.button(T('setGoal'), () => openGoalSheet(), 'ghost'))
      ]);
    }
    return UI.card([
      UI.sectionTitle(T('yourGoal'), el('div.head-tools', {},
        UI.iconButton('edit', () => openGoalSheet(goal), { label: T('edit') }),
        deleteGoalButton(goal))),
      el('div.goal', {},
        UI.ring(prog.percent, {
          size: 96, color: prog.complete ? 'var(--gold-400)' : 'var(--accent)',
          label: U.num(prog.percent) + '٪'
        }),
        el('div.goal-info', {},
          el('h3', {}, goal.title),
          prog.scope && prog.scope !== goal.title
            ? el('p.goal-scope', {}, prog.scope) : null,
          el('p.goal-line', {},
            T('goalProgress', U.num(prog.done), U.num(prog.target), prog.unitName)),
          prog.complete
            ? UI.badge(T('goalDone'), 'gold')
            : (prog.daysLeft !== null
                ? el('p.goal-sub', {}, prog.daysLeft >= 0
                    ? T('daysLeft', U.num(prog.daysLeft))
                    : T('overdue'))
                : null)))
    ], 'card--goal');
  }

  /* ── today's slice of the bigger goal ─────────────────── */
  function dailyCard(goal, prog, daily) {
    if (prog.complete) return el('span');

    const done = daily.doneToday;
    const card = UI.card([], 'card--daily' + (done ? ' is-done' : ''));

    card.appendChild(UI.sectionTitle(T('dailyGoal'),
      el('span.daily-day', {}, T('daysOfPlan',
        U.num(Math.min(daily.daysGone + 1, daily.daysTotal)), U.num(daily.daysTotal)))));

    card.appendChild(el('div.daily', {},
      UI.ring(daily.percentToday, {
        size: 76, stroke: 7,
        color: done ? 'var(--ok)' : 'var(--gold-400)',
        label: done ? '✓' : U.num(daily.todayDone)
      }),
      el('div.daily-info', {},
        el('b.daily-target', {}, T('dailyGoalOf', U.num(daily.perDay), daily.unitName)),
        el('p.daily-state', {}, done
          ? T('dailyDone')
          : T('dailyRemaining', U.num(daily.todayRemaining), daily.unitName)),
        el('p.daily-pace', {},
          T('dailyPace', U.num(daily.plannedPerDay), daily.unitName)))));

    /* Only say something about the pace when it is actually useful. */
    if (daily.overdue) {
      card.appendChild(el('p.hint.hint--warn', {}, T('overdue')));
    } else if (!daily.onTrack && daily.behindBy > 0) {
      card.appendChild(el('p.hint.hint--warn', {},
        T('behindBy', U.num(daily.behindBy), daily.unitName)));
    } else if (daily.daysGone > 0) {
      card.appendChild(el('p.hint.hint--ok', {}, T('onTrack')));
    }

    return card;
  }

  function deleteGoalButton(goal) {
    const btn = UI.iconButton('trash', async () => {
      const yes = await UI.confirm(T('deleteGoalAsk', goal.title), {
        title: T('deleteGoal'), danger: true, confirmLabel: T('delete')
      });
      if (!yes) return;
      await Goals.remove(goal.id);
      UI.toast(T('goalDeleted'));
      Router.render();
    }, { label: T('deleteGoal') });
    btn.classList.add('iconbtn--danger');
    return btn;
  }

  async function motivationCard(me) {
    /* Phrases meant for the report are shown there, not here. */
    const list = await Motivations.forStudent(me.id, 'home');
    const chosen = list.length
      ? (list.find(m => m.pinned) || U.pickOfDay(list, me.id))
      : U.pickOfDay(CONFIG.defaultMotivation, me.id);
    if (!chosen) return el('span');

    if (chosen.id) Motivations.markSeen(chosen.id, me.id);

    return UI.card([
      UI.sectionTitle(chosen.id ? T('wordFromTeacher') : ''),
      el('blockquote.quote', {},
        el('p.quote-text', {}, chosen.text),
        chosen.source ? el('cite.quote-src', {}, chosen.source) : null)
    ], 'card--quote');
  }

  /* ── the eight prayers of today ───────────────────────── */
  async function todaySalahCard(me) {
    const date = U.todayKey();
    const rec = await Salah.day(me.id, date);
    const host = UI.card([], 'card--salah');

    function paint() {
      U.clear(host);
      host.appendChild(UI.sectionTitle(T('todaySalah'),
        el('a.link', { href: '#/tree' }, T('salahTree'))));

      const grid = el('div.slotgrid');
      CONFIG.prayerSlots.forEach(slot => {
        const on = !!rec.slots[slot.id];
        const jama = !!rec.jamaah[slot.id];
        const btn = el('button.slot' + (on ? '.is-on' : '') + (slot.kind === 'extra' ? '.slot--extra' : ''), {
          type: 'button',
          onclick: async () => {
            const next = !rec.slots[slot.id];
            Object.assign(rec, await Salah.setSlot(me.id, date, slot.id, next));
            paint();
            if (next) afterProgress(me.id);
          }
        },
          el('span.slot-leaf', {}, leafGlyph(on, slot.kind)),
          el('span.slot-name', {}, slot.name),
          jama ? el('i.slot-jamaah', {}, T('inCongregation')) : null);

        if (CONFIG.trackCongregation && slot.kind === 'fard') {
          btn.addEventListener('contextmenu', async ev => {
            ev.preventDefault();
            Object.assign(rec, await Salah.setJamaah(me.id, date, slot.id, !jama));
            paint();
          });
        }
        grid.appendChild(btn);
      });
      host.appendChild(grid);

      const done = Salah.countFard(rec);
      const anyTicked = Object.keys(rec.slots).length > 0;

      const foot = el('div.slot-foot', {},
        el('span', {}, `${T('prayedFard')}: ${U.num(done)} / ${U.num(Salah.fardIds().length)}`),
        Salah.isComplete(rec) ? UI.badge(T('dayComplete'), 'ok') : null);

      /* Tapping a leaf again un-ticks it; this clears the lot at once. */
      if (anyTicked) {
        foot.appendChild(el('button.linkbtn.linkbtn--danger', {
          type: 'button',
          onclick: async () => {
            const yes = await UI.confirm(T('clearDayAsk', T('today')), {
              title: T('clearTodaySalah'), danger: true, confirmLabel: T('delete')
            });
            if (!yes) return;
            const restore = await Salah.clearDayUndoable(me.id, date);
            Object.assign(rec, await Salah.day(me.id, date));
            paint();
            UI.undoToast(T('dayCleared'), async () => {
              await restore();
              Object.assign(rec, await Salah.day(me.id, date));
              paint();
              UI.toast(T('dayRestored'));
            });
          }
        }, T('clearTodaySalah')));
      }

      host.appendChild(foot);
    }

    paint();
    return host;
  }

  function leafGlyph(on, kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 16');
    svg.setAttribute('width', '26'); svg.setAttribute('height', '18');
    svg.innerHTML = `<path d="M1,8 C6,1 18,0 23,8 C18,16 6,15 1,8Z"
      fill="${on ? (kind === 'extra' ? 'var(--gold-400)' : 'var(--teal-300)') : 'var(--leaf-empty)'}"
      stroke="${on ? 'transparent' : 'var(--line-strong)'}" stroke-width="1"/>
      <path d="M2,8 L22,8" stroke="rgba(0,0,0,.25)" stroke-width="1"/>`;
    return svg;
  }

  async function todayMemoCard(me) {
    const list = await Entries.forUserOnDate(me.id, U.todayKey());
    return UI.card([
      UI.sectionTitle(T('todayMemo'),
        UI.button(T('addEntry'), () => openEntrySheet(), 'primary', { icon: 'plus' })),
      list.length
        ? el('div.entries', {}, list.map(e => entryRow(e, { compact: true })))
        : UI.empty('لم تسجّل حفظ اليوم بعد')
    ], 'card--memo');
  }

  /* ── حالة تقرير اليوم ─────────────────────────────────── */
  async function todayReportCard(me) {
    const today = U.todayKey();
    const isDay = ProgramDays.isProgramDay(today);
    const date = isDay ? today : ProgramDays.lastProgramDay(today);
    const rec = await Reports.get(me.id, date);
    const targets = Object.assign({}, PROGRAM.targets, me.targets || {});
    const parts = Reports.scoreDay(rec, targets);

    /* صاحب التقرير يرى بنوده كلها، وفيها قيام الليل في أيامه. */
    const items = Reports.dayItems(date, { includePrivate: true })
      .map(i => ({ name: i.name, v: parts[i.key] || 0, private: i.private }));
    const done = items.filter(i => i.v >= 1).length;

    const card = UI.card([], 'card--report');
    card.appendChild(UI.sectionTitle(T('todayTasks'),
      rec.submitted ? UI.badge(T('alreadySubmitted'), 'ok') : null));

    if (!isDay) {
      const next = ProgramDays.nextProgramDay(today);
      card.appendChild(el('p.hint', {}, T('notProgramDay') + ' — ' + T('programDaysAre')));
      if (next) card.appendChild(el('p.hint', {},
        T('nextProgramDay', ProgramDays.dayName(next))));
    }

    card.appendChild(el('div.report-mini', {},
      UI.ring(U.pct(done, items.length), {
        size: 72, stroke: 7,
        color: done === items.length ? 'var(--ok)' : 'var(--gold-400)',
        label: `${U.num(done)}/${U.num(items.length)}`
      }),
      el('div.report-mini-list', {}, items.map(i =>
        el('div.report-mini-row' + (i.v >= 1 ? '.is-done' : ''), {},
          el('span.report-mini-mark', {}, i.v >= 1 ? UI.icon('check', 13) : null),
          el('span', {}, i.name),
          i.private ? el('i.mini-private', {}, UI.icon('moon', 11)) : null)))));

    card.appendChild(UI.button(
      rec.submitted ? T('updateReport') : T('submitReport'),
      () => Router.go(isDay ? '/report' : '/report/' + date),
      rec.submitted ? 'ghost' : 'primary', { icon: 'check' }));

    return card;
  }


  /* ══════════════════ MEMORIZATION LOG ══════════════════ */
  Router.register('/memorize', {
    role: 'student',
    title: () => T('tabMemorize'),
    actions: () => [UI.iconButton('plus', () => openEntrySheet(), { label: T('addEntry') })],
    render: renderMemorize
  });

  async function renderMemorize() {
    const me = Session.user;
    const page = UI.screen();
    const all = await Entries.forUser(me.id);
    const cov = await Entries.coverage(me.id);

    page.appendChild(UI.card([
      el('div.cov', {},
        UI.ring(cov.percent, { size: 92, label: U.num(cov.percent) + '٪', sub: 'من المصحف' }),
        el('div.cov-figures', {},
          figure(U.num(cov.pages), T('pages')),
          figure(U.num(cov.juz), T('juz')),
          figure(U.num(all.length), 'تسجيل')))
    ], 'card--cov'));

    let filter = 'all';
    const listHost = el('div.entries');

    const filters = [{ value: 'all', label: T('filterAll') }]
      .concat(CONFIG.memorization.types.map(t => ({ value: t.id, label: t.name })))
      .concat([{ value: 'pending', label: T('awaitingReview') }]);

    page.appendChild(UI.chips(filters, filter, v => { filter = v; paint(); }));
    page.appendChild(el('p.hint', {}, T('fixMistake')));

    function paint() {
      U.clear(listHost);
      let rows = all;
      if (filter === 'pending') rows = rows.filter(e => e.status === 'pending');
      else if (filter !== 'all') rows = rows.filter(e => e.type === filter);

      if (!rows.length) { listHost.appendChild(UI.empty(T('empty'))); return; }

      const byDay = U.groupBy(rows, e => e.date);
      Object.keys(byDay).sort().reverse().forEach(day => {
        listHost.appendChild(el('h3.day-head', {}, U.relativeDay(day)));
        byDay[day].forEach(e => listHost.appendChild(entryRow(e)));
      });
    }
    paint();

    page.appendChild(listHost);
    page.appendChild(el('div.fab-space'));
    page.appendChild(el('button.fab', {
      type: 'button', onclick: () => openEntrySheet(), 'aria-label': T('addEntry')
    }, UI.icon('plus', 26)));

    return page;
  }

  /* ── a single entry row ───────────────────────────────── */
  function entryRow(e, { compact, forTeacher } = {}) {
    const surah = QURAN.get(e.surah) || { name: '؟' };
    const type = CONFIG.memorization.types.find(t => t.id === e.type) || {};
    const status = CONFIG.memorization.statuses.find(s => s.id === e.status) || {};
    const grade = e.grade && CONFIG.memorization.grades.find(g => g.id === e.grade);
    const pages = QURAN.pagesOf(e.surah, e.from, e.to);

    const row = el('article.entry', { style: { '--entry-color': type.color || 'var(--accent)' } });

    row.appendChild(el('div.entry-main', {},
      el('div.entry-head', {},
        el('b.entry-surah', {}, surah.name),
        el('span.entry-range', {}, `${U.num(e.from)} – ${U.num(e.to)}`),
        UI.badge(type.name || '', 'soft')),
      el('p.entry-sub', {},
        T('ayahCount') + ': ' + U.num(e.to - e.from + 1) + ' · ' + T('pagesApprox', U.num(pages))),
      e.notes ? el('p.entry-notes', {}, e.notes) : null,
      e.teacherComment
        ? el('div.entry-comment', {},
            el('b', {}, T('teacherComment') + ': '), el('span', {}, e.teacherComment))
        : null));

    const side = el('div.entry-side');
    if (grade) side.appendChild(UI.stars(grade.stars));
    side.appendChild(el('span.entry-status', { style: { color: status.color } }, status.name || ''));

    /* Edit and delete stay visible on every row, compact ones
       included — a wrong entry should never be hard to undo. */
    const tools = el('div.entry-tools');
    if (e.voiceId) tools.appendChild(voiceButton(e.voiceId));
    if (!forTeacher) {
      tools.appendChild(UI.iconButton('edit', () => openEntrySheet(e), { label: T('edit') }));
      tools.appendChild(deleteEntryButton(e));
    }
    side.appendChild(tools);

    row.appendChild(side);
    return row;
  }

  /* ── deleting an entry, with a way back ───────────────── */
  function deleteEntryButton(e) {
    const btn = UI.iconButton('trash', () => confirmDeleteEntry(e), { label: T('deleteEntry') });
    btn.classList.add('iconbtn--danger');
    return btn;
  }

  function confirmDeleteEntry(e) {
    const surah = QURAN.get(e.surah) || { name: '؟' };
    const range = `${U.num(e.from)} – ${U.num(e.to)}`;

    UI.sheet({
      title: T('deleteEntry'),
      body: el('div', {},
        el('p.sheet-text', {}, T('deleteEntryAsk', surah.name, range)),
        e.status !== 'pending' ? el('p.hint.hint--warn', {}, T('deleteReviewedWarn')) : null),
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('delete'), kind: 'danger', onClick: async a => {
            a.close();
            const restore = await Entries.removeUndoable(e.id);
            if (!restore) return;
            await Router.render();
            UI.undoToast(T('entryDeleted'), async () => {
              await restore();
              UI.toast(T('entryRestored'));
              Router.render();
            });
          } }
      ]
    });
  }

  /* A small inline play button for a saved voice note. */
  function voiceButton(voiceId) {
    let url = null, audio = null;
    const btn = UI.iconButton('play', async () => {
      if (!audio) {
        url = await Voice.url(voiceId);
        if (!url) return UI.toast('التسجيل غير موجود', 'warn');
        audio = new Audio(url);
        audio.addEventListener('ended', () => {
          btn.replaceChildren(UI.icon('play')); btn.classList.remove('is-active');
        });
      }
      if (audio.paused) {
        Player.pause();
        audio.play();
        btn.replaceChildren(UI.icon('pause')); btn.classList.add('is-active');
      } else {
        audio.pause();
        btn.replaceChildren(UI.icon('play')); btn.classList.remove('is-active');
      }
    }, { label: T('playRecording') });
    btn.classList.add('voicebtn');
    return btn;
  }

  /* ══════════════════ ENTRY EDITOR ══════════════════════ */
  async function openEntrySheet(existing) {
    const me = Session.user;
    const draft = existing
      ? Object.assign({}, existing)
      : { type: 'new', surah: 1, from: 1, to: 7, notes: '', date: U.todayKey(), voiceId: null };

    const body = el('div.form');

    /* type */
    body.appendChild(UI.field(T('entryType'),
      UI.chips(CONFIG.memorization.types.map(t => ({ value: t.id, label: t.name, color: t.color })),
        draft.type, v => { draft.type = v; })));

    /* surah */
    const surahSelect = UI.select(
      QURAN.surahs.map(s => ({ value: s.no, label: `${U.num(s.no)}. ${s.name} (${U.num(s.ayahs)})` })),
      draft.surah, v => { draft.surah = +v; syncRange(); });
    body.appendChild(UI.field(T('surah'), surahSelect));

    /* range */
    const fromIn = UI.input({ type: 'number', min: 1, value: draft.from, inputmode: 'numeric' });
    const toIn   = UI.input({ type: 'number', min: 1, value: draft.to,   inputmode: 'numeric' });
    const rangeInfo = el('p.hint');

    function syncRange() {
      const s = QURAN.get(draft.surah);
      fromIn.max = toIn.max = s.ayahs;
      if (+fromIn.value > s.ayahs) fromIn.value = 1;
      if (+toIn.value > s.ayahs) toIn.value = s.ayahs;
      draft.from = U.clamp(+fromIn.value || 1, 1, s.ayahs);
      draft.to   = U.clamp(+toIn.value || 1, draft.from, s.ayahs);
      toIn.value = draft.to;
      rangeInfo.textContent =
        `${T('ayahCount')}: ${U.num(draft.to - draft.from + 1)} · ` +
        T('pagesApprox', U.num(QURAN.pagesOf(draft.surah, draft.from, draft.to)));
    }
    fromIn.addEventListener('input', syncRange);
    toIn.addEventListener('input', syncRange);

    body.appendChild(el('div.field-row', {},
      UI.field(T('fromAyah'), fromIn),
      UI.field(T('toAyah'), toIn)));
    body.appendChild(rangeInfo);
    syncRange();

    /* date */
    const dateIn = UI.input({ type: 'date', value: draft.date, max: U.todayKey() });
    dateIn.addEventListener('change', () => { draft.date = dateIn.value || U.todayKey(); });
    body.appendChild(UI.field('التاريخ', dateIn));

    /* voice note */
    body.appendChild(await recorderField(draft));

    /* notes */
    const notesIn = el('textarea.input', { rows: 3, placeholder: 'ملاحظاتك حول حفظ اليوم…' });
    notesIn.value = draft.notes || '';
    notesIn.addEventListener('input', () => { draft.notes = notesIn.value; });
    body.appendChild(UI.field(T('notes'), notesIn));

    const dialog = UI.sheet({
      title: existing ? T('edit') : T('addEntry'),
      body, wide: true,
      actions: [
        existing
          ? { label: T('delete'), kind: 'danger', onClick: async a => {
              if (await UI.confirm(T('confirmDelete'), { danger: true })) {
                await Entries.remove(existing.id); a.close();
                UI.toast(T('deleted')); Router.render();
              }
            } }
          : { label: T('cancel'), kind: 'ghost' },
        { label: T('saveEntry'), kind: 'primary', onClick: save }
      ]
    });

    async function save(a) {
      syncRange();
      /* Stop and store any recording still in progress. */
      if (Recorder.recording) {
        const res = await Recorder.stop();
        if (res) draft.voiceId = (await Voice.save({ userId: me.id, ...res })).id;
      }
      if (draft.pendingVoice) {
        const v = await Voice.save({ userId: me.id, ...draft.pendingVoice });
        draft.voiceId = v.id;
      }

      if (existing) {
        await Entries.update(existing.id, {
          type: draft.type, surah: draft.surah, from: draft.from, to: draft.to,
          notes: draft.notes, date: draft.date, voiceId: draft.voiceId,
          status: existing.status === 'redo' ? 'pending' : existing.status
        });
      } else {
        await Entries.create({
          userId: me.id, type: draft.type, surah: draft.surah,
          from: draft.from, to: draft.to, notes: draft.notes,
          date: draft.date, voiceId: draft.voiceId
        });
      }
      a.close();
      UI.toast(T('entrySaved'));
      afterProgress(me.id);
      Router.render();
    }
  }

  /* ── recorder control inside the entry sheet ──────────── */
  async function recorderField(draft) {
    const host = el('div.recorder');
    let previewUrl = null;

    async function paint() {
      U.clear(host);

      if (!Recorder.supported) {
        host.appendChild(el('p.hint.hint--warn', {},
          window.isSecureContext === false
            ? 'التسجيل الصوتي يحتاج فتح البرنامج عبر رابط https.'
            : T('micUnsupported')));
        return;
      }

      const hasClip = !!draft.pendingVoice || !!draft.voiceId;

      if (!hasClip) {
        host.appendChild(UI.button(T('record'), startRec, 'record', { icon: 'mic' }));
        host.appendChild(el('p.hint', {}, 'سجّل ما حفظته اليوم ليستمع إليه معلّمك'));
        return;
      }

      const row = el('div.recorder-clip');
      row.appendChild(UI.icon('mic', 18));
      row.appendChild(el('span.recorder-label', {},
        draft.pendingVoice
          ? `${T('recordingReady')} · ${U.clockTime(draft.pendingVoice.duration)}`
          : T('recordingReady')));

      /* preview */
      const playBtn = UI.iconButton('play', async () => {
        if (!previewUrl) {
          previewUrl = draft.pendingVoice
            ? URL.createObjectURL(draft.pendingVoice.blob)
            : await Voice.url(draft.voiceId);
        }
        const a = new Audio(previewUrl); a.play();
      }, { label: T('playRecording') });
      row.appendChild(playBtn);

      row.appendChild(UI.iconButton('trash', async () => {
        if (draft.voiceId) { await Voice.remove(draft.voiceId); draft.voiceId = null; }
        draft.pendingVoice = null;
        if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
        paint();
      }, { label: T('reRecord') }));

      host.appendChild(row);
    }

    async function startRec() {
      U.clear(host);
      const wave = el('div.wave');
      for (let i = 0; i < 28; i++) wave.appendChild(el('i'));
      const timer = el('b.rec-timer', {}, '0:00');

      const stopBtn = UI.button(T('stopRecord'), async () => {
        const res = await Recorder.stop();
        if (res) draft.pendingVoice = res;
        paint();
      }, 'danger', { icon: 'stop' });

      host.appendChild(el('div.recording', {},
        el('span.rec-dot'), timer, wave, stopBtn));

      try {
        await Recorder.start(({ seconds, level }) => {
          timer.textContent = U.clockTime(seconds);
          const bars = wave.children;
          for (let i = bars.length - 1; i > 0; i--)
            bars[i].style.height = bars[i - 1].style.height || '10%';
          bars[0].style.height = Math.max(10, level * 100) + '%';
        });
      } catch (err) {
        UI.toast(Recorder.explain(err), 'warn', 4200);
        paint();
      }
    }

    await paint();
    return UI.field(T('voiceNote'), host);
  }

  /* ── goal editor ──────────────────────────────────────
     Shared by the student and the teacher. `forUser` decides whose
     goal it is; leave it out and it belongs to whoever is signed in. */
  async function openGoalSheet(existing, forUser) {
    const owner = forUser || Session.user;

    const draft = existing ? Object.assign({}, existing) : {
      mode: 'juz', juz: 30, surah: 1, fromPage: 1, toPage: 10,
      amount: 10, unit: 'pages',
      title: '', titleTouched: false,
      deadline: U.addDays(U.todayKey(), 30)
    };
    if (existing) draft.titleTouched = true;

    const body = el('div.form');

    /* ── what kind of goal ──────────────────────────── */
    body.appendChild(UI.field(T('goalKind'),
      UI.chips(CONFIG.goalModes.map(m => ({ value: m.id, label: m.name })),
        draft.mode, v => { draft.mode = v; paintTarget(); })));

    /* ── the target itself, which depends on the kind ─ */
    const targetHost = el('div.form');
    body.appendChild(targetHost);

    const scopeLine = el('p.hint.hint--scope');
    body.appendChild(scopeLine);

    function paintTarget() {
      U.clear(targetHost);

      if (draft.mode === 'juz') {
        const options = Array.from({ length: QURAN.TOTAL_JUZ }, (_, i) => {
          const span = QURAN.juzRange(i + 1);
          const surahs = QURAN.surahsIn(span);
          const from = surahs[0], to = surahs[surahs.length - 1];
          const range = from === to ? from.name : `${from.name} – ${to.name}`;
          return { value: i + 1, label: `${T('juzNo', U.num(i + 1))} — ${range}` };
        });
        targetHost.appendChild(UI.field(T('pickJuz'),
          UI.select(options, draft.juz, v => { draft.juz = +v; afterTarget(); })));

      } else if (draft.mode === 'surah') {
        targetHost.appendChild(UI.field(T('pickSurah'),
          UI.select(QURAN.surahs.map(s => ({
            value: s.no, label: `${U.num(s.no)}. ${s.name} (${U.num(s.ayahs)} ${T('ayahs')})`
          })), draft.surah, v => { draft.surah = +v; afterTarget(); })));

      } else if (draft.mode === 'pages') {
        const fromIn = UI.input({ type: 'number', min: 1, max: QURAN.TOTAL_PAGES,
                                  value: draft.fromPage, inputmode: 'numeric' });
        const toIn = UI.input({ type: 'number', min: 1, max: QURAN.TOTAL_PAGES,
                                value: draft.toPage, inputmode: 'numeric' });
        const sync = () => {
          draft.fromPage = U.clamp(+fromIn.value || 1, 1, QURAN.TOTAL_PAGES);
          draft.toPage = U.clamp(+toIn.value || 1, draft.fromPage, QURAN.TOTAL_PAGES);
          afterTarget();
        };
        fromIn.addEventListener('input', sync);
        toIn.addEventListener('input', sync);
        targetHost.appendChild(el('div.field-row', {},
          UI.field(T('fromPage'), fromIn), UI.field(T('toPage'), toIn)));
        targetHost.appendChild(el('p.hint', {}, T('pagesApproxNote')));

      } else {
        const amountIn = UI.input({ type: 'number', min: 1, step: 'any',
                                    value: draft.amount, inputmode: 'decimal' });
        amountIn.addEventListener('input', () => { draft.amount = +amountIn.value; afterTarget(); });
        targetHost.appendChild(el('div.field-row', {},
          UI.field(T('goalAmount'), amountIn),
          UI.field(T('goalUnit'), UI.select(
            CONFIG.goalUnits.map(u => ({ value: u.id, label: u.name })),
            draft.unit, v => { draft.unit = v; afterTarget(); }))));
      }
      afterTarget();
    }

    /* Target pages, derived the same way progress will derive them
       so the preview and the real figure never disagree. */
    function targetPages() {
      const span = Goals.span(draft);
      if (!span) return null;
      return QURAN.pagesBetween(span.from, span.to);
    }

    function afterTarget() {
      const span = Goals.span(draft);
      if (span) {
        scopeLine.textContent = T('goalScopeInfo', span.label, U.num(targetPages()));
      } else {
        const unit = CONFIG.goalUnits.find(u => u.id === draft.unit) || {};
        scopeLine.textContent = `${U.num(draft.amount)} ${unit.name || ''}`;
      }
      if (!draft.titleTouched) {
        draft.title = Goals.label(draft);
        if (titleIn) titleIn.value = draft.title;
      }
      paintDaily();
    }

    /* ── title ──────────────────────────────────────── */
    const titleIn = UI.input({ value: draft.title });
    titleIn.addEventListener('input', () => {
      draft.title = titleIn.value; draft.titleTouched = true;
    });
    body.appendChild(UI.field(T('goalTitle'), titleIn));

    /* ── deadline, and the daily share it implies ───── */
    const dateIn = UI.input({ type: 'date', value: draft.deadline || '', min: U.todayKey() });
    dateIn.addEventListener('change', () => { draft.deadline = dateIn.value || null; paintDaily(); });
    body.appendChild(UI.field(T('goalDeadline'), dateIn));

    const dailyLine = el('div.dailypreview');
    body.appendChild(dailyLine);

    function paintDaily() {
      U.clear(dailyLine);
      if (!draft.deadline) {
        dailyLine.appendChild(el('p.hint.hint--warn', {}, T('dailyNoDeadline')));
        return;
      }
      const start = existing ? existing.startDate : U.todayKey();
      const days = Math.max(1, U.diffDays(start, draft.deadline) + 1);
      const total = Goals.span(draft) ? targetPages() : draft.amount;
      const unitName = Goals.span(draft)
        ? 'صفحة'
        : (CONFIG.goalUnits.find(u => u.id === draft.unit) || {}).name || '';
      const perDay = +(total / days).toFixed(2);

      dailyLine.appendChild(el('div.dailypreview-box', {},
        UI.icon('star', 18),
        el('div', {},
          el('b', {}, T('dailyGoalOf', U.num(perDay), unitName)),
          el('span', {}, `${U.num(total)} ${unitName} ÷ ${U.num(days)} يوم`))));
    }

    body.appendChild(el('p.hint', {},
      Goals.span(draft) ? T('goalCounts') : T('goalAmountInfo')));

    paintTarget();

    UI.sheet({
      title: existing ? T('edit') : T('setGoal'), body, wide: true,
      actions: [
        existing
          ? { label: T('delete'), kind: 'danger', onClick: async a => {
              a.close();
              const yes = await UI.confirm(T('deleteGoalAsk', existing.title), {
                title: T('deleteGoal'), danger: true, confirmLabel: T('delete')
              });
              if (!yes) return;
              await Goals.remove(existing.id);
              UI.toast(T('goalDeleted')); Router.render();
            } }
          : { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            const fields = {
              mode: draft.mode, title: draft.title.trim(),
              juz: draft.juz, surah: draft.surah,
              fromPage: draft.fromPage, toPage: draft.toPage,
              amount: draft.amount, unit: draft.unit,
              deadline: draft.deadline
            };
            /* Editing changes the goal in place; only a brand new
               goal retires the previous one into history. */
            if (existing) await Goals.update(existing.id, fields);
            else await Goals.create(Object.assign(fields,
              { userId: owner.id, createdBy: Session.user.id }));
            a.close(); UI.toast(T('saved')); Router.render();
          } }
      ]
    });
  }

  /* Awards badges and celebrates, after any progress is logged. */
  async function afterProgress(userId) {
    const earned = await Badges.check(userId);
    if (earned.length) setTimeout(() => UI.celebrate(earned[0]), 500);
  }

  window.StudentView = {
    openEntrySheet, openGoalSheet, entryRow, voiceButton, afterProgress,
    confirmDeleteEntry, deleteEntryButton,
    /* تُستعمل في صفحة المصحف وصفحة الشجرة */
    goalCard, dailyCard, todaySalahCard
  };
})();
