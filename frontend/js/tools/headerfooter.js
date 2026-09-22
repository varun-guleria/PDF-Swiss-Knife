/**
 * tools/headerfooter.js — Add Header & Footer Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderHeaderFooter(container) {
  createSingleFileTool({
    container,
    title: 'Header & Footer',
    subtitle: 'Add custom header and footer text to every page. Use {n} for page number and {total} for total pages.',
    icon: 'align-center',
    submitLabel: 'Apply Header & Footer',
    submitIcon: 'align-center',
    progressTitle: 'Adding header & footer…',
    renderOptions: (body) => {
      const makeRow = (prefix, label) => `
        <div>
          <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);display:block;margin-bottom:var(--space-3);color:var(--color-text-primary);">${label}</label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-3);">
            <div>
              <label style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);display:block;margin-bottom:var(--space-1);">Left</label>
              <input type="text" class="input" data-option="${prefix}Left" placeholder="Left text" style="font-size:var(--font-size-sm);">
            </div>
            <div>
              <label style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);display:block;margin-bottom:var(--space-1);">Center</label>
              <input type="text" class="input" data-option="${prefix}Center" placeholder="Center text" style="font-size:var(--font-size-sm);">
            </div>
            <div>
              <label style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);display:block;margin-bottom:var(--space-1);">Right</label>
              <input type="text" class="input" data-option="${prefix}Right" placeholder="Right text" style="font-size:var(--font-size-sm);">
            </div>
          </div>
        </div>
      `;
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-6);">
          ${makeRow('header', 'Header')}
          ${makeRow('footer', 'Footer')}
          <div style="display:flex;align-items:center;gap:var(--space-4);">
            <div>
              <label style="font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);display:block;margin-bottom:var(--space-2);">Font Size</label>
              <input type="number" class="input" data-option="fontSize" value="9" min="6" max="24" style="max-width:80px;">
            </div>
            <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);padding-top:var(--space-5);">
              Use <code style="background:var(--color-surface-secondary);padding:1px 4px;border-radius:3px;">{n}</code> for page number and
              <code style="background:var(--color-surface-secondary);padding:1px 4px;border-radius:3px;">{total}</code> for total pages.
            </div>
          </div>
        </div>
      `;
    },
    onSubmit: async (file, options) => api.addHeaderFooter(file, {
      headerLeft: options.headerLeft || '',
      headerCenter: options.headerCenter || '',
      headerRight: options.headerRight || '',
      footerLeft: options.footerLeft || '',
      footerCenter: options.footerCenter || '',
      footerRight: options.footerRight || '',
      fontSize: parseInt(options.fontSize) || 9,
    }),
  });
}
