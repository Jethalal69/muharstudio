/**
 * MUHAR STUDIO — Reusable Navbar Component Logic
 */

(function () {
  'use strict';

  function initMuharNavbar() {
    const header = document.querySelector('.muhar-header');
    if (!header) return;

    const toggleBtn = header.querySelector('.muhar-menu-toggle');
    const mobileLinks = header.querySelectorAll('.muhar-mobile-nav-link');

    if (!toggleBtn) return;

    function toggleMenu(open) {
      const shouldOpen = open !== undefined ? open : !header.classList.contains('is-open');
      header.classList.toggle('is-open', shouldOpen);
      toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      document.body.style.overflow = shouldOpen ? 'hidden' : '';
    }

    toggleBtn.addEventListener('click', function () {
      toggleMenu();
    });

    mobileLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMenu(false);
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        toggleMenu(false);
      }
    });

    // Close drawer when resized back to desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth > 768 && header.classList.contains('is-open')) {
        toggleMenu(false);
      }
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMuharNavbar);
  } else {
    initMuharNavbar();
  }
})();
