/**
 * tools/home.js — Task-oriented home panel for PDF Swiss-Knife.
 *
 * Replaces the repetitive card grid with a clear, desktop productivity interface:
 * 1. "What would you like to do?" — Common actions (Merge, Split, Organise, Convert)
 * 2. Categorized desktop directory of all utilities
 * 3. Recent activity section with clean empty state
 */

'use strict';

import { escapeHtml } from '../utils.js';

/** Primary common actions */
const COMMON_ACTIONS = [
  {
    id: 'merge',
    icon: 'layers',
    title: 'Merge PDFs',
    desc: 'Combine multiple documents into one single PDF',
    hint: 'Combine files',
  },
  {
    id: 'split',
    icon: 'scissors',
    title: 'Split PDF',
    desc: 'Divide a PDF into separate documents or custom ranges',
    hint: 'Divide document',
  },
  {
    id: 'organize',
    icon: 'layout-grid',
    title: 'Organise Pages',
    desc: 'Visual preview to reorder, delete, duplicate, or rotate pages',
    hint: 'Manage pages',
  },
  {
    id: 'toImages',
    icon: 'file-output',
    title: 'Convert',
    desc: 'Convert PDF pages to images or combine images into a PDF',
    hint: 'Convert files',
  },
];

/** All tools grouped by category for the structured directory */
const TOOL_DIRECTORY = [
  {
    category: 'Organise',
    items: [
      { id: 'extract', icon: 'copy', title: 'Extract Pages', desc: 'Pull specific pages into a new document' },
    ],
  },
  {
    category: 'Edit',
    items: [
      { id: 'rotate',       icon: 'rotate-cw',    title: 'Rotate Pages',    desc: 'Rotate pages by 90°, 180°, or 270°' },
      { id: 'crop',         icon: 'crop',         title: 'Crop Pages',      desc: 'Trim margins with pt, mm, in, or % units' },
      { id: 'watermark',    icon: 'droplets',     title: 'Watermark',       desc: 'Add text stamp with opacity & position' },
      { id: 'pagenumbers',  icon: 'hash',         title: 'Page Numbers',    desc: 'Insert custom header or footer numbering' },
      { id: 'headerfooter', icon: 'align-center', title: 'Header & Footer', desc: 'Add running headers and footers' },
    ],
  },
  {
    category: 'Convert',
    items: [
      { id: 'toImages', icon: 'image',      title: 'PDF → Images', desc: 'Export each page as high-res PNG or JPEG' },
      { id: 'toPdf',    icon: 'file-image', title: 'Images → PDF', desc: 'Assemble images into a single document' },
    ],
  },
  {
    category: 'Optimise',
    items: [
      { id: 'compress', icon: 'archive', title: 'Compress', desc: 'Reduce file size with configurable quality' },
      { id: 'repair',   icon: 'wrench',  title: 'Repair / Normalize', desc: 'Fix corrupt structure and linearize' },
      { id: 'info',     icon: 'info',    title: 'PDF Information', desc: 'Inspect metadata, fonts, and dimensions' },
    ],
  },
  {
    category: 'Security',
    items: [
      { id: 'protect',   icon: 'lock',   title: 'Protect PDF', desc: 'Encrypt with 256-bit AES password' },
      { id: 'unprotect', icon: 'unlock', title: 'Remove Protection', desc: 'Strip password from unlocked PDF' },
    ],
  },
  {
    category: 'Advanced',
    items: [
      { id: 'batch', icon: 'layers', title: 'Custom Batch PDF Builder', desc: 'Merge repeating cover pages with unique student/client documents', badge: 'PRO' },
    ],
  },
];

/**
 * Render the home panel into a container element.
 * @param {HTMLElement} container
 * @param {(toolId: string) => void} navigate
 */
export function renderHome(container, navigate) {
  // Check for any recent session activity
  let recentJobs = [];
  try {
    const raw = localStorage.getItem('psk-recent-activity');
    if (raw) recentJobs = JSON.parse(raw);
  } catch {
    recentJobs = [];
  }

  let html = `
    <div class="tool-panel home-panel">
      <div class="page-header">
        <h1 class="page-header__title">PDF Swiss-Knife</h1>
        <p class="page-header__subtitle">Work with your PDF files locally on this computer. All processing happens offline.</p>
      </div>

      <!-- ── Section 1: Common Actions ──────────────────────────────── -->
      <section class="home-section" aria-labelledby="home-common-heading">
        <div class="home-section__header">
          <h2 id="home-common-heading" class="home-section__title">What would you like to do?</h2>
          <span class="home-section__subtitle">Common actions</span>
        </div>

        <div class="home-common-grid">
  `;

  for (const action of COMMON_ACTIONS) {
    html += `
      <button
        type="button"
        class="home-action-tile"
        data-tool="${action.id}"
        aria-label="${escapeHtml(action.title)}: ${escapeHtml(action.desc)}"
      >
        <div class="home-action-tile__icon-box">
          <i data-lucide="${action.icon}"></i>
        </div>
        <div class="home-action-tile__content">
          <div class="home-action-tile__title">${escapeHtml(action.title)}</div>
          <div class="home-action-tile__desc">${escapeHtml(action.desc)}</div>
        </div>
        <div class="home-action-tile__affordance" aria-hidden="true">
          <span>${escapeHtml(action.hint)}</span>
          <i data-lucide="arrow-right"></i>
        </div>
      </button>
    `;
  }

  html += `
        </div>
      </section>

      <!-- ── Section 2: All Tools Directory ────────────────────────── -->
      <section class="home-section" aria-labelledby="home-directory-heading">
        <div class="home-section__header">
          <h2 id="home-directory-heading" class="home-section__title">All Tools & Utilities</h2>
          <span class="home-section__subtitle">Complete offline toolset</span>
        </div>

        <div class="home-directory-container">
  `;

  for (const cat of TOOL_DIRECTORY) {
    html += `
      <div class="home-dir-category">
        <div class="home-dir-category__label">${escapeHtml(cat.category)}</div>
        <div class="home-dir-category__list">
    `;

    for (const item of cat.items) {
      html += `
        <button
          type="button"
          class="home-dir-row"
          data-tool="${item.id}"
          aria-label="Open ${escapeHtml(item.title)}"
        >
          <div class="home-dir-row__icon">
            <i data-lucide="${item.icon}"></i>
          </div>
          <div class="home-dir-row__title">${escapeHtml(item.title)}</div>
          <div class="home-dir-row__desc">${escapeHtml(item.desc)}</div>
          ${item.badge ? `<span class="badge badge--default">${escapeHtml(item.badge)}</span>` : ''}
          <div class="home-dir-row__arrow">
            <i data-lucide="chevron-right"></i>
          </div>
        </button>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  html += `
        </div>
      </section>

      <!-- ── Section 3: Recent Activity ────────────────────────────── -->
      <section class="home-section" aria-labelledby="home-recent-heading">
        <div class="home-section__header">
          <h2 id="home-recent-heading" class="home-section__title">Recent Activity</h2>
          <span class="home-section__subtitle">Session history</span>
        </div>
  `;

  if (recentJobs && recentJobs.length > 0) {
    html += `
      <div class="file-manager">
        <div class="file-list__header">
          <div class="file-list__th" style="flex:1;">Processed Output</div>
          <div class="file-list__th" style="width:120px;text-align:right;">Tool</div>
          <div class="file-list__th" style="width:120px;text-align:right;padding-right:var(--space-3);">Action</div>
        </div>
        <div class="file-list">
    `;
    for (const job of recentJobs.slice(0, 5)) {
      html += `
        <div class="file-row">
          <div class="file-row__icon"><i data-lucide="file-check"></i></div>
          <div class="file-row__info">
            <div class="file-row__name">${escapeHtml(job.filename || 'Document.pdf')}</div>
            <div class="file-row__meta">${escapeHtml(job.time || '')}</div>
          </div>
          <div style="width:120px;text-align:right;font-size:var(--font-size-xs);color:var(--color-text-secondary);">
            ${escapeHtml(job.tool || '')}
          </div>
          <div style="width:120px;text-align:right;">
            ${job.downloadUrl ? `<a href="${escapeHtml(job.downloadUrl)}" class="btn btn--secondary btn--sm" download>Download</a>` : ''}
          </div>
        </div>
      `;
    }
    html += `</div></div>`;
  } else {
    html += `
      <div class="empty-state">
        <i data-lucide="clock" class="empty-state__icon"></i>
        <div class="empty-state__title">No recent activity</div>
        <div class="empty-state__text">Files and documents you process during this session will appear here for quick access.</div>
      </div>
    `;
  }

  html += `
      </section>
    </div>
  `;

  container.innerHTML = html;

  // Initialise Lucide icons inside newly rendered HTML
  if (window.lucide) window.lucide.createIcons({ node: container });

  // Wire up click handlers
  container.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tool));
  });
}
