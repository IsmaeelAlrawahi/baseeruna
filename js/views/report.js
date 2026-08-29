/* ============================================================
   بصائرنا — التقرير اليومي

   يومٌ واحد، وفيه كل مسارات البرنامج: القرآن، والشعر، والقراءة.
   وقيام الليل حقلٌ في التقرير نفسه لكنه لا يظهر إلا للمعلّم.

   المتابعة من الأحد إلى الأربعاء؛ وما سوى ذلك يُفتح للقراءة
   ويُوجَّه الطالب إلى أقرب يوم متابعة.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/report', {
    role: 'student',
    title: () => T('dailyReport'),
    render: () => renderReport({ date: ProgramDays.isProgramDay(U.todayKey())
      ? U.todayKey() : ProgramDays.lastProgramDay(U.todayKey()) })
  });

  Router.register('/report/:date', {
    role: 'student', back: '/report',
    title: () => T('dailyReport'),
    render: p => renderReport({ date: p.date })
  });

  /* المعلّم يفتح تقرير طالب — ومعه قيام الليل. */
  Router.register('/t/report/:id/:date', {
    role: 'teacher', back: true,
    title: () => T('dailyReport'),
    render: p => renderReport({ date: p.date, userId: p.id, asTeacher: true })
  });

  async function renderReport({ date, userId, asTeacher }) {
    const viewingId = userId || Session.user.id;
    const user = await Users.byId(viewingId);
    if (!user) return UI.empty('الطالب غير موجود');

    const page = UI.screen(null, 'page--report');
    const isProgramDay = ProgramDays.isProgramDay(date);
    const targets = Object.assign({}, PROGRAM.targets, user.targets || {});

    if (window.Sync) await window.Sync.pullReportForStudent(viewingId, date);

    let rec = await Reports.get(viewingId, date);
    const [poem, book] = await Promise.all([
      Poems.active(viewingId), Books.active(viewingId)
    ]);

    /* ── header ───────────────────────────────────────── */
    page.appendChild(el('div.report-head', {},
      el('div', {},
        el('h2.report-day', {}, ProgramDays.dayName(date)),
        el('p.report-date', {}, U.formatDate(date))),
      rec.submitted ? UI.badge(T('alreadySubmitted'), 'ok') : null));

    if (!isProgramDay) {
      const next = ProgramDays.lastProgramDay(date);
      page.appendChild(UI.card([
        UI.empty(T('notProgramDay') + ' — ' + T('programDaysAre'),
          UI.button(T('openLastDay', U.formatDateShort(next)),
            () => Router.go('/report/' + next), 'primary'))
      ]));
      return page;
    }

    /* Days move day to day, so a small strip to hop between them. */
    page.appendChild(weekStrip(date, viewingId, asTeacher));

    /* ── القرآن الكريم ────────────────────────────────── */
    const quranCard = UI.card([], 'card--track');
    quranCard.append(
      trackTitle('القرآن الكريم', 'book', 'var(--teal-300)'),
      targetRow('الحفظ', targets.quranMemorize, 'صفحة',
        rec.quran.memorized, { step: 0.25, max: 20 }, v => {
          rec.quran.memorized = v;
          autosave({ quran: { memorized: v } }); paintTotals();
        }),
      targetRow('المراجعة', targets.quranReview, 'صفحة',
        rec.quran.reviewed, { step: 0.5, max: 60 }, v => {
          rec.quran.reviewed = v;
          autosave({ quran: { reviewed: v } }); paintTotals();
        }));
    page.appendChild(quranCard);

    /* ── الشعر والأدب ─────────────────────────────────── */
    const poetryCard = UI.card([], 'card--track');
    poetryCard.appendChild(trackTitle(T('poetry'), 'star', 'var(--gold-400)'));

    if (!poem) {
      poetryCard.appendChild(UI.empty(T('noPoem'),
        asTeacher ? null : UI.button(T('addPoem'),
          () => ProgramView.openPoemSheet(null, viewingId), 'ghost', { icon: 'plus' })));
    } else {
      const pp = await Poems.progress(poem);
      /* The stored total already contains whatever today's report
         holds, so take it back out and add the live value instead. */
      const base = pp.done - (rec.poetry.poemId === poem.id ? (+rec.poetry.verses || 0) : 0);

      const progressHost = el('div');
      function paintPoemProgress() {
        const done = Math.min(poem.totalVerses, base + (+rec.poetry.verses || 0));
        U.clear(progressHost);
        progressHost.appendChild(
          UI.remaining(done, poem.totalVerses, 'بيت',
            { color: 'var(--gold-400)', label: T('versesMemorized') }));
      }

      const versesRow = targetRow(T('versesToday'), targets.poetryVerses, 'بيت',
        rec.poetry.verses, { step: 1, max: 500 }, v => {
          rec.poetry.verses = v;
          autosave({ poetry: { verses: v, poemId: poem.id } });
          paintPoemProgress(); paintTotals();
        });

      poetryCard.append(
        el('div.track-subject', {},
          el('div', {},
            el('b', {}, poem.title),
            el('small', {}, `${U.num(poem.totalVerses)} بيت`)),
          poem.fileId
            ? UI.iconButton('down', () => Files.open(poem.fileId), { label: T('openFile') })
            : null,
          asTeacher ? null : UI.iconButton('edit',
            () => ProgramView.openPoemSheet(poem, viewingId), { label: T('changePoem') })),
        versesRow, progressHost);
      paintPoemProgress();
    }
    page.appendChild(poetryCard);

    /* ── القراءة ──────────────────────────────────────── */
    const readingCard = UI.card([], 'card--track');
    readingCard.appendChild(trackTitle(T('reading'), 'book', 'var(--teal-200)'));

    if (!book) {
      readingCard.appendChild(UI.empty(T('noBook'),
        asTeacher ? null : UI.button(T('chooseBook'),
          () => LibraryView.openBookPicker(viewingId), 'primary', { icon: 'library' })));
    } else {
      const bp = await Books.progress(book);
      const base = bp.done - (rec.reading.bookId === book.id ? (+rec.reading.pages || 0) : 0);

      const progressHost = el('div');
      function paintBookProgress() {
        const done = Math.min(book.totalPages, base + (+rec.reading.pages || 0));
        U.clear(progressHost);
        progressHost.appendChild(
          UI.remaining(done, book.totalPages, 'صفحة', { color: 'var(--teal-200)' }));
      }

      const minutesRow = targetRow(T('minutesToday'), targets.readingMinutes, 'دقيقة',
        rec.reading.minutes, { step: 5, max: 600 }, v => {
          rec.reading.minutes = v;
          autosave({ reading: { minutes: v, bookId: book.id } });
          paintTotals();
        });

      const pagesStep = UI.stepper(rec.reading.pages, {
        step: 1, max: 2000,
        onChange: v => {
          rec.reading.pages = v;
          autosave({ reading: { pages: v, bookId: book.id } });
          paintBookProgress();
        }
      });

      readingCard.append(
        el('div.track-subject', {},
          el('div', {},
            el('b', {}, book.title),
            el('small', {}, [book.author, `${U.num(book.totalPages)} صفحة`]
              .filter(Boolean).join(' · '))),
          asTeacher ? null : UI.button(T('changeBook'),
            () => LibraryView.openBookPicker(viewingId), 'ghost', { icon: 'library' })),
        minutesRow,
        UI.field(T('pagesToday'), pagesStep),
        progressHost);
      paintBookProgress();
    }
    page.appendChild(readingCard);

    /* ── قيام الليل ───────────────────────────────────
       يسجّله الطالب لنفسه، ولا يراه إلا هو ومعلّمه — فلا يظهر
       في «حال الطلبة» ولا يطّلع عليه أحدٌ من زملائه.          */
    if (ProgramDays.isQiyamDay(date)) {
      const qiyamCard = UI.card([], 'card--track');
      qiyamCard.append(
        el('div.track-head', {},
          trackTitle(T('qiyam'), 'moon', 'var(--gold-300)'),
          UI.badge(T('privateTrack'), 'gold')),
        el('button.bigcheck' + (rec.qiyam ? '.is-on' : ''), {
          type: 'button',
          onclick: async ev => {
            /* يُمسَك الزرّ قبل أي انتظار: currentTarget يصير null
               بعد انتهاء توزيع الحدث، فيضيع تغيّر شكل الزرّ. */
            const btn = ev.currentTarget;
            rec.qiyam = !rec.qiyam;
            /* الشكل يتغيّر فورًا، ثم يُحفظ — فلا ينتظر الطالب. */
            btn.classList.toggle('is-on', rec.qiyam);
            btn.querySelector('.bigcheck-mark').replaceChildren(
              rec.qiyam ? UI.icon('check', 22) : document.createTextNode(''));
            paintTotals();
            await Reports.save(viewingId, date, { qiyam: rec.qiyam });
            UI.toast(rec.qiyam ? T('qiyamMarked') : T('qiyamCleared'));
          }
        },
          el('span.bigcheck-mark', {}, rec.qiyam ? UI.icon('check', 22) : null),
          el('span', {}, T('didIPray'))),
        el('p.hint', {}, T('qiyamPrivate')));
      page.appendChild(qiyamCard);
    } else {
      /* في غير أيامه يُذكر أنه ليس من بنود اليوم، فلا يُظنّ نقصًا. */
      page.appendChild(UI.card([
        el('div.track-head', {},
          trackTitle(T('qiyam'), 'moon', 'var(--text-faint)'),
          UI.badge(T('notToday'), 'neutral')),
        el('p.hint', {}, T('qiyamDaysOnly'))
      ], 'card--track card--muted'));
    }

    /* ── ملاحظة الطالب ────────────────────────────────── */
    const noteIn = el('textarea.input', { rows: 2, placeholder: T('reportNotePh') });
    noteIn.value = rec.note || '';
    noteIn.addEventListener('input', U.debounce(() => {
      rec.note = noteIn.value;
      autosave({ note: rec.note });
    }, 500));
    page.appendChild(UI.card([UI.field(T('reportNote'), noteIn)]));

    /* ── ملاحظة المعلّم ───────────────────────────────── */
    if (asTeacher) {
      const tNote = el('textarea.input', { rows: 2, placeholder: T('writeComment') });
      tNote.value = rec.teacherNote || '';
      tNote.addEventListener('input', U.debounce(() => {
        Reports.save(viewingId, date, { teacherNote: tNote.value });
      }, 500));
      page.appendChild(UI.card([UI.field(T('teacherComment'), tNote)]));
    } else if (rec.teacherNote) {
      page.appendChild(UI.card([
        UI.sectionTitle(T('teacherComment')),
        el('p.entry-comment', {}, rec.teacherNote)
      ], 'card--quote'));
    }

    /* ── الإجمال وزرّ الإرسال ─────────────────────────── */
    const totals = el('div.report-totals');
    page.appendChild(totals);

    /* بنود اليوم — ومعها قيام الليل في أيامه، فهو من التقرير
       لا شيءٌ على حدة. وصاحب التقرير يراها كلها. */
    function paintTotals() {
      const parts = Reports.scoreDay(rec, targets);
      const items = Reports.dayItems(date, { includePrivate: true });
      const done = items.filter(i => (parts[i.key] || 0) >= 1).length;

      U.clear(totals);
      totals.appendChild(el('div.report-summary', {},
        el('b', {}, T('tasksDone', U.num(done), U.num(items.length))),
        el('div.report-pips', {}, items.map(i => {
          const v = parts[i.key] || 0;
          return el('i.pip' + (v >= 1 ? '.on' : (v > 0 ? '.half' : '')) +
                    (i.private ? '.pip--private' : ''), { title: i.name });
        }))));
    }
    paintTotals();

    if (!asTeacher) {
      page.appendChild(UI.button(
        rec.submitted ? T('updateReport') : T('submitReport'),
        submit, 'primary', { icon: 'check' }));
    }

    /* ── حفظ ──────────────────────────────────────────
       التأجيل يُبقي آخر نداء فقط، فلو غيّر الطالب الدقائق ثم
       الصفحات بسرعة ضاع الأول. لذا تُجمع التعديلات في مخزن
       واحد ثم تُكتب دفعةً واحدة.                             */
    let pending = {};
    const flushSave = U.debounce(async () => {
      const patch = pending; pending = {};
      if (Object.keys(patch).length) await Reports.save(viewingId, date, patch);
    }, 400);

    function autosave(patch) {
      Object.keys(patch).forEach(k => {
        pending[k] = (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]))
          ? Object.assign({}, pending[k], patch[k])
          : patch[k];
      });
      flushSave();
    }

    async function submit() {
      /* Write whatever the debounce is still holding, then the whole
         record, so nothing typed in the last moment is lost. */
      pending = {};
      await Reports.save(viewingId, date, {
        quran: rec.quran, poetry: rec.poetry, reading: rec.reading, note: rec.note
      });
      const wasSubmitted = rec.submitted;
      rec = await Reports.submit(viewingId, date);

      if (!wasSubmitted) {
        const phrase = await Motivations.afterReport(viewingId);
        showAfterReport(phrase, rec, targets);
      } else {
        UI.toast(T('reportSaved'));
      }
      Router.render();
    }

    return page;
  }

  /* ── helpers ──────────────────────────────────────────── */

  function trackTitle(name, icon, color) {
    return el('div.track-title', { style: { '--track-color': color } },
      el('span.track-icon', {}, UI.icon(icon, 18)),
      el('h3', {}, name));
  }

  /* A stepper with its target beside it, saying plainly whether the
     day's minimum has been met — and that going over is welcome. */
  function targetRow(label, target, unit, value, stepOpts, onChange) {
    const state = el('span.target-state');

    function paintState(v) {
      const met = v >= target;
      state.textContent = met
        ? (v > target ? T('aboveTarget') : T('achieved'))
        : `${T('target')}: ${U.num(target)} ${unit}`;
      state.className = 'target-state' + (met ? ' is-met' : '');
    }

    const stepperNode = UI.stepper(value, Object.assign({ unit }, stepOpts, {
      onChange: v => { paintState(v); onChange(v); }
    }));
    paintState(+value || 0);

    return el('div.targetrow', {},
      el('div.targetrow-head', {}, el('label.label', {}, label), state),
      stepperNode);
  }

  /* The four programme days of this week, to move between them. */
  function weekStrip(date, userId, asTeacher) {
    const week = ProgramDays.weekKey(date);
    const days = ProgramDays.daysOfWeek(week);
    const today = U.todayKey();

    return el('div.weekstrip', {}, days.map(d => {
      const isFuture = d > today;
      const node = el('a.weekday' + (d === date ? '.is-current' : '') +
                                    (isFuture ? '.is-future' : ''), {
        href: isFuture ? null : '#' + (asTeacher
          ? `/t/report/${userId}/${d}` : `/report/${d}`)
      },
        el('b', {}, ProgramDays.dayName(d)),
        el('span', {}, U.num(U.parseKey(d).getDate())));
      return node;
    }));
  }

  /* Shown once, right after the report goes in. */
  function showAfterReport(phrase, rec, targets) {
    const complete = Reports.isComplete(rec, targets);
    UI.sheet({
      title: '',
      body: el('div.celebrate', {},
        el('div.celebrate-mark', {}, UI.icon(complete ? 'star' : 'check', 44)),
        el('h3', {}, T('reportSubmitted')),
        el('blockquote.quote', {},
          el('p.quote-text', {}, phrase.text),
          phrase.source ? el('cite.quote-src', {}, phrase.source) : null)),
      actions: [{ label: T('done'), kind: 'primary' }]
    });
  }

  window.ReportView = { showAfterReport };
})();
