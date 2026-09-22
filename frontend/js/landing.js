/**
 * landing.js — PDF Swiss-Knife Landing Page & Hero Scroll Animation Controller.
 *
 * Responsibilities:
 * - Direct scroll-driven video scrubbing via requestAnimationFrame
 * - Pinned sticky hero coordinate tracking
 * - Smooth bi-directional (forward and reverse) playback scrubbing
 * - prefers-reduced-motion fallback
 * - Action bindings for [ Open PDF Swiss-Knife ] and workflow shortcuts
 */

'use strict';

/**
 * Initialise the landing page hero animation and interactions.
 * @param {Object} options
 * @param {Function} options.onOpenApp - Callback when user clicks Open App (optional toolId param)
 */
export function initLandingPage({ onOpenApp }) {
  const heroTrack = document.getElementById('hero-track');
  const heroVideo = document.getElementById('hero-video');
  const scrollHint = document.getElementById('hero-scroll-hint');

  if (!heroTrack || !heroVideo) {
    console.warn('[Landing] Hero elements not found');
    return;
  }

  // ─── Video configuration ──────────────────────────────────────────────────
  heroVideo.pause();
  heroVideo.muted = true;
  heroVideo.playsInline = true;
  heroVideo.autoplay = false;
  heroVideo.loop = false;

  let videoDuration = 10.01; // Default fallback from video metadata
  if (heroVideo.duration && !isNaN(heroVideo.duration) && heroVideo.duration > 0) {
    videoDuration = heroVideo.duration;
  }

  heroVideo.addEventListener('loadedmetadata', () => {
    if (heroVideo.duration && !isNaN(heroVideo.duration)) {
      videoDuration = heroVideo.duration;
      // Synchronise initial position
      updateScrub(true);
    }
  });

  // ─── Reduced motion detection ─────────────────────────────────────────────
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isReducedMotion = prefersReduced.matches;

  prefersReduced.addEventListener('change', (e) => {
    isReducedMotion = e.matches;
    if (isReducedMotion) {
      heroVideo.currentTime = videoDuration;
    } else {
      updateScrub(true);
    }
  });

  // ─── Scroll-controlled scrubbing engine ───────────────────────────────────
  let targetProgress = 0;
  let currentProgress = 0;
  let isTicking = false;
  let isSeeking = false;

  function calculateProgress() {
    const trackRect = heroTrack.getBoundingClientRect();
    const trackHeight = heroTrack.offsetHeight;
    const windowHeight = window.innerHeight;
    const scrollableDistance = trackHeight - windowHeight;

    if (scrollableDistance <= 0) return 0;

    const scrolled = -trackRect.top;
    const rawProgress = scrolled / scrollableDistance;
    return Math.min(Math.max(rawProgress, 0), 1);
  }

  function applyVideoTime(targetTime) {
    if (!heroVideo || isSeeking) return;

    // Small epsilon to avoid redundant seeks
    if (Math.abs(heroVideo.currentTime - targetTime) < 0.02) return;

    isSeeking = true;
    try {
      if ('fastSeek' in heroVideo && typeof heroVideo.fastSeek === 'function') {
        heroVideo.fastSeek(targetTime);
      } else {
        heroVideo.currentTime = targetTime;
      }
    } catch {
      // Video not yet ready for seeking
    }
    isSeeking = false;
  }

  function updateScrub(forceImmediate = false) {
    if (isReducedMotion) {
      heroVideo.currentTime = videoDuration;
      return;
    }

    targetProgress = calculateProgress();

    // Fade scroll hint once user starts scrolling
    if (scrollHint) {
      scrollHint.style.opacity = targetProgress > 0.03 ? '0' : '1';
    }

    if (forceImmediate) {
      currentProgress = targetProgress;
      applyVideoTime(currentProgress * videoDuration);
      return;
    }

    if (!isTicking) {
      isTicking = true;
      requestAnimationFrame(renderScrubFrame);
    }
  }

  function renderScrubFrame() {
    // Smooth lerp toward target scroll progress for silky visual transition
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) > 0.001) {
      currentProgress += diff * 0.35; // Responsive easing
    } else {
      currentProgress = targetProgress;
    }

    const targetTime = currentProgress * videoDuration;
    applyVideoTime(targetTime);

    // Continue frame rendering if not yet settled
    if (Math.abs(targetProgress - currentProgress) > 0.001) {
      requestAnimationFrame(renderScrubFrame);
    } else {
      isTicking = false;
    }
  }

  // ─── Event listeners ──────────────────────────────────────────────────────
  window.addEventListener('scroll', () => updateScrub(false), { passive: true });
  window.addEventListener('resize', () => updateScrub(true), { passive: true });

  // Initial update
  updateScrub(true);

  // ─── CTA & Workflow Link Bindings ─────────────────────────────────────────
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

  // Brand click in nav scrolls to top
  const brandNav = document.getElementById('landing-brand-link');
  if (brandNav) {
    brandNav.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
