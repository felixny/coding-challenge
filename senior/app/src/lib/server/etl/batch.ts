import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ImportBatchResult } from '$lib/types/import';
import { importCsvContent, importCsvFile } from './import';

export function sampleDataRoot(): string {
  return join(process.cwd(), '../grocers-files');
}

export function listVendorFolders(root = sampleDataRoot()): string[] {
  return readdirSync(root)
    .filter((name) => statSync(join(root, name)).isDirectory())
    .sort();
}

export function listCsvFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.csv'))
    .sort();
}

export function importVendorFolder(
  vendorFolder: string,
  root = sampleDataRoot(),
  touchedProducts?: Set<string>
): ImportBatchResult {
  const dir = join(root, vendorFolder);
  const productKeys = touchedProducts ?? new Set<string>();
  const countBefore = productKeys.size;
  const result: ImportBatchResult = {
    success: true,
    files: [],
    errors: [],
    uniqueProducts: 0
  };

  for (const filename of listCsvFiles(dir)) {
    try {
      result.files.push(importCsvFile(join(dir, filename), vendorFolder, productKeys));
    } catch (error) {
      result.success = false;
      result.errors.push(
        error instanceof Error ? `${filename}: ${error.message}` : `${filename}: import failed`
      );
    }
  }

  result.uniqueProducts = productKeys.size - countBefore;
  return result;
}

export function importAllSampleFiles(root = sampleDataRoot()): ImportBatchResult {
  const touchedProducts = new Set<string>();
  const result: ImportBatchResult = {
    success: true,
    files: [],
    errors: [],
    uniqueProducts: 0
  };

  for (const vendorFolder of listVendorFolders(root)) {
    const vendorResult = importVendorFolder(vendorFolder, root, touchedProducts);
    result.files.push(...vendorResult.files);
    result.errors.push(...vendorResult.errors);
    if (!vendorResult.success) result.success = false;
  }

  result.uniqueProducts = touchedProducts.size;
  return result;
}

export function importUploadedFiles(
  uploads: Array<{ filename: string; content: string; grocerFolder: string }>
): ImportBatchResult {
  const touchedProducts = new Set<string>();
  const result: ImportBatchResult = {
    success: true,
    files: [],
    errors: [],
    uniqueProducts: 0
  };

  for (const upload of uploads) {
    const filename = upload.filename.trim();
    if (!filename || !filename.toLowerCase().endsWith('.csv')) {
      result.errors.push(`${filename || 'Unnamed file'}: not a CSV file`);
      result.success = false;
      continue;
    }

    try {
      result.files.push(
        importCsvContent(upload.content, upload.filename, upload.grocerFolder, touchedProducts)
      );
    } catch (error) {
      result.success = false;
      result.errors.push(
        error instanceof Error ? `${upload.filename}: ${error.message}` : `${upload.filename}: import failed`
      );
    }
  }

  result.uniqueProducts = touchedProducts.size;
  return result;
}

export function summarizeBatch(result: ImportBatchResult) {
  const warnings = [
    ...new Set(
      result.files.flatMap((file) => file.warnings.map((warning) => `${file.filename}: ${warning}`))
    )
  ];
  const inserted = result.files.reduce(
    (totals, file) => ({
      products: totals.products + (file.fileKind === 'product' ? file.inserted : 0),
      prices: totals.prices + (file.fileKind === 'price' ? file.inserted : 0),
      sales: totals.sales + (file.fileKind === 'sale' ? file.inserted : 0),
      skipped: totals.skipped + file.skipped
    }),
    { products: 0, prices: 0, sales: 0, skipped: 0 }
  );
  const updated = result.files.reduce(
    (totals, file) => ({
      products: totals.products + (file.fileKind === 'product' ? file.updated : 0),
      prices: totals.prices + (file.fileKind === 'price' ? file.updated : 0),
      sales: totals.sales + (file.fileKind === 'sale' ? file.updated : 0)
    }),
    { products: 0, prices: 0, sales: 0 }
  );

  return {
    fileCount: result.files.length,
    warningCount: warnings.length,
    warnings: warnings.slice(0, 12),
    inserted,
    updated,
    uniqueProducts: result.uniqueProducts
  };
}
