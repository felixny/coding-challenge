import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { importAllSampleFiles, importUploadedFiles, summarizeBatch } from '../src/lib/server/etl/batch.ts';
import { getDb, tableCounts } from '../src/lib/server/db/index.ts';
import { getDataQualitySummary } from '../src/lib/server/db/quality.ts';
import { queryPriceComparison } from '../src/lib/server/db/queries.ts';
import { detectFileKind, extractStoreFromFilename } from '../src/lib/server/etl/detect.ts';
import { normalizeDescriptionCase, parseOptionalNumber, parseSaleTimeMs } from '../src/lib/server/etl/normalize.ts';

const dbPath = join(process.cwd(), 'data', 'smoke-test.db');
process.env.DATABASE_PATH = dbPath;

for (const suffix of ['', '-wal', '-shm']) {
  const path = `${dbPath}${suffix}`;
  if (existsSync(path)) unlinkSync(path);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

function section(title: string, run: () => void) {
  console.log(`Smoke test: ${title}`);
  run();
}

section('filename heuristics', () => {
  assertEqual(detectFileKind('products.csv'), 'product', 'products.csv kind');
  assertEqual(detectFileKind('Products.csv'), 'product', 'Products.csv kind');
  assertEqual(detectFileKind('product-file.csv'), 'product', 'product-file.csv kind');
  assertEqual(detectFileKind('Prices-store1.csv'), 'price', 'Prices-store1.csv kind');
  assertEqual(detectFileKind('price-1767955200000.csv'), 'price', 'price timestamp kind');
  assertEqual(detectFileKind('sale-transactions.csv'), 'sale', 'sale-transactions.csv kind');
  assertEqual(detectFileKind('inventory.csv'), 'unknown', 'inventory.csv kind');
  assertEqual(extractStoreFromFilename('Sales-store2.csv'), 'store2', 'store2 from filename');
  assertEqual(extractStoreFromFilename('SALES_Store-A.csv'), null, 'Store-A not parsed as store');
});

section('normalize helpers', () => {
  assertEqual(normalizeDescriptionCase('ORGANIC BANANAS'), 'Organic Bananas', 'title case');
  assertEqual(parseOptionalNumber('$4.99'), 4.99, 'dollar price');
  assertEqual(parseSaleTimeMs('1767958800'), 1767958800000, 'unix seconds');
  assertEqual(parseSaleTimeMs('2026-01-09T16:45:00Z'), Date.parse('2026-01-09T16:45:00Z'), 'iso timestamp');
  assertEqual(parseSaleTimeMs('not-a-date'), null, 'invalid timestamp');
});

section('sample import (all vendors)', () => {
  const result = importAllSampleFiles();
  const summary = summarizeBatch(result);

  assertEqual(result.errors.length, 0, 'import errors');
  assertEqual(summary.fileCount, 45, 'file count');
  assertEqual(summary.inserted.products, 243, 'products inserted');
  assertEqual(summary.inserted.prices, 808, 'prices inserted');
  assertEqual(summary.inserted.sales, 544, 'sales inserted');

  const counts = tableCounts();
  assertEqual(counts.grocers, 3, 'grocers');
  assertEqual(counts.stores, 11, 'stores');
  assertEqual(counts.products, 243, 'products in db');
  assertEqual(counts.prices, 808, 'prices in db');
  assertEqual(counts.sales, 544, 'sales in db');

  const quality = getDataQualitySummary();
  assert(quality.orphaned_sales > 0, 'expected orphaned sales in sample data');
  assert(quality.products_without_price > 0, 'expected products without price in sample data');

  const colins = getDb()
    .prepare('SELECT id FROM grocers WHERE slug = ?')
    .get('colins-market') as { id: number };
  const comparison = queryPriceComparison({
    grocerId: colins.id,
    storeId: null,
    tab: 'compare',
    search: ''
  });
  assert(comparison.storeCodes.length >= 2, 'colins has multiple stores');
  assert(comparison.rows.length > 0, 'expected cross-store price comparisons for colins');
  assert(
    comparison.rows.some((row) => row.spread != null && row.spread > 0),
    'expected at least one price spread across stores'
  );

  importAllSampleFiles();
  const countsAfterReimport = tableCounts();
  assertEqual(countsAfterReimport.products, counts.products, 'products unchanged on re-import');
  assertEqual(countsAfterReimport.prices, counts.prices, 'prices unchanged on re-import');
  assertEqual(countsAfterReimport.sales, counts.sales, 'sales unchanged on re-import');
});

section('missing store rows skipped', () => {
  const edgeResult = importUploadedFiles([
    {
      filename: 'product-file.csv',
      content: 'upc_plu,description\n555000111222,Test Crackers\n',
      grocerFolder: 'smoke-missing-store'
    },
    {
      filename: 'prices.csv',
      content: 'upc_plu,price\n555000111222,4.29\n',
      grocerFolder: 'smoke-missing-store'
    },
    {
      filename: 'sales.csv',
      content: 'upc_plu,units_sold,total_sale\n555000111222,1,4.29\n',
      grocerFolder: 'smoke-missing-store'
    }
  ]);

  const edgeSummary = summarizeBatch(edgeResult);
  assertEqual(edgeSummary.inserted.products, 1, 'missing-store products inserted');
  assertEqual(edgeSummary.inserted.prices, 0, 'missing-store prices inserted');
  assertEqual(edgeSummary.inserted.sales, 0, 'missing-store sales inserted');
  assertEqual(edgeSummary.inserted.skipped, 2, 'missing-store rows skipped');
  assert(
    edgeSummary.warnings.some((w) => w.includes('prices.csv') && w.includes('missing store')),
    'price skip warning includes filename'
  );
});

section('column aliases, separator row, and title case', () => {
  const result = importUploadedFiles([
    {
      filename: 'product-file.csv',
      content: [
        'PLU,description,Category,unitSize,Pack',
        '-------,-----------,--------,--------,----',
        '12345, FUJI APPLES ,produce,1LB,loose'
      ].join('\n'),
      grocerFolder: 'smoke-aliases'
    },
    {
      filename: 'Prices-store1.csv',
      content: 'Store,PLU,Price\nstore1,12345,$2.49\n',
      grocerFolder: 'smoke-aliases'
    }
  ]);

  const summary = summarizeBatch(result);
  assertEqual(summary.inserted.products, 1, 'alias product inserted');
  assertEqual(summary.inserted.prices, 1, 'alias price inserted');

  const product = getDb()
    .prepare(
      `SELECT p.description, pr.price
       FROM products p
       JOIN grocers g ON g.id = p.grocer_id
       LEFT JOIN prices pr ON pr.upc_plu = p.upc_plu
       LEFT JOIN stores st ON st.id = pr.store_id AND st.grocer_id = g.id
       WHERE g.slug = 'smoke-aliases' AND p.upc_plu = '12345'`
    )
    .get() as { description: string; price: number } | undefined;

  assert(product, 'alias product row exists');
  assertEqual(product?.description, 'Fuji Apples', 'description title cased');
  assertEqual(product?.price, 2.49, 'dollar price stored');
});

section('store from filename and mixed sale timestamps', () => {
  const result = importUploadedFiles([
    {
      filename: 'product-file.csv',
      content: 'upc_plu,description\n67890,Sourdough Bread\n',
      grocerFolder: 'smoke-sales'
    },
    {
      filename: 'sales-store1.csv',
      content: [
        'upc_plu,description,Sales_Total,sale_time,units_sold',
        '67890,SOURDOUGH BREAD,4.29,1767958800,1',
        '67890,SOURDOUGH BREAD,1.87,2026-01-09T16:45:00Z,0.75',
        ',missing upc sale,1.00,,1'
      ].join('\n'),
      grocerFolder: 'smoke-sales'
    }
  ]);

  const summary = summarizeBatch(result);
  assertEqual(summary.inserted.products, 1, 'sales vendor product inserted');
  assertEqual(summary.inserted.sales, 2, 'valid sales inserted');
  assertEqual(summary.inserted.skipped, 1, 'blank upc sale skipped');
  assert(
    summary.warnings.some((w) => w.includes('sales-store1.csv') && w.includes('missing store or upc_plu')),
    'missing upc sale warning includes filename'
  );

  const sales = getDb()
    .prepare(
      `SELECT s.sale_time_ms, s.total_sale, st.store_code, s.description
       FROM sales s
       JOIN stores st ON st.id = s.store_id
       JOIN grocers g ON g.id = st.grocer_id
       WHERE g.slug = 'smoke-sales'
       ORDER BY s.sale_time_ms`
    )
    .all() as Array<{
      sale_time_ms: number;
      total_sale: number;
      store_code: string;
      description: string;
    }>;

  assertEqual(sales.length, 2, 'two sales in db');
  assertEqual(sales[0].store_code, 'store1', 'store inferred from filename');
  assertEqual(sales[0].sale_time_ms, 1767958800000, 'unix seconds stored as ms');
  assertEqual(sales[1].sale_time_ms, Date.parse('2026-01-09T16:45:00Z'), 'iso sale time stored');
  assertEqual(sales[0].description, 'Sourdough Bread', 'sale description title cased');
});

section('orphaned sale and placeholder upc warnings', () => {
  const result = importUploadedFiles([
    {
      filename: 'products.csv',
      content: 'upc_plu,description\n11111,Known Item\n999999999999,Misc Item\n',
      grocerFolder: 'smoke-quality'
    },
    {
      filename: 'prices.csv',
      content: 'store,upc_plu,price\nqa1,11111,1.99\n',
      grocerFolder: 'smoke-quality'
    },
    {
      filename: 'sales.csv',
      content: 'store,upc_plu,total_sale,units_sold\nqa1,88888,3.00,1\n',
      grocerFolder: 'smoke-quality'
    }
  ]);

  const summary = summarizeBatch(result);
  assertEqual(summary.inserted.sales, 1, 'orphan sale still inserted');
  assert(
    summary.warnings.some((w) => w.includes('88888') && w.includes('Orphaned sale')),
    'orphaned sale warning'
  );
  assert(
    summary.warnings.some((w) => w.includes('Placeholder UPC: 999999999999')),
    'placeholder product warning'
  );

  const quality = getDb()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM sales s
       JOIN stores st ON st.id = s.store_id
       JOIN grocers g ON g.id = st.grocer_id
       LEFT JOIN products p ON p.grocer_id = g.id AND p.upc_plu = s.upc_plu
       WHERE g.slug = 'smoke-quality' AND p.id IS NULL`
    )
    .get() as { count: number };

  assertEqual(quality.count, 1, 'one orphaned sale for smoke-quality grocer');
});

section('unknown file type', () => {
  const result = importUploadedFiles([
    {
      filename: '20260301-inventory-counts.csv',
      content: 'sku,qty\nabc,10\n',
      grocerFolder: 'smoke-unknown'
    }
  ]);

  assertEqual(result.files.length, 1, 'one file processed');
  assertEqual(result.files[0]?.fileKind, 'unknown', 'inventory file kind');
  assertEqual(result.files[0]?.inserted, 0, 'inventory file inserted nothing');
  assert(
    result.files[0]?.warnings.includes('Could not determine file type from filename'),
    'unknown file warning'
  );
});

console.log('PASS: all smoke checks passed');
