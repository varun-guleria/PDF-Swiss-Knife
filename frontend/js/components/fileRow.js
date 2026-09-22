/**
 * components/fileRow.js — Reusable file list component with drag-and-drop reordering.
 *
 * Renders an accessible, reorderable desktop-class file manager list for uploaded PDF files.
 * Each row includes: drag handle, index, file icon, name, type badge, page count,
 * file size, replace action, reorder controls, and remove action.
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
 * @property {(index: number, newFile: File) => void} [onReplace]
 * @property {boolean} [showHeader=true]
 */

/**
 * Creates and renders an interactive file list with drag-and-drop & button reordering.
 * @param {FileListOptions} options
 * @returns {{ update: (newFiles: FileItem[]) => void, destroy: () => void }}
 */
export function createFileList(options) {
  const { container, onReorder, onRemove, onReplace, showHeader = true } = options;
  let items = [...(options.files || [])];

  const wrapper = document.createElement('div');
  wrapper.className = 'file-manager';

  const listEl = document.createElement('div');
  listEl.className = 'file-list';
  listEl.setAttribute('role', 'list');
  listEl.setAttribute('aria-label', 'Selected PDF files');

  let draggedIndex = null;

  function render() {
    wrapper.innerHTML = '';
    listEl.innerHTML = '';

    if (items.length === 0) {
      return;
    }

    if (showHeader) {
      const header = document.createElement('div');
      header.className = 'file-list__header';
      header.innerHTML = `
        <div class="file-list__th file-list__th--index">#</div>
        <div class="file-list__th file-list__th--name">Document</div>
        <div class="file-list__th file-list__th--meta">Details</div>
        <div class="file-list__th file-list__th--actions">Actions</div>
      `;
      wrapper.appendChild(header);
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
      const ext = (file.name.split('.').pop() || 'pdf').toUpperCase();

      row.innerHTML = `
        <div class="file-row__leading">
          <div class="file-row__handle" title="Drag to reorder" aria-hidden="true">
            <i data-lucide="grip-vertical"></i>
          </div>
          <div class="file-row__index">${String(index + 1).padStart(2, '0')}</div>
          <div class="file-row__icon" aria-hidden="true">
            <i data-lucide="file-text"></i>
          </div>
        </div>
        <div class="file-row__info">
          <div class="file-row__name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
        </div>
        <div class="file-row__meta">
          <span class="file-row__type-badge">${escapeHtml(ext)}</span>
          ${pagesStr ? `<span class="file-row__pages">${escapeHtml(pagesStr)}</span>` : ''}
          <span class="file-row__size">${escapeHtml(sizeStr)}</span>
        </div>
        <div class="file-row__actions">
          <button
            type="button"
            class="btn btn--ghost btn--sm file-row__btn-replace"
            title="Replace this file"
            aria-label="Replace ${escapeHtml(file.name)}"
          >
            <i data-lucide="refresh-cw"></i>
            <span class="btn-text">Replace</span>
          </button>
          <div class="file-row__reorder-group">
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
          </div>
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
      const btnReplace = row.querySelector('.file-row__btn-replace');

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

      if (btnReplace) {
        btnReplace.addEventListener('click', (e) => {
          e.stopPropagation();
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = '.pdf,application/pdf';
          fileInput.style.display = 'none';
          fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
              const newFile = fileInput.files[0];
              if (typeof onReplace === 'function') {
                onReplace(index, newFile);
              } else {
                items[index] = items[index].file ? { ...items[index], file: newFile } : newFile;
                render();
                if (typeof onReorder === 'function') onReorder(items);
              }
            }
            fileInput.remove();
          });
          document.body.appendChild(fileInput);
          fileInput.click();
        });
      }

      listEl.appendChild(row);
    });

    wrapper.appendChild(listEl);

    if (window.lucide) {
      window.lucide.createIcons({ node: wrapper });
    }
  }

  container.appendChild(wrapper);
  render();

  return {
    update(newFiles) {
      items = [...newFiles];
      render();
    },
    destroy() {
      wrapper.remove();
    },
  };
}
