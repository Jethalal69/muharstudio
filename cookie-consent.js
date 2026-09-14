/**
 * MUHAR STUDIO — Cookie Consent Controller
 * Accessible cookie consent banner & preferences manager matching luxury editorial design.
 * Non-persistent mode: Appears on every page load/refresh without saving to browser storage.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'muhar_cookie_consent';
  let previouslyFocusedElement = null;
  let activeConsent = null;

  // Get current consent from localStorage with memory fallback
  function getStoredConsent() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Ignore storage errors if disabled
    }
    return activeConsent;
  }

  // Save consent to localStorage and memory
  function saveConsent(consent) {
    activeConsent = consent;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (e) {
      // Ignore if localStorage unavailable
    }
    window.dispatchEvent(new CustomEvent('muharCookieConsentUpdated', { detail: consent }));
  }

  // Render Cookie Banner & Modal HTML if not already in DOM
  function ensureElementsExist() {
    if (!document.getElementById('muhar-cookie-banner')) {
      const bannerHtml = `
        <aside 
          class="muhar-cookie-banner" 
          id="muhar-cookie-banner" 
          role="region" 
          aria-label="Cookie consent banner"
        >
          <div class="muhar-cookie-banner__content">
            <span class="muhar-cookie-banner__eyebrow">PRIVACY &amp; PREFERENCES</span>
            <h2 class="muhar-cookie-banner__title">We use cookies</h2>
            <p class="muhar-cookie-banner__text">
              We use cookies to improve your experience, understand how our website is used, and provide relevant functionality.
            </p>
          </div>
          <div class="muhar-cookie-banner__actions">
            <button type="button" class="muhar-cookie-btn muhar-cookie-btn--primary" id="muhar-cookie-accept-all">
              <span>ACCEPT ALL</span> <span aria-hidden="true">&rarr;</span>
            </button>
            <button type="button" class="muhar-cookie-btn muhar-cookie-btn--secondary" id="muhar-cookie-reject">
              <span>REJECT</span> <span aria-hidden="true">&rarr;</span>
            </button>
            <button type="button" class="muhar-cookie-btn muhar-cookie-btn--tertiary" id="muhar-cookie-preferences-btn">
              <span>COOKIE PREFERENCES</span> <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </aside>
      `;
      document.body.insertAdjacentHTML('beforeend', bannerHtml);
    }

    if (!document.getElementById('muhar-cookie-modal-backdrop')) {
      const modalHtml = `
        <div 
          class="muhar-cookie-modal-backdrop" 
          id="muhar-cookie-modal-backdrop" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="muhar-cookie-modal-title" 
          aria-describedby="muhar-cookie-modal-desc"
        >
          <div class="muhar-cookie-modal" id="muhar-cookie-modal">
            <div class="muhar-cookie-modal__header">
              <span class="muhar-cookie-modal__eyebrow">PREFERENCES</span>
              <h2 class="muhar-cookie-modal__title" id="muhar-cookie-modal-title">Cookie Preferences</h2>
              <p class="muhar-cookie-modal__intro" id="muhar-cookie-modal-desc">
                Manage your cookie preferences. Essential cookies are necessary for the website to function properly and cannot be disabled.
              </p>
              <button type="button" class="muhar-cookie-modal__close" id="muhar-cookie-modal-close" aria-label="Close cookie preferences">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div class="muhar-cookie-modal__body">
              <!-- Essential Category -->
              <div class="muhar-cookie-category">
                <div class="muhar-cookie-category__header">
                  <div class="muhar-cookie-category__label">
                    <span>1. Essential Cookies</span>
                  </div>
                  <span class="muhar-cookie-category__badge">ALWAYS ACTIVE</span>
                </div>
                <p class="muhar-cookie-category__desc">
                  Necessary for website navigation, accessibility, responsive layout rendering, and security. These cannot be switched off.
                </p>
              </div>

              <!-- Analytics Category -->
              <div class="muhar-cookie-category">
                <div class="muhar-cookie-category__header">
                  <label for="muhar-cookie-cat-analytics" class="muhar-cookie-category__label">
                    <span>2. Performance &amp; Analytics</span>
                  </label>
                  <label class="muhar-cookie-switch">
                    <input type="checkbox" id="muhar-cookie-cat-analytics" aria-label="Enable performance and analytics cookies">
                    <span class="muhar-cookie-slider"></span>
                  </label>
                </div>
                <p class="muhar-cookie-category__desc">
                  Helps us understand how visitors interact with our portfolio and service pages by gathering anonymous usage metrics.
                </p>
              </div>

              <!-- Marketing / Functional Category -->
              <div class="muhar-cookie-category">
                <div class="muhar-cookie-category__header">
                  <label for="muhar-cookie-cat-marketing" class="muhar-cookie-category__label">
                    <span>3. Functional &amp; Social</span>
                  </label>
                  <label class="muhar-cookie-switch">
                    <input type="checkbox" id="muhar-cookie-cat-marketing" aria-label="Enable functional and social cookies">
                    <span class="muhar-cookie-slider"></span>
                  </label>
                </div>
                <p class="muhar-cookie-category__desc">
                  Enables enhanced interactive features, font caching optimizations, and external social media integrations.
                </p>
              </div>
            </div>

            <div class="muhar-cookie-modal__footer">
              <button type="button" class="muhar-cookie-btn muhar-cookie-btn--primary" id="muhar-cookie-save-prefs">
                <span>SAVE PREFERENCES</span> <span aria-hidden="true">&rarr;</span>
              </button>
              <button type="button" class="muhar-cookie-btn muhar-cookie-btn--secondary" id="muhar-cookie-modal-accept-all">
                <span>ACCEPT ALL</span> <span aria-hidden="true">&rarr;</span>
              </button>
              <button type="button" class="muhar-cookie-btn muhar-cookie-btn--tertiary" id="muhar-cookie-modal-reject-all">
                <span>REJECT ALL</span> <span aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
  }

  // Get current in-memory consent (not from browser storage)
  function getStoredConsent() {
    return activeConsent;
  }

  // Save consent to in-memory state only
  function saveConsent(consent) {
    activeConsent = consent;
    window.dispatchEvent(new CustomEvent('muharCookieConsentUpdated', { detail: consent }));
  }

  // Show Banner
  function showBanner() {
    const banner = document.getElementById('muhar-cookie-banner');
    if (banner) {
      banner.classList.add('is-visible');
      document.body.classList.add('has-cookie-banner-open');
    }
  }

  // Hide Banner
  function hideBanner() {
    const banner = document.getElementById('muhar-cookie-banner');
    if (banner) {
      banner.classList.remove('is-visible');
      document.body.classList.remove('has-cookie-banner-open');
    }
  }

  // Open Preferences Modal
  function openPreferencesModal(triggerElement) {
    ensureElementsExist();
    previouslyFocusedElement = triggerElement || document.activeElement;

    const modalBackdrop = document.getElementById('muhar-cookie-modal-backdrop');
    const analyticsCheckbox = document.getElementById('muhar-cookie-cat-analytics');
    const marketingCheckbox = document.getElementById('muhar-cookie-cat-marketing');

    // Populate checkboxes from stored consent
    const storedConsent = getStoredConsent();
    if (storedConsent) {
      if (analyticsCheckbox) analyticsCheckbox.checked = !!storedConsent.analytics;
      if (marketingCheckbox) marketingCheckbox.checked = !!storedConsent.marketing;
    } else {
      if (analyticsCheckbox) analyticsCheckbox.checked = false;
      if (marketingCheckbox) marketingCheckbox.checked = false;
    }

    if (modalBackdrop) {
      modalBackdrop.classList.add('is-open');
      
      // Focus first interactive element inside modal
      const closeBtn = document.getElementById('muhar-cookie-modal-close');
      if (closeBtn) closeBtn.focus();
    }
  }

  // Close Preferences Modal
  function closePreferencesModal() {
    const modalBackdrop = document.getElementById('muhar-cookie-modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.classList.remove('is-open');
    }

    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }
  }

  // Handle Accept All
  function handleAcceptAll() {
    const consent = {
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
      version: '1.0'
    };
    saveConsent(consent);
    hideBanner();
    closePreferencesModal();
  }

  // Handle Reject All
  function handleReject() {
    const consent = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
      version: '1.0'
    };
    saveConsent(consent);
    hideBanner();
    closePreferencesModal();
  }

  // Handle Save Preferences
  function handleSavePreferences() {
    const analyticsCheckbox = document.getElementById('muhar-cookie-cat-analytics');
    const marketingCheckbox = document.getElementById('muhar-cookie-cat-marketing');

    const consent = {
      essential: true,
      analytics: analyticsCheckbox ? analyticsCheckbox.checked : false,
      marketing: marketingCheckbox ? marketingCheckbox.checked : false,
      timestamp: Date.now(),
      version: '1.0'
    };
    saveConsent(consent);
    hideBanner();
    closePreferencesModal();
  }

  // Setup Event Listeners & Initialize Banner
  function initCookieConsent() {
    ensureElementsExist();

    // Show banner only if user has not yet consented
    const existingConsent = getStoredConsent();
    if (!existingConsent) {
      setTimeout(() => {
        showBanner();
      }, 500);
    }

    // Banner Buttons
    const acceptAllBtn = document.getElementById('muhar-cookie-accept-all');
    if (acceptAllBtn) acceptAllBtn.addEventListener('click', handleAcceptAll);

    const rejectBtn = document.getElementById('muhar-cookie-reject');
    if (rejectBtn) rejectBtn.addEventListener('click', handleReject);

    const preferencesBtn = document.getElementById('muhar-cookie-preferences-btn');
    if (preferencesBtn) {
      preferencesBtn.addEventListener('click', (e) => {
        openPreferencesModal(e.currentTarget);
      });
    }

    // Modal Buttons
    const modalCloseBtn = document.getElementById('muhar-cookie-modal-close');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closePreferencesModal);

    const modalSaveBtn = document.getElementById('muhar-cookie-save-prefs');
    if (modalSaveBtn) modalSaveBtn.addEventListener('click', handleSavePreferences);

    const modalAcceptAllBtn = document.getElementById('muhar-cookie-modal-accept-all');
    if (modalAcceptAllBtn) modalAcceptAllBtn.addEventListener('click', handleAcceptAll);

    const modalRejectAllBtn = document.getElementById('muhar-cookie-modal-reject-all');
    if (modalRejectAllBtn) modalRejectAllBtn.addEventListener('click', handleReject);

    // Backdrop click to close
    const modalBackdrop = document.getElementById('muhar-cookie-modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
          closePreferencesModal();
        }
      });
    }

    // Keydown listener for Escape and Tab Trap
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('muhar-cookie-modal-backdrop');
      if (!modal || !modal.classList.contains('is-open')) return;

      if (e.key === 'Escape') {
        closePreferencesModal();
        return;
      }

      // Trap focus in modal
      if (e.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    });

    // Delegate footer "Cookie Preferences" links
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.muhar-cookie-reopen-btn, #open-cookie-preferences-btn');
      if (target) {
        e.preventDefault();
        openPreferencesModal(target);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieConsent);
  } else {
    initCookieConsent();
  }

  // Expose global controller for inspection / debugging
  window.MUHAR_COOKIE_CONSENT = {
    getConsent: getStoredConsent,
    openPreferences: openPreferencesModal,
    showBanner: showBanner,
    hideBanner: hideBanner
  };
})();
