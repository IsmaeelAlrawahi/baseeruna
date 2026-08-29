/* ============================================================
   بصائرنا — الكتاب

   يرفع الطالب كتابه ثم يقرؤه داخل البرنامج، وقلبُ الصفحة يدور
   حول كعب الكتاب من اليمين كما يُقلَّب الورق.

   ثلاثة أنواع تُقرأ:
     • PDF        — يُعرض بـ pdf.js المرفقة في vendor/
     • صور صفحات  — صورة لكل صفحة
     • ملفّ نصّي   — يُقسَّم إلى صفحات
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/book', {
    title: () => T('tabBook'),
    render: renderBookPage
  });

  Router.register('/book/read/:bookId', {
    back: '/book', chrome: false,
    render: p => renderReader(p.bookId)
  });

  /* ── تحميل pdf.js عند الحاجة ──────────────────────────── */
  let pdfLoading = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(true);
    if (pdfLoading) return pdfLoading;
    pdfLoading = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'vendor/pdf.min.js';
      s.onload = () => {
        if (window.pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
          resolve(true);
        } else resolve(false);
      };
      s.onerror = () => { pdfLoading = null; resolve(false); };
      document.head.appendChild(s);
    });
    return pdfLoading;
  }

  /* ══════════════════ صفحة الكتاب ═══════════════════════ */
  async function renderBookPage() {
    const me = Session.user;
    const page = UI.screen();
    const book = await Books.active(me.id);

    /* المكتبة أوّلًا: أكثر الطلاب يقرأ ممّا وضعه المعلّم. */
    page.appendChild(UI.card([
      UI.sectionTitle(T('library'),
        UI.button(T('browseLibrary'), () => Router.go('/library'), 'ghost', { icon: 'library' })),
      el('p.hint', {}, 'كتب وضعها معلّمك لتقرأ منها')
    ]));

    if (!book) {
      page.appendChild(UI.card([
        UI.sectionTitle(T('reading')),
        UI.empty(T('noBook'),
          el('div.rowbtns', {},
            UI.button(T('browseLibrary'), () => Router.go('/library'), 'primary', { icon: 'library' }),
            UI.button(T('addBook'), () => ProgramView.openBookSheet(null, me.id),
              'ghost', { icon: 'plus' })))
      ]));
      return page;
    }

    const bp = await Books.progress(book);
    const readable = Books.isReadable(book);

    const card = UI.card([
      UI.sectionTitle(book.title,
        UI.iconButton('edit', () => ProgramView.openBookSheet(book, me.id),
          { label: T('changeBook') }))
    ], 'card--track');

    card.append(
      el('p.hint', {}, [book.author, `${U.num(book.totalPages)} صفحة`]
        .filter(Boolean).join(' · ')),
      UI.remaining(bp.done, book.totalPages, 'صفحة', { color: 'var(--teal-200)' }));

    if (readable) {
      card.append(
        el('p.hint', {},
          `النسخة المرفوعة: ${U.num(Books.readablePages(book))} صفحة · ` +
          `أنت عند ${U.num(book.currentPage || 1)}`),
        UI.button(T('openReader'), () => Router.go('/book/read/' + book.id),
          'primary', { icon: 'book' }));
    }
    card.appendChild(UI.button(readable ? T('bookFile') : T('uploadPdf'),
      () => openUploadSheet(book), 'ghost', { icon: 'upload' }));

    page.appendChild(card);

    /* كتب سابقة */
    const all = await Books.forUser(me.id);
    const past = all.filter(b => !b.active);
    if (past.length) {
      const host = el('div.books');
      past.forEach(b => host.appendChild(el('div.bookrow', {},
        el('div.bookrow-id', {},
          el('b', {}, b.title),
          el('small', {}, `${U.num(b.totalPages)} صفحة`)),
        Books.isReadable(b)
          ? UI.iconButton('book', () => Router.go('/book/read/' + b.id), { label: T('openReader') })
          : null,
        UI.iconButton('check', async () => {
          await Books.update(book.id, { active: false });
          await Books.update(b.id, { active: true });
          UI.toast(T('saved')); Router.render();
        }, { label: 'اجعله الحالي' }))));
      page.appendChild(UI.card([UI.sectionTitle('كتب سابقة'), host]));
    }

    return page;
  }

  /* ══════════════════ القارئ ════════════════════════════ */
  async function renderReader(bookId) {
    /* «lib_…» كتابٌ من المكتبة يُقرأ مباشرة؛ وغيره كتاب الطالب. */
    let book = null, libBook = null;

    if (String(bookId).indexOf('lib_') === 0) {
      libBook = await Library.get(String(bookId).slice(4));
      if (!libBook) return UI.empty('الكتاب غير موجود');
      book = { id: bookId, title: libBook.title, userId: Session.user.id, currentPage: 1 };
    } else {
      book = await DB.get('books', bookId);
      if (!book) return UI.empty('الكتاب غير موجود');
      if (book.libraryId) libBook = await Library.get(book.libraryId);
    }

    const page = el('div.reader');
    let pdfDoc = null;
    let total = 0;
    /* الغلاف صفحةٌ قائمة بنفسها قبل صفحات الكتاب. */
    let coverUrl = null;
    if (libBook && libBook.coverFileId) coverUrl = await Files.url(libBook.coverFileId);
    const coverOffset = coverUrl ? 1 : 0;

    /* ── كتاب المكتبة ─────────────────────────────────── */
    if (libBook) {
      const loading = el('div.reader-loading', {}, UI.loading());
      loading.querySelector('span').textContent = T('pdfLoading');
      page.appendChild(loading);

      const okLib = await loadPdfJs();
      if (!okLib) {
        U.clear(page); page.appendChild(UI.card([UI.empty(T('pdfFailed'))]));
        return page;
      }
      try {
        const src = await Library.source(libBook);
        if (!src) throw new Error('لا ملف لهذا الكتاب');
        pdfDoc = await pdfjsLib.getDocument(src).promise;
        total = pdfDoc.numPages + coverOffset;
        /* عدد صفحات الكتاب يُحفظ ليُعرف بلا فتحه مرة أخرى. */
        if (!libBook.pages) await Library.update(libBook.id, { pages: pdfDoc.numPages });
      } catch (e) {
        U.clear(page);
        page.appendChild(UI.card([UI.empty(T('pdfFailed') + ' — ' + (e.message || ''))]));
        return page;
      }
      loading.remove();

    /* ── تجهيز المصدر ─────────────────────────────────── */
    } else if (book.pdfFileId) {
      const loading = el('div.reader-loading', {}, UI.loading());
      loading.querySelector('span').textContent = T('pdfLoading');
      page.appendChild(loading);

      const okLib = await loadPdfJs();
      if (!okLib) {
        U.clear(page);
        page.appendChild(UI.card([UI.empty(T('pdfFailed'))]));
        return page;
      }
      try {
        const file = await Files.get(book.pdfFileId);
        const buf = await file.blob.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
        total = pdfDoc.numPages;
      } catch (e) {
        U.clear(page);
        page.appendChild(UI.card([UI.empty(T('pdfFailed') + ' — ' + (e.message || ''))]));
        return page;
      }
      loading.remove();
    } else {
      total = Books.readablePages(book);
    }

    if (!total) {
      return UI.screen([UI.card([
        UI.sectionTitle(book.title),
        UI.empty(T('noBookFile'),
          UI.button(T('back'), () => Router.go('/book'), 'ghost'))
      ])]);
    }

    let index = U.clamp((book.currentPage || 1) - 1, 0, total - 1);
    let flipping = false;
    let zoom = 1;
    const rendered = new Map();          /* صفحات PDF المرسومة */

    /* ── شريط علوي ────────────────────────────────────── */
    const posLabel = el('span.reader-pos');
    page.appendChild(el('div.reader-bar', {},
      UI.iconButton('forward', () => Router.go('/book'), { label: T('back') }),
      el('div.reader-title', {}, el('b', {}, book.title), posLabel),
      pdfDoc ? UI.iconButton('down', () => setZoom(zoom - 0.2), { label: T('zoomOut') }) : null,
      pdfDoc ? UI.iconButton('up', () => setZoom(zoom + 0.2), { label: T('zoomIn') }) : null,
      UI.iconButton('check', saveProgress, { label: T('saveReading') })));

    /* ── مسرح الكتاب ──────────────────────────────────── */
    const stage = el('div.book-stage');
    const sheet = el('div.book-sheet');
    const under = el('div.book-under');
    const flip  = el('div.book-flip');
    stage.append(under, sheet, flip);
    page.appendChild(stage);

    /* ── شريط سفلي ────────────────────────────────────── */
    const slider = el('input.reader-slider', { type: 'range', min: 1, max: total, value: index + 1 });
    slider.addEventListener('input', () => {
      const next = +slider.value - 1;
      if (next !== index) { index = next; paint(); }
    });
    page.appendChild(el('div.reader-foot', {},
      UI.iconButton('forward', () => turn(-1), { label: 'السابقة' }),
      slider,
      UI.iconButton('back', () => turn(1), { label: 'التالية' })));

    /* ── رسم صفحة ─────────────────────────────────────── */
    async function pageNode(i) {
      const node = el('div.book-page');

      /* الصفحة الأولى غلافٌ حين يكون للكتاب غلافٌ مختار. */
      if (coverUrl && i === 0) {
        node.classList.add('book-page--cover');
        node.appendChild(el('img.book-cover', { src: coverUrl, alt: book.title }));
        return node;
      }

      if (pdfDoc) {
        const pdfIndex = i - coverOffset;
        let canvas = rendered.get(pdfIndex + '@' + zoom.toFixed(1));
        if (!canvas) {
          const pdfPage = await pdfDoc.getPage(pdfIndex + 1);
          const stageW = Math.max(280, stage.clientWidth - 24);
          const base = pdfPage.getViewport({ scale: 1 });
          const scale = (stageW / base.width) * zoom;
          /* الرسم بدقّة الشاشة ليخرج النصّ حادًّا لا مشوّشًا. */
          const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
          const viewport = pdfPage.getViewport({ scale: scale * dpr });

          canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = (viewport.width / dpr) + 'px';
          canvas.style.height = (viewport.height / dpr) + 'px';
          canvas.className = 'book-canvas';
          await pdfPage.render({
            canvasContext: canvas.getContext('2d', { alpha: false }),
            viewport
          }).promise;

          /* لا نُبقي أكثر من بضع صفحات في الذاكرة. */
          if (rendered.size > 8) rendered.delete(rendered.keys().next().value);
          rendered.set(pdfIndex + '@' + zoom.toFixed(1), canvas);
        }
        const scroller = el('div.book-scroll');
        scroller.appendChild(canvas.cloneNode(true));
        node.appendChild(scroller);

      } else if (book.pageFiles && book.pageFiles.length) {
        const url = await Files.url(book.pageFiles[i]);
        node.appendChild(el('img.book-image', { src: url, alt: `صفحة ${i + 1}` }));

      } else {
        node.appendChild(el('div.book-text', {}, book.textPages[i]));
      }

      node.appendChild(el('span.book-folio', {}, U.num(i + 1)));
      return node;
    }

    async function paint() {
      index = U.clamp(index, 0, total - 1);
      posLabel.textContent = `${U.num(index + 1)} / ${U.num(total)}`;
      slider.value = index + 1;

      /* ريثما تُرسم الصفحة يظهر مكانها، فلا تبقى الشاشة بيضاء. */
      U.clear(sheet);
      sheet.appendChild(el('div.book-page', {}, UI.loading()));
      try {
        const node = await pageNode(index);
        U.clear(sheet); sheet.appendChild(node);
      } catch (e) {
        U.clear(sheet);
        sheet.appendChild(el('div.book-page', {},
          UI.empty(T('pdfFailed') + ' — ' + (e.message || ''))));
        return;
      }
      prefetch(index + 1);
    }

    /* الصفحة التالية تُرسم في الخلفية ليكون القلب سلسًا. */
    function prefetch(i) {
      if (!pdfDoc || i < 0 || i >= total) return;
      setTimeout(() => { pageNode(i).catch(() => {}); }, 120);
    }

    async function setZoom(v) {
      zoom = U.clamp(+v.toFixed(1), 0.6, 3);
      rendered.clear();
      await paint();
    }

    /* ── القلب ────────────────────────────────────────── */
    async function turn(delta) {
      if (flipping) return;
      const next = index + delta;
      if (next < 0 || next >= total) return;
      flipping = true;

      U.clear(under);
      under.appendChild(await pageNode(next));

      U.clear(flip);
      flip.appendChild(await pageNode(delta > 0 ? index : next));
      flip.className = 'book-flip is-' + (delta > 0 ? 'forward' : 'back');

      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      flip.classList.add('is-turning');
      await new Promise(r => setTimeout(r, 620));

      index = next;
      await paint();
      flip.className = 'book-flip';
      U.clear(flip); U.clear(under);
      flipping = false;
    }

    /* ── اللمس والمفاتيح ──────────────────────────────── */
    let x0 = null, y0 = null;
    stage.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; });
    stage.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      /* السحب رأسيًّا تمرير داخل الصفحة، لا قلبٌ لها. */
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (Math.abs(dx) > 55) { turn(dx > 0 ? -1 : 1); return; }
      const rect = stage.getBoundingClientRect();
      turn((e.clientX - rect.left) < rect.width / 2 ? 1 : -1);
    });

    const onKey = ev => {
      if (ev.key === 'ArrowLeft') turn(1);
      if (ev.key === 'ArrowRight') turn(-1);
      if (ev.key === 'Escape') Router.go('/book');
    };
    document.addEventListener('keydown', onKey);
    const stopKeys = () => document.removeEventListener('keydown', onKey);
    /* تُنزع حين يُبدَّل محتوى الشاشة. */
    new MutationObserver((m, obs) => {
      if (!document.body.contains(page)) { stopKeys(); obs.disconnect(); }
    }).observe(document.getElementById('screen'), { childList: true });

    async function saveProgress() {
      /* كتاب المكتبة يُقرأ مباشرةً بلا سجلّ شخصي — لا موضع يُحفظ. */
      if (String(book.id).indexOf('lib_') === 0) {
        UI.toast(T('chooseThisBookFirst'), 'warn');
        return;
      }
      const startedAt = book.currentPage || 1;
      await Books.setPage(book.id, index + 1);
      UI.toast(T('readingSaved', U.num(index + 1)));

      if (Session.isStudent && ProgramDays.isProgramDay(U.todayKey())) {
        const delta = Math.max(0, (index + 1) - startedAt);
        if (!delta) return;
        const yes = await UI.confirm(T('addToReportAsk', U.num(delta)),
          { title: T('dailyReport'), confirmLabel: T('save') });
        if (!yes) return;
        const rec = await Reports.get(Session.user.id, U.todayKey());
        const before = (rec.reading && rec.reading.bookId === book.id)
          ? (+rec.reading.pages || 0) : 0;
        await Reports.save(Session.user.id, U.todayKey(), {
          reading: { bookId: book.id, pages: before + delta }
        });
        UI.toast(T('reportSaved'));
      }
    }

    /* لا تُنتظر أول صفحة: تظهر الواجهة أوّلًا ثم تُرسم فيها،
       فلا يقف الطالب أمام شاشة فارغة إن ثقُل الملف. */
    paint();
    return page;
  }

  /* ══════════════════ رفع النسخة ════════════════════════ */
  async function openUploadSheet(book) {
    const body = el('div.form');
    const status = el('p.hint');
    body.appendChild(el('p.hint', {}, T('bookFileHint')));

    const picker = (accept, multiple, handler) => {
      const input = el('input', {
        type: 'file', accept, multiple, hidden: true,
        onchange: async ev => {
          const files = Array.from(ev.target.files || []);
          ev.target.value = '';
          if (!files.length) return;
          status.textContent = T('loading');
          try { await handler(files); }
          catch (e) { status.textContent = (e && e.message) || T('pdfFailed'); }
        }
      });
      return input;
    };

    const pdfPicker = picker('application/pdf,.pdf', false, async files => {
      const saved = await Files.save({ userId: book.userId, file: files[0], kind: 'book-pdf' });
      await Books.update(book.id, {
        pdfFileId: saved.id, pageFiles: [], textFileId: null, textPages: null, currentPage: 1
      });
      UI.toast(T('saved'));
      Router.render();
    });

    const imgPicker = picker('image/*', true, async files => {
      files.sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
      const ids = [];
      for (const f of files) ids.push((await Files.save({
        userId: book.userId, file: f, kind: 'book-page' })).id);
      await Books.update(book.id, {
        pageFiles: (book.pageFiles || []).concat(ids),
        pdfFileId: null, textFileId: null, textPages: null
      });
      UI.toast(T('pagesAdded', U.num(ids.length)));
      Router.render();
    });

    const txtPicker = picker('.txt,.md,text/plain', false, async files => {
      const text = await files[0].text();
      const pages = Books.paginate(text);
      if (!pages.length) throw new Error('الملف فارغ');
      const saved = await Files.save({ userId: book.userId, file: files[0], kind: 'book-text' });
      await Books.update(book.id, {
        textFileId: saved.id, textPages: pages, pageFiles: [], pdfFileId: null
      });
      UI.toast(T('pagesAdded', U.num(pages.length)));
      Router.render();
    });

    body.append(
      UI.button(T('uploadPdf'), () => pdfPicker.click(), 'primary', { icon: 'upload' }),
      UI.button(T('uploadPages'), () => imgPicker.click(), 'ghost', { icon: 'upload' }),
      UI.button(T('uploadText'), () => txtPicker.click(), 'ghost', { icon: 'upload' }),
      pdfPicker, imgPicker, txtPicker, status);

    if (Books.isReadable(book)) {
      body.appendChild(el('div.rowbtns', {},
        UI.button(T('openReader'), () => Router.go('/book/read/' + book.id),
          'primary', { icon: 'book' }),
        UI.button(T('removeBookFile'), async () => {
          if (!await UI.confirm(T('confirmDelete'), { danger: true })) return;
          for (const id of (book.pageFiles || [])) await Files.remove(id);
          if (book.textFileId) await Files.remove(book.textFileId);
          if (book.pdfFileId) await Files.remove(book.pdfFileId);
          await Books.update(book.id, {
            pageFiles: [], textFileId: null, textPages: null, pdfFileId: null
          });
          UI.toast(T('deleted')); Router.render();
        }, 'danger', { icon: 'trash' })));
    }

    UI.sheet({ title: T('bookFile') + ' — ' + book.title, body, wide: true,
               actions: [{ label: T('close'), kind: 'ghost' }] });
  }

  /* ══════════════════ عرض ملفٍ مرفوع ════════════════════
     الملخّصات وملفات القصائد تُقرأ داخل البرنامج لا تُنزَّل فقط:
     PDF بصفحاته، والصور كما هي، والنصّ مقروءًا.
     ═══════════════════════════════════════════════════════ */
  async function viewFile(fileId, title) {
    const file = await Files.get(fileId);
    if (!file) return UI.toast('الملف غير موجود', 'warn');

    const body = el('div.fileview');
    const mime = file.mime || '';
    const name = file.name || '';
    const isPdf = /pdf/i.test(mime) || /\.pdf$/i.test(name);
    const isImg = /^image\//i.test(mime) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
    const isTxt = /^text\//i.test(mime) || /\.(txt|md)$/i.test(name);

    const dialog = UI.sheet({
      title: title || name, body, wide: true,
      actions: [
        { label: T('download'), kind: 'ghost', onClick: () => Files.open(fileId) },
        { label: T('close'), kind: 'ghost' }
      ]
    });

    if (isImg) {
      const url = URL.createObjectURL(file.blob);
      body.appendChild(el('img.fileview-img', { src: url, alt: name }));

    } else if (isTxt) {
      const text = await file.blob.text();
      body.appendChild(el('div.fileview-text', {}, text));

    } else if (isPdf) {
      body.appendChild(UI.loading());
      const okLib = await loadPdfJs();
      U.clear(body);
      if (!okLib) { body.appendChild(UI.empty(T('pdfFailed'))); return; }

      try {
        const buf = await file.blob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        let page = 1;

        const canvasHost = el('div.fileview-pdf');
        const label = el('span.reader-pos');
        const nav = el('div.fileview-nav', {},
          UI.iconButton('forward', () => go(page - 1), { label: 'السابقة' }),
          label,
          UI.iconButton('back', () => go(page + 1), { label: 'التالية' }));
        body.append(nav, canvasHost);

        async function draw() {
          const pdfPage = await doc.getPage(page);
          const width = Math.max(280, body.clientWidth - 8);
          const base = pdfPage.getViewport({ scale: 1 });
          const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
          const viewport = pdfPage.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          canvas.style.width = '100%'; canvas.style.height = 'auto';
          await pdfPage.render({
            canvasContext: canvas.getContext('2d', { alpha: false }), viewport
          }).promise;
          U.clear(canvasHost); canvasHost.appendChild(canvas);
          label.textContent = `${U.num(page)} / ${U.num(doc.numPages)}`;
        }
        function go(n) {
          page = U.clamp(n, 1, doc.numPages);
          draw();
        }
        await draw();
      } catch (e) {
        U.clear(body);
        body.appendChild(UI.empty(T('pdfFailed') + ' — ' + (e.message || '')));
      }

    } else {
      body.appendChild(UI.empty(T('cannotPreview'),
        UI.button(T('download'), () => Files.open(fileId), 'primary', { icon: 'down' })));
    }
  }

  window.ReaderView = { openUploadSheet, loadPdfJs, viewFile };
})();
