/**
 * MUHAR STUDIO — Luxury Editorial Scroll, Page Transitions & Micro-Interactions
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. Page Transitions (Fast, Subtle & Elegant)
  // ==========================================================================
  function initPageTransitions() {
    // Reveal page immediately
    if (document.body) {
      document.body.classList.add('page-loaded');
    }

    // Handle bfcache (back/forward navigation)
    window.addEventListener('pageshow', () => {
      if (document.body) {
        document.body.classList.remove('page-is-leaving');
        document.body.classList.add('page-loaded');
      }
    });

    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Intercept internal link clicks for smooth exit transition
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Ignore anchors, external links, javascript, mailto, tel, new tabs, download, or modifier keys
      if (
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        link.target === '_blank' ||
        link.hasAttribute('download') ||
        e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ||
        e.button !== 0
      ) {
        return;
      }

      // Check origin
      const currentOrigin = window.location.origin;
      const isSameOrigin = link.origin === currentOrigin || !href.includes('://');
      if (!isSameOrigin) return;

      // Check if it's the exact same page or same page hash
      try {
        const targetUrl = new URL(link.href, window.location.href);
        if (
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search &&
          targetUrl.hash
        ) {
          return;
        }
        if (targetUrl.href === window.location.href) {
          return;
        }
      } catch (err) {
        return;
      }

      // Perform fast editorial transition out
      e.preventDefault();
      document.body.classList.add('page-is-leaving');
      setTimeout(() => {
        window.location.href = link.href;
      }, 180);
    });
  }

  // ==========================================================================
  // 2. Architectural Scroll Progress Indicator
  // ==========================================================================
  function initScrollProgress() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let progressBar = document.querySelector('.muhar-scroll-progress');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'muhar-scroll-progress';
      progressBar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(progressBar);
    }

    let ticking = false;
    const updateProgress = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(Math.max(scrollY / docHeight, 0), 1) : 0;
      progressBar.style.transform = `scaleX(${progress})`;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateProgress);
        ticking = true;
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateProgress);
        ticking = true;
      }
    }, { passive: true });

    updateProgress();
  }

  // ==========================================================================
  // 3. Desktop Cursor Micro-Interaction (Desktop Only)
  // ==========================================================================
  function initDesktopCursor() {
    const isDesktopPointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isDesktopPointer || isReducedMotion) return;

    let cursorDot = document.querySelector('.muhar-cursor-dot');
    let cursorRing = document.querySelector('.muhar-cursor-ring');

    if (!cursorDot) {
      cursorDot = document.createElement('div');
      cursorDot.className = 'muhar-cursor-dot';
      cursorDot.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cursorDot);
    }

    if (!cursorRing) {
      cursorRing = document.createElement('div');
      cursorRing.className = 'muhar-cursor-ring';
      cursorRing.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cursorRing);
    }

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let isMoving = false;
    let rafId = null;

    const render = () => {
      // Smooth lerp for ring follower
      const ease = 0.2;
      ringX += (mouseX - ringX) * ease;
      ringY += (mouseY - ringY) * ease;

      cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

      const dx = Math.abs(mouseX - ringX);
      const dy = Math.abs(mouseY - ringY);

      if (isMoving || dx > 0.1 || dy > 0.1) {
        rafId = requestAnimationFrame(render);
      } else {
        rafId = null;
      }
    };

    const onMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!cursorDot.classList.contains('is-active')) {
        cursorDot.classList.add('is-active');
        cursorRing.classList.add('is-active');
        ringX = mouseX;
        ringY = mouseY;
      }

      isMoving = true;
      if (!rafId) {
        rafId = requestAnimationFrame(render);
      }
    };

    const onMouseLeave = () => {
      cursorDot.classList.remove('is-active');
      cursorRing.classList.remove('is-active');
      isMoving = false;
    };

    const onMouseEnter = () => {
      cursorDot.classList.add('is-active');
      cursorRing.classList.add('is-active');
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    // Hover states on clickable & editorial elements
    const interactiveSelector = `
      a, button, [role="button"], input, textarea, select,
      .muhar-project-card, .muhar-service-row, .muhar-full-item,
      .muhar-btn, .muhar-menu-toggle, .muhar-back-to-top,
      .muhar-brand, .muhar-cookie-btn
    `;

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactiveSelector)) {
        cursorRing.classList.add('is-hovering');
        cursorDot.classList.add('is-hovering');
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactiveSelector)) {
        cursorRing.classList.remove('is-hovering');
        cursorDot.classList.remove('is-hovering');
      }
    });
  }

  // ==========================================================================
  // 4. Scroll Reveals & Existing Interactive Features
  // ==========================================================================
  function initScrollAnimations() {
    // 1. Intersection Observer for Scroll Reveals
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.12
    };

    const revealElements = document.querySelectorAll(
      '.muhar-anim-fade-up, .muhar-anim-fade, .muhar-anim-line, .muhar-anim-img, .muhar-project-card, .muhar-service-row, .muhar-full-item'
    );

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');

            const innerImgs = entry.target.querySelectorAll('.muhar-anim-img');
            innerImgs.forEach(img => img.classList.add('is-visible'));

            const innerLines = entry.target.querySelectorAll('.muhar-anim-line');
            innerLines.forEach(line => line.classList.add('is-visible'));

            obs.unobserve(entry.target);
          }
        });
      }, observerOptions);

      revealElements.forEach(el => observer.observe(el));
    } else {
      revealElements.forEach(el => el.classList.add('is-visible'));
    }

    // 2. Header Scroll Effect
    const header = document.querySelector('.muhar-header');
    if (header) {
      const onScroll = () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > 40) {
          header.classList.add('is-scrolled');
        } else {
          header.classList.remove('is-scrolled');
        }
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    // 3. Parallax Micro-motion on Hero Image
    const heroImage = document.querySelector('.muhar-hero-stage__image');
    if (heroImage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let ticking = false;

      window.addEventListener('scroll', () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            const scrollY = window.scrollY;
            const heroHeight = window.innerHeight;
            if (scrollY <= heroHeight) {
              const translateVal = scrollY * 0.18;
              heroImage.style.transform = `translate3d(0, ${translateVal}px, 0)`;
            }
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    }

    // 4. Floating Back to Top Button Controller
    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (backToTopBtn) {
      const toggleBackToTop = () => {
        if (window.scrollY > 300) {
          backToTopBtn.classList.add('is-visible');
        } else {
          backToTopBtn.classList.remove('is-visible');
        }
      };

      window.addEventListener('scroll', toggleBackToTop, { passive: true });
      toggleBackToTop();

      backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }

    // Initialize New Premium Interactions
    initScrollProgress();
    initDesktopCursor();
    initProgressiveImageLoading();
  }

  // ==========================================================================
  // 5. Progressive Image Decoding & Loading Polish
  // ==========================================================================
  function initProgressiveImageLoading() {
    const images = document.querySelectorAll(
      '.muhar-project-card__img, .muhar-full-item__img, .muhar-about__image, .muhar-sdetail-visual__img, .muhar-approach-hero-visual__img'
    );

    images.forEach((img) => {
      const markLoaded = () => {
        img.classList.add('is-img-loaded');
      };

      if (img.complete && img.naturalWidth > 0) {
        markLoaded();
      } else if ('decode' in img) {
        img.decode().then(markLoaded).catch(markLoaded);
      } else {
        img.addEventListener('load', markLoaded, { once: true });
        img.addEventListener('error', markLoaded, { once: true });
      }
    });
  }

  // Initialize Page Transitions immediately
  initPageTransitions();

  // Initialize Scroll & Cursor once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
  } else {
    initScrollAnimations();
  }
})();
