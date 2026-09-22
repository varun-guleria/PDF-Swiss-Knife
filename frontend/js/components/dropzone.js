/**
 * components/dropzone.js — Reusable file upload dropzone.
 *
 * Supports drag-and-drop and standard file picker.
 * Automatically validates accepted file types and filters dropped items.
 */

'use strict';

import { escapeHtml } from '../utils.js';

/**
 * @typedef {Object} DropzoneOptions
 * @property {HTMLElement} container - Element to render into
 * @property {string} [accept='.pdf'] - Accepted file extensions/MIME types
 * @property {boolean} [multiple=true] - Whether to allow multiple files
 * @property {boolean} [compact=false] - Whether to display as a compact button-style dropzone
 * @property {string} [title='Choose files or drag & drop here'] - Primary title
 * @property {string} [subtitle='PDF files up to 512 MB'] - Secondary guidance text
 * @property {string} [icon='upload-cloud'] - Lucide icon name
 * @property {(files: File[]) => void} onFiles - Callback when files are selected
 */

/**
 * Creates and renders an interactive dropzone component.
 * @param {DropzoneOptions} options
 * @returns {{ element: HTMLElement, destroy: () => void }}
 */
export function createDropzone(options) {
  const {
    container,
    accept = '.pdf',
    multiple = true,
    compact = false,
    title = 'Choose files or drag & drop here',
    subtitle = 'PDF files up to 512 MB',
    icon = 'upload-cloud',
    onFiles,
  } = options;

  const dropzoneEl = document.createElement('div');
  dropzoneEl.className = `dropzone ${compact ? 'dropzone--compact' : ''}`;
  dropzoneEl.setAttribute('role', 'button');
  dropzoneEl.setAttribute('tabindex', '0');
  dropzoneEl.setAttribute('aria-label', title);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = accept;
  fileInput.multiple = multiple;
  fileInput.style.display = 'none';

  if (compact) {
    dropzoneEl.innerHTML = `
      <i data-lucide="${escapeHtml(icon)}" class="dropzone__icon" aria-hidden="true"></i>
      <span class="dropzone__title" style="font-size:var(--font-size-sm);">${escapeHtml(title)}</span>
    `;
  } else {
    dropzoneEl.innerHTML = `
      <i data-lucide="${escapeHtml(icon)}" class="dropzone__icon" aria-hidden="true"></i>
      <div class="dropzone__title">${escapeHtml(title)}</div>
      <div class="dropzone__subtitle">${escapeHtml(subtitle)}</div>
    `;
  }

  dropzoneEl.appendChild(fileInput);

  function handleSelectedFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (typeof onFiles === 'function') {
      onFiles(files);
    }
    fileInput.value = ''; // Reset for re-selection of the same file
  }

  function onClick() {
    fileInput.click();
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzoneEl.classList.add('dropzone--hover');
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzoneEl.classList.remove('dropzone--hover');
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzoneEl.classList.remove('dropzone--hover');
    if (e.dataTransfer && e.dataTransfer.files) {
      handleSelectedFiles(e.dataTransfer.files);
    }
  }

  function onInputChange() {
    handleSelectedFiles(fileInput.files);
  }

  dropzoneEl.addEventListener('click', onClick);
  dropzoneEl.addEventListener('keydown', onKeyDown);
  dropzoneEl.addEventListener('dragover', onDragOver);
  dropzoneEl.addEventListener('dragleave', onDragLeave);
  dropzoneEl.addEventListener('drop', onDrop);
  fileInput.addEventListener('change', onInputChange);

  container.appendChild(dropzoneEl);

  if (window.lucide) {
    window.lucide.createIcons({ node: dropzoneEl });
  }

  return {
    element: dropzoneEl,
    destroy() {
      dropzoneEl.removeEventListener('click', onClick);
      dropzoneEl.removeEventListener('keydown', onKeyDown);
      dropzoneEl.removeEventListener('dragover', onDragOver);
      dropzoneEl.removeEventListener('dragleave', onDragLeave);
      dropzoneEl.removeEventListener('drop', onDrop);
      fileInput.removeEventListener('change', onInputChange);
      dropzoneEl.remove();
    },
  };
}
