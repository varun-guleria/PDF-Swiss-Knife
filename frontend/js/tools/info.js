/**
 * tools/info.js — PDF Information Tool.
 */
'use strict';
import * as api from '../api.js';
import { isPdf, formatFileSize, escapeHtml } from '../utils.js';
import { createDropzone } from '../components/dropzone.js';

export function renderInfo(container) {
  const panel = document.createElement('div');
  panel.className = 'tool-panel';
  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">PDF Information</h1>
      <p class="page-header__subtitle">View detailed metadata, page dimensions, and properties of a PDF file.</p>
    </div>
    <div class="tool-workspace" style="display:flex;flex-direction:column;gap:var(--space-6);">
      <div id="info-dropzone"></div>
      <div id="info-results" style="display:none;"></div>
    </div>
  `;
  container.appendChild(panel);

  const dropzoneEl = panel.querySelector('#info-dropzone');
  const resultsEl = panel.querySelector('#info-results');

  createDropzone({
    container: dropzoneEl, accept: '.pdf,application/pdf', multiple: false,
    title: 'Choose a PDF file', subtitle: 'View metadata and page information',
    icon: 'info',
    onFiles: async (files) => {
      const valid = files.filter(isPdf);
      if (!valid.length) return;

      try {
        const info = await api.getPdfInfo(valid[0]);
        dropzoneEl.style.display = 'none';
        resultsEl.style.display = 'block';

        const metaRows = Object.entries(info.metadata || {}).map(([k, v]) =>
          `<tr><td style="font-weight:var(--font-weight-medium);padding:var(--space-2) var(--space-4);white-space:nowrap;color:var(--color-text-secondary);">${escapeHtml(k)}</td>
           <td style="padding:var(--space-2) var(--space-4);word-break:break-all;">${escapeHtml(v)}</td></tr>`
        ).join('') || '<tr><td colspan="2" style="padding:var(--space-3);color:var(--color-text-tertiary);">No metadata available</td></tr>';

        const pageRows = (info.pages || []).slice(0, 20).map(p =>
          `<tr>
            <td style="padding:var(--space-2) var(--space-4);text-align:center;">${p.page_number}</td>
            <td style="padding:var(--space-2) var(--space-4);text-align:center;">${p.width_pt} × ${p.height_pt}</td>
            <td style="padding:var(--space-2) var(--space-4);text-align:center;">${p.width_in}" × ${p.height_in}"</td>
            <td style="padding:var(--space-2) var(--space-4);text-align:center;">${p.width_mm} × ${p.height_mm}</td>
            <td style="padding:var(--space-2) var(--space-4);text-align:center;">${p.rotation}°</td>
          </tr>`
        ).join('');

        resultsEl.innerHTML = `
          <div class="workspace-section">
            <div class="workspace-section__header">
              <div style="display:flex;align-items:center;gap:var(--space-3);">
                <i data-lucide="info" style="width:16px;height:16px;color:var(--color-brand);"></i>
                <span class="workspace-section__title">${escapeHtml(info.filename)}</span>
              </div>
              <button type="button" class="btn btn--secondary btn--sm" id="info-another"><i data-lucide="refresh-cw"></i><span>Inspect Another</span></button>
            </div>
            <div style="padding:var(--space-5);">
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-4);margin-bottom:var(--space-6);">
                <div style="padding:var(--space-3) var(--space-4);border-radius:var(--radius-sm);border:1px solid var(--color-border);background:var(--color-bg-sunken);">
                  <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);margin-bottom:2px;">Pages</div>
                  <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);color:var(--color-text-primary);">${info.page_count}</div>
                </div>
                <div style="padding:var(--space-3) var(--space-4);border-radius:var(--radius-sm);border:1px solid var(--color-border);background:var(--color-bg-sunken);">
                  <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);margin-bottom:2px;">File Size</div>
                  <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);color:var(--color-text-primary);">${formatFileSize(info.file_size)}</div>
                </div>
                <div style="padding:var(--space-3) var(--space-4);border-radius:var(--radius-sm);border:1px solid var(--color-border);background:var(--color-bg-sunken);">
                  <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);margin-bottom:2px;">Encrypted</div>
                  <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);color:${info.is_encrypted ? 'var(--color-warning)' : 'var(--color-success)'};">${info.is_encrypted ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <h3 style="font-size:var(--font-size-xs);font-weight:var(--font-weight-semibold);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);color:var(--color-text-secondary);margin-bottom:var(--space-3);">Metadata</h3>
              <table style="width:100%;border-collapse:collapse;font-size:var(--font-size-sm);margin-bottom:var(--space-6);border:1px solid var(--color-border);border-radius:var(--radius-sm);overflow:hidden;">
                ${metaRows}
              </table>

              ${pageRows ? `
              <h3 style="font-size:var(--font-size-xs);font-weight:var(--font-weight-semibold);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);color:var(--color-text-secondary);margin-bottom:var(--space-3);">Page Dimensions${info.page_count > 20 ? ' (first 20)' : ''}</h3>
              <div style="overflow-x:auto;border:1px solid var(--color-border);border-radius:var(--radius-sm);overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:var(--font-size-sm);">
                  <thead><tr style="border-bottom:1px solid var(--color-border);background:var(--color-bg-sunken);font-size:var(--font-size-xs);color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);">
                    <th style="padding:var(--space-2) var(--space-4);text-align:center;">Page</th>
                    <th style="padding:var(--space-2) var(--space-4);text-align:center;">Points</th>
                    <th style="padding:var(--space-2) var(--space-4);text-align:center;">Inches</th>
                    <th style="padding:var(--space-2) var(--space-4);text-align:center;">Millimeters</th>
                    <th style="padding:var(--space-2) var(--space-4);text-align:center;">Rotation</th>
                  </tr></thead>
                  <tbody>${pageRows}</tbody>
                </table>
              </div>` : ''}
            </div>
          </div>
        `;

        resultsEl.querySelector('#info-another').addEventListener('click', () => {
          resultsEl.style.display = 'none';
          dropzoneEl.style.display = 'block';
        });

        if (window.lucide) window.lucide.createIcons({ node: resultsEl });
      } catch (e) {
        alert(e.message || 'Failed to read PDF info');
      }
    },
  });

  if (window.lucide) window.lucide.createIcons({ node: panel });
}
