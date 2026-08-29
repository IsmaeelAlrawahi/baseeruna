/* ============================================================
   بصائرنا — voice note recorder

   Wraps MediaRecorder with a live level meter and a duration
   counter. The microphone needs a secure context: https, or
   localhost during development.
   ============================================================ */

window.Recorder = (function () {

  let stream = null;
  let recorder = null;
  let chunks = [];
  let startedAt = 0;
  let pausedTotal = 0;
  let pausedAt = 0;
  let audioCtx = null, analyser = null, rafId = null;
  let onTick = null;

  const supported = !!(navigator.mediaDevices &&
                       navigator.mediaDevices.getUserMedia &&
                       window.MediaRecorder);

  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    return CONFIG.voice.preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  function elapsed() {
    if (!startedAt) return 0;
    const end = pausedAt || Date.now();
    return Math.max(0, (end - startedAt - pausedTotal) / 1000);
  }

  /* onProgress({ seconds, level }) fires ~20×/sec while recording. */
  async function start(onProgress) {
    if (!supported) throw new Error(T('micUnsupported'));
    onTick = onProgress || null;

    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });

    const mimeType = pickMime();
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.start(250);

    startedAt = Date.now(); pausedTotal = 0; pausedAt = 0;
    startMeter();
    return true;
  }

  function startMeter() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
    } catch (e) { analyser = null; }

    const buf = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const loop = () => {
      let level = 0;
      if (analyser) {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
        level = Math.min(1, peak / 90);
      }
      const seconds = elapsed();
      if (onTick) onTick({ seconds, level, paused: !!pausedAt });
      if (seconds >= CONFIG.voice.maxSeconds) { stop(); return; }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    if (recorder && recorder.state === 'recording') {
      recorder.pause(); pausedAt = Date.now();
    }
  }
  function resume() {
    if (recorder && recorder.state === 'paused') {
      pausedTotal += Date.now() - pausedAt; pausedAt = 0; recorder.resume();
    }
  }

  /* Resolves to { blob, mime, duration } or null if nothing was captured. */
  function stop() {
    return new Promise(resolve => {
      if (!recorder || recorder.state === 'inactive') { cleanup(); return resolve(null); }
      const duration = elapsed();
      recorder.onstop = () => {
        const mime = recorder.mimeType || chunks[0] && chunks[0].type || 'audio/webm';
        const blob = new Blob(chunks, { type: mime });
        cleanup();
        resolve(blob.size ? { blob, mime, duration: +duration.toFixed(1) } : null);
      };
      try { recorder.stop(); } catch (e) { cleanup(); resolve(null); }
    });
  }

  function cancel() {
    try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (e) {}
    chunks = []; cleanup();
  }

  function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null; onTick = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; recorder = null;
    if (audioCtx && audioCtx.state !== 'closed') { try { audioCtx.close(); } catch (e) {} }
    audioCtx = null; analyser = null;
    startedAt = 0; pausedTotal = 0; pausedAt = 0;
  }

  /* Turns a getUserMedia rejection into something worth reading. */
  function explain(err) {
    if (!err) return T('micUnsupported');
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') return T('micDenied');
    if (err.name === 'NotFoundError') return 'لم يُعثر على ميكروفون في هذا الجهاز.';
    if (!window.isSecureContext) return 'التسجيل الصوتي يحتاج فتح البرنامج عبر رابط https.';
    return err.message || T('micUnsupported');
  }

  return {
    get supported() { return supported && (window.isSecureContext !== false); },
    get recording() { return !!recorder && recorder.state !== 'inactive'; },
    get paused()    { return !!recorder && recorder.state === 'paused'; },
    start, stop, pause, resume, cancel, elapsed, explain
  };
})();
