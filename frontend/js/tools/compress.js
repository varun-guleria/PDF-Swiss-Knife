/**
 * tools/compress.js — Compress PDF Tool.
 */
'use strict';
import * as api from '../api.js';
import { createSingleFileTool } from '../components/singleFileTool.js';

export function renderCompress(container) {
  createSingleFileTool({
    container,
    title: 'Compress PDF',
    subtitle: 'Reduce the file size of a PDF by removing unused objects and optimizing content.',
    icon: 'archive',
    submitLabel: 'Compress PDF',
    submitIcon: 'minimize-2',
    progressTitle: 'Compressing PDF…',
    illustration: '/assets/compress-illustration.jpg',
    onSubmit: async (file) => {
      return api.compressPdf(file);
    },
  });
}
