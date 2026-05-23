<script lang="ts">
  import type { PriceComparisonRow } from '$lib/types/entities';

  let {
    storeCodes,
    rows
  }: {
    storeCodes: string[];
    rows: PriceComparisonRow[];
  } = $props();

  function formatMoney(value: number | null | undefined): string {
    if (value == null) return '—';
    return `$${value.toFixed(2)}`;
  }

  function shortLabel(value: string, max = 24): string {
    const trimmed = value.trim();
    return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
  }

  function priceClass(row: PriceComparisonRow, storeCode: string): string {
    const price = row.prices_by_store[storeCode];
    if (price == null || row.spread == null) return '';
    if (price === row.min_price) return 'price-low';
    if (price === row.max_price) return 'price-high';
    return '';
  }

  const hasGaps = $derived(rows.some((row) => row.spread != null && row.spread > 0));

  const chartRows = $derived(
    hasGaps
      ? rows.filter((row) => row.spread != null && row.spread > 0).slice(0, 8)
      : [...rows]
          .sort((a, b) => (b.max_price ?? 0) - (a.max_price ?? 0))
          .slice(0, 8)
  );

  const chartMax = $derived(
    chartRows.reduce((max, row) => Math.max(max, row.max_price ?? 0), 0) || 1
  );

  function barWidth(value: number | null, max: number): string {
    if (value == null || max <= 0) return '0%';
    return `${Math.max(6, (value / max) * 100)}%`;
  }
</script>

{#if chartRows.length > 0}
  <section class="compare-chart">
    <div class="compare-chart-head">
      <h3>{hasGaps ? 'Largest price gaps across stores' : 'Prices by store'}</h3>
      <p>
        {#if hasGaps}
          REG price when available, otherwise highest-priority price per store.
        {:else}
          Same price at every store for these items — REG when available, otherwise highest priority.
        {/if}
      </p>
    </div>
    <ul class="gap-chart">
      {#each chartRows as row}
        <li class="gap-row">
          <span class="gap-label" title={row.description ?? row.upc_plu}>
            {shortLabel(row.description ?? row.upc_plu)}
          </span>
          <div class="gap-stores">
            {#each storeCodes as storeCode}
              {@const price = row.prices_by_store[storeCode]}
              {#if price != null}
                <div class="gap-store" title="{storeCode}: {formatMoney(price)}">
                  <span class="gap-store-code">{storeCode}</span>
                  <div class="gap-track">
                    <div
                      class="gap-bar"
                      class:low={hasGaps && price === row.min_price}
                      class:high={hasGaps && price === row.max_price}
                      class:aligned={!hasGaps}
                      style:width={barWidth(price, chartMax)}
                    ></div>
                  </div>
                  <span class="gap-price">{formatMoney(price)}</span>
                </div>
              {/if}
            {/each}
          </div>
          <span class="gap-spread" class:aligned-note={!hasGaps}>
            {#if hasGaps && row.spread != null}
              +{formatMoney(row.spread)}
            {:else}
              Same
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>UPC/PLU</th>
        <th>Description</th>
        {#each storeCodes as storeCode}
          <th>{storeCode}</th>
        {/each}
        <th>Spread</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr>
          <td class="mono">{row.upc_plu}</td>
          <td>{row.description?.trim() || '—'}</td>
          {#each storeCodes as storeCode}
            <td class={priceClass(row, storeCode)}>
              {formatMoney(row.prices_by_store[storeCode])}
            </td>
          {/each}
          <td class="spread-cell">
            {#if row.spread != null}
              {formatMoney(row.spread)}
            {:else}
              —
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .compare-chart {
    margin-bottom: 1rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--tone-stores-soft) 0%, var(--surface) 100%);
    box-shadow: var(--shadow-sm);
  }

  .compare-chart-head h3 {
    margin: 0;
    font-size: 0.95rem;
    letter-spacing: -0.02em;
  }

  .compare-chart-head p {
    margin: 0.2rem 0 0.85rem;
    font-size: 0.82rem;
    color: var(--muted);
  }

  .gap-chart {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gap-row {
    display: grid;
    grid-template-columns: minmax(110px, 1fr) 3fr auto;
    gap: 0.65rem;
    align-items: start;
    font-size: 0.84rem;
  }

  .gap-label {
    font-weight: 600;
    padding-top: 0.15rem;
  }

  .gap-stores {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .gap-store {
    display: grid;
    grid-template-columns: 3.5rem 1fr auto;
    gap: 0.45rem;
    align-items: center;
  }

  .gap-store-code {
    font-size: 0.75rem;
    color: var(--muted);
    font-weight: 600;
  }

  .gap-track {
    height: 0.55rem;
    background: var(--accent-soft);
    border-radius: 999px;
    overflow: hidden;
  }

  .gap-bar {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%);
    border-radius: 999px;
  }

  .gap-bar.low {
    background: linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%);
  }

  .gap-bar.high {
    background: linear-gradient(90deg, var(--tone-prices) 0%, #ea580c 100%);
  }

  .gap-bar.aligned {
    background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%);
  }

  .gap-price {
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    color: var(--muted);
    font-weight: 600;
  }

  .gap-spread {
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--tone-prices);
    padding-top: 0.15rem;
    white-space: nowrap;
  }

  .gap-spread.aligned-note {
    color: var(--muted);
    font-weight: 600;
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
    white-space: nowrap;
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
    white-space: nowrap;
  }

  .price-low {
    color: var(--accent);
    font-weight: 700;
  }

  .price-high {
    color: var(--tone-prices);
    font-weight: 700;
  }

  .spread-cell {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    white-space: nowrap;
  }
</style>
