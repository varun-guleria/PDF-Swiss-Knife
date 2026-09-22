/**
 * components/dialog.js — Reusable modal dialog and confirmation system.
 *
 * Implements keyboard accessibility (Escape to dismiss, focus management)
 * and promise-based confirmation dialogs.
 */

'use strict';

import { escapeHtml } from '../utils.js';

/**
 * @typedef {Object} DialogOptions
 * @property {string} title
 * @property {string|HTMLElement} body
 * @property {string} [confirmText='OK']
 * @property {string} [cancelText='Cancel']
 * @property {'primary'|'danger'|'secondary'} [confirmVariant='primary']
 * @property {boolean} [showCancel=true]
 * @property {() => void} [onConfirm]
 * @property {() => void} [onCancel]
 */

/**
 * Displays a modal dialog.
 * @param {DialogOptions} options
 * @returns {{ close: () => void }}
 */
export function showDialog(options) {
  const {
    title,
    body,
    confirmText = 'OK',
    cancelText = 'Cancel',
    confirmVariant = 'primary',
    showCancel = true,
    onConfirm,
    onCancel,
  } = options;

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);

  const dialog = document.createElement('div');
  dialog.className = 'dialog';

  dialog.innerHTML = `
    <div class="dialog__header">
      <h2 class="dialog__title">${escapeHtml(title)}</h2>
    </div>
    <div class="dialog__body"></div>
    <div class="dialog__footer">
      ${showCancel ? `<button type="button" class="btn btn--secondary dialog-btn-cancel">${escapeHtml(cancelText)}</button>` : ''}
      <button type="button" class="btn btn--${confirmVariant} dialog-btn-confirm">${escapeHtml(confirmText)}</button>
    </div>
  `;

  const bodyEl = dialog.querySelector('.dialog__body');
  if (typeof body === 'string') {
    bodyEl.innerHTML = escapeHtml(body);
  } else if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  }

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const confirmBtn = dialog.querySelector('.dialog-btn-confirm');
  const cancelBtn = dialog.querySelector('.dialog-btn-cancel');

  function close() {
    window.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      if (typeof onCancel === 'function') onCancel();
    }
  }

  window.addEventListener('keydown', onKeyDown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
      if (typeof onCancel === 'function') onCancel();
    }
  });

  confirmBtn.addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      close();
      if (typeof onCancel === 'function') onCancel();
    });
  }

  // Auto-focus the confirm button or first input
  const input = dialog.querySelector('input, select, textarea');
  if (input) {
    input.focus();
  } else {
    confirmBtn.focus();
  }

  return { close };
}

/**
 * Convenience helper for a confirm prompt returning a Promise<boolean>.
 * @param {string} title
 * @param {string} message
 * @param {'primary'|'danger'} [variant='primary']
 * @returns {Promise<boolean>}
 */
export function confirmDialog(title, message, variant = 'primary') {
  return new Promise((resolve) => {
    showDialog({
      title,
      body: message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      confirmVariant: variant,
      showCancel: true,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

/**
 * Convenience helper for an alert dialog returning a Promise<void>.
 * @param {string} title
 * @param {string} message
 * @returns {Promise<void>}
 */
export function alertDialog(title, message) {
  return new Promise((resolve) => {
    showDialog({
      title,
      body: message,
      confirmText: 'OK',
      showCancel: false,
      onConfirm: () => resolve(),
      onCancel: () => resolve(),
    });
  });
}
