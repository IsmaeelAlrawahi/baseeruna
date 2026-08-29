/* ============================================================
   بصائرنا — listening: online recitations, the student's own
   uploads, offline saving, and the player bar.
   ============================================================ */

(function () {
  const { el } = U;

  Router.register('/listen', {
    role: 'student',
    title: () => T('tabListen'),
    render: renderListen
  });

  /* Teachers get the same library, from their own tab bar. */
  Router.register('/t/listen', {
    role: 'teacher', back: true,
    title: () => T('tabListen'),
    render: renderListen
  });

  async function renderListen() {
    const me = Session.user;
    const page = UI.screen(null, 'page--listen');

    const reciters = await Reciters.all();
    let reciterId = await DB.setting('reciter');
    if (!reciters.some(r => r.id === reciterId)) {
      reciterId = reciters.length ? reciters[0].id : null;
    }
    /* Even with nothing to show, open on the recitations tab — the
       empty state there explains why it is empty and points at
       uploads, which landing straight on uploads would not. */
    let tab = 'online';
    let query = '';

    const head = el('div.listen-head');
    const listHost = el('div.listen-list');

    page.append(head, listHost);

    function paintHead() {
      U.clear(head);

      head.appendChild(UI.chips([
        { value: 'online', label: T('onlineRecitations') },
        { value: 'mine',   label: T('myUploads') }
      ], tab, v => { tab = v; paintHead(); paintList(); }));

      if (tab === 'online') {
        if (!reciters.length) {
          head.appendChild(UI.empty(
            Session.isTeacher ? T('noReciters') : T('noRecitersStudent'),
            Session.isTeacher
              ? UI.button(T('addReciter'), () => Router.go('/t/reciters'), 'primary', { icon: 'plus' })
              : null));
          return;
        }

        head.appendChild(UI.field(T('reciter'), UI.select(
          reciters.map(r => ({ value: r.id, label: r.name })),
          reciterId, async v => { reciterId = v; await DB.setting('reciter', v); paintList(); })));

        if (Session.isTeacher) {
          head.appendChild(UI.button(T('manageReciters'),
            () => Router.go('/t/reciters'), 'ghost', { icon: 'gear' }));
        }

        const search = UI.input({ type: 'search', placeholder: T('search') + ' — اسم السورة أو رقمها' });
        search.addEventListener('input', U.debounce(() => { query = search.value; paintList(); }, 180));
        head.appendChild(search);
      } else {
        const picker = el('input', {
          type: 'file', accept: 'audio/*', multiple: true, hidden: true,
          onchange: async ev => {
            const files = Array.from(ev.target.files || []);
            if (!files.length) return;
            for (const f of files) {
              await Tracks.addUpload({ userId: me.id, file: f, shared: Session.isTeacher });
            }
            UI.toast(`أُضيف ${U.num(files.length)} ملف`);
            ev.target.value = '';
            paintList();
          }
        });
        head.append(
          UI.button(T('uploadAudio'), () => picker.click(), 'primary', { icon: 'upload' }),
          picker,
          el('p.hint', {}, T('uploadHint')));
      }

      head.appendChild(el('p.hint.hint--soft', {}, T('backgroundHint')));
    }

    async function paintList() {
      U.clear(listHost);
      listHost.appendChild(UI.loading());

      if (tab === 'online') {
        const reciter = reciters.find(r => r.id === reciterId);
        if (!reciter) { U.clear(listHost); return; }

        const surahs = QURAN.search(query);
        const cached = await Tracks.forUser(me.id);
        const cachedUrls = new Set(cached.map(t => t.sourceUrl).filter(Boolean));

        /* ملفات المعلّم لهذا القارئ تسبق المكتبة. */
        const uploaded = await Reciters.filesOf(reciter.id);
        const bySurah = new Map(uploaded.filter(f => f.surah).map(f => [f.surah, f]));

        const queue = surahs.map(s => {
          const file = bySurah.get(s.no);
          if (file) return {
            id: file.id, title: s.fullName, reciter: reciter.name,
            surah: s.no, blob: file.blob, fromFile: true
          };
          return {
            id: 'on_' + reciterId + '_' + s.no,
            title: s.fullName, reciter: reciter.name, surah: s.no,
            url: Reciters.urlFor(reciter, s.no)
          };
        });

        U.clear(listHost);
        surahs.forEach((s, i) => {
          const track = queue[i];
          const isCached = track.fromFile || cachedUrls.has(track.url);
          listHost.appendChild(trackRow({
            number: s.no,
            title: s.name,
            sub: `${U.num(s.ayahs)} ${T('ayahs')} · ${s.revelation}` +
                 (track.fromFile ? ' · ' + T('fromUpload') : ''),
            trackId: track.id,
            onPlay: () => Player.playTrack(track, { queue }),
            actions: [
              track.fromFile
                ? UI.badge(T('fromUpload'), 'gold')
                : isCached
                ? UI.badge(T('offlineSaved'), 'ok')
                : UI.iconButton('down', async ev => {
                    const btn = ev.currentTarget;
                    btn.disabled = true; btn.classList.add('is-busy');
                    try {
                      await Tracks.cacheOnline({
                        userId: me.id, url: track.url, title: track.title,
                        reciter: track.reciter, surah: s.no
                      });
                      UI.toast(T('offlineSaved'));
                      paintList();
                    } catch (e) {
                      UI.toast(T('noConnection'), 'warn');
                      btn.disabled = false; btn.classList.remove('is-busy');
                    }
                  }, { label: T('downloadForOffline') })
            ]
          }));
        });

      } else {
        const mine = await Tracks.forUser(me.id);
        U.clear(listHost);
        if (!mine.length) {
          listHost.appendChild(UI.empty('لم ترفع أي ملف صوتي بعد'));
          return;
        }
        const queue = mine.map(t => ({
          id: t.id, title: t.title, reciter: t.reciter || T('myUploads'), blob: t.blob
        }));
        mine.forEach((t, i) => {
          listHost.appendChild(trackRow({
            number: i + 1,
            title: t.title,
            sub: [t.reciter, U.bytes(t.size), t.kind === 'offline' ? T('offlineSaved') : null]
              .filter(Boolean).join(' · '),
            trackId: t.id,
            onPlay: () => Player.playTrack(queue[i], { queue }),
            actions: [
              UI.iconButton('trash', async () => {
                if (!await UI.confirm(T('confirmDelete'), { danger: true })) return;
                await Tracks.remove(t.id); UI.toast(T('deleted')); paintList();
              }, { label: T('delete') })
            ]
          }));
        });
      }
    }

    paintHead();
    paintList();
    return page;
  }

  function trackRow({ number, title, sub, trackId, onPlay, actions }) {
    const playing = Player.state.track && Player.state.track.id === trackId;
    const row = el('article.track' + (playing ? '.is-playing' : ''), { dataset: { track: trackId } });
    row.append(
      el('button.track-main', { type: 'button', onclick: onPlay },
        el('span.track-no', {}, U.num(number)),
        el('span.track-text', {},
          el('b', {}, title),
          el('small', {}, sub || '')),
        el('span.track-play', {}, UI.icon(playing && Player.state.playing ? 'pause' : 'play', 18))),
      el('div.track-actions', {}, actions || []));
    return row;
  }

  /* ══════════════════ PLAYER BAR ════════════════════════ */
  const PlayerBar = (function () {
    const host = () => document.getElementById('miniplayer');

    function mount() {
      Player.on(type => {
        if (['track','play','pause','stop','queue','ended'].includes(type)) paint();
        if (type === 'timeupdate') tick();
        if (type === 'blocked') UI.toast('اضغط زر التشغيل للبدء', 'warn');
        if (type === 'error') UI.toast(T('noConnection'), 'warn');
      });
      paint();
    }

    let progressEl = null, timeEl = null;

    function tick() {
      if (progressEl && Player.state.duration) {
        progressEl.style.width =
          (Player.state.current / Player.state.duration * 100) + '%';
      }
      if (timeEl) timeEl.textContent = U.clockTime(Player.state.current);
    }

    function paint() {
      const bar = host();
      if (!bar) return;
      const t = Player.state.track;
      if (!t) { bar.hidden = true; U.clear(bar); return; }

      bar.hidden = false;
      U.clear(bar);

      const progress = el('i');
      progressEl = progress;
      bar.appendChild(el('div.mini-progress', {}, progress));

      bar.appendChild(el('button.mini-main', { type: 'button', onclick: openFull },
        el('span.mini-art', {}, UI.icon('book', 18)),
        el('span.mini-text', {},
          el('b', {}, t.title),
          el('small', {}, t.reciter || ''))));

      bar.appendChild(el('div.mini-controls', {},
        UI.iconButton('prev', () => Player.skip(-1), { label: 'السابق' }),
        UI.iconButton(Player.state.playing ? 'pause' : 'play', () => Player.toggle(),
          { label: Player.state.playing ? T('pause') : T('play') }),
        UI.iconButton('next', () => Player.skip(1), { label: 'التالي' })));

      tick();
      /* Keep the list row in sync with what's actually playing. */
      U.$$('.track').forEach(r => r.classList.toggle('is-playing', r.dataset.track === t.id));
    }

    function openFull() {
      const t = Player.state.track;
      if (!t) return;

      const body = el('div.player');
      const art = el('div.player-art', {}, el('img', { src: 'assets/logo.jpeg', alt: '' }));
      const title = el('h3.player-title', {}, t.title);
      const sub = el('p.player-sub', {}, t.reciter || '');

      const seek = el('input.seek', { type: 'range', min: 0, max: 1000, value: 0 });
      const cur = el('span.player-time', {}, '0:00');
      const dur = el('span.player-time', {}, '0:00');
      let scrubbing = false;

      seek.addEventListener('input', () => { scrubbing = true; });
      seek.addEventListener('change', () => {
        Player.seek(seek.value / 1000 * Player.state.duration);
        scrubbing = false;
      });

      const playBtn = UI.iconButton(Player.state.playing ? 'pause' : 'play',
        () => Player.toggle(), { label: T('play') });
      playBtn.classList.add('player-play');

      const repeatBtn = UI.iconButton('repeat', () => {
        Player.cycleRepeat(); paintExtras();
      }, { label: T('repeatOff') });

      const rateBtn = UI.button('×' + Player.state.rate, () => {
        const rates = CONFIG.audio.playbackRates;
        const next = rates[(rates.indexOf(Player.state.rate) + 1) % rates.length];
        Player.setRate(next); paintExtras();
      }, 'ghost');

      const sleepBtn = UI.iconButton('clock', openSleepSheet, { label: T('sleepTimer') });

      function openSleepSheet() {
        const body = el('div.form');
        let dialog = null;
        const close = () => dialog && dialog.close();

        const chips = el('div.chips');
        const add = (label, onPick) => chips.appendChild(
          el('button.chip', { type: 'button', onclick: () => { onPick(); paintExtras(); } }, label));

        add(T('timerOff'), () => {
          Player.clearSleepTimer(); UI.toast(T('timerCancelled')); close();
        });
        [5, 10, 15, 30, 45, 60].forEach(m => add(U.num(m) + ' دقيقة', () => {
          Player.setSleepTimer(m); UI.toast(T('timerSetFor', U.num(m))); close();
        }));
        add(T('timerEndOfTrack'), () => {
          Player.setSleepAtTrackEnd(); UI.toast(T('timerSetEnd')); close();
        });
        body.appendChild(chips);

        /* مدّة مخصّصة */
        const custom = UI.stepper(20, {
          step: 5, min: 1, max: 600, unit: 'دقيقة'
        });
        body.appendChild(UI.field(T('timerCustom'), custom, T('timerMinutes')));
        body.appendChild(UI.button(T('save'), () => {
          const m = custom.getValue();
          if (m > 0) { Player.setSleepTimer(m); UI.toast(T('timerSetFor', U.num(m))); }
          paintExtras(); close();
        }, 'primary', { icon: 'clock' }));

        dialog = UI.sheet({ title: T('sleepTimer'), body });
      }

      const extras = el('div.player-extras');
      function paintExtras() {
        U.clear(extras);
        const mode = { off: T('repeatOff'), one: T('repeatOne'), all: T('repeatAll') }[Player.state.repeat];
        repeatBtn.classList.toggle('is-active', Player.state.repeat !== 'off');
        rateBtn.querySelector('span').textContent = '×' + Player.state.rate;
        sleepBtn.classList.toggle('is-active',
          !!Player.state.sleepEndsAt || Player.state.sleepAtEnd);
        extras.append(repeatBtn, el('span.player-mode', {}, mode), rateBtn, sleepBtn);
      }
      paintExtras();

      body.append(art, title, sub,
        el('div.player-seek', {}, cur, seek, dur),
        el('div.player-controls', {},
          UI.iconButton('prev', () => Player.skip(-1), { label: 'السابق' }),
          UI.iconButton('back', () => Player.nudge(-CONFIG.audio.seekStep), { label: 'رجوع' }),
          playBtn,
          UI.iconButton('forward', () => Player.nudge(CONFIG.audio.seekStep), { label: 'تقدّم' }),
          UI.iconButton('next', () => Player.skip(1), { label: 'التالي' })),
        extras);

      const dialog = UI.sheet({ title: T('nowPlaying'), body, wide: true, onClose: () => off() });

      const off = Player.on(type => {
        if (type === 'timeupdate' || type === 'loadedmetadata') {
          if (!scrubbing && Player.state.duration) {
            seek.value = Player.state.current / Player.state.duration * 1000;
          }
          cur.textContent = U.clockTime(Player.state.current);
          dur.textContent = U.clockTime(Player.state.duration);
        }
        if (type === 'play' || type === 'pause') {
          playBtn.replaceChildren(UI.icon(Player.state.playing ? 'pause' : 'play'));
        }
        if (type === 'track') {
          title.textContent = Player.state.track.title;
          sub.textContent = Player.state.track.reciter || '';
        }
      });
    }

    return { mount, paint, openFull };
  })();

  window.PlayerBar = PlayerBar;
})();
