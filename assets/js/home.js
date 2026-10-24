/* ==========================================================================
   TOTAL3D · home.js
   Interações da página inicial: cabeçalho que muda ao rolar e
   efeito de "revelar" das seções.
   ========================================================================== */
(function () {
  // ----- Cabeçalho muda ao rolar -----
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ----- Revelar ao rolar -----
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  els.forEach(el => io.observe(el));
})();
