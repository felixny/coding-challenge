import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listGrocers, tableCounts, clearImportData, wipeDatabase } from '$lib/server/db';
import { getDataQualityDetails } from '$lib/server/db/quality';
import {
  importAllSampleFiles,
  importUploadedFiles,
  importVendorFolder,
  listVendorFolders,
  summarizeBatch
} from '$lib/server/etl/batch';
import { GROCER_NAMES_BY_FOLDER } from '$lib/types/entities';
import type { ImportBatchResult } from '$lib/types/import';

function vendorOptions() {
  const folders = new Set([
    ...listVendorFolders(),
    ...Object.keys(GROCER_NAMES_BY_FOLDER)
  ]);

  return [...folders].sort().map((folder) => ({
    folder,
    name: GROCER_NAMES_BY_FOLDER[folder] ?? folder
  }));
}

function importResponse(result: ImportBatchResult) {
  return {
    result,
    summary: summarizeBatch(result),
    counts: tableCounts(),
    qualityDetails: getDataQualityDetails()
  };
}

export const load: PageServerLoad = async () => {
  const counts = tableCounts();
  const hasData = counts.products + counts.prices + counts.sales > 0;

  return {
    vendors: vendorOptions(),
    grocers: listGrocers(),
    counts,
    qualityDetails: hasData ? getDataQualityDetails() : null
  };
};

export const actions: Actions = {
  upload: async ({ request }) => {
    const formData = await request.formData();
    let vendor = String(formData.get('vendor') ?? '').trim();

    if (vendor === '__new__') {
      vendor = String(formData.get('newVendor') ?? '').trim();
    }

    if (!vendor) {
      return fail(400, { error: 'Select a grocer or enter a new vendor folder name.' });
    }

    const fileEntries = formData
      .getAll('files')
      .filter(
        (entry): entry is File =>
          entry instanceof File && entry.size > 0 && entry.name.trim().length > 0
      );

    if (fileEntries.length === 0) {
      return fail(400, { error: 'Choose at least one CSV file to upload.' });
    }

    const uploads = await Promise.all(
      fileEntries.map(async (file) => ({
        filename: file.name,
        content: await file.text(),
        grocerFolder: vendor
      }))
    );

    return importResponse(importUploadedFiles(uploads));
  },

  importVendor: async ({ request }) => {
    const folder = String((await request.formData()).get('vendor') ?? '');

    if (!folder || !listVendorFolders().includes(folder)) {
      return fail(400, { error: 'Unknown vendor folder', result: null });
    }

    try {
      return importResponse(importVendorFolder(folder));
    } catch (error) {
      return fail(500, {
        error: error instanceof Error ? error.message : 'Import failed',
        result: null
      });
    }
  },

  importAll: async () => {
    try {
      return importResponse(importAllSampleFiles());
    } catch (error) {
      return fail(500, {
        error: error instanceof Error ? error.message : 'Sample import failed',
        result: null
      });
    }
  },

  clearData: async () => {
    clearImportData();
    return { counts: tableCounts(), qualityDetails: null, cleared: true };
  },

  wipeDatabase: async () => {
    wipeDatabase();
    return { counts: tableCounts(), qualityDetails: null, wiped: true };
  }
};
