import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCHEMA_SQL } from './schema';
import { slugifyGrocerFolder, titleCaseFromSlug } from './slug';
import { GROCER_NAMES_BY_FOLDER } from '$lib/types/entities';
import type { Grocer, Store } from '$lib/types/entities';

let db: Database.Database | undefined;

function dbPath(): string {
  return process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'grocery.db');
}

export function getDb(): Database.Database {
  if (!db) {
    const path = dbPath();
    mkdirSync(dirname(path), { recursive: true });
    db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(SCHEMA_SQL);
  migrateSchema(database);
  seedGrocers(database);
}

function migrateSchema(database: Database.Database): void {
  const columns = database.pragma('table_info(products)') as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'source_file')) {
    database.exec('ALTER TABLE products ADD COLUMN source_file TEXT');
  }
}

function seedGrocers(database: Database.Database): void {
  const insertGrocer = database.prepare(
    'INSERT OR IGNORE INTO grocers (slug, name) VALUES (@slug, @name)'
  );

  for (const [folder, name] of Object.entries(GROCER_NAMES_BY_FOLDER)) {
    insertGrocer.run({ slug: slugifyGrocerFolder(folder), name });
  }
}

export function ensureGrocer(slug: string, name?: string): Grocer {
  const database = getDb();
  const displayName = name ?? titleCaseFromSlug(slug);

  database
    .prepare('INSERT OR IGNORE INTO grocers (slug, name) VALUES (?, ?)')
    .run(slug, displayName);

  const grocer = database
    .prepare('SELECT id, slug, name, created_at FROM grocers WHERE slug = ?')
    .get(slug) as Grocer | undefined;

  if (!grocer) {
    throw new Error(`Failed to resolve grocer for slug "${slug}"`);
  }

  return grocer;
}

export function ensureGrocerFromFolder(folderName: string, name?: string): Grocer {
  const slug = slugifyGrocerFolder(folderName);
  const displayName = name ?? GROCER_NAMES_BY_FOLDER[folderName] ?? titleCaseFromSlug(slug);
  return ensureGrocer(slug, displayName);
}

export function ensureStore(grocerId: number, storeCode: string): Store {
  const database = getDb();
  const normalizedCode = storeCode.trim();

  database
    .prepare('INSERT OR IGNORE INTO stores (grocer_id, store_code) VALUES (?, ?)')
    .run(grocerId, normalizedCode);

  const store = database
    .prepare('SELECT id, grocer_id, store_code FROM stores WHERE grocer_id = ? AND store_code = ?')
    .get(grocerId, normalizedCode) as Store | undefined;

  if (!store) {
    throw new Error(`Failed to resolve store "${normalizedCode}" for grocer ${grocerId}`);
  }

  return store;
}

export function listGrocers(): Grocer[] {
  return getDb()
    .prepare('SELECT id, slug, name, created_at FROM grocers ORDER BY name')
    .all() as Grocer[];
}

export function listStores(grocerId?: number): Store[] {
  if (grocerId == null) {
    return getDb()
      .prepare('SELECT id, grocer_id, store_code FROM stores ORDER BY store_code')
      .all() as Store[];
  }

  return getDb()
    .prepare('SELECT id, grocer_id, store_code FROM stores WHERE grocer_id = ? ORDER BY store_code')
    .all(grocerId) as Store[];
}

export function tableCounts(): Record<string, number> {
  const database = getDb();
  const tables = ['grocers', 'stores', 'products', 'prices', 'sales'] as const;
  const counts: Record<string, number> = {};

  for (const table of tables) {
    const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    counts[table] = row.count;
  }

  return counts;
}

function seededGrocerSlugs(): string[] {
  return Object.keys(GROCER_NAMES_BY_FOLDER).map(slugifyGrocerFolder);
}

export function clearImportData(): void {
  const database = getDb();
  const keepSlugs = seededGrocerSlugs();
  const placeholders = keepSlugs.map(() => '?').join(', ');

  database.transaction(() => {
    database.exec(`
      DELETE FROM sales;
      DELETE FROM prices;
      DELETE FROM products;
      DELETE FROM stores;
    `);
    database.prepare(`DELETE FROM grocers WHERE slug NOT IN (${placeholders})`).run(...keepSlugs);
  })();
}

export function wipeDatabase(): void {
  const database = getDb();

  database.transaction(() => {
    database.exec(`
      DELETE FROM sales;
      DELETE FROM prices;
      DELETE FROM products;
      DELETE FROM stores;
      DELETE FROM grocers;
    `);
  })();
}

export { slugifyGrocerFolder, titleCaseFromSlug, resolveGrocerFromPath } from './slug';
