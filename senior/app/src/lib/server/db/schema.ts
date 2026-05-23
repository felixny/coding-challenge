export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS grocers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grocer_id INTEGER NOT NULL REFERENCES grocers(id),
  store_code TEXT NOT NULL,
  UNIQUE (grocer_id, store_code)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grocer_id INTEGER NOT NULL REFERENCES grocers(id),
  upc_plu TEXT NOT NULL,
  description TEXT,
  department TEXT,
  category TEXT,
  unit_size TEXT,
  pack_size TEXT,
  is_placeholder_upc INTEGER NOT NULL DEFAULT 0,
  source_file TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (grocer_id, upc_plu)
);

CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  upc_plu TEXT NOT NULL,
  price REAL,
  price_type TEXT,
  price_priority REAL,
  price_multiple REAL,
  unit_multiple REAL,
  start_date TEXT,
  end_date TEXT,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  upc_plu TEXT NOT NULL,
  description TEXT,
  unit_size TEXT,
  sale_time_ms INTEGER,
  sale_time_zone TEXT,
  price_type TEXT,
  price_priority REAL,
  price_multiple REAL,
  unit_multiple REAL,
  unit_price REAL,
  units_sold REAL,
  total_sale REAL,
  source_file TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stores_grocer ON stores(grocer_id);
CREATE INDEX IF NOT EXISTS idx_products_grocer_upc ON products(grocer_id, upc_plu);
CREATE INDEX IF NOT EXISTS idx_prices_store_upc ON prices(store_id, upc_plu);
CREATE INDEX IF NOT EXISTS idx_sales_store_upc ON sales(store_id, upc_plu);
CREATE INDEX IF NOT EXISTS idx_sales_time ON sales(sale_time_ms);
`;
