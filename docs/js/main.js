/**
 * Main JavaScript for AI Video Editor Download Page
 * Handles UI interactions and smooth scrolling
 */

(function () {
  'use strict';

  // Smooth scroll for anchor links
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');

        // Don't prevent default for links that just use # as href
        if (href === '#') return;

        e.preventDefault();

        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // Add scroll-based navbar styling
  function initNavbarScroll() {
    const nav = document.querySelector('.nav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll <= 0) {
        nav.style.boxShadow = 'none';
      } else {
        nav.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
      }

      lastScroll = currentScroll;
    });
  }

  // Intersection Observer for fade-in animations
  function initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    // Observe elements that should animate
    const animatedElements = document.querySelectorAll('.feature-card, .download-card, .faq-item, .step');
    animatedElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }

  // Handle mobile menu toggle (if needed in future)
  function initMobileMenu() {
    // Placeholder for mobile menu functionality
    // Can be implemented if hamburger menu is added
  }

  // Copy to clipboard functionality (for checksums, etc.)
  function initCopyButtons() {
    document.querySelectorAll('[data-copy]').forEach(button => {
      button.addEventListener('click', async () => {
        const textToCopy = button.dataset.copy;

        try {
          await navigator.clipboard.writeText(textToCopy);

          // Visual feedback
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          button.classList.add('copied');

          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy text:', err);
        }
      });
    });
  }

  // Add loading state to buttons during download
  function enhanceDownloadButtons() {
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        // Add loading state
        const originalHTML = this.innerHTML;
        this.disabled = true;
        this.innerHTML = `
          <svg class="btn-icon animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Preparing...
        `;

        // Reset after 3 seconds (download should have started by then)
        setTimeout(() => {
          this.disabled = false;
          this.innerHTML = originalHTML;
        }, 3000);
      });
    });
  }

  // FAQ accordion functionality (optional enhancement)
  function initFAQAccordion() {
    // Can be implemented to make FAQ items expandable/collapsible
    // Currently FAQ items are always visible
  }

  // Track external links
  function trackExternalLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
      link.addEventListener('click', () => {
        if (typeof gtag !== 'undefined') {
          gtag('event', 'click', {
            event_category: 'External Link',
            event_label: link.href
          });
        }
      });
    });
  }

  // Initialize all features when DOM is ready
  function init() {
    initSmoothScroll();
    initNavbarScroll();
    initScrollAnimations();
    initMobileMenu();
    initCopyButtons();
    enhanceDownloadButtons();
    initFAQAccordion();
    trackExternalLinks();

    console.log('AI Video Editor download page initialized');
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Add spinning animation for loading icons
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin {
      animation: spin 1s linear infinite;
    }
  `;
  document.head.appendChild(style);

})();
