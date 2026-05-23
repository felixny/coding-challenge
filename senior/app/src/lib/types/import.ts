export type FileKind = 'product' | 'price' | 'sale' | 'unknown';

export interface ImportFileResult {
  filename: string;
  fileKind: FileKind;
  inserted: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

export interface ImportBatchResult {
  success: boolean;
  files: ImportFileResult[];
  errors: string[];
  uniqueProducts: number;
}
