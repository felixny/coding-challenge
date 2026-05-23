import type { PageServerLoad } from './$types';
import { listGrocers, listStores, tableCounts } from '$lib/server/db';
import { getDataQualityDetails } from '$lib/server/db/quality';
import {
  parseViewFilters,
  queryPrices,
  queryProducts,
  querySalesAggregates,
  querySalesByStore,
  querySalesTrend
} from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ url }) => {
  const filters = parseViewFilters(url.searchParams);
  const grocers = listGrocers();
  const stores = filters.grocerId != null ? listStores(filters.grocerId) : [];
  const counts = tableCounts();
  const hasData = counts.products + counts.prices + counts.sales > 0;

  const products = filters.tab === 'products' ? queryProducts(filters) : [];
  const prices = filters.tab === 'prices' ? queryPrices(filters) : [];
  const sales = filters.tab === 'sales' ? querySalesAggregates(filters) : [];
  const salesByStore = filters.tab === 'sales' ? querySalesByStore(filters) : [];
  const salesTrend = filters.tab === 'sales' ? querySalesTrend(filters) : [];

  return {
    grocers,
    stores,
    filters,
    products,
    prices,
    sales,
    salesByStore,
    salesTrend,
    hasData,
    qualityDetails: hasData ? getDataQualityDetails() : null
  };
};
