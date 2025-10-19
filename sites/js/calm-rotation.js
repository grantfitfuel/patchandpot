/**
 * 2-Minute Calm — Seasonal weekly rotation with A/B variants and no-repeat cycle.
 */
(function () {
  const MANIFEST_URL = '/data/2min-calm.json';
  const AUDIO_BASE   = '/audio/2min/';
  const TXT_BASE     = '/audio/2min/';
  const WEEK_STARTS_ON = 1; // Monday
  const STORAGE_KEY = 'calm:rotation:v2';

  const audioEl = document.getElementById('calm-audio');
  const titleEl = document.getElementById('calm-title');
  const dlEl    = document.getElementById('calm-download');
  const txtEl   = document.getElementById('calm-transcript');
  if (!audioEl || !titleEl) return;

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

  function setLinks(src, name, transcript) {
    if (dlEl) {
      dlEl.href = src;
      try { dlEl.setAttribute('download', name || src.split('/').pop()); } catch {}
    }
    if (txtEl) {
      if (transcript) {
        txtEl.href = TXT_BASE + transcript;
        txtEl.style.display = '';
      } else {
        txtEl.removeAttribute('href');
        txtEl.style.display = 'none';
      }
    }
  }

  function setTrack(track) {
    const src = AUDIO_BASE + track.file;
    titleEl.textContent = track.title || '2-Minute Calm';
    audioEl.src = src;
    audioEl.setAttribute('aria-label', track.title || '2-Minute Calm');
    setLinks(src, track.file, track.transcript);
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

  async function init() {
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('Manifest fetch failed');
      const manifest = await res.json();

      // Intro override
      if (qs.get('intro') === '1' && manifest.intro) {
        setTrack({ title: 'Welcome — 2-Minute Calm', file: manifest.intro, transcript: 'intro.txt' });
        return;
      }

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

      let pick;
      if (qs.has('variant')) {
        const v = Math.max(0, Math.min(week.variants.length - 1, parseInt(qs.get('variant'), 10) || 0));
        pick = week.variants[v];
      } else {
        pick = chooseVariant(week.variants, season, weekIdx + 1);
      }

      setTrack(pick);
    } catch (e) {
      setTrack({ title: '2-Minute Calm — Welcome', file: 'intro.mp3', transcript: 'intro.txt' });
    }
  }

  init();
})();
