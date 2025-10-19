/**
 * 2-Minute Calm — Single visible player.
 * Intro plays invisibly first, then hands off to the weekly track (A/B rotation).
 * The user only ever sees the weekly track’s player/title/links.
 */
(function () {
  const MANIFEST_URL = '/data/2min-calm.json';
  const AUDIO_BASE   = '/audio/2min/';
  const TXT_BASE     = '/audio/2min/';
  const WEEK_STARTS_ON = 1; // Monday
  const STORAGE_KEY = 'calm:rotation:v2';

  const audioEl  = document.getElementById('calm-audio');   // visible (weekly)
  const introEl  = document.getElementById('calm-intro');   // hidden
  const playBtn  = document.getElementById('calm-play');

  const titleEl  = document.getElementById('calm-title');
  const dlEl     = document.getElementById('calm-download');
  const txtDlEl  = document.getElementById('calm-transcript');
  const toggle   = document.getElementById('calm-txt-toggle');
  const panel    = document.getElementById('calm-txt-panel');
  const content  = document.getElementById('calm-txt-content');

  if (!audioEl || !introEl || !playBtn || !titleEl) return;

  const qs = new URLSearchParams(location.search);

  function getSeason(d = new Date()) {
    const m = d.getMonth() + 1;
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'autumn';
    return 'winter';
  }

  function weekOfMonth(d = new Date(), weekStartsOn = WEEK_STARTS_ON) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const offset = (first.getDay() - weekStartsOn + 7) % 7;
    return Math.floor((d.getDate() + offset - 1) / 7);
  }

  function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }
  function setState(next) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function chooseVariant(variants, season, weekIdx) {
    const state = getState();
    const key = `${season}:w${weekIdx}`;
    const last = state[key] ?? -1;
    const next = (last + 1) % variants.length;
    state[key] = next;
    setState(state);
    return variants[next];
  }

  function setDownloadLinks(src, name, transcript) {
    if (dlEl) {
      dlEl.href = src;
      try { dlEl.setAttribute('download', name || src.split('/').pop()); } catch {}
    }
    if (txtDlEl) {
      if (transcript) {
        txtDlEl.href = TXT_BASE + transcript;
        txtDlEl.style.display = '';
      } else {
        txtDlEl.removeAttribute('href');
        txtDlEl.style.display = 'none';
      }
    }
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function loadTranscript(filename, title) {
    if (!content) return;
    if (!filename) {
      content.innerHTML = `<p class="meta">No transcript available.</p>`;
      return;
    }
    try {
      const res = await fetch(TXT_BASE + filename, { cache: 'no-store' });
      if (!res.ok) throw new Error('Transcript fetch failed');
      const text = await res.text();
      const safeTitle = title ? String(title) : 'Transcript';
      content.innerHTML =
        `<h3 class="sr-only">Transcript — ${safeTitle}</h3>` +
        `<pre>${escapeHtml(text)}</pre>`;
    } catch {
      content.innerHTML = `<p class="meta">Transcript couldn’t load. You can still use the “Transcript (download)” link above.</p>`;
    }
  }

  function primeWeeklyUI(track) {
    // From the user's perspective, everything references the WEEKLY track
    const mainSrc = AUDIO_BASE + track.file;
    titleEl.textContent = track.title || '2-Minute Calm';
    audioEl.src = mainSrc;                 // visible player is the weekly audio
    audioEl.setAttribute('aria-label', track.title || '2-Minute Calm');
    setDownloadLinks(mainSrc, track.file, track.transcript);
    loadTranscript(track.transcript, track.title);
    // Controls remain visible; a big Play overlay sits on top until clicked
  }

  // Transcript toggle
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      toggle.setAttribute('aria-expanded', String(next));
      toggle.textContent = next ? 'Hide transcript' : 'Show transcript';
      panel.hidden = !next;
      if (next) { panel.setAttribute('tabindex', '-1'); panel.focus({ preventScroll:false }); }
      else { panel.removeAttribute('tabindex'); }
    });
  }

  (async function init() {
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('Manifest fetch failed');
      const manifest = await res.json();

      const season = (qs.get('season') || getSeason()).toLowerCase();
      const weeks = manifest[season];
      if (!Array.isArray(weeks) || weeks.length === 0) throw new Error('No season data');

      let weekIdx = weekOfMonth();
      if (weekIdx > 3) weekIdx = weekIdx % 4;
      if (qs.has('week')) {
        const w = parseInt(qs.get('week'), 10);
        if (!isNaN(w)) weekIdx = Math.max(0, Math.min(3, w - 1));
      }

      const week = weeks[weekIdx];
      if (!week || !Array.isArray(week.variants) || week.variants.length === 0) throw new Error('No variants');

      const track = qs.has('variant')
        ? week.variants[Math.max(0, Math.min(week.variants.length - 1, parseInt(qs.get('variant'), 10) || 0))]
        : chooseVariant(week.variants, season, weekIdx + 1);

      // UI points to the weekly track (not the intro)
      primeWeeklyUI(track);

      // Preload hidden intro
      const introFile = manifest.intro || 'intro.mp3';
      introEl.src = AUDIO_BASE + introFile;

      // Orchestration: click Play overlay -> play intro (hidden) -> then hand off to visible weekly player
      playBtn.addEventListener('click', () => {
        playBtn.disabled = true;
        playBtn.textContent = '…';
        // Start the hidden intro
        const startIntro = () => introEl.play().catch(() => {
          // If blocked, fall back to letting the user press play on the visible player (skip intro)
          // But normally, the click counts as a gesture and this will succeed.
        });
        startIntro();

        // When intro finishes, play the visible weekly track seamlessly
        const onEnd = () => {
          introEl.removeEventListener('ended', onEnd);
          playBtn.classList.add('is-hidden'); // reveal only the native controls
          audioEl.play().catch(() => { /* user can press play */ });
        };
        introEl.addEventListener('ended', onEnd, { once: true });
      }, { once: true });

    } catch (e) {
      // Hard fallback: show only the visible player with intro loaded
      const introSrc = AUDIO_BASE + 'intro.mp3';
      titleEl.textContent = '2-Minute Calm — Intro';
      audioEl.src = introSrc;
      setDownloadLinks(introSrc, 'intro.mp3', 'intro.txt');
      loadTranscript('intro.txt', 'Intro');
      playBtn.classList.add('is-hidden'); // let user use the native controls
    }
  })();
})();
