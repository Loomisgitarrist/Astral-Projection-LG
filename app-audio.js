/* ================================================================
   Astral Projection LG — Audio Player
   Three-layer player:
     - binaural (4 Hz theta) — loops, plays the whole session
     - voice  (Jessa Lynn guided induction) — single play, switchable EN/DE
     - drone  (ambient pad) — loops, optional layer

   Behavior:
     - Click play => all three start simultaneously (after first user gesture).
     - Volume sliders per layer.
     - Progress bar = voice track time (the bounded one).
     - Language switch swaps voice src in-place; if playing, preserves time.

   Note on precache:
     The SW precaches only the induction mp3s. The two looping layers use
     preload="none" so the browser doesn't fetch them on every page load;
     we manually call .load() the first time the user presses play.
   ================================================================ */

(() => {
  const el = (id) => document.getElementById(id);
  const root = el('ap');
  if (!root) return;

  const audioBin = el('ap-binaural');
  const audioVox = el('ap-voice');
  const audioDrone = el('ap-drone');

  const btnPlay = el('ap-play');
  const btnRestart = el('ap-restart');
  const iconPlay = btnPlay && btnPlay.querySelector('.ap-icon-play');
  const iconPause = btnPlay && btnPlay.querySelector('.ap-icon-pause');
  const prog = el('ap-progress');
  const progFill = el('ap-progress-fill');
  const time = el('ap-time');
  const loading = el('ap-loading');

  const volBin = el('ap-vol-binaural');
  const volVox = el('ap-vol-voice');
  const volDrone = el('ap-vol-drone');

  const langBtns = root.querySelectorAll('.ap-lang-btn');

  const VOICE_SRC = {
    en: 'audio/tracks/induction-en.mp3',
    de: 'audio/tracks/induction-de.mp3',
    it: 'audio/tracks/induction-it.mp3',
  };

  // Pick the default language from the page's <html lang="..."> attribute.
  // Falls back to EN if the lang attribute is missing or unknown.
  const pageLang = (document.documentElement.lang || 'en').toLowerCase();
  const defaultLang = VOICE_SRC[pageLang] ? pageLang : 'en';

  let currentLang = defaultLang;
  let isPlaying = false;
  let loopsLoaded = false;

  function applyVolumes() {
    audioBin.volume  = parseFloat(volBin.value);
    audioVox.volume  = parseFloat(volVox.value);
    audioDrone.volume = parseFloat(volDrone.value);
  }

  function fmt(sec) {
    if (!isFinite(sec)) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function tick() {
    const d = audioVox.duration || 0;
    const t = audioVox.currentTime || 0;
    time.textContent = `${fmt(t)} / ${fmt(d)}`;
    progFill.style.width = d ? `${(t / d) * 100}%` : '0%';
  }

  function setLang(lang, preserveTime = true) {
    if (lang === currentLang && audioVox.src.endsWith(VOICE_SRC[lang].split('?')[0])) return;
    const wasPlaying = isPlaying;
    const t = audioVox.currentTime;
    audioVox.pause();
    audioVox.src = VOICE_SRC[lang] + `?v=${Date.now()}`; // bypass any HTTP cache
    audioVox.load();
    audioVox.addEventListener('loadedmetadata', function once() {
      audioVox.removeEventListener('loadedmetadata', once);
      if (preserveTime && t > 0 && t < audioVox.duration) {
        audioVox.currentTime = Math.min(t, audioVox.duration - 1);
      }
      if (wasPlaying) audioVox.play().catch(() => {});
      loading.classList.remove('show');
    }, { once: true });

    currentLang = lang;
    langBtns.forEach(b => {
      const active = b.dataset.lang === lang;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  function ensureLoopsLoaded() {
    if (loopsLoaded) return;
    audioBin.load();
    audioDrone.load();
    loopsLoaded = true;
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    if (iconPlay && iconPause) {
      iconPlay.style.display = playing ? 'none' : '';
      iconPause.style.display = playing ? '' : 'none';
    }
    btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function play() {
    ensureLoopsLoaded();
    applyVolumes();
    audioBin.currentTime = 0;
    audioDrone.currentTime = 0;

    // If the voice track isn't ready yet, hold the play state until
    // 'canplay' fires (or 'loadeddata' as a fallback) so the user sees
    // a loading indicator instead of pressing a dead button.
    const ready = audioVox.readyState >= 3; // HAVE_FUTURE_DATA or better
    const showLoading = () => {
      root.classList.add('is-loading');
      loading.classList.add('show');
    };
    const hideLoading = () => {
      root.classList.remove('is-loading');
      loading.classList.remove('show');
    };

    if (!ready) {
      showLoading();
      const onReady = () => {
        audioVox.removeEventListener('canplay', onReady);
        audioVox.removeEventListener('loadeddata', onReady);
        hideLoading();
        Promise.allSettled([audioBin.play(), audioVox.play(), audioDrone.play()])
          .then(() => setPlayingState(true));
      };
      audioVox.addEventListener('canplay', onReady);
      audioVox.addEventListener('loadeddata', onReady);
      // Kick off the load (preload=metadata only downloads metadata+first chunk;
      // calling play() forces the browser to fetch the rest)
      audioVox.load();
      return;
    }

    Promise.allSettled([
      audioBin.play(),
      audioVox.play(),
      audioDrone.play(),
    ]).then(() => setPlayingState(true));
  }

  function pause() {
    audioBin.pause();
    audioVox.pause();
    audioDrone.pause();
    setPlayingState(false);
  }

  let playLock = false;
  function togglePlay() {
    if (playLock) return;
    playLock = true;
    setTimeout(() => { playLock = false; }, 600);
    if (isPlaying) pause(); else play();
  }

  btnPlay.addEventListener('click', togglePlay);
  btnRestart.addEventListener('click', () => {
    audioBin.currentTime = 0;
    audioVox.currentTime = 0;
    audioDrone.currentTime = 0;
    tick();
    if (!isPlaying) play();
  });

  prog.addEventListener('click', (e) => {
    const r = prog.getBoundingClientRect();
    const ratio = (e.clientX - r.left) / r.width;
    if (audioVox.duration) audioVox.currentTime = audioVox.duration * Math.max(0, Math.min(1, ratio));
  });

  volBin.addEventListener('input', applyVolumes);
  volVox.addEventListener('input', applyVolumes);
  volDrone.addEventListener('input', applyVolumes);

  langBtns.forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  audioVox.addEventListener('timeupdate', tick);
  audioVox.addEventListener('loadedmetadata', () => {
    loading.classList.remove('show');
    tick();
  });
  audioVox.addEventListener('ended', () => {
    setTimeout(() => {
      audioBin.pause();
      audioDrone.pause();
      setPlayingState(false);
    }, 800);
  });

  // Pause when page is hidden so audio doesn't autoplay in a hidden tab
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying) pause();
  });

  // Initial loading state: the voice track is being fetched on page
  // load (preload=auto). Show the loading indicator until ready, so
  // the user sees that the player is working, not dead.
  const initialReady = audioVox.readyState >= 3;
  if (!initialReady) {
    root.classList.add('is-loading');
    loading.classList.add('show');
  }
  audioVox.addEventListener('canplay', () => {
    root.classList.remove('is-loading');
    loading.classList.remove('show');
  }, { once: true });
  audioVox.addEventListener('loadeddata', () => {
    root.classList.remove('is-loading');
    loading.classList.remove('show');
  }, { once: true });

  applyVolumes();
  tick();
})();
