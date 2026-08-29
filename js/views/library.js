/* ============================================================
   بصائرنا — مكتبة الحلقة

   المعلّم يضع الكتاب مرةً واحدة، فيقرؤه كل طالب من داخل البرنامج.
   وأول صفحة غلاف: يُرسم من أول صفحة الكتاب نفسه، وللمعلّم أن
   يستبدله بصورة يختارها.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/library', {
    title: () => T('library'),
    actions: () => Session.isTeacher
      ? [UI.iconButton('plus', () => openBookSheet(), { label: T('addLibraryBook') })]
      : [],
    render: renderLibrary
  });

  async function renderLibrary() {
    const me = Session.user;
    const page = UI.screen();
    const books = await Library.all();
    const mine = Session.isStudent ? await Books.active(me.id) : null;

    page.appendChild(el('p.hint', {}, Session.isTeacher
      ? 'ما تضعه هنا يجده كل طلابك في صفحة الكتاب.'
      : 'اختر كتابًا لتقرأه، ويُحسب ما تقرؤه منه في تقريرك.'));

    if (!books.length) {
      page.appendChild(UI.empty(T('libraryEmpty'),
        Session.isTeacher
          ? UI.button(T('addLibraryBook'), () => openBookSheet(), 'primary', { icon: 'plus' })
          : null));
      return page;
    }

    const grid = el('div.shelf');
    for (const b of books) {
      const isCurrent = mine && mine.libraryId === b.id;
      const card = el('article.shelfbook' + (isCurrent ? '.is-current' : ''));

      const cover = el('div.shelfbook-cover');
      card.appendChild(cover);
      paintCover(cover, b);

      card.appendChild(el('div.shelfbook-id', {},
        el('b', {}, b.title),
        b.author ? el('small', {}, b.author) : null,
        isCurrent ? UI.badge(T('currentBook'), 'ok') : null));

      const tools = el('div.shelfbook-tools');
      tools.appendChild(UI.button(T('openReader'),
        () => Router.go('/book/read/lib_' + b.id), 'ghost', { icon: 'book' }));

      if (Session.isStudent) {
        tools.appendChild(UI.button(isCurrent ? T('currentBook') : T('chooseThisBook'),
          () => chooseBook(b), isCurrent ? 'ok' : 'primary',
          { icon: 'check', disabled: isCurrent }));
      }
      if (Session.isTeacher) {
        tools.append(
          UI.iconButton('edit', () => openBookSheet(b), { label: T('edit') }),
          (() => {
            const x = UI.iconButton('trash', async () => {
              if (!await UI.confirm(T('confirmDelete'), { danger: true })) return;
              await Library.remove(b.id);
              UI.toast(T('deleted')); Router.render();
            }, { label: T('delete') });
            x.classList.add('iconbtn--danger');
            return x;
          })());
      }
      card.appendChild(tools);
      grid.appendChild(card);
    }
    page.appendChild(grid);

    if (Session.isTeacher) {
      page.appendChild(el('div.fab-space'));
      page.appendChild(el('button.fab', {
        type: 'button', onclick: () => openBookSheet(), 'aria-label': T('addLibraryBook')
      }, UI.icon('plus', 26)));
    }
    return page;
  }

  /* ── الغلاف ───────────────────────────────────────────
     صورةٌ اختارها المعلّم، وإلا فأول صفحة من الكتاب تُرسم. */
  async function paintCover(host, book) {
    U.clear(host);

    if (book.coverFileId) {
      const url = await Files.url(book.coverFileId);
      if (url) { host.appendChild(el('img', { src: url, alt: book.title })); return; }
    }

    host.appendChild(el('span.shelfbook-spine', {}, UI.icon('library', 20)));
    try {
      const canvas = await renderFirstPage(book, 300);
      if (canvas) { U.clear(host); host.appendChild(canvas); }
    } catch (e) { /* يبقى الرمز مكان الغلاف */ }
  }

  /* أول صفحة من الكتاب كصورة — للغلاف وللمعاينة. */
  async function renderFirstPage(book, width) {
    const okLib = await ReaderView.loadPdfJs();
    if (!okLib) return null;
    const src = await Library.source(book);
    if (!src) return null;

    const doc = await pdfjsLib.getDocument(src).promise;
    const pdfPage = await doc.getPage(1);
    const base = pdfPage.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pdfPage.getViewport({ scale: (width / base.width) * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    canvas.style.width = '100%'; canvas.style.height = 'auto';
    await pdfPage.render({
      canvasContext: canvas.getContext('2d', { alpha: false }), viewport
    }).promise;
    return canvas;
  }

  /* ── الطالب يختار كتابًا ──────────────────────────────── */
  async function chooseBook(libBook, quiet) {
    const me = Session.user;
    const existing = (await Books.forUser(me.id)).find(b => b.libraryId === libBook.id);

    if (existing) {
      const current = await Books.active(me.id);
      if (current && current.id !== existing.id) await Books.update(current.id, { active: false });
      await Books.update(existing.id, { active: true });
    } else {
      let pages = libBook.pages;
      if (!pages) {
        /* عدد الصفحات يُعرف من الملف نفسه إن لم يكتبه المعلّم. */
        try {
          const okLib = await ReaderView.loadPdfJs();
          const src = okLib ? await Library.source(libBook) : null;
          if (src) pages = (await pdfjsLib.getDocument(src).promise).numPages;
        } catch (e) { pages = 0; }
      }
      await Books.create({
        userId: me.id, title: libBook.title, author: libBook.author,
        totalPages: Math.max(1, pages || 1), libraryId: libBook.id
      });
    }
    UI.toast(T('bookChosen'));
    if (!quiet) Router.go('/book');
  }

  /* ── المعلّم يضيف كتابًا ──────────────────────────────── */
  async function openBookSheet(existing) {
    const me = Session.user;
    const draft = existing ? Object.assign({}, existing) : {
      title: '', author: '', note: '', pages: 0,
      fileId: null, url: null, coverFileId: null
    };

    const body = el('div.form');
    const status = el('p.hint');

    const titleIn = UI.input({ value: draft.title, placeholder: 'اسم الكتاب' });
    titleIn.addEventListener('input', () => { draft.title = titleIn.value; });
    body.appendChild(UI.field(T('bookTitle'), titleIn));

    const authorIn = UI.input({ value: draft.author, placeholder: T('optional') });
    authorIn.addEventListener('input', () => { draft.author = authorIn.value; });
    body.appendChild(UI.field(T('bookAuthor'), authorIn));

    /* ملفّ الكتاب */
    const fileHost = el('div.form');
    async function paintFile() {
      U.clear(fileHost);
      if (draft.fileId || draft.url) {
        const f = draft.fileId ? await Files.get(draft.fileId) : null;
        fileHost.appendChild(el('div.filerow', {},
          UI.icon('book', 16),
          el('span.filerow-name', {}, f ? f.name : (draft.url || '')),
          el('small', {}, f ? U.bytes(f.size) : T('bundledFile')),
          draft.fileId ? (() => {
            const x = UI.iconButton('trash', async () => {
              await Files.remove(draft.fileId); draft.fileId = null; paintFile();
            }, { label: T('delete') });
            x.classList.add('iconbtn--danger');
            return x;
          })() : null));
      } else {
        const picker = el('input', {
          type: 'file', accept: 'application/pdf,.pdf', hidden: true,
          onchange: async ev => {
            const f = ev.target.files && ev.target.files[0];
            ev.target.value = '';
            if (!f) return;
            status.textContent = T('loading');
            const saved = await Files.save({ userId: me.id, file: f, kind: 'library' });
            draft.fileId = saved.id; draft.url = null;
            status.textContent = '';
            paintFile();
          }
        });
        fileHost.append(UI.button(T('uploadPdf'), () => picker.click(), 'primary', { icon: 'upload' }), picker);
      }
    }
    await paintFile();
    body.appendChild(UI.field(T('bookFile'), fileHost));

    /* الغلاف */
    const coverHost = el('div.coveredit');
    async function paintCoverEdit() {
      U.clear(coverHost);
      const box = el('div.coveredit-box');
      coverHost.appendChild(box);

      if (draft.coverFileId) {
        const url = await Files.url(draft.coverFileId);
        box.appendChild(el('img', { src: url, alt: '' }));
      } else if (draft.fileId || draft.url) {
        box.appendChild(el('span.hint', {}, T('coverFromFirstPage')));
        renderFirstPage(draft, 220).then(c => {
          if (c && !draft.coverFileId) { U.clear(box); box.appendChild(c); }
        }).catch(() => {});
      } else {
        box.appendChild(el('span.hint', {}, T('noCoverYet')));
      }

      const picker = el('input', {
        type: 'file', accept: 'image/*', hidden: true,
        onchange: async ev => {
          const f = ev.target.files && ev.target.files[0];
          ev.target.value = '';
          if (!f) return;
          const shrunk = await Cover.fromFile(f);
          const saved = await Files.save({
            userId: me.id, file: new File([shrunk], 'cover.jpg', { type: 'image/jpeg' }),
            kind: 'cover', name: 'cover.jpg'
          });
          if (draft.coverFileId) await Files.remove(draft.coverFileId);
          draft.coverFileId = saved.id;
          UI.toast(T('coverSaved'));
          paintCoverEdit();
        }
      });

      coverHost.appendChild(el('div.rowbtns', {},
        UI.button(T('changeCover'), () => picker.click(), 'ghost', { icon: 'upload' }),
        draft.coverFileId ? UI.button(T('resetCover'), async () => {
          await Files.remove(draft.coverFileId);
          draft.coverFileId = null;
          paintCoverEdit();
        }, 'ghost') : null,
        picker));
    }
    await paintCoverEdit();
    body.appendChild(UI.field(T('bookCover'), coverHost, T('coverHint')));

    const noteIn = UI.input({ value: draft.note, placeholder: T('optional') });
    noteIn.addEventListener('input', () => { draft.note = noteIn.value; });
    body.appendChild(UI.field(T('notes'), noteIn));
    body.appendChild(status);

    UI.sheet({
      title: existing ? T('edit') : T('addLibraryBook'), body, wide: true,
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            if (!draft.title.trim()) return UI.toast('اكتب اسم الكتاب', 'warn');
            if (!draft.fileId && !draft.url) return UI.toast('ارفع ملف الكتاب', 'warn');
            const fields = {
              title: draft.title.trim(), author: draft.author.trim(),
              note: draft.note.trim(), fileId: draft.fileId, url: draft.url,
              coverFileId: draft.coverFileId
            };
            if (existing) await Library.update(existing.id, fields);
            else await Library.create(Object.assign({ teacherId: me.id }, fields));
            a.close(); UI.toast(T('saved')); Router.render();
          } }
      ]
    });
  }

  /* الغلاف يُصغَّر قبل حفظه، فصورة الجوال تملأ مساحة الطالب. */
  window.Cover = {
    async fromFile(file) {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i); i.onerror = rej; i.src = url;
        });
        const W = 600;
        const scale = Math.min(1, W / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        return await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      } finally { URL.revokeObjectURL(url); }
    }
  };

  /* ── اختيار كتاب القراءة ──────────────────────────────
     من ثلاثة أبواب: كتب المكتبة، أو ما سبق أن قرأه الطالب،
     أو كتابٌ جديد يكتبه بنفسه.
     ─────────────────────────────────────────────────────── */
  async function openBookPicker(userId, onPicked) {
    const [libBooks, myBooks, current] = await Promise.all([
      Library.all(), Books.forUser(userId), Books.active(userId)
    ]);

    const body = el('div.form');
    const done = async () => { picker.close(); if (onPicked) await onPicked(); else Router.render(); };
    let picker = null;

    /* ── من المكتبة ───────────────────────────────────── */
    const libHost = el('div.picklist');
    if (libBooks.length) {
      libBooks.forEach(b => {
        const isCurrent = current && current.libraryId === b.id;
        libHost.appendChild(el('button.pickrow' + (isCurrent ? '.is-current' : ''), {
          type: 'button', disabled: isCurrent,
          onclick: async () => { await chooseBook(b, true); await done(); }
        },
          el('span.pickrow-icon', {}, UI.icon('library', 16)),
          el('span.pickrow-text', {},
            el('b', {}, b.title),
            el('small', {}, [b.author, b.pages ? `${U.num(b.pages)} صفحة` : null]
              .filter(Boolean).join(' · ') || T('library'))),
          isCurrent ? UI.badge(T('currentBook'), 'ok') : null));
      });
    } else {
      libHost.appendChild(el('p.hint', {}, T('libraryEmpty')));
    }
    body.appendChild(UI.field(T('fromLibrary2'), libHost));

    /* ── من كتبي ──────────────────────────────────────── */
    const others = myBooks.filter(b => !b.active);
    if (others.length) {
      const mineHost = el('div.picklist');
      others.forEach(b => {
        mineHost.appendChild(el('button.pickrow', {
          type: 'button',
          onclick: async () => {
            if (current) await Books.update(current.id, { active: false });
            await Books.update(b.id, { active: true });
            UI.toast(T('bookChosen'));
            await done();
          }
        },
          el('span.pickrow-icon', {}, UI.icon('book', 16)),
          el('span.pickrow-text', {},
            el('b', {}, b.title),
            el('small', {}, `${U.num(b.currentPage || 1)} / ${U.num(b.totalPages)} صفحة`))));
      });
      body.appendChild(UI.field(T('fromMyBooks'), mineHost));
    }

    /* ── كتاب جديد ────────────────────────────────────── */
    body.appendChild(UI.button(T('newBook'), () => {
      picker.close();
      ProgramView.openBookSheet(null, userId);
    }, 'primary', { icon: 'plus' }));

    picker = UI.sheet({ title: T('chooseBook'), body, wide: true,
                        actions: [{ label: T('cancel'), kind: 'ghost' }] });
  }

  window.LibraryView = {
    openBookSheet, renderFirstPage, chooseBook, paintCover, openBookPicker
  };
})();
