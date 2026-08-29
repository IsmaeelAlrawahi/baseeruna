/* ============================================================
   بصائرنا — Supabase Client

   هذا الملف يتعامل مع قاعدة بيانات Supabase السحابية
   ============================================================ */

(function () {
  // تُقرأ أولاً من window.__ENV__ (حقن وقت البناء عبر Vercel Env) ثم fallback
  const SUPABASE_URL = (window.__ENV__ && window.__ENV__.SUPABASE_URL) || 'https://qhokdpssplwhpbcwcoiy.supabase.co';
  const SUPABASE_ANON_KEY = (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFob2tkcHNzcGx3aHBiY3djb2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5ODM3ODQsImV4cCI6MjEwMzU1OTc4NH0.HckqSwifVuwV2tugonv088_2QDh7UucrdX7UF9YkBY';

  // التحقق من وجود الإعدادات
  const isConfigured = SUPABASE_URL && SUPABASE_ANON_KEY &&
                       !SUPABASE_URL.includes('YOUR_') &&
                       !SUPABASE_ANON_KEY.includes('YOUR_');

  // عنوان API
  const API_URL = isConfigured ? `${SUPABASE_URL}/rest/v1` : null;

  // Headers للطلبات
  function headers() {
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  // ═══════════════════════════════════════════════════════════
  // وظائف التقارير (Reports)
  // ═══════════════════════════════════════════════════════════

    async function saveReport(report) {
    if (!isConfigured) {
      console.warn('[Supabase] غير مُعدّ - التقرير محفوظ محلياً فقط');
      return null;
    }

    try {
      // أرسل الأسماء كما هي (camelCase) لتطابق أعمدة الجدول المنشأ في الـ DDL.
      // لا تجعلها lowercase وإلا فشل الإدراج برمز 400 "Could not find the ... column".
      const cleanReport = {
        id: report.id,
        userId: report.userId,
        date: report.date,
        userDate: report.userDate,
        quran: report.quran || {},
        poetry: report.poetry || {},
        reading: report.reading || {},
        qiyam: report.qiyam || false,
        note: report.note || '',
        teacherNote: report.teacherNote || '',
        submitted: report.submitted || false,
        submittedAt: report.submittedAt || null,
        teacherSeen: report.teacherSeen || false,
        updatedAt: report.updatedAt || Date.now(),
        createdAt: report.createdAt || Date.now()
      };

      console.log('[Supabase] إرسال التقرير:', report.id);

      // upsert (insert or update)
      const saveResponse = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          ...headers(),
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(cleanReport)
      });

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        console.error('[Supabase] Response status:', saveResponse.status);
        console.error('[Supabase] Response body:', errorText);
        throw new Error(`خطأ في الحفظ: ${saveResponse.status} - ${errorText}`);
      }

      const saved = await saveResponse.json();
      console.log('[Supabase] ✅ تم حفظ التقرير بنجاح:', report.id);
      return saved[0] || saved;
    } catch (error) {
      console.error('[Supabase] ❌ فشل حفظ التقرير:', error);
      console.error('[Supabase] تفاصيل الخطأ:', error.message);
      throw error;
    }
  }

  async function getReportsByUser(userId) {
    if (!isConfigured) return [];

    try {
      const response = await fetch(
        `${API_URL}/reports?userId=eq.${userId}&order=date.desc`,
        { headers: headers() }
      );

      if (!response.ok) throw new Error('فشل جلب التقارير');
      return await response.json();
    } catch (error) {
      console.error('[Supabase] خطأ في جلب التقارير:', error);
      return [];
    }
  }

  async function getReportsByDate(date) {
    if (!isConfigured) return [];

    try {
      const response = await fetch(
        `${API_URL}/reports?date=eq.${date}&submitted=eq.true`,
        { headers: headers() }
      );

      if (!response.ok) throw new Error('فشل جلب التقارير');
      return await response.json();
    } catch (error) {
      console.error('[Supabase] خطأ في جلب التقارير:', error);
      return [];
    }
  }

  async function getAllSubmittedReports() {
    if (!isConfigured) return [];

    try {
      const response = await fetch(
        `${API_URL}/reports?submitted=eq.true&order=submittedAt.desc`,
        { headers: headers() }
      );

      if (!response.ok) throw new Error('فشل جلب التقارير');
      return await response.json();
    } catch (error) {
      console.error('[Supabase] خطأ في جلب التقارير:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // وظائف المستخدمين (Users)
  // ═══════════════════════════════════════════════════════════

  // يحذف الحقول غير المشتركة (كالصور كمحتوى Blob) قبل الإرسال.
  function cleanUser(user) {
    if (!user) return null;
    const c = {
      id: user.id,
      role: user.role || 'student',
      name: user.name || '',
      pin: user.pin != null ? String(user.pin) : '',
      code: user.code || null,
      googleSub: user.googleSub || null,
      googleEmail: user.googleEmail || null,
      level: user.level != null ? user.level : 1,
      photo: (typeof user.photo === 'string') ? user.photo : null,
      selfSignup: !!user.selfSignup,
      teacherId: user.teacherId || null,
      color: user.color || null,
      createdAt: user.createdAt != null ? user.createdAt : Date.now(),
      lastActiveAt: user.lastActiveAt || null,
      archived: !!user.archived,
      updatedAt: user.updatedAt || Date.now()
    };
    return c;
  }

  async function upsertUser(user) {
    const clean = cleanUser(user);
    if (!clean || !clean.id) return null;
    try {
      const saveResponse = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          ...headers(),
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(clean)
      });
      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        console.error('[Supabase] users status:', saveResponse.status, errorText);
        return null;
      }
      const saved = await saveResponse.json();
      return saved[0] || saved || null;
    } catch (error) {
      console.error('[Supabase] فشل حفظ المستخدم:', error);
      return null;
    }
  }

  async function getUserById(userId) {
    if (!isConfigured || !userId) return null;
    try {
      const response = await fetch(
        `${API_URL}/users?id=eq.${encodeURIComponent(userId)}`,
        { headers: headers() }
      );
      if (!response.ok) return null;
      const rows = await response.json();
      return rows[0] || null;
    } catch (error) {
      console.error('[Supabase] خطأ في جلب المستخدم:', error);
      return null;
    }
  }

  async function getUserByCode(code) {
    if (!isConfigured || !code) return null;
    try {
      const response = await fetch(
        `${API_URL}/users?code=eq.${encodeURIComponent(code)}&select=*`,
        { headers: headers() }
      );
      if (!response.ok) return null;
      const rows = await response.json();
      return rows[0] || null;
    } catch (error) {
      console.error('[Supabase] خطأ في البحث عن الرمز:', error);
      return null;
    }
  }

  async function getUsersByTeacher(teacherId) {
    if (!isConfigured || !teacherId) return [];
    try {
      const response = await fetch(
        `${API_URL}/users?teacherId=eq.${encodeURIComponent(teacherId)}&archived=eq.false&order=name`,
        { headers: headers() }
      );
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('[Supabase] خطأ في جلب طلاب الحلقة:', error);
      return [];
    }
  }

  async function getAllStudents() {
    if (!isConfigured) return [];
    try {
      const response = await fetch(
        `${API_URL}/users?role=eq.student&archived=eq.false&select=*`,
        { headers: headers() }
      );
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('[Supabase] خطأ في جلب كل الطلاب:', error);
      return [];
    }
  }

  async function getAllTeachers() {
    if (!isConfigured) return [];
    try {
      const response = await fetch(
        `${API_URL}/users?role=eq.teacher&archived=eq.false&select=*`,
        { headers: headers() }
      );
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('[Supabase] خطأ في جلب المعلمين:', error);
      return [];
    }
  }

  // يجلب كل تقارير قائمة طلاب محدّدين (مهمة لشاشات المعلّم التي
  // تعتمد على النسخ المحلية). يستخدم userId=in.(...) دفعة واحدة.
  async function getReportsForUsers(userIds) {
    if (!isConfigured || !userIds || !userIds.length) return [];
    try {
      const list = Array.from(new Set(userIds)).filter(Boolean);
      if (!list.length) return [];
      const inClause = list.map(v => encodeURIComponent(v)).join(',');
      const response = await fetch(
        `${API_URL}/reports?userId=in.(${inClause})&order=date.desc&limit=1000`,
        { headers: headers() }
      );
      if (!response.ok) {
        console.error('[Supabase] getReportsForUsers status:', response.status);
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('[Supabase] خطأ في جلب تقارير الطلاب:', error);
      return [];
    }
  }

  // تصدير الوظائف
  window.SupabaseClient = {
    isConfigured,
    saveReport,
    getReportsByUser,
    getReportsByDate,
    getAllSubmittedReports,
    upsertUser,
    getUserById,
    getUserByCode,
    getUsersByTeacher,
    getAllStudents,
    getAllTeachers,
    getReportsForUsers
  };

  console.log('[Supabase]', isConfigured ? 'جاهز ✓' : 'غير مُعدّ - محلي فقط');
})();
