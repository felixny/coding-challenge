import { getDb } from './index';
import type { DailySalesTrend, SalesAggregate, StoreSalesSummary } from '$lib/types/entities';

export interface ViewFilters {
  grocerId: number | null;
  storeId: number | null;
  tab: 'products' | 'prices' | 'sales';
  search: string;
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

export function parseViewFilters(searchParams: URLSearchParams): ViewFilters {
  const grocerId = parsePositiveInt(searchParams.get('grocer'));
  let storeId = parsePositiveInt(searchParams.get('store'));
  const tabParam = searchParams.get('tab');
  const tab =
    tabParam === 'prices' || tabParam === 'sales' || tabParam === 'products' ? tabParam : 'products';
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
