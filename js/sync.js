/* ============================================================
   بصائرنا — Sync (طبقة المزامنة الموحّدة)

   الهدف: مصدر واحد للحقيقة = Supabase.
   IndexedDB هو cache فقط. كل كتابة تمر عبر Sync,
   وكل قراءة للمعلّم تمر عبر Sync (سحابة أولاً، كاش ثانياً).

   يحلّ حلقة v20-v25 التي كانت توزّع منطق السحب
   في teacher.js و report.js و auth.js.
   ============================================================ */

window.Sync = (function () {

  function isOnline() {
    return !!(window.SupabaseClient && window.SupabaseClient.isConfigured);
  }

  /* ── دفع كائن مستخدم/تقرير للسحابة (مع تجاهل أخطاء الشبكة) ── */
  async function pushUser(user) {
    if (!isOnline() || !user || !user.id) return null;
    try { return await window.SupabaseClient.upsertUser(user); }
    catch (e) { console.warn('[Sync] pushUser فشل', e); return null; }
  }

  async function pushReport(report) {
    if (!isOnline() || !report || !report.id) return null;
    try { return await window.SupabaseClient.saveReport(report); }
    catch (e) { console.warn('[Sync] pushReport فشل', e); return null; }
  }

  /* ── سحب roster المعلّم من السحابة ودمجه محليًا ── */
  async function pullTeacherRoster(teacherId) {
    if (!isOnline() || !teacherId) return await Users.students(teacherId);
    try {
      const cloud = await window.SupabaseClient.getUsersByTeacher(teacherId);
      const have = new Set((await DB.all('users')).map(u => u.id));
      for (const s of cloud || []) {
        if (s.role !== 'student' || have.has(s.id)) continue;
        await DB.put('users', {
          id: s.id, role: 'student', name: s.name || '',
          pin: s.pin != null ? String(s.pin) : '', code: s.code || null,
          googleSub: s.googleSub || null, googleEmail: s.googleEmail || null,
          level: s.level != null ? s.level : 1, photo: null,
          selfSignup: !!s.selfSignup, teacherId: s.teacherId || teacherId,
          color: s.color || null, createdAt: s.createdAt || Date.now(),
          lastActiveAt: null, archived: !!s.archived
        });
      }
    } catch (e) { console.warn('[Sync] pullTeacherRoster فشل', e); }
    return await Users.students(teacherId);
  }

  /* ── سحب كل تقارير طلاب المعلّم ودمجها (يعتمد على pullTeacherRoster) ── */
  async function pullReportsForTeacher(teacherId) {
    if (!isOnline() || !teacherId) return [];
    const students = await pullTeacherRoster(teacherId);
    if (!students.length) return [];
    const ids = students.map(s => s.id);
    let cloud = [];
    try { cloud = await window.SupabaseClient.getReportsForUsers(ids) || []; }
    catch (e) { console.warn('[Sync] pullReportsForTeacher فشل', e); return []; }
    for (const cr of cloud) {
      try {
        const local = reportObject(cr);
        const existing = await DB.get('reports', local.id);
        if (!existing || (existing.updatedAt || 0) <= (local.updatedAt || 0)) {
          await DB.put('reports', local);
        }
      } catch (e) { /* تجاهل سجل معطوب */ }
    }
    await materializeEntries(cloud);
    return cloud;
  }

  /* مفتاح دخول ثابت لكل يوم من تقرير: نشتق سجل entries واحد
     (نوع new للحفظ و review للمراجعة) من تقرير اليوم كي تلتقطه
     Entries.forUser / coverage / streaks على جهاز المعلّم — فجدول
     entries لا يُملأ إلا من جهاز الطالب، فيبقى فارغًا عند المعلم. */
  function reportEntryId(report, type) {
    return report.userId + '|' + report.date + '|' + type;
  }

  async function materializeEntries(cloud) {
    for (const cr of cloud || []) {
      const q = cr.quran || {};
      const mem = +(q.memorized || 0);
      const rev = +(q.reviewed || 0);
      const entries = [];
      if (mem > 0) entries.push({
        id: reportEntryId(cr, 'new'), userId: cr.userId, date: cr.date,
        userDate: cr.userId + '|' + cr.date, type: 'new',
        surah: q.surah || 1, from: q.from || 1, to: cr.to || Math.max(1, mem),
        notes: cr.note || '', voiceId: null, status: 'pending', grade: null,
        teacherComment: '', reviewedAt: null, reviewedBy: null,
        createdAt: cr.submittedAt || cr.createdAt || Date.now()
      });
      if (rev > 0) entries.push({
        id: reportEntryId(cr, 'review'), userId: cr.userId, date: cr.date,
        userDate: cr.userId + '|' + cr.date, type: 'review',
        surah: q.surah || 1, from: q.from || 1, to: Math.max(1, rev),
        notes: '', voiceId: null, status: 'pending', grade: null,
        teacherComment: '', reviewedAt: null, reviewedBy: null,
        createdAt: cr.submittedAt || cr.createdAt || Date.now()
      });
      for (const e of entries) {
        const existing = await DB.get('entries', e.id);
        if (!existing) {
          try { await DB.put('entries', e); } catch (err) { /* تجاهل تعارض */ }
        }
      }
    }
  }

  function reportObject(cr) {
    return {
      id: cr.id, userId: cr.userId, date: cr.date,
      userDate: cr.userDate || (cr.userId + '|' + cr.date),
      quran: cr.quran || {}, poetry: cr.poetry || {},
      reading: cr.reading || {}, qiyam: !!cr.qiyam,
      note: cr.note || '', teacherNote: cr.teacherNote || '',
      submitted: !!cr.submitted, submittedAt: cr.submittedAt || null,
      teacherSeen: !!cr.teacherSeen,
      updatedAt: cr.updatedAt || Date.now(), createdAt: cr.createdAt || Date.now()
    };
  }

  /* ── سحب كل تقارير طالب واحد ودمجها محليًا ── */
  async function pullAllReportsForStudent(userId) {
    if (!isOnline() || !userId) return [];
    let cloud = [];
    try { cloud = await window.SupabaseClient.getReportsForUsers([userId]) || []; }
    catch (e) { console.warn('[Sync] pullAllReportsForStudent فشل', e); return []; }
    for (const cr of cloud) {
      try {
        const local = reportObject(cr);
        const existing = await DB.get('reports', local.id);
        if (!existing || (existing.updatedAt || 0) <= (local.updatedAt || 0)) {
          await DB.put('reports', local);
        }
      } catch (e) { /* تجاهل سجل معطوب */ }
    }
    await materializeEntries(cloud);
    return cloud;
  }

  /* ── سحب تقرير طالب واحد لتاريخ محدد ── */
  async function pullReportForStudent(userId, date) {
    if (!isOnline() || !userId || !date) return await Reports.get(userId, date);
    try {
      const cloud = await window.SupabaseClient.getReportsForUsers([userId]) || [];
      const cr = cloud.find(r => String(r.date) === String(date));
      if (cr) {
        const local = reportObject(cr);
        const existing = await DB.get('reports', local.id);
        if (!existing || (existing.updatedAt || 0) <= (local.updatedAt || 0)) {
          await DB.put('reports', local);
        }
        await materializeEntries([cr]);
      }
    } catch (e) { console.warn('[Sync] pullReportForStudent فشل', e); }
    return await Reports.get(userId, date);
  }

  return {
    isOnline,
    pushUser, pushReport,
    pullTeacherRoster, pullReportsForTeacher, pullReportForStudent, pullAllReportsForStudent
  };
})();
