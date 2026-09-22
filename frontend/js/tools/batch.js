/**
 * tools/batch.js — Custom Batch PDF Builder Tool.
 *
 * Allows users to define repeating PDFs (common pages merged into every output)
 * and unique PDFs (one per output document). Generates N output PDFs in the
 * background with live progress tracking and ZIP download.
 *
 * Output count = len(unique_pdfs).
 * Each output = repeating PDFs (in order) + one unique PDF.
 */

'use strict';

import * as api from '../api.js';
import { isPdf, formatFileSize, escapeHtml } from '../utils.js';
import { createDropzone } from '../components/dropzone.js';
import { createFileList } from '../components/fileRow.js';
import { createProgressView } from '../components/progress.js';
import { confirmDialog } from '../components/dialog.js';

/**
 * Render the Batch Builder tool panel.
 * @param {HTMLElement} container - Target container element
 */
export function renderBatch(container) {
  let repeatingFiles = [];  // Array of File objects
  let uniqueFiles = [];     // Array of File objects
  let repeatingListComponent = null;
  let uniqueListComponent = null;
  let isProcessing = false;

  const panel = document.createElement('div');
  panel.className = 'tool-panel';

  panel.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);">
        <div>
          <h1 class="page-header__title">Batch PDF Builder</h1>
          <p class="page-header__subtitle">Combine repeating pages with unique documents to generate multiple personalised PDFs in one batch.</p>
        </div>
        <span class="badge badge--brand" style="font-size:var(--font-size-xs);">PRO</span>
      </div>
    </div>

    <!-- Main Workspace Container -->
    <div id="batch-workspace" class="tool-workspace" style="display:flex;flex-direction:column;gap:var(--space-6);">

      <!-- How It Works -->
      <div class="card" style="border-left:3px solid var(--color-brand);">
        <div class="card__body" style="padding:var(--space-4) var(--space-5);">
          <div style="display:flex;align-items:flex-start;gap:var(--space-4);">
            <i data-lucide="info" style="width:20px;height:20px;color:var(--color-brand);flex-shrink:0;margin-top:2px;"></i>
            <div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);line-height:1.6;">
              <strong style="color:var(--color-text-primary);">How it works:</strong>
              Upload <strong>repeating PDFs</strong> (pages that appear in every output) and <strong>unique PDFs</strong> (one per output document).
              The builder will generate one merged PDF for each unique file, combining the repeating pages + that unique file.
            </div>
          </div>
        </div>
      </div>

      <!-- ── Section 1: Repeating PDFs ─────────────────────────────── -->
      <div class="card" id="batch-repeating-card">
        <div class="card__header" style="justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="repeat" style="width:18px;height:18px;color:var(--color-brand);"></i>
            <div class="card__title">Repeating PDFs</div>
            <span id="batch-repeating-count" class="badge badge--default">0 files</span>
          </div>
          <button type="button" id="batch-repeating-clear" class="btn btn--ghost btn--sm btn--danger" style="display:none;">
            <i data-lucide="trash-2"></i>
            <span>Clear</span>
          </button>
        </div>

        <div class="card__body" style="padding:0;">
          <div style="padding:var(--space-3) var(--space-5);background:var(--color-surface-secondary);border-bottom:1px solid var(--color-border);">
            <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">
              These pages will appear at the <strong>start</strong> of every output document, in the order shown below.
            </span>
          </div>
          <div id="batch-repeating-dropzone" style="padding:var(--space-4);"></div>
          <div id="batch-repeating-list"></div>
        </div>
      </div>

      <!-- ── Section 2: Unique PDFs ────────────────────────────────── -->
      <div class="card" id="batch-unique-card">
        <div class="card__header" style="justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="file-plus" style="width:18px;height:18px;color:var(--color-warning);"></i>
            <div class="card__title">Unique PDFs</div>
            <span id="batch-unique-count" class="badge badge--default">0 files</span>
          </div>
          <button type="button" id="batch-unique-clear" class="btn btn--ghost btn--sm btn--danger" style="display:none;">
            <i data-lucide="trash-2"></i>
            <span>Clear</span>
          </button>
        </div>

        <div class="card__body" style="padding:0;">
          <div style="padding:var(--space-3) var(--space-5);background:var(--color-surface-secondary);border-bottom:1px solid var(--color-border);">
            <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">
              One output PDF will be generated <strong>for each</strong> unique file uploaded here.
            </span>
          </div>
          <div id="batch-unique-dropzone" style="padding:var(--space-4);"></div>
          <div id="batch-unique-list"></div>
        </div>
      </div>

      <!-- ── Section 3: Preview Summary & Generate ─────────────────── -->
      <div class="card" id="batch-summary-card" style="display:none;">
        <div class="card__body">
          <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-6);flex-wrap:wrap;">
            <div style="text-align:center;">
              <div style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-bold);color:var(--color-brand);" id="batch-summary-repeating">0</div>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Repeating</div>
            </div>
            <div style="font-size:var(--font-size-xl);color:var(--color-text-tertiary);">×</div>
            <div style="text-align:center;">
              <div style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-bold);color:var(--color-warning);" id="batch-summary-unique">0</div>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Unique</div>
            </div>
            <div style="font-size:var(--font-size-xl);color:var(--color-text-tertiary);">→</div>
            <div style="text-align:center;">
              <div style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-bold);color:var(--color-success);" id="batch-summary-output">0</div>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Output PDFs</div>
            </div>
          </div>
        </div>

        <div class="card__footer" style="justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);">
          <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">
            Each output: <span id="batch-naming-preview" style="font-family:var(--font-mono);"></span>
          </div>
          <button type="button" id="batch-generate-btn" class="btn btn--primary btn--lg" disabled>
            <i data-lucide="zap"></i>
            <span>Generate Batch</span>
          </button>
        </div>
      </div>

      <!-- ── Progress / Results Container ──────────────────────────── -->
      <div id="batch-progress-container" style="display:none;"></div>

    </div>
  `;

  container.appendChild(panel);

  // ── DOM refs ──────────────────────────────────────────────────────────
  const repeatingDropzoneEl = panel.querySelector('#batch-repeating-dropzone');
  const repeatingListEl = panel.querySelector('#batch-repeating-list');
  const repeatingCountBadge = panel.querySelector('#batch-repeating-count');
  const repeatingClearBtn = panel.querySelector('#batch-repeating-clear');

  const uniqueDropzoneEl = panel.querySelector('#batch-unique-dropzone');
  const uniqueListEl = panel.querySelector('#batch-unique-list');
  const uniqueCountBadge = panel.querySelector('#batch-unique-count');
  const uniqueClearBtn = panel.querySelector('#batch-unique-clear');

  const summaryCard = panel.querySelector('#batch-summary-card');
  const summaryRepeating = panel.querySelector('#batch-summary-repeating');
  const summaryUnique = panel.querySelector('#batch-summary-unique');
  const summaryOutput = panel.querySelector('#batch-summary-output');
  const namingPreview = panel.querySelector('#batch-naming-preview');
  const generateBtn = panel.querySelector('#batch-generate-btn');
  const progressContainer = panel.querySelector('#batch-progress-container');

  const workspace = panel.querySelector('#batch-workspace');

  // ── UI State Updater ─────────────────────────────────────────────────
  function updateUiState() {
    const rCount = repeatingFiles.length;
    const uCount = uniqueFiles.length;

    repeatingCountBadge.textContent = `${rCount} ${rCount === 1 ? 'file' : 'files'}`;
    uniqueCountBadge.textContent = `${uCount} ${uCount === 1 ? 'file' : 'files'}`;

    repeatingClearBtn.style.display = rCount > 0 ? '' : 'none';
    uniqueClearBtn.style.display = uCount > 0 ? '' : 'none';

    // Show summary card when both sections have files
    if (rCount > 0 && uCount > 0) {
      summaryCard.style.display = 'block';
      summaryRepeating.textContent = String(rCount);
      summaryUnique.textContent = String(uCount);
      summaryOutput.textContent = String(uCount);

      // Preview naming convention
      if (uniqueFiles.length > 0) {
        const sampleName = uniqueFiles[0].name.replace(/\.pdf$/i, '') + '_merged.pdf';
        namingPreview.textContent = sampleName;
      }

      generateBtn.disabled = isProcessing;
      generateBtn.title = `Generate ${uCount} output PDFs`;
    } else {
      summaryCard.style.display = 'none';
      generateBtn.disabled = true;
    }
  }

  // ── Repeating Files ──────────────────────────────────────────────────
  function addRepeatingFiles(newFiles) {
    const valid = newFiles.filter(isPdf);
    if (valid.length === 0) return;

    repeatingFiles.push(...valid);

    if (!repeatingListComponent) {
      repeatingListComponent = createFileList({
        container: repeatingListEl,
        files: repeatingFiles.map(f => ({ file: f })),
        onReorder: (newItems) => {
          repeatingFiles = newItems.map(item => item.file || item);
          updateUiState();
        },
        onRemove: (removedIndex) => {
          repeatingFiles.splice(removedIndex, 1);
          updateUiState();
        },
      });
    } else {
      repeatingListComponent.update(repeatingFiles.map(f => ({ file: f })));
    }

    updateUiState();
    if (window.lucide) window.lucide.createIcons({ node: panel });
  }

  createDropzone({
    container: repeatingDropzoneEl,
    accept: '.pdf,application/pdf',
    multiple: true,
    compact: true,
    title: 'Add repeating PDF files',
    subtitle: 'Pages shared across all outputs',
    icon: 'plus',
    onFiles: addRepeatingFiles,
  });

  repeatingClearBtn.addEventListener('click', async () => {
    if (repeatingFiles.length > 0) {
      const ok = await confirmDialog('Clear Repeating Files', 'Remove all repeating PDF files?');
      if (ok) {
        repeatingFiles = [];
        if (repeatingListComponent) repeatingListComponent.update([]);
        updateUiState();
      }
    }
  });

  // ── Unique Files ─────────────────────────────────────────────────────
  function addUniqueFiles(newFiles) {
    const valid = newFiles.filter(isPdf);
    if (valid.length === 0) return;

    uniqueFiles.push(...valid);

    if (!uniqueListComponent) {
      uniqueListComponent = createFileList({
        container: uniqueListEl,
        files: uniqueFiles.map(f => ({ file: f })),
        onReorder: (newItems) => {
          uniqueFiles = newItems.map(item => item.file || item);
          updateUiState();
        },
        onRemove: (removedIndex) => {
          uniqueFiles.splice(removedIndex, 1);
          updateUiState();
        },
      });
    } else {
      uniqueListComponent.update(uniqueFiles.map(f => ({ file: f })));
    }

    updateUiState();
    if (window.lucide) window.lucide.createIcons({ node: panel });
  }

  createDropzone({
    container: uniqueDropzoneEl,
    accept: '.pdf,application/pdf',
    multiple: true,
    compact: true,
    title: 'Add unique PDF files',
    subtitle: 'One output per file',
    icon: 'plus',
    onFiles: addUniqueFiles,
  });

  uniqueClearBtn.addEventListener('click', async () => {
    if (uniqueFiles.length > 0) {
      const ok = await confirmDialog('Clear Unique Files', 'Remove all unique PDF files?');
      if (ok) {
        uniqueFiles = [];
        if (uniqueListComponent) uniqueListComponent.update([]);
        updateUiState();
      }
    }
  });

  // ── Generate Batch ───────────────────────────────────────────────────
  generateBtn.addEventListener('click', async () => {
    if (repeatingFiles.length === 0 || uniqueFiles.length === 0 || isProcessing) return;

    isProcessing = true;
    updateUiState();

    // Hide workspace cards, show progress
    for (const child of workspace.children) {
      if (child !== progressContainer) {
        child.style.display = 'none';
      }
    }
    progressContainer.style.display = 'block';
    progressContainer.innerHTML = '';

    const totalOutputs = uniqueFiles.length;

    const progressView = createProgressView({
      container: progressContainer,
      title: `Generating ${totalOutputs} PDF Documents…`,
      total: totalOutputs,
    });

    try {
      progressView.update({
        percent: 5,
        current: 0,
        total: totalOutputs,
        message: 'Uploading files to local engine…',
        status: 'Uploading',
      });

      const { job_id } = await api.startBatch(repeatingFiles, uniqueFiles);

      const finalStatus = await api.pollJob(job_id, (job) => {
        progressView.update({
          current: job.current || 0,
          total: job.total || totalOutputs,
          message: job.message || 'Processing…',
          currentFile: job.current_file || '',
          status: `${job.completed || 0} completed` + (job.failed > 0 ? `, ${job.failed} failed` : ''),
        });
      });

      // Batch completed!
      const filesRes = await api.listOutputs(job_id).catch(() => ({ files: [] }));
      const fileCount = filesRes.files ? filesRes.files.length : 0;
      const totalSize = filesRes.files ? filesRes.files.reduce((s, f) => s + (f.size || 0), 0) : 0;

      const failedCount = finalStatus.failed || 0;
      const completedCount = finalStatus.completed || fileCount;

      const successActions = [
        {
          label: 'Download All as ZIP',
          icon: 'archive',
          variant: 'primary',
          onClick: () => api.downloadZip(job_id),
        },
      ];

      // Add individual file download option if there are files
      if (fileCount > 0 && fileCount <= 20) {
        // Show individual downloads only for small batches
        successActions.push({
          label: 'View Individual Files',
          icon: 'list',
          variant: 'secondary',
          onClick: () => showIndividualFiles(job_id, filesRes.files),
        });
      }

      successActions.push({
        label: 'Build Another Batch',
        icon: 'refresh-cw',
        variant: 'secondary',
        onClick: () => resetWorkspace(),
      });

      let successMsg = `Successfully generated ${completedCount} PDF documents`;
      if (totalSize > 0) successMsg += ` (${formatFileSize(totalSize)} total)`;
      if (failedCount > 0) successMsg += `. ${failedCount} file(s) failed.`;
      else successMsg += '.';

      progressView.showSuccess({
        title: 'Batch Complete!',
        message: successMsg,
        actions: successActions,
      });

    } catch (err) {
      progressView.showError({
        title: 'Batch Failed',
        message: err.message || 'An unexpected error occurred while generating the batch.',
        onRetry: () => {
          // Reset processing state and re-trigger
          isProcessing = false;
          generateBtn.click();
        },
        onReset: () => resetWorkspace(),
      });
    }
  });

  // ── Individual File Download View ────────────────────────────────────
  function showIndividualFiles(jobId, files) {
    progressContainer.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card';

    let filesHtml = '';
    files.forEach(f => {
      filesHtml += `
        <div class="file-row" style="cursor:pointer;" data-filename="${escapeHtml(f.name)}">
          <div class="file-row__icon" aria-hidden="true">
            <i data-lucide="file-text"></i>
          </div>
          <div class="file-row__info">
            <div class="file-row__name">${escapeHtml(f.name)}</div>
            <div class="file-row__meta">${formatFileSize(f.size)}</div>
          </div>
          <div class="file-row__actions">
            <button type="button" class="btn btn--ghost btn--sm btn-download-individual" data-filename="${escapeHtml(f.name)}" title="Download">
              <i data-lucide="download"></i>
              <span>Download</span>
            </button>
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="card__header" style="justify-content:space-between;">
        <div class="card__title">Generated Files (${files.length})</div>
        <div style="display:flex;gap:var(--space-3);">
          <button type="button" class="btn btn--primary btn--sm" id="batch-download-zip-btn">
            <i data-lucide="archive"></i>
            <span>Download All as ZIP</span>
          </button>
          <button type="button" class="btn btn--secondary btn--sm" id="batch-back-btn">
            <i data-lucide="arrow-left"></i>
            <span>Back</span>
          </button>
        </div>
      </div>
      <div class="card__body" style="padding:0;max-height:500px;overflow-y:auto;">
        <div class="file-list">
          ${filesHtml}
        </div>
      </div>
    `;

    progressContainer.appendChild(card);

    // Wire download buttons
    card.querySelectorAll('.btn-download-individual').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        api.downloadFile(jobId, btn.dataset.filename);
      });
    });

    card.querySelector('#batch-download-zip-btn').addEventListener('click', () => {
      api.downloadZip(jobId);
    });

    card.querySelector('#batch-back-btn').addEventListener('click', () => {
      resetWorkspace();
    });

    if (window.lucide) window.lucide.createIcons({ node: card });
  }

  // ── Reset Workspace ──────────────────────────────────────────────────
  function resetWorkspace() {
    isProcessing = false;
    repeatingFiles = [];
    uniqueFiles = [];
    if (repeatingListComponent) repeatingListComponent.update([]);
    if (uniqueListComponent) uniqueListComponent.update([]);

    progressContainer.style.display = 'none';
    progressContainer.innerHTML = '';

    for (const child of workspace.children) {
      if (child !== progressContainer) {
        child.style.display = '';
      }
    }

    updateUiState();
  }

  // ── Initial icon render ──────────────────────────────────────────────
  if (window.lucide) {
    window.lucide.createIcons({ node: panel });
  }
}
