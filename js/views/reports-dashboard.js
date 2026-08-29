/* ============================================================
   بصائرنا — لوحة التقارير (للمشرفين)

   صفحة تعرض جميع التقارير المرسلة من الطلاب من Supabase
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/t/reports', {
    role: 'teacher',
    title: () => 'التقارير المرسلة',
    render: () => renderReportsDashboard()
  });

  async function renderReportsDashboard() {
    const page = UI.screen(null, 'page--reports-dashboard');

    // التحقق من إعداد Supabase
    if (!window.SupabaseClient || !window.SupabaseClient.isConfigured) {
      page.appendChild(UI.card([
        el('div.empty', {},
          UI.icon('alert', 44),
          el('h3', {}, 'Supabase غير مُعدّ'),
          el('p', {}, 'يرجى إضافة بيانات Supabase في ملف js/supabase-client.js لرؤية التقارير من الخادم.'),
          el('p.hint', {}, 'يمكنك حالياً رؤية التقارير المحلية فقط من صفحة "حال الطلبة".')
        )
      ]));
      return page;
    }

    // إنشاء منطقة التحميل
    const loadingHost = el('div.card');
    loadingHost.appendChild(UI.loading('جارٍ تحميل التقارير...'));
    page.appendChild(loadingHost);

    try {
      // ── مصدر الحقيقة: حلقة المعلّم الحالي فقط ──────────
      // كان getAllSubmittedReports يجلب كل حلقات المنصة (تسريب).
      // الآن: اسحب roster المعلّم أولاً ثم تقارير طلابه فقط.
      const me = Session.user;
      let reports = [];
      let cloudStudents = [];
      if (window.Sync) {
        cloudStudents = await window.Sync.pullTeacherRoster(me.id);
        const ids = cloudStudents.map(s => s.id);
        if (ids.length) {
          try { reports = (await window.SupabaseClient.getReportsForUsers(ids) || []).filter(r => r.submitted); }
          catch (e) { console.warn('[بصائرنا] تعذّر جلب تقارير الحلقة', e); }
          reports.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
        }
        await window.Sync.pullReportsForTeacher(me.id);
      } else {
        reports = await window.SupabaseClient.getAllSubmittedReports();
      }

      // إزالة رسالة التحميل
      U.clear(loadingHost);

      if (!reports || reports.length === 0) {
        page.appendChild(UI.card([
          UI.empty('لا توجد تقارير مرسلة حتى الآن',
            el('p.hint', {}, 'عندما يرسل الطلاب تقاريرهم، ستظهر هنا.'))
        ]));
        return page;
      }

      // العنوان
      page.appendChild(el('div.section-head', {},
        el('h2', {}, `التقارير المرسلة (${U.num(reports.length)})`),
        UI.button('تحديث', () => Router.render(), 'ghost', { icon: 'refresh' })
      ));

      // جلب بيانات الطلاب (محليًا + roster السحابي)
      const allUsers = await Users.all();
      const usersMap = new Map(allUsers.map(u => [u.id, u]));
      (cloudStudents || []).forEach(su => {
        if (!usersMap.has(su.id)) {
          usersMap.set(su.id, {
            id: su.id, role: 'student',
            name: su.name || su.id, color: su.color || '#666',
            teacherId: su.teacherId || null, level: su.level
          });
        }
      });

      // تجميع التقارير حسب التاريخ
      const byDate = {};
      reports.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
      });

      // ترتيب التواريخ من الأحدث للأقدم
      const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

      // عدد التقارير التي ما زالت بحاجة لردّ الأستاذ (لا ملاحظة بعد)
      const unanswered = reports.length;
      const answered = reports.filter(r => (r.teacherNote || '').trim()).length;

      // شريط الوارد: يلخّص حالة التغذية الراجعة لدور المعلم
      const inboxBar = el('div.inbox-bar', {},
        el('div.inbox-stat', {}, el('b', {}, U.num(answered)), el('span', {}, 'تمّ الردّ')),
        el('div.inbox-stat', {}, el('b', {}, U.num(unanswered - answered)), el('span', {}, 'بانتظار الردّ')));
      page.appendChild(UI.card([el('div.inbox-head', {},
        el('div', {},
          el('h3', {}, 'الوارد — تغذية الأستاذ الراجعة'),
          el('p.hint', {}, 'انقر على أي تقرير لفتحه وكتابة/تعديل ملاحظة الأستاذ')),
        inboxBar)], 'card--inbox'));

      // عرض التقارير مجموعة حسب التاريخ
      dates.forEach(date => {
        const dateReports = byDate[date];

        const dateCard = UI.card([], 'card--section');
        dateCard.appendChild(
          el('div.section-title', {},
            el('h3', {}, ProgramDays.dayName(date)),
            el('small', {}, U.formatDate(date) + ' • ' + U.num(dateReports.length) + ' تقرير')
          )
        );

        const listEl = el('div.reports-list');

        dateReports.forEach(report => {
          const user = usersMap.get(report.userId);
          const userName = user ? user.name : report.userId;
          const userColor = user ? user.color : '#666';
          const hasReply = !!(report.teacherNote && report.teacherNote.trim());

          const reportItem = el('div.report-item', {
            onclick: () => {
              if (user) Router.go(`/t/report/${user.id}/${report.date}`);
            }
          },
            el('div.report-item-avatar', {
              style: `background: ${userColor}`
            }, userName.charAt(0)),
            el('div.report-item-content', {},
              el('div.report-item-name', {},
                userName,
                hasReply ? UI.badge('تمّ ردّ الأستاذ', 'ok') : UI.badge('بدون ردّ', 'soft')),
              el('div.report-item-stats', {},
                el('span', {}, `قرآن: ${report.quran?.memorized || 0} صفحة`),
                el('span', {}, `شعر: ${report.poetry?.verses || 0} بيت`),
                el('span', {}, `قراءة: ${report.reading?.minutes || 0} دقيقة`)
              ),
              report.note ? el('p.report-item-note', {}, report.note) : null,
              hasReply
                ? el('div.entry-comment.teacher-reply', {},
                    el('b', {}, 'ملاحظة الأستاذ: '), el('span', {}, report.teacherNote))
                : el('p.hint', {}, 'لم يكتب الأستاذ ملاحظة بعد — انقر للردّ')
            ),
            el('div.report-item-meta', {},
              UI.badge('مُرسَل', 'ok'),
              el('small', {}, U.formatTime(report.submittedAt))
            )
          );

          listEl.appendChild(reportItem);
        });

        dateCard.appendChild(listEl);
        page.appendChild(dateCard);
      });

    } catch (error) {
      U.clear(loadingHost);
      page.appendChild(UI.card([
        el('div.empty', {},
          UI.icon('alert', 44),
          el('h3', {}, 'خطأ في تحميل التقارير'),
          el('p', {}, error.message || 'حدث خطأ غير متوقع'),
          UI.button('إعادة المحاولة', () => Router.render(), 'primary')
        )
      ]));
    }

    return page;
  }

  window.ReportsDashboard = { renderReportsDashboard };
})();
