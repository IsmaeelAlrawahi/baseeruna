/* ============================================================
   بصائرنا — شجرة الصلاة view
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/tree', {
    role: 'student',
    title: () => T('salahTree'),
    render: () => renderTree(Session.user.id, { editable: true })
  });

  Router.register('/t/tree/:id', {
    role: 'teacher', back: '/t/students',
    title: () => T('salahTree'),
    render: p => renderTree(p.id, { editable: false })
  });

  async function renderTree(userId, { editable }) {
    const user = await Users.byId(userId);
    if (!user) return UI.empty('الطالب غير موجود');

    const page = UI.screen(null, 'page--tree');
    let year = Math.max(new Date().getFullYear(), CONFIG.tree.firstYear || 2026);
    let month = null;                       /* null = whole year */
    let records = await Tree.recordsFor(userId, year);
    let svg = null;

    const toolbar = el('div.tree-toolbar');
    const canvas  = el('div.tree-canvas');
    const legend  = el('div.tree-legend');
    const footer  = el('div.tree-footer');

    /* صلوات اليوم بضغطة، فوق الشجرة مباشرة. */
    if (editable) page.appendChild(await StudentView.todaySalahCard(user));

    page.append(toolbar, canvas, legend, footer);

    /* ── legend ───────────────────────────────────────── */
    U.clear(legend);
    [
      legendItem('var(--teal-300)', T('prayedFard')),
      legendItem('var(--gold-400)', T('prayedExtra')),
      CONFIG.tree.markMissedFard !== false
        ? legendItem('var(--leaf-missed)', T('missedPrayer')) : null,
      legendItem('var(--leaf-empty)', 'لم يأتِ بعد')
    ].filter(Boolean).forEach(n => legend.appendChild(n));

    function legendItem(color, label) {
      if (!label) return null;
      return el('span.legend-item', {},
        el('i.legend-leaf', { style: { background: color } }), label);
    }

    /* ── toolbar ──────────────────────────────────────── */
    function paintToolbar() {
      U.clear(toolbar);

      const firstYear = CONFIG.tree.firstYear || 2026;
      toolbar.appendChild(el('div.tree-years', {},
        UI.iconButton('forward', () => changeYear(-1), {
          label: 'السنة السابقة', disabled: year <= firstYear
        }),
        el('b.tree-year', {}, U.num(year)),
        UI.iconButton('back', () => changeYear(1), {
          label: 'السنة التالية', disabled: year >= new Date().getFullYear()
        })));

      /* الشجرة مبنيّة على الأشهر الميلادية (١٢ غصنًا)، فتبقى
         أسماؤها، ويُذكر ما يوافقها من الهجري إلى جانبها. */
      const scopes = [{ value: -1, label: T('yearView') }]
        .concat(T('monthNames').map((m, i) => ({
          value: i,
          label: U.isHijri() ? `${m} · ${U.formatMonth(year, i)}` : m
        })));
      toolbar.appendChild(UI.select(scopes, month === null ? -1 : month, v => {
        month = (+v === -1) ? null : +v;
        draw();
      }));

      toolbar.appendChild(UI.iconButton('gear', () => svg && svg.__resetView && svg.__resetView(),
        { label: 'إعادة الضبط' }));
    }

    async function changeYear(delta) {
      const next = year + delta;
      if (next > new Date().getFullYear()) return;
      if (next < (CONFIG.tree.firstYear || 2026)) return;
      year = next;
      records = await Tree.recordsFor(userId, year);
      paintToolbar(); draw();
    }

    /* ── drawing ──────────────────────────────────────── */
    function draw() {
      canvas.classList.toggle('is-month', month !== null);

      if (month === null) {
        svg = Tree.renderYear(canvas, {
          year, records,
          onPickMonth: m => { month = m; paintToolbar(); draw(); },
          onPickDay: key => openDay(key, editable)
        });
      } else {
        svg = Tree.renderMonth(canvas, {
          year, month, records,
          onToggleSlot: editable ? toggleSlot : (key => openDay(key, false)),
          onPickDay:    key => openDay(key, editable)
        });
      }
      paintFooter();
    }

    async function toggleSlot(dateKey, slotId) {
      const rec = records[dateKey] || await Salah.day(userId, dateKey);
      const next = !rec.slots[slotId];
      records[dateKey] = await Salah.setSlot(userId, dateKey, slotId, next);
      Tree.refreshDay(svg, dateKey, records[dateKey], true);
      paintFooter();
      if (next) StudentView.afterProgress(userId);
    }

    /* ── the day editor ───────────────────────────────── */
    async function openDay(dateKey, canEdit) {
      if (!dateKey) return;
      const rec = records[dateKey] || await Salah.day(userId, dateKey);
      const future = dateKey > U.todayKey();

      const body = el('div.dayedit');
      const list = el('div.dayedit-list');

      function paint() {
        U.clear(list);
        CONFIG.prayerSlots.forEach(slot => {
          const on = !!rec.slots[slot.id];
          const jama = !!rec.jamaah[slot.id];

          const row = el('div.dayrow' + (on ? '.is-on' : ''));
          row.appendChild(el('button.dayrow-main', {
            type: 'button', disabled: !canEdit || future,
            onclick: async () => {
              records[dateKey] = await Salah.setSlot(userId, dateKey, slot.id, !on);
              Object.assign(rec, records[dateKey]);
              paint(); Tree.refreshDay(svg, dateKey, rec, true); paintFooter();
              if (!on) StudentView.afterProgress(userId);
            }
          },
            el('span.dayrow-check', {}, on ? UI.icon('check', 16) : null),
            el('span.dayrow-name', {}, slot.name),
            el('span.dayrow-kind', {}, slot.kind === 'fard' ? 'فرض' : 'نافلة')));

          if (CONFIG.trackCongregation && slot.kind === 'fard') {
            row.appendChild(el('button.dayrow-jamaah' + (jama ? '.is-on' : ''), {
              type: 'button', disabled: !canEdit || future,
              onclick: async () => {
                records[dateKey] = await Salah.setJamaah(userId, dateKey, slot.id, !jama);
                Object.assign(rec, records[dateKey]);
                paint(); Tree.refreshDay(svg, dateKey, rec, true); paintFooter();
              }
            }, T('inCongregation')));
          }
          list.appendChild(row);
        });
      }
      paint();
      body.appendChild(list);

      if (future) body.appendChild(el('p.hint', {}, 'هذا اليوم لم يأتِ بعد'));

      const actions = [{ label: T('close'), kind: 'ghost' }];
      if (canEdit && !future) {
        actions.unshift(
          { label: T('clearDay'), kind: 'ghost', onClick: async a => {
              a.close();
              const restore = await Salah.clearDayUndoable(userId, dateKey);
              records[dateKey] = await Salah.day(userId, dateKey);
              Object.assign(rec, records[dateKey]);
              Tree.refreshDay(svg, dateKey, rec, true);
              paintFooter();
              UI.undoToast(T('dayCleared'), async () => {
                await restore();
                records[dateKey] = await Salah.day(userId, dateKey);
                Tree.refreshDay(svg, dateKey, records[dateKey], true);
                paintFooter();
                UI.toast(T('dayRestored'));
              });
            } },
          { label: T('markAll'), kind: 'primary', onClick: async a => {
              records[dateKey] = await Salah.setDay(userId, dateKey,
                CONFIG.prayerSlots.map(s => s.id));
              Object.assign(rec, records[dateKey]);
              Tree.refreshDay(svg, dateKey, rec, true);
              paintFooter(); a.close();
              StudentView.afterProgress(userId);
            } });
      }

      UI.sheet({ title: U.formatDate(dateKey), body, actions });
    }

    /* ── footer numbers ───────────────────────────────── */
    async function paintFooter() {
      const st = Tree.stats(records, year);
      const streak = await Streaks.salah(userId);
      U.clear(footer);
      [
        el('div.tree-stat', {},
          el('b', {}, U.num(st.grown)), el('span', {}, 'ورقة نمت')),
        el('div.tree-stat', {},
          el('b', {}, U.num(st.fullDays)), el('span', {}, 'يوم كامل')),
        CONFIG.tree.markMissedFard !== false
          ? el('div.tree-stat.tree-stat--missed', {},
              el('b', {}, U.num(st.missed)), el('span', {}, T('missedLeaves')))
          : null,
        el('div.tree-stat', {},
          el('b', {}, U.num(streak.current)), el('span', {}, T('salahStreak')))
      ].filter(Boolean).forEach(n => footer.appendChild(n));
      footer.appendChild(el('p.tree-progress', {},
        T('treeProgress', U.num(st.grown), U.num(st.totalLeaves))));
      if (CONFIG.tree.markMissedFard !== false) {
        footer.appendChild(el('p.hint', {}, T('missedNote')));
      }
      footer.appendChild(el('p.hint', {}, T('tapAnyDay')));
    }

    paintToolbar();
    draw();
    return page;
  }
})();
