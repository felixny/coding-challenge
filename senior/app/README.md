# Grocery Data App

SvelteKit app that imports grocery vendor CSVs into SQLite and lets you browse the results.

Requires Node 18+.

## Run it

From `senior/app`:

```bash
npm install
npm run dev
```

Open http://localhost:5173

Sample CSV files are in `../grocers-files/` (Colin's Market, J&A Grocers, Stevens Produce).

## First time setup

1. Start the dev server (above).
2. Go to **Import**.
3. Click **Import all sample files**.

You should see counts go up for products, prices, and sales. Grocers will show 3 even before import (those are seeded from the three sample vendors).

4. Go to **View**, pick a grocer, then browse Products, Prices, or Sales. Store is optional and narrows results further.

## Upload your own files

On **Import**, use the upload form at the top:

1. Pick a grocer from the dropdown, or choose **New vendor…** and type a folder style name (example: `fresh-foods-co`).
2. Add one or more `.csv` files.
3. Click **Upload and import**.

The importer uses the file name to classify the CSV as product, price, or sale data. Matching is case-insensitive and supports common singular/plural variants like `product`, `products`, `price`, `prices`, `sale`, and `sales`. Examples: `20260105-products.csv`, `Prices-store1.csv`, `20260120-sale.csv`.

For price and sale files, each row needs a store code in a `store` column, or the store can be parsed from the file name, for example `Prices-store1.csv` or `Sales-store1.csv`.

## CLI import (optional)

```bash
npm run import:all
npm run import:ja
```

These read from `../grocers-files/` the same way the sample import buttons do.

## Clear data

**Clear imported data** removes all stores, products, prices, and sales. It also removes any grocers you created through upload, but keeps the three seeded vendors (Colin's, J&A, Stevens) so you can re-import sample files quickly.

**Reset everything** removes all rows from every table, including the seeded grocers. Table counts go to zero. Use this for a completely blank slate without deleting the database file.

To wipe the database file itself (same end state after restart, with seeded grocers restored on first use):

```bash
rm -f data/grocery.db data/grocery.db-wal data/grocery.db-shm
```

Restart the app and you get a fresh database with the three sample grocers seeded again.

## Routes

`/import` upload and import CSVs, see counts and data quality warnings

`/view` browse products, prices, cross-store price comparison, and aggregated sales (select a grocer first)

## Database

SQLite file at `data/grocery.db`, created on first use. Set `DATABASE_PATH` to put it somewhere else.

Tables: `grocers`, `stores`, `products`, `prices`, `sales`.

Products are scoped per grocer and UPC. Prices and sales are tied to stores. Sales rows can exist even when the UPC is not in the product catalog; those show up in the data quality panel as orphaned sales.

Re-importing the same CSV replaces that file's previous rows (prices, sales, and products tied to that file). Product rows still upsert by grocer and UPC. Different files for the same vendor still accumulate normally. Use **Clear imported data** on the Import page to reset counts.

## Check types

```bash
npm run check
```

## Smoke test

Uses a temporary database at `data/smoke-test.db` (does not touch your dev `grocery.db`):

```bash
npm run smoke
```

Run this before submitting or after changing importer logic.

Checks full sample import counts plus ETL edge cases: filename detection, column aliases, title case, dollar prices, unix/ISO sale times, store from filename, skipped bad rows, orphaned sales, placeholder UPCs, and unknown file types.
