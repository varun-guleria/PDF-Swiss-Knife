/**
 * tools/toImages.js — PDF → Images conversion tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderToImages(container) {
  createSingleFileTool({
    container,
    title: 'PDF → Images',
    subtitle: 'Convert each page of a PDF into an image file (PNG or JPEG).',
    icon: 'image',
    submitLabel: 'Convert to Images',
    submitIcon: 'image',
    progressTitle: 'Converting pages to images…',
    renderOptions: (body) => {
      body.innerHTML = `
        <div style="display:flex;gap:var(--space-6);flex-wrap:wrap;">
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Format</label>
            <select class="input" data-option="format" style="min-width:120px;">
              <option value="png" selected>PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </div>
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Resolution (DPI)</label>
            <select class="input" data-option="dpi" style="min-width:120px;">
              <option value="72">72 DPI (Screen)</option>
              <option value="150" selected>150 DPI (Standard)</option>
              <option value="300">300 DPI (High Quality)</option>
              <option value="600">600 DPI (Print)</option>
            </select>
          </div>
        </div>
      `;
    },
    onSubmit: async (file, options) => {
      return api.pdfToImages(file, options.format || 'png', parseInt(options.dpi) || 150);
    },
    getSuccessActions: (status, jobId) => [
      { label: 'Download All as ZIP', icon: 'archive', variant: 'primary', onClick: () => api.downloadZip(jobId) },
      { label: 'Convert Another', icon: 'refresh-cw', variant: 'secondary', onClick: () => { container.innerHTML = ''; renderToImages(container); } },
    ],
  });
}
