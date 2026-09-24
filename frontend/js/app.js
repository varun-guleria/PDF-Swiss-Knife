/**
 * app.js — Application entry point.
 *
 * Responsibilities:
 * - Bootstrap the app (theme, nav, routing)
 * - Manage navigation state
 * - Render tool panels into the content area
 * - Display backend status
 * - Handle theme switching (light / dark / system)
 */

'use strict';

import * as api from './api.js';
import { renderHome } from './tools/home.js';
import { renderMerge } from './tools/merge.js';
import { renderOrganize } from './tools/organize.js';
import { renderBatch } from './tools/batch.js';
import { renderSplit } from './tools/split.js';
import { renderExtract } from './tools/extract.js';
import { renderRotate } from './tools/rotate.js';
import { renderCrop } from './tools/crop.js';
import { renderWatermark } from './tools/watermark.js';
import { renderPageNumbers } from './tools/pagenums.js';
import { renderHeaderFooter } from './tools/headerfooter.js';
import { renderToImages } from './tools/toImages.js';
import { renderToPdf } from './tools/toPdf.js';
import { renderCompress } from './tools/compress.js';
import { renderRepair } from './tools/repair.js';
import { renderInfo } from './tools/info.js';
import { renderProtect } from './tools/protect.js';
import { renderUnprotect } from './tools/unprotect.js';
import { initLandingPage } from './landing.js';

// ─── Nav definition ────────────────────────────────────────────────────────
// Each entry: { id, label, icon, section, badge? }
// section = null means "no section label" (e.g. Home)

const NAV_ITEMS = [
  { id: 'home',         label: 'Home',              icon: 'house',         section: null },

  // ORGANISE
  { id: 'merge',        label: 'Merge PDFs',         icon: 'layers',        section: 'Organise' },
  { id: 'split',        label: 'Split PDF',          icon: 'scissors',      section: 'Organise' },
  { id: 'organize',     label: 'Organise Pages',     icon: 'layout-grid',   section: 'Organise' },
  { id: 'extract',      label: 'Extract Pages',      icon: 'copy',          section: 'Organise' },

  // EDIT
  { id: 'rotate',       label: 'Rotate Pages',       icon: 'rotate-cw',     section: 'Edit' },
  { id: 'crop',         label: 'Crop Pages',         icon: 'crop',          section: 'Edit' },
  { id: 'watermark',    label: 'Watermark',          icon: 'droplets',      section: 'Edit' },
  { id: 'pagenumbers',  label: 'Page Numbers',       icon: 'hash',          section: 'Edit' },
  { id: 'headerfooter', label: 'Header & Footer',    icon: 'align-center',  section: 'Edit' },

  // CONVERT
  { id: 'toImages',     label: 'PDF → Images',       icon: 'image',         section: 'Convert' },
  { id: 'toPdf',        label: 'Images → PDF',       icon: 'file-image',    section: 'Convert' },

  // OPTIMISE
  { id: 'compress',     label: 'Compress',           icon: 'archive',       section: 'Optimise' },
  { id: 'repair',       label: 'Repair / Normalize', icon: 'wrench',        section: 'Optimise' },
  { id: 'info',         label: 'PDF Information',    icon: 'info',          section: 'Optimise' },

  // SECURITY
  { id: 'protect',      label: 'Protect PDF',        icon: 'lock',          section: 'Security' },
  { id: 'unprotect',    label: 'Remove Protection',  icon: 'unlock',        section: 'Security' },

  // ADVANCED
  { id: 'batch',        label: 'Custom Batch PDF Builder', icon: 'layers', section: 'Advanced', badge: 'PRO' },

  // SETTINGS
  { id: 'settings',     label: 'Settings',           icon: 'settings',      section: null },
];

// ─── State ─────────────────────────────────────────────────────────────────

let currentToolId = 'home';
let backendOnline = false;

// ─── Theme ─────────────────────────────────────────────────────────────────

const THEME_KEY = 'psk-theme';   // localStorage key

/**
 * Apply a theme to the document root.
 * @param {'light'|'dark'|'system'} theme
 */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  // Update toggle button active state
  document.querySelectorAll('.theme-toggle__btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeValue === theme);
  });
  localStorage.setItem(THEME_KEY, theme);
}

function getSavedTheme() {
  return localStorage.getItem(THEME_KEY) || 'system';
}

// ─── Navigation & View Switching ───────────────────────────────────────────

/**
 * Show the Landing Page view.
 */
export function showLandingView() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.title = 'PDF Swiss-Knife — Local PDF Workspace';
}

/**
 * Show the Desktop App Workspace view.
 * @param {string} [toolId='home']
 * @param {boolean} [animate=true]
 */
export function showAppView(toolId = 'home', animate = true) {
  const app = document.getElementById('app');
  if (app) {
    app.scrollIntoView({ behavior: animate ? 'smooth' : 'auto' });
  }
  navigate(toolId);
}

/**
 * Handle URL hash changes for routing.
 */
function handleRoute() {
  const hash = window.location.hash || '';
  if (hash.startsWith('#/app/')) {
    const toolId = hash.replace('#/app/', '').trim();
    showAppView(toolId || 'home', false);
  } else if (hash === '#/app') {
    showAppView('home', false);
  } else if (hash.startsWith('#') && hash.length > 2 && NAV_ITEMS.some(n => `#${n.id}` === hash)) {
    const toolId = hash.substring(1);
    showAppView(toolId, false);
  } else {
    // No specific deep link, remain at current scroll pos or top.
    // Pre-load the workspace home view so the user doesn't see a spinner if they scroll down.
    navigate('home', false);
  }
}

/**
 * Navigate to a tool by ID within the App Workspace.
 * @param {string} toolId
 * @param {boolean} [syncHash=true] - Whether to update the URL hash
 */
function navigate(toolId, syncHash = true) {
  currentToolId = toolId;

  // Sync URL hash
  if (syncHash && window.location.hash !== `#/app/${toolId}` && window.location.hash !== `#${toolId}`) {
    history.replaceState(null, '', `#/app/${toolId}`);
  }

  // Update nav active state
  document.querySelectorAll('.nav-item[data-tool]').forEach(el => {
    el.classList.toggle('active', el.dataset.tool === toolId);
  });

  // Update topbar breadcrumb
  const item = NAV_ITEMS.find(n => n.id === toolId);
  const breadcrumb = document.getElementById('topbar-breadcrumb');
  if (breadcrumb && item) {
    if (item.section) {
      breadcrumb.innerHTML = `
        <span class="section-label">${item.section}</span>
        <span class="sep">/</span>
        <span class="current">${item.label}</span>
      `;
    } else {
      breadcrumb.innerHTML = `<span class="current">${item.label}</span>`;
    }
  }

  // Render tool panel
  renderTool(toolId);
}

/**
 * Render a tool panel into the content area.
 * @param {string} toolId
 */
async function renderTool(toolId) {
  const content = document.getElementById('tool-content');
  if (!content) return;

  // Clear current content
  content.innerHTML = '';

  const inner = document.createElement('div');
  inner.className = (toolId === 'batch' || toolId === 'organize')
    ? 'content-inner content-inner--wide'
    : 'content-inner';
  content.appendChild(inner);

  switch (toolId) {
    case 'home':
      renderHome(inner, navigate);
      break;

    case 'merge':
      renderMerge(inner);
      break;

    case 'split':
      renderSplit(inner);
      break;

    case 'organize':
      renderOrganize(inner);
      break;

    case 'extract':
      renderExtract(inner);
      break;

    case 'rotate':
      renderRotate(inner);
      break;

    case 'crop':
      renderCrop(inner);
      break;

    case 'watermark':
      renderWatermark(inner);
      break;

    case 'pagenumbers':
      renderPageNumbers(inner);
      break;

    case 'headerfooter':
      renderHeaderFooter(inner);
      break;

    case 'toImages':
      renderToImages(inner);
      break;

    case 'toPdf':
      renderToPdf(inner);
      break;

    case 'compress':
      renderCompress(inner);
      break;

    case 'repair':
      renderRepair(inner);
      break;

    case 'info':
      renderInfo(inner);
      break;

    case 'protect':
      renderProtect(inner);
      break;

    case 'unprotect':
      renderUnprotect(inner);
      break;

    case 'batch':
      renderBatch(inner);
      break;

    case 'settings':
      renderSettings(inner);
      break;

    default:
      renderComingSoon(inner, toolId);
      break;
  }

  // Re-run Lucide after rendering
  if (window.lucide) window.lucide.createIcons({ node: inner });
}

// ─── Placeholder tool renderers ────────────────────────────────────────────

function renderComingSoon(container, toolId) {
  const item = NAV_ITEMS.find(n => n.id === toolId);
  const label = item ? item.label : toolId;
  container.innerHTML = `
    <div class="tool-panel">
      <div class="page-header">
        <h1 class="page-header__title">${label}</h1>
      </div>
      <div class="card">
        <div class="card__body">
          <div class="empty-state">
            <i data-lucide="construction" class="empty-state__icon"></i>
            <div class="empty-state__title">Coming in a future milestone</div>
            <div class="empty-state__text">
              This tool is planned and will be implemented in an upcoming development milestone.
              The PDF Merge and Batch Builder tools are available now.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSettings(container) {
  const savedTheme = getSavedTheme();
  container.innerHTML = `
    <div class="tool-panel">
      <div class="page-header">
        <h1 class="page-header__title">Settings</h1>
        <p class="page-header__subtitle">Configure PDF Swiss-Knife preferences.</p>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">Appearance</div>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">Theme</div>
            <div class="settings-row__desc">Choose light, dark, or follow your system preference.</div>
          </div>
          <div class="theme-toggle" role="group" aria-label="Theme selection">
            <button class="theme-toggle__btn ${savedTheme === 'light' ? 'active' : ''}"
              data-theme-value="light" title="Light theme" aria-label="Light theme">
              <i data-lucide="sun"></i>
            </button>
            <button class="theme-toggle__btn ${savedTheme === 'system' ? 'active' : ''}"
              data-theme-value="system" title="System theme" aria-label="System theme">
              <i data-lucide="monitor"></i>
            </button>
            <button class="theme-toggle__btn ${savedTheme === 'dark' ? 'active' : ''}"
              data-theme-value="dark" title="Dark theme" aria-label="Dark theme">
              <i data-lucide="moon"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">Backend</div>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">Backend connection</div>
            <div class="settings-row__desc">
              The PDF processing engine runs locally at
              <code style="font-family: var(--font-mono); font-size: var(--font-size-xs);">http://127.0.0.1:5000</code>
            </div>
          </div>
          <div id="backend-status-settings" style="display:flex;align-items:center;gap:var(--space-3);font-size:var(--font-size-sm);">
            <div class="status-dot status-dot--unknown"></div>
            <span style="color:var(--color-text-secondary)">Checking…</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">About</div>
        <div class="settings-row">
          <div class="settings-row__info">
            <div class="settings-row__label">PDF Swiss-Knife</div>
            <div class="settings-row__desc">Local PDF workspace — all processing happens on your machine. No cloud uploads.</div>
          </div>
          <span class="badge badge--default">v0.1.0</span>
        </div>
      </div>
    </div>
  `;

  // Wire theme buttons
  container.querySelectorAll('.theme-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeValue));
  });

  // Show backend status
  updateSettingsBackendStatus(container);
}

async function updateSettingsBackendStatus(container) {
  const el = container.querySelector('#backend-status-settings');
  if (!el) return;
  try {
    await api.health();
    el.innerHTML = `
      <div class="status-dot status-dot--online"></div>
      <span style="color:var(--color-success)">Connected</span>
    `;
  } catch {
    el.innerHTML = `
      <div class="status-dot status-dot--offline"></div>
      <span style="color:var(--color-error)">Not reachable</span>
    `;
  }
}

// ─── App shell rendering ───────────────────────────────────────────────────

function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  let navHtml = '<nav class="sidebar__nav" aria-label="Main navigation">';
  let currentSection = null;

  for (const item of NAV_ITEMS) {
    // Home and Settings don't belong to a section
    if (item.section !== currentSection) {
      if (currentSection !== null) {
        navHtml += '</div>'; // close previous section
      }
      currentSection = item.section;
      navHtml += '<div class="nav-section">';
      if (item.section) {
        navHtml += `<div class="nav-section__label">${item.section}</div>`;
      }
    }

    navHtml += `
      <button
        class="nav-item${item.id === 'home' ? ' active' : ''}"
        data-tool="${item.id}"
        aria-label="${item.label}"
        aria-current="${item.id === 'home' ? 'page' : 'false'}"
      >
        <i data-lucide="${item.icon}" class="nav-item__icon" aria-hidden="true"></i>
        <span class="nav-item__label">${item.label}</span>
        ${item.badge ? `<span class="nav-item__badge">${item.badge}</span>` : ''}
      </button>
    `;
  }

  navHtml += '</div></nav>'; // close last section + nav

  sidebar.innerHTML = `
    <div class="sidebar__logo" title="Back to Landing Page Overview" style="cursor: pointer;">
      <img src="/favicon-32x32.png" class="sidebar__logo-icon" alt="PDF Swiss-Knife" style="border-radius:5px;object-fit:contain;" />
      <span class="sidebar__logo-text">PDF Swiss-Knife</span>
    </div>
    ${navHtml}
  `;

  // Logo click returns to landing page
  sidebar.querySelector('.sidebar__logo')?.addEventListener('click', () => {
    window.location.hash = '#/';
  });

  // Wire nav clicks
  sidebar.querySelectorAll('.nav-item[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.tool);
      // Update aria-current
      sidebar.querySelectorAll('.nav-item').forEach(n => n.setAttribute('aria-current', 'false'));
      btn.setAttribute('aria-current', 'page');
    });
  });
}

function buildTopbar() {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;
  topbar.innerHTML = `
    <button id="topbar-landing-btn" class="btn btn--ghost" title="Back to Landing Page Overview" style="font-size: 12px; gap: 4px; padding: 4px 8px; margin-right: 8px;">
      <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i>
      <span>Overview</span>
    </button>
    <div id="topbar-breadcrumb" class="topbar__breadcrumb" aria-label="Current location">
      <span class="current">Home</span>
    </div>
    <div class="topbar__spacer"></div>
    <div class="topbar__actions">

      <div class="theme-toggle" role="group" aria-label="Theme selection" id="topbar-theme-toggle">
        <button class="theme-toggle__btn" data-theme-value="light" title="Light theme" aria-label="Light theme">
          <i data-lucide="sun"></i>
        </button>
        <button class="theme-toggle__btn" data-theme-value="system" title="Follow system theme" aria-label="Follow system theme">
          <i data-lucide="monitor"></i>
        </button>
        <button class="theme-toggle__btn" data-theme-value="dark" title="Dark theme" aria-label="Dark theme">
          <i data-lucide="moon"></i>
        </button>
      </div>
    </div>
  `;

  document.getElementById('topbar-landing-btn')?.addEventListener('click', () => {
    window.location.hash = '#/';
  });

  topbar.querySelectorAll('.theme-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeValue));
  });
}

// ─── Boot ──────────────────────────────────────────────────────────────────

async function boot() {
  // 1. Apply saved theme before anything renders (prevents flash)
  const savedTheme = getSavedTheme();
  document.documentElement.setAttribute('data-theme',
    savedTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : savedTheme
  );

  // 2. Build the static shell (sidebar, topbar)
  buildSidebar();
  buildTopbar();

  // 3. Apply theme properly (also updates toggle button states everywhere)
  applyTheme(savedTheme);

  // 4. Initialise landing page hero scrubbing and interaction handlers
  initLandingPage({
    onOpenApp: (toolId) => {
      window.location.hash = `#/app/${toolId || 'home'}`;
    }
  });

  // 5. Wire all theme toggle buttons across the whole document (landing + app)
  document.querySelectorAll('.theme-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeValue));
  });

  // 6. Listen for hash routing
  window.addEventListener('hashchange', handleRoute);

  // 7. Initial route resolution
  handleRoute();

  // 8. Render Lucide icons
  if (window.lucide) window.lucide.createIcons();

  // 9. Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getSavedTheme() === 'system') applyTheme('system');
  });
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', boot);
