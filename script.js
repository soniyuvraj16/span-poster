/* SPAN poster companion page: reveal on scroll, nav highlighting, lightbox, mobile menu. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('section.card[id]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var topnav = document.getElementById('topnav');
  var navToggle = document.getElementById('navToggle');
  var navList = document.getElementById('navLinks');

  /* ---- fade and rise on scroll, once ---- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    cards.forEach(function (c) { c.classList.add('reveal'); });
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    cards.forEach(function (c) { revealObserver.observe(c); });
  }

  /* ---- highlight the section in view ---- */
  function setActive(id) {
    navLinks.forEach(function (a) {
      var match = a.getAttribute('href') === '#' + id;
      a.classList.toggle('active', match);
      if (match) { a.setAttribute('aria-current', 'true'); } else { a.removeAttribute('aria-current'); }
    });
  }

  function updateActiveByScroll() {
    var navH = topnav ? topnav.offsetHeight : 0;
    var marker = window.scrollY + navH + window.innerHeight * 0.25;
    var current = null;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= marker) { current = sections[i].id; }
    }
    if (current) { setActive(current); } else { setActive(''); }
  }
  window.addEventListener('scroll', updateActiveByScroll, { passive: true });
  window.addEventListener('resize', updateActiveByScroll);
  updateActiveByScroll();

  /* ---- smooth scrolling for nav links (CSS handles it; JS closes the mobile menu) ---- */
  navLinks.forEach(function (a) {
    a.addEventListener('click', function () {
      if (topnav) { topnav.classList.remove('open'); }
      if (navToggle) { navToggle.setAttribute('aria-expanded', 'false'); }
    });
  });

  if (navToggle && navList) {
    navToggle.addEventListener('click', function () {
      var open = topnav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---- lightbox ---- */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');

  function openLightbox(src, alt) {
    if (!lightbox) { return; }
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) { return; }
    lightbox.hidden = true;
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  Array.prototype.slice.call(document.querySelectorAll('figure img')).forEach(function (img) {
    img.addEventListener('click', function () {
      openLightbox(img.getAttribute('src'), img.getAttribute('alt'));
    });
  });
  if (lightbox) {
    lightbox.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lightbox.hidden) { closeLightbox(); }
    });
  }
})();
