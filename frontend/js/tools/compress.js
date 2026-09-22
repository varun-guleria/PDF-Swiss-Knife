/**
 * tools/compress.js — Compress PDF Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderCompress(container) {
  createSingleFileTool({
    container,
    title: 'Compress PDF',
    subtitle: 'Reduce the file size of a PDF by removing unused objects and optimizing content.',
    icon: 'archive',
    submitLabel: 'Compress PDF',
    submitIcon: 'minimize-2',
    progressTitle: 'Compressing PDF…',
    renderOptions: (body) => {
      body.innerHTML = `
        <div>
          <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Compression Level</label>
          <select class="input" data-option="quality" style="max-width:200px;">
            <option value="80">Low (smaller savings, better quality)</option>
            <option value="60" selected>Medium (balanced)</option>
            <option value="40">High (larger savings, lower quality)</option>
            <option value="20">Maximum (smallest file)</option>
          </select>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:var(--space-2);">
            Higher compression may reduce image quality within the PDF.
          </div>
        </div>
      `;
    },
    onSubmit: async (file, options) => {
      return api.compressPdf(file, parseInt(options.quality) || 60);
    },
  });
}
