import { readFileSync } from 'node:fs';
import type { FileKind } from '$lib/types/entities';
import type { ImportFileResult } from '$lib/types/import';
import { PLACEHOLDER_UPC } from '$lib/types/entities';
import { ensureGrocerFromFolder, ensureStore, getDb } from '$lib/server/db';
import { resolveGrocerFromPath } from '$lib/server/db/slug';
import { basename, detectFileKind, extractStoreFromFilename } from './detect';
import { parseCsv, rowsToRecords, cleanString, cleanUpc, parseOptionalNumber, parseSaleTimeMs, isPlaceholderUpc, normalizeDescriptionCase } from './normalize';

export function importCsvContent(
  content: string,
  filePath: string,
  grocerFolder?: string,
  touchedProducts?: Set<string>
): ImportFileResult {
  const filename = basename(filePath);
  const fileKind = detectFileKind(filename);
  const warnings: string[] = [];

  if (fileKind === 'unknown') {
    return {
      filename,
      fileKind,
      inserted: 0,
      updated: 0,
      skipped: 0,
      warnings: ['Could not determine file type from filename']
    };
  }

  const resolved = resolveGrocerFromPath(filePath);
  const folder = grocerFolder ?? resolved?.folder;
  if (!folder) {
    return {
      filename,
      fileKind,
      inserted: 0,
      updated: 0,
      skipped: 0,
      warnings: ['Could not determine grocer from path']
    };
  }

  const grocer = ensureGrocerFromFolder(folder);
  const rows = parseCsv(content);
  const records = rowsToRecords(rows);
  const fallbackStore = extractStoreFromFilename(filename);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const database = getDb();
  const run = database.transaction(() => {
    clearExistingRowsForFile(database, fileKind, grocer.id, filename);

    for (const record of records) {
      try {
        const result = importRecord(record, {
          fileKind,
          grocerId: grocer.id,
          filename,
          fallbackStore,
          touchedProducts
        });
        inserted += result.inserted;
        updated += result.updated;
        skipped += result.skipped;
        warnings.push(...result.warnings);
      } catch (error) {
        skipped++;
        warnings.push(error instanceof Error ? error.message : 'Row failed to import');
      }
    }
  });

  run();

  return {
    filename,
    fileKind,
    inserted,
    updated,
    skipped,
    warnings: [...new Set(warnings)]
  };
}

export function importCsvFile(
  filePath: string,
  grocerFolder?: string,
  touchedProducts?: Set<string>
): ImportFileResult {
  const content = readFileSync(filePath, 'utf-8');
  return importCsvContent(content, filePath, grocerFolder, touchedProducts);
}

interface RecordContext {
  fileKind: FileKind;
  grocerId: number;
  filename: string;
  fallbackStore: string | null;
  touchedProducts?: Set<string>;
}

function clearExistingRowsForFile(
  database: ReturnType<typeof getDb>,
  fileKind: FileKind,
  grocerId: number,
  filename: string
): void {
  switch (fileKind) {
    case 'price':
      database.prepare('DELETE FROM prices WHERE source_file = ?').run(filename);
      break;
    case 'sale':
      database.prepare('DELETE FROM sales WHERE source_file = ?').run(filename);
      break;
    case 'product':
      database.prepare('DELETE FROM products WHERE grocer_id = ? AND source_file = ?').run(grocerId, filename);
      break;
  }
}

function importRecord(
  record: Record<string, string>,
  ctx: RecordContext
): { inserted: number; updated: number; skipped: number; warnings: string[] } {
  switch (ctx.fileKind) {
    case 'product':
      return importProduct(record, ctx);
    case 'price':
      return importPrice(record, ctx);
    case 'sale':
      return importSale(record, ctx);
    default:
      return { inserted: 0, updated: 0, skipped: 1, warnings: [] };
  }
}

function importProduct(record: Record<string, string>, ctx: RecordContext) {
  const upc = cleanUpc(record.upc_plu);
  if (!upc) {
    return { inserted: 0, updated: 0, skipped: 1, warnings: ['Product row missing upc_plu'] };
  }

  const placeholder = isPlaceholderUpc(upc) || upc === PLACEHOLDER_UPC;
  const database = getDb();

  const existing = database
    .prepare('SELECT id FROM products WHERE grocer_id = ? AND upc_plu = ?')
    .get(ctx.grocerId, upc) as { id: number } | undefined;

  database
    .prepare(
      `INSERT INTO products (grocer_id, upc_plu, description, department, category, unit_size, pack_size, is_placeholder_upc, source_file, updated_at)
       VALUES (@grocer_id, @upc_plu, @description, @department, @category, @unit_size, @pack_size, @is_placeholder_upc, @source_file, datetime('now'))
       ON CONFLICT (grocer_id, upc_plu) DO UPDATE SET
         description = excluded.description,
         department = excluded.department,
         category = excluded.category,
         unit_size = excluded.unit_size,
         pack_size = excluded.pack_size,
         is_placeholder_upc = excluded.is_placeholder_upc,
         source_file = excluded.source_file,
         updated_at = datetime('now')`
    )
    .run({
      grocer_id: ctx.grocerId,
      upc_plu: upc,
      description: normalizeDescriptionCase(record.description),
      department: cleanString(record.department),
      category: cleanString(record.category),
      unit_size: cleanString(record.unit_size),
      pack_size: cleanString(record.pack_size),
      is_placeholder_upc: placeholder ? 1 : 0,
      source_file: ctx.filename
    });

  if (existing) {
    ctx.touchedProducts?.add(`${ctx.grocerId}:${upc}`);
    return { inserted: 0, updated: 1, skipped: 0, warnings: placeholder ? [`Placeholder UPC: ${upc}`] : [] };
  }

  ctx.touchedProducts?.add(`${ctx.grocerId}:${upc}`);
  return {
    inserted: 1,
    updated: 0,
    skipped: 0,
    warnings: placeholder ? [`Placeholder UPC: ${upc}`] : []
  };
}

function importPrice(record: Record<string, string>, ctx: RecordContext) {
  const upc = cleanUpc(record.upc_plu);
  const storeCode = cleanString(record.store) ?? ctx.fallbackStore;

  if (!upc || !storeCode) {
    return { inserted: 0, updated: 0, skipped: 1, warnings: ['Price row missing store or upc_plu'] };
  }

  const store = ensureStore(ctx.grocerId, storeCode);
  const database = getDb();

  database
    .prepare(
      `INSERT INTO prices (
        store_id, upc_plu, price, price_type, price_priority,
        price_multiple, unit_multiple, start_date, end_date, source_file
      ) VALUES (
        @store_id, @upc_plu, @price, @price_type, @price_priority,
        @price_multiple, @unit_multiple, @start_date, @end_date, @source_file
      )`
    )
    .run({
      store_id: store.id,
      upc_plu: upc,
      price: parseOptionalNumber(record.price),
      price_type: cleanString(record.price_type),
      price_priority: parseOptionalNumber(record.price_priority),
      price_multiple: parseOptionalNumber(record.price_multiple),
      unit_multiple: parseOptionalNumber(record.unit_multiple),
      start_date: cleanString(record.start_date),
      end_date: cleanString(record.end_date),
      source_file: ctx.filename
    });

  return { inserted: 1, updated: 0, skipped: 0, warnings: [] };
}

function importSale(record: Record<string, string>, ctx: RecordContext) {
  const upc = cleanUpc(record.upc_plu);
  const storeCode = cleanString(record.store) ?? ctx.fallbackStore;
  const warnings: string[] = [];

  if (!upc || !storeCode) {
    return { inserted: 0, updated: 0, skipped: 1, warnings: ['Sale row missing store or upc_plu'] };
  }

  if (isPlaceholderUpc(upc)) {
    warnings.push(`Placeholder UPC in sale: ${upc}`);
  }

  const store = ensureStore(ctx.grocerId, storeCode);
  const database = getDb();

  const productExists = database
    .prepare('SELECT 1 FROM products WHERE grocer_id = ? AND upc_plu = ?')
    .get(ctx.grocerId, upc);

  if (!productExists) {
    warnings.push(`Orphaned sale: ${upc} not in product catalog`);
  }

  database
    .prepare(
      `INSERT INTO sales (
        store_id, upc_plu, description, unit_size, sale_time_ms, sale_time_zone,
        price_type, price_priority, price_multiple, unit_multiple,
        unit_price, units_sold, total_sale, source_file
      ) VALUES (
        @store_id, @upc_plu, @description, @unit_size, @sale_time_ms, @sale_time_zone,
        @price_type, @price_priority, @price_multiple, @unit_multiple,
        @unit_price, @units_sold, @total_sale, @source_file
      )`
    )
    .run({
      store_id: store.id,
      upc_plu: upc,
      description: normalizeDescriptionCase(record.description),
      unit_size: cleanString(record.unit_size),
      sale_time_ms: parseSaleTimeMs(record.sale_time),
      sale_time_zone: cleanString(record.sale_time_zone),
      price_type: cleanString(record.price_type),
      price_priority: parseOptionalNumber(record.price_priority),
      price_multiple: parseOptionalNumber(record.price_multiple),
      unit_multiple: parseOptionalNumber(record.unit_multiple),
      unit_price: parseOptionalNumber(record.unit_price),
      units_sold: parseOptionalNumber(record.units_sold),
      total_sale: parseOptionalNumber(record.total_sale),
      source_file: ctx.filename
    });

  return { inserted: 1, updated: 0, skipped: 0, warnings };
}
