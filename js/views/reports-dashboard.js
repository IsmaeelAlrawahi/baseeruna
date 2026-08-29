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
      // جلب جميع التقارير المرسلة من Supabase
      const reports = await window.SupabaseClient.getAllSubmittedReports();

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

      // جلب بيانات الطلاب
      const allUsers = await Users.all();
      const usersMap = new Map(allUsers.map(u => [u.id, u]));

      // تجميع التقارير حسب التاريخ
      const byDate = {};
      reports.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
      });

      // ترتيب التواريخ من الأحدث للأقدم
      const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

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

          const reportItem = el('div.report-item', {
            onclick: () => {
              if (user) Router.go(`/t/report/${user.id}/${report.date}`);
            }
          },
            el('div.report-item-avatar', {
              style: `background: ${userColor}`
            }, userName.charAt(0)),
            el('div.report-item-content', {},
              el('div.report-item-name', {}, userName),
              el('div.report-item-stats', {},
                el('span', {}, `قرآن: ${report.quran?.memorized || 0} صفحة`),
                el('span', {}, `شعر: ${report.poetry?.verses || 0} بيت`),
                el('span', {}, `قراءة: ${report.reading?.minutes || 0} دقيقة`)
              ),
              report.note ? el('p.report-item-note', {}, report.note) : null
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
