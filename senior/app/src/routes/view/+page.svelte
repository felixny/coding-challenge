<script lang="ts">
  import DataQualityPanel from '$lib/components/DataQualityPanel.svelte';
  import PriceComparePanel from '$lib/components/PriceComparePanel.svelte';
  import SalesCharts from '$lib/components/SalesCharts.svelte';
  import type { ViewFilters } from '$lib/server/db/queries';

  let { data } = $props();

  function filterHref(overrides: Partial<ViewFilters> = {}): string {
    const next: ViewFilters = {
      grocerId: overrides.grocerId !== undefined ? overrides.grocerId : data.filters.grocerId,
      storeId: overrides.storeId !== undefined ? overrides.storeId : data.filters.storeId,
      tab: overrides.tab ?? data.filters.tab,
      search: overrides.search !== undefined ? overrides.search : data.filters.search
    };

    if (overrides.grocerId !== undefined && overrides.storeId === undefined) {
      next.storeId = null;
    }

    const params = new URLSearchParams();
    if (next.grocerId != null) params.set('grocer', String(next.grocerId));
    if (next.storeId != null) params.set('store', String(next.storeId));
    if (next.tab !== 'products') params.set('tab', next.tab);
    if (next.search) params.set('q', next.search);

    const query = params.toString();
    return query ? `/view?${query}` : '/view';
  }

  function tabHref(tab: ViewFilters['tab']): string {
    return filterHref({ tab });
  }

  function formatMoney(value: number | null | undefined): string {
    if (value == null) return '—';
    return `$${value.toFixed(2)}`;
  }

  function label(value: string | null | undefined): string {
    return value?.trim() || '—';
  }
</script>

<div class="page-card">
  <header class="page-hero view-hero">
    <div>
      <p class="page-kicker">Explore data</p>
      <h1 class="page-title">View</h1>
      <p class="page-desc">Browse products, prices, cross-store comparisons, and aggregated sales.</p>
    </div>
    <div class="page-hero-art" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 15h3" />
      </svg>
    </div>
  </header>

  <div class="page-body">
  {#if !data.hasData}
    <div class="empty-state">
      <div class="empty-illustration" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </div>
      <p>No data imported yet.</p>
      <a class="btn" href="/import">Go to Import</a>
    </div>
  {:else}
    <section class="filters-panel">
      <form method="GET" class="filters-form">
        <input type="hidden" name="tab" value={data.filters.tab} />

        <label class="field">
          <span class="field-label">Grocer</span>
          <select name="grocer" onchange={(event) => {
            const value = (event.currentTarget as HTMLSelectElement).value;
            window.location.href = filterHref({
              grocerId: value ? Number(value) : null,
              storeId: null
            });
          }}>
            <option value="" selected={data.filters.grocerId == null}>Select grocer…</option>
            {#each data.grocers as grocer}
              <option value={grocer.id} selected={data.filters.grocerId === grocer.id}>
                {grocer.name}
              </option>
            {/each}
          </select>
        </label>

        <label class="field">
          <span class="field-label">Store</span>
          <select
            name="store"
            disabled={data.filters.grocerId == null || data.stores.length === 0}
            onchange={(event) => {
              const value = (event.currentTarget as HTMLSelectElement).value;
              window.location.href = filterHref({
                storeId: value ? Number(value) : null
              });
            }}
          >
            <option value="" selected={data.filters.storeId == null}>All stores</option>
            {#each data.stores as store}
              <option value={store.id} selected={data.filters.storeId === store.id}>
                {store.store_code}
              </option>
            {/each}
          </select>
        </label>

        <label class="field field-search">
          <span class="field-label">Search</span>
          <div class="search-row">
            <input
              type="search"
              name="q"
              value={data.filters.search}
              placeholder="UPC, name, department…"
            />
            <button type="submit" class="btn secondary">Search</button>
          </div>
        </label>
      </form>

      {#if data.filters.search}
        <p class="search-active">
          Showing results for <strong>{data.filters.search}</strong>
          <a href={filterHref({ search: '' })}>Clear search</a>
        </p>
      {/if}

      <nav class="tabs">
        <a
          href={tabHref('products')}
          class:active={data.filters.tab === 'products'}
          class:tab-products={true}
        >
          Products
        </a>
        <a
          href={tabHref('prices')}
          class:active={data.filters.tab === 'prices'}
          class:tab-prices={true}
        >
          Prices
        </a>
        <a
          href={tabHref('compare')}
          class:active={data.filters.tab === 'compare'}
          class:tab-compare={true}
        >
          Compare
        </a>
        <a
          href={tabHref('sales')}
          class:active={data.filters.tab === 'sales'}
          class:tab-sales={true}
        >
          Sales
        </a>
      </nav>
    </section>

    {#if data.filters.grocerId == null}
      <div class="empty-state compact">
        <div class="empty-illustration small" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 7h18" />
            <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
            <path d="M5 7l1 14h12l1-14" />
          </svg>
        </div>
        <p>Select a grocer to view products, prices, comparisons, and sales.</p>
      </div>
    {:else if data.filters.tab === 'products'}
      <section class="table-section">
        <div class="section-head">
          <h2>Products</h2>
          <span class="count-badge">{data.products.length} items</span>
        </div>
        {#if data.products.length === 0}
          <p class="empty-table">
            {data.filters.search
              ? `No products matching "${data.filters.search}".`
              : 'No products for this grocer.'}
          </p>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>UPC/PLU</th>
                  <th>Description</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Pack</th>
                </tr>
              </thead>
              <tbody>
                {#each data.products as row}
                  <tr>
                    <td class="mono">{row.upc_plu}</td>
                    <td>{label(row.description)}</td>
                    <td>{label(row.department)}</td>
                    <td>{label(row.category)}</td>
                    <td>{label(row.unit_size)}</td>
                    <td>{label(row.pack_size)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {:else if data.filters.tab === 'prices'}
      <section class="table-section">
        <div class="section-head">
          <h2>Prices</h2>
          <span class="count-badge">{data.prices.length} rows</span>
        </div>
        {#if data.prices.length === 0}
          <p class="empty-table">
            {data.filters.search
              ? `No prices matching "${data.filters.search}".`
              : 'No prices match these filters.'}
          </p>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Store</th>
                  <th>UPC/PLU</th>
                  <th>Price</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {#each data.prices as row}
                  <tr>
                    <td>{row.store_code}</td>
                    <td class="mono">{row.upc_plu}</td>
                    <td>{formatMoney(row.price)}</td>
                    <td>{label(row.price_type)}</td>
                    <td>{row.price_priority ?? '—'}</td>
                    <td>{label(row.start_date)}</td>
                    <td>{label(row.end_date)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {:else if data.filters.tab === 'compare'}
      <section class="table-section">
        <div class="section-head">
          <h2>Price comparison across stores</h2>
          <span class="count-badge">{data.priceComparison.rows.length} products</span>
        </div>
        <p class="compare-note">
          Same UPC priced at two or more stores for this grocer. Uses REG price when available,
          otherwise the highest-priority price. Store filter is ignored here.
        </p>
        {#if data.priceComparison.rows.length === 0}
          <p class="empty-table">
            {data.filters.search
              ? `No cross-store prices matching "${data.filters.search}".`
              : data.stores.length < 2
                ? 'This grocer only has one store — nothing to compare.'
                : 'No products with prices at multiple stores.'}
          </p>
        {:else}
          <PriceComparePanel
            storeCodes={data.priceComparison.storeCodes}
            rows={data.priceComparison.rows}
          />
        {/if}
      </section>
    {:else if data.filters.tab === 'sales'}
      <section class="table-section">
        <div class="section-head">
          <h2>Sales (aggregated by UPC)</h2>
          <span class="count-badge">{data.sales.length} products</span>
        </div>
        {#if data.sales.length === 0}
          <p class="empty-table">
            {data.filters.search
              ? `No sales matching "${data.filters.search}".`
              : 'No sales match these filters.'}
          </p>
        {:else}
          <SalesCharts
            topProducts={data.sales.slice(0, 8)}
            storeBreakdown={data.salesByStore}
            dailyTrend={data.salesTrend}
          />
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Store</th>
                  <th>UPC/PLU</th>
                  <th>Description</th>
                  <th>Transactions</th>
                  <th>Units sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {#each data.sales as row}
                  <tr>
                    <td>{row.store_code}</td>
                    <td class="mono">{row.upc_plu}</td>
                    <td>{label(row.description)}</td>
                    <td>{row.transaction_count}</td>
                    <td>{row.total_units}</td>
                    <td>{formatMoney(row.total_revenue)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {/if}

    {#if data.qualityDetails}
      <DataQualityPanel details={data.qualityDetails} />
    {/if}
  {/if}
  </div>
</div>

<style>
  .filters-panel {
    margin-bottom: 1.25rem;
    padding: 1.2rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background:
      linear-gradient(135deg, rgba(239, 246, 255, 0.5) 0%, rgba(255, 255, 255, 0.95) 100%);
    box-shadow: var(--shadow-sm);
  }

  .filters-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.85rem;
    margin-bottom: 0.75rem;
  }

  .field-search {
    grid-column: 1 / -1;
  }

  .search-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .search-row input[type='search'] {
    flex: 1;
    min-width: 200px;
    padding: 0.58rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .search-row input[type='search']:hover {
    border-color: var(--border-strong);
  }

  .search-active {
    margin: 0 0 0.85rem;
    font-size: 0.88rem;
    color: var(--muted);
  }

  .search-active a {
    margin-left: 0.65rem;
    color: var(--accent);
    font-weight: 600;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .field-label {
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--muted);
  }

  select {
    padding: 0.58rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  select:hover:not(:disabled) {
    border-color: var(--border-strong);
  }

  select:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .tabs {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    padding-top: 0.15rem;
  }

  .tabs a {
    padding: 0.48rem 0.95rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    font-weight: 600;
    font-size: 0.9rem;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .tabs a:hover {
    border-color: var(--accent-muted);
    color: var(--text);
  }

  .tabs a.active.tab-products {
    background: var(--tone-products-soft);
    border-color: #bfdbfe;
    color: var(--tone-products);
  }

  .tabs a.active.tab-prices {
    background: var(--tone-prices-soft);
    border-color: #fed7aa;
    color: var(--tone-prices);
  }

  .tabs a.active.tab-compare {
    background: var(--tone-stores-soft);
    border-color: #ddd6fe;
    color: var(--tone-stores);
  }

  .tabs a.active.tab-sales {
    background: var(--tone-sales-soft);
    border-color: var(--accent-muted);
    color: var(--tone-sales);
  }

  .table-section {
    margin-bottom: 1.25rem;
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 0.75rem;
  }

  .section-head h2 {
    margin: 0;
    font-size: 1.02rem;
    letter-spacing: -0.02em;
  }

  .count-badge {
    font-size: 0.8rem;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.18rem 0.6rem;
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  th,
  td {
    padding: 0.62rem 0.8rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  th {
    position: sticky;
    top: 0;
    background: var(--surface-muted);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    z-index: 1;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:nth-child(even) {
    background: rgba(255, 255, 255, 0.45);
  }

  tbody tr:hover {
    background: var(--accent-soft);
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.84rem;
  }

  .empty-state {
    padding: 2.5rem 1.5rem;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    text-align: center;
    background: var(--surface-muted);
  }

  .empty-state.compact {
    padding: 1.75rem 1.25rem;
    margin-bottom: 1rem;
  }

  .empty-illustration.small {
    width: 2.75rem;
    height: 2.75rem;
    margin-bottom: 0.65rem;
  }

  .empty-illustration.small svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .empty-state p {
    margin: 0 0 1rem;
    color: var(--muted);
  }

  .empty-table {
    margin: 0;
    padding: 1rem;
    color: var(--muted);
    background: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .compare-note {
    margin: 0 0 0.85rem;
    font-size: 0.88rem;
    color: var(--muted);
  }

  .btn {
    display: inline-block;
    border-radius: var(--radius-sm);
    padding: 0.58rem 1.05rem;
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    border: none;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition:
      background 0.15s ease,
      transform 0.15s ease;
  }

  .btn:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }

  .btn.secondary {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    box-shadow: none;
  }

  .btn.secondary:hover {
    background: var(--bg);
    transform: none;
  }
</style>
