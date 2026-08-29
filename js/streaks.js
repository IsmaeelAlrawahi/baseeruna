/* ============================================================
   بصائرنا — streaks

   Two independent streaks: one for prayer, one for memorization.
   Rules live in CONFIG.streaks.

   Today never breaks a streak on its own — the day is still open,
   so an unfinished today simply doesn't extend it yet.
   ============================================================ */

window.Streaks = (function () {

  function compute(qualifyingDays, { freezesPerMonth }) {
    const set = new Set(qualifyingDays);
    const today = U.todayKey();

    /* ── current ──────────────────────────────────────── */
    let cursor = set.has(today) ? today : U.addDays(today, -1);
    let current = 0;
    const freezeUsed = {};        /* 'YYYY-MM' -> count */
    const frozenDays = [];

    while (true) {
      if (set.has(cursor)) { current++; }
      else {
        const month = cursor.slice(0, 7);
        const used = freezeUsed[month] || 0;
        /* A freeze only rescues a day that sits inside the streak,
           never one that would start it. */
        if (current > 0 && used < freezesPerMonth) {
          freezeUsed[month] = used + 1;
          frozenDays.push(cursor);
        } else break;
      }
      cursor = U.addDays(cursor, -1);
      if (current > 2000) break;   /* safety */
    }

    /* ── best ─────────────────────────────────────────── */
    const sorted = Array.from(set).sort();
    let best = 0, run = 0, prev = null;
    sorted.forEach(d => {
      run = (prev && U.diffDays(prev, d) === 1) ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    });

    return {
      current,
      best: Math.max(best, current),
      total: set.size,
      todayDone: set.has(today),
      lastDay: sorted[sorted.length - 1] || null,
      freezesUsedThisMonth: freezeUsed[today.slice(0, 7)] || 0,
      freezesLeftThisMonth: Math.max(0, freezesPerMonth - (freezeUsed[today.slice(0, 7)] || 0)),
      frozenDays
    };
  }

  async function salah(userId) {
    const rows = await Salah.forUser(userId);
    const days = rows.filter(r => Salah.isComplete(r)).map(r => r.date);
    const s = compute(days, CONFIG.streaks);
    s.kind = 'salah';
    return s;
  }

  async function memorization(userId) {
    const rows = await Entries.forUser(userId);
    const byDay = U.groupBy(rows, e => e.date);
    const days = Object.keys(byDay)
      .filter(d => byDay[d].length >= CONFIG.streaks.memoMinEntries);
    const s = compute(days, CONFIG.streaks);
    s.kind = 'memo';
    return s;
  }

  async function both(userId) {
    const [a, b] = await Promise.all([salah(userId), memorization(userId)]);
    return { salah: a, memo: b };
  }

  /* Last `n` days as booleans — feeds the little dot rows in the UI. */
  async function recentSalah(userId, n) {
    const rows = await Salah.forUser(userId);
    const map = new Map(rows.map(r => [r.date, r]));
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = U.addDays(U.todayKey(), -i);
      const rec = map.get(d);
      out.push({
        date: d,
        fard: rec ? Salah.countFard(rec) : 0,
        extra: rec ? Salah.countExtra(rec) : 0,
        complete: rec ? Salah.isComplete(rec) : false
      });
    }
    return out;
  }

  async function recentMemo(userId, n) {
    const rows = await Entries.forUser(userId);
    const byDay = U.groupBy(rows, e => e.date);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = U.addDays(U.todayKey(), -i);
      const list = byDay[d] || [];
      out.push({
        date: d,
        count: list.length,
        pages: +U.sum(list, e => QURAN.pagesOf(e.surah, e.from, e.to)).toFixed(2),
        complete: list.length >= CONFIG.streaks.memoMinEntries
      });
    }
    return out;
  }

  /* Share of days kept over a window — the teacher's "الالتزام". */
  async function commitment(userId, days) {
    const [s, m] = await Promise.all([recentSalah(userId, days), recentMemo(userId, days)]);
    return {
      salahRate: U.pct(s.filter(d => d.complete).length, days),
      memoRate:  U.pct(m.filter(d => d.complete).length, days),
      fardRate:  U.pct(U.sum(s, d => d.fard), days * Salah.fardIds().length)
    };
  }

  /* Which prayer gets missed most — useful, gentle feedback. */
  async function weakestPrayer(userId, days) {
    const rows = await Salah.forUser(userId);
    const from = U.addDays(U.todayKey(), -(days - 1));
    const recent = rows.filter(r => r.date >= from);
    if (!recent.length) return null;
    const missed = {};
    CONFIG.prayerSlots.filter(p => p.kind === 'fard').forEach(p => {
      missed[p.id] = recent.filter(r => !r.slots[p.id]).length;
    });
    const worst = Object.keys(missed).sort((a, b) => missed[b] - missed[a])[0];
    if (!worst || missed[worst] === 0) return null;
    return { slot: CONFIG.prayerSlots.find(p => p.id === worst), missed: missed[worst], of: recent.length };
  }

  return { salah, memorization, both, recentSalah, recentMemo, commitment, weakestPrayer, compute };
})();
