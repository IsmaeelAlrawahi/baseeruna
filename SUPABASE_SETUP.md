# 📘 دليل ربط Supabase بمشروع بصيرنا

## 📋 الفهرس
1. [إعداد قاعدة البيانات في Supabase](#1-إعداد-قاعدة-البيانات-في-supabase)
2. [إضافة بيانات Supabase للمشروع](#2-إضافة-بيانات-supabase-للمشروع)
3. [الوصول إلى لوحة التقارير](#3-الوصول-إلى-لوحة-التقارير)
4. [رفع المشروع على الإنترنت](#4-رفع-المشروع-على-الإنترنت)
5. [استكشاف الأخطاء](#5-استكشاف-الأخطاء)

---

## 1️⃣ إعداد قاعدة البيانات في Supabase

### أ) إنشاء حساب ومشروع
1. اذهب إلى: https://supabase.com
2. اضغط **"Start your project"**
3. سجّل دخول بحساب GitHub
4. اضغط **"New Project"**
5. املأ البيانات:
   - **Name**: baseeruna
   - **Database Password**: اختر كلمة سر قوية (احفظها!)
   - **Region**: اختر أقرب منطقة جغرافياً (مثل: Frankfurt, London)
6. اضغط **"Create new project"**
7. انتظر 2-3 دقائق حتى ينتهي الإعداد

### ب) نسخ بيانات الاتصال
1. من القائمة الجانبية، اضغط على **⚙️ Settings**
2. اضغط على **API**
3. ستجد:
   - **Project URL**: مثل `https://xxxxx.supabase.co`
   - **anon public**: مفتاح طويل يبدأ بـ `eyJhbGc...`
4. **انسخهما جانباً** - ستحتاجهما في الخطوة التالية

### ج) إنشاء جدول التقارير
1. من القائمة الجانبية، اضغط على **🔧 SQL Editor**
2. اضغط **"New query"**
3. **انسخ والصق** الكود التالي:

```sql
-- إنشاء جدول التقارير
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  date TEXT NOT NULL,
  userDate TEXT NOT NULL,
  
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
  teacherNote TEXT DEFAULT '',
  
  -- حالة التقرير
  submitted BOOLEAN DEFAULT false,
  submittedAt BIGINT,
  teacherSeen BOOLEAN DEFAULT false,
  
  -- الطوابع الزمنية
  updatedAt BIGINT NOT NULL,
  createdAt BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  
  UNIQUE(userId, date)
);

-- إنشاء الفهارس لتحسين الأداء
CREATE INDEX idx_reports_userId ON reports(userId);
CREATE INDEX idx_reports_date ON reports(date);
CREATE INDEX idx_reports_userDate ON reports(userDate);
CREATE INDEX idx_reports_submitted ON reports(submitted);

-- السماح بالقراءة والكتابة للجميع
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON reports
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON reports
  FOR UPDATE USING (true);
```

4. اضغط **▶️ Run** (أسفل الشاشة)
5. يجب أن ترى رسالة **"Success. No rows returned"** ✅

### د) التحقق من إنشاء الجدول
1. من القائمة الجانبية، اضغط **📊 Table Editor**
2. يجب أن ترى جدول **`reports`** في القائمة
3. اضغط عليه - يجب أن تكون الأعمدة موجودة وفارغة

---

## 2️⃣ إضافة بيانات Supabase للمشروع

### الخطوات:

1. **افتح ملف** `js/supabase-client.js`
2. **ابحث عن السطور** (8 و 9):

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

3. **استبدلها** ببياناتك من الخطوة 1(ب):

```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co'; // ضع URL مشروعك هنا
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // ضع المفتاح هنا
```

4. **احفظ الملف** (Ctrl+S)

### ✅ التحقق من نجاح الإعداد:

1. افتح المشروع في المتصفح
2. افتح **Developer Tools** (F12)
3. اذهب إلى **Console**
4. يجب أن ترى رسالة: `[Supabase] جاهز ✓`

---

## 3️⃣ الوصول إلى لوحة التقارير

### للطلاب:
- يدخل الطالب تقريره اليومي كالمعتاد من صفحة **"التقرير اليومي"**
- عند الضغط على **"إرسال التقرير"**، سيُحفظ التقرير:
  - **محلياً** في IndexedDB (يعمل بدون إنترنت)
  - **سحابياً** في Supabase (يصل للمشرف)
- إذا فشل الإرسال للخادم، سيظهر تنبيه وسيبقى محفوظاً محلياً

### للمشرفين:
1. سجّل دخول كمشرف (PIN: `1234` افتراضياً)
2. من القائمة الرئيسية، اذهب إلى:
   ```
   /t/reports
   ```
   أو أضف رابطاً في قائمة المعلم
3. ستظهر لك **جميع التقارير المرسلة** مرتبة حسب التاريخ
4. اضغط على أي تقرير لفتح تفاصيله

### إضافة رابط لوحة التقارير في قائمة المعلم:
افتح `js/views/teacher.js` وابحث عن القائمة وأضف:

```javascript
{ label: 'التقارير المرسلة', href: '/t/reports', icon: 'file' }
```

---

## 4️⃣ رفع المشروع على الإنترنت

### الخيار 1: Vercel (موصى به ⭐)

#### أ) عبر GitHub (الطريقة الأسهل):

1. **رفع المشروع على GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit with Supabase integration"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/baseeruna.git
   git push -u origin main
   ```

2. **ربط Vercel:**
   - اذهب إلى: https://vercel.com
   - سجّل دخول بحساب GitHub
   - اضغط **"Add New Project"**
   - اختر مستودع `baseeruna`
   - اضغط **"Deploy"**
   - انتظر 1-2 دقيقة ✅

3. **احصل على الرابط:**
   - ستحصل على رابط مثل: `https://baseeruna.vercel.app`
   - شارك هذا الرابط مع الطلاب والمشرفين

#### ب) عبر Vercel CLI:

```bash
# تثبيت Vercel CLI
npm install -g vercel

# الدخول لحسابك
vercel login

# رفع المشروع
vercel

# اتبع التعليمات:
# - Set up and deploy? Yes
# - Which scope? اختر حسابك
# - Link to existing project? No
# - What's your project's name? baseeruna
# - In which directory is your code? ./
# - Override settings? No

# بعد الانتهاء، سيعطيك الرابط
```

---

### الخيار 2: Netlify

#### أ) عبر Netlify Drop:

1. اذهب إلى: https://app.netlify.com/drop
2. **اسحب وأفلت** مجلد المشروع بالكامل
3. انتظر الرفع
4. احصل على الرابط مثل: `https://random-name.netlify.app`

#### ب) عبر GitHub:

1. ارفع المشروع على GitHub (كما في Vercel)
2. اذهب إلى: https://app.netlify.com
3. اضغط **"Add new site" → "Import an existing project"**
4. اختر **GitHub** واختر مستودع `baseeruna`
5. اترك الإعدادات كما هي
6. اضغط **"Deploy"**

---

### الخيار 3: GitHub Pages

1. **إنشاء ملف إعدادات:**
   في جذر المشروع، أنشئ ملف `.nojekyll` فارغ:
   ```bash
   touch .nojekyll
   ```

2. **رفع على GitHub:**
   ```bash
   git add .
   git commit -m "Add Supabase integration"
   git push
   ```

3. **تفعيل GitHub Pages:**
   - اذهب إلى مستودعك على GitHub
   - Settings → Pages
   - Source: اختر **main** branch
   - اضغط **Save**
   - انتظر 2-3 دقائق
   - الرابط: `https://YOUR_USERNAME.github.io/baseeruna`

---

## 5️⃣ استكشاف الأخطاء

### ❌ المشكلة: "Supabase غير مُعدّ"

**الحل:**
1. تأكد من ملء `SUPABASE_URL` و `SUPABASE_ANON_KEY` في `js/supabase-client.js`
2. تأكد أن القيم **لا تحتوي** على `YOUR_`
3. احفظ الملف وأعد تحميل الصفحة

---

### ❌ المشكلة: "Failed to fetch" أو خطأ CORS

**السبب:** Supabase لا يسمح بالوصول من النطاق الحالي

**الحل:**
1. اذهب إلى Supabase Dashboard
2. **Settings** → **API**
3. قسم **"URL Configuration"**
4. أضف نطاقك (مثل: `https://baseeruna.vercel.app`)
5. احفظ التغييرات

---

### ❌ المشكلة: التقارير لا تظهر في لوحة المشرف

**تحقق من:**
1. هل الطالب **أرسل** التقرير فعلاً؟ (يجب الضغط على زر "إرسال التقرير")
2. هل هناك إنترنت عند إرسال التقرير؟
3. افتح **Developer Tools** → **Network** وأعد إرسال التقرير
4. ابحث عن طلب إلى `/rest/v1/reports`
5. إذا كان أحمر (خطأ)، انقر عليه واقرأ رسالة الخطأ

**حل سريع:**
```javascript
// في Console، جرّب:
const testReport = {
  id: 'test-report-1',
  userId: 'test-user',
  date: '2026-08-28',
  userDate: 'test-user|2026-08-28',
  quran: {memorized: 1, reviewed: 2},
  poetry: {verses: 5},
  reading: {pages: 10, minutes: 30},
  qiyam: false,
  note: 'تقرير تجريبي',
  teacherNote: '',
  submitted: true,
  submittedAt: Date.now(),
  updatedAt: Date.now()
};

await SupabaseClient.saveReport(testReport);
// يجب أن ترى: "[Supabase] تم حفظ التقرير: test-report-1"
```

---

### ❌ المشكلة: "permission denied for table reports"

**السبب:** سياسات الأمان (RLS) غير مُعدّة بشكل صحيح

**الحل:**
1. اذهب إلى **SQL Editor** في Supabase
2. نفّذ هذا الكود:

```sql
-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Enable read access for all users" ON reports;
DROP POLICY IF EXISTS "Enable insert access for all users" ON reports;
DROP POLICY IF EXISTS "Enable update access for all users" ON reports;

-- إنشاء سياسات جديدة
CREATE POLICY "Allow all operations" ON reports
  FOR ALL USING (true) WITH CHECK (true);
```

---

## 📊 اختبار النظام

### 1. اختبار إرسال تقرير:
1. سجّل دخول كطالب
2. اذهب إلى "التقرير اليومي"
3. املأ البيانات
4. اضغط "إرسال التقرير"
5. افتح **Console** - يجب أن ترى: `[Reports] تم إرسال التقرير إلى الخادم ✓`

### 2. اختبار لوحة المشرف:
1. سجّل دخول كمشرف
2. اذهب إلى `/t/reports`
3. يجب أن يظهر التقرير المُرسَل

### 3. اختبار Supabase مباشرة:
1. اذهب إلى Supabase Dashboard
2. **Table Editor** → **reports**
3. يجب أن ترى صفوف البيانات المُرسَلة

---

## 🎯 خلاصة التغييرات

### الملفات المُضافة:
- ✅ `js/supabase-client.js` - عميل Supabase
- ✅ `js/views/reports-dashboard.js` - لوحة التقارير للمشرفين
- ✅ `css/reports-dashboard.css` - تنسيق لوحة التقارير

### الملفات المُعدّلة:
- ✅ `js/models.js` - إضافة إرسال Supabase في `Reports.save()` و `Reports.submit()`
- ✅ `index.html` - إضافة ملفات JS و CSS الجديدة

### الميزات الجديدة:
- ✅ حفظ التقارير في Supabase تلقائياً
- ✅ لوحة تحكم للمشرفين لعرض جميع التقارير
- ✅ يعمل محلياً (offline) وسحابياً (online)
- ✅ رسائل خطأ واضحة للمستخدم

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. افتح **Developer Tools** (F12) → **Console**
2. انسخ رسالة الخطأ
3. ابحث عنها في هذا الدليل
4. أو اسأل في المشروع

**حظاً موفقاً! 🚀**
