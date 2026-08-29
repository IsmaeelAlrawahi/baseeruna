/* ============================================================
   بصائرنا — Configuration
   This is the file to edit when you want to change how the
   program behaves. Nothing here requires touching app logic.
   ============================================================ */

window.CONFIG = {

  app: {
    name: 'بصائرنا',
    fullName: 'برنامج بصائرنا',
    tagline: 'برنامج متابعة حفظ القرآن الكريم',
    version: '3.4.0',
    /* Bump this to force every device to refresh its cached files. */
    cacheVersion: 'basairuna-v40'
  },

  /* ── The 8 leaves on every day of the tree ──────────────────
     Add, remove or rename freely. `kind: 'fard'` leaves are the
     ones a salah streak is measured against; `kind: 'extra'` are
     voluntary and colour the leaf gold instead of green.
     Keep `id` stable once students have data — it is the storage key.
     ─────────────────────────────────────────────────────────── */
  prayerSlots: [
    { id: 'fajr',    name: 'الفجر',   short: 'ف', kind: 'fard'  },
    { id: 'dhuhr',   name: 'الظهر',   short: 'ظ', kind: 'fard'  },
    { id: 'asr',     name: 'العصر',   short: 'ع', kind: 'fard'  },
    { id: 'maghrib', name: 'المغرب',  short: 'م', kind: 'fard'  },
    { id: 'isha',    name: 'العشاء',  short: 'ش', kind: 'fard'  },
    { id: 'sunan',   name: 'السنن الرواتب', short: 'س', kind: 'extra' },
    { id: 'witr',    name: 'الوتر',   short: 'و', kind: 'extra' },
    { id: 'duha',    name: 'الضحى',   short: 'ض', kind: 'extra' }
  ],

  /* Extra credit: praying fard in congregation. Shown as a ring
     around the leaf. Set to false to hide the option entirely. */
  trackCongregation: true,

  /* ── The tree's shape ───────────────────────────────────────
     12 main branches (months) × 4 sub-branches (weeks)
     × 7 twigs (days) × 8 leaves (prayers).
     Days 29–31 of a month hang as a short extra twig on week 4,
     so no real calendar day is ever lost.
     ─────────────────────────────────────────────────────────── */
  tree: {
    months: 12,
    weeksPerMonth: 4,
    daysPerWeek: 7,
    get leavesPerDay() { return window.CONFIG.prayerSlots.length; },
    /* Calendar system the year runs on: 'gregorian' or 'hijri' */
    calendar: 'gregorian',

    /* The tree starts here and only goes forward. Nothing before
       this year existed as far as the programme is concerned. */
    firstYear: 2026,

    /* لا يُلوَّن الفائت بالأحمر: الورقة التي لم تُسجَّل تبقى فارغة
       تنتظر صاحبها، فله أن يضغط على غصن أي يوم مضى فيسجّله.
       اجعلها true إن أردت تمييز الفائت بالأحمر.                  */
    markMissedFard: false,
    markMissedExtra: false
  },

  /* ── Memorization ───────────────────────────────────────── */
  memorization: {
    /* Entry types a student can log */
    types: [
      { id: 'new',      name: 'حفظ جديد',   color: 'var(--teal-300)' },
      { id: 'review',   name: 'مراجعة',      color: 'var(--gold-400)' },
      { id: 'tilawah',  name: 'تلاوة',       color: 'var(--teal-200)' }
    ],
    /* Teacher's assessment scale — order matters, first is worst */
    grades: [
      { id: 'again',     name: 'يحتاج إعادة', stars: 1, color: 'var(--danger)' },
      { id: 'fair',      name: 'مقبول',       stars: 2, color: 'var(--warn)' },
      { id: 'good',      name: 'جيد',         stars: 3, color: 'var(--teal-300)' },
      { id: 'verygood',  name: 'جيد جدًا',    stars: 4, color: 'var(--teal-200)' },
      { id: 'excellent', name: 'ممتاز',       stars: 5, color: 'var(--gold-400)' }
    ],
    /* Review statuses for a teacher's inbox */
    statuses: [
      { id: 'pending',  name: 'بانتظار المراجعة', color: 'var(--warn)' },
      { id: 'approved', name: 'معتمد',            color: 'var(--ok)' },
      { id: 'redo',     name: 'يحتاج إعادة',      color: 'var(--danger)' }
    ]
  },

  /* ── Goals ──────────────────────────────────────────────
     A goal either names a specific portion of the mushaf
     (a juz, a surah, a run of pages) or asks for a quantity.  */
  goalModes: [
    { id: 'juz',    name: 'جزء محدّد',    hint: 'اختر رقم الجزء، مثل الجزء ٣٠' },
    { id: 'surah',  name: 'سورة محدّدة',  hint: 'اختر اسم السورة' },
    { id: 'pages',  name: 'صفحات محدّدة', hint: 'من صفحة إلى صفحة في المصحف' },
    { id: 'amount', name: 'مقدار',        hint: 'كمية دون تحديد موضعها' }
  ],

  goalUnits: [
    { id: 'pages', name: 'صفحة',  perDayDefault: 1 },
    { id: 'ayahs', name: 'آية',   perDayDefault: 5 },
    { id: 'juz',   name: 'جزء',   perDayDefault: 0.05 },
    { id: 'surah', name: 'سورة',  perDayDefault: 0.2 }
  ],

  /* The daily target is the goal divided over its days. Set to
     'adaptive' to re-spread whatever is left over the days that
     remain, so falling behind raises tomorrow's share.
     'fixed' keeps the original pace no matter what.            */
  dailyGoalMode: 'adaptive',

  /* ── Streaks ────────────────────────────────────────────── */
  streaks: {
    /* A day counts for the salah streak when at least this many
       fard prayers are ticked. 5 = all of them. */
    salahMinFard: 5,
    /* A day counts for the memorization streak when the student
       logs at least this many entries. */
    memoMinEntries: 1,
    /* Days of grace a student may miss without losing the streak
       (per calendar month). 0 disables freezes. */
    freezesPerMonth: 2,
    /* Milestones that trigger a celebration + badge */
    milestones: [3, 7, 14, 21, 30, 40, 60, 90, 120, 180, 365]
  },

  /* ── Listening ──────────────────────────────────────────
     No reciter ships with the program. The teacher adds the ones
     the halaqah should listen to, from صفحة القرّاء.            */
  audio: {
    /* Offered as suggestions inside the teacher's add form only —
       nothing here appears to a student until the teacher adds it.
       Remove or extend the list freely. */
    knownSources: [
      { code: 'ar.alafasy',            name: 'مشاري راشد العفاسي' },
      { code: 'ar.abdulbasitmurattal', name: 'عبد الباسط عبد الصمد (مرتل)' },
      { code: 'ar.abdulbasitmujawwad', name: 'عبد الباسط عبد الصمد (مجوّد)' },
      { code: 'ar.husary',             name: 'محمود خليل الحصري' },
      { code: 'ar.husarymujawwad',     name: 'محمود خليل الحصري (مجوّد)' },
      { code: 'ar.minshawi',           name: 'محمد صديق المنشاوي' },
      { code: 'ar.minshawimujawwad',   name: 'محمد صديق المنشاوي (مجوّد)' },
      { code: 'ar.mahermuaiqly',       name: 'ماهر المعيقلي' },
      { code: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس' },
      { code: 'ar.saoodshuraym',       name: 'سعود الشريم' },
      { code: 'ar.ahmedajamy',         name: 'أحمد بن علي العجمي' },
      { code: 'ar.hanirifai',          name: 'هاني الرفاعي' },
      { code: 'ar.abdullahbasfar',     name: 'عبد الله بصفر' },
      { code: 'ar.muhammadayyoub',     name: 'محمد أيوب' },
      { code: 'ar.muhammadjibreel',    name: 'محمد جبريل' }
    ],

    /* Where a library reciter's audio comes from. */
    libraryUrl: function (code, surahNo) {
      return 'https://cdn.islamic.network/quran/audio-surah/128/' +
             code + '/' + surahNo + '.mp3';
    },

    /* A teacher may instead paste their own link, using these
       placeholders: {surah} = 1..114, {surah3} = 001..114 */
    customPlaceholders: ['{surah}', '{surah3}'],

    playbackRates: [0.75, 1, 1.25, 1.5],
    /* Seconds skipped by the back/forward buttons */
    seekStep: 10
  },

  /* ── Voice notes ────────────────────────────────────────── */
  voice: {
    maxSeconds: 600,          /* 10 minutes */
    /* Browsers pick the first type they support */
    preferredTypes: ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
  },

  /* ── Motivation shown on the student's home screen ───────
     The teacher can add their own from the teacher area; these
     are the built-in fallbacks.                               */
  defaultMotivation: [
    { text: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ', source: 'رواه البخاري' },
    { text: 'وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ', source: 'القمر ١٧' },
    { text: 'اقْرَأُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ', source: 'رواه مسلم' },
    { text: 'الْمَاهِرُ بِالْقُرْآنِ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ', source: 'متفق عليه' },
    { text: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا', source: 'النساء ١٠٣' },
    { text: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', source: 'طه ١١٤' },
    { text: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ', source: 'رواه مسلم' },
    { text: 'وَأَنْ لَيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ', source: 'النجم ٣٩' }
  ],

  /* ── Sync ───────────────────────────────────────────────
     Everything lives on the device by default. Point `endpoint`
     at a server that speaks the contract in docs/SYNC.md and the
     teacher will see students update live. Leave null to stay
     fully offline and move data with the export/import buttons. */
  sync: {
    endpoint: null,
    autoSyncSeconds: 60
  },

  /* ── تسجيل الدخول ───────────────────────────────────────
     أسماء الطلاب لا تظهر في صفحة الدخول: يدخل كلٌّ برمزه هو.
     اجعل showStudentList صحيحًا إن كان الجهاز مشتركًا في الحلقة
     وأردتَ اختيار الاسم من قائمة.                              */
  auth: {
    showStudentList: false,

    /* يسجّل الطالب نفسه ببريده حين يدخل بجوجل أول مرة، ويختار
       مستواه. اجعلها false ليقتصر الأمر على من يضيفه المعلّم. */
    allowSelfSignup: true,

    /* الدخول بحساب Google:
       ١) أنشئ مشروعًا في console.cloud.google.com
       ٢) أنشئ OAuth Client ID من نوع Web application
       ٣) أضف عنوان الموقع في Authorized JavaScript origins
       ٤) ضع المعرّف هنا

       ملاحظة: بلا خادم يتحقّق من الرمز، يُعرَف صاحبُ الحساب ولا
       يُبرهَن عليه. فهو تسهيلٌ للدخول لا حارسٌ على البيانات،
       والبيانات كلها على الجهاز أصلًا.                          */
    googleClientId: null,
    googleScript: 'https://accounts.google.com/gsi/client'
  },

  /* ── Teacher's default PIN on a fresh install ───────────── */
  firstRun: {
    teacherName: 'المعلّم',
    teacherPin: '1234'
  }
};
