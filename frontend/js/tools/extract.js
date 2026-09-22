/**
 * tools/extract.js — Extract Pages Tool.
 * Uses the existing pages backend (reorganize with a subset of pages).
 */
'use strict';
import * as api from '../api.js';
import { isPdf, formatFileSize, escapeHtml, recordRecentJob } from '../utils.js';
import { createDropzone } from '../components/dropzone.js';
import { createProgressView } from '../components/progress.js';

export function renderExtract(container) {
  let selectedFile = null;
  let docInfo = null;

  const panel = document.createElement('div');
  panel.className = 'tool-panel';
  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Extract Pages</h1>
      <p class="page-header__subtitle">Select specific pages from a PDF and save them as a new document.</p>
    </div>
    <div class="workspace-flow">
      <div id="extract-dropzone"></div>
      <div id="extract-options" class="workspace-section" style="display:none;">
        <div class="workspace-section__header">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="copy" style="width:16px;height:16px;color:var(--color-brand);"></i>
            <span class="workspace-section__title" id="extract-filename"></span>
          </div>
        </div>
        <div style="padding:var(--space-5);">
          <label style="font-size:var(--font-size-xs);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);display:block;margin-bottom:var(--space-2);">Pages to extract</label>
          <input type="text" class="input" id="extract-pages-input" placeholder="e.g. 1, 3-5, 8" style="max-width:300px;">
          <div style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);margin-top:var(--space-2);" id="extract-page-hint">Enter page numbers or ranges</div>
        </div>
        <div style="padding:var(--space-3) var(--space-4);background:var(--color-bg-sunken);border-top:1px solid var(--color-border);display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn--primary btn--lg" id="extract-btn"><i data-lucide="copy"></i><span>Extract Pages</span></button>
        </div>
      </div>
      <div id="extract-progress" style="display:none;"></div>
    </div>
  `;
  container.appendChild(panel);

  const dropzone = panel.querySelector('#extract-dropzone');
  const optionsCard = panel.querySelector('#extract-options');
  const progressEl = panel.querySelector('#extract-progress');

  createDropzone({
    container: dropzone,
    accept: '.pdf,application/pdf',
    multiple: false,
    title: 'Choose a PDF file',
    subtitle: 'Select a PDF to extract pages from',
    icon: 'copy',
    onFiles: async (files) => {
      const valid = files.filter(isPdf);
      if (!valid.length) return;
      selectedFile = valid[0];
      try {
        docInfo = await api.inspectPdf(selectedFile);
        panel.querySelector('#extract-filename').textContent = `${selectedFile.name} — ${docInfo.page_count} pages`;
        panel.querySelector('#extract-page-hint').textContent = `Document has ${docInfo.page_count} pages. Enter page numbers or ranges (e.g. 1, 3-5, 8)`;
        dropzone.style.display = 'none';
        optionsCard.style.display = 'block';
      } catch (e) {
        alert(e.message || 'Failed to inspect PDF');
      }
      if (window.lucide) window.lucide.createIcons({ node: panel });
    },
  });

  panel.querySelector('#extract-btn').addEventListener('click', async () => {
    if (!docInfo) return;
    const rangeStr = panel.querySelector('#extract-pages-input').value.trim();
    if (!rangeStr) return;

    // Parse ranges into page specs
    const specs = [];
    for (const part of rangeStr.split(',')) {
      const p = part.trim();
      if (p.includes('-')) {
        const [a, b] = p.split('-').map(s => parseInt(s.trim()));
        for (let i = a; i <= b; i++) specs.push({ index: i - 1, rotation: 0 });
      } else {
        specs.push({ index: parseInt(p) - 1, rotation: 0 });
      }
    }

    optionsCard.style.display = 'none';
    progressEl.style.display = 'block';
    progressEl.innerHTML = '';

    const pv = createProgressView({ container: progressEl, title: 'Extracting pages…' });
    pv.update({ percent: 50, message: 'Processing…', status: 'Extracting' });

    try {
      const result = await api.reorganizePdf(docInfo.doc_id, specs, `extracted_${selectedFile.name}`);
      const finalStatus = await api.pollJob(result.job_id, (job) => {
        pv.update({ current: job.current, total: job.total, message: job.message, status: 'Processing' });
      });
      const filesRes = await api.listOutputs(result.job_id).catch(() => ({ files: [] }));
      const outName = filesRes.files?.[0]?.name || result.output_name;
      recordRecentJob('Extract Pages', outName, `/api/output/${result.job_id}/download/${encodeURIComponent(outName)}`);
      pv.showSuccess({
        title: 'Extraction Complete',
        message: `Extracted ${specs.length} pages.`,
        actions: [
          { label: 'Download', icon: 'download', variant: 'primary',
            onClick: () => api.downloadFile(result.job_id, filesRes.files?.[0]?.name || result.output_name) },
          { label: 'Extract More', icon: 'refresh-cw', variant: 'secondary',
            onClick: () => { container.innerHTML = ''; renderExtract(container); } },
        ],
      });
    } catch (e) {
      pv.showError({ title: 'Extraction Failed', message: e.message,
        onReset: () => { container.innerHTML = ''; renderExtract(container); } });
    }
  });

  if (window.lucide) window.lucide.createIcons({ node: panel });
}
