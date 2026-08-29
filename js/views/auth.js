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
      const rawCode = String(codeIn.value || '').trim().toUpperCase().replace(/\s/g, '');
      if (!rawCode) { err.textContent = T('codeNotFound'); return; }
      err.textContent = 'جارٍ التحقق...';
      let user = await Users.byCode(rawCode);

      /* لو لم نجده محليًا، نبحث في السحابة (لأن المعلم أنشأ
         الحساب على جهازه وليس على هذا الجهاز). إن وُجد نحفظه
         محليًا هنا حتى يعمل البرنامج كاملًا في وضع عدم الاتصال. */
      if (!user && window.SupabaseClient && window.SupabaseClient.isConfigured) {
        try {
          const cloud = await window.SupabaseClient.getUserByCode(rawCode);
          if (cloud) {
            const local = {
              id: cloud.id,
              role: cloud.role || 'student',
              name: cloud.name || '',
              pin: cloud.pin != null ? String(cloud.pin) : '',
              code: cloud.code || null,
              googleSub: cloud.googleSub || null,
              googleEmail: cloud.googleEmail || null,
              level: cloud.level != null ? cloud.level : 1,
              photo: null,
              selfSignup: !!cloud.selfSignup,
              teacherId: cloud.teacherId || null,
              color: cloud.color || null,
              createdAt: cloud.createdAt || Date.now(),
              lastActiveAt: null,
              archived: !!cloud.archived
            };
            await DB.put('users', local);
            user = local;
          }
        } catch (e) {
          console.error('[بصائرنا] تعذّر البحث في السحابة', e);
          err.textContent = 'تعذّر الاتصال بالسحابة: ' + (e.message || 'تحقق من الإنترنت');
          return;
        }
      } else if (!user && window.SupabaseClient && !window.SupabaseClient.isConfigured) {
        err.textContent = 'السحابة غير مهيأة — لا يمكن البحث عن الكود من هذا الجهاز';
        return;
      }

      if (!user) { err.textContent = T('codeNotFound') + ' (' + rawCode + ')'; return; }
      err.textContent = '';
      if (user.archived) { err.textContent = 'الحساب مؤرشف'; return; }
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

  /* قائمة المعلّمين وحدهم — وهم قلّة معروفة.
     نسحبهم من المحلي أيضًا ومن السحابة (حتى يجد المعلّم
     حسابه إذا فتح التطبيق من جهازٍ لم يسجّل عليه من قبل). */
  async function showTeachers(host) {
    U.clear(host);
    let teachers = await Users.teachers();

    if (window.SupabaseClient && window.SupabaseClient.isConfigured) {
      try {
        const cloud = await window.SupabaseClient.getAllTeachers();
        const localIds = new Set(teachers.map(t => t.id));
        for (const t of cloud || []) {
          if (!localIds.has(t.id)) {
            const local = {
              id: t.id, role: 'teacher', name: t.name || '',
              pin: t.pin != null ? String(t.pin) : '',
              code: t.code || null,
              googleSub: t.googleSub || null,
              googleEmail: t.googleEmail || null,
              level: t.level != null ? t.level : 1,
              photo: null, selfSignup: !!t.selfSignup,
              teacherId: t.teacherId || null,
              color: t.color || null,
              createdAt: t.createdAt || Date.now(),
              lastActiveAt: null, archived: !!t.archived
            };
            await DB.put('users', local);
            teachers.push(local);
          }
        }
      } catch (e) {
        console.warn('[بصائرنا] تعذّر جلب المعلمين من السحابة', e);
      }
    }

    host.appendChild(el('button.gate-back', {
      type: 'button', onclick: () => showLogin(host)
    }, UI.icon('forward', 16), el('span', {}, T('back'))));

    if (teachers.length) {
      host.appendChild(el('p.gate-question', {}, T('teacherEntry')));
      const grid = el('div.gate-users');
      teachers.forEach(u => {
        grid.appendChild(el('button.usercard', { type: 'button', onclick: () => askPin(u) },
          UI.avatar(u, 52), el('b', {}, u.name)));
      });
      host.appendChild(grid);
    }

    /* ── دخول معلّم من أي جهاز برمز حلقته ────────────────
       يبحث في السحابة عن المعلّم صاحب الرمز، يخزّنه محليًا
       ثم يطلب الرقم السري. يَعمَل حتى لو لم يكن محفوظًا على
       هذا الجهاز من قبل. */
    const hint = el('p.hint', {}, 'أدخل رمز حلقتك للدخول من هذا الجهاز');
    const codeIn = UI.input({ placeholder: T('codePlaceholder'), autocapitalize: 'characters' });
    codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/\s/g, ''); });
    host.appendChild(el('div.form', {},
      hint, UI.field(T('loginCode'), codeIn),
      UI.button('دخول برمز الحلقة', async () => {
        if (!window.SupabaseClient?.isConfigured) return UI.toast('السحابة غير مهيأة — فعّل Supabase', 'warn');
        const raw = String(codeIn.value || '').trim().toUpperCase().replace(/\s/g, '');
        if (!raw) return UI.toast('اكتب رمز حلقتك أولًا', 'warn');
        UI.toast('جارٍ البحث عن ' + raw + '...', 'info');
        let found;
        try { found = await window.SupabaseClient.getUserByCode(raw); }
        catch (e) { return UI.toast('تعذّر الاتصال بالسحابة: ' + (e.message || 'تحقق من النت'), 'warn'); }
        if (!found || found.role !== 'teacher') {
          return UI.toast('لا يوجد معلّم بهذا الرمز (' + raw + ') — تأكد من الحروف', 'warn');
        }
        /* احفظه محليًا ليظهر في القائمة من الآن. */
        const existing = await Users.byId(found.id);
        if (!existing) {
          await DB.put('users', {
            id: found.id, role: 'teacher', name: found.name || '',
            pin: found.pin != null ? String(found.pin) : '', code: found.code || null,
            googleSub: found.googleSub || null, googleEmail: found.googleEmail || null,
            level: found.level != null ? found.level : 1, photo: null,
            selfSignup: !!found.selfSignup, teacherId: found.teacherId || null,
            color: found.color || null, createdAt: found.createdAt || Date.now(),
            lastActiveAt: null, archived: !!found.archived
          });
        }
        askPin((await Users.byId(found.id)) || found);
      }, 'primary', { icon: 'forward' })));
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

            let teacher = await Users.byCode(halaqah);
            if ((!teacher || teacher.role !== 'teacher') && window.SupabaseClient?.isConfigured) {
              try {
                const cloud = await window.SupabaseClient.getUserByCode(halaqah);
                if (cloud && cloud.role === 'teacher') {
                  if (!await Users.byId(cloud.id)) {
                    await DB.put('users', { id: cloud.id, role: 'teacher', name: cloud.name || '', pin: cloud.pin || '', code: cloud.code, googleSub: cloud.googleSub || null, googleEmail: cloud.googleEmail || null, level: cloud.level || 1, photo: null, selfSignup: !!cloud.selfSignup, teacherId: cloud.teacherId || null, color: cloud.color || null, createdAt: cloud.createdAt || Date.now(), lastActiveAt: null, archived: !!cloud.archived });
                  }
                  teacher = await Users.byCode(halaqah);
                }
              } catch (e) { /* تجاهل */ }
            }
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
    if (user.archived) { UI.toast('الحساب مؤرشف', 'warn'); return; }
    // الطالب على جهاز جديد: اسحب تقاريره من السحابة قبل الدخول
    if (user.role === 'student' && window.SupabaseClient && window.SupabaseClient.isConfigured) {
      try {
        const cloud = await window.SupabaseClient.getReportsForUsers([user.id]) || [];
        for (const cr of cloud) {
          const local = { id: cr.id, userId: cr.userId, date: cr.date, userDate: cr.userDate || (cr.userId + '|' + cr.date), quran: cr.quran || {}, poetry: cr.poetry || {}, reading: cr.reading || {}, qiyam: !!cr.qiyam, note: cr.note || '', teacherNote: cr.teacherNote || '', submitted: !!cr.submitted, submittedAt: cr.submittedAt || null, teacherSeen: !!cr.teacherSeen, updatedAt: cr.updatedAt || Date.now(), createdAt: cr.createdAt || Date.now() };
          const existing = await DB.get('reports', local.id);
          if (!existing || (existing.updatedAt || 0) <= (local.updatedAt || 0)) await DB.put('reports', local);
        }
      } catch (e) { console.warn('[بصائرنا] تعذّر سحب تقارير الطالب', e); }
    }
    if (user.role === 'teacher' && window.SupabaseClient && window.SupabaseClient.isConfigured) {
      try {
        /* مزامنة-عند-الدخول: نرفع سجل المعلّم نفسه للسحابة حتى
           يكون معرّفًا على كل الأجهزة (يغيّر أي معلّم قديم). */
        await window.SupabaseClient.upsertUser(user);

        /* اسحب كل طلابه من السحابة وادمجهم محليًا حتى يرى
           المعلّم حلقته كاملة حتى لو فتح من جهاز جديد. */
        const cloudStudents = await window.SupabaseClient.getUsersByTeacher(user.id);
        const existing = await Users.all();
        const have = new Set(existing.map(u => u.id));
        let added = 0;
        for (const s of cloudStudents || []) {
          if (s.role !== 'student' || have.has(s.id)) continue;
          const local = {
            id: s.id, role: 'student', name: s.name || '',
            pin: s.pin != null ? String(s.pin) : '',
            code: s.code || null, googleSub: s.googleSub || null,
            googleEmail: s.googleEmail || null,
            level: s.level != null ? s.level : 1,
            photo: null, selfSignup: !!s.selfSignup,
            teacherId: s.teacherId || user.id, color: s.color || null,
            createdAt: s.createdAt || Date.now(), lastActiveAt: null,
            archived: !!s.archived
          };
          await DB.put('users', local);
          added++;
        }
        if (added) console.info('[بصائرنا] دُمج ' + added + ' طالب من السحابة');

        /* اسحب كل تقارير طلاب الحلقة من السحابة وأدمجها في
           الذاكرة المحلية، حتى تعمل كل شاشات المعلّم (صندوق
           الوارد، تقارير اليوم، صفحة الطالب) بشكل صحيح حتى لو
           أرسل الطالب من جهازٍ آخر. */
        const allStudents = await Users.students(user.id);
        const ids = allStudents.map(s => s.id);
        const cloudReports = await window.SupabaseClient.getReportsForUsers(ids);
        let repCount = 0;
        for (const cr of cloudReports || []) {
          try {
            const local = {
              id: cr.id,
              userId: cr.userId,
              date: cr.date,
              userDate: cr.userDate || (cr.userId + '|' + cr.date),
              quran: cr.quran || {},
              poetry: cr.poetry || {},
              reading: cr.reading || {},
              qiyam: !!cr.qiyam,
              note: cr.note || '',
              teacherNote: cr.teacherNote || '',
              submitted: !!cr.submitted,
              submittedAt: cr.submittedAt || null,
              teacherSeen: !!cr.teacherSeen,
              updatedAt: cr.updatedAt || Date.now(),
              createdAt: cr.createdAt || Date.now()
            };
            /* لا نستبدل نسخة أحدث محلية إن وُجدت. */
            const existing = await DB.get('reports', local.id);
            if (!existing || (existing.updatedAt || 0) <= (local.updatedAt || 0)) {
              await DB.put('reports', local);
              repCount++;
            }
          } catch (e) { /* تجاهل أي سجل مفرد معطوب */ }
        }
        if (repCount) console.info('[بصائرنا] مُزج ' + repCount + ' تقرير من السحابة');
      } catch (e) {
        console.warn('[بصائرنا] تعذّر مزامنة بيانات المعلّم/الحلقة', e);
      }
    }

    await Session.login(user);
    document.body.dataset.role = user.role;
    Router.go(user.role === 'teacher' ? '/t/students' : '/home', { replace: true });
  }

  window.AuthView = { askPin, enter };
})();
