/**
 * utils.js — Shared utility functions.
 * Pure functions only. No side effects. No DOM manipulation.
 */

'use strict';

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes
 * @returns {string}  e.g. "3.2 MB", "840 KB", "512 B"
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val % 1 === 0 ? val : val.toFixed(1)} ${units[i]}`;
}

/**
 * Format a page count.
 * @param {number|null} pages
 * @returns {string}
 */
export function formatPageCount(pages) {
  if (pages === null || pages === undefined) return '';
  return `${pages} ${pages === 1 ? 'page' : 'pages'}`;
}

/**
 * Generate a random ID string.
 * @returns {string}
 */
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce a function.
 * @param {Function} fn
 * @param {number} delay  milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Return a promise that resolves after `ms` milliseconds.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Move an item in an array from one index to another (immutable).
 * @param {Array} arr
 * @param {number} from
 * @param {number} to
 * @returns {Array}
 */
export function arrayMove(arr, from, to) {
  const a = [...arr];
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
}

/**
 * Check if a File object is a PDF (by MIME type and extension).
 * @param {File} file
 * @returns {boolean}
 */
export function isPdf(file) {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Check if a File object is an image.
 * @param {File} file
 * @returns {boolean}
 */
export function isImage(file) {
  return file.type.startsWith('image/');
}

/**
 * Format a percentage (0–100) as a string.
 * @param {number} current
 * @param {number} total
 * @returns {string}
 */
export function formatPercent(current, total) {
  if (!total) return '0%';
  return `${Math.round((current / total) * 100)}%`;
}
