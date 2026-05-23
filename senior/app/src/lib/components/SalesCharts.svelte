<script lang="ts">
  import type { DailySalesTrend, SalesAggregate, StoreSalesSummary } from '$lib/types/entities';

  let {
    topProducts,
    storeBreakdown,
    dailyTrend
  }: {
    topProducts: SalesAggregate[];
    storeBreakdown: StoreSalesSummary[];
    dailyTrend: DailySalesTrend[];
  } = $props();

  function maxRevenue(rows: Array<{ total_revenue: number }>): number {
    return rows.reduce((max, row) => Math.max(max, row.total_revenue), 0) || 1;
  }

  function barWidth(value: number, max: number): string {
    return `${Math.max(4, (value / max) * 100)}%`;
  }

  function formatMoney(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  function shortLabel(value: string, max = 28): string {
    const trimmed = value.trim();
    return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
  }

  function formatDate(value: string): string {
    const [year, month, day] = value.split('-');
    if (!month || !day) return value;
    return `${month}/${day}`;
  }

  const topMax = $derived(maxRevenue(topProducts));
  const storeMax = $derived(maxRevenue(storeBreakdown));
  const trendMax = $derived(maxRevenue(dailyTrend));
</script>

<section class="charts-panel">
  <div class="charts-head">
    <span class="section-icon tone-sales" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    </span>
    <div>
      <h2>Sales charts</h2>
      <p class="charts-sub">Revenue breakdown for the current grocer filter.</p>
    </div>
  </div>

  <div class="charts-grid">
    <div class="chart-card">
      <h3>Top products by revenue</h3>
      {#if topProducts.length === 0}
        <p class="chart-empty">No sales data for this filter.</p>
      {:else}
        <ul class="bar-chart">
          {#each topProducts as row}
            <li class="bar-row">
              <span class="bar-label" title={row.description ?? row.upc_plu}>
                {shortLabel(row.description ?? row.upc_plu)}
              </span>
              <div class="bar-track">
                <div class="bar-fill" style:width={barWidth(row.total_revenue, topMax)}></div>
              </div>
              <span class="bar-value">{formatMoney(row.total_revenue)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="chart-card">
      <h3>Revenue by store</h3>
      {#if storeBreakdown.length === 0}
        <p class="chart-empty">No store totals for this filter.</p>
      {:else}
        <ul class="bar-chart">
          {#each storeBreakdown as row}
            <li class="bar-row">
              <span class="bar-label">{row.store_code}</span>
              <div class="bar-track">
                <div class="bar-fill store" style:width={barWidth(row.total_revenue, storeMax)}></div>
              </div>
              <span class="bar-value">{formatMoney(row.total_revenue)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="chart-card chart-wide">
      <h3>Daily revenue trend</h3>
      {#if dailyTrend.length === 0}
        <p class="chart-empty">No dated sales for this filter.</p>
      {:else}
        <div class="trend-chart">
          {#each dailyTrend as row}
            <div class="trend-col" title="{row.sale_date}: {formatMoney(row.total_revenue)}">
              <div
                class="trend-bar"
                style:height={barWidth(row.total_revenue, trendMax)}
              ></div>
              <span class="trend-label">{formatDate(row.sale_date)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .charts-panel {
    margin-bottom: 1.25rem;
    padding: 1.15rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--tone-sales-soft) 0%, var(--surface) 100%);
    box-shadow: var(--shadow-sm);
  }

  .charts-head {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .charts-panel h2 {
    margin: 0;
    font-size: 1.05rem;
    letter-spacing: -0.02em;
  }

  .charts-sub {
    margin: 0.15rem 0 0;
    font-size: 0.88rem;
    color: var(--muted);
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }

  .chart-card {
    padding: 0.95rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .chart-wide {
    grid-column: 1 / -1;
  }

  .chart-card h3 {
    margin: 0 0 0.75rem;
    font-size: 0.88rem;
    color: var(--muted);
    font-weight: 600;
  }

  .chart-empty {
    margin: 0;
    font-size: 0.88rem;
    color: var(--muted);
  }

  .bar-chart {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .bar-row {
    display: grid;
    grid-template-columns: minmax(90px, 1fr) 2fr auto;
    gap: 0.55rem;
    align-items: center;
    font-size: 0.84rem;
  }

  .bar-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar-track {
    height: 0.7rem;
    background: var(--accent-soft);
    border-radius: 999px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%);
    border-radius: 999px;
    transition: width 0.25s ease;
  }

  .bar-fill.store {
    background: linear-gradient(90deg, #5a8f7b 0%, var(--accent) 100%);
  }

  .bar-value {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .trend-chart {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    min-height: 150px;
    padding: 0.65rem 0.25rem 0;
    overflow-x: auto;
  }

  .trend-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    min-width: 2.2rem;
    flex: 1;
  }

  .trend-bar {
    width: 100%;
    max-width: 2rem;
    min-height: 4px;
    background: linear-gradient(180deg, var(--accent) 0%, var(--accent-hover) 100%);
    border-radius: 6px 6px 0 0;
    transition: height 0.25s ease;
  }

  .trend-label {
    font-size: 0.68rem;
    color: var(--muted);
    writing-mode: horizontal-tb;
    text-align: center;
  }
</style>
