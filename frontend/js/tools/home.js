/**
 * tools/home.js — Home panel renderer.
 *
 * Shows an overview of all available tools as clickable cards.
 * Each card navigates to the corresponding tool when clicked.
 */

'use strict';

import { escapeHtml } from '../utils.js';

/** Tool definitions — must match nav item IDs in app.js */
const TOOLS = [
  {
    section: 'Organise',
    items: [
      { id: 'merge',    icon: 'layers',        title: 'Merge PDFs',       desc: 'Combine multiple PDFs into one document' },
      { id: 'split',    icon: 'scissors',      title: 'Split PDF',        desc: 'Divide a PDF into separate documents' },
      { id: 'organize', icon: 'layout-grid',   title: 'Organise Pages',   desc: 'Reorder, delete, and manage pages' },
      { id: 'extract',  icon: 'copy',          title: 'Extract Pages',    desc: 'Pull specific pages into a new PDF' },
    ],
  },
  {
    section: 'Edit',
    items: [
      { id: 'rotate',       icon: 'rotate-cw',     title: 'Rotate Pages',     desc: 'Rotate pages by 90° or 180°' },
      { id: 'crop',         icon: 'crop',          title: 'Crop Pages',       desc: 'Adjust page boundaries' },
      { id: 'watermark',    icon: 'droplets',      title: 'Watermark',        desc: 'Add text or image watermarks' },
      { id: 'pagenumbers',  icon: 'hash',          title: 'Page Numbers',     desc: 'Add page numbers to a PDF' },
      { id: 'headerfooter', icon: 'align-center',  title: 'Header & Footer',  desc: 'Add custom header and footer text' },
    ],
  },
  {
    section: 'Convert',
    items: [
      { id: 'toImages', icon: 'image',         title: 'PDF → Images',     desc: 'Export each page as an image' },
      { id: 'toPdf',    icon: 'file-image',    title: 'Images → PDF',     desc: 'Combine images into a PDF' },
    ],
  },
  {
    section: 'Optimise',
    items: [
      { id: 'compress', icon: 'archive',       title: 'Compress',         desc: 'Reduce file size' },
      { id: 'repair',   icon: 'wrench',        title: 'Repair',           desc: 'Fix corrupt or non-standard PDFs' },
      { id: 'info',     icon: 'info',          title: 'PDF Information',  desc: 'View metadata and file details' },
    ],
  },
  {
    section: 'Security',
    items: [
      { id: 'protect',   icon: 'lock',         title: 'Protect PDF',      desc: 'Add a password to a PDF' },
      { id: 'unprotect', icon: 'lock-open',    title: 'Remove Protection',desc: 'Remove password from a PDF' },
    ],
  },
  {
    section: 'Advanced',
    items: [
      { id: 'batch', icon: 'layers', title: 'Custom Batch Builder', desc: 'Generate one PDF per unique file with shared cover pages' },
    ],
  },
];

/**
 * Render the home panel into a container element.
 * @param {HTMLElement} container
 * @param {(toolId: string) => void} navigate  — callback to switch tool
 */
export function renderHome(container, navigate) {
  let html = '<div class="tool-panel">';
  html += `
    <div class="page-header">
      <h1 class="page-header__title">PDF Swiss-Knife</h1>
      <p class="page-header__subtitle">Choose a tool to get started. All processing happens locally on your computer.</p>
    </div>
  `;

  for (const section of TOOLS) {
    html += `
      <div style="margin-bottom: var(--space-8);">
        <div class="settings-section__title" style="margin-bottom: var(--space-4);">${escapeHtml(section.section)}</div>
        <div class="home-grid">
    `;
    for (const tool of section.items) {
      html += `
        <button
          class="home-card"
          data-tool="${tool.id}"
          aria-label="Open ${escapeHtml(tool.title)}"
        >
          <div class="home-card__icon-wrap">
            <i data-lucide="${tool.icon}" class="home-card__icon"></i>
          </div>
          <div>
            <div class="home-card__title">${escapeHtml(tool.title)}</div>
            <div class="home-card__desc">${escapeHtml(tool.desc)}</div>
          </div>
        </button>
      `;
    }
    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;

  // Initialise Lucide icons inside the newly rendered HTML
  if (window.lucide) window.lucide.createIcons({ node: container });

  // Wire up click handlers
  container.querySelectorAll('.home-card[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tool));
  });
}
