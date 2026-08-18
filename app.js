// Astral Projection LG — tiny enhancements
// (1) Mobile nav toggle
// (2) Service-worker registration (no cache-buster versioning on purpose)
// (3) Back-to-top button
// (Note: scroll-spy active-section highlighting was removed because it
//  was wiping inline styles on nav links and intermittently causing the
//  header to reflow on language switch — the page is short enough that
//  active section is obvious from the eye's position alone.)

(() => {
  const toggle = document.querySelector('.menu-toggle');
  const links  = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => links.classList.remove('open'))
    );
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // Back-to-top button — fades in after the user scrolls past the hero
  const toTop = document.getElementById('to-top');
  if (toTop) {
    const showAt = () => {
      const past = window.scrollY > (window.innerHeight * 0.6);
      toTop.classList.toggle('visible', past);
    };
    showAt();
    window.addEventListener('scroll', showAt, { passive: true });
    toTop.addEventListener('click', () => {
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo(0, 0);
      }
    });
  }
})();
