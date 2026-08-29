/* ============================================================
   بصائرنا — All user-facing text lives here.
   Edit any wording without hunting through the app, or add a
   second language object and switch T.lang.
   ============================================================ */

window.STRINGS = {
  ar: {
    /* generic */
    save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق', delete: 'حذف', edit: 'تعديل',
    add: 'إضافة', done: 'تم', back: 'رجوع', next: 'التالي', search: 'بحث',
    confirm: 'تأكيد', yes: 'نعم', no: 'لا', all: 'الكل', none: 'لا شيء',
    today: 'اليوم', yesterday: 'أمس', loading: 'جارٍ التحميل…', empty: 'لا يوجد شيء بعد',
    optional: 'اختياري', required: 'مطلوب', more: 'المزيد', settings: 'الإعدادات',

    /* auth */
    welcome: 'أهلًا بك في بصائرنا',
    chooseRole: 'من أنت؟',
    teacher: 'معلّم', student: 'طالب',
    enterPin: 'أدخل الرمز السري',
    wrongPin: 'الرمز السري غير صحيح',
    chooseProfile: 'اختر حسابك',
    noStudentsYet: 'لم يُضف أي طالب بعد. ادخل بحساب المعلّم وأضف طلابك.',
    logout: 'تسجيل الخروج',
    switchUser: 'تبديل الحساب',

    /* tabs */
    tabHome: 'الرئيسية', tabMemorize: 'الحفظ', tabListen: 'الاستماع',
    tabTree: 'شجرة الصلاة', tabStudents: 'الطلاب', tabReports: 'التقارير',

    /* home */
    greetingMorning: 'صباح الخير', greetingEvening: 'مساء الخير',
    yourGoal: 'هدفك', noGoal: 'لم يُحدَّد هدف بعد',
    goalProgress: 'أنجزتَ %1 من %2 %3',
    daysLeft: 'باقٍ %1 يوم', goalDone: 'اكتمل الهدف، بارك الله فيك',
    wordFromTeacher: 'كلمة من معلّمك',
    memoStreak: 'سلسلة الحفظ', salahStreak: 'سلسلة الصلاة',
    day: 'يوم', days: 'يوم', bestStreak: 'أطول سلسلة: %1',
    streakSafeToday: 'سلسلتك محفوظة اليوم', streakAtRisk: 'أكمل مهامك اليوم لئلا تنقطع سلسلتك',
    quickLog: 'تسجيل سريع', todaySalah: 'صلوات اليوم', todayMemo: 'حفظ اليوم',

    /* memorization */
    addEntry: 'تسجيل حفظ',
    entryType: 'النوع', surah: 'السورة', fromAyah: 'من آية', toAyah: 'إلى آية',
    ayahCount: 'عدد الآيات', pagesApprox: 'ما يقارب %1 صفحة',
    notes: 'ملاحظات', voiceNote: 'تسجيل صوتي',
    record: 'ابدأ التسجيل', stopRecord: 'إيقاف', reRecord: 'إعادة التسجيل',
    playRecording: 'استماع', recordingReady: 'التسجيل جاهز',
    micDenied: 'لم يُسمح باستخدام الميكروفون. فعّل الإذن من إعدادات المتصفح.',
    micUnsupported: 'المتصفح لا يدعم التسجيل الصوتي.',
    saveEntry: 'حفظ التسجيل',
    entrySaved: 'حُفظ حفظ اليوم، وفقك الله',
    myEntries: 'سجلّ الحفظ', filterAll: 'الكل',
    awaitingReview: 'بانتظار مراجعة المعلّم',
    teacherComment: 'ملاحظة المعلّم', grade: 'التقدير',
    totalMemorized: 'مجموع المحفوظ', pages: 'صفحة', ayahs: 'آية', juz: 'جزء',

    /* listening */
    listen: 'الاستماع', reciter: 'القارئ', onlineRecitations: 'تلاوات من الإنترنت',
    myUploads: 'تسجيلاتي', uploadAudio: 'رفع ملف صوتي',
    uploadHint: 'اختر ملفات صوتية من جهازك لتستمع إليها داخل البرنامج',
    playing: 'يُشغَّل الآن', nowPlaying: 'يُستمع الآن',
    play: 'تشغيل', pause: 'إيقاف مؤقت', speed: 'السرعة',
    repeatOff: 'بدون تكرار', repeatOne: 'تكرار السورة', repeatAll: 'تكرار الكل',
    sleepTimer: 'مؤقّت الإيقاف', offlineSaved: 'محفوظ للاستماع بدون إنترنت',
    downloadForOffline: 'حفظ للاستماع بدون إنترنت',
    backgroundHint: 'يستمر التشغيل والشاشة مغلقة بعد تثبيت البرنامج على الجهاز.',
    noConnection: 'تعذّر التشغيل. تحقّق من الاتصال بالإنترنت.',

    /* salah tree */
    salahTree: 'شجرة الصلاة', yearView: 'السنة', monthView: 'الشهر',
    tapDayHint: 'اضغط على أي يوم لتسجيل صلواته',
    tapAnyDay: 'اضغط على غصن أي يوم — ولو مضى — لتسجيل صلواته',
    prayedFard: 'الفروض', prayedExtra: 'النوافل', inCongregation: 'جماعة',
    dayComplete: 'يوم كامل', treeProgress: 'اخضرّت %1 ورقة من %2',
    monthNames: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
    hijriMonths: ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'],
    weekdayNames: ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],
    week: 'الأسبوع', markAll: 'تحديد الكل', clearDay: 'مسح اليوم',

    /* teacher */
    students: 'الطلاب', addStudent: 'إضافة طالب', studentName: 'اسم الطالب',
    studentPin: 'رمز الطالب', editStudent: 'تعديل بيانات الطالب',
    removeStudent: 'حذف الطالب',
    removeStudentWarn: 'سيُحذف الطالب وجميع سجلاته نهائيًا. هل أنت متأكد؟',
    inbox: 'الوارد', reviewQueue: 'بانتظار المراجعة (%1)',
    noPending: 'لا توجد تسجيلات بانتظار المراجعة',
    approve: 'اعتماد', requestRedo: 'طلب إعادة',
    writeComment: 'اكتب ملاحظتك للطالب…',
    sendMotivation: 'إرسال كلمة تحفيزية', motivationText: 'نص الكلمة',
    motivationTo: 'إلى', allStudents: 'جميع الطلاب',
    motivationSent: 'أُرسلت الكلمة التحفيزية',
    setGoal: 'تحديد هدف', goalAmount: 'المقدار', goalUnit: 'الوحدة',
    goalDeadline: 'تاريخ الانتهاء', goalTitle: 'عنوان الهدف',

    /* goals — choosing what exactly to memorize */
    goalKind: 'نوع الهدف',
    pickJuz: 'اختر الجزء', pickSurah: 'اختر السورة',
    fromPage: 'من صفحة', toPage: 'إلى صفحة',
    juzNo: 'الجزء %1', pageNo: 'صفحة %1',
    goalScope: 'المطلوب حفظه',
    goalScopeInfo: '%1 — نحو %2 صفحة',
    goalCounts: 'يُحتسب كل ما حفظته من هذا الموضع، ولو كان قبل تحديد الهدف.',
    goalAmountInfo: 'يُحتسب ما تحفظه ابتداءً من اليوم.',
    pagesApproxNote: 'حساب الصفحات تقريبي',

    /* the daily share */
    dailyGoal: 'هدف اليوم',
    dailyGoalOf: '%1 %2 اليوم',
    dailyDone: 'أتممتَ هدف اليوم، أحسنت',
    dailyRemaining: 'بقي عليك %1 %2 اليوم',
    dailyPace: 'الخطة: %1 %2 كل يوم',
    dailyNoDeadline: 'حدّد تاريخ انتهاء ليُقسَّم الهدف على الأيام',
    behindBy: 'أنت متأخّر بمقدار %1 %2',
    onTrack: 'أنت على المسار',
    overdue: 'انتهى موعد الهدف',
    daysOfPlan: 'اليوم %1 من %2',

    /* reciters, managed by the teacher */
    recitersPage: 'القرّاء',
    addReciter: 'إضافة قارئ',
    editReciter: 'تعديل القارئ',
    reciterName: 'اسم القارئ',
    reciterSource: 'مصدر التلاوة',
    fromLibrary: 'من مكتبة التلاوات',
    customLink: 'رابط مخصّص',
    reciterCode: 'رمز القارئ',
    reciterCodeHint: 'اختر من القائمة أو اكتب الرمز بنفسك',
    urlTemplate: 'قالب الرابط',
    urlTemplateHint: 'ضع {surah} مكان رقم السورة، أو {surah3} لرقم من ثلاث خانات',
    testReciter: 'تجربة الرابط',
    reciterWorks: 'الرابط يعمل',
    reciterFails: 'تعذّر الوصول إلى الرابط',
    noReciters: 'لم يُضف أي قارئ بعد',
    noRecitersStudent: 'لم يُضف معلّمك أي قارئ بعد. تستطيع رفع ملفاتك الصوتية من «تسجيلاتي».',
    manageReciters: 'إدارة القرّاء',
    removeReciter: 'حذف القارئ',

    /* adhkar */
    tabAdhkar: 'الأذكار',
    adhkarPage: 'الأدعية والأذكار',
    adhkarToday: 'أذكار اليوم',
    adhkarDone: '%1 من %2',
    adhkarComplete: 'أتممتَ هذا القسم، تقبّل الله',
    adhkarReset: 'إعادة العدّ',
    adhkarResetAsk: 'سيُعاد عدّ أذكار هذا القسم لليوم.',
    tapToCount: 'اضغط على الذكر للعدّ',
    remainingCount: 'بقي %1',
    addDhikr: 'إضافة ذكر',
    editDhikr: 'تعديل الذكر',
    dhikrTitle: 'العنوان',
    dhikrText: 'النص',
    dhikrCount: 'عدد المرات',
    dhikrSource: 'المصدر',
    dhikrVirtue: 'الفضل',
    dhikrCategory: 'القسم',
    dhikrAdded: 'أُضيف الذكر',
    manageAdhkar: 'إضافة أذكار',
    builtInDhikr: 'لا يمكن تعديل الأذكار الأصلية، لكن تستطيع إضافة غيرها',

    /* missed prayers */
    missedPrayer: 'فُوّتت',
    missedLeaves: 'صلوات فائتة',
    missedNote: 'الورقة الحمراء صلاة فرض مضى يومها دون تسجيل. اليوم الحالي لا يُحسب حتى ينتهي.',
    lastActive: 'آخر نشاط', never: 'لم يدخل بعد',
    overview: 'نظرة عامة', activity: 'النشاط', attendance: 'الالتزام',
    salahRate: 'نسبة المحافظة على الصلاة', memoRate: 'انتظام الحفظ',
    weakestPrayer: 'أكثر صلاة تُفوَّت', topStudent: 'الأكثر التزامًا',
    classSummary: 'ملخّص الحلقة',

    /* settings */
    appearance: 'المظهر', theme: 'السمة', dark: 'داكن', light: 'فاتح',
    dataAndBackup: 'البيانات والنسخ الاحتياطي',
    exportData: 'تصدير نسخة احتياطية', importData: 'استيراد نسخة',
    exportHint: 'يحفظ ملفًا يحوي كل السجلات والتسجيلات الصوتية.',
    importWarn: 'سيُدمج الملف مع بياناتك الحالية. تابع؟',
    imported: 'تم الاستيراد بنجاح', exported: 'تم حفظ النسخة الاحتياطية',
    shareWithTeacher: 'إرسال سجلاتي للمعلّم',
    installApp: 'تثبيت البرنامج على الجهاز',
    installHint: 'التثبيت يمكّن الاستماع والشاشة مغلقة والعمل بدون إنترنت.',
    storageWarn: 'التخزين غير متاح في هذه الحالة — افتح البرنامج عبر رابط https ليُحفظ عملك.',
    about: 'عن البرنامج', changePin: 'تغيير الرمز السري',
    newPin: 'الرمز الجديد', pinLength: 'الرمز من ٤ أرقام',
    prayerSlotsSettings: 'صلوات اليوم في الشجرة',
    reciters: 'القرّاء',

    /* deleting and fixing mistakes */
    undo: 'تراجع',
    deleteEntry: 'حذف هذا التسجيل',
    deleteEntryAsk: 'سيُحذف تسجيل %1 (%2) وما معه من تسجيل صوتي. هل تريد الحذف؟',
    deleteReviewedWarn: 'انتبه: راجع معلّمك هذا التسجيل من قبل.',
    entryDeleted: 'حُذف التسجيل',
    entryRestored: 'أُعيد التسجيل',
    deleteGoal: 'حذف الهدف',
    deleteGoalAsk: 'سيُحذف هدف «%1». سجلّ حفظك يبقى كما هو.',
    goalDeleted: 'حُذف الهدف',
    clearTodaySalah: 'مسح صلوات اليوم',
    clearDayAsk: 'سيُمسح ما سُجّل من صلوات %1.',
    dayCleared: 'مُسحت صلوات اليوم',
    dayRestored: 'أُعيدت صلوات اليوم',
    voiceDeleted: 'حُذف التسجيل الصوتي',
    fixMistake: 'أخطأتَ في إدخال تسجيل؟ استخدم زرّ التعديل أو زرّ الحذف بجانبه. وبعد الحذف يظهر لك خيار التراجع.',

    /* ── البرنامج اليومي ───────────────────────────── */
    tabReport: 'التقرير', tabProgram: 'برنامجي', tabResults: 'النتائج', tabMore: 'المزيد',
    dailyReport: 'التقرير اليومي',
    reportFor: 'تقرير %1',
    notProgramDay: 'اليوم ليس من أيام المتابعة',
    programDaysAre: 'المتابعة من الأحد إلى الأربعاء',
    nextProgramDay: 'أول أيام المتابعة القادمة: %1',
    openLastDay: 'فتح تقرير %1',
    submitReport: 'إرسال التقرير',
    updateReport: 'تحديث التقرير',
    reportSubmitted: 'أُرسل تقريرك، بارك الله فيك',
    reportSaved: 'حُفظ التقرير',
    alreadySubmitted: 'أُرسل التقرير',
    editSubmitted: 'تعديل بعد الإرسال',
    target: 'المطلوب', achieved: 'المنجز', ofTarget: '%1 من %2 %3',
    aboveTarget: 'زدتَ على المطلوب',
    belowTarget: 'أقلّ من المطلوب',
    todayTasks: 'مهامّ اليوم',
    tasksDone: 'أنجزتَ %1 من %2',
    reportNote: 'ملاحظاتك',
    reportNotePh: 'اكتب ما تحبّ أن يعرفه معلّمك…',

    /* الشعار الأسبوعي */
    motto: 'شعاري هذا الأسبوع',
    mottoPh: 'اكتب عبارة تشجّعك هذا الأسبوع…',
    setMotto: 'اكتب شعارك',
    editMotto: 'تعديل الشعار',
    mottoSaved: 'حُفظ شعارك',
    noMotto: 'لم تكتب شعار هذا الأسبوع بعد',
    weekOf: 'أسبوع %1',

    /* الملف الشخصي */
    profile: 'ملفي الشخصي',
    profilePhoto: 'الصورة الشخصية',
    changePhoto: 'تغيير الصورة',
    removePhoto: 'حذف الصورة',
    photoSaved: 'حُفظت الصورة',
    photoHint: 'تُصغَّر الصورة تلقائيًا قبل حفظها',
    myName: 'اسمي',

    /* الشعر */
    poetry: 'الشعر والأدب',
    myPoem: 'القصيدة الحالية', poemTitle: 'اسم القصيدة',
    poemVerses: 'عدد أبيات القصيدة', poemFile: 'ملف القصيدة',
    uploadPoem: 'رفع ملف القصيدة', openFile: 'فتح الملف',
    addPoem: 'إضافة قصيدة', changePoem: 'تغيير القصيدة',
    versesToday: 'أبيات اليوم', versesMemorized: 'المحفوظ',
    versesRemaining: 'المتبقّي %1 بيت', poemComplete: 'أتممتَ القصيدة',
    noPoem: 'لم تختر قصيدة بعد',
    suggestions: 'مقترحات (غير إلزامية)',
    suggestionsHint: 'لك أن تختار منها أو تكتب غيرها',

    /* القراءة */
    reading: 'القراءة', myBook: 'الكتاب الحالي',
    bookTitle: 'اسم الكتاب', bookAuthor: 'المؤلف', bookPages: 'عدد صفحات الكتاب',
    addBook: 'إضافة كتاب', changeBook: 'تغيير الكتاب',
    pagesToday: 'صفحات اليوم', minutesToday: 'دقائق القراءة',
    pagesRemaining: 'المتبقّي %1 صفحة', bookComplete: 'أتممتَ الكتاب',
    noBook: 'لم تختر كتابًا بعد',

    /* النحو */
    nahw: 'سلسلة النحو', nahwLesson: 'الحلقة %1',
    nahwWeek: 'حلقة هذا الأسبوع', nahwDone: 'حضرتُ الحلقة',
    nahwSummary: 'ملخّص الحلقة', uploadSummary: 'رفع الملخّص',
    nahwProgress: '%1 من %2 حلقة',
    nahwLevelNote: 'لطلبة المستوى الثاني — متقدّم',
    summaryUploaded: 'رُفع الملخّص',

    /* الملتقيات */
    meetups: 'الملتقيات', meetupAttended: 'حضرت',
    meetupsProgress: 'حضرتَ %1 من %2',
    meetupsNote: 'أربعة ملتقيات في الفصل، ملتقى كل شهر',

    /* قيام الليل — للمعلّم وحده */
    qiyam: 'قيام الليل',
    qiyamPrivate: 'بينك وبين معلّمك — لا يراها بقية الطلاب',
    qiyamTeacherNote: 'قيام الليل لا يراه إلا الطالب نفسه وأنت',
    qiyamMarked: 'سُجّل قيام الليل، تقبّل الله',
    qiyamCleared: 'أُلغي تسجيل قيام الليل',
    didIPray: 'قمتُ الليلة',
    notToday: 'ليس اليوم',
    qiyamDaysOnly: 'قيام الليل من الأحد إلى الثلاثاء، وليس من بنود اليوم.',
    meetupDates: 'أوقات الملتقيات',
    meetupDate: 'موعد %1',
    meetupDatesHint: 'موعدٌ لكل ملتقى، يراه طلابك في صفحة برنامجي',
    meetupNoDate: 'لم يُحدَّد موعده',
    meetupUpcoming: 'قادم',
    meetupPassed: 'مضى',
    privateTrack: 'خاص',
    completed: 'أتمّ', notCompleted: 'لم يتمّ',
    doneOfTracks: 'أتمّ %1 من %2 مسارات',
    reportsIn: 'التقارير الواصلة',
    qiyamDays: 'من الأحد إلى الثلاثاء',
    notQiyamDay: 'اليوم ليس من أيام القيام',

    /* النتائج */
    results: 'النتائج', myResult: 'نتيجتي',
    classResults: 'نتائج الحلقة', rank: 'الترتيب',
    outOf: 'من %1',
    resultsNoDetails: 'تظهر النتيجة مجملة دون تفاصيل',
    resultDetails: 'تفصيل النتيجة',
    term: 'الفصل', termStart: 'بداية الفصل', termEnd: 'نهاية الفصل',
    weekNo: 'الأسبوع %1',

    /* teacher */
    reportsInbox: 'تقارير اليوم',
    noReportsToday: 'لم يصل تقرير اليوم بعد',
    reportsOn: 'تقارير %1',
    markQiyam: 'تسجيل قيام الليل',
    studentTargets: 'مقادير الطالب',
    targetsHint: 'ارفع المقدار المطلوب من هذا الطالب إن أردت',
    motivationWhen: 'متى تظهر',
    whenHome: 'في الصفحة الرئيسية',
    whenReport: 'بعد إرسال التقرير',

    /* ── الدخول ────────────────────────────────────── */
    signIn: 'سجّل دخولك',
    loginCode: 'رمز الدخول',
    codePlaceholder: 'مثال: K7M2Q',
    loginCodeHint: 'رمزك الخاص، يعطيك إياه معلّمك',
    loginCodeTeacherHint: 'أعطِ الطالب هذا الرمز ليدخل به',
    codeNotFound: 'لا يوجد حساب بهذا الرمز',
    continue: 'متابعة',
    teacherEntry: 'دخول المعلّم',
    newTeacher: 'معلّم جديد',
    newTeacherHint: 'افتح حلقتك: طلابك ومكتبتك وقرّاؤك لك وحدك، لا يراهم معلّمٌ آخر.',
    halaqahReady: 'فُتحت حلقتك',
    halaqahCodeIs: 'رمز حلقتك:',
    halaqahCodeHint: 'أعطِه طلابك لينضمّوا إليك، وتجده دائمًا في المزيد ← ملفي.',
    halaqahCode: 'رمز الحلقة',
    halaqahCodeAsk: 'الرمز الذي أعطاك إياه معلّمك',
    halaqahNotFound: 'لا توجد حلقة بهذا الرمز',
    myHalaqah: 'حلقتي', myHalaqahCode: 'رمز حلقتي',
    shareHalaqahCode: 'إرسال رمز الحلقة',
    or: 'أو',
    shareCode: 'إرسال الرمز', renewCode: 'رمز جديد',
    codeRenewed: 'أُنشئ رمز جديد', copied: 'نُسخ',
    studentCreated: 'أُضيف الطالب — رمز دخوله: %1',
    googleEmail: 'بريد Google',
    googleEmailHint: 'اربط حساب الطالب ليدخل بضغطة',
    googleUnavailable: 'تعذّر تحميل دخول Google',
    googleFailed: 'تعذّر قراءة بيانات الحساب',
    googleNotLinked: 'الحساب غير مربوط',
    googleNotLinkedBody: 'لم يُربط الحساب %1 بأي طالب.',
    googleAskTeacher: 'اطلب من معلّمك ربط بريدك بحسابك.',

    /* ── حال الطلبة ────────────────────────────────── */
    tabStatus: 'الحال', studentsStatus: 'حال الطلبة',
    finishedToday: '%1 أتمّوا ما عليهم اليوم',
    finishedCount: 'أتمّ %1 من %2',
    noneFinishedYet: 'لم يُتمّ أحدٌ ما عليه بعد',
    submittedCount: 'أرسل %1 من %2 تقريره',

    /* ── المصحف ────────────────────────────────────── */
    quranPage: 'القرآن الكريم', wholeQuran: 'المصحف كاملًا',
    todayPortion: 'نصيب اليوم',
    dayOfPlan: 'اليوم %1 من %2',
    legendMemorized: 'محفوظ',
    legendGoal: 'موضع الهدف',
    legendToday: 'نصيب اليوم',
    portionStripNote: 'كل قطعة يوم من أيام الهدف، والمضيئة نصيب اليوم',

    /* ── الأذكار على شكل بطاقات ────────────────────── */
    tapAnywhere: 'اضغط في أي موضع للعدّ',
    remainingOf: '%1 من %2',
    dhikrDone: 'تمّ',

    /* ── القارئ ────────────────────────────────────── */
    bookFile: 'نسخة الكتاب',
    bookFileHint: 'ارفع صور صفحات الكتاب، أو ملفًّا نصّيًّا يُقسَّم إلى صفحات',
    uploadPages: 'رفع صور الصفحات',
    uploadText: 'رفع ملف نصّي',
    pagesAdded: 'أُضيفت %1 صفحة',
    pdfNote: 'ملفات PDF تُفتح بقارئ الجهاز؛ عرضها داخل البرنامج يحتاج مكتبة خارجية.',
    openReader: 'افتح الكتاب',
    removeBookFile: 'حذف النسخة',
    noBookFile: 'لم تُرفع نسخة من هذا الكتاب بعد',
    saveReading: 'حفظ موضع القراءة',
    readingSaved: 'حُفظ عند صفحة %1',
    addToReportAsk: 'أُضيف ما قرأتَه اليوم إلى تقريرك؟',

    /* ── المسار ────────────────────────────────────── */
    thePath: 'مسار الفصل',
    stagesDone: 'محطّة تمّت',
    stagesOf: '%1 من %2',
    youAreHere: 'أنت هنا',
    endOfTerm: 'نهاية الفصل',

    /* ── تبويبات المعلّم ───────────────────────────── */
    tabDay: 'تقارير اليوم',

    /* ── المستويات والتسجيل ────────────────────────── */
    signUp: 'إنشاء حسابك',
    createAccount: 'إنشاء الحساب',
    chooseLevel: 'مستواك الدراسي',
    levelHint: 'صفحة «برنامجي» لطلبة المستوى الثالث',
    level: 'المستوى',
    welcomeNew: 'أهلًا بك يا %1',
    newStudent: 'جديد',
    programLevelOnly: 'صفحة «برنامجي» لطلبة المستوى الثالث (الجامعي)',

    /* ── قراءة المصحف ──────────────────────────────── */
    tabRead: 'المصحف', readQuran: 'قراءة المصحف',
    prevPage: 'الصفحة السابقة', nextPage: 'الصفحة التالية',
    ayahNo: 'آية %1',
    mushafSearchPlaceholder: 'رقم، أو اسم سورة، أو كلمة…',
    noResults: 'لا نتائج',
    resultCount: '(%1 نتيجة)',
    surahsFound: 'سور (%1)',
    occurrences: 'ورد في %1 موضعًا',
    moreOccurrences: 'و%1 موضعًا آخر — ضيّق بحثك',
    juz: 'الجزء', hizb: 'الحزب', pageWord: 'الصفحة',
    suraNumber: 'رقم السورة', pageNumber: 'الصفحة',
    ayaCount: 'عدد الآيات',

    /* التقويم */
    calendar: 'التقويم', calendarSystem: 'نظام التاريخ',
    calHijri: 'هجري', calGregorian: 'ميلادي',
    hijriOffset: 'تعديل الهلال', noOffset: 'بلا تعديل',
    hijriOffsetHint: 'إن سبق تقويم بلدك أو تأخّر يومًا',
    calendarNote: 'التواريخ تُحفظ ميلادية دائمًا؛ وإنما يتغيّر ما يُعرض.',

    /* المكتبة */
    library: 'المكتبة', tabLibrary: 'المكتبة',
    browseLibrary: 'تصفّح المكتبة',
    addLibraryBook: 'إضافة كتاب للمكتبة',
    libraryEmpty: 'لا كتب في المكتبة بعد',
    chooseThisBook: 'اقرأ هذا',
    chooseThisBookFirst: 'اختر الكتاب أولًا ليُحفظ موضعك',
    currentBook: 'كتابك الحالي',
    bookChosen: 'صار كتابك الحالي',
    bookCover: 'الغلاف',
    coverHint: 'أول صفحة من الكتاب غلافه، ولك أن تستبدلها بصورة',
    coverFromFirstPage: 'الغلاف من أول صفحة',
    noCoverYet: 'ارفع ملف الكتاب أولًا',
    changeCover: 'تغيير الغلاف', resetCover: 'إعادة الغلاف الأصلي',
    coverSaved: 'حُفظ الغلاف',
    bundledFile: 'مرفق مع البرنامج',
    chooseBook: 'اختيار الكتاب',
    fromLibrary2: 'من مكتبة الحلقة',
    fromMyBooks: 'من كتبي السابقة',
    newBook: 'كتاب جديد أكتبه بنفسي',

    /* عرض الملفات */
    viewFile: 'عرض', download: 'تنزيل',
    cannotPreview: 'لا يمكن عرض هذا النوع داخل البرنامج',
    loadingMushaf: 'جارٍ تجهيز المصحف…',
    basmala: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    prevSurah: 'السورة السابقة', nextSurah: 'السورة التالية',
    fontSize: 'حجم الخط', markMemorized: 'تسجيل هذا المقطع',
    ayahTapHint: 'اضغط على أي آية لتحديد مقطع، ثم سجّله',
    selected: 'محدَّد: %1',
    clearSelection: 'إلغاء التحديد',
    goToAyah: 'اذهب إلى آية',

    /* ── الكتاب ────────────────────────────────────── */
    tabBook: 'الكتاب',
    uploadPdf: 'رفع ملف PDF',
    pdfLoading: 'جارٍ فتح الملف…',
    pdfFailed: 'تعذّر فتح الملف',
    zoomIn: 'تكبير', zoomOut: 'تصغير',

    /* ── مؤقّت الإيقاف ─────────────────────────────── */
    timerOff: 'بدون مؤقّت',
    timerEndOfTrack: 'عند انتهاء المقطع',
    timerCustom: 'مدّة مخصّصة',
    timerMinutes: 'كم دقيقة؟',
    timerSetFor: 'سيتوقّف بعد %1 دقيقة',
    timerSetEnd: 'سيتوقّف عند انتهاء المقطع',
    timerCancelled: 'أُلغي المؤقّت',

    /* ── مكتبة القارئ ──────────────────────────────── */
    reciterFiles: 'ملفات القارئ',
    uploadReciterFiles: 'رفع ملفات التلاوة',
    reciterFilesHint: 'ارفع ملفًّا لكل سورة، أو المصحف كاملًا دفعة واحدة — ويُرتَّب من أرقام الأسماء',
    filesSorted: 'رُتّبت %1 سورة',
    filesUnmatched: '%1 ملفًّا لم يُعرف رقم سورته',
    fromUpload: 'من ملفات المعلّم',
    surahMissing: 'غير مرفوعة',
    sourceLibrary: 'مكتبة التلاوات', sourceFiles: 'ملفات مرفوعة',

    /* misc */
    saved: 'تم الحفظ', deleted: 'تم الحذف',
    milestone: 'ما شاء الله! أتممتَ %1 يومًا متتاليًا',
    confirmDelete: 'هل تريد الحذف؟'
  }
};

window.T = function (key, ...args) {
  const table = window.STRINGS[window.T.lang] || window.STRINGS.ar;
  let s = table[key];
  if (s === undefined) return key;
  if (Array.isArray(s)) return s;
  args.forEach((v, i) => { s = s.split('%' + (i + 1)).join(v); });
  return s;
};
window.T.lang = 'ar';
