/* ============================================================
   بصائرنا — صفحة الأدعية والأذكار

   ذكرٌ واحد في كل مرة، بطاقةٌ كبيرة يقلّبها الطالب.
   والضغط في أي موضع من البطاقة يَعُدّ واحدًا — لا زرّ يُتحرّى.
   فإذا تمّ العدد انتقلت البطاقة إلى ما بعدها من نفسها.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/adhkar', {
    title: () => T('adhkarPage'),
    actions: () => Session.isTeacher
      ? [UI.iconButton('plus', () => openDhikrSheet(), { label: T('addDhikr') })]
      : [],
    render: renderAdhkar
  });

  Router.register('/t/adhkar/:id', {
    role: 'teacher', back: '/t/students',
    title: () => T('adhkarPage'),
    render: p => renderAdhkar({ userId: p.id, readOnly: true })
  });

  async function renderAdhkar(params) {
    const viewingId = (params && params.userId) || Session.user.id;
    const readOnly = !!(params && params.readOnly);
    const page = UI.screen(null, 'page--adhkar');

    let category = (await DB.setting('adhkarCategory')) || ADHKAR.categories[0].id;
    if (!(await DB.setting('adhkarCategory')) && new Date().getHours() >= 15) {
      category = 'evening';
    }

    let items = [];
    let log = null;
    let index = 0;

    const tabs = el('div.chips.chips--scroll');
    const deckHost = el('div.deck');
    const dotsHost = el('div.deck-dots');
    const summaryHost = el('div');

    page.append(tabs, deckHost, dotsHost, summaryHost);

    /* ── الأقسام ──────────────────────────────────────── */
    function paintTabs() {
      U.clear(tabs);
      ADHKAR.categories.forEach(c => {
        tabs.appendChild(el('button.chip' + (c.id === category ? '.is-on' : ''), {
          type: 'button',
          onclick: async () => {
            category = c.id; index = 0;
            await DB.setting('adhkarCategory', c.id);
            paintTabs(); await load();
          }
        }, c.name));
      });
    }

    async function load() {
      [items, log] = await Promise.all([
        Adhkar.forCategory(category), Adhkar.log(viewingId)
      ]);
      /* Open on the first dhikr not yet finished. */
      const firstUndone = items.findIndex(i => (log.counts[i.key] || 0) < i.count);
      index = firstUndone === -1 ? 0 : firstUndone;
      paintDeck(); paintDots(); await paintSummary();
    }

    const countOf = item => (log.counts[item.key] || 0);
    const isDone = item => countOf(item) >= item.count;

    /* ── البطاقة ──────────────────────────────────────── */
    function paintDeck(direction) {
      U.clear(deckHost);
      if (!items.length) { deckHost.appendChild(UI.empty(T('empty'))); return; }

      index = U.clamp(index, 0, items.length - 1);
      const item = items[index];
      const count = countOf(item);
      const done = isDone(item);
      const left = Math.max(0, item.count - count);

      const card = el('article.dcard' + (done ? '.is-done' : '') +
        (direction ? (direction > 0 ? '.slide-next' : '.slide-prev') : ''), {
        role: 'button', tabindex: 0,
        'aria-label': T('tapAnywhere')
      });

      card.append(
        el('div.dcard-head', {},
          el('b.dcard-title', {}, item.title),
          item.custom ? UI.badge('مضاف', 'gold') : null),
        el('p.dcard-text', {}, item.text));

      const foot = el('div.dcard-foot');
      if (item.source) foot.appendChild(el('cite.dcard-source', {}, item.source));
      if (item.virtue) foot.appendChild(el('span.dcard-virtue', {}, item.virtue));
      card.appendChild(foot);

      /* العدّاد — كبير، وهو نفسه مساحة الضغط */
      card.appendChild(el('div.dcard-counter', {},
        done
          ? el('span.dcard-done', {}, UI.icon('check', 26), el('b', {}, T('dhikrDone')))
          : el('span.dcard-count', {},
              el('b', {}, U.num(left)),
              el('small', {}, item.count > 1
                ? T('remainingOf', U.num(count), U.num(item.count))
                : T('tapAnywhere')))));

      if (!readOnly) {
        card.appendChild(el('p.dcard-hint', {}, T('tapAnywhere')));
        card.addEventListener('click', onTap);
        card.addEventListener('keydown', ev => {
          if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); onTap(); }
          if (ev.key === 'ArrowLeft') move(1);
          if (ev.key === 'ArrowRight') move(-1);
        });
      }

      /* أدوات المعلّم على ما أضافه */
      if (Session.isTeacher && item.custom && !readOnly) {
        const tools = el('div.dcard-tools');
        tools.append(
          UI.iconButton('edit', ev => { ev.stopPropagation(); openDhikrSheet(item); },
            { label: T('edit') }),
          (() => {
            const b = UI.iconButton('trash', async ev => {
              ev.stopPropagation();
              if (!await UI.confirm(T('confirmDelete'), { danger: true })) return;
              await Adhkar.removeCustom(item.id);
              UI.toast(T('deleted')); await load();
            }, { label: T('delete') });
            b.classList.add('iconbtn--danger');
            return b;
          })());
        card.appendChild(tools);
      }

      deckHost.appendChild(card);

      /* التنقّل */
      deckHost.appendChild(el('div.deck-nav', {},
        UI.iconButton('forward', () => move(-1),
          { label: 'السابق', disabled: index === 0 }),
        el('span.deck-pos', {}, `${U.num(index + 1)} / ${U.num(items.length)}`),
        UI.iconButton('back', () => move(1),
          { label: 'التالي', disabled: index === items.length - 1 })));

      enableSwipe(card);
    }

    async function onTap() {
      const item = items[index];
      if (!item) return;
      if (countOf(item) >= item.count) return;
      const before = countOf(item);
      log = await Adhkar.tap(viewingId, item.key, item.count);

      const now = countOf(item);
      /* Reaching the target: mark it, then move on by itself. */
      if (before < item.count && now >= item.count) {
        paintDeck(); paintDots(); paintSummary();
        if (index < items.length - 1) setTimeout(() => move(1), 700);
        return;
      }
      /* Otherwise just refresh the number, without rebuilding. */
      const left = Math.max(0, item.count - now);
      const b = deckHost.querySelector('.dcard-count b');
      const s = deckHost.querySelector('.dcard-count small');
      if (b) b.textContent = U.num(left);
      if (s && item.count > 1) s.textContent = T('remainingOf', U.num(now), U.num(item.count));
      const card = deckHost.querySelector('.dcard');
      if (card) { card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse'); }
      paintDots(); paintSummary();
    }

    function move(delta) {
      const next = U.clamp(index + delta, 0, items.length - 1);
      if (next === index) return;
      index = next;
      paintDeck(delta);
      paintDots();
    }

    /* سحب البطاقة يمينًا وشمالًا — يتجاهل السحب العمودي */
    function enableSwipe(card) {
      let x0 = null, y0 = null;
      card.style.touchAction = 'pan-y';
      card.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; });
      card.addEventListener('pointerup', e => {
        if (x0 === null) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        x0 = y0 = null;
        if (Math.abs(dy) > Math.abs(dx)) return;
        if (Math.abs(dx) < 60) return;
        move(dx > 0 ? -1 : 1);
      });
      card.addEventListener('pointercancel', () => { x0 = y0 = null; });
    }

    function paintDots() {
      U.clear(dotsHost);
      items.forEach((it, i) => {
        dotsHost.appendChild(el('button.deck-dot' +
          (isDone(it) ? '.is-done' : '') + (i === index ? '.is-current' : ''), {
          type: 'button', title: it.title,
          onclick: () => { index = i; paintDeck(); paintDots(); }
        }));
      });
    }

    async function paintSummary() {
      U.clear(summaryHost);
      const sum = await Adhkar.summary(viewingId);
      const cat = sum.categories.find(c => c.category.id === category);

      const card = UI.card([]);
      card.append(
        UI.sectionTitle(T('adhkarToday'),
          el('div.head-tools', {},
            UI.badge(T('adhkarDone', U.num(cat.done), U.num(cat.total)),
              cat.done === cat.total ? 'ok' : 'soft'),
            readOnly ? null : UI.iconButton('repeat', async () => {
              const yes = await UI.confirm(T('adhkarResetAsk'),
                { title: T('adhkarReset'), danger: true, confirmLabel: T('adhkarReset') });
              if (!yes) return;
              await Adhkar.resetCategory(viewingId, category);
              await load();
            }, { label: T('adhkarReset') }))),
        el('div.adhkar-summary', {}, sum.categories.map(c =>
          el('div.adhkar-sumrow', {},
            el('span', {}, c.category.name),
            UI.bar(c.percent, c.percent === 100 ? 'var(--ok)' : 'var(--gold-400)'),
            el('b', {}, T('adhkarDone', U.num(c.done), U.num(c.total)))))));

      if (cat.done === cat.total && cat.total) {
        card.appendChild(el('div.adhkar-complete', {},
          UI.icon('check', 20), el('span', {}, T('adhkarComplete'))));
      }
      if (Session.isTeacher && !readOnly) {
        card.appendChild(UI.button(T('addDhikr'),
          () => openDhikrSheet(null, category), 'ghost', { icon: 'plus' }));
      }
      summaryHost.appendChild(card);
    }

    paintTabs();
    await load();
    return page;
  }

  /* ── المعلّم يضيف ذكرًا ───────────────────────────────── */
  async function openDhikrSheet(existing, presetCategory) {
    const me = Session.user;
    const draft = existing ? Object.assign({}, existing) : {
      category: presetCategory || ADHKAR.categories[0].id,
      title: '', text: '', count: 1, source: '', virtue: ''
    };

    const body = el('div.form');

    body.appendChild(UI.field(T('dhikrCategory'), UI.select(
      ADHKAR.categories.map(c => ({ value: c.id, label: c.name })),
      draft.category, v => { draft.category = v; })));

    const titleIn = UI.input({ value: draft.title, placeholder: 'عنوان مختصر' });
    titleIn.addEventListener('input', () => { draft.title = titleIn.value; });
    body.appendChild(UI.field(T('dhikrTitle'), titleIn));

    const textIn = el('textarea.input.input--quote', { rows: 4, placeholder: 'نص الذكر…' });
    textIn.value = draft.text;
    textIn.addEventListener('input', () => { draft.text = textIn.value; });
    body.appendChild(UI.field(T('dhikrText'), textIn));

    const countIn = UI.input({ type: 'number', min: 1, value: draft.count, inputmode: 'numeric' });
    countIn.addEventListener('input', () => { draft.count = Math.max(1, +countIn.value || 1); });
    const sourceIn = UI.input({ value: draft.source, placeholder: 'رواه…' });
    sourceIn.addEventListener('input', () => { draft.source = sourceIn.value; });
    body.appendChild(el('div.field-row', {},
      UI.field(T('dhikrCount'), countIn),
      UI.field(T('dhikrSource'), sourceIn)));

    const virtueIn = UI.input({ value: draft.virtue, placeholder: T('optional') });
    virtueIn.addEventListener('input', () => { draft.virtue = virtueIn.value; });
    body.appendChild(UI.field(T('dhikrVirtue'), virtueIn));

    UI.sheet({
      title: existing ? T('editDhikr') : T('addDhikr'), body, wide: true,
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('save'), kind: 'primary', onClick: async a => {
            if (!draft.text.trim()) return UI.toast('اكتب نص الذكر أولًا', 'warn');
            if (!draft.title.trim()) draft.title = draft.text.trim().slice(0, 28);
            if (existing) await Adhkar.updateCustom(existing.id, draft);
            else await Adhkar.createCustom(Object.assign({ teacherId: me.id }, draft));
            a.close(); UI.toast(T('dhikrAdded')); Router.render();
          } }
      ]
    });
  }

  window.AdhkarView = { openDhikrSheet };
})();
