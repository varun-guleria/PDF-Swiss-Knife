/**
 * landing.js — PDF Swiss-Knife Landing Page Controller.
 *
 * Premium cinematic hero with:
 * - One-shot video playback (no loop)
 * - Keyword carousel (cycles once, then stops)
 * - Parallax scroll layers
 * - Scroll-triggered reveal animations
 * - Mouse-reactive spotlight
 * - Scroll hint auto-hide
 * - Stats counter animation
 */

'use strict';

/**
 * Initialise the landing page hero and interactions.
 * @param {Object} options
 * @param {Function} options.onOpenApp - Callback when user clicks Open App (optional toolId param)
 */
export function initLandingPage({ onOpenApp }) {

  // ─── Video: play once, no loop ──────────────────────────────────────────
  const heroVideo = document.getElementById('hero-video');

  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    heroVideo.loop = false;   // Play once, stop on final frame
    heroVideo.autoplay = true;

    const playPromise = heroVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        console.info('[Landing] Autoplay blocked by browser policy.');
      });
    }

    // When video ends, keep it paused on the final (fully colored) frame
    heroVideo.addEventListener('ended', () => {
      heroVideo.pause();
    });

    // Respect reduced motion: pause video, show poster
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReduced.matches) {
      heroVideo.pause();
    }
    prefersReduced.addEventListener('change', (e) => {
      if (e.matches) {
        heroVideo.pause();
      } else {
        heroVideo.play().catch(() => {});
      }
    });
  }

  // ─── #7 Keyword Carousel ────────────────────────────────────────────────
  const keywords = document.querySelectorAll('.hero-keyword');
  if (keywords.length > 1) {
    let kwIndex = 0;
    const kwInterval = setInterval(() => {
      keywords[kwIndex].classList.remove('hero-keyword--active');
      kwIndex++;
      if (kwIndex >= keywords.length) {
        kwIndex = 0;
      }
      keywords[kwIndex].classList.add('hero-keyword--active');
    }, 2500);
  }

  // ─── #13 Mouse-reactive Spotlight ───────────────────────────────────────
  const heroStage = document.querySelector('.hero-stage');
  const spotlight = document.getElementById('hero-spotlight');

  if (heroStage && spotlight) {
    let spotlightX = 0, spotlightY = 0;
    let targetX = 0, targetY = 0;
    let spotlightRAF = null;

    heroStage.addEventListener('mousemove', (e) => {
      const rect = heroStage.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;

      if (!spotlightRAF) {
        spotlightRAF = requestAnimationFrame(updateSpotlight);
      }
    });

    function updateSpotlight() {
      // Smooth interpolation
      spotlightX += (targetX - spotlightX) * 0.15;
      spotlightY += (targetY - spotlightY) * 0.15;

      spotlight.style.left = spotlightX + 'px';
      spotlight.style.top = spotlightY + 'px';

      // Continue until close enough
      if (Math.abs(targetX - spotlightX) > 0.5 || Math.abs(targetY - spotlightY) > 0.5) {
        spotlightRAF = requestAnimationFrame(updateSpotlight);
      } else {
        spotlightRAF = null;
      }
    }
  }

  // ─── #11 Parallax Scroll Layers ─────────────────────────────────────────
  const landingPage = document.getElementById('landing-page');
  const heroContent = document.querySelector('.hero-content');
  const heroVideoWrapper = document.querySelector('.hero-video-wrapper');
  const scrollHint = document.getElementById('hero-scroll-hint');
  let scrollHintHidden = false;

  if (landingPage && (heroContent || heroVideoWrapper)) {
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;

          // Parallax: hero content moves up faster
          if (heroContent) {
            heroContent.style.transform = `translateY(${scrollY * -0.3}px)`;
          }

          // Parallax: video moves up slower
          if (heroVideoWrapper) {
            heroVideoWrapper.style.transform = `translateY(${scrollY * -0.15}px)`;
          }

          // Fade out scroll hint after user starts scrolling
          if (!scrollHintHidden && scrollHint && scrollY > 50) {
            scrollHint.classList.add('hero-scroll-hint--hidden');
            scrollHintHidden = true;
          }

          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ─── #12 Scroll-triggered Reveal Animations ─────────────────────────────
  const revealElements = document.querySelectorAll('[data-reveal]');
  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--visible');
          revealObserver.unobserve(entry.target); // Only animate once
        }
      });
    }, {
      root: null,   // Observe within the viewport
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach((el) => revealObserver.observe(el));
  }

  // ─── Stats Counter Animation ────────────────────────────────────────────
  const statCounters = document.querySelectorAll('[data-count]');
  if (statCounters.length > 0 && 'IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          if (isNaN(target)) return;
          animateCounter(el, 0, target, 1500);
          counterObserver.unobserve(el);
        }
      });
    }, {
      root: null,
      threshold: 0.5
    });

    statCounters.forEach((el) => counterObserver.observe(el));
  }

  function animateCounter(el, start, end, duration) {
    const range = end - start;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + range * eased);
      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  // ─── CTA & Navigation Bindings ──────────────────────────────────────────
  const openButtons = document.querySelectorAll(
    '#hero-open-app-btn, #nav-open-app-btn, #cta-open-app-btn, .landing-open-btn'
  );
  openButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof onOpenApp === 'function') {
        onOpenApp('home');
      }
    });
  });

  const workflowButtons = document.querySelectorAll('.workflow-launch-btn[data-tool]');
  workflowButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const toolId = btn.getAttribute('data-tool');
      if (typeof onOpenApp === 'function') {
        onOpenApp(toolId || 'home');
      }
    });
  });

  // Brand click in nav
  const brandNav = document.getElementById('landing-brand-link');
  if (brandNav) {
    brandNav.addEventListener('click', (e) => {
      e.preventDefault();
    });
  }
}
