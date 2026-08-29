/* ============================================================
   بصائرنا — شجرة الصلاة

   One tree per year:
     12 main branches   → the months
      4 sub-branches    → the weeks of each month
      7 twigs           → the days of each week
      8 leaves          → the prayers of each day  (CONFIG.prayerSlots)

   Months are 28 days on the tree by design. Days 29–31 grow as a
   short extra twig at the tip of the fourth week, so a real
   calendar day is never lost.

   Leaves only appear once a day has arrived; future days sit as
   pale buds waiting to open.
   ============================================================ */

window.Tree = (function () {

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RAD = Math.PI / 180;

  /* ── geometry helpers ─────────────────────────────────── */
  const pt = (x, y) => ({ x, y });
  function quad(p0, p1, p2, t) {
    const u = 1 - t;
    return pt(u*u*p0.x + 2*u*t*p1.x + t*t*p2.x,
              u*u*p0.y + 2*u*t*p1.y + t*t*p2.y);
  }
  function quadAngle(p0, p1, p2, t) {
    const u = 1 - t;
    const dx = 2*u*(p1.x - p0.x) + 2*t*(p2.x - p1.x);
    const dy = 2*u*(p1.y - p0.y) + 2*t*(p2.y - p1.y);
    return Math.atan2(dy, dx) / RAD;
  }
  const move = (p, angle, dist) =>
    pt(p.x + Math.cos(angle * RAD) * dist, p.y + Math.sin(angle * RAD) * dist);
  const f = n => (Math.round(n * 10) / 10);

  /* ── leaf shape: a lens pointing along +x, 1 unit long ─── */
  const LEAF_PATH = 'M0,0 C.26,-.3 .74,-.34 1,0 C.74,.34 .26,.3 0,0Z';

  /* Whether leaving this prayer undone should show as missed. */
  function isMissable(slot) {
    return slot.kind === 'fard'
      ? CONFIG.tree.markMissedFard !== false
      : CONFIG.tree.markMissedExtra === true;
  }

  /* ── shared <defs> ────────────────────────────────────── */
  function defs() {
    return `
    <defs>
      <linearGradient id="tBark" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stop-color="#1B1208"/>
        <stop offset=".45" stop-color="#4A331E"/>
        <stop offset=".75" stop-color="#2E2013"/>
        <stop offset="1"   stop-color="#150E06"/>
      </linearGradient>
      <linearGradient id="tFard" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2FD9BB"/><stop offset="1" stop-color="#0B7A68"/>
      </linearGradient>
      <linearGradient id="tExtra" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F7D98E"/><stop offset="1" stop-color="#C08A22"/>
      </linearGradient>
      <linearGradient id="tMissed" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#E05A4B"/><stop offset="1" stop-color="#7A1E16"/>
      </linearGradient>
      <linearGradient id="tGround" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(16,156,134,.22)"/>
        <stop offset="1" stop-color="rgba(16,156,134,0)"/>
      </linearGradient>
      <radialGradient id="tGlow">
        <stop offset="0" stop-color="rgba(47,217,187,.30)"/>
        <stop offset="1" stop-color="rgba(47,217,187,0)"/>
      </radialGradient>
      <path id="leafShape" d="${LEAF_PATH}"/>
      <filter id="tSoft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6"/>
      </filter>
    </defs>`;
  }

  /* ── how a single day's 8 leaves are drawn ─────────────
     Pinnate: leaflets alternate along the twig, like an acacia.
     `rec` is the stored salah day (may be undefined).           */
  function leavesFor(origin, angle, twigLen, dateKey, rec, opts) {
    const slots = CONFIG.prayerSlots;
    const n = slots.length;
    const leafLen = twigLen * (opts.leafScale || 0.46);
    const today = U.todayKey();
    const future = dateKey > today;
    /* Today is still open, so nothing in it counts as missed yet. */
    const past = dateKey < today;
    const out = [];

    for (let i = 0; i < n; i++) {
      const slot = slots[i];
      const side = i % 2 === 0 ? -1 : 1;
      /* Pairs march up the twig; the last leaf caps the tip. */
      const pair = Math.floor(i / 2);
      const pairs = Math.ceil(n / 2);
      const along = 0.22 + (pair / Math.max(1, pairs - 1)) * 0.74;
      const base = move(origin, angle, twigLen * along);
      const spread = 52 - pair * 4;
      const a = angle + side * spread;

      const on = !!(rec && rec.slots && rec.slots[slot.id]);
      const jama = !!(rec && rec.jamaah && rec.jamaah[slot.id]);
      const missed = past && !on && isMissable(slot);

      const fill = on ? (slot.kind === 'fard' ? 'url(#tFard)' : 'url(#tExtra)')
                 : missed ? 'url(#tMissed)'
                 : 'var(--leaf-empty)';
      const op = future ? 0.28 : (on ? 1 : (missed ? 0.92 : 0.5));

      out.push(
        `<use href="#leafShape" xlink:href="#leafShape"` +
        ` class="leaf${on ? ' on' : ''}${missed ? ' missed' : ''}"` +
        ` transform="translate(${f(base.x)} ${f(base.y)}) rotate(${f(a)}) scale(${f(leafLen)})"` +
        ` fill="${fill}" opacity="${op}"` +
        (jama ? ' stroke="var(--gold-300)" stroke-width=".07"' : '') +
        (opts.interactive ? ` data-slot="${slot.id}" data-day="${dateKey}"` : '') +
        `/>`
      );
    }
    return out.join('');
  }

  /* ── one twig = one day ───────────────────────────────── */
  function dayTwig(origin, angle, twigLen, dateKey, rec, opts) {
    const tip = move(origin, angle, twigLen);
    const complete = rec && Salah.isComplete(rec);
    const s = [];

    s.push(`<g class="day${complete ? ' complete' : ''}" data-day="${dateKey}">`);
    s.push(`<path d="M${f(origin.x)},${f(origin.y)} L${f(tip.x)},${f(tip.y)}"` +
           ` stroke="var(--bark-light)" stroke-width="${f(twigLen * 0.055)}"` +
           ` stroke-linecap="round" fill="none" opacity=".85"/>`);

    if (opts.interactive || opts.dayHit) {
      /* Invisible pad so small fingers can still land on a day —
         and so any past day can be opened straight from its twig. */
      const mid = move(origin, angle, twigLen * 0.6);
      s.push(`<circle class="day-hit" cx="${f(mid.x)}" cy="${f(mid.y)}"` +
             ` r="${f(twigLen * (opts.dayHit ? 1.15 : 0.85))}"` +
             ` fill="transparent" data-dayhit="${dateKey}"/>`);
    }

    s.push(leavesFor(origin, angle, twigLen, dateKey, rec, opts));

    if (complete) {
      const g = move(origin, angle, twigLen * 0.6);
      s.push(`<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(twigLen * 1.1)}" fill="url(#tGlow)"/>`);
    }
    s.push('</g>');
    return s.join('');
  }

  /* ── one sub-branch = one week (7 day twigs) ──────────── */
  function weekBranch(p0, p1, p2, weekNo, dates, records, opts) {
    const s = [];
    const w = opts.weekWidth;
    s.push(`<g class="week" data-week="${weekNo}">`);
    s.push(`<path d="M${f(p0.x)},${f(p0.y)} Q${f(p1.x)},${f(p1.y)} ${f(p2.x)},${f(p2.y)}"` +
           ` stroke="url(#tBark)" stroke-width="${f(w)}" stroke-linecap="round" fill="none"/>`);

    const ts = [0.15, 0.28, 0.41, 0.54, 0.67, 0.80, 0.93];
    ts.forEach((t, d) => {
      const key = dates[d];
      if (!key) return;
      const base = quad(p0, p1, p2, t);
      const tan = quadAngle(p0, p1, p2, t);
      const side = d % 2 === 0 ? -1 : 1;
      const angle = tan + side * (44 - d * 1.5);
      s.push(dayTwig(base, angle, opts.twigLen, key, records[key], opts));
    });
    s.push('</g>');
    return s.join('');
  }

  /* ── one main branch = one month ──────────────────────── */
  function monthBranch(attach, side, len, monthIndex, year, records, opts, rise) {
    const s = [];
    rise = rise === undefined ? 33 : rise;
    const end = move(attach, side > 0 ? -rise : 180 + rise, len);
    /* Control point set below the chord so the branch sweeps up
       and then levels off, the way a real limb carries weight. */
    const ctrl = move(attach, side > 0 ? -(rise - 20) : 180 + (rise - 20), len * 0.58);
    const width = opts.mainWidth;

    s.push(`<g class="month" data-month="${monthIndex}">`);
    s.push(`<path d="M${f(attach.x)},${f(attach.y)} Q${f(ctrl.x)},${f(ctrl.y)} ${f(end.x)},${f(end.y)}"` +
           ` stroke="url(#tBark)" stroke-width="${f(width)}" stroke-linecap="round" fill="none"/>`);

    const weekTs = [0.32, 0.52, 0.70, 0.87];
    const dim = U.daysInMonth(year, monthIndex + 1);

    weekTs.forEach((t, w) => {
      const p0 = quad(attach, ctrl, end, t);
      const tan = quadAngle(attach, ctrl, end, t);
      const up = w % 2 === 0;
      const wLen = len * (0.40 - w * 0.045);
      const a = tan + (up ? -42 : 24);
      const wEnd = move(p0, a, wLen);
      const wCtrl = move(p0, a + (up ? 14 : -14), wLen * 0.55);
      /* Twigs scale with their branch so upper months don't clump. */
      const wOpts = opts.fixedTwig ? opts
        : Object.assign({}, opts, { twigLen: Math.max(24, wLen * 0.30) });

      const dates = [];
      for (let d = 0; d < 7; d++) {
        const dayNo = w * 7 + d + 1;
        dates.push(dayNo <= dim
          ? `${year}-${String(monthIndex + 1).padStart(2,'0')}-${String(dayNo).padStart(2,'0')}`
          : null);
      }
      s.push(weekBranch(p0, wCtrl, wEnd, w, dates, records, wOpts));

      /* Days 29–31 hang from the tip of week four. */
      if (w === 3 && dim > 28) {
        for (let extra = 29; extra <= dim; extra++) {
          const i = extra - 29;
          const key = `${year}-${String(monthIndex+1).padStart(2,'0')}-${extra}`;
          const base = move(wEnd, a + (i - 1) * 26, wLen * 0.16);
          s.push(dayTwig(base, a + (i - 1) * 26 - 18, wOpts.twigLen * 0.9, key, records[key], wOpts));
        }
      }
    });

    /* Month label sits just past the branch tip, clear of the leaves. */
    const label = move(end, side > 0 ? -rise : 180 + rise, 78);
    s.push(`<text class="month-label" x="${f(label.x)}" y="${f(label.y)}"` +
           ` text-anchor="middle" data-monthlabel="${monthIndex}">` +
           `${T('monthNames')[monthIndex]}</text>`);
    s.push('</g>');
    return s.join('');
  }

  /* ── the whole year ───────────────────────────────────── */
  function yearSvg(year, records) {
    const W = 1500, H = 1560;
    const groundY = 1470, topY = 250, baseX = 750;
    const opts = { mainWidth: 10, weekWidth: 4.5, twigLen: 46, leafScale: 0.5,
                   interactive: false, dayHit: true };

    const s = [];
    s.push(`<svg class="tree-svg" viewBox="0 0 ${W} ${H}" xmlns="${SVG_NS}"` +
           ` xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMax meet">`);
    s.push(defs());

    /* soil */
    s.push(`<ellipse cx="${baseX}" cy="${groundY + 8}" rx="330" ry="46" fill="url(#tGround)"/>`);

    /* trunk + roots */
    s.push(`<path class="trunk" d="
      M${baseX-52},${groundY}
      C${baseX-38},${groundY-280} ${baseX-24},${groundY-560} ${baseX-15},${topY+150}
      C${baseX-11},${topY+70} ${baseX-7},${topY+24} ${baseX-6},${topY}
      L${baseX+6},${topY}
      C${baseX+7},${topY+24} ${baseX+11},${topY+70} ${baseX+15},${topY+150}
      C${baseX+24},${groundY-560} ${baseX+38},${groundY-280} ${baseX+52},${groundY}
      C${baseX+34},${groundY-6} ${baseX-34},${groundY-6} ${baseX-52},${groundY}Z"
      fill="url(#tBark)"/>`);
    s.push(`<path d="M${baseX-48},${groundY-4} C${baseX-110},${groundY+6} ${baseX-160},${groundY+24} ${baseX-198},${groundY+32}
             M${baseX+48},${groundY-4} C${baseX+110},${groundY+6} ${baseX+160},${groundY+24} ${baseX+198},${groundY+32}
             M${baseX-26},${groundY} C${baseX-56},${groundY+18} ${baseX-74},${groundY+32} ${baseX-104},${groundY+40}
             M${baseX+26},${groundY} C${baseX+56},${groundY+18} ${baseX+74},${groundY+32} ${baseX+104},${groundY+40}"
             stroke="url(#tBark)" stroke-width="10" stroke-linecap="round" fill="none" opacity=".85"/>`);
    /* a few bark seams, so the trunk isn't a flat slab */
    s.push(`<path d="M${baseX-22},${groundY-60} C${baseX-16},${groundY-380} ${baseX-11},${groundY-700} ${baseX-7},${topY+220}
             M${baseX+16},${groundY-100} C${baseX+12},${groundY-420} ${baseX+8},${groundY-720} ${baseX+5},${topY+260}"
             stroke="rgba(0,0,0,.34)" stroke-width="3" fill="none" stroke-linecap="round"/>`);

    /* Branches: oldest month at the bottom, the canopy narrowing
       and lifting as the year goes up. */
    const first = 1250, last = 330;
    for (let m = 0; m < CONFIG.tree.months; m++) {
      const t = m / (CONFIG.tree.months - 1);          /* 0 → 1 up the trunk */
      const y = first - t * (first - last);
      const halfWidth = 50 - t * 44;
      const side = m % 2 === 0 ? -1 : 1;

      /* Lower limbs reach out and long; upper ones lift and shorten. */
      const len  = 540 - t * 300 + (m % 2 ? 14 : 0);
      const rise = 16 + t * 40;
      const attach = pt(baseX + side * halfWidth * 0.65, y);
      s.push(monthBranch(attach, side, len, m, year, records, opts, rise));
    }

    /* crown */
    s.push(`<circle cx="${baseX}" cy="${topY - 4}" r="30" fill="url(#tGlow)"/>`);
    s.push('</svg>');
    return s.join('');
  }

  /* ── one month, big enough to touch ───────────────────── */
  function monthSvg(year, monthIndex, records) {
    const W = 1000, H = 1240;
    const stemX = 500, bottomY = 1180, topY = 150;
    const opts = { mainWidth: 16, weekWidth: 9, twigLen: 96, leafScale: 0.42,
                   interactive: true, fixedTwig: true };
    const dim = U.daysInMonth(year, monthIndex + 1);

    const s = [];
    s.push(`<svg class="tree-svg tree-month" viewBox="0 0 ${W} ${H}" xmlns="${SVG_NS}"` +
           ` xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid meet">`);
    s.push(defs());
    s.push(`<ellipse cx="${stemX}" cy="${bottomY + 6}" rx="210" ry="30" fill="url(#tGround)"/>`);
    s.push(`<path d="M${stemX-24},${bottomY} C${stemX-16},${bottomY-380} ${stemX-10},${bottomY-700} ${stemX-7},${topY}
             L${stemX+7},${topY} C${stemX+10},${bottomY-700} ${stemX+16},${bottomY-380} ${stemX+24},${bottomY}Z"
             fill="url(#tBark)"/>`);

    const ys = [1000, 780, 560, 340];
    ys.forEach((y, w) => {
      const side = w % 2 === 0 ? -1 : 1;
      const len = 372;
      const p0 = pt(stemX + side * 14, y);
      const a = side > 0 ? -20 : 200;
      const end = move(p0, a, len);
      const ctrl = move(p0, a + (side > 0 ? 14 : -14), len * 0.55);

      const dates = [];
      for (let d = 0; d < 7; d++) {
        const dayNo = w * 7 + d + 1;
        dates.push(dayNo <= dim
          ? `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(dayNo).padStart(2,'0')}`
          : null);
      }
      s.push(weekBranch(p0, ctrl, end, w, dates, records, opts));
      const lp = move(p0, a + (side > 0 ? 150 : -150), 46);
      s.push(`<text class="week-label" x="${f(lp.x)}" y="${f(lp.y)}" text-anchor="middle">` +
             `${T('week')} ${U.num(w + 1)}</text>`);

      if (w === 3 && dim > 28) {
        for (let extra = 29; extra <= dim; extra++) {
          const i = extra - 29;
          const key = `${year}-${String(monthIndex+1).padStart(2,'0')}-${extra}`;
          const base = move(end, a + (i - 1) * 24, 34);
          s.push(dayTwig(base, a + (i - 1) * 24 - 16, opts.twigLen * 0.85, key, records[key], opts));
        }
      }
    });

    s.push('</svg>');
    return s.join('');
  }

  /* ── public rendering ─────────────────────────────────── */

  /* records: { 'YYYY-MM-DD': salahRecord } */
  async function recordsFor(userId, year) {
    const rows = await Salah.range(userId, `${year}-01-01`, `${year}-12-31`);
    const map = {};
    rows.forEach(r => { map[r.date] = r; });
    return map;
  }

  function renderYear(container, { year, records, onPickMonth, onPickDay }) {
    container.innerHTML = yearSvg(year, records);
    const svg = container.querySelector('svg');
    enablePanZoom(svg, container);
    svg.addEventListener('click', ev => {
      /* الضغط على غصن يومٍ يفتح ذلك اليوم مباشرة، ولو كان قد مضى. */
      const hit = ev.target.closest('[data-dayhit]');
      if (hit && onPickDay) {
        if (hit.dataset.dayhit > U.todayKey()) return;
        return onPickDay(hit.dataset.dayhit);
      }
      const g = ev.target.closest('[data-month]') || ev.target.closest('[data-monthlabel]');
      if (!g) return;
      const m = g.dataset.month !== undefined ? +g.dataset.month : +g.dataset.monthlabel;
      onPickMonth && onPickMonth(m);
    });
    return svg;
  }

  function renderMonth(container, { year, month, records, onToggleSlot, onPickDay }) {
    container.innerHTML = monthSvg(year, month, records);
    const svg = container.querySelector('svg');
    enablePanZoom(svg, container);

    svg.addEventListener('click', ev => {
      const leaf = ev.target.closest('[data-slot]');
      if (leaf) {
        const key = leaf.dataset.day;
        if (key > U.todayKey()) return;               /* no marking the future */
        onToggleSlot && onToggleSlot(key, leaf.dataset.slot);
        return;
      }
      const hit = ev.target.closest('[data-dayhit]');
      if (hit) onPickDay && onPickDay(hit.dataset.dayhit);
    });
    return svg;
  }

  /* Repaints one day's leaves without rebuilding the whole tree. */
  function refreshDay(svg, dateKey, rec, interactive) {
    const g = svg.querySelector(`g.day[data-day="${dateKey}"]`);
    if (!g) return;
    const complete = rec && Salah.isComplete(rec);
    g.classList.toggle('complete', !!complete);
    const past = dateKey < U.todayKey();

    g.querySelectorAll('use[data-slot]').forEach(node => {
      const slotId = node.dataset.slot;
      const slot = CONFIG.prayerSlots.find(p => p.id === slotId);
      const on = !!(rec && rec.slots && rec.slots[slotId]);
      const jama = !!(rec && rec.jamaah && rec.jamaah[slotId]);
      const missed = past && !on && isMissable(slot);

      node.setAttribute('fill',
        on ? (slot.kind === 'fard' ? 'url(#tFard)' : 'url(#tExtra)')
           : missed ? 'url(#tMissed)' : 'var(--leaf-empty)');
      node.setAttribute('opacity', on ? 1 : (missed ? 0.92 : 0.5));
      node.classList.toggle('on', on);
      node.classList.toggle('missed', missed);

      if (jama) { node.setAttribute('stroke', 'var(--gold-300)'); node.setAttribute('stroke-width', '.07'); }
      else node.removeAttribute('stroke');
    });
  }

  /* ── pinch / drag / wheel navigation ──────────────────── */
  function enablePanZoom(svg, container) {
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const home = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    let cur = Object.assign({}, home);
    const MIN = 0.35, MAX = 14;

    const apply = () => svg.setAttribute('viewBox',
      `${f(cur.x)} ${f(cur.y)} ${f(cur.w)} ${f(cur.h)}`);

    function zoomAt(clientX, clientY, factor) {
      const rect = svg.getBoundingClientRect();
      const scale = home.w / cur.w;
      const next = U.clamp(scale * factor, MIN, MAX);
      const nw = home.w / next, nh = home.h / next;
      const rx = (clientX - rect.left) / rect.width;
      const ry = (clientY - rect.top) / rect.height;
      cur.x += (cur.w - nw) * rx;
      cur.y += (cur.h - nh) * ry;
      cur.w = nw; cur.h = nh;
      apply();
    }

    container.addEventListener('wheel', ev => {
      ev.preventDefault();
      zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.18 : 1 / 1.18);
    }, { passive: false });

    const pointers = new Map();
    let lastDist = 0, moved = false;

    container.addEventListener('pointerdown', ev => {
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      moved = false;
      container.setPointerCapture(ev.pointerId);
    });

    container.addEventListener('pointermove', ev => {
      const prev = pointers.get(ev.pointerId);
      if (!prev) return;
      const rect = svg.getBoundingClientRect();

      if (pointers.size === 1) {
        const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        cur.x -= dx * (cur.w / rect.width);
        cur.y -= dy * (cur.h / rect.height);
        apply();
      }
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist) {
          zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / lastDist);
          moved = true;
        }
        lastDist = dist;
      }
    });

    const release = ev => {
      pointers.delete(ev.pointerId);
      if (pointers.size < 2) lastDist = 0;
    };
    container.addEventListener('pointerup', release);
    container.addEventListener('pointercancel', release);

    /* A drag should never be mistaken for a tap on a leaf. */
    svg.addEventListener('click', ev => {
      if (moved) { ev.stopPropagation(); ev.preventDefault(); moved = false; }
    }, true);

    container.addEventListener('dblclick', ev => {
      ev.preventDefault();
      zoomAt(ev.clientX, ev.clientY, 1.9);
    });

    svg.__resetView = () => { cur = Object.assign({}, home); apply(); };
    svg.__zoomBy = factor => {
      const r = svg.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
    };
    return svg;
  }

  /* ── numbers for the progress line under the tree ─────── */
  function stats(records, year) {
    const perDay = CONFIG.prayerSlots.length;
    let totalDays = 0;
    for (let m = 1; m <= 12; m++) totalDays += U.daysInMonth(year, m);
    const totalLeaves = totalDays * perDay;

    let grown = 0, fullDays = 0, jamaah = 0;
    Object.values(records).forEach(r => {
      const c = Object.keys(r.slots || {}).length;
      grown += c;
      jamaah += Object.keys(r.jamaah || {}).length;
      if (Salah.isComplete(r)) fullDays++;
    });

    const elapsedDays = U.clamp(
      U.diffDays(`${year}-01-01`, U.todayKey()) + 1, 0, totalDays);

    /* Missed = a fard prayer on a day that has already ended and
       was never recorded. Days before the student joined count too,
       which is why this is shown as "so far this year". */
    const missableFard = CONFIG.tree.markMissedFard !== false
      ? CONFIG.prayerSlots.filter(p => p.kind === 'fard') : [];
    const closedDays = Math.max(0, elapsedDays - 1);
    let missed = 0;
    for (let i = 0; i < closedDays; i++) {
      const key = U.addDays(`${year}-01-01`, i);
      const rec = records[key];
      missableFard.forEach(p => { if (!rec || !rec.slots[p.id]) missed++; });
    }

    return {
      grown, totalLeaves, fullDays, jamaah, missed,
      totalDays, elapsedDays,
      percent: U.pct(grown, totalLeaves),
      percentSoFar: U.pct(grown, Math.max(1, elapsedDays * perDay))
    };
  }

  return { renderYear, renderMonth, refreshDay, recordsFor, stats, yearSvg, monthSvg };
})();
