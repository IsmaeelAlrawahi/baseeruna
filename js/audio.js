/* ============================================================
   بصائرنا — audio player

   One <audio> element for the whole app, driven by a queue and
   wired to the Media Session API so playback keeps going with the
   screen off and shows proper lock-screen controls.

   For background playback to work reliably the program must be
   installed to the home screen and served over https.
   ============================================================ */

window.Player = (function () {

  const audio = document.getElementById('audio-el');
  const listeners = new Set();

  let queue = [];
  let index = -1;
  let repeat = 'off';          /* 'off' | 'one' | 'all' */
  let objectUrl = null;        /* revoked when we move on */
  let sleepTimerId = null;
  let sleepEndsAt = null;
  let sleepAtEnd = false;

  const state = {
    get track()    { return queue[index] || null; },
    get playing()  { return !audio.paused && !audio.ended && audio.readyState > 2; },
    get current()  { return audio.currentTime || 0; },
    get duration() { return isFinite(audio.duration) ? audio.duration : 0; },
    get rate()     { return audio.playbackRate; },
    get repeat()   { return repeat; },
    get queue()    { return queue.slice(); },
    get index()    { return index; },
    get sleepEndsAt() { return sleepEndsAt; },
    get sleepAtEnd()  { return sleepAtEnd; },
    get volume()   { return audio.volume; }
  };

  /* ── events ───────────────────────────────────────────── */
  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit(type, data) {
    listeners.forEach(fn => { try { fn(type, data, state); } catch (e) { console.error(e); } });
  }

  ['play','pause','ended','timeupdate','loadedmetadata','waiting','playing','ratechange','error']
    .forEach(ev => audio.addEventListener(ev, () => {
      if (ev === 'ended') return onEnded();
      if (ev === 'error') return onError();
      if (ev === 'loadedmetadata') updatePositionState();
      if (ev === 'play' || ev === 'pause') updateSessionPlayback();
      emit(ev);
    }));

  function onError() {
    if (!state.track) return;
    console.warn('[بصائرنا] تعذّر تشغيل المقطع', state.track.title, audio.error);
    emit('error', audio.error);
  }

  function onEnded() {
    emit('ended');
    /* «عند انتهاء المقطع»: يقف هنا ولا ينتقل لما بعده. */
    if (sleepAtEnd) { sleepAtEnd = false; audio.pause(); emit('sleep'); return; }
    if (repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    if (index < queue.length - 1) { skip(1); return; }
    if (repeat === 'all' && queue.length) { playAt(0); return; }
    emit('queueend');
  }

  /* ── source resolution ───────────────────────────────── */
  async function srcFor(track) {
    if (track.blob) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(track.blob);
      return objectUrl;
    }
    return track.url;
  }

  /* ── controls ─────────────────────────────────────────── */
  async function setQueue(tracks, startAt = 0, autoplay = true) {
    queue = (tracks || []).slice();
    index = -1;
    if (queue.length) await playAt(startAt, autoplay);
    else { audio.pause(); audio.removeAttribute('src'); emit('queue'); }
  }

  async function playAt(i, autoplay = true) {
    if (i < 0 || i >= queue.length) return;
    index = i;
    const track = queue[i];
    audio.src = await srcFor(track);
    audio.load();
    updateSession(track);
    emit('track', track);
    if (autoplay) {
      try { await audio.play(); }
      catch (e) { emit('blocked', e); }   /* browser wants a tap first */
    }
  }

  async function playTrack(track, { queue: q } = {}) {
    if (q && q.length) {
      const at = Math.max(0, q.findIndex(t => t.id === track.id));
      return setQueue(q, at, true);
    }
    return setQueue([track], 0, true);
  }

  function toggle() {
    if (!state.track) return;
    if (audio.paused) audio.play().catch(e => emit('blocked', e));
    else audio.pause();
  }

  const play  = () => audio.play().catch(e => emit('blocked', e));
  const pause = () => audio.pause();

  function stop() {
    audio.pause(); audio.currentTime = 0;
    queue = []; index = -1;
    audio.removeAttribute('src');
    clearSleepTimer();
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    emit('stop');
  }

  function skip(delta) {
    const next = index + delta;
    if (next >= 0 && next < queue.length) playAt(next);
    else if (repeat === 'all' && queue.length) playAt((next + queue.length) % queue.length);
  }

  function seek(sec) {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = U.clamp(sec, 0, audio.duration);
    updatePositionState();
    emit('timeupdate');
  }
  const nudge = d => seek(audio.currentTime + d);

  function setRate(r) { audio.playbackRate = r; emit('ratechange'); }
  function setVolume(v) { audio.volume = U.clamp(v, 0, 1); emit('volume'); }

  function cycleRepeat() {
    repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
    emit('repeat', repeat);
    return repeat;
  }
  function setRepeat(mode) { repeat = mode; emit('repeat', repeat); }

  /* ── sleep timer ──────────────────────────────────────── */
  function setSleepTimer(minutes) {
    clearSleepTimer();
    if (!minutes) return;
    sleepEndsAt = Date.now() + minutes * 60000;
    sleepTimerId = setTimeout(() => {
      /* Fade out rather than cutting off mid-ayah. */
      const startVol = audio.volume;
      let step = 0;
      const fade = setInterval(() => {
        step++;
        audio.volume = Math.max(0, startVol * (1 - step / 20));
        if (step >= 20) {
          clearInterval(fade); audio.pause();
          audio.volume = startVol; sleepEndsAt = null; emit('sleep');
        }
      }, 150);
    }, minutes * 60000);
    emit('sleep');
  }
  function clearSleepTimer() {
    if (sleepTimerId) clearTimeout(sleepTimerId);
    sleepTimerId = null; sleepEndsAt = null; sleepAtEnd = false; emit('sleep');
  }

  /* يتوقّف عند انتهاء المقطع الجاري، بلا مؤقّت بالدقائق. */
  function setSleepAtTrackEnd() {
    clearSleepTimer();
    sleepAtEnd = true;
    emit('sleep');
  }

  /* ── Media Session (lock screen / notification) ───────── */
  function updateSession(track) {
    if (!('mediaSession' in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || '',
        artist: track.reciter || CONFIG.app.name,
        album: CONFIG.app.fullName,
        artwork: [
          { src: 'assets/logo.jpeg', sizes: '512x512', type: 'image/jpeg' },
          { src: 'assets/icon.svg',  sizes: 'any',     type: 'image/svg+xml' }
        ]
      });
    } catch (e) { /* older browsers */ }
  }

  function updateSessionPlayback() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
    updatePositionState();
  }

  function updatePositionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: U.clamp(audio.currentTime, 0, audio.duration)
      });
    } catch (e) {}
  }

  function bindSessionActions() {
    if (!('mediaSession' in navigator)) return;
    const set = (action, handler) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) {}
    };
    set('play',  play);
    set('pause', pause);
    set('stop',  stop);
    set('previoustrack', () => (audio.currentTime > 3 ? seek(0) : skip(-1)));
    set('nexttrack',     () => skip(1));
    set('seekbackward',  d => nudge(-(d && d.seekOffset || CONFIG.audio.seekStep)));
    set('seekforward',   d => nudge(  d && d.seekOffset || CONFIG.audio.seekStep));
    set('seekto',        d => { if (d && d.seekTime != null) seek(d.seekTime); });
  }

  /* ── resume where the student left off ────────────────── */
  const remember = U.debounce(() => {
    if (!state.track) return;
    DB.setting('lastPlayback', {
      trackId: state.track.id, position: audio.currentTime,
      title: state.track.title, at: Date.now()
    });
  }, 2000);
  audio.addEventListener('timeupdate', remember);

  async function init() {
    bindSessionActions();
    audio.preload = 'metadata';
    const savedRate = await DB.setting('playbackRate');
    if (savedRate) audio.playbackRate = savedRate;
    const savedRepeat = await DB.setting('repeatMode');
    if (savedRepeat) repeat = savedRepeat;

    on(type => {
      if (type === 'ratechange') DB.setting('playbackRate', audio.playbackRate);
      if (type === 'repeat')     DB.setting('repeatMode', repeat);
    });

    /* Keep the lock-screen scrubber honest while playing. */
    setInterval(() => { if (!audio.paused) updatePositionState(); }, 4000);
  }

  return {
    init, on, state, audio,
    setQueue, playTrack, playAt, play, pause, toggle, stop, skip, seek, nudge,
    setRate, setVolume, cycleRepeat, setRepeat,
    setSleepTimer, setSleepAtTrackEnd, clearSleepTimer
  };
})();
