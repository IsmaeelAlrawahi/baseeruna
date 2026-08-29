/* ============================================================
   بصائرنا — القرّاء

   No reciter ships with the program. The teacher decides who the
   halaqah listens to, either by naming one from the recitation
   library or by pasting a link of their own.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/t/reciters', {
    role: 'teacher', back: '/t/students',
    title: () => T('recitersPage'),
    actions: () => [UI.iconButton('plus', () => openReciterSheet(), { label: T('addReciter') })],
    render: renderReciters
  });

  async function renderReciters() {
    const page = UI.screen();
    const list = await Reciters.all();

    page.appendChild(el('p.hint', {},
      'هؤلاء هم القرّاء الذين سيجدهم طلابك في صفحة الاستماع. لا يظهر لهم أحد حتى تضيفه.'));

    if (!list.length) {
      page.appendChild(UI.empty(T('noReciters'),
        UI.button(T('addReciter'), () => openReciterSheet(), 'primary', { icon: 'plus' })));
      return page;
    }

    const host = el('div.reciters');
    for (const [i, r] of list.entries()) {
      const files = await Reciters.filesOf(r.id);
      host.appendChild(el('article.reciter', {},
        el('span.reciter-no', {}, U.num(i + 1)),
        el('div.reciter-id', {},
          el('b', {}, r.name),
          el('small', {}, files.length
            ? `${T('sourceFiles')} — ${U.num(files.filter(f => f.surah).length)} سورة`
            : (r.source === 'custom' ? T('customLink') : r.code))),
        el('div.reciter-tools', {},
          UI.iconButton('upload', () => openFilesSheet(r), { label: T('reciterFiles') }),
          UI.iconButton('play', async ev => {
            const btn = ev.currentTarget;
            btn.classList.add('is-busy');
            const res = await Reciters.testable(r);
            btn.classList.remove('is-busy');
            UI.toast(res.ok ? T('reciterWorks') : T('reciterFails'), res.ok ? 'ok' : 'warn');
          }, { label: T('testReciter') }),
          UI.iconButton('edit', () => openReciterSheet(r), { label: T('edit') }),
          (() => {
            const b = UI.iconButton('trash', async () => {
              const yes = await UI.confirm(
                `سيُحذف «${r.name}» من قائمة القرّاء. التسجيلات المحفوظة على الأجهزة تبقى.`,
                { title: T('removeReciter'), danger: true, confirmLabel: T('delete') });
              if (!yes) return;
              await Reciters.remove(r.id);
              UI.toast(T('deleted')); Router.render();
            }, { label: T('delete') });
            b.classList.add('iconbtn--danger');
            return b;
          })())));
    }
    page.appendChild(host);

    page.appendChild(el('div.fab-space'));
    page.appendChild(el('button.fab', {
      type: 'button', onclick: () => openReciterSheet(), 'aria-label': T('addReciter')
    }, UI.icon('plus', 26)));

    return page;
  }

  /* ── add or edit ──────────────────────────────────────── */
  async function openReciterSheet(existing) {
    const me = Session.user;
    const draft = existing ? Object.assign({}, existing) : {
      name: '', source: 'library', code: '', urlTemplate: ''
    };

    const body = el('div.form');

    const nameIn = UI.input({ value: draft.name, placeholder: 'مثال: مشاري راشد العفاسي' });
    nameIn.addEventListener('input', () => { draft.name = nameIn.value; });
    body.appendChild(UI.field(T('reciterName'), nameIn));

    body.appendChild(UI.field(T('reciterSource'), UI.chips([
      { value: 'library', label: T('fromLibrary') },
      { value: 'custom',  label: T('customLink') }
    ], draft.source, v => { draft.source = v; paintSource(); })));

    const sourceHost = el('div.form');
    body.appendChild(sourceHost);

    const status = el('p.hint');
    body.appendChild(status);

    function paintSource() {
      U.clear(sourceHost);

      if (draft.source === 'library') {
        /* A datalist rather than a dropdown: the suggestions save
           typing, but the teacher may enter any code they know. */
        const listId = 'reciter-codes';
        const codeIn = UI.input({ value: draft.code, placeholder: 'ar.alafasy', list: listId });
        const datalist = el('datalist', { id: listId },
          CONFIG.audio.knownSources.map(s =>
            el('option', { value: s.code }, s.name)));

        codeIn.addEventListener('input', () => {
          draft.code = codeIn.value.trim();
          const match = CONFIG.audio.knownSources.find(s => s.code === draft.code);
          if (match && !draft.name) { draft.name = match.name; nameIn.value = match.name; }
        });

        sourceHost.append(UI.field(T('reciterCode'), codeIn, T('reciterCodeHint')), datalist);

        /* One tap fills both fields from a suggestion. */
        sourceHost.appendChild(el('div.chips.chips--scroll',
          {}, CONFIG.audio.knownSources.slice(0, 8).map(s =>
            el('button.chip', { type: 'button', onclick: () => {
              draft.code = s.code; draft.name = s.name;
              codeIn.value = s.code; nameIn.value = s.name;
            } }, s.name))));

      } else {
        const urlIn = UI.input({
          value: draft.urlTemplate, dir: 'ltr',
          placeholder: 'https://example.com/quran/{surah3}.mp3'
        });
        urlIn.addEventListener('input', () => { draft.urlTemplate = urlIn.value.trim(); });
        sourceHost.appendChild(UI.field(T('urlTemplate'), urlIn, T('urlTemplateHint')));
      }

      sourceHost.appendChild(UI.button(T('testReciter'), async ev => {
        status.textContent = T('loading');
        status.className = 'hint';
        const res = await Reciters.testable(draft);
        status.textContent = res.ok
          ? T('reciterWorks') + ' — ' + (res.url || '')
          : T('reciterFails') + (res.status ? ' (' + res.status + ')' : '');
        status.className = res.ok ? 'hint hint--ok' : 'hint hint--warn';
      }, 'ghost', { icon: 'play' }));
    }

    paintSource();

    UI.sheet({
      title: existing ? T('editReciter') : T('addReciter'), body, wide: true,
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            if (!draft.name.trim()) return UI.toast('اكتب اسم القارئ', 'warn');
            if (draft.source === 'library' && !draft.code.trim())
              return UI.toast('اكتب رمز القارئ', 'warn');
            if (draft.source === 'custom' && !draft.urlTemplate.trim())
              return UI.toast('اكتب رابط التلاوة', 'warn');

            if (existing) await Reciters.update(existing.id, draft);
            else await Reciters.create(Object.assign({ teacherId: me.id }, draft));
            a.close(); UI.toast(T('saved')); Router.render();
          } }
      ]
    });
  }

  /* ── ملفات قارئ بعينه ─────────────────────────────────
     كل قارئ معزول عن غيره؛ وما يُرفع يُنسب إلى سوره من أرقام
     أسماء الملفات، فيستطيع المعلّم رفع المصحف كاملًا دفعة واحدة. */
  async function openFilesSheet(reciter) {
    const body = el('div.form');
    const status = el('p.hint');

    const listHost = el('div');
    async function paintList() {
      U.clear(listHost);
      const files = await Reciters.filesOf(reciter.id);
      if (!files.length) {
        listHost.appendChild(el('p.hint', {}, 'لا ملفات لهذا القارئ بعد'));
        return;
      }
      const matched = files.filter(f => f.surah);
      const missing = QURAN.surahs.filter(s => !matched.some(f => f.surah === s.no));

      listHost.append(
        el('p.hint', {}, T('filesSorted', U.num(matched.length))),
        files.some(f => !f.surah)
          ? el('p.hint.hint--warn', {},
              T('filesUnmatched', U.num(files.filter(f => !f.surah).length)))
          : null,
        missing.length
          ? el('p.hint', {}, `${T('surahMissing')}: ${U.num(missing.length)} سورة`)
          : el('p.hint.hint--ok', {}, 'المصحف كامل لهذا القارئ'));

      const grid = el('div.surahdots');
      QURAN.surahs.forEach(s => {
        const has = matched.some(f => f.surah === s.no);
        grid.appendChild(el('i.surahdot' + (has ? '.on' : ''), { title: s.name }, U.num(s.no)));
      });
      listHost.appendChild(grid);

      listHost.appendChild(UI.button(T('removeBookFile'), async () => {
        if (!await UI.confirm(T('confirmDelete'), { danger: true })) return;
        const n = await Reciters.removeFiles(reciter.id);
        UI.toast(T('deleted') + ' — ' + U.num(n));
        paintList(); Router.render();
      }, 'danger', { icon: 'trash' }));
    }
    await paintList();

    const picker = el('input', {
      type: 'file', accept: 'audio/*', multiple: true, hidden: true,
      onchange: async ev => {
        const files = Array.from(ev.target.files || []);
        ev.target.value = '';
        if (!files.length) return;
        status.className = 'hint';
        const res = await Reciters.addFiles(reciter, files, (done, total) => {
          status.textContent = `${U.num(done)} / ${U.num(total)}`;
        });
        status.textContent = T('filesSorted', U.num(res.matched)) +
          (res.unmatched ? ' · ' + T('filesUnmatched', U.num(res.unmatched)) : '');
        UI.toast(T('filesSorted', U.num(res.matched)));
        await paintList();
      }
    });

    body.append(
      el('p.hint', {}, T('reciterFilesHint')),
      UI.button(T('uploadReciterFiles'), () => picker.click(), 'primary', { icon: 'upload' }),
      picker, status, listHost);

    UI.sheet({ title: T('reciterFiles') + ' — ' + reciter.name, body, wide: true,
               actions: [{ label: T('close'), kind: 'ghost' }] });
  }

  window.RecitersView = { openReciterSheet, openFilesSheet };
})();
