(async function () {
  const audioEl = document.getElementById('calm-audio');
  const titleEl = document.getElementById('calm-title');

  // Determine season based on current month
  const month = new Date().getMonth() + 1;
  let season;
  if (month >= 3 && month <= 5) season = "spring";
  else if (month >= 6 && month <= 8) season = "summer";
  else if (month >= 9 && month <= 11) season = "autumn";
  else season = "winter";

  // Determine which week of the month
  const date = new Date();
  const week = Math.ceil(date.getDate() / 7) - 1;

  // Load JSON manifest
  const response = await fetch('/data/2min-calm.json');
  const manifest = await response.json();

  // Pick correct track
  const track = manifest[season][week % manifest[season].length];
  if (track) {
    audioEl.src = `/audio/2min/${track.file}`;
    titleEl.textContent = track.title;
  }
})();
