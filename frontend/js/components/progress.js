/**
 * components/progress.js — Reusable progress indicator and status component.
 *
 * Displays live job progress (percentage, items processed, current file name)
 * and switches cleanly between active processing, success, and error states.
 */

'use strict';

import { escapeHtml } from '../utils.js';

/**
 * @typedef {Object} ProgressOptions
 * @property {HTMLElement} container
 * @property {string} [title='Processing…']
 * @property {number} [total=0]
 * @property {() => void} [onCancel]
 */

/**
 * Creates and renders a progress status card.
 * @param {ProgressOptions} options
 */
export function createProgressView(options) {
  const { container, title = 'Processing…', onCancel } = options;

  const card = document.createElement('div');
  card.className = 'card';

  card.innerHTML = `
    <div class="card__body">
      <div class="progress-status" role="status" aria-live="polite">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div class="progress-status__headline">${escapeHtml(title)}</div>
          <span class="progress-percent" style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-brand);font-variant-numeric:tabular-nums;">0%</span>
        </div>

        <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar__fill" style="width: 0%;"></div>
        </div>

        <div class="progress-status__current-file" style="min-height:1.2em;">Starting…</div>

        <div class="progress-status__detail">
          <div class="progress-status__detail-item">
            <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Progress</span>
            <div class="progress-status__detail-value progress-counts">0 / 0</div>
          </div>
          <div class="progress-status__detail-item">
            <span style="font-size:var(--font-size-xs);color:var(--color-text-tertiary);">Status</span>
            <div class="progress-status__detail-value progress-status-text" style="font-size:var(--font-size-sm);font-weight:normal;color:var(--color-text-secondary);">In progress</div>
          </div>
        </div>
      </div>
    </div>
    ${onCancel ? `
    <div class="card__footer" style="justify-content:flex-end;">
      <button type="button" class="btn btn--secondary btn--sm progress-btn-cancel">Cancel</button>
    </div>` : ''}
  `;

  if (onCancel) {
    card.querySelector('.progress-btn-cancel').addEventListener('click', onCancel);
  }

  container.appendChild(card);

  const fillEl = card.querySelector('.progress-bar__fill');
  const percentEl = card.querySelector('.progress-percent');
  const countsEl = card.querySelector('.progress-counts');
  const fileEl = card.querySelector('.progress-status__current-file');
  const statusEl = card.querySelector('.progress-status-text');

  return {
    element: card,

    update({ percent, current = 0, total = 0, message = '', currentFile = '', status = 'running' }) {
      const computedPercent = percent !== undefined
        ? Math.round(percent)
        : (total > 0 ? Math.round((current / total) * 100) : 0);

      fillEl.style.width = `${computedPercent}%`;
      card.querySelector('.progress-bar').setAttribute('aria-valuenow', String(computedPercent));
      percentEl.textContent = `${computedPercent}%`;

      if (total > 0) {
        countsEl.textContent = `${current} / ${total}`;
      } else {
        countsEl.textContent = `${current}`;
      }

      if (currentFile) {
        fileEl.textContent = currentFile;
      } else if (message) {
        fileEl.textContent = message;
      }

      if (status) {
        statusEl.textContent = status;
      }
    },

    showSuccess({ title = 'Complete!', message = 'Your PDF has been processed successfully.', actions = [] }) {
      card.innerHTML = `
        <div class="card__body">
          <div class="empty-state" style="padding:var(--space-8) var(--space-4);">
            <div style="width:48px;height:48px;border-radius:var(--radius-full);background-color:var(--color-success-bg);color:var(--color-success);display:flex;align-items:center;justify-content:center;margin-bottom:var(--space-2);">
              <i data-lucide="check" style="width:24px;height:24px;"></i>
            </div>
            <div class="empty-state__title" style="color:var(--color-text-primary);font-size:var(--font-size-lg);">${escapeHtml(title)}</div>
            <div class="empty-state__text" style="max-width:400px;">${escapeHtml(message)}</div>
            <div style="display:flex;gap:var(--space-4);margin-top:var(--space-4);flex-wrap:wrap;justify-content:center;" class="success-actions">
            </div>
          </div>
        </div>
      `;

      const actionsContainer = card.querySelector('.success-actions');
      actions.forEach(act => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn ${act.variant ? 'btn--' + act.variant : 'btn--primary'}`;
        btn.innerHTML = `${act.icon ? `<i data-lucide="${escapeHtml(act.icon)}"></i>` : ''}<span>${escapeHtml(act.label)}</span>`;
        btn.addEventListener('click', act.onClick);
        actionsContainer.appendChild(btn);
      });

      if (window.lucide) {
        window.lucide.createIcons({ node: card });
      }
    },

    showError({ title = 'Processing Failed', message = 'An error occurred while processing the PDF.', onRetry, onReset }) {
      card.innerHTML = `
        <div class="card__body">
          <div class="empty-state" style="padding:var(--space-8) var(--space-4);">
            <div style="width:48px;height:48px;border-radius:var(--radius-full);background-color:var(--color-error-bg);color:var(--color-error);display:flex;align-items:center;justify-content:center;margin-bottom:var(--space-2);">
              <i data-lucide="alert-circle" style="width:24px;height:24px;"></i>
            </div>
            <div class="empty-state__title" style="color:var(--color-error);font-size:var(--font-size-lg);">${escapeHtml(title)}</div>
            <div class="empty-state__text" style="max-width:420px;color:var(--color-text-secondary);">${escapeHtml(message)}</div>
            <div style="display:flex;gap:var(--space-4);margin-top:var(--space-4);">
              ${onRetry ? '<button type="button" class="btn btn--primary btn-retry"><i data-lucide="refresh-cw"></i><span>Try Again</span></button>' : ''}
              ${onReset ? '<button type="button" class="btn btn--secondary btn-reset"><span>Start Over</span></button>' : ''}
            </div>
          </div>
        </div>
      `;

      if (onRetry) card.querySelector('.btn-retry').addEventListener('click', onRetry);
      if (onReset) card.querySelector('.btn-reset').addEventListener('click', onReset);

      if (window.lucide) {
        window.lucide.createIcons({ node: card });
      }
    },

    destroy() {
      card.remove();
    },
  };
}
