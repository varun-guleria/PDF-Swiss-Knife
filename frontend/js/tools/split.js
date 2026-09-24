/**
 * tools/split.js — Split PDF Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderSplit(container) {
  createSingleFileTool({
    container,
    title: 'Split PDF',
    subtitle: 'Divide a PDF into multiple smaller documents by page ranges, fixed page count, or into individual pages.',
    icon: 'scissors',
    submitLabel: 'Split PDF',
    submitIcon: 'scissors',
    progressTitle: 'Splitting PDF…',
    illustration: '/assets/split-illustration.jpg',
    renderOptions: (body) => {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-5);">
          <div>
            <label style="font-size:var(--font-size-xs);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);display:block;margin-bottom:var(--space-3);">Split Mode</label>
            <div style="display:flex;flex-direction:column;gap:var(--space-2);">
              <label class="radio-option" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);border:1px solid var(--color-border);cursor:pointer;background:var(--color-bg-surface);">
                <input type="radio" name="split-mode" value="singles" data-option="mode" checked style="accent-color:var(--color-brand);">
                <div>
                  <div style="font-size:var(--font-size-base);font-weight:var(--font-weight-medium);color:var(--color-text-primary);">Into Individual Pages</div>
                  <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">One PDF file per page</div>
                </div>
              </label>
              <label class="radio-option" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);border:1px solid var(--color-border);cursor:pointer;background:var(--color-bg-surface);">
                <input type="radio" name="split-mode" value="every_n" style="accent-color:var(--color-brand);">
                <div style="flex:1;">
                  <div style="font-size:var(--font-size-base);font-weight:var(--font-weight-medium);color:var(--color-text-primary);">Every N Pages</div>
                  <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-bottom:var(--space-2);">Split into chunks of a fixed number of pages</div>
                  <input type="number" class="input" data-option="n" value="5" min="1" max="1000" style="max-width:100px;display:none;" id="split-n-input">
                </div>
              </label>
              <label class="radio-option" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);border:1px solid var(--color-border);cursor:pointer;background:var(--color-bg-surface);">
                <input type="radio" name="split-mode" value="ranges" style="accent-color:var(--color-brand);">
                <div style="flex:1;">
                  <div style="font-size:var(--font-size-base);font-weight:var(--font-weight-medium);color:var(--color-text-primary);">By Page Ranges</div>
                  <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-bottom:var(--space-2);">Each comma-separated range becomes a separate PDF</div>
                  <input type="text" class="input" data-option="ranges" placeholder="e.g. 1-3, 4-6, 7-10" style="display:none;" id="split-ranges-input">
                </div>
              </label>
            </div>
          </div>
        </div>
      `;

      // Wire radio buttons to show/hide sub-options
      body.querySelectorAll('input[name="split-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
          const nInput = body.querySelector('#split-n-input');
          const rangesInput = body.querySelector('#split-ranges-input');
          nInput.style.display = radio.value === 'every_n' ? 'block' : 'none';
          rangesInput.style.display = radio.value === 'ranges' ? 'block' : 'none';
          // Update the mode data-option
          body.querySelectorAll('[data-option="mode"]').forEach(el => el.removeAttribute('data-option'));
          radio.setAttribute('data-option', 'mode');
        });
      });
    },
    onSubmit: async (file, options) => {
      const mode = options.mode || 'singles';
      return api.splitPdf(file, mode, { ranges: options.ranges, n: options.n });
    },
    getSuccessActions: (status, jobId, filesRes) => {
      const actions = [{
        label: 'Download All as ZIP',
        icon: 'archive',
        variant: 'primary',
        onClick: () => api.downloadZip(jobId),
      }];
      actions.push({
        label: 'Split Another',
        icon: 'refresh-cw',
        variant: 'secondary',
        onClick: () => renderSplit(container.parentElement ? container : container),
      });
      return actions;
    },
  });
}
