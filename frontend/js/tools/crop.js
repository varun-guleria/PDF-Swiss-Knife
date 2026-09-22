/**
 * tools/crop.js — Crop Pages Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderCrop(container) {
  createSingleFileTool({
    container,
    title: 'Crop Pages',
    subtitle: 'Trim outer margins from all pages of your PDF document.',
    icon: 'crop',
    submitLabel: 'Crop Pages',
    submitIcon: 'crop',
    progressTitle: 'Cropping Pages…',
    renderOptions: (body) => {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-5);">
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Measurement Unit</label>
            <select class="input" data-option="unit" id="crop-unit" style="max-width:200px;">
              <option value="pt">Points (pt)</option>
              <option value="mm">Millimeters (mm)</option>
              <option value="in">Inches (in)</option>
              <option value="%">Percent (%)</option>
            </select>
          </div>

          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-3);">Margins to Trim</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:var(--space-4);">
              <div>
                <label style="font-size:var(--font-size-xs);color:var(--color-text-secondary);display:block;margin-bottom:var(--space-1);">Top</label>
                <input type="number" class="input" data-option="top" value="0" min="0" step="any">
              </div>
              <div>
                <label style="font-size:var(--font-size-xs);color:var(--color-text-secondary);display:block;margin-bottom:var(--space-1);">Bottom</label>
                <input type="number" class="input" data-option="bottom" value="0" min="0" step="any">
              </div>
              <div>
                <label style="font-size:var(--font-size-xs);color:var(--color-text-secondary);display:block;margin-bottom:var(--space-1);">Left</label>
                <input type="number" class="input" data-option="left" value="0" min="0" step="any">
              </div>
              <div>
                <label style="font-size:var(--font-size-xs);color:var(--color-text-secondary);display:block;margin-bottom:var(--space-1);">Right</label>
                <input type="number" class="input" data-option="right" value="0" min="0" step="any">
              </div>
            </div>
          </div>

          <div>
            <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);display:block;margin-bottom:var(--space-2);">Quick Presets</span>
            <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
              <button type="button" class="btn btn--secondary btn--sm" id="preset-05in">0.5 inch (all sides)</button>
              <button type="button" class="btn btn--secondary btn--sm" id="preset-10mm">10 mm (all sides)</button>
              <button type="button" class="btn btn--secondary btn--sm" id="preset-reset">Reset to 0</button>
            </div>
          </div>
        </div>
      `;

      const topIn = body.querySelector('[data-option="top"]');
      const btmIn = body.querySelector('[data-option="bottom"]');
      const leftIn = body.querySelector('[data-option="left"]');
      const rightIn = body.querySelector('[data-option="right"]');
      const unitSel = body.querySelector('#crop-unit');

      body.querySelector('#preset-05in').addEventListener('click', () => {
        unitSel.value = 'in';
        topIn.value = 0.5;
        btmIn.value = 0.5;
        leftIn.value = 0.5;
        rightIn.value = 0.5;
      });

      body.querySelector('#preset-10mm').addEventListener('click', () => {
        unitSel.value = 'mm';
        topIn.value = 10;
        btmIn.value = 10;
        leftIn.value = 10;
        rightIn.value = 10;
      });

      body.querySelector('#preset-reset').addEventListener('click', () => {
        topIn.value = 0;
        btmIn.value = 0;
        leftIn.value = 0;
        rightIn.value = 0;
      });
    },
    onSubmit: async (file, options) => {
      return api.cropPdf(file, {
        top: parseFloat(options.top || 0),
        bottom: parseFloat(options.bottom || 0),
        left: parseFloat(options.left || 0),
        right: parseFloat(options.right || 0),
        unit: options.unit || 'pt',
      });
    },
  });
}
