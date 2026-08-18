// Astral Projection LG — tiny enhancements
// (1) Mobile nav toggle
// (2) Service-worker registration (no cache-buster versioning on purpose)
// (3) Smooth-scroll active-section highlighting on the nav

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

  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  const map = new Map([...navLinks].map((a) => [a.getAttribute('href').slice(1), a]));
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const id = e.target.id;
          navLinks.forEach((a) => a.style.color = '');
          const active = map.get(id);
          if (active) active.style.color = 'var(--accent-hot)';
        }
      });
    },
    { rootMargin: '-50% 0px -45% 0px' }
  );
  document.querySelectorAll('section[id]').forEach((s) => obs.observe(s));

  // (4) Back-to-top button — fades in after the user scrolls past the hero
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
