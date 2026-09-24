/**
 * tools/protect.js — Protect PDF Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderProtect(container) {
  createSingleFileTool({
    container,
    title: 'Protect PDF',
    subtitle: 'Add password encryption and permission restrictions to a PDF document.',
    icon: 'lock',
    submitLabel: 'Protect PDF',
    submitIcon: 'lock',
    progressTitle: 'Encrypting PDF…',
    illustration: '/assets/protect-illustration.jpg',
    renderOptions: (body) => {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-5);">
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Open Password</label>
            <input type="password" class="input" data-option="userPassword" placeholder="Password to open the PDF" style="max-width:300px;" autocomplete="new-password">
            <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:var(--space-1);">Required to open the document</div>
          </div>
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Owner Password (optional)</label>
            <input type="password" class="input" data-option="ownerPassword" placeholder="Password for full permissions" style="max-width:300px;" autocomplete="new-password">
            <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:var(--space-1);">Required to change permissions (defaults to open password)</div>
          </div>
          <div>
            <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-3);">Permissions</label>
            <div style="display:flex;flex-direction:column;gap:var(--space-3);">
              <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;">
                <input type="checkbox" data-option="allowPrinting" checked style="accent-color:var(--color-brand);">
                <span style="font-size:var(--font-size-sm);">Allow printing</span>
              </label>
              <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;">
                <input type="checkbox" data-option="allowCopying" style="accent-color:var(--color-brand);">
                <span style="font-size:var(--font-size-sm);">Allow copying text and images</span>
              </label>
            </div>
          </div>
        </div>
      `;
    },
    onSubmit: async (file, options) => {
      if (!options.userPassword && !options.ownerPassword) {
        throw new Error('Please enter at least one password.');
      }
      return api.protectPdf(file, options.userPassword || '', options.ownerPassword || '', {
        allowPrinting: options.allowPrinting,
        allowCopying: options.allowCopying,
      });
    },
  });
}
