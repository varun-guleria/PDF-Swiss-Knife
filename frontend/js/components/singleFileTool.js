/**
 * components/singleFileTool.js — Reusable single-file tool template.
 *
 * Many tools share the same pattern: upload one PDF → process → download result.
 * This component creates the full UI: dropzone → options → progress → download.
 */

'use strict';

import * as api from '../api.js';
import { isPdf, isImage, formatFileSize, escapeHtml, recordRecentJob } from '../utils.js';
import { createDropzone } from './dropzone.js';
import { createProgressView } from './progress.js';

/**
 * @typedef {Object} SingleFileToolOptions
 * @property {HTMLElement} container
 * @property {string} title - Tool title
 * @property {string} subtitle - Tool description
 * @property {string} icon - Lucide icon name
 * @property {string} [accept='.pdf'] - Accepted file types
 * @property {boolean} [multiFile=false] - Accept multiple files
 * @property {string} [fileFilter='pdf'] - 'pdf' or 'image'
 * @property {(container: HTMLElement, state: object) => void} renderOptions - Render options form
 * @property {(file: File|File[], options: object) => Promise<object>} onSubmit - Called to start processing
 * @property {string} submitLabel - Button label
 * @property {string} submitIcon - Button icon
 * @property {string} [progressTitle] - Progress bar title
 * @property {boolean} [usePolling=true] - Whether to poll job status
 * @property {(result: object, jobId: string) => Array} [getSuccessActions] - Custom success actions
 */

/**
 * Creates a complete single-file tool UI.
 * @param {SingleFileToolOptions} opts
 */
export function createSingleFileTool(opts) {
  const {
    container,
    title,
    subtitle,
    icon,
    accept = '.pdf,application/pdf',
    multiFile = false,
    fileFilter = 'pdf',
    renderOptions,
    onSubmit,
    submitLabel = 'Process',
    submitIcon = 'play',
    progressTitle,
    usePolling = true,
    getSuccessActions,
  } = opts;

  let selectedFile = null;
  let selectedFiles = [];
  let isProcessing = false;

  const panel = document.createElement('div');
  panel.className = 'tool-panel';

  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">${escapeHtml(title)}</h1>
      <p class="page-header__subtitle">${escapeHtml(subtitle)}</p>
    </div>

    <div class="workspace-flow">
      <div id="sft-dropzone-container"></div>

      <div id="sft-options-card" class="workspace-section" style="display:none;">
        <div class="workspace-section__header">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="file-text" style="width:16px;height:16px;color:var(--color-brand);"></i>
            <span class="workspace-section__title" id="sft-filename"></span>
            <span id="sft-filesize" class="badge badge--default"></span>
          </div>
          <button type="button" class="btn btn--ghost btn--sm" id="sft-change-file">
            <i data-lucide="refresh-cw"></i>
            <span>Change File</span>
          </button>
        </div>

        <div style="padding:var(--space-5);" id="sft-options-body">
          <!-- Tool-specific options render here -->
        </div>

        <div style="padding:var(--space-3) var(--space-4);background:var(--color-bg-sunken);border-top:1px solid var(--color-border);display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn--primary btn--lg" id="sft-submit-btn">
            <i data-lucide="${escapeHtml(submitIcon)}"></i>
            <span>${escapeHtml(submitLabel)}</span>
          </button>
        </div>
      </div>

      <div id="sft-progress-container" style="display:none;"></div>
    </div>
  `;

  container.appendChild(panel);

  const dropzoneContainer = panel.querySelector('#sft-dropzone-container');
  const optionsCard = panel.querySelector('#sft-options-card');
  const optionsBody = panel.querySelector('#sft-options-body');
  const filenameEl = panel.querySelector('#sft-filename');
  const filesizeEl = panel.querySelector('#sft-filesize');
  const changeBtn = panel.querySelector('#sft-change-file');
  const submitBtn = panel.querySelector('#sft-submit-btn');
  const progressContainer = panel.querySelector('#sft-progress-container');

  const filterFn = fileFilter === 'image' ? isImage : isPdf;

  function onFilesSelected(files) {
    const valid = files.filter(filterFn);
    if (valid.length === 0) return;

    if (multiFile) {
      selectedFiles = valid;
      filenameEl.textContent = `${valid.length} files selected`;
      const totalSize = valid.reduce((s, f) => s + f.size, 0);
      filesizeEl.textContent = formatFileSize(totalSize);
    } else {
      selectedFile = valid[0];
      filenameEl.textContent = selectedFile.name;
      filesizeEl.textContent = formatFileSize(selectedFile.size);
    }

    dropzoneContainer.style.display = 'none';
    optionsCard.style.display = 'block';

    // Render tool-specific options
    optionsBody.innerHTML = '';
    if (renderOptions) {
      renderOptions(optionsBody, { file: selectedFile, files: selectedFiles });
    }

    if (window.lucide) window.lucide.createIcons({ node: panel });
  }

  createDropzone({
    container: dropzoneContainer,
    accept,
    multiple: multiFile,
    title: multiFile ? `Choose ${fileFilter} files or drag & drop here` : `Choose a ${fileFilter === 'image' ? 'file' : 'PDF'} or drag & drop here`,
    subtitle: fileFilter === 'image' ? 'Image files (PNG, JPEG, etc.)' : 'PDF files up to 512 MB',
    icon: icon,
    onFiles: onFilesSelected,
  });

  changeBtn.addEventListener('click', () => {
    selectedFile = null;
    selectedFiles = [];
    optionsCard.style.display = 'none';
    dropzoneContainer.style.display = 'block';
  });

  submitBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    isProcessing = true;
    submitBtn.disabled = true;

    optionsCard.style.display = 'none';
    progressContainer.style.display = 'block';
    progressContainer.innerHTML = '';

    const progressView = createProgressView({
      container: progressContainer,
      title: progressTitle || `${title}…`,
    });

    try {
      progressView.update({
        percent: 10,
        message: 'Uploading to local engine…',
        status: 'Uploading',
      });

      // Gather options from the form
      const optionValues = {};
      optionsBody.querySelectorAll('[data-option]').forEach(el => {
        const key = el.dataset.option;
        if (el.type === 'checkbox') {
          optionValues[key] = el.checked;
        } else if (el.type === 'number') {
          optionValues[key] = Number(el.value);
        } else {
          optionValues[key] = el.value;
        }
      });

      const input = multiFile ? selectedFiles : selectedFile;
      const result = await onSubmit(input, optionValues);

      if (usePolling && result.job_id) {
        const finalStatus = await api.pollJob(result.job_id, (job) => {
          progressView.update({
            current: job.current || 0,
            total: job.total || 1,
            message: job.message || 'Processing…',
            currentFile: job.current_file || '',
            status: 'Processing',
          });
        });

        const filesRes = await api.listOutputs(result.job_id).catch(() => ({ files: [] }));
        const fileCount = filesRes.files ? filesRes.files.length : 0;

        if (fileCount > 0) {
          const outName = fileCount === 1 ? filesRes.files[0].name : `${fileCount} Output Files (ZIP)`;
          const dlUrl = fileCount === 1
            ? `/api/output/${result.job_id}/download/${encodeURIComponent(filesRes.files[0].name)}`
            : `/api/output/${result.job_id}/zip`;
          recordRecentJob(title, outName, dlUrl);
        }

        let successActions;
        if (getSuccessActions) {
          successActions = getSuccessActions(finalStatus, result.job_id, filesRes);
        } else {
          successActions = [];
          if (fileCount === 1) {
            successActions.push({
              label: 'Download Result',
              icon: 'download',
              variant: 'primary',
              onClick: () => api.downloadFile(result.job_id, filesRes.files[0].name),
            });
          } else if (fileCount > 1) {
            successActions.push({
              label: 'Download All as ZIP',
              icon: 'archive',
              variant: 'primary',
              onClick: () => api.downloadZip(result.job_id),
            });
          }
          successActions.push({
            label: 'Process Another',
            icon: 'refresh-cw',
            variant: 'secondary',
            onClick: () => resetTool(),
          });
        }

        progressView.showSuccess({
          title: 'Complete!',
          message: finalStatus.message || 'Processing finished successfully.',
          actions: successActions,
        });
      } else if (!usePolling) {
        // Synchronous result (e.g. PDF info)
        progressView.showSuccess({
          title: 'Complete!',
          message: 'Information retrieved.',
          actions: [{
            label: 'Process Another',
            icon: 'refresh-cw',
            variant: 'secondary',
            onClick: () => resetTool(),
          }],
        });
      }

    } catch (err) {
      progressView.showError({
        title: `${title} Failed`,
        message: err.message || 'An unexpected error occurred.',
        onRetry: () => {
          isProcessing = false;
          submitBtn.disabled = false;
          submitBtn.click();
        },
        onReset: () => resetTool(),
      });
    }
  });

  function resetTool() {
    isProcessing = false;
    submitBtn.disabled = false;
    selectedFile = null;
    selectedFiles = [];
    progressContainer.style.display = 'none';
    progressContainer.innerHTML = '';
    optionsCard.style.display = 'none';
    dropzoneContainer.style.display = 'block';
  }

  if (window.lucide) window.lucide.createIcons({ node: panel });

  return { panel, resetTool };
}
