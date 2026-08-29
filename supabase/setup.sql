/* ═══════════════════════════════════════════════════════════════
   بصائرنا — إعداد Supabase الجديد

   شغّل هذا الكود كاملاً في:  Supabase Dashboard ← SQL Editor ← New query ← Run

   يصلح لمشروع جديد فقط (سيعيد إنشاء الجدول إن وُجد).
   ═══════════════════════════════════════════════════════════════ */

-- محو أي نسخة قديمة من الجدول والسياسات
DROP TABLE IF EXISTS public.reports CASCADE;

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

   ⚠ توافق مهم: عميل `js/supabase-client.js` الحالي يرسل مفتاح
   `anon` العام (بلا تسجيل دخول). لذلك السياسات هنا هي «السماح
   للجميع» حتى يعمل المشروع فورًا كما كانت النسخة الأولى.

   ⚠ تحذير أمني: هذه السياسات تجعل **مفتاح anon** الموجود في
   كود المتصفح قادرًا على القراءة والكتابة في الجدول. من حصل على
   المفتاح المنشور في المستودع يستطيع الكتابة. هذا مقبول للمرحلة
   الحالية، ويُستبدل لاحقًا بنظام مصادقة Supabase Auth مع سياسات
   `authenticated` (انظر نهاية هذا الملف).                             */
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة والكتابة للجميع (متوافق مع عميل anon الحالي)
CREATE POLICY "reports_allow_all" ON public.reports
  FOR ALL USING (true) WITH CHECK (true);

-- الصلاحيات لكل الأدوار
GRANT ALL ON TABLE public.reports TO anon, authenticated, service_role;

-- تأكيد النجاح
SELECT 'تم إعداد جدول reports بنجاح' AS status;

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
