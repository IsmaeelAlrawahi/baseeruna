/* ============================================================
   بصائرنا — تفصيل التقييم

   لوحة نتائج الحلقة حُذفت: لا ترتيب بين الطلاب ولا درجات
   معروضة. وبقي هنا تفصيل التقييم للمعلّم وحده، يفتحه من صفحة
   الطالب، وفيه قيام الليل الذي لا يظهر لأحد سواه.
   ============================================================ */

(function () {
  const { el } = U;

  const figure = (value, label) =>
    el('div.figure', {}, el('b', {}, value), el('span', {}, label));

  /* أتمّ أو لم يتمّ — لا نسب ولا أرقام. */
  async function detailSheet(student) {
    const sc = await Score.forUser(student.id);
    const body = el('div.form');

    const rows = [
      ['quranMemorize', 'حفظ القرآن'],
      ['quranReview',   'مراجعة القرآن'],
      ['poetry',        'الشعر'],
      ['reading',       'القراءة'],
      ['nahw',          'النحو'],
      ['meetups',       'الملتقيات'],
      ['qiyam',         T('qiyam')]
    ];

    const done = rows.filter(([k]) => (sc.ratios[k] || 0) >= 0.999).length;
    body.appendChild(el('p.hint', {},
      T('doneOfTracks', U.num(done), U.num(rows.length))));

    const list = el('div.donelist');
    rows.forEach(([key, name]) => {
      const complete = (sc.ratios[key] || 0) >= 0.999;
      list.appendChild(el('div.donerow' + (complete ? '.is-done' : ''), {},
        el('span.donerow-mark', {}, complete ? UI.icon('check', 15) : UI.icon('x', 13)),
        el('span.donerow-name', {}, name),
        key === 'qiyam' ? UI.badge(T('privateTrack'), 'gold') : null,
        el('b.donerow-state', {}, complete ? T('completed') : T('notCompleted'))));
    });
    body.appendChild(list);

    body.appendChild(el('p.hint', {},
      `${T('reportsIn')}: ${U.num(sc.submitted)} / ${U.num(sc.days)}`));
    body.appendChild(el('p.hint', {}, 'هذا التفصيل لك وحدك، ولا يظهر للطالب.'));

    UI.sheet({ title: T('resultDetails') + ' — ' + student.name, body, wide: true,
               actions: [{ label: T('close'), kind: 'ghost' }] });
  }

  window.ResultsView = { detailSheet };
})();
