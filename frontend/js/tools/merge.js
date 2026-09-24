/**
 * tools/merge.js — Standard PDF Merge Tool.
 *
 * Allows users to upload multiple PDF files, reorder them via drag-and-drop
 * or order buttons, specify an output filename, and merge them into one PDF.
 */

'use strict';

import * as api from '../api.js';
import { isPdf, formatFileSize, escapeHtml, recordRecentJob } from '../utils.js';
import { createDropzone } from '../components/dropzone.js';
import { createFileList } from '../components/fileRow.js';
import { createProgressView } from '../components/progress.js';
import { confirmDialog } from '../components/dialog.js';

/**
 * Render the Merge tool panel.
 * @param {HTMLElement} container - Target container element
 */
export function renderMerge(container) {
  let selectedFiles = []; // Array of File objects
  let fileListComponent = null;
  let isProcessing = false;

  const panel = document.createElement('div');
  panel.className = 'tool-panel';

  panel.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);">
        <div>
          <h1 class="page-header__title">Merge PDFs</h1>
          <p class="page-header__subtitle">Combine multiple PDF files into a single document in your chosen order.</p>
        </div>
      </div>
    </div>

    <!-- Main Workspace Container -->
    <div id="merge-workspace" class="workspace-flow">
      <!-- Dropzone Container -->
      <div id="merge-dropzone-container"></div>

      <!-- File List Container -->
      <div id="merge-file-list-card" class="workspace-section" style="display:none;">
        <div class="workspace-section__header">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="layers" style="width:16px;height:16px;color:var(--color-brand);"></i>
            <span class="workspace-section__title">Files to Merge</span>
            <span id="merge-file-count" class="badge badge--default">0 files</span>
          </div>
          <button type="button" id="merge-clear-btn" class="btn btn--ghost btn--sm btn--danger">
            <i data-lucide="trash-2"></i>
            <span>Clear all</span>
          </button>
        </div>

        <div id="merge-file-list-body" style="padding:0;">
          <!-- Reorderable file list renders here -->
        </div>

        <div style="padding:var(--space-3) var(--space-4);background:var(--color-bg-sunken);border-top:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4);">
          <div style="display:flex;align-items:center;gap:var(--space-3);flex:1;min-width:260px;">
            <label for="merge-output-name" style="font-size:var(--font-size-xs);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);white-space:nowrap;">Output Name:</label>
            <input type="text" id="merge-output-name" class="input" value="merged_document.pdf" placeholder="output_name.pdf" style="max-width:280px;" />
          </div>

          <div style="display:flex;align-items:center;gap:var(--space-4);">
            <span id="merge-total-size" style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Total: 0 B</span>
            <button type="button" id="merge-submit-btn" class="btn btn--primary btn--lg" disabled>
              <i data-lucide="layers"></i>
              <span>Merge PDFs</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Illustration -->
      <div id="merge-illustration-container" style="text-align: center; margin-top: var(--space-8); padding-bottom: var(--space-8); transform: translateX(250px);">
        <img src="/assets/merge-illustration.png" alt="Merge Illustration" style="max-width: 100%; height: auto; max-height: 280px; object-fit: contain; opacity: 0.9;" />
      </div>

      <!-- Progress / Results Container -->
      <div id="merge-progress-container" style="display:none;"></div>
    </div>
  `;

  container.appendChild(panel);

  const dropzoneContainer = panel.querySelector('#merge-dropzone-container');
  const fileListCard = panel.querySelector('#merge-file-list-card');
  const fileListBody = panel.querySelector('#merge-file-list-body');
  const fileCountBadge = panel.querySelector('#merge-file-count');
  const totalSizeLabel = panel.querySelector('#merge-total-size');
  const clearBtn = panel.querySelector('#merge-clear-btn');
  const submitBtn = panel.querySelector('#merge-submit-btn');
  const outputNameInput = panel.querySelector('#merge-output-name');
  const progressContainer = panel.querySelector('#merge-progress-container');
  const illustrationContainer = panel.querySelector('#merge-illustration-container');

  function updateUiState() {
    const count = selectedFiles.length;
    fileCountBadge.textContent = `${count} ${count === 1 ? 'file' : 'files'}`;

    const totalBytes = selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
    totalSizeLabel.textContent = `Total: ${formatFileSize(totalBytes)}`;

    if (count > 0) {
      fileListCard.style.display = 'block';
      if (illustrationContainer) illustrationContainer.style.display = 'none';
      submitBtn.disabled = count < 2 || isProcessing;
      if (count < 2) {
        submitBtn.title = 'Add at least 2 PDF files to merge';
      } else {
        submitBtn.title = `Merge ${count} files`;
      }
    } else {
      fileListCard.style.display = 'none';
      if (illustrationContainer) illustrationContainer.style.display = 'block';
    }
  }

  function addFiles(newFiles) {
    const validPdfs = newFiles.filter(isPdf);
    if (validPdfs.length === 0) {
      return;
    }

    selectedFiles.push(...validPdfs);

    if (!fileListComponent) {
      fileListComponent = createFileList({
        container: fileListBody,
        files: selectedFiles.map(f => ({ file: f })),
        onReorder: (newItems) => {
          selectedFiles = newItems.map(item => item.file || item);
          updateUiState();
        },
        onRemove: (removedIndex) => {
          selectedFiles.splice(removedIndex, 1);
          updateUiState();
        },
      });
    } else {
      fileListComponent.update(selectedFiles.map(f => ({ file: f })));
    }

    updateUiState();
    if (window.lucide) window.lucide.createIcons({ node: panel });
  }

  // Render initial Dropzone
  createDropzone({
    container: dropzoneContainer,
    accept: '.pdf,application/pdf',
    multiple: true,
    title: 'Choose PDF files or drop them here',
    subtitle: 'Select 2 or more PDF documents to merge',
    icon: 'layers',
    onFiles: addFiles,
  });

  // Clear all button handler
  clearBtn.addEventListener('click', async () => {
    if (selectedFiles.length > 0) {
      const ok = await confirmDialog('Clear Files', 'Are you sure you want to remove all selected files?');
      if (ok) {
        selectedFiles = [];
        if (fileListComponent) {
          fileListComponent.update([]);
        }
        updateUiState();
      }
    }
  });

  // Merge execution
  submitBtn.addEventListener('click', async () => {
    if (selectedFiles.length < 2 || isProcessing) return;

    isProcessing = true;
    updateUiState();

    // Hide workspace cards, show progress
    dropzoneContainer.style.display = 'none';
    fileListCard.style.display = 'none';
    progressContainer.style.display = 'block';
    progressContainer.innerHTML = '';

    const outputName = outputNameInput.value.trim() || 'merged_document.pdf';

    const progressView = createProgressView({
      container: progressContainer,
      title: 'Merging PDF Documents…',
      total: selectedFiles.length,
    });

    try {
      progressView.update({
        percent: 10,
        current: 0,
        total: selectedFiles.length,
        message: 'Uploading files to local engine…',
        status: 'Uploading',
      });

      const { job_id } = await api.mergePdfs(selectedFiles, outputName);

      const finalStatus = await api.pollJob(job_id, (job) => {
        progressView.update({
          current: job.current || 0,
          total: job.total || selectedFiles.length,
          message: job.message || 'Processing pages…',
          currentFile: job.current_file || '',
          status: 'Processing',
        });
      });

      // Merge completed successfully!
      const filesRes = await api.listOutputs(job_id).catch(() => ({ files: [] }));
      const generatedFile = filesRes.files && filesRes.files[0];
      const fileSize = generatedFile ? formatFileSize(generatedFile.size) : '';

      recordRecentJob('Merge PDFs', outputName, `/api/output/${job_id}/download/${encodeURIComponent(outputName)}`);

      progressView.showSuccess({
        title: 'Merge Complete',
        message: `Successfully combined ${selectedFiles.length} PDF files into ${outputName}${fileSize ? ` (${fileSize})` : ''}.`,
        actions: [
          {
            label: 'Download Merged PDF',
            icon: 'download',
            variant: 'primary',
            onClick: () => api.downloadFile(job_id, outputName),
          },
          {
            label: 'Merge More Files',
            icon: 'refresh-cw',
            variant: 'secondary',
            onClick: () => {
              isProcessing = false;
              selectedFiles = [];
              if (fileListComponent) fileListComponent.update([]);
              progressContainer.style.display = 'none';
              dropzoneContainer.style.display = 'block';
              updateUiState();
            },
          },
        ],
      });
    } catch (err) {
      progressView.showError({
        title: 'Merge Failed',
        message: err.message || 'An unexpected error occurred while merging your PDF files.',
        onRetry: () => {
          submitBtn.click();
        },
        onReset: () => {
          isProcessing = false;
          progressContainer.style.display = 'none';
          dropzoneContainer.style.display = 'block';
          fileListCard.style.display = 'block';
          updateUiState();
        },
      });
    }
  });

  if (window.lucide) {
    window.lucide.createIcons({ node: panel });
  }
}
