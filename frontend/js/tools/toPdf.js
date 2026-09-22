/**
 * tools/toPdf.js — Images → PDF conversion tool.
 */
'use strict';
import * as api from '../api.js';
import { isImage, formatFileSize, escapeHtml } from '../utils.js';
import { createDropzone } from '../components/dropzone.js';
import { createFileList } from '../components/fileRow.js';
import { createProgressView } from '../components/progress.js';
import { confirmDialog } from '../components/dialog.js';

export function renderToPdf(container) {
  let selectedFiles = [];
  let fileListComponent = null;
  let isProcessing = false;

  const panel = document.createElement('div');
  panel.className = 'tool-panel';
  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Images → PDF</h1>
      <p class="page-header__subtitle">Combine multiple images into a single PDF document. Supports PNG, JPEG, and other common image formats.</p>
    </div>
    <div class="tool-workspace" style="display:flex;flex-direction:column;gap:var(--space-6);">
      <div id="topdf-dropzone"></div>
      <div id="topdf-filelist-card" class="card" style="display:none;">
        <div class="card__header" style="justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <div class="card__title">Images</div>
            <span id="topdf-count" class="badge badge--brand">0</span>
          </div>
          <button type="button" id="topdf-clear" class="btn btn--ghost btn--sm btn--danger"><i data-lucide="trash-2"></i><span>Clear</span></button>
        </div>
        <div id="topdf-filelist" class="card__body" style="padding:0;"></div>
        <div class="card__footer" style="justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);">
          <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;min-width:200px;">
            <label for="topdf-output" style="font-size:var(--font-size-sm);white-space:nowrap;">Output:</label>
            <input type="text" class="input" id="topdf-output" value="images_combined.pdf" style="max-width:250px;">
          </div>
          <button type="button" id="topdf-btn" class="btn btn--primary btn--lg" disabled><i data-lucide="file-image"></i><span>Create PDF</span></button>
        </div>
      </div>
      <div id="topdf-progress" style="display:none;"></div>
    </div>
  `;
  container.appendChild(panel);

  const dropzoneEl = panel.querySelector('#topdf-dropzone');
  const fileListCard = panel.querySelector('#topdf-filelist-card');
  const fileListEl = panel.querySelector('#topdf-filelist');
  const countBadge = panel.querySelector('#topdf-count');
  const clearBtn = panel.querySelector('#topdf-clear');
  const submitBtn = panel.querySelector('#topdf-btn');
  const progressEl = panel.querySelector('#topdf-progress');

  function updateUI() {
    countBadge.textContent = `${selectedFiles.length} images`;
    fileListCard.style.display = selectedFiles.length > 0 ? 'block' : 'none';
    submitBtn.disabled = selectedFiles.length === 0 || isProcessing;
  }

  function addFiles(files) {
    const valid = files.filter(isImage);
    if (!valid.length) return;
    selectedFiles.push(...valid);
    if (!fileListComponent) {
      fileListComponent = createFileList({
        container: fileListEl, files: selectedFiles.map(f => ({ file: f })),
        onReorder: (items) => { selectedFiles = items.map(i => i.file || i); updateUI(); },
        onRemove: (idx) => { selectedFiles.splice(idx, 1); updateUI(); },
      });
    } else {
      fileListComponent.update(selectedFiles.map(f => ({ file: f })));
    }
    updateUI();
    if (window.lucide) window.lucide.createIcons({ node: panel });
  }

  createDropzone({
    container: dropzoneEl, accept: 'image/*', multiple: true,
    title: 'Choose images or drag & drop here',
    subtitle: 'PNG, JPEG, and other image formats',
    icon: 'image', onFiles: addFiles,
  });

  clearBtn.addEventListener('click', async () => {
    if (await confirmDialog('Clear Images', 'Remove all images?')) {
      selectedFiles = [];
      if (fileListComponent) fileListComponent.update([]);
      updateUI();
    }
  });

  submitBtn.addEventListener('click', async () => {
    if (!selectedFiles.length || isProcessing) return;
    isProcessing = true; updateUI();
    dropzoneEl.style.display = 'none'; fileListCard.style.display = 'none';
    progressEl.style.display = 'block'; progressEl.innerHTML = '';

    const outputName = panel.querySelector('#topdf-output').value.trim() || 'images_combined.pdf';
    const pv = createProgressView({ container: progressEl, title: 'Creating PDF from images…' });
    pv.update({ percent: 10, message: 'Uploading images…', status: 'Uploading' });

    try {
      const { job_id } = await api.imagesToPdf(selectedFiles, outputName);
      const finalStatus = await api.pollJob(job_id, (job) => {
        pv.update({ current: job.current, total: job.total, message: job.message, status: 'Processing' });
      });
      const filesRes = await api.listOutputs(job_id).catch(() => ({ files: [] }));
      pv.showSuccess({
        title: 'PDF Created!', message: finalStatus.message || `Created PDF with ${selectedFiles.length} pages.`,
        actions: [
          { label: 'Download PDF', icon: 'download', variant: 'primary',
            onClick: () => api.downloadFile(job_id, filesRes.files?.[0]?.name || outputName) },
          { label: 'Convert More', icon: 'refresh-cw', variant: 'secondary',
            onClick: () => { container.innerHTML = ''; renderToPdf(container); } },
        ],
      });
    } catch (e) {
      pv.showError({ title: 'Conversion Failed', message: e.message,
        onReset: () => { container.innerHTML = ''; renderToPdf(container); } });
    }
  });

  if (window.lucide) window.lucide.createIcons({ node: panel });
}
