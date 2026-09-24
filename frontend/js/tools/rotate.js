/**
 * tools/rotate.js — Rotate Pages Tool.
 * Quick rotate: apply a uniform rotation to all pages.
 */
'use strict';
import * as api from '../api.js';
import { isPdf, escapeHtml, recordRecentJob } from '../utils.js';
import { createDropzone } from '../components/dropzone.js';
import { createProgressView } from '../components/progress.js';

export function renderRotate(container) {
  let selectedFile = null;
  let docInfo = null;
  let isProcessing = false;

  const panel = document.createElement('div');
  panel.className = 'tool-panel';
  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-header__title">Rotate Pages</h1>
      <p class="page-header__subtitle">Rotate all pages in a PDF by 90°, 180°, or 270°.</p>
    </div>
    <div class="workspace-flow">
      <div id="rotate-dropzone"></div>
      <div id="rotate-options" class="workspace-section" style="display:none;">
        <div class="workspace-section__header">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i data-lucide="rotate-cw" style="width:16px;height:16px;color:var(--color-brand);"></i>
            <span class="workspace-section__title" id="rotate-filename"></span>
          </div>
        </div>
        <div style="padding:var(--space-5);">
          <label style="font-size:var(--font-size-xs);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:var(--letter-spacing-wide);display:block;margin-bottom:var(--space-3);">Rotation Angle</label>
          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:var(--radius-sm);border:1px solid var(--color-border);cursor:pointer;background:var(--color-bg-surface);">
              <input type="radio" name="rotation" value="90" checked style="accent-color:var(--color-brand);"> <span style="font-size:var(--font-size-base);">90° Clockwise</span>
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:var(--radius-sm);border:1px solid var(--color-border);cursor:pointer;background:var(--color-bg-surface);">
              <input type="radio" name="rotation" value="180" style="accent-color:var(--color-brand);"> <span style="font-size:var(--font-size-base);">180°</span>
            </label>
            <label style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:var(--radius-sm);border:1px solid var(--color-border);cursor:pointer;background:var(--color-bg-surface);">
              <input type="radio" name="rotation" value="270" style="accent-color:var(--color-brand);"> <span style="font-size:var(--font-size-base);">90° Counter-clockwise</span>
            </label>
          </div>
        </div>
        <div style="padding:var(--space-3) var(--space-4);background:var(--color-bg-sunken);border-top:1px solid var(--color-border);display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn--primary btn--lg" id="rotate-btn"><i data-lucide="rotate-cw"></i><span>Rotate All Pages</span></button>
        </div>
      </div>
      <div id="rotate-progress" style="display:none;"></div>
      <div id="rotate-illustration" style="text-align:center;margin-top:var(--space-8);padding-bottom:var(--space-8);transform:translateX(250px);"><img src="/assets/rotate-illustration.jpg" alt="Rotate Illustration" style="max-width:100%;height:auto;max-height:280px;object-fit:contain;opacity:0.9;" /></div>
    </div>
  `;
  container.appendChild(panel);

  const dropzone = panel.querySelector('#rotate-dropzone');
  const optionsCard = panel.querySelector('#rotate-options');
  const progressEl = panel.querySelector('#rotate-progress');
  const illustrationEl = panel.querySelector('#rotate-illustration');

  createDropzone({
    container: dropzone, accept: '.pdf,application/pdf', multiple: false,
    title: 'Choose a PDF file', subtitle: 'Select a PDF to rotate', icon: 'rotate-cw',
    onFiles: async (files) => {
      const valid = files.filter(isPdf);
      if (!valid.length) return;
      selectedFile = valid[0];
      try {
        docInfo = await api.inspectPdf(selectedFile);
        panel.querySelector('#rotate-filename').textContent = `${selectedFile.name} — ${docInfo.page_count} pages`;
        dropzone.style.display = 'none';
        optionsCard.style.display = 'block';
        if (illustrationEl) illustrationEl.style.display = 'none';
      } catch (e) { alert(e.message); }
      if (window.lucide) window.lucide.createIcons({ node: panel });
    },
  });

  panel.querySelector('#rotate-btn').addEventListener('click', async () => {
    if (!docInfo) return;
    const rotation = parseInt(panel.querySelector('input[name="rotation"]:checked').value);
    const specs = docInfo.pages.map(p => ({ index: p.index, rotation }));

    optionsCard.style.display = 'none';
    progressEl.style.display = 'block';
    progressEl.innerHTML = '';

    const pv = createProgressView({ container: progressEl, title: 'Rotating pages…' });
    pv.update({ percent: 50, message: 'Processing…', status: 'Rotating' });

    try {
      const result = await api.reorganizePdf(docInfo.doc_id, specs, `rotated_${selectedFile.name}`);
      const finalStatus = await api.pollJob(result.job_id, (job) => {
        pv.update({ current: job.current, total: job.total, message: job.message, status: 'Processing' });
      });
      const filesRes = await api.listOutputs(result.job_id).catch(() => ({ files: [] }));
      const outName = filesRes.files?.[0]?.name || result.output_name;
      recordRecentJob('Rotate Pages', outName, `/api/output/${result.job_id}/download/${encodeURIComponent(outName)}`);
      pv.showSuccess({
        title: 'Rotation Complete',
        message: `Rotated ${docInfo.page_count} pages by ${rotation}°.`,
        actions: [
          { label: 'Download', icon: 'download', variant: 'primary',
            onClick: () => api.downloadFile(result.job_id, filesRes.files?.[0]?.name || result.output_name) },
          { label: 'Rotate Another', icon: 'refresh-cw', variant: 'secondary',
            onClick: () => { container.innerHTML = ''; renderRotate(container); } },
        ],
      });
    } catch (e) {
      pv.showError({ title: 'Rotation Failed', message: e.message,
        onReset: () => { container.innerHTML = ''; renderRotate(container); } });
    }
  });

  if (window.lucide) window.lucide.createIcons({ node: panel });
}
