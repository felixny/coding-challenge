export type FileKind = 'product' | 'price' | 'sale' | 'unknown';

export interface Grocer {
  id: number;
  slug: string;
  name: string;
  created_at: string;
}

export interface Store {
  id: number;
  grocer_id: number;
  store_code: string;
}

export interface Product {
  id: number;
  grocer_id: number;
  upc_plu: string;
  description: string | null;
  department: string | null;
  category: string | null;
  unit_size: string | null;
  pack_size: string | null;
  is_placeholder_upc: number;
  source_file: string | null;
  updated_at: string;
}

export interface Price {
  id: number;
  store_id: number;
  upc_plu: string;
  price: number | null;
  price_type: string | null;
  price_priority: number | null;
  price_multiple: number | null;
  unit_multiple: number | null;
  start_date: string | null;
  end_date: string | null;
  source_file: string | null;
  imported_at: string;
}

export interface Sale {
  id: number;
  store_id: number;
  upc_plu: string;
  description: string | null;
  unit_size: string | null;
  sale_time_ms: number | null;
  sale_time_zone: string | null;
  price_type: string | null;
  price_priority: number | null;
  price_multiple: number | null;
  unit_multiple: number | null;
  unit_price: number | null;
  units_sold: number | null;
  total_sale: number | null;
  source_file: string | null;
  imported_at: string;
}

export interface SalesAggregate {
  grocer_id: number;
  grocer_name: string;
  store_id: number;
  store_code: string;
  upc_plu: string;
  description: string | null;
  transaction_count: number;
  total_units: number;
  total_revenue: number;
}

export interface StoreSalesSummary {
  store_code: string;
  total_revenue: number;
  transaction_count: number;
}

export interface DailySalesTrend {
  sale_date: string;
  total_revenue: number;
  transaction_count: number;
}

export interface PriceComparisonRow {
  upc_plu: string;
  description: string | null;
  prices_by_store: Record<string, number | null>;
  min_price: number | null;
  max_price: number | null;
  spread: number | null;
  stores_with_price: number;
}

export interface DataQualitySummary {
  orphaned_sales: number;
  products_without_price: number;
  placeholder_upcs: number;
}

export interface OrphanedSaleDetail {
  upc_plu: string;
  description: string | null;
  grocer_name: string;
  store_code: string;
  source_file: string | null;
  total_sale: number | null;
}

export interface MissingPriceDetail {
  upc_plu: string;
  description: string | null;
  grocer_name: string;
  source_file: string | null;
}

export interface PlaceholderUpcDetail {
  upc_plu: string;
  description: string | null;
  grocer_name: string;
  in_sales: boolean;
}

export interface DataQualityDetails {
  summary: DataQualitySummary;
  orphaned_sales: OrphanedSaleDetail[];
  products_without_price: MissingPriceDetail[];
  placeholder_upcs: PlaceholderUpcDetail[];
}

export const PLACEHOLDER_UPC = '999999999999';

export const GROCER_NAMES_BY_FOLDER: Record<string, string> = {
  'colins-market': "Colin's Market",
  'J&A-grocers': 'J&A Grocers',
  'stevens-produce': 'Stevens Produce'
};
