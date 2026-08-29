/* ============================================================
   بصائرنا — قراءة المصحف

   الصفحة كما في المصحف المطبوع: نصٌّ واحد يملأ الصفحة، وفوقه
   الجزء والحزب واسم السورة، وتحته رقم الصفحة في زخرفته.

   ولا تكبير ولا تصغير: حجم الخط يُحسب ليملأ الصفحة كما هي —
   كل صفحة بمقاسها كما في المصحف.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/read', {
    title: () => T('readQuran'),
    actions: () => [UI.iconButton('search', () => openSearch(), { label: T('search') })],
    render: () => renderMushaf(null)
  });
  Router.register('/read/p/:page', {
    title: () => T('readQuran'),
    actions: () => [UI.iconButton('search', () => openSearch(), { label: T('search') })],
    render: p => renderMushaf(+p.page)
  });
  /* رابط قديم بالسورة — يُحوَّل إلى صفحتها */
  Router.register('/read/:surah', {
    render: async p => {
      await loadText();
      const s = QURAN.get(U.clamp(+p.surah, 1, 114));
      Router.go('/read/p/' + (s ? s.page : 1), { replace: true });
      return el('div');
    }
  });

  /* ── تحميل النصّ عند الحاجة ───────────────────────────── */
  let textLoading = null;
  function loadText() {
    if (window.QURAN_TEXT) return Promise.resolve(true);
    if (textLoading) return textLoading;
    textLoading = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'js/quran-text.js';
      s.onload = () => resolve(true);
      s.onerror = () => { textLoading = null; resolve(false); };
      document.head.appendChild(s);
    });
    return textLoading;
  }

  /* ربع الحزب كما يُكتب في رأس المصحف: ١/٤ الحزب ٩ */
  function hizbLabel(meta) {
    const fracs = ['١/٤', '٢/٤', '٣/٤', '٤/٤'];
    return `${fracs[meta.quarter - 1]} ${T('hizb')} ${U.num(meta.hizb)}`;
  }

  async function renderMushaf(pageNo) {
    const me = Session.user;
    const page = UI.screen(null, 'page--mushaf');

    const loader = UI.loading();
    loader.querySelector('span').textContent = T('loadingMushaf');
    page.appendChild(loader);

    const okText = await loadText();
    loader.remove();
    if (!okText) {
      page.appendChild(UI.card([UI.empty('تعذّر تحميل نصّ المصحف')]));
      return page;
    }

    if (!pageNo) pageNo = (await DB.setting('lastMushafPage')) || 1;
    pageNo = U.clamp(pageNo, 1, 604);
    await DB.setting('lastMushafPage', pageNo);

    /* ما يخصّ هذا الطالب */
    const [goal, entries] = await Promise.all([
      Goals.activeFor(me.id), Entries.forUser(me.id)
    ]);
    const cov = QURAN.coverage(entries.filter(e => e.type !== 'tilawah')
      .map(e => ({ surah: e.surah, from: e.from, to: e.to })));
    const span = goal ? Goals.span(goal) : null;
    const portion = goal ? Goals.dayPortion(goal) : null;

    const [from, to] = QURAN_TEXT.pageRange(pageNo);
    const meta = QURAN_TEXT.pageMeta(pageNo);

    /* أسماء السور الواقعة في هذه الصفحة */
    const surahsHere = [];
    for (let abs = from; abs <= to; abs++) {
      const { surah } = QURAN.fromAbsolute(abs);
      if (surahsHere[surahsHere.length - 1] !== surah) surahsHere.push(surah);
    }

    /* ── إطار الصفحة ──────────────────────────────────── */
    const frame = el('div.mushaf-frame');

    frame.appendChild(el('div.mushaf-topline', {},
      el('span', {}, `${T('juzNo', U.num(meta.juz))} ، ${hizbLabel(meta)}`),
      el('span', {}, surahsHere.map(n => QURAN.get(n).name).join(' · '))));

    const body = el('div.mushaf-body');
    frame.appendChild(body);

    for (let abs = from; abs <= to; abs++) {
      const { surah, ayah } = QURAN.fromAbsolute(abs);

      /* عنوان السورة والبسملة في موضعهما ولو في وسط الصفحة */
      if (ayah === 1) {
        const s = QURAN.get(surah);
        body.appendChild(el('div.mushaf-surahtitle', {}, el('span', {}, s.fullName)));
        if (surah !== 1 && surah !== 9) {
          body.appendChild(el('div.mushaf-basmala', {}, QURAN_TEXT.BASMALA));
        }
      }

      const isMem = inMerged(cov.merged, abs);
      const inGoal = span ? (abs >= span.from && abs <= span.to) : false;
      const inToday = portion ? (abs >= portion.from && abs <= portion.to) : false;

      /* لا تحديد ولا نقر: الصفحة للقراءة، فلا يعترض النصَّ شيء. */
      body.appendChild(el('span.ayah-text' +
        (isMem ? '.is-mem' : '') + (inGoal ? '.in-goal' : '') + (inToday ? '.in-today' : ''), {
        dataset: { abs: String(abs), surah: String(surah), ayah: String(ayah) }
      },
        el('span.ayah-words', {}, QURAN_TEXT.ayah(surah, ayah)),
        el('span.ayah-mark', {}, U.num(ayah))));
    }

    frame.appendChild(el('div.mushaf-footline', {},
      el('span.mushaf-folio', {}, U.num(pageNo))));

    page.appendChild(frame);

    /* ── نصيب اليوم إن كان في هذه الصفحة ──────────────── */
    if (portion && portion.to >= from && portion.from <= to) {
      page.insertBefore(el('div.mushaf-portion', {},
        UI.icon('star', 14),
        el('span', {}, `${T('todayPortion')}: ${portion.label}`)), frame);
    }

    /* ── ملء الصفحة ───────────────────────────────────
       لا تكبير ولا تصغير: يُبحث عن أكبر خطّ يسع الصفحة كاملة
       بلا تمرير، فتخرج كصفحة المصحف المطبوع.                 */
    function fitToPage() {
      const avail = body.clientHeight;
      /* الصفحة قد لا تكون قد وُضعت في الشاشة بعد، فلا مقاس لها. */
      if (!avail) return false;

      let lo = 0.7, hi = 3.4, best = lo;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        body.style.setProperty('--ayah-size', mid.toFixed(3) + 'rem');
        if (body.scrollHeight <= avail) { best = mid; lo = mid; } else hi = mid;
      }
      body.style.setProperty('--ayah-size', best.toFixed(3) + 'rem');
      /* القياس الأخير هو الحَكَم — ويُعاد أخذ الارتفاع في كل مرة
         لأن الحاوية نفسها قد تتغيّر بينما نُجرّب. */
      let guard = 0;
      while (body.scrollHeight > body.clientHeight && best > 0.7 && guard++ < 20) {
        best -= 0.05;
        body.style.setProperty('--ayah-size', best.toFixed(3) + 'rem');
      }
      body.classList.add('is-fitted');
      return true;
    }

    /* ثلاثة أشياء تُفسد القياس إن سُبقت:
       ١) المُوجِّه يضع الصفحة في الشاشة بعد أن ينتهي هذا الرسم،
          فلا ارتفاع لها قبل ذلك.
       ٢) خطّ المصحف يصل من الشبكة متأخّرًا، فيكبر النصّ بعد قياسه.
       ٣) الشاشة تدور أو يتغيّر مقاسها.
       فيُنتظر الأول والثاني، ويُراقَب الثالث.
       ومهلةٌ لا إطار عرض: requestAnimationFrame لا يعمل في تبويب
       مخفيّ، فتبقى الصفحة بلا قياس حتى ينظر إليها الطالب.       */
    let tries = 0;
    (function whenMeasurable() {
      if (fitToPage() || ++tries > 60) return;
      setTimeout(whenMeasurable, 50);
    })();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { fitToPage(); });
      /* خطّ المصحف بعينه، فقد يصل بعد بقيّة الخطوط. */
      if (document.fonts.load) {
        document.fonts.load('1rem "Amiri Quran"').then(() => fitToPage()).catch(() => {});
      }
    }

    const refit = U.debounce(fitToPage, 160);
    window.addEventListener('resize', refit);
    /* تبويبٌ مخفيّ لا يُخطّط صفحته، فيُعاد القياس حين يُنظر إليه. */
    document.addEventListener('visibilitychange', refit);
    const ro = new ResizeObserver(refit);
    ro.observe(body);

    new MutationObserver((m, obs) => {
      if (!document.body.contains(page)) {
        window.removeEventListener('resize', refit);
        document.removeEventListener('visibilitychange', refit);
        ro.disconnect(); obs.disconnect();
      }
    }).observe(document.getElementById('screen'), { childList: true });

    /* ── تقليب الصفحات ────────────────────────────────── */
    let x0 = null, y0 = null;
    frame.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; });
    frame.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
      /* عربي: السحب يمينًا يرجع، ويسارًا يتقدّم. */
      go(pageNo + (dx > 0 ? -1 : 1));
    });

    page.appendChild(el('div.mushaf-nav', {},
      UI.iconButton('forward', () => go(pageNo - 1),
        { label: T('prevPage'), disabled: pageNo <= 1 }),
      el('span.mushaf-navlabel', {}, `${T('pageNo', U.num(pageNo))} / ${U.num(604)}`),
      UI.iconButton('back', () => go(pageNo + 1),
        { label: T('nextPage'), disabled: pageNo >= 604 })));

    function go(n) {
      n = U.clamp(n, 1, 604);
      if (n !== pageNo) Router.go('/read/p/' + n);
    }

    /* آية طُلبت من البحث تُبرَز فور الوصول */
    const jump = await DB.setting('jumpToAyah');
    if (jump && jump >= from && jump <= to) {
      await DB.setting('jumpToAyah', null);
      setTimeout(() => {
        const node = body.querySelector(`.ayah-text[data-abs="${jump}"]`);
        if (!node) return;
        node.classList.add('is-found');
        setTimeout(() => node.classList.remove('is-found'), 2800);
      }, 300);
    }

    return page;
  }

  /* ══════════════════ البحث ═════════════════════════════
     شاشة مستقلّة: الرقم يعطيك السورة والجزء والحزب والصفحة،
     والكلمة تعطيك كل موضع وردت فيه.
     ═══════════════════════════════════════════════════════ */
  async function openSearch() {
    await loadText();

    const overlay = el('div.searchpage');
    const input = UI.input({
      type: 'search', placeholder: T('mushafSearchPlaceholder'),
      autocomplete: 'off', enterkeyhint: 'search'
    });
    const results = el('div.searchbody');

    overlay.append(
      el('div.searchbar', {},
        input,
        el('button.searchcancel', { type: 'button', onclick: close }, T('cancel'))),
      results);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.classList.add('in'); input.focus(); });

    function close() {
      overlay.classList.remove('in');
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    input.addEventListener('input', U.debounce(() => run(input.value), 200));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') run(input.value); });

    function goTo(page, abs) {
      if (abs) DB.setting('jumpToAyah', abs);
      close();
      Router.go('/read/p/' + page);
    }

    function run(query) {
      U.clear(results);
      const q = (query || '').trim();
      if (!q) return;

      const digits = normalizeDigits(q);

      /* ── رقم مجرّد: سورة وجزء وحزب وصفحة ────────────── */
      if (/^\d{1,3}$/.test(digits)) {
        const n = +digits;

        if (n >= 1 && n <= 114) {
          const s = QURAN.get(n);
          results.appendChild(el('p.search-count', {}, T('resultCount', U.num(1))));
          results.appendChild(el('button.surahcard', {
            type: 'button', onclick: () => goTo(s.page, QURAN.absoluteIndex(n, 1))
          },
            el('b', {}, s.fullName),
            el('div.surahcard-meta', {},
              el('span', {}, `${T('suraNumber')} ${U.num(s.no)}`),
              el('span', {}, `${T('pageNumber')} ${U.num(s.page)}`),
              el('span', {}, `${T('ayaCount')} ${U.num(s.ayahs)}`),
              el('span', {}, s.revelation))));
        }

        /* المواضع: بداية السورة، والجزء، والحزب، والصفحة */
        const jumps = [];
        if (n >= 1 && n <= 114) {
          const s = QURAN.get(n);
          jumps.push({ abs: QURAN.absoluteIndex(n, 1), page: s.page, note: s.fullName });
        }
        if (n >= 1 && n <= 30) {
          const abs = QURAN_TEXT.juzAyah(n);
          jumps.push({ abs, page: QURAN_TEXT.pageOf(abs), note: `${T('juz')} ${U.num(n)}` });
        }
        if (n >= 1 && n <= 60) {
          const abs = QURAN_TEXT.hizbAyah(n);
          jumps.push({ abs, page: QURAN_TEXT.pageOf(abs), note: `${T('hizb')} ${U.num(n)}` });
        }
        if (n >= 1 && n <= 604) {
          const abs = QURAN_TEXT.pageRange(n)[0];
          jumps.push({ abs, page: n, note: `${T('pageWord')} ${U.num(n)}` });
        }

        if (jumps.length) {
          results.appendChild(el('p.search-count', {}, T('resultCount', U.num(jumps.length))));
          jumps.forEach(j => {
            const { surah, ayah } = QURAN.fromAbsolute(j.abs);
            results.appendChild(el('button.jumprow', {
              type: 'button', onclick: () => goTo(j.page, j.abs)
            },
              el('div.jumprow-text', {},
                el('b', {}, `${QURAN.get(surah).name}، ${T('ayahNo', U.num(ayah))}`),
                el('small', {}, j.note)),
              el('span.jumprow-page', {}, U.num(j.page))));
          });
        }
        if (!results.children.length) {
          results.appendChild(el('p.hint', {}, T('noResults')));
        }
        return;
      }

      /* ── «٢:٢٥٥» أو «البقرة ٢٥٥» ──────────────────── */
      const ref = parseRef(digits);
      if (ref) {
        const s = QURAN.get(ref.surah);
        const abs = QURAN.absoluteIndex(ref.surah, ref.ayah);
        results.appendChild(el('p.search-count', {}, T('resultCount', U.num(1))));
        results.appendChild(el('button.jumprow', {
          type: 'button', onclick: () => goTo(QURAN_TEXT.pageOf(abs), abs)
        },
          el('div.jumprow-text', {},
            el('b', {}, `${s.name}، ${T('ayahNo', U.num(ref.ayah))}`),
            el('small.jumprow-snippet', {}, QURAN_TEXT.ayah(ref.surah, ref.ayah).slice(0, 80))),
          el('span.jumprow-page', {}, U.num(QURAN_TEXT.pageOf(abs)))));
        return;
      }

      /* ── سورة باسمها ─────────────────────────────── */
      const surahs = QURAN.search(q);
      if (surahs.length) {
        results.appendChild(el('p.search-count', {}, T('resultCount', U.num(surahs.length))));
        surahs.slice(0, 10).forEach(s => {
          results.appendChild(el('button.surahcard', {
            type: 'button', onclick: () => goTo(s.page, QURAN.absoluteIndex(s.no, 1))
          },
            el('b', {}, s.fullName),
            el('div.surahcard-meta', {},
              el('span', {}, `${T('suraNumber')} ${U.num(s.no)}`),
              el('span', {}, `${T('pageNumber')} ${U.num(s.page)}`),
              el('span', {}, `${T('ayaCount')} ${U.num(s.ayahs)}`),
              el('span', {}, s.revelation))));
        });
      }

      /* ── كلمة أو مقطع في نصّ المصحف ──────────────── */
      const hits = searchText(q);
      if (hits.length) {
        results.appendChild(el('p.search-count', {}, T('occurrences', U.num(hits.length))));
        hits.slice(0, 60).forEach(h => {
          results.appendChild(el('button.jumprow', {
            type: 'button', onclick: () => goTo(QURAN_TEXT.pageOf(h.abs), h.abs)
          },
            el('div.jumprow-text', {},
              el('b', {}, `${QURAN.get(h.surah).name}، ${T('ayahNo', U.num(h.ayah))}`),
              el('small.jumprow-snippet', { html: h.snippet })),
            el('span.jumprow-page', {}, U.num(QURAN_TEXT.pageOf(h.abs)))));
        });
        if (hits.length > 60) {
          results.appendChild(el('p.hint', {}, T('moreOccurrences', U.num(hits.length - 60))));
        }
      }

      if (!results.children.length) {
        results.appendChild(el('p.hint', {}, T('noResults')));
      }
    }
  }

  /* ── أدوات البحث ──────────────────────────────────────── */
  function normalizeDigits(s) {
    return String(s).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
                    .replace(/\s+/g, ' ').trim();
  }

  function parseRef(q) {
    let m = /^(\d{1,3})\s*[:\-/]\s*(\d{1,3})$/.exec(q);
    if (m) {
      const s = QURAN.get(+m[1]);
      return s ? { surah: s.no, ayah: U.clamp(+m[2], 1, s.ayahs) } : null;
    }
    m = /^(.+?)\s+(\d{1,3})$/.exec(q);
    if (m) {
      const found = QURAN.search(m[1]);
      if (found.length === 1 || (found.length && found[0].name === m[1].trim())) {
        const s = found[0];
        return { surah: s.no, ayah: U.clamp(+m[2], 1, s.ayahs) };
      }
    }
    return null;
  }

  /* ── فهرس البحث ───────────────────────────────────────
     الرسم العثماني يكتب الألف الخنجرية فوق الحرف، والناس
     يكتبون «العالمين» بألف و«الرحمن» بلا ألف — فتُفهرس كل آية
     بالصيغتين ويُبحث فيهما.                                  */
  let bareIndex = null;
  const DAGGER = /ٰ/g;
  const stripDagger = t => QURAN_TEXT.bare(t).replace(DAGGER, '');
  const alefDagger  = t => QURAN_TEXT.bare(t.replace(DAGGER, 'ا'));

  function buildIndex() {
    if (bareIndex) return bareIndex;
    bareIndex = { without: [], withAlef: [] };
    for (let s = 1; s <= 114; s++) {
      const ayahs = QURAN_TEXT.surah(s);
      for (let a = 0; a < ayahs.length; a++) {
        bareIndex.without.push(stripDagger(ayahs[a]));
        bareIndex.withAlef.push(alefDagger(ayahs[a]));
      }
    }
    return bareIndex;
  }

  function searchText(query) {
    const idx = buildIndex();
    const q = stripDagger(query);
    if (q.length < 2) return [];

    const out = [];
    for (let i = 0; i < idx.without.length; i++) {
      let text = idx.without[i];
      let at = text.indexOf(q);
      if (at === -1) { text = idx.withAlef[i]; at = text.indexOf(q); }
      if (at === -1) continue;
      const abs = i + 1;
      const { surah, ayah } = QURAN.fromAbsolute(abs);
      out.push({ abs, surah, ayah, snippet: snippetOf(text, at, q.length) });
      if (out.length >= 400) break;
    }
    return out;
  }

  function snippetOf(text, at, len) {
    const before = Math.max(0, at - 26);
    const after = Math.min(text.length, at + len + 26);
    return (before > 0 ? '… ' : '') + U.esc(text.slice(before, at)) +
      '<mark>' + U.esc(text.slice(at, at + len)) + '</mark>' +
      U.esc(text.slice(at + len, after)) + (after < text.length ? ' …' : '');
  }

  function inMerged(merged, abs) {
    for (const [a, b] of merged) if (abs >= a && abs <= b) return true;
    return false;
  }

  window.MushafView = { loadText, searchText, parseRef, openSearch };
})();
