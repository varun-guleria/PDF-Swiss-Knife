/**
 * tools/batch.js — Custom Batch PDF Builder Tool.
 *
 * Dedicated document-building workspace:
 * - REUSABLE / REPEATING DOCUMENTS: Dynamic placeholders controlled by [-] N [+].
 *   Each slot supports Replace, Remove, Reorder. Slot structure remains when file is replaced.
 * - UNIQUE DOCUMENTS: Clean file manager list (001, 002...) with Replace (position preserving) and Remove.
 * - BATCH SUMMARY: Restrained summary panel showing slot count, unique count, output count,
 *   document structure, and [ Generate PDFs ] action.
 */

'use strict';

import * as api from '../api.js';
import { isPdf, formatFileSize, escapeHtml, recordRecentJob } from '../utils.js';
import { createProgressView } from '../components/progress.js';
import { confirmDialog } from '../components/dialog.js';

/**
 * Render the Custom Batch PDF Builder tool.
 * @param {HTMLElement} container - Target container element
 */
export function renderBatch(container) {
  // State
  let slotCounter = 1;
  let repeatingSlots = [
    { id: slotCounter++, file: null },
    { id: slotCounter++, file: null },
    { id: slotCounter++, file: null },
  ];
  let uniqueFiles = []; // Array of File objects
  let isProcessing = false;

  const panel = document.createElement('div');
  panel.className = 'tool-panel';

  panel.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);">
        <div>
          <h1 class="page-header__title">Custom Batch PDF Builder</h1>
          <p class="page-header__subtitle">Generate personalised output documents by combining shared repeating pages with unique files.</p>
        </div>
        <span class="badge badge--brand">PRO</span>
      </div>
    </div>

    <!-- Workspace Container -->
    <div id="batch-workspace" class="batch-workspace">

      <!-- How It Works Hint Strip -->
      <div class="batch-info-strip">
        <i data-lucide="info"></i>
        <div>
          <strong>Document Architecture:</strong> Repeating pages (such as covers, terms, or certificates) are prepended in order to each unique document. One output PDF is created for every unique file.
        </div>
      </div>

      <!-- ── SECTION 1: REPEATING DOCUMENTS ────────────────────────── -->
      <div class="workspace-section" id="batch-repeating-section">
        <div class="workspace-section__header">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="repeat" style="width:16px;height:16px;color:var(--color-brand);"></i>
            <span class="workspace-section__title">Repeating PDFs</span>
            <span id="batch-repeating-active-badge" class="badge badge--default">0 / 3 ready</span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-4);">
            <div style="display:flex;align-items:center;gap:var(--space-2);">
              <span style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">Slots:</span>
              <div class="counter" role="group" aria-label="Repeating placeholders count">
                <button type="button" id="batch-slot-dec" class="counter__btn" title="Remove slot" aria-label="Decrease slot count">−</button>
                <div id="batch-slot-count-val" class="counter__value">3</div>
                <button type="button" id="batch-slot-inc" class="counter__btn" title="Add slot" aria-label="Increase slot count">+</button>
              </div>
            </div>
            <button type="button" id="batch-repeating-clear-btn" class="btn btn--ghost btn--sm btn--danger" style="display:none;">
              <i data-lucide="trash-2"></i>
              <span>Clear Files</span>
            </button>
          </div>
        </div>

        <div class="repeating-slots-container" id="repeating-slots-list">
          <!-- Populated dynamically by renderRepeatingSlots() -->
        </div>
      </div>

      <!-- ── SECTION 2: UNIQUE DOCUMENTS ───────────────────────────── -->
      <div class="workspace-section" id="batch-unique-section">
        <div class="workspace-section__header">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="files" style="width:16px;height:16px;color:var(--color-brand);"></i>
            <span class="workspace-section__title">Unique Documents</span>
            <span id="batch-unique-count-badge" class="badge badge--default">0 files</span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <button type="button" id="batch-add-unique-btn" class="btn btn--secondary btn--sm">
              <i data-lucide="plus"></i>
              <span>Add Files</span>
            </button>
            <button type="button" id="batch-unique-clear-btn" class="btn btn--ghost btn--sm btn--danger" style="display:none;">
              <i data-lucide="trash-2"></i>
              <span>Clear All</span>
            </button>
          </div>
        </div>

        <div class="workspace-section__body" style="padding:var(--space-4);">
          <!-- Drop area for unique files -->
          <div id="unique-dropzone-wrap" style="margin-bottom:var(--space-3);">
            <div id="unique-dropzone" class="dropzone dropzone--compact" role="button" tabindex="0">
              <i data-lucide="upload-cloud" class="dropzone__icon"></i>
              <div class="dropzone__title">Drop unique PDF files here, or click to browse</div>
              <div class="dropzone__subtitle">(One output PDF generated per unique document)</div>
            </div>
          </div>

          <!-- File manager list for unique documents -->
          <div id="unique-files-container">
            <div class="file-manager" id="unique-file-manager" style="display:none;">
              <div class="file-list__header">
                <div class="file-list__th file-list__th--index">#</div>
                <div class="file-list__th file-list__th--name">Document</div>
                <div class="file-list__th file-list__th--meta">Size</div>
                <div class="file-list__th file-list__th--actions">Actions</div>
              </div>
              <div class="file-list" id="unique-file-list"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 3: BATCH SUMMARY ──────────────────────────────── -->
      <div class="batch-summary-panel" id="batch-summary-panel">
        <div class="batch-summary-panel__header">BATCH SUMMARY</div>
        <div class="batch-summary-panel__body">
          <div class="batch-summary-stats">
            <div class="batch-summary-item">
              <span class="batch-summary-item__label">Repeating PDFs</span>
              <span class="batch-summary-item__val" id="summary-stat-repeating">0</span>
            </div>
            <div style="font-size:var(--font-size-lg);color:var(--color-text-tertiary);">&times;</div>
            <div class="batch-summary-item">
              <span class="batch-summary-item__label">Unique PDFs</span>
              <span class="batch-summary-item__val" id="summary-stat-unique">0</span>
            </div>
            <div style="font-size:var(--font-size-lg);color:var(--color-text-tertiary);">&rarr;</div>
            <div class="batch-summary-item batch-summary-item--output">
              <span class="batch-summary-item__label">Output Documents</span>
              <span class="batch-summary-item__val" id="summary-stat-outputs">0</span>
            </div>
          </div>

          <div class="batch-summary-formula">
            <strong>Output structure:</strong>
            <span id="summary-structure-text">Add repeating and unique files to preview structure</span>
          </div>

          <div>
            <button type="button" id="batch-generate-btn" class="btn btn--primary btn--lg" disabled>
              <i data-lucide="layers"></i>
              <span>Generate PDFs</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Progress View Container -->
      <div id="batch-progress-container" style="display:none;"></div>

    </div>
  `;

  container.appendChild(panel);

  // ── DOM References ─────────────────────────────────────────────────────
  const workspace = panel.querySelector('#batch-workspace');
  const repeatingSlotsList = panel.querySelector('#repeating-slots-list');
  const repeatingActiveBadge = panel.querySelector('#batch-repeating-active-badge');
  const slotCountVal = panel.querySelector('#batch-slot-count-val');
  const slotDecBtn = panel.querySelector('#batch-slot-dec');
  const slotIncBtn = panel.querySelector('#batch-slot-inc');
  const repeatingClearBtn = panel.querySelector('#batch-repeating-clear-btn');

  const uniqueCountBadge = panel.querySelector('#batch-unique-count-badge');
  const uniqueAddBtn = panel.querySelector('#batch-add-unique-btn');
  const uniqueClearBtn = panel.querySelector('#batch-unique-clear-btn');
  const uniqueDropzone = panel.querySelector('#unique-dropzone');
  const uniqueFileManager = panel.querySelector('#unique-file-manager');
  const uniqueFileList = panel.querySelector('#unique-file-list');

  const summaryStatRepeating = panel.querySelector('#summary-stat-repeating');
  const summaryStatUnique = panel.querySelector('#summary-stat-unique');
  const summaryStatOutputs = panel.querySelector('#summary-stat-outputs');
  const summaryStructureText = panel.querySelector('#summary-structure-text');
  const generateBtn = panel.querySelector('#batch-generate-btn');
  const progressContainer = panel.querySelector('#batch-progress-container');

  // ── Summary Updater ────────────────────────────────────────────────────
  function updateSummary() {
    const activeRepeating = repeatingSlots.map(s => s.file).filter(Boolean);
    const repCount = activeRepeating.length;
    const totalSlots = repeatingSlots.length;
    const uqCount = uniqueFiles.length;

    repeatingActiveBadge.textContent = `${repCount} / ${totalSlots} ready`;
    repeatingClearBtn.style.display = repCount > 0 ? '' : 'none';

    uniqueCountBadge.textContent = `${uqCount} ${uqCount === 1 ? 'file' : 'files'}`;
    uniqueClearBtn.style.display = uqCount > 0 ? '' : 'none';
    uniqueFileManager.style.display = uqCount > 0 ? '' : 'none';

    summaryStatRepeating.textContent = String(repCount);
    summaryStatUnique.textContent = String(uqCount);
    summaryStatOutputs.textContent = String(uqCount);

    if (repCount > 0 && uqCount > 0) {
      const parts = activeRepeating.map((f, i) => `Repeating ${i + 1} (${escapeHtml(f.name)})`);
      parts.push(`One unique PDF`);
      summaryStructureText.innerHTML = parts.join(' <code>+</code> ');
      generateBtn.disabled = isProcessing;
    } else if (repCount === 0 && uqCount > 0) {
      summaryStructureText.textContent = `Select at least 1 repeating PDF to prepend to all ${uqCount} unique files.`;
      generateBtn.disabled = true;
    } else if (repCount > 0 && uqCount === 0) {
      summaryStructureText.textContent = `Add unique PDF files (one output will be generated per unique file).`;
      generateBtn.disabled = true;
    } else {
      summaryStructureText.textContent = `Add repeating and unique files to preview structure.`;
      generateBtn.disabled = true;
    }
  }

  // ── Render Repeating Slots ─────────────────────────────────────────────
  function renderRepeatingSlots() {
    repeatingSlotsList.innerHTML = '';
    slotCountVal.textContent = String(repeatingSlots.length);
    slotDecBtn.disabled = repeatingSlots.length <= 1;
    slotIncBtn.disabled = repeatingSlots.length >= 10;

    repeatingSlots.forEach((slot, index) => {
      const slotEl = document.createElement('div');
      slotEl.className = 'repeating-slot';
      slotEl.dataset.slotIndex = String(index);

      const formattedIndex = String(index + 1).padStart(2, '0');

      if (slot.file) {
        slotEl.innerHTML = `
          <div class="repeating-slot__index">${formattedIndex}</div>
          <i data-lucide="file-text" class="repeating-slot__icon"></i>
          <div class="repeating-slot__main">
            <span class="repeating-slot__name" title="${escapeHtml(slot.file.name)}">${escapeHtml(slot.file.name)}</span>
            <span class="repeating-slot__size">${formatFileSize(slot.file.size)}</span>
          </div>
          <div class="repeating-slot__actions">
            <button type="button" class="btn btn--ghost btn--sm slot-btn-replace" title="Replace file in this slot">
              <i data-lucide="refresh-cw"></i>
              <span style="font-size:var(--font-size-xs);margin-left:2px;">Replace</span>
            </button>
            <button type="button" class="btn btn--ghost btn--icon btn--sm slot-btn-up" title="Move up" ${index === 0 ? 'disabled' : ''}>
              <i data-lucide="chevron-up"></i>
            </button>
            <button type="button" class="btn btn--ghost btn--icon btn--sm slot-btn-down" title="Move down" ${index === repeatingSlots.length - 1 ? 'disabled' : ''}>
              <i data-lucide="chevron-down"></i>
            </button>
            <button type="button" class="btn btn--ghost btn--icon btn--sm btn--danger slot-btn-clear" title="Clear file from slot">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
      } else {
        slotEl.innerHTML = `
          <div class="repeating-slot__index">${formattedIndex}</div>
          <i data-lucide="file-dashed" class="repeating-slot__icon" style="color:var(--color-text-tertiary);"></i>
          <div class="repeating-slot__main">
            <button type="button" class="repeating-slot__empty slot-btn-choose" title="Select PDF file for slot ${formattedIndex}">
              <i data-lucide="plus" style="width:13px;height:13px;"></i>
              <span>Choose PDF for Slot ${formattedIndex} (e.g. Cover, Terms, Header)</span>
            </button>
          </div>
          <div class="repeating-slot__actions">
            <button type="button" class="btn btn--ghost btn--icon btn--sm slot-btn-up" title="Move up" ${index === 0 ? 'disabled' : ''}>
              <i data-lucide="chevron-up"></i>
            </button>
            <button type="button" class="btn btn--ghost btn--icon btn--sm slot-btn-down" title="Move down" ${index === repeatingSlots.length - 1 ? 'disabled' : ''}>
              <i data-lucide="chevron-down"></i>
            </button>
            ${repeatingSlots.length > 1 ? `
              <button type="button" class="btn btn--ghost btn--icon btn--sm btn--danger slot-btn-remove-slot" title="Remove slot">
                <i data-lucide="x"></i>
              </button>
            ` : ''}
          </div>
        `;
      }

      // Drag & drop directly onto slot
      slotEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        slotEl.style.backgroundColor = 'var(--color-brand-subtle)';
      });
      slotEl.addEventListener('dragleave', () => {
        slotEl.style.backgroundColor = '';
      });
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.style.backgroundColor = '';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const dropped = Array.from(e.dataTransfer.files).find(isPdf);
          if (dropped) {
            slot.file = dropped;
            renderRepeatingSlots();
            updateSummary();
          }
        }
      });

      // Actions wiring
      const replaceBtn = slotEl.querySelector('.slot-btn-replace');
      const chooseBtn = slotEl.querySelector('.slot-btn-choose');
      const upBtn = slotEl.querySelector('.slot-btn-up');
      const downBtn = slotEl.querySelector('.slot-btn-down');
      const clearBtn = slotEl.querySelector('.slot-btn-clear');
      const removeSlotBtn = slotEl.querySelector('.slot-btn-remove-slot');

      const triggerFileSelect = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,application/pdf';
        input.style.display = 'none';
        input.addEventListener('change', () => {
          if (input.files && input.files[0] && isPdf(input.files[0])) {
            slot.file = input.files[0];
            renderRepeatingSlots();
            updateSummary();
          }
          input.remove();
        });
        document.body.appendChild(input);
        input.click();
      };

      if (replaceBtn) replaceBtn.addEventListener('click', triggerFileSelect);
      if (chooseBtn) chooseBtn.addEventListener('click', triggerFileSelect);

      if (upBtn) {
        upBtn.addEventListener('click', () => {
          if (index > 0) {
            const temp = repeatingSlots[index];
            repeatingSlots[index] = repeatingSlots[index - 1];
            repeatingSlots[index - 1] = temp;
            renderRepeatingSlots();
            updateSummary();
          }
        });
      }

      if (downBtn) {
        downBtn.addEventListener('click', () => {
          if (index < repeatingSlots.length - 1) {
            const temp = repeatingSlots[index];
            repeatingSlots[index] = repeatingSlots[index + 1];
            repeatingSlots[index + 1] = temp;
            renderRepeatingSlots();
            updateSummary();
          }
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          slot.file = null;
          renderRepeatingSlots();
          updateSummary();
        });
      }

      if (removeSlotBtn) {
        removeSlotBtn.addEventListener('click', () => {
          if (repeatingSlots.length > 1) {
            repeatingSlots.splice(index, 1);
            renderRepeatingSlots();
            updateSummary();
          }
        });
      }

      repeatingSlotsList.appendChild(slotEl);
    });

    if (window.lucide) window.lucide.createIcons({ node: repeatingSlotsList });
  }

  // Slot Counter Buttons
  slotDecBtn.addEventListener('click', () => {
    if (repeatingSlots.length > 1) {
      repeatingSlots.pop();
      renderRepeatingSlots();
      updateSummary();
    }
  });

  slotIncBtn.addEventListener('click', () => {
    if (repeatingSlots.length < 10) {
      repeatingSlots.push({ id: slotCounter++, file: null });
      renderRepeatingSlots();
      updateSummary();
    }
  });

  repeatingClearBtn.addEventListener('click', async () => {
    const ok = await confirmDialog('Clear Repeating Files', 'Clear all files from repeating slots?');
    if (ok) {
      repeatingSlots.forEach(s => s.file = null);
      renderRepeatingSlots();
      updateSummary();
    }
  });

  // ── Render Unique Files ────────────────────────────────────────────────
  function renderUniqueFiles() {
    uniqueFileList.innerHTML = '';

    uniqueFiles.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.dataset.uniqueIndex = String(index);

      const formattedIndex = String(index + 1).padStart(3, '0');

      row.innerHTML = `
        <div class="file-row__leading">
          <div class="file-row__index">${formattedIndex}</div>
          <div class="file-row__icon"><i data-lucide="file-text"></i></div>
        </div>
        <div class="file-row__info">
          <div class="file-row__name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
        </div>
        <div class="file-row__meta">
          <span class="file-row__size">${formatFileSize(file.size)}</span>
        </div>
        <div class="file-row__actions">
          <button type="button" class="btn btn--ghost btn--sm uq-btn-replace" title="Replace this document preserving slot ${formattedIndex}">
            <i data-lucide="refresh-cw"></i>
            <span class="btn-text">Replace</span>
          </button>
          <button type="button" class="btn btn--ghost btn--icon btn--sm btn--danger uq-btn-remove" title="Remove file">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // Replace preserving position
      row.querySelector('.uq-btn-replace').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,application/pdf';
        input.style.display = 'none';
        input.addEventListener('change', () => {
          if (input.files && input.files[0] && isPdf(input.files[0])) {
            uniqueFiles[index] = input.files[0];
            renderUniqueFiles();
            updateSummary();
          }
          input.remove();
        });
        document.body.appendChild(input);
        input.click();
      });

      // Remove
      row.querySelector('.uq-btn-remove').addEventListener('click', () => {
        uniqueFiles.splice(index, 1);
        renderUniqueFiles();
        updateSummary();
      });

      uniqueFileList.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons({ node: uniqueFileList });
  }

  function addUniquePdfs(files) {
    const valid = Array.from(files).filter(isPdf);
    if (valid.length > 0) {
      uniqueFiles.push(...valid);
      renderUniqueFiles();
      updateSummary();
    }
  }

  // Unique Dropzone & Add Button
  uniqueDropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      if (input.files) addUniquePdfs(input.files);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });

  uniqueAddBtn.addEventListener('click', () => uniqueDropzone.click());

  uniqueDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uniqueDropzone.classList.add('dropzone--hover');
  });

  uniqueDropzone.addEventListener('dragleave', () => {
    uniqueDropzone.classList.remove('dropzone--hover');
  });

  uniqueDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uniqueDropzone.classList.remove('dropzone--hover');
    if (e.dataTransfer.files) {
      addUniquePdfs(e.dataTransfer.files);
    }
  });

  uniqueClearBtn.addEventListener('click', async () => {
    const ok = await confirmDialog('Clear Unique Files', 'Remove all unique files from the list?');
    if (ok) {
      uniqueFiles = [];
      renderUniqueFiles();
      updateSummary();
    }
  });

  // ── Generation Logic ──────────────────────────────────────────────────
  generateBtn.addEventListener('click', async () => {
    const activeRepeating = repeatingSlots.map(s => s.file).filter(Boolean);
    if (activeRepeating.length === 0 || uniqueFiles.length === 0 || isProcessing) return;

    isProcessing = true;
    updateSummary();

    // Hide workspace sections, show progress
    for (const child of workspace.children) {
      if (child !== progressContainer) child.style.display = 'none';
    }
    progressContainer.style.display = 'block';
    progressContainer.innerHTML = '';

    const totalOutputs = uniqueFiles.length;

    const progressView = createProgressView({
      container: progressContainer,
      title: `Generating ${totalOutputs} Batch PDF Documents…`,
      total: totalOutputs,
    });

    try {
      progressView.update({
        percent: 5,
        current: 0,
        total: totalOutputs,
        message: 'Uploading document inputs to local engine…',
        status: 'Uploading',
      });

      const { job_id } = await api.startBatch(activeRepeating, uniqueFiles);

      const finalStatus = await api.pollJob(job_id, (job) => {
        progressView.update({
          current: job.current || 0,
          total: job.total || totalOutputs,
          message: job.message || 'Processing batch…',
          currentFile: job.current_file || '',
          status: `${job.completed || 0} completed` + (job.failed > 0 ? `, ${job.failed} failed` : ''),
        });
      });

      // Fetch output metadata
      const filesRes = await api.listOutputs(job_id).catch(() => ({ files: [] }));
      const fileCount = filesRes.files ? filesRes.files.length : 0;
      const totalSize = filesRes.files ? filesRes.files.reduce((s, f) => s + (f.size || 0), 0) : 0;
      const completedCount = finalStatus.completed || fileCount;

      recordRecentJob('Custom Batch Builder', `${completedCount} PDFs (ZIP Bundle)`, `/api/output/${job_id}/zip`);

      const successActions = [
        {
          label: 'Download All as ZIP',
          icon: 'archive',
          variant: 'primary',
          onClick: () => api.downloadZip(job_id),
        },
      ];

      if (fileCount > 0 && fileCount <= 20) {
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
      successMsg += '.';

      progressView.showSuccess({
        title: 'Batch Complete',
        message: successMsg,
        actions: successActions,
      });

    } catch (err) {
      progressView.showError({
        title: 'Batch Generation Failed',
        message: err.message || 'An unexpected error occurred during batch generation.',
        onRetry: () => {
          isProcessing = false;
          generateBtn.click();
        },
        onReset: () => resetWorkspace(),
      });
    }
  });

  // Individual file list view
  function showIndividualFiles(jobId, files) {
    progressContainer.innerHTML = '';
    const section = document.createElement('div');
    section.className = 'workspace-section';

    let listHtml = '';
    files.forEach(f => {
      listHtml += `
        <div class="file-row">
          <div class="file-row__icon"><i data-lucide="file-check"></i></div>
          <div class="file-row__info">
            <div class="file-row__name">${escapeHtml(f.name)}</div>
            <div class="file-row__meta">${formatFileSize(f.size)}</div>
          </div>
          <div class="file-row__actions">
            <button type="button" class="btn btn--secondary btn--sm btn-dl-file" data-filename="${escapeHtml(f.name)}">
              <i data-lucide="download"></i>
              <span>Download</span>
            </button>
          </div>
        </div>
      `;
    });

    section.innerHTML = `
      <div class="workspace-section__header">
        <span class="workspace-section__title">Generated Documents (${files.length})</span>
        <div style="display:flex;gap:var(--space-3);">
          <button type="button" class="btn btn--primary btn--sm" id="batch-dl-all-zip">
            <i data-lucide="archive"></i>
            <span>Download All as ZIP</span>
          </button>
          <button type="button" class="btn btn--secondary btn--sm" id="batch-back-btn">
            <i data-lucide="arrow-left"></i>
            <span>Back</span>
          </button>
        </div>
      </div>
      <div class="file-list" style="max-height:480px;overflow-y:auto;">
        ${listHtml}
      </div>
    `;

    progressContainer.appendChild(section);

    section.querySelectorAll('.btn-dl-file').forEach(btn => {
      btn.addEventListener('click', () => api.downloadFile(jobId, btn.dataset.filename));
    });

    section.querySelector('#batch-dl-all-zip').addEventListener('click', () => api.downloadZip(jobId));
    section.querySelector('#batch-back-btn').addEventListener('click', () => resetWorkspace());

    if (window.lucide) window.lucide.createIcons({ node: section });
  }

  function resetWorkspace() {
    isProcessing = false;
    repeatingSlots.forEach(s => s.file = null);
    uniqueFiles = [];
    renderRepeatingSlots();
    renderUniqueFiles();
    updateSummary();

    progressContainer.style.display = 'none';
    progressContainer.innerHTML = '';

    for (const child of workspace.children) {
      if (child !== progressContainer) child.style.display = '';
    }
  }

  // Initial render
  renderRepeatingSlots();
  renderUniqueFiles();
  updateSummary();

  if (window.lucide) window.lucide.createIcons({ node: panel });
}
