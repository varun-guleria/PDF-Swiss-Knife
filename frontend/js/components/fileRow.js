/**
 * components/fileRow.js — Reusable file list component with drag-and-drop reordering.
 *
 * Renders an accessible, reorderable list of uploaded PDF files with
 * metadata (size, page count) and quick action controls (move up/down, remove).
 */

'use strict';

import { formatFileSize, formatPageCount, escapeHtml } from '../utils.js';

/**
 * @typedef {Object} FileItem
 * @property {File} file
 * @property {string} [id]
 * @property {number} [pageCount]
 */

/**
 * @typedef {Object} FileListOptions
 * @property {HTMLElement} container
 * @property {FileItem[]} files
 * @property {(files: FileItem[]) => void} [onReorder]
 * @property {(index: number) => void} [onRemove]
 */

/**
 * Creates and renders an interactive file list with drag-and-drop & button reordering.
 * @param {FileListOptions} options
 * @returns {{ update: (newFiles: FileItem[]) => void, destroy: () => void }}
 */
export function createFileList(options) {
  const { container, onReorder, onRemove } = options;
  let items = [...(options.files || [])];

  const listEl = document.createElement('div');
  listEl.className = 'file-list';
  listEl.setAttribute('role', 'list');
  listEl.setAttribute('aria-label', 'Selected PDF files');

  let draggedIndex = null;

  function render() {
    listEl.innerHTML = '';

    if (items.length === 0) {
      return;
    }

    items.forEach((item, index) => {
      const file = item.file || item;
      const row = document.createElement('div');
      row.className = 'file-row';
      row.setAttribute('role', 'listitem');
      row.setAttribute('draggable', 'true');
      row.dataset.index = String(index);

      const sizeStr = formatFileSize(file.size || 0);
      const pagesStr = item.pageCount ? formatPageCount(item.pageCount) : '';
      const metaParts = [sizeStr, pagesStr].filter(Boolean).join(' • ');

      row.innerHTML = `
        <div class="file-row__handle" title="Drag to reorder" aria-hidden="true">
          <i data-lucide="grip-vertical"></i>
        </div>
        <div class="file-row__index">${index + 1}</div>
        <div class="file-row__icon" aria-hidden="true">
          <i data-lucide="file-text"></i>
        </div>
        <div class="file-row__info">
          <div class="file-row__name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="file-row__meta">${escapeHtml(metaParts)}</div>
        </div>
        <div class="file-row__actions">
          <button
            type="button"
            class="btn btn--ghost btn--icon btn--sm file-row__btn-up"
            title="Move up"
            aria-label="Move ${escapeHtml(file.name)} up"
            ${index === 0 ? 'disabled' : ''}
          >
            <i data-lucide="chevron-up"></i>
          </button>
          <button
            type="button"
            class="btn btn--ghost btn--icon btn--sm file-row__btn-down"
            title="Move down"
            aria-label="Move ${escapeHtml(file.name)} down"
            ${index === items.length - 1 ? 'disabled' : ''}
          >
            <i data-lucide="chevron-down"></i>
          </button>
          <button
            type="button"
            class="btn btn--ghost btn--icon btn--sm btn--danger file-row__btn-remove"
            title="Remove file"
            aria-label="Remove ${escapeHtml(file.name)}"
          >
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // ── Drag and drop handlers ──────────────────────────────────────
      row.addEventListener('dragstart', (e) => {
        draggedIndex = index;
        row.classList.add('file-row--dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('file-row--dragging');
        listEl.querySelectorAll('.file-row--drag-over').forEach(el => {
          el.classList.remove('file-row--drag-over');
        });
        draggedIndex = null;
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedIndex !== null && draggedIndex !== index) {
          row.classList.add('file-row--drag-over');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('file-row--drag-over');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('file-row--drag-over');
        if (draggedIndex === null || draggedIndex === index) return;

        const moved = items.splice(draggedIndex, 1)[0];
        items.splice(index, 0, moved);

        render();
        if (typeof onReorder === 'function') {
          onReorder(items);
        }
      });

      // ── Button handlers ─────────────────────────────────────────────
      const btnUp = row.querySelector('.file-row__btn-up');
      const btnDown = row.querySelector('.file-row__btn-down');
      const btnRemove = row.querySelector('.file-row__btn-remove');

      if (btnUp) {
        btnUp.addEventListener('click', (e) => {
          e.stopPropagation();
          if (index > 0) {
            const temp = items[index];
            items[index] = items[index - 1];
            items[index - 1] = temp;
            render();
            if (typeof onReorder === 'function') onReorder(items);
          }
        });
      }

      if (btnDown) {
        btnDown.addEventListener('click', (e) => {
          e.stopPropagation();
          if (index < items.length - 1) {
            const temp = items[index];
            items[index] = items[index + 1];
            items[index + 1] = temp;
            render();
            if (typeof onReorder === 'function') onReorder(items);
          }
        });
      }

      if (btnRemove) {
        btnRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          items.splice(index, 1);
          render();
          if (typeof onRemove === 'function') onRemove(index);
          if (typeof onReorder === 'function') onReorder(items);
        });
      }

      listEl.appendChild(row);
    });

    if (window.lucide) {
      window.lucide.createIcons({ node: listEl });
    }
  }

  container.appendChild(listEl);
  render();

  return {
    update(newFiles) {
      items = [...newFiles];
      render();
    },
    destroy() {
      listEl.remove();
    },
  };
}
