import { getDb } from './index';
import type {
  DailySalesTrend,
  PriceComparisonRow,
  SalesAggregate,
  StoreSalesSummary
} from '$lib/types/entities';

export interface ViewFilters {
  grocerId: number | null;
  storeId: number | null;
  tab: 'products' | 'prices' | 'compare' | 'sales';
  search: string;
}

interface RawStorePrice {
  upc_plu: string;
  store_code: string;
  price: number | null;
  price_type: string | null;
  price_priority: number | null;
}

export interface ProductRow {
  upc_plu: string;
  description: string | null;
  department: string | null;
  category: string | null;
  unit_size: string | null;
  pack_size: string | null;
}

export interface PriceRow {
  store_code: string;
  upc_plu: string;
  price: number | null;
  price_type: string | null;
  price_priority: number | null;
  start_date: string | null;
  end_date: string | null;
}

function storeClause(alias: string): string {
  return `(:storeId IS NULL OR ${alias}.id = :storeId)`;
}

function normalizeSearch(value: string | null): string {
  return value?.trim() ?? '';
}

function searchLikeTerm(search: string): string {
  const escaped = search.replace(/[%_\\]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

function searchParams(search: string) {
  return {
    search,
    searchLike: searchLikeTerm(search)
  };
}

function productSearchClause(): string {
  return `(@search = '' OR
    LOWER(p.upc_plu) LIKE LOWER(@searchLike) ESCAPE '\\' OR
    LOWER(COALESCE(p.description, '')) LIKE LOWER(@searchLike) ESCAPE '\\' OR
    LOWER(COALESCE(p.department, '')) LIKE LOWER(@searchLike) ESCAPE '\\' OR
    LOWER(COALESCE(p.category, '')) LIKE LOWER(@searchLike) ESCAPE '\\')`;
}

function priceSearchClause(): string {
  return `(@search = '' OR
    LOWER(pr.upc_plu) LIKE LOWER(@searchLike) ESCAPE '\\' OR
    LOWER(st.store_code) LIKE LOWER(@searchLike) ESCAPE '\\' OR
    LOWER(COALESCE(pr.price_type, '')) LIKE LOWER(@searchLike) ESCAPE '\\')`;
}

function salesSearchClause(): string {
  return `(@search = '' OR
    LOWER(s.upc_plu) LIKE LOWER(@searchLike) ESCAPE '\\' OR
    LOWER(COALESCE(p.description, s.description, '')) LIKE LOWER(@searchLike) ESCAPE '\\' OR
    LOWER(st.store_code) LIKE LOWER(@searchLike) ESCAPE '\\')`;
}

function pickDisplayPrice(rows: RawStorePrice[]): number | null {
  const priced = rows.filter((row) => row.price != null);
  if (priced.length === 0) return null;

  const regular = priced.filter((row) => row.price_type === 'REG');
  const pool = regular.length > 0 ? regular : priced;

  return pool.sort((a, b) => (b.price_priority ?? 0) - (a.price_priority ?? 0))[0].price;
}

export function parseViewFilters(searchParams: URLSearchParams): ViewFilters {
  const grocerId = parsePositiveInt(searchParams.get('grocer'));
  let storeId = parsePositiveInt(searchParams.get('store'));
  const tabParam = searchParams.get('tab');
  const tab =
    tabParam === 'prices' ||
    tabParam === 'compare' ||
    tabParam === 'sales' ||
    tabParam === 'products'
      ? tabParam
      : 'products';
  const search = normalizeSearch(searchParams.get('q'));

  if (grocerId && storeId) {
    const valid = getDb()
      .prepare('SELECT 1 FROM stores WHERE id = ? AND grocer_id = ?')
      .get(storeId, grocerId);
    if (!valid) storeId = null;
  }

  return { grocerId, storeId, tab, search };
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function queryProducts(filters: ViewFilters): ProductRow[] {
  if (filters.grocerId == null) return [];

  return getDb()
    .prepare(
      `SELECT p.upc_plu, p.description, p.department, p.category, p.unit_size, p.pack_size
       FROM products p
       WHERE p.grocer_id = @grocerId
         AND ${productSearchClause()}
       ORDER BY p.description COLLATE NOCASE, p.upc_plu`
    )
    .all({ grocerId: filters.grocerId, ...searchParams(filters.search) }) as ProductRow[];
}

export function queryPrices(filters: ViewFilters): PriceRow[] {
  if (filters.grocerId == null) return [];

  return getDb()
    .prepare(
      `SELECT
         st.store_code,
         pr.upc_plu,
         pr.price,
         pr.price_type,
         pr.price_priority,
         pr.start_date,
         pr.end_date
       FROM prices pr
       JOIN stores st ON st.id = pr.store_id
       WHERE st.grocer_id = @grocerId
         AND ${storeClause('st')}
         AND ${priceSearchClause()}
       ORDER BY st.store_code, pr.upc_plu, pr.price_type`
    )
    .all({
      grocerId: filters.grocerId,
      storeId: filters.storeId,
      ...searchParams(filters.search)
    }) as PriceRow[];
}

export function querySalesAggregates(filters: ViewFilters): SalesAggregate[] {
  if (filters.grocerId == null) return [];

  return getDb()
    .prepare(
      `SELECT
         g.id AS grocer_id,
         g.name AS grocer_name,
         st.id AS store_id,
         st.store_code,
         s.upc_plu,
         COALESCE(p.description, s.description) AS description,
         COUNT(*) AS transaction_count,
         ROUND(COALESCE(SUM(s.units_sold), 0), 2) AS total_units,
         ROUND(COALESCE(SUM(s.total_sale), 0), 2) AS total_revenue
       FROM sales s
       JOIN stores st ON st.id = s.store_id
       JOIN grocers g ON g.id = st.grocer_id
       LEFT JOIN products p ON p.grocer_id = g.id AND p.upc_plu = s.upc_plu
       WHERE st.grocer_id = @grocerId
         AND ${storeClause('st')}
         AND ${salesSearchClause()}
       GROUP BY g.id, st.id, s.upc_plu
       ORDER BY total_revenue DESC, st.store_code, s.upc_plu`
    )
    .all({
      grocerId: filters.grocerId,
      storeId: filters.storeId,
      ...searchParams(filters.search)
    }) as SalesAggregate[];
}

export function querySalesByStore(filters: ViewFilters): StoreSalesSummary[] {
  if (filters.grocerId == null) return [];

  return getDb()
    .prepare(
      `SELECT
         st.store_code,
         ROUND(COALESCE(SUM(s.total_sale), 0), 2) AS total_revenue,
         COUNT(*) AS transaction_count
       FROM sales s
       JOIN stores st ON st.id = s.store_id
       WHERE st.grocer_id = @grocerId
         AND ${storeClause('st')}
       GROUP BY st.id
       ORDER BY total_revenue DESC, st.store_code`
    )
    .all({
      grocerId: filters.grocerId,
      storeId: filters.storeId
    }) as StoreSalesSummary[];
}

export function queryPriceComparison(filters: ViewFilters): {
  storeCodes: string[];
  rows: PriceComparisonRow[];
} {
  if (filters.grocerId == null) return { storeCodes: [], rows: [] };

  const storeCodes = (
    getDb()
      .prepare('SELECT store_code FROM stores WHERE grocer_id = ? ORDER BY store_code')
      .all(filters.grocerId) as Array<{ store_code: string }>
  ).map((row) => row.store_code);

  if (storeCodes.length === 0) return { storeCodes: [], rows: [] };

  const rawPrices = getDb()
    .prepare(
      `SELECT
         pr.upc_plu,
         st.store_code,
         pr.price,
         pr.price_type,
         pr.price_priority
       FROM prices pr
       JOIN stores st ON st.id = pr.store_id
       WHERE st.grocer_id = @grocerId`
    )
    .all({ grocerId: filters.grocerId }) as RawStorePrice[];

  const descriptions = new Map(
    (
      getDb()
        .prepare('SELECT upc_plu, description FROM products WHERE grocer_id = ?')
        .all(filters.grocerId) as Array<{ upc_plu: string; description: string | null }>
    ).map((row) => [row.upc_plu, row.description])
  );

  const pricesByUpcStore = new Map<string, Map<string, RawStorePrice[]>>();

  for (const row of rawPrices) {
    let byStore = pricesByUpcStore.get(row.upc_plu);
    if (!byStore) {
      byStore = new Map();
      pricesByUpcStore.set(row.upc_plu, byStore);
    }

    const existing = byStore.get(row.store_code) ?? [];
    existing.push(row);
    byStore.set(row.store_code, existing);
  }

  const search = filters.search.trim().toLowerCase();
  const rows: PriceComparisonRow[] = [];

  for (const [upc_plu, byStore] of pricesByUpcStore) {
    const description = descriptions.get(upc_plu) ?? null;

    if (search) {
      const haystack = `${upc_plu} ${description ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) continue;
    }

    const prices_by_store: Record<string, number | null> = {};
    const numericPrices: number[] = [];

    for (const store_code of storeCodes) {
      const price = pickDisplayPrice(byStore.get(store_code) ?? []);
      prices_by_store[store_code] = price;
      if (price != null) numericPrices.push(price);
    }

    if (numericPrices.length < 2) continue;

    const min_price = Math.min(...numericPrices);
    const max_price = Math.max(...numericPrices);
    const spread =
      max_price > min_price ? Number((max_price - min_price).toFixed(2)) : null;

    rows.push({
      upc_plu,
      description,
      prices_by_store,
      min_price,
      max_price,
      spread,
      stores_with_price: numericPrices.length
    });
  }

  rows.sort((a, b) => {
    const spreadDiff = (b.spread ?? 0) - (a.spread ?? 0);
    if (spreadDiff !== 0) return spreadDiff;
    return (a.description ?? a.upc_plu).localeCompare(b.description ?? b.upc_plu, undefined, {
      sensitivity: 'base'
    });
  });

  return { storeCodes, rows };
}

export function querySalesTrend(filters: ViewFilters): DailySalesTrend[] {
  if (filters.grocerId == null) return [];

  return getDb()
    .prepare(
      `SELECT
         date(s.sale_time_ms / 1000, 'unixepoch') AS sale_date,
         ROUND(COALESCE(SUM(s.total_sale), 0), 2) AS total_revenue,
         COUNT(*) AS transaction_count
       FROM sales s
       JOIN stores st ON st.id = s.store_id
       WHERE st.grocer_id = @grocerId
         AND ${storeClause('st')}
         AND s.sale_time_ms IS NOT NULL
       GROUP BY sale_date
       ORDER BY sale_date`
    )
    .all({
      grocerId: filters.grocerId,
      storeId: filters.storeId
    }) as DailySalesTrend[];
}

export function buildViewHref(filters: ViewFilters): string {
  const params = new URLSearchParams();
  if (filters.grocerId != null) params.set('grocer', String(filters.grocerId));
  if (filters.storeId != null) params.set('store', String(filters.storeId));
  if (filters.tab !== 'products') params.set('tab', filters.tab);
  if (filters.search) params.set('q', filters.search);
  const query = params.toString();
  return query ? `/view?${query}` : '/view';
}
