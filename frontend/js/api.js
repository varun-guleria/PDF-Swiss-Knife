/**
 * api.js — Backend communication layer.
 *
 * All requests to the Python backend go through this module.
 * Handles base URL, error normalisation, file uploads, and job polling.
 *
 * Usage:
 *   import * as api from './api.js';
 *   const result = await api.health();
 *   const { job_id } = await api.mergePdfs(files, order);
 */

'use strict';

// ─── Configuration ─────────────────────────────────────────────────────────

/** Base URL of the Python backend. Adjust port if changed in config.py */
const BASE_URL = 'http://127.0.0.1:5000';

/** Polling interval in milliseconds */
const POLL_INTERVAL = 500;

/** Maximum poll duration before we give up (milliseconds) */
const MAX_POLL_DURATION = 30 * 60 * 1000; // 30 minutes

// ─── Core fetch wrapper ────────────────────────────────────────────────────

/**
 * Perform a fetch request and return parsed JSON.
 * Throws a normalised Error on non-2xx responses or network failure.
 *
 * @param {string} path  — URL path relative to BASE_URL
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    const err = new Error('Cannot connect to the PDF Swiss-Knife backend. Is it running?');
    err.code = 'NETWORK_ERROR';
    throw err;
  }

  if (!response.ok) {
    let body;
    try { body = await response.json(); } catch { body = {}; }
    const err = new Error(body.error || `Request failed (${response.status})`);
    err.status = response.status;
    err.code = 'HTTP_ERROR';
    throw err;
  }

  // Some responses (e.g. file downloads) are not JSON
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response; // caller handles binary responses
}

/**
 * POST a multipart/form-data request with files.
 *
 * @param {string} path
 * @param {FormData} formData
 * @returns {Promise<any>}
 */
async function upload(path, formData) {
  return request(path, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type — browser sets it with correct boundary
  });
}

/**
 * POST a JSON body.
 *
 * @param {string} path
 * @param {object} body
 * @returns {Promise<any>}
 */
async function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Health ────────────────────────────────────────────────────────────────

/**
 * Check if the backend is running.
 * @returns {Promise<{ status: string, service: string }>}
 */
export async function health() {
  return request('/api/health');
}

// ─── Job polling ───────────────────────────────────────────────────────────

/**
 * Get the current status of a job.
 * @param {string} jobId
 */
export async function getJobStatus(jobId) {
  return request(`/api/jobs/${jobId}/status`);
}

/**
 * Poll a job until it reaches 'done' or 'error'.
 *
 * @param {string} jobId
 * @param {(status: object) => void} onProgress  — called on each poll
 * @returns {Promise<object>}  — final job status object
 * @throws {Error}  if job fails or poll times out
 */
export async function pollJob(jobId, onProgress) {
  const deadline = Date.now() + MAX_POLL_DURATION;
  while (Date.now() < deadline) {
    const status = await getJobStatus(jobId);
    if (onProgress) onProgress(status);
    if (status.status === 'done') return status;
    if (status.status === 'error') {
      const err = new Error(status.message || 'Job failed');
      err.jobStatus = status;
      throw err;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error('Job timed out — processing took too long');
}

/**
 * Delete a job and its output files from the backend.
 */
export async function deleteJob(jobId) {
  return request(`/api/jobs/${jobId}`, { method: 'DELETE' });
}

// ─── Output / Downloads ────────────────────────────────────────────────────

/**
 * List output files for a completed job.
 * @param {string} jobId
 * @returns {Promise<{ files: Array<{name, size}> }>}
 */
export async function listOutputs(jobId) {
  return request(`/api/output/${jobId}/list`);
}

/**
 * Trigger browser download of a single output file.
 * @param {string} jobId
 * @param {string} filename
 */
export function downloadFile(jobId, filename) {
  const url = `${BASE_URL}/api/output/${jobId}/download/${encodeURIComponent(filename)}`;
  triggerDownload(url, filename);
}

/**
 * Trigger browser download of a ZIP of all output files.
 * @param {string} jobId
 */
export function downloadZip(jobId) {
  const url = `${BASE_URL}/api/output/${jobId}/zip`;
  triggerDownload(url);
}

/**
 * Trigger a browser file download by navigating to a URL.
 * @param {string} url
 * @param {string} [filename]
 */
function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── PDF Operations ────────────────────────────────────────────────────────
// These will be populated in later milestones as operations are implemented.
// Stub signatures are documented here for reference.

/**
 * Upload files for a merge operation and start the job.
 * @param {File[]} files  — in merge order
 * @param {string} [outputName='merged.pdf'] — custom output filename
 * @returns {Promise<{ job_id: string, output_name: string }>}
 */
export async function mergePdfs(files, outputName = 'merged.pdf') {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  if (outputName) {
    fd.append('output_name', outputName);
  }
  return upload('/api/merge/run', fd);
}

/**
 * Inspect a PDF document and receive page count, metadata, and doc_id for thumbnails.
 * @param {File} file
 * @returns {Promise<{ doc_id: string, filename: string, page_count: number, pages: Array }>}
 */
export async function inspectPdf(file) {
  const fd = new FormData();
  fd.append('file', file);
  return upload('/api/pages/inspect', fd);
}

/**
 * Return direct URL for a page thumbnail image.
 * @param {string} docId
 * @param {number} pageIndex
 * @returns {string}
 */
export function getPageThumbnailUrl(docId, pageIndex) {
  return `${BASE_URL}/api/pages/${docId}/thumbnail/${pageIndex}`;
}

/**
 * Reorganize pages of an inspected document.
 * @param {string} docId
 * @param {Array<{ index: number, rotation: number }>} pageSpecs
 * @param {string} [outputName='organized_document.pdf']
 * @returns {Promise<{ job_id: string, output_name: string }>}
 */
export async function reorganizePdf(docId, pageSpecs, outputName = 'organized_document.pdf') {
  return post('/api/pages/reorganize', {
    doc_id: docId,
    page_specs: pageSpecs,
    output_name: outputName,
  });
}

/**
 * Start a batch PDF build job.
 * @param {File[]} repeatingFiles  — PDFs merged into every output (in order)
 * @param {File[]} uniqueFiles     — one output PDF per unique file
 * @returns {Promise<{ job_id: string, repeating_count: number, unique_count: number, output_count: number }>}
 */
export async function startBatch(repeatingFiles, uniqueFiles) {
  const fd = new FormData();
  repeatingFiles.forEach(f => fd.append('repeating_files', f));
  uniqueFiles.forEach(f => fd.append('unique_files', f));
  return upload('/api/batch/start', fd);
}

// ─── Split ──────────────────────────────────────────────────────────────────

/**
 * Split a PDF.
 * @param {File} file
 * @param {string} mode - 'ranges' | 'every_n' | 'singles'
 * @param {object} [options] - { ranges: string, n: number }
 */
export async function splitPdf(file, mode = 'singles', options = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('mode', mode);
  if (mode === 'ranges' && options.ranges) fd.append('ranges', options.ranges);
  if (mode === 'every_n' && options.n) fd.append('n', String(options.n));
  return upload('/api/split/run', fd);
}

// ─── Convert ────────────────────────────────────────────────────────────────

/** PDF → Images */
export async function pdfToImages(file, format = 'png', dpi = 150) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('format', format);
  fd.append('dpi', String(dpi));
  return upload('/api/convert/to-images', fd);
}

/** Images → PDF */
export async function imagesToPdf(files, outputName = 'images_combined.pdf') {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  fd.append('output_name', outputName);
  return upload('/api/convert/to-pdf', fd);
}

// ─── Optimize ───────────────────────────────────────────────────────────────

/** Compress PDF */
export async function compressPdf(file, quality = 60) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('quality', String(quality));
  return upload('/api/optimize/compress', fd);
}

/** Repair PDF */
export async function repairPdf(file) {
  const fd = new FormData();
  fd.append('file', file);
  return upload('/api/optimize/repair', fd);
}

/** Get PDF info (synchronous) */
export async function getPdfInfo(file) {
  const fd = new FormData();
  fd.append('file', file);
  return upload('/api/optimize/info', fd);
}

// ─── Security ───────────────────────────────────────────────────────────────

/** Protect PDF */
export async function protectPdf(file, userPassword, ownerPassword = '', options = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('user_password', userPassword);
  if (ownerPassword) fd.append('owner_password', ownerPassword);
  fd.append('allow_printing', String(options.allowPrinting !== false));
  fd.append('allow_copying', String(options.allowCopying === true));
  return upload('/api/security/protect', fd);
}

/** Unprotect PDF */
export async function unprotectPdf(file, password = '') {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('password', password);
  return upload('/api/security/unprotect', fd);
}

// ─── Edit ───────────────────────────────────────────────────────────────────

/** Add watermark */
export async function addWatermark(file, options = {}) {
  const fd = new FormData();
  fd.append('file', file);
  if (options.text) fd.append('text', options.text);
  if (options.opacity !== undefined) fd.append('opacity', String(options.opacity));
  if (options.fontSize) fd.append('font_size', String(options.fontSize));
  if (options.color) fd.append('color', options.color);
  if (options.rotation !== undefined) fd.append('rotation', String(options.rotation));
  return upload('/api/edit/watermark', fd);
}

/** Add page numbers */
export async function addPageNumbers(file, options = {}) {
  const fd = new FormData();
  fd.append('file', file);
  if (options.position) fd.append('position', options.position);
  if (options.startNumber !== undefined) fd.append('start_number', String(options.startNumber));
  if (options.fontSize) fd.append('font_size', String(options.fontSize));
  if (options.format) fd.append('format', options.format);
  return upload('/api/edit/page-numbers', fd);
}

/** Add header/footer */
export async function addHeaderFooter(file, options = {}) {
  const fd = new FormData();
  fd.append('file', file);
  if (options.headerLeft) fd.append('header_left', options.headerLeft);
  if (options.headerCenter) fd.append('header_center', options.headerCenter);
  if (options.headerRight) fd.append('header_right', options.headerRight);
  if (options.footerLeft) fd.append('footer_left', options.footerLeft);
  if (options.footerCenter) fd.append('footer_center', options.footerCenter);
  if (options.footerRight) fd.append('footer_right', options.footerRight);
  if (options.fontSize) fd.append('font_size', String(options.fontSize));
  return upload('/api/edit/header-footer', fd);
}

/** Crop margins from PDF */
export async function cropPdf(file, options = {}) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('top', String(options.top || 0));
  fd.append('bottom', String(options.bottom || 0));
  fd.append('left', String(options.left || 0));
  fd.append('right', String(options.right || 0));
  fd.append('unit', options.unit || 'pt');
  return upload('/api/edit/crop', fd);
}

