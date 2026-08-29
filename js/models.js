/* ============================================================
   بصائرنا — data model

   Every read/write in the app goes through one of these
   repositories, so a future server only has to replace this file.
   ============================================================ */

/* ── Users ─────────────────────────────────────────────── */
window.Users = {
  async all()        { return (await DB.all('users')).filter(u => !u.archived); },
  async byId(id)     { return DB.get('users', id); },
  async teachers()   { return (await this.all()).filter(u => u.role === 'teacher'); },
  async students(teacherId) {
    const list = (await this.all()).filter(u => u.role === 'student');
    return (teacherId ? list.filter(u => u.teacherId === teacherId) : list)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  },

  /* رمز دخول قصير يسهل نطقه وكتابته، بلا حروف تلتبس. */
  makeCode(existing) {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const taken = new Set((existing || []).map(u => u.code));
    for (let attempt = 0; attempt < 200; attempt++) {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      if (!taken.has(code)) return code;
    }
    return 'S' + Date.now().toString(36).toUpperCase().slice(-5);
  },

  async byCode(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return null;
    return (await this.all()).find(u => (u.code || '').toUpperCase() === code) || null;
  },

  async byGoogle(sub, email) {
    const list = await this.all();
    return list.find(u => sub && u.googleSub === sub)
        || list.find(u => email && (u.googleEmail || '').toLowerCase() === String(email).toLowerCase())
        || null;
  },

  async create({ name, role, pin, teacherId, googleEmail, googleSub, level, photo }) {
    const palette = ['#109C86','#E3B457','#21C0A6','#C99B33','#6FDCC8','#0B7A68','#F0CC80'];
    const existing = await DB.all('users');
    const user = {
      id: U.uid(role === 'teacher' ? 'tch' : 'std'),
      role, name: (name || '').trim(),
      pin: String(pin || ''),
      code: this.makeCode(existing),
      googleSub: googleSub || null,
      googleEmail: (googleEmail || '').trim() || null,
      /* المستوى يختاره الطالب عند التسجيل — وعليه تتوقّف صفحة «برنامجي» */
      level: level || PROGRAM.defaultLevel,
      photo: photo || null,
      /* من سجّل بنفسه يُعلَّم ليراه المعلّم */
      selfSignup: false,
      teacherId: teacherId || null,
      color: palette[existing.length % palette.length],
      createdAt: Date.now(),
      lastActiveAt: null,
      archived: false
    };
    await DB.put('users', user);
    return user;
  },

  async update(id, patch) {
    const u = await DB.get('users', id);
    if (!u) return null;
    Object.assign(u, patch);
    await DB.put('users', u);
    return u;
  },

  async touch(id) {
    const u = await DB.get('users', id);
    if (u) { u.lastActiveAt = Date.now(); await DB.put('users', u); }
  },

  /* Removes the student and everything attached to them. */
  async remove(id) {
    for (const store of ['entries', 'salah', 'voice', 'tracks', 'goals', 'badges']) {
      await DB.removeWhere(store, r => r.userId === id);
    }
    await DB.removeWhere('motivations', r => r.studentId === id);
    await DB.remove('users', id);
  }
};

/* ── Memorization entries ──────────────────────────────── */
window.Entries = {
  /* Newest first: by day, then by the order they were logged. */
  async forUser(userId) {
    return (await DB.where('entries', 'userId', userId))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  },
  async forUserOnDate(userId, date) {
    return (await DB.where('entries', 'userDate', userId + '|' + date));
  },
  async pending(teacherId) {
    const students = await Users.students(teacherId);
    const ids = new Set(students.map(s => s.id));
    return (await DB.all('entries'))
      .filter(e => e.status === 'pending' && ids.has(e.userId))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async create(data) {
    const e = Object.assign({
      id: U.uid('ent'),
      userId: null,
      date: U.todayKey(),
      type: 'new',
      surah: 1, from: 1, to: 7,
      notes: '',
      voiceId: null,
      status: 'pending',
      grade: null,
      teacherComment: '',
      reviewedAt: null,
      reviewedBy: null,
      createdAt: Date.now()
    }, data);
    e.userDate = e.userId + '|' + e.date;
    await DB.put('entries', e);
    await Badges.check(e.userId);
    return e;
  },

  async update(id, patch) {
    const e = await DB.get('entries', id);
    if (!e) return null;
    Object.assign(e, patch);
    e.userDate = e.userId + '|' + e.date;
    await DB.put('entries', e);
    return e;
  },

  async review(id, { status, grade, teacherComment, reviewedBy }) {
    return this.update(id, {
      status, grade, teacherComment,
      reviewedBy, reviewedAt: Date.now()
    });
  },

  async remove(id) {
    const e = await DB.get('entries', id);
    if (e && e.voiceId) await DB.remove('voice', e.voiceId);
    await DB.remove('entries', id);
  },

  /* Deletes the entry and its recording, and hands back a function
     that puts both back exactly as they were. Nothing is kept in a
     hidden bin — if the caller drops the restorer, it is gone. */
  async removeUndoable(id) {
    const entry = await DB.get('entries', id);
    if (!entry) return null;
    const voice = entry.voiceId ? await DB.get('voice', entry.voiceId) : null;

    await DB.remove('entries', id);
    if (voice) await DB.remove('voice', voice.id);

    return async function restore() {
      if (voice) await DB.put('voice', voice);
      await DB.put('entries', entry);
      await Badges.check(entry.userId);
      return entry;
    };
  },

  /* How much of the mushaf this student has actually covered. */
  async coverage(userId, { onlyApproved = false } = {}) {
    let list = await this.forUser(userId);
    list = list.filter(e => e.type !== 'tilawah');
    if (onlyApproved) list = list.filter(e => e.status === 'approved');
    return QURAN.coverage(list.map(e => ({ surah: e.surah, from: e.from, to: e.to })));
  }
};

/* ── Salah day records ─────────────────────────────────── */
window.Salah = {
  key: (userId, date) => userId + '|' + date,

  async day(userId, date) {
    const rec = await DB.get('salah', this.key(userId, date));
    return rec || { id: this.key(userId, date), userId, date,
                    userDate: this.key(userId, date), slots: {}, jamaah: {} };
  },

  async forUser(userId) { return DB.where('salah', 'userId', userId); },

  async range(userId, fromDate, toDate) {
    return (await this.forUser(userId))
      .filter(r => r.date >= fromDate && r.date <= toDate);
  },

  async setSlot(userId, date, slotId, on) {
    const rec = await this.day(userId, date);
    if (on) rec.slots[slotId] = 1; else { delete rec.slots[slotId]; delete rec.jamaah[slotId]; }
    await DB.put('salah', rec);
    await Badges.check(userId);
    return rec;
  },

  async setJamaah(userId, date, slotId, on) {
    const rec = await this.day(userId, date);
    if (on) { rec.slots[slotId] = 1; rec.jamaah[slotId] = 1; }
    else delete rec.jamaah[slotId];
    await DB.put('salah', rec);
    return rec;
  },

  async setDay(userId, date, slotIds) {
    const rec = await this.day(userId, date);
    rec.slots = {};
    (slotIds || []).forEach(id => { rec.slots[id] = 1; });
    Object.keys(rec.jamaah).forEach(k => { if (!rec.slots[k]) delete rec.jamaah[k]; });
    await DB.put('salah', rec);
    await Badges.check(userId);
    return rec;
  },

  /* Wipes a day's ticks, returning a function that restores them. */
  async clearDayUndoable(userId, date) {
    const before = await this.day(userId, date);
    const slots = Object.assign({}, before.slots);
    const jamaah = Object.assign({}, before.jamaah);
    await this.setDay(userId, date, []);

    return async function restore() {
      const rec = await Salah.day(userId, date);
      rec.slots = slots; rec.jamaah = jamaah;
      await DB.put('salah', rec);
      await Badges.check(userId);
      return rec;
    };
  },

  fardIds()  { return CONFIG.prayerSlots.filter(p => p.kind === 'fard').map(p => p.id); },
  extraIds() { return CONFIG.prayerSlots.filter(p => p.kind === 'extra').map(p => p.id); },

  countFard(rec)  { return this.fardIds().filter(id => rec.slots[id]).length; },
  countExtra(rec) { return this.extraIds().filter(id => rec.slots[id]).length; },
  isComplete(rec) { return this.countFard(rec) >= CONFIG.streaks.salahMinFard; }
};

/* ── Voice notes ───────────────────────────────────────── */
window.Voice = {
  async save({ userId, blob, mime, duration }) {
    const rec = {
      id: U.uid('vo'), userId, blob, mime: mime || blob.type,
      size: blob.size, duration: duration || 0, createdAt: Date.now()
    };
    await DB.put('voice', rec);
    return rec;
  },
  async get(id) { return id ? DB.get('voice', id) : null; },
  async remove(id) { return DB.remove('voice', id); },
  async url(id) {
    const v = await this.get(id);
    return v && v.blob ? URL.createObjectURL(v.blob) : null;
  },
  async forUser(userId) { return DB.where('voice', 'userId', userId); }
};

/* ── Audio library (uploads) ───────────────────────────── */
window.Tracks = {
  async forUser(userId) {
    const own    = await DB.where('tracks', 'userId', userId);
    const shared = (await DB.all('tracks')).filter(t => t.shared);
    const seen = new Set();
    return own.concat(shared)
      .filter(t => (seen.has(t.id) ? false : seen.add(t.id)))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async addUpload({ userId, file, title, reciter, surah, shared }) {
    const rec = {
      id: U.uid('trk'), userId, kind: 'upload', shared: !!shared,
      title: title || file.name.replace(/\.[^.]+$/, ''),
      reciter: reciter || '',
      surah: surah || null,
      blob: file, mime: file.type || 'audio/mpeg', size: file.size,
      createdAt: Date.now()
    };
    await DB.put('tracks', rec);
    return rec;
  },

  /* Caches an online recitation so it plays without a connection. */
  async cacheOnline({ userId, url, title, reciter, surah }) {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('تعذّر التنزيل');
    const blob = await res.blob();
    const rec = {
      id: U.uid('trk'), userId, kind: 'offline', shared: false,
      title, reciter, surah, blob, mime: blob.type || 'audio/mpeg',
      size: blob.size, sourceUrl: url, createdAt: Date.now()
    };
    await DB.put('tracks', rec);
    return rec;
  },

  async remove(id) { return DB.remove('tracks', id); },
  async isCached(userId, url) {
    return (await this.forUser(userId)).some(t => t.sourceUrl === url);
  }
};

/* ── Motivation from the teacher ───────────────────────── */
window.Motivations = {
  /* `when` decides where the phrase shows up:
     'home'   — on the student's home screen
     'report' — right after they submit the daily report      */
  async create({ teacherId, studentId, text, source, when }) {
    const m = {
      id: U.uid('mot'), teacherId, studentId: studentId || null,
      text: (text || '').trim(), source: (source || '').trim(),
      when: when === 'report' ? 'report' : 'home',
      pinned: false, seenBy: [], createdAt: Date.now()
    };
    await DB.put('motivations', m);
    return m;
  },
  async update(id, patch) {
    const m = await DB.get('motivations', id);
    if (!m) return null;
    Object.assign(m, patch); await DB.put('motivations', m); return m;
  },
  async remove(id) { return DB.remove('motivations', id); },
  async byTeacher(teacherId) {
    return (await DB.all('motivations'))
      .filter(m => m.teacherId === teacherId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  /* كلمات معلّم هذا الطالب وحده: ما وُجّه إليه، وما عمّ حلقته.
     والسجلّات القديمة بلا `when` تُعدّ للصفحة الرئيسية. */
  async forStudent(studentId, when) {
    const student = await Users.byId(studentId);
    const teacherId = student && student.teacherId;
    return (await DB.all('motivations'))
      .filter(m => (!teacherId || !m.teacherId || m.teacherId === teacherId) &&
                   (m.studentId === studentId || m.studentId === null) &&
                   (!when || (m.when || 'home') === when))
      .sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
  },

  /* One phrase to greet the student with once the report is in. */
  async afterReport(studentId) {
    const list = await this.forStudent(studentId, 'report');
    if (list.length) {
      const pick = list.find(m => m.pinned) || list[Math.floor(Math.random() * list.length)];
      this.markSeen(pick.id, studentId);
      return pick;
    }
    return CONFIG.defaultMotivation[
      Math.floor(Math.random() * CONFIG.defaultMotivation.length)];
  },
  async markSeen(id, studentId) {
    const m = await DB.get('motivations', id);
    if (m && !m.seenBy.includes(studentId)) {
      m.seenBy.push(studentId); await DB.put('motivations', m);
    }
  }
};

/* ── Goals ─────────────────────────────────────────────
   A goal either names a place in the mushaf — الجزء ٣٠،
   سورة البقرة، الصفحات ٥٨٢–٦٠٤ — or asks for a bare quantity.
   Named goals are measured against that exact portion, so
   anything of it already memorized counts. Quantity goals are
   measured from the day the goal was set.
   ─────────────────────────────────────────────────────── */
window.Goals = {
  async activeFor(userId) {
    return (await DB.where('goals', 'userId', userId))
      .filter(g => g.active)
      .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  },
  async forUser(userId) {
    return (await DB.where('goals', 'userId', userId))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /* The stretch of mushaf a goal points at, or null for a quantity. */
  span(goal) {
    if (!goal) return null;
    if (goal.mode === 'juz')   return QURAN.juzRange(goal.juz);
    if (goal.mode === 'surah') return QURAN.surahRange(goal.surah);
    if (goal.mode === 'pages') return QURAN.pageRange(goal.fromPage, goal.toPage);
    return null;
  },

  /* What to call it when no title was typed. */
  label(goal) {
    const span = this.span(goal);
    if (span) return span.label;
    const unit = CONFIG.goalUnits.find(u => u.id === goal.unit);
    return `${U.num(goal.amount)} ${unit ? unit.name : ''}`;
  },

  async create(data) {
    /* Only one goal runs at a time; older ones become history. */
    const prev = await DB.where('goals', 'userId', data.userId);
    for (const g of prev) if (g.active) { g.active = false; await DB.put('goals', g); }

    const goal = Object.assign({
      id: U.uid('goal'),
      userId: null,
      mode: 'amount',
      title: '',
      amount: 1, unit: 'pages',
      juz: null, surah: null, fromPage: null, toPage: null,
      startDate: U.todayKey(),
      deadline: null,
      active: true, createdBy: null, createdAt: Date.now()
    }, data);

    goal.id = goal.id || U.uid('goal');
    if (!goal.title) goal.title = this.label(goal);
    await DB.put('goals', goal);
    return goal;
  },

  async update(id, patch) {
    const g = await DB.get('goals', id);
    if (!g) return null;
    Object.assign(g, patch);
    if (!g.title) g.title = this.label(g);
    await DB.put('goals', g);
    return g;
  },
  async remove(id) { return DB.remove('goals', id); },

  /* Converts a set of entries into the goal's own unit. */
  measure(goal, entries) {
    const ranges = entries.map(e => ({ surah: e.surah, from: e.from, to: e.to }));
    const span = this.span(goal);
    if (span) return QURAN.coverageIn(ranges, span).pages;

    const cov = QURAN.coverage(ranges);
    return {
      pages: cov.pages, ayahs: cov.ayahs, juz: cov.juz,
      surah: new Set(entries.map(e => e.surah)).size
    }[goal.unit] || 0;
  },

  async progress(goal) {
    if (!goal) return null;
    const all = (await Entries.forUser(goal.userId)).filter(e => e.type !== 'tilawah');
    const span = this.span(goal);

    let done, target, unit, percent;
    if (span) {
      const cov = QURAN.coverageIn(
        all.map(e => ({ surah: e.surah, from: e.from, to: e.to })), span);
      done = cov.pages;
      target = cov.totalPages;
      unit = 'pages';
      /* Percentage from ayahs — truer than dividing rounded pages. */
      percent = U.clamp(Math.round(cov.percent), 0, 100);
    } else {
      const since = all.filter(e => e.date >= goal.startDate);
      done = this.measure(goal, since);
      target = goal.amount;
      unit = goal.unit;
      percent = U.clamp(Math.round(done / target * 100), 0, 100);
    }

    return {
      done: +(+done).toFixed(2),
      target: +(+target).toFixed(2),
      unit,
      unitName: (CONFIG.goalUnits.find(u => u.id === unit) || {}).name || '',
      percent,
      remaining: Math.max(0, +(target - done).toFixed(2)),
      scope: span ? span.label : null,
      daysLeft: goal.deadline ? U.diffDays(U.todayKey(), goal.deadline) : null,
      complete: done >= target - 0.001
    };
  },

  /* ── نصيب اليوم من الهدف، موضِعًا لا مقدارًا ───────────
     الهدف اليومي بالصفحات يقول «كم»؛ وهذا يقول «أين»: يقسّم
     موضع الهدف على أيامه ويعيّن قطعة اليوم بعينها.
     يعود بـ null إذا كان الهدف مقدارًا مجرّدًا أو بلا موعد.   */
  dayPortion(goal, dateKey) {
    const span = this.span(goal);
    if (!span || !goal.deadline) return null;

    dateKey = dateKey || U.todayKey();
    const daysTotal = Math.max(1, U.diffDays(goal.startDate, goal.deadline) + 1);
    const index = U.clamp(U.diffDays(goal.startDate, dateKey), 0, daysTotal - 1);

    const totalAyahs = span.to - span.from + 1;
    const per = totalAyahs / daysTotal;
    const from = span.from + Math.round(index * per);
    const to = (index === daysTotal - 1)
      ? span.to
      : Math.min(span.to, span.from + Math.round((index + 1) * per) - 1);

    const a = QURAN.fromAbsolute(from);
    const b = QURAN.fromAbsolute(Math.max(from, to));
    const surahA = QURAN.get(a.surah), surahB = QURAN.get(b.surah);

    return {
      from, to,
      dayIndex: index, dayNumber: index + 1, daysTotal,
      ayahs: Math.max(0, to - from + 1),
      pages: QURAN.pagesBetween(from, to),
      /* A readable label: "النور ١ – ٦" or across surahs. */
      label: a.surah === b.surah
        ? `${surahA.name} ${a.ayah} – ${b.ayah}`
        : `${surahA.name} ${a.ayah} — ${surahB.name} ${b.ayah}`,
      start: { surah: a.surah, ayah: a.ayah, name: surahA.name },
      end:   { surah: b.surah, ayah: b.ayah, name: surahB.name }
    };
  },

  /* كل قطع الهدف، يومًا يومًا — للعرض على المصحف. */
  dayPortions(goal) {
    const span = this.span(goal);
    if (!span || !goal.deadline) return [];
    const daysTotal = Math.max(1, U.diffDays(goal.startDate, goal.deadline) + 1);
    const out = [];
    for (let i = 0; i < daysTotal; i++) {
      out.push(this.dayPortion(goal, U.addDays(goal.startDate, i)));
    }
    return out;
  },

  /* ── the daily share of a bigger goal ─────────────────
     A goal of 10 pages across 5 days is 2 pages today. If a day
     is missed, CONFIG.dailyGoalMode decides whether tomorrow's
     share grows to catch up ('adaptive') or the original pace
     stands ('fixed').
     Returns null when the goal has no deadline — without one
     there is nothing to divide the work over.                */
  async dailyPlan(goal, prog) {
    if (!goal || !goal.deadline) return null;
    prog = prog || await this.progress(goal);

    const today = U.todayKey();
    const daysTotal = Math.max(1, U.diffDays(goal.startDate, goal.deadline) + 1);
    const daysLeft = Math.max(0, U.diffDays(today, goal.deadline) + 1);  /* today included */
    const daysGone = U.clamp(daysTotal - daysLeft, 0, daysTotal);

    const planned = prog.target / daysTotal;
    const adaptive = daysLeft > 0 ? prog.remaining / daysLeft : prog.remaining;
    const perDay = (CONFIG.dailyGoalMode === 'fixed') ? planned : adaptive;

    const todayEntries = (await Entries.forUserOnDate(goal.userId, today))
      .filter(e => e.type !== 'tilawah');
    const todayDone = this.measure(goal, todayEntries);

    const round = n => +(+n).toFixed(2);
    const expectedByNow = planned * daysGone;

    return {
      perDay: round(Math.max(0, perDay)),
      plannedPerDay: round(planned),
      todayDone: round(todayDone),
      todayRemaining: round(Math.max(0, perDay - todayDone)),
      percentToday: perDay > 0 ? U.clamp(Math.round(todayDone / perDay * 100), 0, 100) : 100,
      doneToday: todayDone >= perDay - 0.001,
      daysTotal, daysLeft, daysGone,
      unit: prog.unit, unitName: prog.unitName,
      /* Behind means less memorized than the plain pace expected. */
      onTrack: prog.done >= expectedByNow - 0.001,
      behindBy: round(Math.max(0, expectedByNow - prog.done)),
      overdue: prog.daysLeft !== null && prog.daysLeft < 0 && !prog.complete
    };
  }
};

/* ── Badges (milestone awards) ─────────────────────────── */
window.Badges = {
  async forUser(userId) {
    return (await DB.where('badges', 'userId', userId))
      .sort((a, b) => b.awardedAt - a.awardedAt);
  },
  /* Called after any streak-affecting write; awards at most one
     badge per kind per check and returns what was newly earned. */
  async check(userId) {
    if (!userId) return [];
    const earned = [];
    const existing = await this.forUser(userId);
    const has = (kind, m) => existing.some(b => b.kind === kind && b.milestone === m);

    const salah = await Streaks.salah(userId);
    const memo  = await Streaks.memorization(userId);

    for (const [kind, streak] of [['salah', salah], ['memo', memo]]) {
      for (const m of CONFIG.streaks.milestones) {
        if (streak.current >= m && !has(kind, m)) {
          const badge = { id: U.uid('bdg'), userId, kind, milestone: m, awardedAt: Date.now(), seen: false };
          await DB.put('badges', badge);
          earned.push(badge);
        }
      }
    }
    return earned;
  },
  async markSeen(id) {
    const b = await DB.get('badges', id);
    if (b) { b.seen = true; await DB.put('badges', b); }
  }
};

/* ── Reciters ──────────────────────────────────────────
   Nothing ships with the program. The teacher adds whoever the
   halaqah should listen to, either by naming a reciter from the
   recitation library or by pasting their own link.
   ─────────────────────────────────────────────────────── */
window.Reciters = {
  /* قرّاء هذه الحلقة وحدها. */
  async all(teacherId) {
    const scope = teacherId !== undefined ? teacherId : Session.halaqah;
    return (await DB.all('reciters'))
      .filter(r => !scope || !r.teacherId || r.teacherId === scope)
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt);
  },
  async byId(id) { return DB.get('reciters', id); },

  async create({ teacherId, name, source, code, urlTemplate }) {
    const existing = await this.all();
    const rec = {
      id: U.uid('rec'),
      teacherId: teacherId || null,
      name: (name || '').trim(),
      source: source === 'custom' ? 'custom' : 'library',
      code: (code || '').trim(),
      urlTemplate: (urlTemplate || '').trim(),
      order: existing.length,
      createdAt: Date.now()
    };
    await DB.put('reciters', rec);
    return rec;
  },

  async update(id, patch) {
    const r = await DB.get('reciters', id);
    if (!r) return null;
    Object.assign(r, patch);
    await DB.put('reciters', r);
    return r;
  },

  async remove(id) { return DB.remove('reciters', id); },

  /* Where surah `no` lives for this reciter. */
  urlFor(reciter, no) {
    if (!reciter) return null;
    if (reciter.source === 'custom' && reciter.urlTemplate) {
      return reciter.urlTemplate
        .split('{surah3}').join(String(no).padStart(3, '0'))
        .split('{surah}').join(String(no));
    }
    return CONFIG.audio.libraryUrl(reciter.code, no);
  },

  /* ── ملفات القارئ المرفوعة ────────────────────────────
     المعلّم يرفع تلاوة القارئ ملفًّا ملفًّا أو المصحف دفعة واحدة،
     ويُنسَب كل ملف إلى سورته من الرقم في اسمه. وكل قارئ معزول
     عن غيره: ملفاته تحت معرّفه هو.
     ─────────────────────────────────────────────────── */

  /* يستخرج رقم السورة من اسم الملف: "002.mp3"، "سورة 2"،
     "Al-Baqara-002" … ويُهمل ما لا رقم فيه أو ما جاوز ١١٤. */
  surahFromName(name) {
    const base = String(name || '').replace(/\.[^.]+$/, '');
    const nums = base.match(/\d{1,3}/g);
    if (!nums) return null;
    /* أطول رقم أولى بالاعتبار (٠٠٢ قبل ١٢٨ في "128kbps"). */
    for (const raw of nums.slice().sort((a, b) => b.length - a.length)) {
      const n = parseInt(raw, 10);
      if (n >= 1 && n <= 114) return n;
    }
    return null;
  },

  async filesOf(reciterId) {
    return (await DB.where('tracks', 'reciterId', reciterId))
      .sort((a, b) => (a.surah || 999) - (b.surah || 999));
  },

  /* يرفع دفعة ملفات وينسبها إلى سورها. */
  async addFiles(reciter, files, onProgress) {
    const out = { matched: 0, unmatched: 0, ids: [] };
    let i = 0;
    for (const file of files) {
      const no = this.surahFromName(file.name);
      const surah = no ? QURAN.get(no) : null;
      const rec = {
        id: U.uid('trk'), userId: reciter.teacherId, reciterId: reciter.id,
        kind: 'reciter', shared: true,
        title: surah ? surah.fullName : file.name.replace(/\.[^.]+$/, ''),
        reciter: reciter.name,
        surah: no,
        blob: file, mime: file.type || 'audio/mpeg', size: file.size,
        createdAt: Date.now()
      };
      await DB.put('tracks', rec);
      out.ids.push(rec.id);
      if (no) out.matched++; else out.unmatched++;
      if (onProgress) onProgress(++i, files.length);
    }
    return out;
  },

  async removeFiles(reciterId) {
    const rows = await this.filesOf(reciterId);
    for (const r of rows) await DB.remove('tracks', r.id);
    return rows.length;
  },

  /* هل لهذا القارئ ملفات مرفوعة بدل المكتبة؟ */
  async hasFiles(reciterId) {
    return (await this.filesOf(reciterId)).length > 0;
  },

  /* A quick sanity check before saving, so a typo surfaces now
     rather than as silence when a student presses play. */
  async testable(reciter) {
    const url = this.urlFor(reciter, 114);   /* الناس — smallest file */
    if (!url) return { ok: false, reason: 'لا يوجد رابط' };
    try {
      const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1024' } });
      return { ok: res.ok, status: res.status, url };
    } catch (e) {
      return { ok: false, reason: 'تعذّر الوصول للرابط', url };
    }
  }
};

/* ── Adhkar ────────────────────────────────────────────
   Built-in list from js/adhkar.js, plus whatever the teacher adds.
   Each student's tally is kept per day and resets at midnight.
   ─────────────────────────────────────────────────────── */
window.Adhkar = {
  categories() { return ADHKAR.categories; },

  /* الأذكار الأصلية للجميع، وما يضيفه المعلّم لحلقته وحدها. */
  async forCategory(catId, teacherId) {
    const scope = teacherId !== undefined ? teacherId : Session.halaqah;
    const built = ADHKAR.forCategory(catId);
    const custom = (await DB.all('adhkar'))
      .filter(d => d.category === catId && (!scope || !d.teacherId || d.teacherId === scope))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(d => Object.assign({}, d, { key: catId + ':' + d.id, custom: true }));
    return built.concat(custom);
  },

  async createCustom({ teacherId, category, title, text, count, source, virtue }) {
    teacherId = teacherId || Session.halaqah;
    const rec = {
      id: U.uid('dhk'), teacherId: teacherId || null,
      category, title: (title || '').trim(), text: (text || '').trim(),
      count: Math.max(1, +count || 1),
      source: (source || '').trim(), virtue: (virtue || '').trim(),
      createdAt: Date.now()
    };
    await DB.put('adhkar', rec);
    return rec;
  },
  async updateCustom(id, patch) {
    const d = await DB.get('adhkar', id);
    if (!d) return null;
    Object.assign(d, patch); await DB.put('adhkar', d); return d;
  },
  async removeCustom(id) { return DB.remove('adhkar', id); },

  /* ── today's tally ──────────────────────────────────── */
  logKey: (userId, date) => userId + '|' + date,

  async log(userId, date) {
    date = date || U.todayKey();
    const id = this.logKey(userId, date);
    return (await DB.get('adhkarLog', id)) ||
           { id, userId, date, userDate: id, counts: {} };
  },

  async setCount(userId, key, value) {
    const rec = await this.log(userId);
    if (value > 0) rec.counts[key] = value; else delete rec.counts[key];
    await DB.put('adhkarLog', rec);
    return rec;
  },

  /* One tap forward; wraps back to zero once the target is met so
     a student can start the same dhikr again. */
  async tap(userId, key, target) {
    const rec = await this.log(userId);
    const now = (rec.counts[key] || 0) + 1;
    return this.setCount(userId, key, now > target ? 0 : now);
  },

  async resetCategory(userId, catId) {
    const rec = await this.log(userId);
    Object.keys(rec.counts).forEach(k => {
      if (k.indexOf(catId + ':') === 0) delete rec.counts[k];
    });
    await DB.put('adhkarLog', rec);
    return rec;
  },

  /* How far through a category the student is today. */
  async progress(userId, catId) {
    const [items, rec] = await Promise.all([this.forCategory(catId), this.log(userId)]);
    const done = items.filter(i => (rec.counts[i.key] || 0) >= i.count).length;
    return { done, total: items.length, percent: U.pct(done, items.length), counts: rec.counts };
  },

  /* Every category at a glance — used on the home card and by
     the teacher when looking at a student. */
  async summary(userId) {
    const out = [];
    for (const cat of ADHKAR.categories) {
      const p = await this.progress(userId, cat.id);
      out.push({ category: cat, done: p.done, total: p.total, percent: p.percent });
    }
    const done = U.sum(out, o => o.done);
    const total = U.sum(out, o => o.total);
    return { categories: out, done, total, percent: U.pct(done, total) };
  },

  /* Days on which the student finished at least one category —
     feeds the teacher's view of consistency. */
  async activeDays(userId, days) {
    const rows = await DB.where('adhkarLog', 'userId', userId);
    const map = new Map(rows.map(r => [r.date, r]));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = U.addDays(U.todayKey(), -i);
      const rec = map.get(d);
      const count = rec ? Object.keys(rec.counts).length : 0;
      out.push({ date: d, count, complete: count > 0 });
    }
    return out;
  }
};

/* ── Files (uploads: poem texts, نحو summaries, photos) ── */
window.Files = {
  async save({ userId, file, kind, name }) {
    const rec = {
      id: U.uid('file'), userId, kind: kind || 'other',
      name: name || file.name,
      blob: file, mime: file.type || 'application/octet-stream',
      size: file.size, createdAt: Date.now()
    };
    await DB.put('files', rec);
    return rec;
  },
  async get(id) { return id ? DB.get('files', id) : null; },
  async remove(id) { return id ? DB.remove('files', id) : null; },
  async url(id) {
    const f = await this.get(id);
    return f && f.blob ? URL.createObjectURL(f.blob) : null;
  },
  /* Opens an uploaded file in a new tab, or downloads it. */
  async open(id) {
    const f = await this.get(id);
    if (!f) return false;
    U.download(f.name, f.blob);
    return true;
  }
};

/* ── Profile photo ─────────────────────────────────────
   Shrunk to a square thumbnail before storing — a phone photo
   is several megabytes and would fill the student's quota.   */
window.Photo = {
  MAX: 320,

  async fromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = url;
      });
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = this.MAX;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,
        (img.width - side) / 2, (img.height - side) / 2, side, side,
        0, 0, this.MAX, this.MAX);
      return await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  async set(userId, file) {
    const blob = await this.fromFile(file);
    await Users.update(userId, { photo: blob });
    return blob;
  },
  async clear(userId) { return Users.update(userId, { photo: null }); },

  url(user) {
    return (user && user.photo) ? URL.createObjectURL(user.photo) : null;
  }
};

/* ── الشعار الأسبوعي ───────────────────────────────────
   Each student writes their own line for the week; it greets
   them whenever they open the programme.
   ─────────────────────────────────────────────────────── */
window.Mottos = {
  key: (userId, week) => userId + '|' + week,

  async forWeek(userId, week) {
    week = week || ProgramDays.weekKey();
    return DB.get('mottos', this.key(userId, week));
  },
  async current(userId) { return this.forWeek(userId, ProgramDays.weekKey()); },

  async set(userId, text, week) {
    week = week || ProgramDays.weekKey();
    const rec = {
      id: this.key(userId, week), userId, week,
      text: (text || '').trim(), createdAt: Date.now()
    };
    await DB.put('mottos', rec);
    return rec;
  },
  async history(userId) {
    return (await DB.where('mottos', 'userId', userId))
      .sort((a, b) => b.week.localeCompare(a.week));
  },
  async remove(userId, week) { return DB.remove('mottos', this.key(userId, week)); }
};

/* ── Poems: title, total verses, remaining ─────────────── */
window.Poems = {
  async forUser(userId) {
    return (await DB.where('poems', 'userId', userId))
      .sort((a, b) => (b.active - a.active) || b.createdAt - a.createdAt);
  },
  async active(userId) {
    return (await this.forUser(userId)).find(p => p.active) || null;
  },
  async create({ userId, title, totalVerses, fileId }) {
    const prev = await DB.where('poems', 'userId', userId);
    for (const p of prev) if (p.active) { p.active = false; await DB.put('poems', p); }
    const rec = {
      id: U.uid('poem'), userId,
      title: (title || '').trim(),
      totalVerses: Math.max(1, +totalVerses || 1),
      fileId: fileId || null,
      active: true, createdAt: Date.now()
    };
    await DB.put('poems', rec);
    return rec;
  },
  async update(id, patch) {
    const p = await DB.get('poems', id);
    if (!p) return null;
    Object.assign(p, patch); await DB.put('poems', p); return p;
  },
  async remove(id) {
    const p = await DB.get('poems', id);
    if (p && p.fileId) await Files.remove(p.fileId);
    return DB.remove('poems', id);
  },

  /* How many verses of this poem the student has logged, and
     what is left of it. */
  async progress(poem) {
    if (!poem) return null;
    const reports = await DB.where('reports', 'userId', poem.userId);
    const done = U.sum(reports.filter(r => r.poetry && r.poetry.poemId === poem.id),
                       r => +r.poetry.verses || 0);
    const remaining = Math.max(0, poem.totalVerses - done);
    return {
      done, remaining, total: poem.totalVerses,
      percent: U.pct(done, poem.totalVerses),
      complete: done >= poem.totalVerses
    };
  }
};

/* ── Books: title, total pages, remaining ──────────────── */
window.Books = {
  async forUser(userId) {
    return (await DB.where('books', 'userId', userId))
      .sort((a, b) => (b.active - a.active) || b.createdAt - a.createdAt);
  },
  async active(userId) {
    return (await this.forUser(userId)).find(b => b.active) || null;
  },
  async create({ userId, title, totalPages, author, libraryId }) {
    const prev = await DB.where('books', 'userId', userId);
    for (const b of prev) if (b.active) { b.active = false; await DB.put('books', b); }
    const rec = {
      id: U.uid('book'), userId,
      title: (title || '').trim(), author: (author || '').trim(),
      totalPages: Math.max(1, +totalPages || 1),
      /* كتابٌ من المكتبة: محتواه هناك، وهنا تقدّم الطالب وحده */
      libraryId: libraryId || null,
      /* للقراءة داخل البرنامج: PDF، أو صور صفحات، أو نصّ يُقسَّم */
      pdfFileId: null, pageFiles: [], textFileId: null, textPages: null,
      currentPage: 1,
      active: true, createdAt: Date.now()
    };
    await DB.put('books', rec);
    return rec;
  },

  /* هل للكتاب نسخة تُقرأ داخل البرنامج؟ */
  isReadable(book) {
    return !!(book && (book.libraryId || book.pdfFileId ||
      (book.pageFiles && book.pageFiles.length) || book.textFileId));
  },
  /* عدد صفحات PDF لا يُعرف إلا بعد فتحه، فيُعاد ٠ ويتولّاه القارئ. */
  readablePages(book) {
    if (!book) return 0;
    if (book.pageFiles && book.pageFiles.length) return book.pageFiles.length;
    if (book.textPages) return book.textPages.length;
    if (book.pdfFileId) return book.pdfPages || 0;
    return 0;
  },

  async setPage(id, page) {
    const b = await DB.get('books', id);
    if (!b) return null;
    b.currentPage = Math.max(1, page);
    await DB.put('books', b);
    return b;
  },

  /* يُقسَّم النصّ إلى صفحات مرة واحدة عند الرفع. */
  paginate(text, perPage = 900) {
    const clean = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!clean) return [];
    const paras = clean.split(/\n{2,}/);
    const pages = [];
    let buf = '';
    paras.forEach(p => {
      if ((buf + '\n\n' + p).length > perPage && buf) { pages.push(buf.trim()); buf = p; }
      else buf = buf ? buf + '\n\n' + p : p;
      /* فقرة أطول من صفحة: تُقطَّع على حدود الكلمات */
      while (buf.length > perPage * 1.6) {
        let cut = buf.lastIndexOf(' ', perPage);
        if (cut < perPage * 0.5) cut = perPage;
        pages.push(buf.slice(0, cut).trim());
        buf = buf.slice(cut).trim();
      }
    });
    if (buf.trim()) pages.push(buf.trim());
    return pages;
  },
  async update(id, patch) {
    const b = await DB.get('books', id);
    if (!b) return null;
    Object.assign(b, patch); await DB.put('books', b); return b;
  },
  async remove(id) { return DB.remove('books', id); },

  async progress(book) {
    if (!book) return null;
    const reports = await DB.where('reports', 'userId', book.userId);
    const done = U.sum(reports.filter(r => r.reading && r.reading.bookId === book.id),
                       r => +r.reading.pages || 0);
    const minutes = U.sum(reports.filter(r => r.reading && r.reading.bookId === book.id),
                          r => +r.reading.minutes || 0);
    const remaining = Math.max(0, book.totalPages - done);
    return {
      done, remaining, minutes, total: book.totalPages,
      percent: U.pct(done, book.totalPages),
      complete: done >= book.totalPages
    };
  }
};

/* ── مكتبة الحلقة ──────────────────────────────────────
   كتبٌ يضعها المعلّم مرةً واحدة فيقرؤها كل طالب. الكتاب إمّا
   ملفٌّ مرفوع، أو ملفٌّ مرفقٌ مع البرنامج يُجلب عند أول فتح ثم
   يبقى بلا إنترنت.

   وأول صفحة غلافٌ: يُرسم من أول صفحة الكتاب نفسه، وللمعلّم أن
   يستبدله بصورة يختارها.
   ─────────────────────────────────────────────────────── */
window.Library = {
  /* كتب هذه الحلقة وحدها. */
  async all(teacherId) {
    const scope = teacherId !== undefined ? teacherId : Session.halaqah;
    return (await DB.all('library'))
      .filter(b => !b.archived && (!scope || !b.teacherId || b.teacherId === scope))
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt);
  },
  async get(id) { return DB.get('library', id); },

  async create({ teacherId, title, author, pages, fileId, url, coverFileId, note }) {
    const existing = await this.all();
    const rec = {
      id: U.uid('lib'), teacherId: teacherId || null,
      title: (title || '').trim(), author: (author || '').trim(),
      pages: +pages || 0,
      fileId: fileId || null,     /* ملفّ مرفوع في قاعدة البيانات */
      url: url || null,           /* أو ملفّ مرفق مع البرنامج */
      coverFileId: coverFileId || null,
      note: (note || '').trim(),
      order: existing.length, archived: false, createdAt: Date.now()
    };
    await DB.put('library', rec);
    return rec;
  },

  async update(id, patch) {
    const b = await DB.get('library', id);
    if (!b) return null;
    Object.assign(b, patch); await DB.put('library', b); return b;
  },

  async remove(id) {
    const b = await DB.get('library', id);
    if (b) {
      if (b.fileId) await Files.remove(b.fileId);
      if (b.coverFileId) await Files.remove(b.coverFileId);
    }
    return DB.remove('library', id);
  },

  /* من أين يُقرأ الكتاب: مصدرٌ صالحٌ لـ pdf.js. */
  async source(book) {
    if (!book) return null;
    if (book.fileId) {
      const f = await Files.get(book.fileId);
      return f ? { data: await f.blob.arrayBuffer() } : null;
    }
    if (book.url) return { url: book.url };
    return null;
  },

  /* الكتب المرفقة مع البرنامج، تُزرع في المكتبة أول تشغيل. */
  seeds: [
    {
      key: 'atomic-habits',
      title: 'Atomic Habits — العادات الذرية',
      author: 'James Clear',
      url: 'assets/library/atomic-habits.pdf',
      note: 'ملخّص الكتاب'
    }
  ],

  /* لكل معلّم نسخته من الكتب المرفقة — الحلقات لا تتشارك. */
  async seed(teacherId) {
    if (!teacherId) return;
    const have = await DB.all('library');
    for (const s of this.seeds) {
      if (have.some(b => b.seedKey === s.key && b.teacherId === teacherId)) continue;
      const rec = await this.create({
        teacherId, title: s.title, author: s.author, url: s.url, note: s.note
      });
      await this.update(rec.id, { seedKey: s.key });
    }
  }
};

/* ── سلسلة النحو: 28 lessons, one a week ───────────────── */
window.Nahw = {
  key: (userId, lesson) => userId + '|' + lesson,

  async forUser(userId) {
    return (await DB.where('nahw', 'userId', userId))
      .sort((a, b) => a.lesson - b.lesson);
  },
  async get(userId, lesson) { return DB.get('nahw', this.key(userId, lesson)); },

  async mark(userId, lesson, { done, summaryFileId, note }) {
    const rec = (await this.get(userId, lesson)) || {
      id: this.key(userId, lesson), userId, lesson, done: false,
      summaryFileId: null, note: '', createdAt: Date.now()
    };
    if (done !== undefined) { rec.done = !!done; rec.doneAt = done ? Date.now() : null; }
    if (summaryFileId !== undefined) rec.summaryFileId = summaryFileId;
    if (note !== undefined) rec.note = note;
    await DB.put('nahw', rec);
    return rec;
  },

  async removeSummary(userId, lesson) {
    const rec = await this.get(userId, lesson);
    if (rec && rec.summaryFileId) {
      await Files.remove(rec.summaryFileId);
      rec.summaryFileId = null;
      await DB.put('nahw', rec);
    }
    return rec;
  },

  async progress(userId) {
    const rows = await this.forUser(userId);
    const done = rows.filter(r => r.done).length;
    const withSummary = rows.filter(r => r.summaryFileId).length;
    return {
      done, withSummary, total: PROGRAM.nahw.lessons,
      percent: U.pct(done, PROGRAM.nahw.lessons)
    };
  },

  /* Which lesson the week we are in expects. */
  expectedLesson(termStart, dateKey) {
    const week = ProgramDays.weekNumber(termStart, dateKey);
    return U.clamp(week, 1, PROGRAM.nahw.lessons);
  }
};

/* ── الملتقيات: four a term ────────────────────────────── */
window.Meetups = {
  key: (userId, no) => userId + '|' + no,

  /* ── مواعيد الملتقيات ─────────────────────────────────
     موعدٌ واحد لكل ملتقى في الحلقة، يضعه المعلّم فيراه طلابه.
     والحضور بعد ذلك لكل طالب على حدة.                       */
  scheduleKey: teacherId => 'meetupDates:' + (teacherId || 'default'),

  async schedule(teacherId) {
    return (await DB.setting(this.scheduleKey(teacherId))) || {};
  },
  async setSchedule(teacherId, no, date) {
    const s = await this.schedule(teacherId);
    if (date) s[no] = date; else delete s[no];
    await DB.setting(this.scheduleKey(teacherId), s);
    return s;
  },
  /* موعد ملتقى بعينه للطالب، من جدول معلّمه. */
  async dateFor(user, no) {
    const s = await this.schedule(user.role === 'teacher' ? user.id : user.teacherId);
    return s[no] || null;
  },

  async forUser(userId) {
    const rows = await DB.where('meetups', 'userId', userId);
    const map = new Map(rows.map(r => [r.no, r]));
    return PROGRAM.meetups.map(m => map.get(m.no) ||
      { id: this.key(userId, m.no), userId, no: m.no, attended: false, date: null, note: '' });
  },

  async set(userId, no, { attended, date, note }) {
    const rec = (await DB.get('meetups', this.key(userId, no))) ||
      { id: this.key(userId, no), userId, no, attended: false, date: null, note: '' };
    if (attended !== undefined) rec.attended = !!attended;
    if (date !== undefined) rec.date = date;
    if (note !== undefined) rec.note = note;
    await DB.put('meetups', rec);
    return rec;
  },

  async progress(userId) {
    const rows = await this.forUser(userId);
    const done = rows.filter(r => r.attended).length;
    return { done, total: PROGRAM.meetups.length, percent: U.pct(done, PROGRAM.meetups.length) };
  }
};

/* ── التقرير اليومي ────────────────────────────────────
   One record per student per programme day, holding every
   track. `qiyam` lives here too but is only ever shown to the
   teacher — see PROGRAM.privateTracks.
   ─────────────────────────────────────────────────────── */
window.Reports = {
  key: (userId, date) => userId + '|' + date,

  blank(userId, date) {
    return {
      id: this.key(userId, date), userId, date, userDate: this.key(userId, date),
      quran:   { memorized: 0, reviewed: 0, surah: null, from: null, to: null },
      poetry:  { poemId: null, verses: 0 },
      reading: { bookId: null, pages: 0, minutes: 0 },
      qiyam:   false,            /* teacher-only */
      note: '',
      submitted: false, submittedAt: null,
      teacherNote: '', teacherSeen: false
    };
  },

  async get(userId, date) {
    return (await DB.get('reports', this.key(userId, date))) || this.blank(userId, date);
  },
  async forUser(userId) {
    return (await DB.where('reports', 'userId', userId))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  async range(userId, fromDate, toDate) {
    return (await this.forUser(userId)).filter(r => r.date >= fromDate && r.date <= toDate);
  },
  async submittedOn(date) {
    return (await DB.where('reports', 'date', date)).filter(r => r.submitted);
  },

  async save(userId, date, patch) {
    const rec = await this.get(userId, date);
    /* Merge one level down so a partial patch keeps the rest. */
    ['quran', 'poetry', 'reading'].forEach(k => {
      if (patch[k]) patch[k] = Object.assign({}, rec[k], patch[k]);
    });
    Object.assign(rec, patch);
    await DB.put('reports', rec);

    /* ── إرسال التقرير إلى Supabase إذا كان معداً ────────── */
    if (window.SupabaseClient && window.SupabaseClient.isConfigured) {
      try {
        await window.SupabaseClient.saveReport(rec);
      } catch (e) {
        console.warn('[Reports] فشل الحفظ في Supabase، محفوظ محلياً فقط:', e);
      }
    }

    return rec;
  },

  async submit(userId, date) {
    const rec = await this.save(userId, date, { submitted: true, submittedAt: Date.now() });
    await Badges.check(userId);

    /* ── إرسال التقرير النهائي إلى Supabase ────────────── */
    if (window.SupabaseClient && window.SupabaseClient.isConfigured) {
      try {
        await window.SupabaseClient.saveReport(rec);
        console.log('[Reports] تم إرسال التقرير إلى الخادم ✓');
        UI && UI.toast && UI.toast('تم إرسال التقرير بنجاح ✓', 'ok');
      } catch (e) {
        console.error('[Reports] فشل إرسال التقرير - التفاصيل:', e);
        console.error('[Reports] رسالة الخطأ:', e.message);
        UI && UI.toast && UI.toast('تم الحفظ محلياً - تحقق من الاتصال بالإنترنت', 'warn');
      }
    }

    return rec;
  },

  async unsubmit(userId, date) {
    return this.save(userId, date, { submitted: false, submittedAt: null });
  },

  /* Which of the day's targets this report met. */
  scoreDay(rec, targets) {
    targets = targets || PROGRAM.targets;
    const cap = PROGRAM.scoring.capPerItem;
    const ratio = (got, want) => want > 0 ? Math.min(cap, (+got || 0) / want) : ((+got || 0) > 0 ? 1 : 0);

    const parts = {
      quranMemorize: ratio(rec.quran.memorized, targets.quranMemorize),
      quranReview:   ratio(rec.quran.reviewed,  targets.quranReview),
      poetry:        ratio(rec.poetry.verses,   targets.poetryVerses),
      reading:       ratio(rec.reading.minutes, targets.readingMinutes)
    };
    if (ProgramDays.isQiyamDay(rec.date)) parts.qiyam = rec.qiyam ? 1 : 0;
    return parts;
  },

  /* ── بنود اليوم ────────────────────────────────────────
     أربعة في كل يوم متابعة، ويُزاد قيام الليل في أيامه — فكل
     يوم يُحسب بما يخصّه هو.

     `includePrivate` يُترك false في كل شاشة يشترك فيها الطلاب:
     لو دخل قيام الليل في العدّ هناك لعُرف من العدد نفسه، وهو
     بين الطالب ومعلّمه.                                        */
  dayItems(date, { includePrivate = false } = {}) {
    const items = [
      { key: 'quranMemorize', name: 'الحفظ' },
      { key: 'quranReview',   name: 'المراجعة' },
      { key: 'poetry',        name: 'الشعر' },
      { key: 'reading',       name: 'القراءة' }
    ];
    if (includePrivate && ProgramDays.isQiyamDay(date)) {
      items.push({ key: 'qiyam', name: 'قيام الليل', private: true });
    }
    return items;
  },

  /* كم بندًا من بنود اليوم أُتمّ. */
  countDone(rec, targets, opts) {
    const parts = this.scoreDay(rec, targets);
    return this.dayItems(rec.date, opts).filter(i => (parts[i.key] || 0) >= 1).length;
  },

  /* هل أتمّ الطالب بنود يومه كلها؟ */
  isComplete(rec, targets, opts) {
    const items = this.dayItems(rec.date, opts);
    return this.countDone(rec, targets, opts) === items.length;
  }
};

/* ── الفصل الدراسي ─────────────────────────────────────── */
window.Term = {
  async get() {
    const saved = await DB.setting('term');
    if (saved) return saved;
    const start = ProgramDays.weekKey(U.todayKey());
    const term = {
      name: PROGRAM.term.name,
      start,
      end: U.addDays(start, PROGRAM.term.weeks * 7 - 1)
    };
    await DB.setting('term', term);
    return term;
  },
  async set(patch) {
    const term = Object.assign(await this.get(), patch);
    await DB.setting('term', term);
    return term;
  },
  /* Programme days from the start of term up to today. */
  async elapsedDays() {
    const term = await this.get();
    const to = U.todayKey() < term.end ? U.todayKey() : term.end;
    return ProgramDays.daysBetween(term.start, to);
  }
};

/* ── التقييم ───────────────────────────────────────────
   One number per student, out of 100, built from the weights in
   PROGRAM.scoring. Details stay private; only the total is shown
   to the class.
   ─────────────────────────────────────────────────────── */
window.Score = {
  async forUser(userId, { term } = {}) {
    term = term || await Term.get();
    const to = U.todayKey() < term.end ? U.todayKey() : term.end;
    const days = ProgramDays.daysBetween(term.start, to);
    const qiyamDays = days.filter(d => ProgramDays.isQiyamDay(d));

    const user = await Users.byId(userId);
    const targets = Object.assign({}, PROGRAM.targets, (user && user.targets) || {});

    const reports = await Reports.range(userId, term.start, to);
    const byDate = new Map(reports.map(r => [r.date, r]));

    /* Daily tracks: the average of each day's ratio. */
    const sums = { quranMemorize: 0, quranReview: 0, poetry: 0, reading: 0, qiyam: 0 };
    days.forEach(d => {
      const rec = byDate.get(d);
      const parts = rec ? Reports.scoreDay(rec, targets)
                        : { quranMemorize: 0, quranReview: 0, poetry: 0, reading: 0, qiyam: 0 };
      sums.quranMemorize += parts.quranMemorize || 0;
      sums.quranReview   += parts.quranReview   || 0;
      sums.poetry        += parts.poetry        || 0;
      sums.reading       += parts.reading       || 0;
      if (ProgramDays.isQiyamDay(d)) sums.qiyam += parts.qiyam || 0;
    });

    const n = Math.max(1, days.length);
    const qn = Math.max(1, qiyamDays.length);

    const [nahw, meet] = await Promise.all([
      Nahw.progress(userId), Meetups.progress(userId)
    ]);
    /* Only count the lessons the term has actually reached. */
    const expectedLessons = U.clamp(
      ProgramDays.weekNumber(term.start, to), 1, PROGRAM.nahw.lessons);

    const ratios = {
      quranMemorize: sums.quranMemorize / n,
      quranReview:   sums.quranReview / n,
      poetry:        sums.poetry / n,
      reading:       sums.reading / n,
      qiyam:         sums.qiyam / qn,
      nahw:          Math.min(1, nahw.done / expectedLessons),
      meetups:       meet.total ? meet.done / meet.total : 0
    };

    const w = PROGRAM.scoring.weights;
    let total = 0, maxTotal = 0;
    Object.keys(w).forEach(k => {
      total += (ratios[k] || 0) * w[k];
      maxTotal += w[k];
    });

    return {
      userId,
      total: Math.round(total),
      outOf: maxTotal,
      percent: U.pct(Math.round(total), maxTotal),
      ratios,                    /* teacher only */
      days: days.length,
      submitted: reports.filter(r => r.submitted).length,
      nahw, meetups: meet
    };
  },

  /* Everyone's totals, ranked. Used for the public results board,
     which shows names and totals and nothing else. */
  async board(teacherId) {
    const students = await Users.students(teacherId);
    const term = await Term.get();
    const rows = [];
    for (const s of students) {
      const sc = await Score.forUser(s.id, { term });
      rows.push({ user: s, score: sc });
    }
    rows.sort((a, b) => b.score.total - a.score.total);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }
};

/* ── Session ───────────────────────────────────────────── */
window.Session = {
  user: null,

  /* حلقةُ من ننظر إليها: المعلّم نفسه، أو معلّم الطالب.
     كل ما يخصّ الحلقة — المكتبة والقرّاء والأذكار والكلمات — يُحصر بها. */
  get halaqah() {
    if (!this.user) return null;
    return this.user.role === 'teacher' ? this.user.id : (this.user.teacherId || null);
  },
  async restore() {
    const id = await DB.setting('currentUserId');
    if (!id) return null;
    this.user = await Users.byId(id);
    return this.user;
  },
  async login(user) {
    this.user = user;
    await DB.setting('currentUserId', user.id);
    await Users.touch(user.id);
    return user;
  },
  async logout() { this.user = null; await DB.setting('currentUserId', null); },
  get isTeacher() { return this.user && this.user.role === 'teacher'; },
  get isStudent() { return this.user && this.user.role === 'student'; }
};
