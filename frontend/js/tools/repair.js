/**
 * tools/repair.js — Repair/Normalize PDF Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderRepair(container) {
  createSingleFileTool({
    container,
    title: 'Repair / Normalize',
    subtitle: 'Fix minor corruption and normalize the PDF structure for maximum compatibility.',
    icon: 'wrench',
    submitLabel: 'Repair PDF',
    submitIcon: 'wrench',
    progressTitle: 'Repairing PDF…',
    renderOptions: (body) => {
      body.innerHTML = `
        <div style="padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-surface-secondary);font-size:var(--font-size-sm);color:var(--color-text-secondary);">
          <strong>What this does:</strong>
          <ul style="margin:var(--space-2) 0 0 var(--space-4);padding:0;">
            <li>Re-writes the PDF in a clean, linearized format</li>
            <li>Fixes minor structural issues</li>
            <li>Improves compatibility with various PDF viewers</li>
            <li>Removes unused objects</li>
          </ul>
        </div>
      `;
    },
    onSubmit: async (file) => api.repairPdf(file),
  });
}
