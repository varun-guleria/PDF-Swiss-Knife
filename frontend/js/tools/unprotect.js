/**
 * tools/unprotect.js — Remove PDF Protection Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderUnprotect(container) {
  createSingleFileTool({
    container,
    title: 'Remove Protection',
    subtitle: 'Remove password encryption from a PDF document.',
    icon: 'unlock',
    submitLabel: 'Remove Protection',
    submitIcon: 'unlock',
    progressTitle: 'Removing protection…',
    renderOptions: (body) => {
      body.innerHTML = `
        <div>
          <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">PDF Password</label>
          <input type="password" class="input" data-option="password" placeholder="Enter the PDF password" style="max-width:300px;" autocomplete="current-password">
          <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:var(--space-2);">
            Enter the password used to protect this PDF. Leave empty if the PDF has no open password.
          </div>
        </div>
      `;
    },
    onSubmit: async (file, options) => api.unprotectPdf(file, options.password || ''),
  });
}
