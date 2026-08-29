/* ============================================================
   بصائرنا — تعريف البرنامج

   كل ما يخصّ خطة الفصل: أيام المتابعة، والمسارات، والمقادير
   اليومية، والملتقيات، وأوزان التقييم.

   هذا هو الملف الذي تعدّله حين تتغيّر الخطة — لا حاجة لمسّ
   منطق البرنامج.
   ============================================================ */

window.PROGRAM = {

  /* ── أيام المتابعة ────────────────────────────────────
     أرقام الأيام كما في المتصفح: الأحد ٠ … السبت ٦.
     المتابعة من الأحد إلى الأربعاء.                        */
  days: [0, 1, 2, 3],

  /* قيام الليل من الأحد إلى الثلاثاء فقط. */
  qiyamDays: [0, 1, 2],

  /* أول أيام الأسبوع عندنا — تُبنى عليه أسابيع الشعار والنحو. */
  weekStartsOn: 0,

  /* ── المقادير اليومية ─────────────────────────────────
     هذه هي الحدود الدنيا. الطالب يستطيع الزيادة عليها،
     والمعلّم يستطيع رفعها لطالب بعينه من صفحته.            */
  targets: {
    quranMemorize: 0.5,   /* صفحة */
    quranReview:   2,     /* صفحة */
    poetryVerses:  2,     /* بيت */
    readingMinutes: 15    /* دقيقة */
  },

  /* ── المسارات ─────────────────────────────────────────
     ترتيبها هنا هو ترتيب ظهورها في التقرير اليومي.        */
  tracks: [
    {
      id: 'quran', name: 'القرآن الكريم', icon: 'book',
      color: 'var(--teal-300)',
      fields: [
        { id: 'memorized', name: 'الحفظ', unit: 'صفحة', target: 'quranMemorize', step: 0.25 },
        { id: 'reviewed',  name: 'المراجعة', unit: 'صفحة', target: 'quranReview', step: 0.5 }
      ]
    },
    {
      id: 'poetry', name: 'الشعر والأدب', icon: 'star',
      color: 'var(--gold-400)',
      fields: [
        { id: 'verses', name: 'الأبيات المحفوظة', unit: 'بيت', target: 'poetryVerses', step: 1 }
      ]
    },
    {
      id: 'reading', name: 'القراءة', icon: 'book',
      color: 'var(--teal-200)',
      fields: [
        { id: 'minutes', name: 'المدة', unit: 'دقيقة', target: 'readingMinutes', step: 5 },
        { id: 'pages',   name: 'الصفحات المقروءة', unit: 'صفحة', target: null, step: 1 }
      ]
    }
  ],

  /* ── مستويات الطلاب ───────────────────────────────────
     يختار الطالب مستواه عند التسجيل. صفحة «برنامجي» — وفيها
     سلسلة النحو والملتقيات — لطلبة المستوى الثالث وحدهم.      */
  levels: [
    { id: 1, name: 'المستوى الأول',  sub: 'إعدادي',  hasProgram: false },
    { id: 2, name: 'المستوى الثاني', sub: 'ثانوي',   hasProgram: false },
    { id: 3, name: 'المستوى الثالث', sub: 'جامعي',   hasProgram: true }
  ],
  defaultLevel: 1,

  /* ── سلسلة النحو ──────────────────────────────────────
     ٢٨ حلقة، حلقة كل أسبوع، لطلبة المستوى الثالث. */
  nahw: {
    name: 'سلسلة النحو',
    lessons: 28,
    perWeek: 1,
    note: 'لطلبة المستوى الثالث — الجامعي'
  },

  /* ── الملتقيات ────────────────────────────────────────
     أربعة ملتقيات في الفصل، ملتقى كل شهر.                 */
  meetups: [
    { no: 1, name: 'الملتقى الأول' },
    { no: 2, name: 'الملتقى الثاني' },
    { no: 3, name: 'الملتقى الثالث' },
    { no: 4, name: 'الملتقى الرابع' }
  ],

  /* ── مقترحات الحفظ للشعر والمتون ──────────────────────
     مقترحات لا إلزام فيها؛ للطالب أن يختار غيرها.
     `verses` عدد الأبيات التقريبي، يملأ الحقل تلقائيًا
     ويبقى قابلًا للتعديل.                                  */
  poemSuggestions: [
    { title: 'غاية المراد',        verses: null },
    { title: 'أنوار العقول',       verses: null },
    { title: 'تائية الألبيري',     verses: null },
    { title: 'ملحة الإعراب',       verses: 376 },
    { title: 'كشف الحقيقة',        verses: null },
    { title: 'ألفية ابن مالك',     verses: 1002 },
    { title: 'المعلقات',           verses: null }
  ],

  /* ── التقييم ──────────────────────────────────────────
     مجموع الأوزان ١٠٠. غيّر أي رقم وسيتغيّر ترتيب النتائج.
     قيام الليل داخل في التقييم وإن كان لا يظهر للطالب.     */
  scoring: {
    weights: {
      quranMemorize: 25,
      quranReview:   20,
      poetry:        15,
      reading:       15,
      nahw:          10,
      meetups:        5,
      qiyam:         10
    },
    /* أعلى نسبة يمكن أن يبلغها بند واحد، حتى لا تعوّض
       الزيادة في مسار تقصيرًا في غيره. */
    capPerItem: 1
  },

  /* ── ما يراه المعلّم وحده ─────────────────────────────
     يدخل في التقييم ولا يظهر في صفحة الطالب.              */
  privateTracks: ['qiyam'],

  /* ── الفصل الدراسي ────────────────────────────────────
     المعلّم يضبط التاريخين من الإعدادات؛ هذه القيم
     الافتراضية عند أول تشغيل.                              */
  term: {
    name: 'الفصل الأول',
    weeks: 16
  }
};

/* ── مساعدات الأيام ──────────────────────────────────── */
window.ProgramDays = {

  /* هل هذا اليوم من أيام المتابعة؟ */
  isProgramDay(dateKey) {
    return PROGRAM.days.indexOf(U.parseKey(dateKey).getDay()) !== -1;
  },

  isQiyamDay(dateKey) {
    return PROGRAM.qiyamDays.indexOf(U.parseKey(dateKey).getDay()) !== -1;
  },

  /* أقرب يوم متابعة قبل هذا اليوم أو هو نفسه. */
  lastProgramDay(dateKey) {
    let d = dateKey || U.todayKey();
    for (let i = 0; i < 14; i++) {
      if (this.isProgramDay(d)) return d;
      d = U.addDays(d, -1);
    }
    return dateKey;
  },

  nextProgramDay(dateKey) {
    let d = U.addDays(dateKey || U.todayKey(), 1);
    for (let i = 0; i < 14; i++) {
      if (this.isProgramDay(d)) return d;
      d = U.addDays(d, 1);
    }
    return null;
  },

  /* مفتاح الأسبوع: تاريخ الأحد الذي يبدأ به. */
  weekKey(dateKey) {
    const d = U.parseKey(dateKey || U.todayKey());
    const back = (d.getDay() - PROGRAM.weekStartsOn + 7) % 7;
    return U.addDays(U.dateKey(d), -back);
  },

  /* أيام المتابعة داخل أسبوع بعينه. */
  daysOfWeek(weekKey) {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = U.addDays(weekKey, i);
      if (this.isProgramDay(d)) out.push(d);
    }
    return out;
  },

  /* كل أيام المتابعة بين تاريخين. */
  daysBetween(fromKey, toKey) {
    const out = [];
    let d = fromKey;
    let guard = 0;
    while (d <= toKey && guard++ < 800) {
      if (this.isProgramDay(d)) out.push(d);
      d = U.addDays(d, 1);
    }
    return out;
  },

  /* رقم الأسبوع منذ بداية الفصل، ابتداءً من ١. */
  weekNumber(termStart, dateKey) {
    const a = this.weekKey(termStart);
    const b = this.weekKey(dateKey || U.todayKey());
    return Math.max(1, Math.round(U.diffDays(a, b) / 7) + 1);
  },

  dayName(dateKey) {
    return T('weekdayNames')[U.parseKey(dateKey).getDay()];
  },

  /* ── المستويات ────────────────────────────────────── */
  level(user) {
    const id = (user && user.level) || PROGRAM.defaultLevel;
    return PROGRAM.levels.find(l => l.id === id) || PROGRAM.levels[0];
  },
  levelName(user) {
    const l = this.level(user);
    return `${l.name} (${l.sub})`;
  },
  /* هل لهذا الطالب صفحة «برنامجي»؟ */
  hasProgram(user) {
    return !!this.level(user).hasProgram;
  }
};
