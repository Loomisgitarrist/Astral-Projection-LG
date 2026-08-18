// Astral Projection LG — minimal JS.
// - Mobile nav toggle (hamburger opens/closes the .nav-links dropdown on
//   small screens; tap anywhere on a link closes it)
// - Service-worker registration so the PWA can precache and run offline
// - Back-to-top button (fades in past the hero)
//
// Note: scroll-spy active-section highlighting was deliberately removed
// in commit e92dfc8 because it was wiping inline styles on every nav
// link during page navigation and was the suspected cause of the
// header reflow on EN|DE switch. If you want to add it back, isolate
// to a single nav-link and use a classList toggle instead of inline
// style assignment.

(() => {
  // Mobile nav toggle
  const toggle = document.querySelector('.menu-toggle');
  const links  = document.querySelector('.nav-links');
  if (toggle && links) {
    const setOpen = (open) => {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => setOpen(false))
    );
    // Close on click outside the nav
    document.addEventListener('click', (e) => {
      if (!links.classList.contains('open')) return;
      if (links.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });
  }

  // Service-worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // Back-to-top button
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
