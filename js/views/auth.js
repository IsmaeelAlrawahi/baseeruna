/* ============================================================
   بصائرنا — الدخول

   أسماء الطلاب لا تُعرض: يدخل كلٌّ برمزه الخاص ورمزه السرّي،
   فلا يرى أحدٌ من في الحلقة ولا يدخل باسم غيره.

   وإن ضُبط معرّف Google في الإعدادات ظهر الدخول به أيضًا.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/', {
    auth: false, chrome: false,
    render: renderGate
  });

  async function renderGate() {
    const page = el('div.gate');

    page.appendChild(el('div.gate-brand', {},
      el('img.gate-logo', { src: 'assets/logo.jpeg', alt: CONFIG.app.name }),
      el('h1.gate-name', {}, CONFIG.app.name),
      el('p.gate-tag', {}, CONFIG.app.tagline)));

    const body = el('div.gate-body');
    page.appendChild(body);

    if (CONFIG.auth.showStudentList) await showRoles(body);
    else await showLogin(body);

    page.appendChild(el('p.gate-foot', {}, U.hijri(new Date())));
    return page;
  }

  /* ══════════════════ الدخول بالرمز ═════════════════════ */
  async function showLogin(host) {
    U.clear(host);

    const codeIn = UI.input({
      placeholder: T('codePlaceholder'), autocapitalize: 'characters',
      autocomplete: 'username', spellcheck: 'false'
    });
    codeIn.addEventListener('input', () => {
      codeIn.value = codeIn.value.toUpperCase().replace(/\s/g, '');
      err.textContent = '';
    });

    const err = el('p.pin-error');

    const submit = async () => {
      const user = await Users.byCode(codeIn.value);
      if (!user) { err.textContent = T('codeNotFound'); return; }
      if (user.pin) askPin(user);
      else enter(user);
    };
    codeIn.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    host.append(
      el('p.gate-question', {}, T('signIn')),
      UI.field(T('loginCode'), codeIn, T('loginCodeHint')),
      err,
      UI.button(T('continue'), submit, 'primary', { icon: 'forward' }));

    /* ── Google ───────────────────────────────────────── */
    if (CONFIG.auth.googleClientId) {
      host.append(el('div.gate-or', {}, el('span', {}, T('or'))));
      const gHost = el('div.gate-google');
      host.appendChild(gHost);
      mountGoogle(gHost);
    }

    /* منفذ للمعلّم دون أن تُعرض أسماء الطلاب. */
    host.appendChild(el('div.gate-links', {},
      el('button.gate-back', {
        type: 'button', onclick: () => showTeachers(host)
      }, UI.icon('users', 16), el('span', {}, T('teacherEntry'))),
      el('button.gate-back', {
        type: 'button', onclick: () => openTeacherSignup()
      }, UI.icon('plus', 16), el('span', {}, T('newTeacher')))));
  }

  /* ── معلّمٌ جديد يفتح حلقته ────────────────────────────
     لكل معلّم طلابه، ومكتبته، وقرّاؤه، وأذكاره — لا يرى حلقةَ
     غيره ولا يراه أحد. وينضمّ إليه طلابه برمز حلقته.          */
  function openTeacherSignup() {
    let name = '', pin = '';

    const nameIn = UI.input({ placeholder: 'اسمك الكامل' });
    nameIn.addEventListener('input', () => { name = nameIn.value; });

    const pinIn = UI.input({ type: 'text', inputmode: 'numeric', maxlength: 4, placeholder: '١٢٣٤' });
    pinIn.addEventListener('input', () => {
      pinIn.value = pinIn.value.replace(/\D/g, '').slice(0, 4);
      pin = pinIn.value;
    });

    UI.sheet({
      title: T('newTeacher'),
      body: el('div.form', {},
        el('p.hint', {}, T('newTeacherHint')),
        UI.field(T('myName'), nameIn),
        UI.field(T('studentPin'), pinIn, T('pinLength'))),
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('createAccount'), kind: 'primary', onClick: async a => {
            if (!name.trim()) return UI.toast('اكتب اسمك', 'warn');
            if (pin.length !== 4) return UI.toast(T('pinLength'), 'warn');
            const teacher = await Users.create({ name, role: 'teacher', pin });
            await Library.seed(teacher.id);
            a.close();
            UI.sheet({
              title: T('halaqahReady'),
              body: el('div.form', {},
                el('p.sheet-text', {}, T('halaqahCodeIs')),
                el('b.codebox-code', {}, teacher.code),
                el('p.hint', {}, T('halaqahCodeHint'))),
              actions: [{ label: T('done'), kind: 'primary', onClick: b => {
                b.close(); enter(teacher);
              } }]
            });
          } }
      ]
    });
  }

  /* قائمة المعلّمين وحدهم — وهم قلّة معروفة. */
  async function showTeachers(host) {
    U.clear(host);
    const teachers = await Users.teachers();

    host.appendChild(el('button.gate-back', {
      type: 'button', onclick: () => showLogin(host)
    }, UI.icon('forward', 16), el('span', {}, T('back'))));

    if (!teachers.length) {
      host.appendChild(UI.empty('لا يوجد حساب معلّم'));
      return;
    }
    host.appendChild(el('p.gate-question', {}, T('teacherEntry')));
    const grid = el('div.gate-users');
    teachers.forEach(u => {
      grid.appendChild(el('button.usercard', { type: 'button', onclick: () => askPin(u) },
        UI.avatar(u, 52), el('b', {}, u.name)));
    });
    host.appendChild(grid);
  }

  /* ══════════════════ Google ════════════════════════════ */
  let googleLoaded = null;
  function loadGoogle() {
    if (googleLoaded) return googleLoaded;
    googleLoaded = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = CONFIG.auth.googleScript;
      s.async = true; s.defer = true;
      s.onload = res; s.onerror = () => rej(new Error('google script'));
      document.head.appendChild(s);
    });
    return googleLoaded;
  }

  async function mountGoogle(host) {
    try {
      await loadGoogle();
      if (!window.google || !google.accounts || !google.accounts.id) throw new Error('no gsi');
      google.accounts.id.initialize({
        client_id: CONFIG.auth.googleClientId,
        callback: onGoogleCredential
      });
      google.accounts.id.renderButton(host, {
        theme: 'filled_black', size: 'large', shape: 'pill',
        text: 'signin_with', locale: 'ar', width: 260
      });
    } catch (e) {
      host.appendChild(el('p.hint.hint--warn', {}, T('googleUnavailable')));
    }
  }

  /* الرمز يُقرأ ولا يُتحقّق منه — لا خادم هنا. راجع README. */
  function decodeJwt(token) {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(part).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  async function onGoogleCredential(response) {
    const claims = decodeJwt(response && response.credential);
    if (!claims) return UI.toast(T('googleFailed'), 'warn');

    let user = await Users.byGoogle(claims.sub, claims.email);

    if (!user) {
      if (CONFIG.auth.allowSelfSignup) return signUpSheet(claims);
      UI.sheet({
        title: T('googleNotLinked'),
        body: el('div.form', {},
          el('p.sheet-text', {}, T('googleNotLinkedBody', claims.email || '')),
          el('p.hint', {}, T('googleAskTeacher'))),
        actions: [{ label: T('close'), kind: 'ghost' }]
      });
      return;
    }
    /* أول دخول ناجح يثبّت المعرّف حتى لو تغيّر البريد لاحقًا. */
    if (!user.googleSub) {
      await Users.update(user.id, { googleSub: claims.sub, googleEmail: claims.email });
    }
    enter(user);
  }

  /* ── التسجيل ببريد الطالب نفسه ────────────────────────
     يملأ البرنامج الاسم والصورة من حساب جوجل، ولا يبقى على
     الطالب إلا أن يختار مستواه.                              */
  async function signUpSheet(claims) {
    let name = (claims.name || '').trim();
    let level = PROGRAM.defaultLevel;
    let halaqah = '';

    const body = el('div.form');

    body.appendChild(el('div.signup-id', {},
      claims.picture
        ? el('img.signup-photo', { src: claims.picture, alt: '', referrerpolicy: 'no-referrer' })
        : null,
      el('div', {},
        el('b', {}, name || claims.email),
        el('small', { dir: 'ltr' }, claims.email || ''))));

    const nameIn = UI.input({ value: name, placeholder: 'اسمك الكامل' });
    nameIn.addEventListener('input', () => { name = nameIn.value; });
    body.appendChild(UI.field(T('myName'), nameIn));

    body.appendChild(UI.field(T('chooseLevel'), UI.chips(
      PROGRAM.levels.map(l => ({ value: l.id, label: `${l.name} — ${l.sub}` })),
      level, v => { level = +v; }), T('levelHint')));

    /* رمز الحلقة يحدّد معلّمه — ولا ينضمّ إلى حلقة بغير رمزها. */
    const halaqahIn = UI.input({
      placeholder: 'K7M2Q', autocapitalize: 'characters', spellcheck: 'false'
    });
    halaqahIn.addEventListener('input', () => {
      halaqahIn.value = halaqahIn.value.toUpperCase().replace(/\s/g, '');
      halaqah = halaqahIn.value;
    });
    body.appendChild(UI.field(T('halaqahCode'), halaqahIn, T('halaqahCodeAsk')));

    UI.sheet({
      title: T('signUp'), body, wide: true, dismissable: false,
      actions: [
        { label: T('cancel'), kind: 'ghost' },
        { label: T('createAccount'), kind: 'primary', onClick: async a => {
            if (!name.trim()) return UI.toast('اكتب اسمك', 'warn');

            const teacher = await Users.byCode(halaqah);
            if (!teacher || teacher.role !== 'teacher') {
              return UI.toast(T('halaqahNotFound'), 'warn');
            }

            const created = await Users.create({
              name, role: 'student', pin: '',
              teacherId: teacher.id,
              googleSub: claims.sub, googleEmail: claims.email,
              level,
              photo: await fetchPhoto(claims.picture)
            });
            await Users.update(created.id, { selfSignup: true });
            a.close();
            UI.toast(T('welcomeNew', created.name));
            enter(created);
          } }
      ]
    });
  }

  /* صورة جوجل تُنزَّل وتُصغَّر لتبقى مع الحساب بلا إنترنت. */
  async function fetchPhoto(url) {
    if (!url) return null;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await Photo.fromFile(new File([blob], 'g.jpg', { type: blob.type || 'image/jpeg' }));
    } catch (e) { return null; }
  }

  /* ══════════════════ اختيار من قائمة (اختياري) ═════════ */
  async function showRoles(host) {
    U.clear(host);
    const teachers = await Users.teachers();
    const students = await Users.students();

    host.appendChild(el('p.gate-question', {}, T('chooseRole')));
    host.appendChild(el('div.gate-roles', {},
      roleCard('teacher', T('teacher'), 'users', teachers.length, () => showUsers(host, 'teacher')),
      roleCard('student', T('student'), 'book', students.length, () => showUsers(host, 'student'))));
  }

  function roleCard(role, label, iconName, count, onClick) {
    return el('button.rolecard.rolecard--' + role, { type: 'button', onclick: onClick },
      el('span.rolecard-icon', {}, UI.icon(iconName, 30)),
      el('b', {}, label),
      el('small', {}, count ? U.num(count) + ' حساب' : 'لا يوجد حساب'));
  }

  async function showUsers(host, role) {
    U.clear(host);
    const list = role === 'teacher' ? await Users.teachers() : await Users.students();

    host.appendChild(el('button.gate-back', { type: 'button', onclick: () => showRoles(host) },
      UI.icon('forward', 16), el('span', {}, T('back'))));

    if (!list.length) { host.appendChild(UI.empty(T('noStudentsYet'))); return; }

    host.appendChild(el('p.gate-question', {}, T('chooseProfile')));
    const grid = el('div.gate-users');
    list.forEach(u => {
      grid.appendChild(el('button.usercard', { type: 'button', onclick: () => askPin(u) },
        UI.avatar(u, 52),
        el('b', {}, u.name),
        el('small', {}, u.lastActiveAt
          ? U.relativeDay(U.dateKey(new Date(u.lastActiveAt))) : T('never'))));
    });
    host.appendChild(grid);
  }

  /* ══════════════════ الرمز السرّي ══════════════════════ */
  function askPin(user) {
    if (!user.pin) return enter(user);

    let value = '';
    const dots = el('div.pin-dots');
    const err = el('p.pin-error');

    const paint = () => {
      U.clear(dots);
      for (let i = 0; i < 4; i++) dots.appendChild(el('i.pin-dot' + (i < value.length ? '.on' : '')));
    };
    paint();

    const pad = el('div.pin-pad');
    const press = d => {
      if (value.length >= 4) return;
      value += d; paint();
      if (value.length === 4) setTimeout(check, 140);
    };
    [1,2,3,4,5,6,7,8,9].forEach(n =>
      pad.appendChild(el('button.pin-key', { type: 'button', onclick: () => press(String(n)) }, U.num(n))));
    pad.appendChild(el('span'));
    pad.appendChild(el('button.pin-key', { type: 'button', onclick: () => press('0') }, U.num(0)));
    pad.appendChild(el('button.pin-key.pin-key--del', {
      type: 'button', onclick: () => { value = value.slice(0, -1); paint(); err.textContent = ''; }
    }, UI.icon('back', 20)));

    const dialog = UI.sheet({
      title: user.name,
      body: el('div.pin', {}, el('p.pin-hint', {}, T('enterPin')), dots, err, pad)
    });

    function check() {
      if (value === user.pin) { dialog.close(); enter(user); }
      else {
        err.textContent = T('wrongPin');
        dots.classList.add('shake');
        setTimeout(() => { dots.classList.remove('shake'); value = ''; paint(); }, 420);
      }
    }
  }

  async function enter(user) {
    await Session.login(user);
    document.body.dataset.role = user.role;
    Router.go(user.role === 'teacher' ? '/t/students' : '/home', { replace: true });
  }

  window.AuthView = { askPin, enter };
})();
