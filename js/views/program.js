/* ============================================================
   بصائرنا — برنامجي

   ما يمتدّ أثره عبر الأيام: القصيدة، والكتاب، وسلسلة النحو،
   والملتقيات. أما ما يُسجَّل كل يوم فمكانه التقرير اليومي.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/program', {
    role: 'student',
    title: () => T('tabProgram'),
    render: () => renderProgram(Session.user.id, false)
  });

  Router.register('/t/program/:id', {
    role: 'teacher', back: true,
    title: () => T('tabProgram'),
    render: p => renderProgram(p.id, true)
  });

  async function renderProgram(userId, asTeacher) {
    const user = await Users.byId(userId);
    if (!user) return UI.empty('الطالب غير موجود');

    const page = UI.screen();
    const term = await Term.get();

    /* برنامجي لطلبة المستوى الثالث وحدهم. */
    if (!ProgramDays.hasProgram(user)) {
      page.appendChild(UI.card([
        UI.sectionTitle(T('tabProgram')),
        UI.empty(T('programLevelOnly')),
        el('p.hint', {}, `${T('level')}: ${ProgramDays.levelName(user)}`)
      ]));
      return page;
    }

    /* ── سلسلة النحو ──────────────────────────────────── */
    page.appendChild(await nahwCard(userId, term, asTeacher));

    /* ── الملتقيات ────────────────────────────────────── */
    page.appendChild(await meetupsCard(userId, asTeacher));

    return page;
  }

  /* ── سلسلة النحو: ٢٨ حلقة، حلقة كل أسبوع ─────────────── */
  async function nahwCard(userId, term, asTeacher) {
    const card = UI.card([], 'card--track');
    const rows = await Nahw.forUser(userId);
    const byLesson = new Map(rows.map(r => [r.lesson, r]));
    const prog = await Nahw.progress(userId);
    const expected = Nahw.expectedLesson(term.start, U.todayKey());

    card.append(
      UI.sectionTitle(T('nahw'),
        UI.badge(T('nahwProgress', U.num(prog.done), U.num(PROGRAM.nahw.lessons)),
          prog.done >= expected ? 'ok' : 'soft')),
      el('p.hint', {}, T('nahwLevelNote')),
      UI.bar(prog.percent, 'var(--teal-300)'));

    /* This week's lesson gets its own row, since it is the one that
       actually needs doing right now. */
    const current = byLesson.get(expected);
    card.appendChild(el('div.nahw-current', {},
      el('div', {},
        el('b', {}, T('nahwWeek')),
        el('span', {}, T('nahwLesson', U.num(expected)))),
      lessonControls(expected, current, userId)));

    const grid = el('div.nahw-grid');
    for (let i = 1; i <= PROGRAM.nahw.lessons; i++) {
      const rec = byLesson.get(i);
      const done = rec && rec.done;
      const hasSummary = rec && rec.summaryFileId;
      grid.appendChild(el('button.nahw-cell' +
        (done ? '.is-done' : '') + (i === expected ? '.is-current' : ''), {
        type: 'button',
        title: T('nahwLesson', i),
        onclick: () => openLessonSheet(i, userId)
      },
        el('b', {}, U.num(i)),
        hasSummary ? el('i.nahw-dot') : null));
    }
    card.appendChild(grid);
    return card;
  }

  function lessonControls(lesson, rec, userId) {
    const wrap = el('div.nahw-actions');
    const done = rec && rec.done;
    wrap.appendChild(UI.button(done ? T('done') : T('nahwDone'), async () => {
      await Nahw.mark(userId, lesson, { done: !done });
      Router.render();
    }, done ? 'ok' : 'ghost', { icon: 'check' }));
    wrap.appendChild(UI.button(T('nahwSummary'),
      () => openLessonSheet(lesson, userId), 'ghost', { icon: 'upload' }));
    return wrap;
  }

  async function openLessonSheet(lesson, userId) {
    const rec = await Nahw.get(userId, lesson);
    const body = el('div.form');

    const doneBtn = el('button.bigcheck' + (rec && rec.done ? '.is-on' : ''), {
      type: 'button',
      onclick: async ev => {
        /* الزرّ يُمسَك قبل الانتظار — currentTarget يصير null بعده. */
        const btn = ev.currentTarget;
        const next = !(await Nahw.get(userId, lesson) || {}).done;
        btn.classList.toggle('is-on', next);
        btn.querySelector('.bigcheck-mark')
          .replaceChildren(next ? UI.icon('check', 22) : document.createTextNode(''));
        await Nahw.mark(userId, lesson, { done: next });
      }
    },
      el('span.bigcheck-mark', {}, rec && rec.done ? UI.icon('check', 22) : null),
      el('span', {}, T('nahwDone')));
    body.appendChild(doneBtn);

    /* الملخّص */
    const fileHost = el('div.form');
    async function paintFile() {
      U.clear(fileHost);
      const cur = await Nahw.get(userId, lesson);
      if (cur && cur.summaryFileId) {
        const f = await Files.get(cur.summaryFileId);
        fileHost.appendChild(el('div.filerow', {},
          UI.icon('upload', 16),
          el('span.filerow-name', {}, f ? f.name : '—'),
          el('small', {}, f ? U.bytes(f.size) : ''),
          UI.button(T('viewFile'),
            () => ReaderView.viewFile(cur.summaryFileId, T('nahwSummary')),
            'ghost', { icon: 'book' }),
          UI.iconButton('down', () => Files.open(cur.summaryFileId), { label: T('download') }),
          (() => {
            const b = UI.iconButton('trash', async () => {
              await Nahw.removeSummary(userId, lesson);
              paintFile();
            }, { label: T('delete') });
            b.classList.add('iconbtn--danger');
            return b;
          })()));
      } else {
        const picker = el('input', {
          type: 'file', hidden: true,
          accept: '.pdf,.doc,.docx,.txt,.md,image/*,application/pdf',
          onchange: async ev => {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            const saved = await Files.save({ userId, file, kind: 'nahw-summary' });
            await Nahw.mark(userId, lesson, { summaryFileId: saved.id });
            UI.toast(T('summaryUploaded'));
            paintFile();
          }
        });
        fileHost.append(
          UI.button(T('uploadSummary'), () => picker.click(), 'ghost', { icon: 'upload' }),
          picker);
      }
    }
    await paintFile();
    body.appendChild(UI.field(T('nahwSummary'), fileHost));

    const noteIn = el('textarea.input', { rows: 3, placeholder: 'ملاحظاتك على الحلقة…' });
    noteIn.value = (rec && rec.note) || '';
    body.appendChild(UI.field(T('notes'), noteIn));

    UI.sheet({
      title: T('nahwLesson', U.num(lesson)), body, wide: true,
      actions: [
        { label: T('close'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            await Nahw.mark(userId, lesson, { note: noteIn.value });
            a.close(); UI.toast(T('saved')); Router.render();
          } }
      ]
    });
  }

  /* ── الملتقيات ────────────────────────────────────────── */
  async function meetupsCard(userId, asTeacher) {
    const rows = await Meetups.forUser(userId);
    const prog = await Meetups.progress(userId);

    const card = UI.card([
      UI.sectionTitle(T('meetups'),
        UI.badge(T('meetupsProgress', U.num(prog.done), U.num(prog.total)),
          prog.done === prog.total ? 'ok' : 'soft')),
      el('p.hint', {}, T('meetupsNote'))
    ], 'card--track');

    const user = await Users.byId(userId);
    const schedule = await Meetups.schedule(
      user && user.role === 'teacher' ? user.id : (user && user.teacherId));

    const list = el('div.meetups');
    rows.forEach(r => {
      const def = PROGRAM.meetups.find(m => m.no === r.no) || { name: '—' };
      /* موعد الملتقى من جدول المعلّم، وتاريخ الحضور من سجلّ الطالب. */
      const when = schedule[r.no];
      const sub = when
        ? `${U.formatDateShort(when)} · ${when >= U.todayKey() ? T('meetupUpcoming') : T('meetupPassed')}`
        : T('meetupNoDate');

      /* Attendance is the teacher's to confirm. */
      const row = el('div.meetup' + (r.attended ? '.is-on' : ''), {},
        el('span.meetup-no', {}, U.num(r.no)),
        el('div.meetup-id', {},
          el('b', {}, def.name),
          el('small', {}, sub)),
        asTeacher
          ? el('button.meetup-toggle' + (r.attended ? '.is-on' : ''), {
              type: 'button',
              onclick: async () => {
                await Meetups.set(userId, r.no, {
                  attended: !r.attended,
                  date: !r.attended ? U.todayKey() : null
                });
                Router.render();
              }
            }, r.attended ? UI.icon('check', 16) : T('meetupAttended'))
          : (r.attended ? UI.badge(T('meetupAttended'), 'ok') : UI.badge('—', 'neutral')));
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  /* ── مقترحات الحفظ ────────────────────────────────────── */
  function suggestionList(userId) {
    return el('div.suggestions', {},
      el('p.hint', {}, T('suggestions') + ' — ' + T('suggestionsHint')),
      el('div.chips.chips--scroll', {}, PROGRAM.poemSuggestions.map(s =>
        el('button.chip', {
          type: 'button',
          onclick: () => openPoemSheet(null, userId, s)
        }, s.title))));
  }

  /* ── محرّر القصيدة ────────────────────────────────────── */
  async function openPoemSheet(existing, userId, preset) {
    const draft = existing
      ? Object.assign({}, existing)
      : { title: (preset && preset.title) || '',
          totalVerses: (preset && preset.verses) || 100,
          fileId: null };

    const body = el('div.form');

    const titleIn = UI.input({ value: draft.title, placeholder: 'مثال: ملحة الإعراب' });
    titleIn.addEventListener('input', () => { draft.title = titleIn.value; });
    body.appendChild(UI.field(T('poemTitle'), titleIn));

    if (!existing) {
      body.appendChild(el('div.chips.chips--scroll', {},
        PROGRAM.poemSuggestions.map(s =>
          el('button.chip', { type: 'button', onclick: () => {
            draft.title = s.title; titleIn.value = s.title;
            if (s.verses) { draft.totalVerses = s.verses; versesIn.value = s.verses; }
          } }, s.title))));
      body.appendChild(el('p.hint', {}, T('suggestionsHint')));
    }

    const versesIn = UI.input({ type: 'number', min: 1, max: 5000,
                                value: draft.totalVerses, inputmode: 'numeric' });
    versesIn.addEventListener('input', () => { draft.totalVerses = +versesIn.value; });
    body.appendChild(UI.field(T('poemVerses'), versesIn,
      'يُحسب المتبقّي تلقائيًا من هذا العدد'));

    /* ملف القصيدة */
    const fileHost = el('div.form');
    async function paintFile() {
      U.clear(fileHost);
      if (draft.fileId) {
        const f = await Files.get(draft.fileId);
        fileHost.appendChild(el('div.filerow', {},
          UI.icon('upload', 16),
          el('span.filerow-name', {}, f ? f.name : '—'),
          UI.button(T('viewFile'), () => ReaderView.viewFile(draft.fileId, draft.title),
            'ghost', { icon: 'book' }),
          UI.iconButton('down', () => Files.open(draft.fileId), { label: T('download') }),
          (() => {
            const b = UI.iconButton('trash', async () => {
              await Files.remove(draft.fileId); draft.fileId = null; paintFile();
            }, { label: T('delete') });
            b.classList.add('iconbtn--danger');
            return b;
          })()));
      } else {
        const picker = el('input', {
          type: 'file', hidden: true,
          accept: '.pdf,.doc,.docx,.txt,.md,image/*,application/pdf',
          onchange: async ev => {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            const saved = await Files.save({ userId, file, kind: 'poem' });
            draft.fileId = saved.id;
            paintFile();
          }
        });
        fileHost.append(
          UI.button(T('uploadPoem'), () => picker.click(), 'ghost', { icon: 'upload' }),
          picker);
      }
    }
    await paintFile();
    body.appendChild(UI.field(T('poemFile'), fileHost, T('optional')));

    UI.sheet({
      title: existing ? T('changePoem') : T('addPoem'), body, wide: true,
      actions: [
        existing
          ? { label: T('delete'), kind: 'danger', onClick: async a => {
              a.close();
              if (!await UI.confirm(T('confirmDelete'), { danger: true })) return;
              await Poems.remove(existing.id);
              UI.toast(T('deleted')); Router.render();
            } }
          : { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            if (!draft.title.trim()) return UI.toast('اكتب اسم القصيدة', 'warn');
            if (existing) await Poems.update(existing.id, {
              title: draft.title.trim(), totalVerses: draft.totalVerses, fileId: draft.fileId
            });
            else await Poems.create({ userId, title: draft.title,
              totalVerses: draft.totalVerses, fileId: draft.fileId });
            a.close(); UI.toast(T('saved')); Router.render();
          } }
      ]
    });
  }

  /* ── محرّر الكتاب ─────────────────────────────────────── */
  async function openBookSheet(existing, userId) {
    const draft = existing
      ? Object.assign({}, existing)
      : { title: '', author: '', totalPages: 100 };

    const body = el('div.form');

    const titleIn = UI.input({ value: draft.title, placeholder: 'اسم الكتاب' });
    titleIn.addEventListener('input', () => { draft.title = titleIn.value; });
    body.appendChild(UI.field(T('bookTitle'), titleIn));

    const authorIn = UI.input({ value: draft.author, placeholder: T('optional') });
    authorIn.addEventListener('input', () => { draft.author = authorIn.value; });
    body.appendChild(UI.field(T('bookAuthor'), authorIn));

    const pagesIn = UI.input({ type: 'number', min: 1, max: 20000,
                               value: draft.totalPages, inputmode: 'numeric' });
    pagesIn.addEventListener('input', () => { draft.totalPages = +pagesIn.value; });
    body.appendChild(UI.field(T('bookPages'), pagesIn,
      'يُحسب المتبقّي تلقائيًا من هذا العدد'));

    UI.sheet({
      title: existing ? T('changeBook') : T('addBook'), body,
      actions: [
        existing
          ? { label: T('delete'), kind: 'danger', onClick: async a => {
              a.close();
              if (!await UI.confirm(T('confirmDelete'), { danger: true })) return;
              await Books.remove(existing.id);
              UI.toast(T('deleted')); Router.render();
            } }
          : { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            if (!draft.title.trim()) return UI.toast('اكتب اسم الكتاب', 'warn');
            if (existing) await Books.update(existing.id, {
              title: draft.title.trim(), author: draft.author.trim(),
              totalPages: draft.totalPages
            });
            else await Books.create({ userId, title: draft.title,
              author: draft.author, totalPages: draft.totalPages });
            a.close(); UI.toast(T('saved')); Router.render();
          } }
      ]
    });
  }

  window.ProgramView = { openPoemSheet, openBookSheet, openLessonSheet };
})();
