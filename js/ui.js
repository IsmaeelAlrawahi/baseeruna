/* ============================================================
   بصائرنا — shared interface pieces
   ============================================================ */

window.UI = (function () {

  const { el, $, $$ } = U;

  /* ── toast ────────────────────────────────────────────
     `action` puts a button inside the toast — used for undo,
     so an accidental delete is always one tap from coming back. */
  function toast(message, kind = 'ok', ms = 2600, action) {
    const root = $('#toast-root');
    if (!root) return { close() {} };

    const node = el('div.toast.toast--' + kind, {}, el('span', {}, message));
    let timer;
    const close = () => {
      clearTimeout(timer);
      node.classList.remove('in');
      setTimeout(() => node.remove(), 300);
    };

    if (action) {
      node.appendChild(el('button.toast-action', {
        type: 'button',
        onclick: () => { close(); action.onClick(); }
      }, action.label));
    }

    root.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
    timer = setTimeout(close, ms);
    return { close };
  }

  /* Announces a deletion and offers to put it back. */
  function undoToast(message, onUndo) {
    return toast(message, 'ok', 7000, { label: T('undo'), onClick: onUndo });
  }

  /* ── bottom sheet / dialog ────────────────────────────── */
  function sheet({ title, body, actions, onClose, wide, dismissable = true }) {
    const root = $('#modal-root');
    const panel = el('div.sheet' + (wide ? '.sheet--wide' : ''), { role: 'dialog', 'aria-modal': 'true' });
    const back = el('div.sheet-backdrop');
    const wrap = el('div.sheet-wrap', {}, back, panel);

    panel.appendChild(el('div.sheet-grip'));
    if (title) panel.appendChild(el('h2.sheet-title', {}, title));

    const content = el('div.sheet-body');
    if (typeof body === 'string') content.innerHTML = body;
    else if (body) content.appendChild(body);
    panel.appendChild(content);

    if (actions && actions.length) {
      const bar = el('div.sheet-actions');
      actions.forEach(a => bar.appendChild(
        button(a.label, a.onClick ? () => a.onClick(api) : close, a.kind || 'ghost')));
      panel.appendChild(bar);
    }

    function close() {
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 260);
      document.removeEventListener('keydown', onKey);
      onClose && onClose();
    }
    function onKey(e) { if (e.key === 'Escape' && dismissable) close(); }

    if (dismissable) back.addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    setTimeout(() => {
      const first = panel.querySelector('input,select,textarea,button');
      if (first && window.innerWidth > 640) first.focus();
    }, 220);

    const api = { close, panel, body: content };
    return api;
  }

  function confirm(message, { title, danger, confirmLabel } = {}) {
    return new Promise(resolve => {
      let answered = false;
      const s = sheet({
        title: title || T('confirm'),
        body: el('p.sheet-text', {}, message),
        onClose: () => { if (!answered) resolve(false); },
        actions: [
          { label: T('cancel'), kind: 'ghost', onClick: a => { answered = true; a.close(); resolve(false); } },
          { label: confirmLabel || T('confirm'), kind: danger ? 'danger' : 'primary',
            onClick: a => { answered = true; a.close(); resolve(true); } }
        ]
      });
    });
  }

  function prompt({ title, label, value = '', placeholder, type = 'text', multiline, hint }) {
    return new Promise(resolve => {
      let answered = false;
      const input = multiline
        ? el('textarea.input', { rows: 4, placeholder: placeholder || '' })
        : el('input.input', { type, placeholder: placeholder || '' });
      input.value = value;
      const body = el('div.form', {},
        label ? el('label.label', {}, label) : null,
        input,
        hint ? el('p.hint', {}, hint) : null);
      const s = sheet({
        title, body,
        onClose: () => { if (!answered) resolve(null); },
        actions: [
          { label: T('cancel'), kind: 'ghost', onClick: a => { answered = true; a.close(); resolve(null); } },
          { label: T('save'), kind: 'primary',
            onClick: a => { answered = true; a.close(); resolve(input.value.trim()); } }
        ]
      });
      setTimeout(() => input.focus(), 250);
    });
  }

  /* ── atoms ────────────────────────────────────────────── */
  function button(label, onClick, kind = 'primary', opts = {}) {
    return el('button.btn.btn--' + kind, {
      type: 'button', onclick: onClick,
      disabled: opts.disabled, 'aria-label': opts.ariaLabel || null
    }, opts.icon ? icon(opts.icon) : null, el('span', {}, label));
  }

  function iconButton(name, onClick, opts = {}) {
    return el('button.iconbtn' + (opts.active ? '.is-active' : ''), {
      type: 'button', onclick: onClick,
      'aria-label': opts.label || name, title: opts.label || '',
      disabled: opts.disabled
    }, icon(name));
  }

  /* Inline SVG so nothing needs to load from the network. */
  const ICONS = {
    home:    'M3 10.6 12 3l9 7.6V21h-6v-6H9v6H3z',
    book:    'M11.2 6.6C9.5 5.2 6.9 4.4 3.6 4.2a.6.6 0 0 0-.6.6v12.4c0 .3.3.6.6.6 3 .1 5.4.8 7 2.1a.5.5 0 0 0 .6 0zm1.6 0v13.3a.5.5 0 0 0 .6 0c1.6-1.3 4-2 7-2.1a.6.6 0 0 0 .6-.6V4.8a.6.6 0 0 0-.6-.6c-3.3.2-5.9 1-7.6 2.4',
    play:    'M7 4.5v15l13-7.5z',
    pause:   'M7 4h4v16H7zm6 0h4v16h-4z',
    stop:    'M6 6h12v12H6z',
    next:    'M6 5l10 7-10 7zM18 5h2v14h-2z',
    prev:    'M18 5L8 12l10 7zM4 5h2v14H4z',
    tree:    'M12 2 5 12h3l-4 6h6v4h4v-4h6l-4-6h3z',
    users:   'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m0 2c-3.5 0-6 1.8-6 4v3h12v-3c0-2.2-2.5-4-6-4m9-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6m0 2c-.8 0-1.6.1-2.3.4 1.4 1 2.3 2.4 2.3 4.1V20h5v-3c0-2.2-2.4-4-5-4',
    mic:     'M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3m6-3a6 6 0 0 1-5 5.9V20h3v2H8v-2h3v-3.1A6 6 0 0 1 6 11h2a4 4 0 0 0 8 0z',
    plus:    'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z',
    check:   'M9.6 16.8 4.8 12l1.4-1.4 3.4 3.4 8-8L19 7.4z',
    x:       'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z',
    star:    'M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z',
    fire:    'M13.5 1.8c.4 2.7-.7 4.2-2 5.6-1.4 1.5-2.9 3-2.9 5.9 0 .8.2 1.5.5 2.1-1-.5-1.7-1.4-2-2.6-.9 1.1-1.4 2.5-1.4 4A7.3 7.3 0 0 0 19.3 17c0-4.2-2.3-6.2-4-7.6-1.4-1.2-2.5-2.1-1.8-7.6M12 12.4c1 1 2.2 2.2 2.2 4.2a2.2 2.2 0 0 1-4.4 0c0-1.4.9-2.4 1.6-3.2z',
    gear:    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8.9 4a7 7 0 0 1-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 0 1-2 1.2l-.4 2.6h-4l-.4-2.6a7 7 0 0 1-2-1.2l-2.4 1-2-3.4 2-1.6a7 7 0 0 1 0-2.4l-2-1.6 2-3.4 2.4 1a7 7 0 0 1 2-1.2L9.9 2h4l.4 2.6a7 7 0 0 1 2 1.2l2.4-1 2 3.4-2 1.6c.1.4.1.8.1 1.2',
    upload:  'M12 3l5 5h-3v6h-4V8H7zM4 18h16v3H4z',
    chart:   'M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z',
    back:    'M14 5l-7 7 7 7z',
    forward: 'M10 5l7 7-7 7z',
    trash:   'M6 7h12l-1 14H7zM9 4h6l1 2H8z',
    edit:    'M4 20h4L19 9l-4-4L4 16zM17 3l4 4-2 2-4-4z',
    heart:   'M12 21S3 14.7 3 8.9A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 9 2.9C21 14.7 12 21 12 21',
    clock:   'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 10V6h-2v8h6v-2z',
    repeat:  'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
    down:    'M12 16 6 10h12z',
    up:      'M12 8l6 6H6z',
    share:   'M18 16a3 3 0 0 0-2 .8L9 13a3 3 0 0 0 0-2l7-3.8A3 3 0 1 0 15 5l-7 3.8a3 3 0 1 0 0 6.4l7 3.8A3 3 0 1 0 18 16',
    logout:  'M10 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8v-2h8V5h-8zM8 8l-5 4 5 4v-3h7v-2H8z',
    sun:     'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0-6h0v3m0 16v3M3 12H0m24 0h-3M5.6 5.6 3.5 3.5m17 17-2.1-2.1M5.6 18.4l-2.1 2.1m17-17-2.1 2.1',
    more:    'M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
    search:  'M10 3a7 7 0 1 0 4.2 12.6l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 10 3m0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10',
    library: 'M3 4h4v16H3zm5 0h4v16H8zm6.4.7 3.8-1 4.1 15.4-3.8 1z',
    quran:   'M12 5.5C10 3.9 7 3 3.6 3a.6.6 0 0 0-.6.6v13.6c0 .3.3.6.6.6 3 .1 5.5.8 7.2 2.1a.4.4 0 0 0 .6-.3zm.6 14.1a.4.4 0 0 0 .6.3c1.7-1.3 4.2-2 7.2-2.1a.6.6 0 0 0 .6-.6V3.6a.6.6 0 0 0-.6-.6C17 3 14 3.9 12 5.5v14.1zM12 2.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 4.4l2-.3z',
    moon:    'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5'
  };

  function icon(name, size = 20) {
    const d = ICONS[name] || ICONS.check;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('icon');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'currentColor');
    svg.appendChild(p);
    return svg;
  }

  function card(children, cls = '') {
    return el('section.card' + (cls ? '.' + cls.split(' ').join('.') : ''), {}, children);
  }

  function sectionTitle(text, action) {
    return el('div.section-head', {},
      el('h2.section-title', {}, text),
      action || null);
  }

  function empty(message, actionNode) {
    return el('div.empty', {},
      el('div.empty-mark', { html: '﴿﴾' }),
      el('p', {}, message),
      actionNode || null);
  }

  /* ── progress ring ────────────────────────────────────── */
  function ring(percent, { size = 84, stroke = 8, color = 'var(--accent)', label, sub } = {}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const wrap = el('div.ring', { style: { width: size + 'px', height: size + 'px' } });
    wrap.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
                stroke="var(--line)" stroke-width="${stroke}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
                stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
                stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - U.clamp(percent,0,100)/100)}"
                transform="rotate(-90 ${size/2} ${size/2})"/>
      </svg>
      <div class="ring-label">
        <b>${U.esc(label !== undefined ? label : U.num(percent) + '٪')}</b>
        ${sub ? `<span>${U.esc(sub)}</span>` : ''}
      </div>`;
    return wrap;
  }

  function bar(percent, color = 'var(--accent)') {
    return el('div.bar', {},
      el('span', { style: { width: U.clamp(percent, 0, 100) + '%', background: color } }));
  }

  /* ── streak card ──────────────────────────────────────── */
  function streakCard(streak, title, color) {
    const alive = streak.current > 0;
    return el('div.streak' + (alive ? '.is-alive' : ''), { style: { '--streak-color': color } },
      el('div.streak-flame', {}, icon('fire', 26)),
      el('div.streak-info', {},
        el('b.streak-num', {}, U.num(streak.current)),
        el('span.streak-unit', {}, T('day')),
        el('span.streak-title', {}, title),
        el('span.streak-best', {}, T('bestStreak', U.num(streak.best)))));
  }

  /* Row of dots for the last N days. */
  function dotRow(days, colorOn = 'var(--accent)') {
    return el('div.dots', {}, days.map(d =>
      el('i.dot' + (d.complete ? '.on' : (d.fard || d.count ? '.half' : '')), {
        style: d.complete ? { background: colorOn } : null,
        title: U.formatDateShort(d.date)
      })));
  }

  /* ── form controls ────────────────────────────────────── */
  function field(label, control, hint) {
    return el('div.field', {},
      el('label.label', {}, label),
      control,
      hint ? el('p.hint', {}, hint) : null);
  }

  function select(options, value, onChange, opts = {}) {
    const s = el('select.input', { onchange: e => onChange(e.target.value) });
    options.forEach(o => {
      const node = el('option', { value: o.value }, o.label);
      if (String(o.value) === String(value)) node.selected = true;
      s.appendChild(node);
    });
    if (opts.disabled) s.disabled = true;
    return s;
  }

  function input(attrs = {}) { return el('input.input', attrs); }

  /* A number with − and + beside it. Typing still works, but on a
     phone the buttons are what actually get used. */
  function stepper(value, { step = 1, min = 0, max = 9999, unit = '', onChange } = {}) {
    let v = +value || 0;
    const field = el('input.stepper-value', {
      type: 'number', value: v, step, min, max,
      inputmode: step < 1 ? 'decimal' : 'numeric'
    });

    const round = n => Math.round(n * 1000) / 1000;
    const clampV = n => U.clamp(round(n), min, max);

    function set(next, fromTyping) {
      v = clampV(next);
      if (!fromTyping) field.value = v;
      onChange && onChange(v);
      paintUnit();
    }

    const unitLabel = el('span.stepper-unit');
    function paintUnit() {
      unitLabel.textContent = unit ? `${U.num(v)} ${unit}` : '';
    }
    paintUnit();

    field.addEventListener('input', () => set(+field.value, true));
    field.addEventListener('blur', () => { field.value = v; });

    const wrap = el('div.stepper', {},
      el('button.stepper-btn', {
        type: 'button', 'aria-label': 'إنقاص',
        onclick: () => set(v - step)
      }, '−'),
      field,
      el('button.stepper-btn', {
        type: 'button', 'aria-label': 'زيادة',
        onclick: () => set(v + step)
      }, '+'),
      unitLabel);

    wrap.getValue = () => v;
    wrap.setValue = n => set(n);
    return wrap;
  }

  /* A progress line with what is done, what is left, and a bar. */
  function remaining(done, total, unit, { color = 'var(--accent)', label } = {}) {
    const left = Math.max(0, total - done);
    return el('div.remaining', {},
      el('div.remaining-head', {},
        el('span', {}, label || ''),
        el('b', {}, `${U.num(done)} / ${U.num(total)} ${unit}`)),
      bar(U.pct(done, total), color),
      el('p.remaining-left', {}, left > 0
        ? `المتبقّي ${U.num(left)} ${unit}`
        : 'اكتمل، بارك الله فيك'));
  }

  function chips(options, value, onChange, { multi = false } = {}) {
    const wrap = el('div.chips');
    const selected = new Set(multi ? (value || []) : [value]);
    options.forEach(o => {
      const b = el('button.chip', { type: 'button' }, o.label);
      const paint = () => b.classList.toggle('is-on', selected.has(o.value));
      paint();
      if (o.color) b.style.setProperty('--chip-color', o.color);
      b.addEventListener('click', () => {
        if (multi) { selected.has(o.value) ? selected.delete(o.value) : selected.add(o.value); }
        else { selected.clear(); selected.add(o.value); }
        Array.from(wrap.children).forEach((c, i) =>
          c.classList.toggle('is-on', selected.has(options[i].value)));
        onChange(multi ? Array.from(selected) : o.value);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function stars(n, max = 5) {
    return el('span.stars', {}, Array.from({ length: max }, (_, i) =>
      el('i.star' + (i < n ? '.on' : ''), {}, icon('star', 14))));
  }

  /* Object URLs are cached per photo so re-rendering a list of
     students doesn't leak one blob URL per row. */
  const photoUrls = new Map();
  function photoUrl(user) {
    if (!user || !user.photo) return null;
    const hit = photoUrls.get(user.id);
    if (hit && hit.blob === user.photo) return hit.url;
    if (hit) URL.revokeObjectURL(hit.url);
    const url = URL.createObjectURL(user.photo);
    photoUrls.set(user.id, { blob: user.photo, url });
    return url;
  }

  function avatar(user, size = 40) {
    const style = {
      width: size + 'px', height: size + 'px',
      fontSize: Math.round(size * 0.38) + 'px',
      background: user.color || 'var(--teal-500)'
    };
    const url = photoUrl(user);
    if (url) {
      return el('div.avatar.avatar--photo', { style },
        el('img', { src: url, alt: user.name || '' }));
    }
    const initials = (user.name || '؟').trim().split(/\s+/).slice(0, 2)
      .map(w => w[0]).join('');
    return el('div.avatar', { style }, initials);
  }

  function badge(text, kind = 'neutral') {
    return el('span.badge.badge--' + kind, {}, text);
  }

  /* ── screen scaffolding ───────────────────────────────── */
  function screen(children, cls = '') {
    return el('div.page' + (cls ? '.' + cls : ''), {}, children);
  }

  function loading() {
    return el('div.loading', {}, el('div.spinner'), el('span', {}, T('loading')));
  }

  /* Celebrates a newly earned streak badge. */
  function celebrate(badgeRec) {
    const kindName = badgeRec.kind === 'salah' ? T('salahStreak') : T('memoStreak');
    sheet({
      title: '',
      body: el('div.celebrate', {},
        el('div.celebrate-mark', {}, icon('star', 46)),
        el('h3', {}, T('milestone', U.num(badgeRec.milestone))),
        el('p', {}, kindName),
        el('p.celebrate-dua', {}, 'اللهم بارك له وثبّته')),
      actions: [{ label: T('done'), kind: 'primary' }]
    });
    Badges.markSeen(badgeRec.id);
  }

  return {
    toast, undoToast, sheet, confirm, prompt,
    button, iconButton, icon, card, sectionTitle, empty,
    ring, bar, streakCard, dotRow, field, select, input, stepper, remaining,
    chips, stars, avatar, photoUrl, badge, screen, loading, celebrate
  };
})();
