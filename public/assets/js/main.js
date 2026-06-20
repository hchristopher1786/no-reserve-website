/* =====================================================================
   No Reserve Photography — shared front-end JS
   Currently: mobile nav toggle. Add other site-wide utilities here.
   ===================================================================== */
(function () {
  'use strict';

  // Mobile hamburger -> toggles the vertical nav on small screens.
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close the menu after tapping a link (single-page feel on mobile).
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
