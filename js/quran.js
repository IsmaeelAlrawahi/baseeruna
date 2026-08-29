/* ============================================================
   بصائرنا — Qur'an reference data
   Each surah: [name, ayahCount, startPage, 1=مكية 2=مدنية]
   Pages follow the standard Madani mushaf (604 pages).
   ============================================================ */

window.QURAN = (function () {

  const RAW = [
    ['الفاتحة',7,1,1],       ['البقرة',286,2,2],      ['آل عمران',200,50,2],
    ['النساء',176,77,2],     ['المائدة',120,106,2],   ['الأنعام',165,128,1],
    ['الأعراف',206,151,1],   ['الأنفال',75,177,2],    ['التوبة',129,187,2],
    ['يونس',109,208,1],      ['هود',123,221,1],       ['يوسف',111,235,1],
    ['الرعد',43,249,2],      ['إبراهيم',52,255,1],    ['الحجر',99,262,1],
    ['النحل',128,267,1],     ['الإسراء',111,282,1],   ['الكهف',110,293,1],
    ['مريم',98,305,1],       ['طه',135,312,1],        ['الأنبياء',112,322,1],
    ['الحج',78,332,2],       ['المؤمنون',118,342,1],  ['النور',64,350,2],
    ['الفرقان',77,359,1],    ['الشعراء',227,367,1],   ['النمل',93,377,1],
    ['القصص',88,385,1],      ['العنكبوت',69,396,1],   ['الروم',60,404,1],
    ['لقمان',34,411,1],      ['السجدة',30,415,1],     ['الأحزاب',73,418,2],
    ['سبأ',54,428,1],        ['فاطر',45,434,1],       ['يس',83,440,1],
    ['الصافات',182,446,1],   ['ص',88,453,1],          ['الزمر',75,458,1],
    ['غافر',85,467,1],       ['فصلت',54,477,1],       ['الشورى',53,483,1],
    ['الزخرف',89,489,1],     ['الدخان',59,496,1],     ['الجاثية',37,499,1],
    ['الأحقاف',35,502,1],    ['محمد',38,507,2],       ['الفتح',29,511,2],
    ['الحجرات',18,515,2],    ['ق',45,518,1],          ['الذاريات',60,520,1],
    ['الطور',49,523,1],      ['النجم',62,526,1],      ['القمر',55,528,1],
    ['الرحمن',78,531,2],     ['الواقعة',96,534,1],    ['الحديد',29,537,2],
    ['المجادلة',22,542,2],   ['الحشر',24,545,2],      ['الممتحنة',13,549,2],
    ['الصف',14,551,2],       ['الجمعة',11,553,2],     ['المنافقون',11,554,2],
    ['التغابن',18,556,2],    ['الطلاق',12,558,2],     ['التحريم',12,560,2],
    ['الملك',30,562,1],      ['القلم',52,564,1],      ['الحاقة',52,566,1],
    ['المعارج',44,568,1],    ['نوح',28,570,1],        ['الجن',28,572,1],
    ['المزمل',20,574,1],     ['المدثر',56,575,1],     ['القيامة',40,577,1],
    ['الإنسان',31,578,2],    ['المرسلات',50,580,1],   ['النبأ',40,582,1],
    ['النازعات',46,583,1],   ['عبس',42,585,1],        ['التكوير',29,586,1],
    ['الانفطار',19,587,1],   ['المطففين',36,587,1],   ['الانشقاق',25,589,1],
    ['البروج',22,590,1],     ['الطارق',17,591,1],     ['الأعلى',19,591,1],
    ['الغاشية',26,592,1],    ['الفجر',30,593,1],      ['البلد',20,594,1],
    ['الشمس',15,595,1],      ['الليل',21,595,1],      ['الضحى',11,596,1],
    ['الشرح',8,596,1],       ['التين',8,597,1],       ['العلق',19,597,1],
    ['القدر',5,598,1],       ['البينة',8,598,2],      ['الزلزلة',8,599,2],
    ['العاديات',11,599,1],   ['القارعة',11,600,1],    ['التكاثر',8,600,1],
    ['العصر',3,601,1],       ['الهمزة',9,601,1],      ['الفيل',5,601,1],
    ['قريش',4,602,1],        ['الماعون',7,602,1],     ['الكوثر',3,602,1],
    ['الكافرون',6,603,1],    ['النصر',3,603,2],       ['المسد',5,603,1],
    ['الإخلاص',4,604,1],     ['الفلق',5,604,1],       ['الناس',6,604,1]
  ];

  const surahs = RAW.map((r, i) => ({
    no: i + 1,
    name: r[0],
    fullName: 'سورة ' + r[0],
    ayahs: r[1],
    page: r[2],
    revelation: r[3] === 1 ? 'مكية' : 'مدنية'
  }));

  /* Where each juz begins: [surah, ayah] */
  const juzStarts = [
    [1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],
    [9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],
    [29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]
  ];

  /* …and the page each one opens on in the Madani mushaf. Having
     both tables lets page figures stay honest in the middle of a
     long surah, where ayah length varies wildly. */
  const juzStartPages = [
    1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
    201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
    402, 422, 442, 462, 482, 502, 522, 542, 562, 582
  ];

  const TOTAL_AYAHS = surahs.reduce((s, x) => s + x.ayahs, 0);   /* 6236 */
  const TOTAL_PAGES = 604;
  const TOTAL_JUZ   = 30;

  /* Running total of ayahs before each surah — lets us treat the
     whole mushaf as one continuous ayah index. */
  const offset = [];
  surahs.reduce((acc, s, i) => { offset[i] = acc; return acc + s.ayahs; }, 0);

  function get(no) { return surahs[no - 1] || null; }

  /* Absolute ayah index (1..6236) — used to merge overlapping
     memorization entries so nothing is counted twice. */
  function absoluteIndex(surahNo, ayah) {
    if (surahNo < 1 || surahNo > 114) return 0;
    return offset[surahNo - 1] + ayah;
  }

  /* The reverse: which surah and ayah an absolute index lands on. */
  function fromAbsolute(abs) {
    let lo = 0, hi = 113;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offset[mid] < abs) lo = mid; else hi = mid - 1;
    }
    return { surah: lo + 1, ayah: abs - offset[lo] };
  }

  /* ── pages ────────────────────────────────────────────
     Ayahs are nowhere near evenly spread across the mushaf — the
     last juz packs hundreds of short ayahs into a couple of dozen
     pages, while البقرة spends 48 pages on 286 long ones. So page
     figures are worked out from each surah's real starting page
     and interpolated inside it, never from a flat ayah ratio.
     ─────────────────────────────────────────────────────── */
  /* Every point in the mushaf we know the page of exactly: the
     first ayah of each surah, and the first ayah of each juz.
     Anything between two anchors is interpolated. */
  const anchors = (function () {
    const map = new Map();
    surahs.forEach(s => map.set(absoluteIndex(s.no, 1), s.page));
    juzStarts.forEach((j, i) => map.set(absoluteIndex(j[0], j[1]), juzStartPages[i]));
    map.set(TOTAL_AYAHS + 1, TOTAL_PAGES + 1);
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  })();

  function pagePos(abs) {
    if (abs <= 1) return 1;
    if (abs > TOTAL_AYAHS) return TOTAL_PAGES + 1;

    let lo = 0, hi = anchors.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (anchors[mid][0] <= abs) lo = mid; else hi = mid - 1;
    }
    const [aAbs, aPage] = anchors[lo];
    const next = anchors[Math.min(lo + 1, anchors.length - 1)];
    if (next[0] <= aAbs) return aPage;

    const within = (abs - aAbs) / (next[0] - aAbs);
    return aPage + within * (next[1] - aPage);
  }

  /* How many pages an absolute ayah range spans. */
  function pagesBetween(fromAbs, toAbs) {
    if (!(toAbs >= fromAbs)) return 0;
    return Math.max(0, +(pagePos(toAbs + 1) - pagePos(fromAbs)).toFixed(2));
  }

  /* Page span of an ayah range inside one surah. */
  function pagesOf(surahNo, fromAyah, toAyah) {
    const s = get(surahNo);
    if (!s) return 0;
    return pagesBetween(absoluteIndex(surahNo, fromAyah),
                        absoluteIndex(surahNo, Math.min(toAyah, s.ayahs)));
  }

  const PAGES_PER_JUZ = TOTAL_PAGES / TOTAL_JUZ;

  function juzOf(surahNo, ayah) {
    const abs = absoluteIndex(surahNo, ayah);
    let j = 1;
    for (let i = 0; i < juzStarts.length; i++) {
      if (absoluteIndex(juzStarts[i][0], juzStarts[i][1]) <= abs) j = i + 1;
    }
    return j;
  }

  /* Merge a list of {surah, from, to} ranges and return how much
     distinct Qur'an they cover. */
  function coverage(ranges) {
    const spans = ranges
      .map(r => [absoluteIndex(r.surah, r.from), absoluteIndex(r.surah, r.to)])
      .filter(s => s[0] > 0 && s[1] >= s[0])
      .sort((a, b) => a[0] - b[0]);

    let ayahs = 0, cursor = 0, pages = 0;
    const merged = [];
    spans.forEach(s => {
      const start = Math.max(s[0], cursor + 1);
      if (s[1] >= start) {
        ayahs += s[1] - start + 1;
        pages += pagesBetween(start, s[1]);
        merged.push([start, s[1]]);
      }
      cursor = Math.max(cursor, s[1]);
    });

    pages = +pages.toFixed(1);
    return {
      ayahs,
      pages,
      juz: +(pages / PAGES_PER_JUZ).toFixed(2),
      percent: +(ayahs / TOTAL_AYAHS * 100).toFixed(1),
      merged
    };
  }

  /* ── addressing a specific portion of the mushaf ─────────
     Each returns an absolute ayah span [from, to] plus a label,
     so a goal can point at "الجزء ٣٠" or "سورة البقرة" directly
     instead of an abstract quantity.                          */

  function juzRange(n) {
    n = clampInt(n, 1, TOTAL_JUZ);
    const start = juzStarts[n - 1];
    const from = absoluteIndex(start[0], start[1]);
    const to = (n < TOTAL_JUZ)
      ? absoluteIndex(juzStarts[n][0], juzStarts[n][1]) - 1
      : TOTAL_AYAHS;
    return { kind: 'juz', juz: n, from, to, label: 'الجزء ' + n,
             ayahs: to - from + 1 };
  }

  function surahRange(no) {
    const s = get(clampInt(no, 1, 114));
    const from = absoluteIndex(s.no, 1);
    return { kind: 'surah', surah: s.no, from, to: from + s.ayahs - 1,
             label: s.fullName, ayahs: s.ayahs };
  }

  /* Pages carry no ayah numbers in our data, so this interpolates
     inside the surah that owns the page. Close enough to steer a
     goal by; never presented as exact. */
  function ayahAtPage(page) {
    page = clampInt(page, 1, TOTAL_PAGES);
    let idx = 0;
    for (let i = 0; i < surahs.length; i++) {
      if (surahs[i].page <= page) idx = i; else break;
    }
    const s = surahs[idx];
    const next = surahs[idx + 1];
    const span = (next ? next.page : TOTAL_PAGES + 1) - s.page;
    const within = span > 0 ? (page - s.page) / span : 0;
    const ayah = Math.min(s.ayahs, Math.max(1, Math.round(within * s.ayahs) + 1));
    return absoluteIndex(s.no, ayah);
  }

  function pageRange(fromPage, toPage) {
    fromPage = clampInt(fromPage, 1, TOTAL_PAGES);
    toPage = clampInt(toPage, fromPage, TOTAL_PAGES);
    const from = ayahAtPage(fromPage);
    const to = (toPage >= TOTAL_PAGES) ? TOTAL_AYAHS
             : Math.max(from, ayahAtPage(toPage + 1) - 1);
    return {
      kind: 'pages', fromPage, toPage, from, to,
      label: fromPage === toPage ? 'صفحة ' + fromPage
                                 : 'الصفحات ' + fromPage + ' – ' + toPage,
      pages: toPage - fromPage + 1, ayahs: to - from + 1
    };
  }

  /* Which surahs a span touches — used to label a juz nicely. */
  function surahsIn(span) {
    return surahs.filter(s => {
      const a = absoluteIndex(s.no, 1);
      return a + s.ayahs - 1 >= span.from && a <= span.to;
    });
  }

  /* How much of one specific span the student has actually covered. */
  function coverageIn(ranges, span) {
    const cov = coverage(ranges);
    let ayahs = 0, pages = 0;
    cov.merged.forEach(([a, b]) => {
      const lo = Math.max(a, span.from), hi = Math.min(b, span.to);
      if (hi >= lo) { ayahs += hi - lo + 1; pages += pagesBetween(lo, hi); }
    });
    const total = span.to - span.from + 1;
    return {
      ayahs, totalAyahs: total,
      percent: total > 0 ? +(ayahs / total * 100).toFixed(1) : 0,
      pages: +pages.toFixed(1),
      totalPages: +pagesBetween(span.from, span.to).toFixed(1)
    };
  }

  function clampInt(v, lo, hi) {
    v = Math.round(+v || lo);
    return Math.min(hi, Math.max(lo, v));
  }

  function search(q) {
    q = (q || '').trim();
    if (!q) return surahs;
    const norm = t => t.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْ]/g, '');
    const nq = norm(q);
    if (/^\d+$/.test(q)) { const s = get(+q); return s ? [s] : []; }
    return surahs.filter(s => norm(s.name).includes(nq));
  }

  return {
    surahs, get, search, pagesOf, absoluteIndex, fromAbsolute, juzOf, coverage,
    pagePos, pagesBetween,
    juzRange, surahRange, pageRange, ayahAtPage, surahsIn, coverageIn,
    juzStarts, TOTAL_AYAHS, TOTAL_PAGES, TOTAL_JUZ, PAGES_PER_JUZ
  };
})();
