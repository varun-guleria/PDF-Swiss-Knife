/**
 * tools/watermark.js — Add Watermark Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderWatermark(container) {
  createSingleFileTool({
    container,
    title: 'Watermark',
    subtitle: 'Add a diagonal text watermark to every page of a PDF document.',
    icon: 'droplets',
    submitLabel: 'Apply Watermark',
    submitIcon: 'droplets',
    progressTitle: 'Applying watermark…',
    renderOptions: (body) => {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-5);">
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Watermark Text</label>
            <input type="text" class="input" data-option="text" value="DRAFT" placeholder="e.g. CONFIDENTIAL, DRAFT, COPY" style="max-width:300px;">
          </div>
          <div style="display:flex;gap:var(--space-6);flex-wrap:wrap;">
            <div>
              <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Opacity</label>
              <input type="number" class="input" data-option="opacity" value="0.15" min="0.01" max="1" step="0.05" style="max-width:100px;">
            </div>
            <div>
              <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Font Size</label>
              <input type="number" class="input" data-option="fontSize" value="60" min="10" max="200" style="max-width:100px;">
            </div>
            <div>
              <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Color</label>
              <input type="color" data-option="color" value="#888888" style="width:50px;height:36px;border:1px solid var(--color-border);border-radius:var(--radius-md);cursor:pointer;">
            </div>
            <div>
              <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Rotation</label>
              <input type="number" class="input" data-option="rotation" value="45" min="-90" max="90" style="max-width:100px;">
            </div>
          </div>
        </div>
      `;
    },
    onSubmit: async (file, options) => api.addWatermark(file, {
      text: options.text || 'DRAFT',
      opacity: parseFloat(options.opacity) || 0.15,
      fontSize: parseInt(options.fontSize) || 60,
      color: options.color || '#888888',
      rotation: parseInt(options.rotation) || 45,
    }),
  });
}
