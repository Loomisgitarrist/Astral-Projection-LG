// Astral Projection LG — minimal JS.
// Right now: just registers the service worker so the PWA can precache
// and run offline. The audio player lives in app-audio.js; nothing else
// here while we diagnose header reflow on language switch.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
