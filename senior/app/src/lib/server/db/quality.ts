import { getDb } from './index';
import type {
  DataQualityDetails,
  DataQualitySummary,
  MissingPriceDetail,
  OrphanedSaleDetail,
  PlaceholderUpcDetail
} from '$lib/types/entities';

export function getDataQualitySummary(): DataQualitySummary {
  return getDataQualityDetails().summary;
}

export function getDataQualityDetails(): DataQualityDetails {
  const database = getDb();

  const orphaned_sales = database
    .prepare(
      `SELECT
         s.upc_plu,
         s.description,
         g.name AS grocer_name,
         st.store_code,
         s.source_file,
         s.total_sale
       FROM sales s
       JOIN stores st ON st.id = s.store_id
       JOIN grocers g ON g.id = st.grocer_id
       LEFT JOIN products p ON p.grocer_id = st.grocer_id AND p.upc_plu = s.upc_plu
       WHERE p.id IS NULL
       ORDER BY g.name, s.upc_plu, s.source_file`
    )
    .all() as OrphanedSaleDetail[];

  const products_without_price = database
    .prepare(
      `SELECT
         p.upc_plu,
         p.description,
         g.name AS grocer_name,
         p.source_file
       FROM products p
       JOIN grocers g ON g.id = p.grocer_id
       WHERE NOT EXISTS (
         SELECT 1
         FROM prices pr
         JOIN stores st ON st.id = pr.store_id
         WHERE st.grocer_id = p.grocer_id AND pr.upc_plu = p.upc_plu
       )
       ORDER BY g.name, p.upc_plu`
    )
    .all() as MissingPriceDetail[];

  const placeholder_products = database
    .prepare(
      `SELECT
         p.upc_plu,
         p.description,
         g.name AS grocer_name,
         0 AS in_sales
       FROM products p
       JOIN grocers g ON g.id = p.grocer_id
       WHERE p.is_placeholder_upc = 1
       ORDER BY g.name, p.upc_plu`
    )
    .all() as PlaceholderUpcDetail[];

  const placeholder_sales = database
    .prepare(
      `SELECT DISTINCT
         s.upc_plu,
         s.description,
         g.name AS grocer_name,
         1 AS in_sales
       FROM sales s
       JOIN stores st ON st.id = s.store_id
       JOIN grocers g ON g.id = st.grocer_id
       LEFT JOIN products p ON p.grocer_id = st.grocer_id AND p.upc_plu = s.upc_plu
       WHERE p.id IS NULL
         AND (
           s.upc_plu GLOB '9*'
           OR s.upc_plu LIKE '%999999%'
         )
       ORDER BY g.name, s.upc_plu`
    )
    .all() as PlaceholderUpcDetail[];

  const placeholderMap = new Map<string, PlaceholderUpcDetail>();
  for (const row of [...placeholder_products, ...placeholder_sales]) {
    const key = `${row.grocer_name}:${row.upc_plu}`;
    const existing = placeholderMap.get(key);
    if (existing) {
      existing.in_sales = existing.in_sales || row.in_sales;
    } else {
      placeholderMap.set(key, { ...row });
    }
  }

  const placeholder_upcs = [...placeholderMap.values()];

  const summary: DataQualitySummary = {
    orphaned_sales: orphaned_sales.length,
    products_without_price: products_without_price.length,
    placeholder_upcs: placeholder_upcs.length
  };

  return {
    summary,
    orphaned_sales,
    products_without_price,
    placeholder_upcs
  };
}
