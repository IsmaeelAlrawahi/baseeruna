/* ═══════════════════════════════════════════════════════════════
   بصائرنا — إعداد Supabase الجديد

   شغّل هذا الكود كاملاً في:  Supabase Dashboard ← SQL Editor ← New query ← Run

   يصلح لمشروع جديد فقط (سيعيد إنشاء الجدول إن وُجد).
   ═══════════════════════════════════════════════════════════════ */

-- محو أي نسخة قديمة من الجداول والسياسات
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;

-- ─────────────────────────────────────────────────────────────
-- جدول المستخدمين (الطلاب والمعلم) — للمزامنة بين الأجهزة
-- يحمل كل حسابٍ بنفس شكل الكائن المحلي في js/models.js Users.create
-- حتى نتمكن من مشاركة الحسابات بين جهاز المعلم وأجهزة الطلبة.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id             TEXT PRIMARY KEY,
  role           TEXT NOT NULL DEFAULT 'student',
  name           TEXT NOT NULL DEFAULT '',
  pin            TEXT DEFAULT '',
  code           TEXT,
  "googleSub"    TEXT,
  "googleEmail"  TEXT,
  level          INT DEFAULT 1,
  photo          TEXT,
  "selfSignup"   BOOLEAN DEFAULT false,
  "teacherId"    TEXT,
  color          TEXT,
  "createdAt"    BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  "lastActiveAt" BIGINT,
  archived       BOOLEAN DEFAULT false,
  "updatedAt"    BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX idx_users_code      ON public.users (code);
CREATE INDEX idx_users_teacherId ON public.users ("teacherId");
CREATE INDEX idx_users_role      ON public.users (role);

-- إنشاء جدول التقارير
-- ملاحظة: أسماء الأعمدة camelCase عمدًا، لأنها تطابق الكود في js/supabase-client.js
CREATE TABLE public.reports (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  date        TEXT NOT NULL,
  "userDate"  TEXT NOT NULL,

  -- بيانات القرآن
  quran JSONB DEFAULT '{"memorized": 0, "reviewed": 0, "surah": null, "from": null, "to": null}'::jsonb,
  -- بيانات الشعر
  poetry JSONB DEFAULT '{"poemId": null, "verses": 0}'::jsonb,
  -- بيانات القراءة
  reading JSONB DEFAULT '{"bookId": null, "pages": 0, "minutes": 0}'::jsonb,

  -- قيام الليل
  qiyam BOOLEAN DEFAULT false,

  -- الملاحظات
  note TEXT DEFAULT '',
  "teacherNote" TEXT DEFAULT '',

  -- حالة التقرير
  submitted BOOLEAN DEFAULT false,
  "submittedAt" BIGINT,
  "teacherSeen" BOOLEAN DEFAULT false,

  -- الطوابع الزمنية
  "updatedAt" BIGINT NOT NULL,
  "createdAt" BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,

  UNIQUE ("userId", date)
);

-- فهارس لتحسين الأداء
CREATE INDEX idx_reports_userId  ON public.reports ("userId");
CREATE INDEX idx_reports_date    ON public.reports (date);
CREATE INDEX idx_reports_userDate ON public.reports ("userDate");
CREATE INDEX idx_reports_submitted ON public.reports (submitted);

/* ── الأمان (RLS) ─────────────────────────────────────────────
    الأعمدة camelCase تحتاج اقتباسًا مزدوجًا في سياسات RLS أيضًا.

    المرحلة الحالية (v35): مركز صغير 2-5 معلمين، العميل يستخدم
    `anon` بلا Auth. شدّدنا GRANT لـ anon إلى SELECT/INSERT/UPDATE
    فقط (بلا DELETE) لمنع مسحٍ جماعي لو تسرب المفتاح. دوّر المفتاح
    من Dashboard → API → Reset anon key ثم ضعه في متغيّر بيئة
    البناء (انظر js/supabase-client.js). للإنتاج العام فعّل النسخة
    الآمنة في نهاية الملف مع Supabase Auth.                           */
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- السماح للـ anon بالقراءة/الإدراج/التحديث فقط (بلا حذف) — يمنع مسحًا جماعيًا
-- عميل المتصفح الحالي يستخدم anon بلا Auth، لذا نبقي الوصول لكن بلا DELETE.
CREATE POLICY "reports_allow_all" ON public.reports
  FOR ALL USING (true) WITH CHECK (true);

-- anon: بلا حذف — يحمي من مسحٍ جماعي لو تسرب المفتاح
GRANT SELECT, INSERT, UPDATE ON TABLE public.reports TO anon;
GRANT ALL ON TABLE public.reports TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- سياسات جدول users (نفس المبدأ: anon بلا حذف)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_allow_all" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated, service_role;

-- تأكيد النجاح
SELECT 'تم إعداد جدولي reports و users بنجاح' AS status;

/* ─────────────────────────────────────────────────────────────
   ◤ النسخة الآمنة (تُفعَّل لاحقًا بعد إضافة Supabase Auth) ◢
   ─────────────────────────────────────────────────────────────
   استبدل السياسات أعلاه بهذه عندما يُسجّل المستخدمون في Supabase
   Auth (access_token حقيقي بدل مفتاح anon):

   DROP POLICY IF EXISTS "reports_allow_all" ON public.reports;

   CREATE POLICY "reports_select_auth" ON public.reports
     FOR SELECT USING (auth.role() = 'authenticated');

   CREATE POLICY "reports_insert_own" ON public.reports
     FOR INSERT WITH CHECK (
       auth.role() = 'authenticated'
       AND "userId" = auth.uid()::text
     );

   CREATE POLICY "reports_update" ON public.reports
     FOR UPDATE USING (
       auth.role() = 'authenticated'
       AND ("userId" = auth.uid()::text OR is_teacher())
     );

   CREATE OR REPLACE FUNCTION public.is_teacher()
   RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT coalesce((auth.jwt() -> 'user_metadata' ->> 'role') = 'teacher', false);
   $$;

   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reports TO authenticated;
   ───────────────────────────────────────────────────────────── */
