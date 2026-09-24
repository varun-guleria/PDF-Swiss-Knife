/**
 * tools/organize.js — Page Organization Tool.
 *
 * Allows users to inspect a PDF, view visual page thumbnails,
 * reorder pages via drag-and-drop, rotate individual or all pages,
 * duplicate pages, delete pages, and export the reorganized document.
 */

'use strict';

import * as api from '../api.js';
import { isPdf, escapeHtml, recordRecentJob } from '../utils.js';
import { createDropzone } from '../components/dropzone.js';
import { createProgressView } from '../components/progress.js';
import { confirmDialog, alertDialog } from '../components/dialog.js';

/**
 * Render the Organize Pages tool.
 * @param {HTMLElement} container
 */
export function renderOrganize(container) {
  let docId = null;
  let docFilename = '';
  let pages = []; // Array of { originalIndex, rotation: 0, uid: string }
  let isProcessing = false;

  const panel = document.createElement('div');
  panel.className = 'tool-panel';

  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Organise Pages</h1>
      <p class="page-header__subtitle">Visual page management: reorder, rotate, duplicate, or remove pages.</p>
    </div>

    <div id="organize-workspace" class="workspace-flow">
      <!-- Dropzone (initial upload) -->
      <div id="organize-dropzone-container"></div>

      <!-- Loading skeleton / inspection spinner -->
      <div id="organize-loading" class="workspace-section" style="display:none;">
        <div style="text-align:center;padding:var(--space-12);">
          <div class="spinner spinner--lg" style="margin:0 auto var(--space-4);"></div>
          <div style="font-size:var(--font-size-md);font-weight:var(--font-weight-medium);">Inspecting PDF & generating thumbnails…</div>
          <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-top:var(--space-2);">This takes only a moment.</div>
        </div>
      </div>

      <!-- Pages Workspace -->
      <div id="organize-pages-card" class="workspace-section" style="display:none;">
        <div class="workspace-section__header" style="flex-wrap:wrap;gap:var(--space-4);">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="layout-grid" style="width:16px;height:16px;color:var(--color-brand);"></i>
            <span id="organize-doc-title" class="workspace-section__title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;">Document</span>
            <span id="organize-page-count-badge" class="badge badge--default">0 pages</span>
          </div>

          <!-- Batch Action Controls -->
          <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">
            <button type="button" id="organize-rotate-ccw-all" class="btn btn--secondary btn--sm" title="Rotate all pages counter-clockwise">
              <i data-lucide="rotate-ccw"></i>
              <span>Rotate All -90°</span>
            </button>
            <button type="button" id="organize-rotate-cw-all" class="btn btn--secondary btn--sm" title="Rotate all pages clockwise">
              <i data-lucide="rotate-cw"></i>
              <span>Rotate All +90°</span>
            </button>
            <button type="button" id="organize-reset-all" class="btn btn--ghost btn--sm" title="Reset all changes back to original order">
              <i data-lucide="history"></i>
              <span>Reset</span>
            </button>
            <button type="button" id="organize-change-file" class="btn btn--ghost btn--sm btn--danger" title="Load a different PDF">
              <i data-lucide="file-x"></i>
              <span>Change File</span>
            </button>
          </div>
        </div>

        <div style="padding:var(--space-5);">
          <div id="organize-grid" class="pages-grid" role="list" aria-label="Page thumbnail list"></div>
        </div>

        <div style="padding:var(--space-3) var(--space-4);background:var(--color-bg-sunken);border-top:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);">
          <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;min-width:260px;">
            <label for="organize-output-name" style="font-size:var(--font-size-xs);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);white-space:nowrap;">Output Name:</label>
            <input type="text" id="organize-output-name" class="input" value="organized_document.pdf" style="max-width:280px;" />
          </div>

          <div style="display:flex;align-items:center;gap:var(--space-4);">
            <button type="button" id="organize-save-btn" class="btn btn--primary btn--lg">
              <i data-lucide="download"></i>
              <span>Save Organized PDF</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Progress Container -->
      <div id="organize-progress-container" style="display:none;"></div>

      <!-- Illustration -->
      <div id="organize-illustration" style="text-align:center;margin-top:var(--space-8);padding-bottom:var(--space-8);transform:translateX(250px);"><img src="/assets/organize-illustration.svg" alt="Organize Pages Illustration" style="max-width:100%;height:auto;max-height:280px;object-fit:contain;opacity:0.9;" /></div>
    </div>
  `;

  container.appendChild(panel);

  const dropzoneContainer = panel.querySelector('#organize-dropzone-container');
  const loadingCard = panel.querySelector('#organize-loading');
  const pagesCard = panel.querySelector('#organize-pages-card');
  const docTitle = panel.querySelector('#organize-doc-title');
  const pageCountBadge = panel.querySelector('#organize-page-count-badge');
  const gridEl = panel.querySelector('#organize-grid');
  const rotateCcwAllBtn = panel.querySelector('#organize-rotate-ccw-all');
  const rotateCwAllBtn = panel.querySelector('#organize-rotate-cw-all');
  const resetAllBtn = panel.querySelector('#organize-reset-all');
  const changeFileBtn = panel.querySelector('#organize-change-file');
  const saveBtn = panel.querySelector('#organize-save-btn');
  const outputNameInput = panel.querySelector('#organize-output-name');
  const progressContainer = panel.querySelector('#organize-progress-container');
  const illustrationEl = panel.querySelector('#organize-illustration');

  let originalInspectData = null;
  let draggedIndex = null;

  function renderGrid() {
    gridEl.innerHTML = '';
    pageCountBadge.textContent = `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`;
    saveBtn.disabled = pages.length === 0 || isProcessing;

    if (pages.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:var(--space-8); color:var(--color-text-secondary);">
          All pages removed. Click <strong>Reset</strong> to restore original pages.
        </div>
      `;
      return;
    }

    pages.forEach((pageItem, index) => {
      const card = document.createElement('div');
      card.className = 'page-card';
      card.setAttribute('role', 'listitem');
      card.dataset.index = String(index);

      const thumbUrl = api.getPageThumbnailUrl(docId, pageItem.originalIndex);
      const rot = pageItem.rotation || 0;
      const rotBadge = rot !== 0 ? `<div class="page-card__rotation-badge">${rot > 0 ? '+' : ''}${rot}°</div>` : '';

      card.innerHTML = `
        <div class="page-card__thumb-wrap" draggable="true" title="Drag to reorder">
          <div class="page-card__badge">Page ${index + 1}</div>
          ${rotBadge}
          <img
            src="${thumbUrl}"
            alt="Page ${pageItem.originalIndex + 1}"
            class="page-card__thumb"
            style="transform: rotate(${rot}deg);"
            loading="lazy"
          />
        </div>
        <div class="page-card__actions">
          <button type="button" class="page-card__btn page-card__btn-rotate-ccw" title="Rotate Counter-Clockwise 90°">
            <i data-lucide="rotate-ccw"></i>
          </button>
          <button type="button" class="page-card__btn page-card__btn-rotate-cw" title="Rotate Clockwise 90°">
            <i data-lucide="rotate-cw"></i>
          </button>
          <button type="button" class="page-card__btn page-card__btn-duplicate" title="Duplicate Page">
            <i data-lucide="copy"></i>
          </button>
          <button type="button" class="page-card__btn page-card__btn--danger page-card__btn-delete" title="Delete Page">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // ── Actions ───────────────────────────────────────────────────
      const thumbWrap = card.querySelector('.page-card__thumb-wrap');

      // Drag & Drop
      thumbWrap.addEventListener('dragstart', (e) => {
        draggedIndex = index;
        card.classList.add('page-card--dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      });

      thumbWrap.addEventListener('dragend', () => {
        card.classList.remove('page-card--dragging');
        gridEl.querySelectorAll('.page-card--drag-over').forEach(el => el.classList.remove('page-card--drag-over'));
        draggedIndex = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedIndex !== null && draggedIndex !== index) {
          card.classList.add('page-card--drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('page-card--drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('page-card--drag-over');
        if (draggedIndex === null || draggedIndex === index) return;

        const moved = pages.splice(draggedIndex, 1)[0];
        pages.splice(index, 0, moved);
        renderGrid();
      });

      // Rotation buttons
      card.querySelector('.page-card__btn-rotate-ccw').addEventListener('click', () => {
        pageItem.rotation = (pageItem.rotation - 90 + 360) % 360;
        renderGrid();
      });

      card.querySelector('.page-card__btn-rotate-cw').addEventListener('click', () => {
        pageItem.rotation = (pageItem.rotation + 90) % 360;
        renderGrid();
      });

      // Duplicate button
      card.querySelector('.page-card__btn-duplicate').addEventListener('click', () => {
        const cloned = { ...pageItem, uid: Math.random().toString(36).slice(2, 9) };
        pages.splice(index + 1, 0, cloned);
        renderGrid();
      });

      // Delete button
      card.querySelector('.page-card__btn-delete').addEventListener('click', () => {
        pages.splice(index, 1);
        renderGrid();
      });

      gridEl.appendChild(card);
    });

    if (window.lucide) {
      window.lucide.createIcons({ node: gridEl });
    }
  }

  async function handlePdfUpload(files) {
    const pdfFile = files.find(isPdf);
    if (!pdfFile) return;

    docFilename = pdfFile.name;
    dropzoneContainer.style.display = 'none';
    loadingCard.style.display = 'block';
    if (illustrationEl) illustrationEl.style.display = 'none';

    try {
      const inspectData = await api.inspectPdf(pdfFile);
      originalInspectData = inspectData;
      docId = inspectData.doc_id;

      pages = (inspectData.pages || []).map(p => ({
        originalIndex: p.index,
        rotation: 0,
        uid: Math.random().toString(36).slice(2, 9),
      }));

      docTitle.textContent = escapeHtml(docFilename);
      outputNameInput.value = docFilename.replace(/\.pdf$/i, '_organized.pdf');

      loadingCard.style.display = 'none';
      pagesCard.style.display = 'block';
      renderGrid();
    } catch (err) {
      loadingCard.style.display = 'none';
      dropzoneContainer.style.display = 'block';
      await alertDialog('Failed to Open PDF', err.message || 'Could not inspect PDF.');
    }
  }

  // Setup Initial Dropzone
  createDropzone({
    container: dropzoneContainer,
    accept: '.pdf,application/pdf',
    multiple: false,
    title: 'Choose a PDF to organise',
    subtitle: 'Upload a document to inspect and arrange its pages',
    icon: 'layout-grid',
    onFiles: handlePdfUpload,
  });

  // Batch Rotate Clockwise
  rotateCwAllBtn.addEventListener('click', () => {
    pages.forEach(p => { p.rotation = (p.rotation + 90) % 360; });
    renderGrid();
  });

  // Batch Rotate Counter-Clockwise
  rotateCcwAllBtn.addEventListener('click', () => {
    pages.forEach(p => { p.rotation = (p.rotation - 90 + 360) % 360; });
    renderGrid();
  });

  // Reset to original state
  resetAllBtn.addEventListener('click', async () => {
    if (!originalInspectData) return;
    const ok = await confirmDialog('Reset Pages', 'Reset all pages back to their original document order and rotation?');
    if (ok) {
      pages = (originalInspectData.pages || []).map(p => ({
        originalIndex: p.index,
        rotation: 0,
        uid: Math.random().toString(36).slice(2, 9),
      }));
      renderGrid();
    }
  });

  // Change file
  changeFileBtn.addEventListener('click', async () => {
    const ok = await confirmDialog('Change Document', 'Discard current changes and choose another PDF?');
    if (ok) {
      pages = [];
      docId = null;
      pagesCard.style.display = 'none';
      dropzoneContainer.style.display = 'block';
      if (illustrationEl) illustrationEl.style.display = 'block';
    }
  });

  // Save reorganized PDF
  saveBtn.addEventListener('click', async () => {
    if (pages.length === 0 || isProcessing) return;

    isProcessing = true;
    pagesCard.style.display = 'none';
    progressContainer.style.display = 'block';
    progressContainer.innerHTML = '';

    const outputName = outputNameInput.value.trim() || 'organized_document.pdf';

    const progressView = createProgressView({
      container: progressContainer,
      title: 'Saving Organized PDF…',
      total: pages.length,
    });

    try {
      progressView.update({
        percent: 20,
        current: 0,
        total: pages.length,
        message: 'Applying rotations and page order…',
        status: 'Processing',
      });

      const pageSpecs = pages.map(p => ({
        index: p.originalIndex,
        rotation: p.rotation,
      }));

      const { job_id } = await api.reorganizePdf(docId, pageSpecs, outputName);

      await api.pollJob(job_id, (job) => {
        progressView.update({
          current: job.current || 0,
          total: job.total || pages.length,
          message: job.message || 'Saving document…',
          status: 'Processing',
        });
      });

      // Complete
      recordRecentJob('Organise Pages', outputName, `/api/output/${job_id}/download/${encodeURIComponent(outputName)}`);

      progressView.showSuccess({
        title: 'Document Organized',
        message: `Successfully generated ${outputName} with ${pages.length} pages.`,
        actions: [
          {
            label: 'Download Organized PDF',
            icon: 'download',
            variant: 'primary',
            onClick: () => api.downloadFile(job_id, outputName),
          },
          {
            label: 'Keep Editing',
            icon: 'arrow-left',
            variant: 'secondary',
            onClick: () => {
              isProcessing = false;
              progressContainer.style.display = 'none';
              pagesCard.style.display = 'block';
              renderGrid();
            },
          },
          {
            label: 'Organize Another File',
            icon: 'refresh-cw',
            variant: 'secondary',
            onClick: () => {
              isProcessing = false;
              pages = [];
              docId = null;
              progressContainer.style.display = 'none';
              dropzoneContainer.style.display = 'block';
            },
          },
        ],
      });
    } catch (err) {
      progressView.showError({
        title: 'Save Failed',
        message: err.message || 'An error occurred while organizing your PDF pages.',
        onRetry: () => {
          saveBtn.click();
        },
        onReset: () => {
          isProcessing = false;
          progressContainer.style.display = 'none';
          pagesCard.style.display = 'block';
          renderGrid();
        },
      });
    }
  });

  if (window.lucide) {
    window.lucide.createIcons({ node: panel });
  }
}
