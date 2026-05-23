import type { FileKind } from '$lib/types/entities';

export function detectFileKind(filename: string): FileKind {
  const lower = filename.toLowerCase();

  if (/products?/.test(lower)) return 'product';
  if (/prices?/.test(lower)) return 'price';
  if (/sales?/.test(lower)) return 'sale';

  return 'unknown';
}

export function extractStoreFromFilename(filename: string): string | null {
  const match = filename.match(/store(\d+)/i);
  return match ? `store${match[1]}` : null;
}

export function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').pop() ?? filePath;
}
