/* ============================================================
   بصائرنا — routing, top bar and tab bar
   ============================================================ */

window.Router = (function () {

  const { el, $ } = U;
  const routes = [];
  let current = null;
  let rendering = false;
  let pending = false;

  /* register('/student/:id', { render, title, tab, role }) */
  function register(pattern, def) {
    const names = [];
    const rx = new RegExp('^' + pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    routes.push(Object.assign({ pattern, rx, names }, def));
  }

  function match(path) {
    for (const r of routes) {
      const m = r.rx.exec(path);
      if (m) {
        const params = {};
        r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        return { route: r, params };
      }
    }
    return null;
  }

  const path = () => (location.hash || '#/').slice(1) || '/';
  function go(to, { replace } = {}) {
    if (replace) location.replace('#' + to);
    else location.hash = to;
  }
  const back = () => history.length > 1 ? history.back() : go('/');

  /* A page that takes a moment to build must not swallow the next tap.
     Anything arriving mid-render is remembered and drawn straight after,
     rather than dropped — which used to leave the student staring at the
     old screen wondering why nothing happened. */
  async function render() {
    if (rendering) { pending = true; return; }
    rendering = true;
    const screenEl = $('#screen');

    /* The address this pass is drawing. If it changes while we await,
       the result is stale and must not be pinned to the screen. */
    const startedAt = path();
    const isStale = () => path() !== startedAt;

    try {
      let found = match(startedAt);

      /* An address that no longer exists — a removed page, or a stale
         bookmark — goes home rather than dropping to the login screen. */
      if (!found && Session.user) {
        return go(Session.isTeacher ? '/t/students' : '/home', { replace: true });
      }

      /* Guard: anything but the login screen needs a signed-in user. */
      if (!found) found = match('/');
      if (found && found.route.auth !== false && !Session.user) {
        return go('/', { replace: true });
      }
      if (found && found.route.role && Session.user &&
          Session.user.role !== found.route.role) {
        return go(Session.user.role === 'teacher' ? '/t/students' : '/home', { replace: true });
      }

      current = found;
      screenEl.classList.add('is-leaving');
      await U.sleep(60);
      if (isStale()) return;
      U.clear(screenEl);
      screenEl.scrollTop = 0;

      const node = await found.route.render(found.params);
      if (isStale()) return;
      screenEl.appendChild(node || el('div'));
      screenEl.classList.remove('is-leaving');

      renderTopbar(found.route, found.params);
      renderTabbar(found.route);
      document.title = (found.route.title ? found.route.title(found.params) + ' — ' : '') + CONFIG.app.fullName;
    } catch (err) {
      console.error('[بصائرنا]', err);
      U.clear($('#screen'));
      $('#screen').appendChild(el('div.page', {},
        UI.empty('حدث خطأ غير متوقع: ' + (err.message || err),
          UI.button('العودة للرئيسية', () => go('/'), 'primary'))));
    } finally {
      rendering = false;
      /* Something asked for a page while this one was drawing, or the
         address moved on mid-draw — either way, draw again now. */
      if (pending || path() !== startedAt) {
        pending = false;
        render();
      }
    }
  }

  /* ── top bar ──────────────────────────────────────────── */
  function renderTopbar(route, params) {
    const bar = $('#topbar');
    U.clear(bar);
    if (route.chrome === false) { bar.hidden = true; return; }
    bar.hidden = false;

    const left = el('div.topbar-side');
    const right = el('div.topbar-side');

    if (route.back) {
      left.appendChild(UI.iconButton('forward', () => {
        typeof route.back === 'string' ? go(route.back) : back();
      }, { label: T('back') }));
    } else {
      left.appendChild(el('img.topbar-logo', { src: 'assets/logo.jpeg', alt: '' }));
    }

    const title = el('div.topbar-title', {},
      el('span.topbar-name', {}, route.title ? route.title(params) : CONFIG.app.name));
    if (route.subtitle) title.appendChild(el('span.topbar-sub', {}, route.subtitle(params)));

    if (route.actions) route.actions(params).forEach(a => a && right.appendChild(a));
    right.appendChild(UI.iconButton('gear', () => go('/settings'), { label: T('settings') }));

    bar.append(left, title, right);
  }

  /* ── tab bar ──────────────────────────────────────────── */
  /* شريط التبويبات يمتدّ أفقيًّا حين تزيد الوجهات عن سعة الشاشة. */
  const STUDENT_TABS = [
    { to: '/home',     icon: 'home',  label: () => T('tabHome') },
    { to: '/report',   icon: 'check', label: () => T('tabReport') },
    { to: '/read',     icon: 'quran', label: () => T('tabRead') },
    { to: '/tree',     icon: 'tree',  label: () => T('tabTree') },
    { to: '/adhkar',   icon: 'heart', label: () => T('tabAdhkar') },
    { to: '/memorize', icon: 'book',  label: () => T('tabMemorize') },
    { to: '/listen',   icon: 'play',  label: () => T('tabListen') },
    { to: '/book',     icon: 'upload',  label: () => T('tabBook') },
    { to: '/library',  icon: 'library', label: () => T('tabLibrary') },
    /* برنامجي لطلبة المستوى الثالث وحدهم */
    { to: '/program',  icon: 'star',  label: () => T('tabProgram'), levelOnly: true },
    { to: '/more',     icon: 'more',  label: () => T('tabMore') }
  ];
  const TEACHER_TABS = [
    { to: '/t/students', icon: 'users', label: () => T('tabStudents') },
    { to: '/t/day',      icon: 'check', label: () => T('tabDay'), badge: 'reports' },
    { to: '/t/reports',  icon: 'chart', label: () => 'الوارد' },
    { to: '/status',     icon: 'chart', label: () => T('tabStatus') },
    { to: '/t/inbox',    icon: 'mic',   label: () => T('inbox'), badge: 'pending' },
    { to: '/library',    icon: 'library', label: () => T('tabLibrary') },
    { to: '/t/listen',   icon: 'play',    label: () => T('tabListen') },
    { to: '/more',       icon: 'more',    label: () => T('tabMore') }
  ];

  async function renderTabbar(route) {
    const bar = $('#tabbar');
    U.clear(bar);
    if (route.chrome === false || !Session.user) { bar.hidden = true; return; }
    bar.hidden = false;

    const all = Session.isTeacher ? TEACHER_TABS : STUDENT_TABS;
    const tabs = all.filter(t => !t.levelOnly || ProgramDays.hasProgram(Session.user));
    const here = path();

    tabs.forEach(t => {
      const active = here === t.to || here.startsWith(t.to + '/');
      const node = el('a.tab' + (active ? '.is-active' : ''), {
        href: '#' + t.to, 'aria-current': active ? 'page' : null
      }, UI.icon(t.icon, 22), el('span', {}, t.label()));
      bar.appendChild(node);
      /* التبويب الجاري يُجلَب إلى مرأى العين في الشريط الممتدّ. */
      if (active) setTimeout(() => {
        if (node.scrollIntoView) node.scrollIntoView({ inline: 'center', block: 'nearest' });
      }, 40);

      if (t.badge === 'pending') {
        Entries.pending(Session.user.id).then(list => {
          if (list.length) node.appendChild(el('i.tab-badge', {}, U.num(list.length)));
        });
      }
      /* How many of today's reports are still missing. */
      if (t.badge === 'reports' && ProgramDays.isProgramDay(U.todayKey())) {
        Promise.all([
          Users.students(Session.user.id),
          Reports.submittedOn(U.todayKey())
        ]).then(([students, done]) => {
          const missing = students.length - done.length;
          if (missing > 0) node.appendChild(el('i.tab-badge.tab-badge--soft', {}, U.num(missing)));
        });
      }
    });
  }

  function refreshTabs() { if (current) renderTabbar(current.route); }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }

  return { register, go, back, start, render, refreshTabs, path, get current() { return current; } };
})();
