/**
 * tools/pagenums.js — Add Page Numbers Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderPageNumbers(container) {
  createSingleFileTool({
    container,
    title: 'Page Numbers',
    subtitle: 'Stamp page numbers on every page of a PDF document.',
    icon: 'hash',
    submitLabel: 'Add Page Numbers',
    submitIcon: 'hash',
    progressTitle: 'Adding page numbers…',
    illustration: '/assets/pagenums-illustration.jpg',
    renderOptions: (body) => {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-5);">
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Position</label>
            <select class="input" data-option="position" style="max-width:200px;">
              <option value="bottom-center" selected>Bottom Center</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="top-center">Top Center</option>
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
            </select>
          </div>
          <div style="display:flex;gap:var(--space-6);flex-wrap:wrap;">
            <div>
              <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Start Number</label>
              <input type="number" class="input" data-option="startNumber" value="1" min="0" style="max-width:100px;">
            </div>
            <div>
              <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Font Size</label>
              <input type="number" class="input" data-option="fontSize" value="11" min="6" max="36" style="max-width:100px;">
            </div>
          </div>
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Format</label>
            <select class="input" data-option="format" style="max-width:200px;">
              <option value="{n}" selected>1, 2, 3…</option>
              <option value="Page {n}">Page 1, Page 2…</option>
              <option value="{n} / {total}">1 / 10, 2 / 10…</option>
              <option value="Page {n} of {total}">Page 1 of 10…</option>
              <option value="- {n} -">- 1 -, - 2 -…</option>
            </select>
          </div>
        </div>
      `;
    },
    onSubmit: async (file, options) => api.addPageNumbers(file, {
      position: options.position || 'bottom-center',
      startNumber: parseInt(options.startNumber) || 1,
      fontSize: parseInt(options.fontSize) || 11,
      format: options.format || '{n}',
    }),
  });
}
