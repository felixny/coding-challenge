<script lang="ts">
  import type { DataQualityDetails } from '$lib/types/entities';

  let { details, defaultOpen = false }: { details: DataQualityDetails; defaultOpen?: boolean } = $props();

  const totalIssues = $derived(
    details.summary.orphaned_sales +
      details.summary.products_without_price +
      details.summary.placeholder_upcs
  );

  function label(value: string | null | undefined): string {
    return value?.trim() || '—';
  }

  function formatMoney(value: number | null | undefined): string {
    if (value == null) return '—';
    return `$${value.toFixed(2)}`;
  }
</script>

<section class="quality-panel">
  <div class="panel-head">
    <div class="panel-intro">
      <span class="section-icon tone-warn" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </span>
      <div>
        <h2>Data quality</h2>
        <p class="intro">
          {#if totalIssues === 0}
            No issues detected in the current dataset.
          {:else}
            {totalIssues} issue{totalIssues === 1 ? '' : 's'} found across imported data.
          {/if}
        </p>
      </div>
    </div>

    <div class="summary-row">
      <div class="metric" class:alert={details.summary.orphaned_sales > 0}>
        <span class="metric-value">{details.summary.orphaned_sales}</span>
        <span class="metric-label">Orphaned sales</span>
      </div>
      <div class="metric" class:alert={details.summary.products_without_price > 0}>
        <span class="metric-value">{details.summary.products_without_price}</span>
        <span class="metric-label">No price</span>
      </div>
      <div class="metric" class:alert={details.summary.placeholder_upcs > 0}>
        <span class="metric-value">{details.summary.placeholder_upcs}</span>
        <span class="metric-label">Placeholder UPCs</span>
      </div>
    </div>
  </div>

  {#if details.orphaned_sales.length > 0}
    <details class="issue-section" open={defaultOpen || details.orphaned_sales.length <= 3}>
      <summary>
        <span class="issue-title">Orphaned sales</span>
        <span class="issue-count">{details.orphaned_sales.length}</span>
        <span class="issue-sub">In sales file, missing from product catalog</span>
      </summary>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>UPC</th>
              <th>Item</th>
              <th>Grocer / store</th>
              <th>Sale</th>
              <th>Source file</th>
            </tr>
          </thead>
          <tbody>
            {#each details.orphaned_sales as row}
              <tr>
                <td class="mono">{row.upc_plu}</td>
                <td>{label(row.description)}</td>
                <td>{row.grocer_name} · {row.store_code}</td>
                <td>{formatMoney(row.total_sale)}</td>
                <td class="file">{label(row.source_file)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}

  {#if details.products_without_price.length > 0}
    <details class="issue-section" open={defaultOpen || details.products_without_price.length <= 3}>
      <summary>
        <span class="issue-title">Products without price</span>
        <span class="issue-count">{details.products_without_price.length}</span>
        <span class="issue-sub">In product catalog, missing from all price files</span>
      </summary>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>UPC</th>
              <th>Item</th>
              <th>Grocer</th>
              <th>Product file</th>
            </tr>
          </thead>
          <tbody>
            {#each details.products_without_price as row}
              <tr>
                <td class="mono">{row.upc_plu}</td>
                <td>{label(row.description)}</td>
                <td>{row.grocer_name}</td>
                <td class="file">{label(row.source_file)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}

  {#if details.placeholder_upcs.length > 0}
    <details class="issue-section" open={defaultOpen}>
      <summary>
        <span class="issue-title">Placeholder UPCs</span>
        <span class="issue-count">{details.placeholder_upcs.length}</span>
        <span class="issue-sub">Suspicious or manual barcode values</span>
      </summary>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>UPC</th>
              <th>Item</th>
              <th>Grocer</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {#each details.placeholder_upcs as row}
              <tr>
                <td class="mono">{row.upc_plu}</td>
                <td>{label(row.description)}</td>
                <td>{row.grocer_name}</td>
                <td>{row.in_sales ? 'Seen in sales' : 'In catalog'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}
</section>

<style>
  .quality-panel {
    margin-bottom: 1.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .panel-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.15rem;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, var(--surface-muted), var(--surface));
  }

  .panel-intro {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .quality-panel h2 {
    margin: 0 0 0.2rem;
    font-size: 1.05rem;
    letter-spacing: -0.02em;
  }

  .intro {
    margin: 0;
    color: var(--muted);
    font-size: 0.88rem;
  }

  .summary-row {
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .metric {
    min-width: 92px;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    text-align: center;
    box-shadow: var(--shadow-sm);
  }

  .metric.alert {
    border-color: #efcaca;
    background: var(--danger-soft);
  }

  .metric.alert .metric-value {
    color: var(--danger);
  }

  .metric-value {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: var(--accent);
  }

  .metric-label {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.72rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .issue-section {
    border-bottom: 1px solid var(--border);
  }

  .issue-section:last-child {
    border-bottom: none;
  }

  .issue-section summary {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.9rem 1.15rem;
    cursor: pointer;
    list-style: none;
    background: var(--surface);
    transition: background 0.15s ease;
  }

  .issue-section summary::-webkit-details-marker {
    display: none;
  }

  .issue-section summary::before {
    content: '▸';
    color: var(--muted);
    font-size: 0.85rem;
    transition: transform 0.15s ease;
  }

  .issue-section[open] summary::before {
    transform: rotate(90deg);
  }

  .issue-section summary:hover {
    background: var(--accent-soft);
  }

  .issue-title {
    font-weight: 600;
    font-size: 0.92rem;
  }

  .issue-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: var(--danger-soft);
    color: var(--danger);
    font-size: 0.78rem;
    font-weight: 700;
  }

  .issue-sub {
    grid-column: 2 / -1;
    font-size: 0.82rem;
    color: var(--muted);
  }

  @media (min-width: 640px) {
    .issue-section summary {
      grid-template-columns: auto auto 1fr auto;
    }

    .issue-sub {
      grid-column: 3;
    }
  }

  .table-wrap {
    overflow-x: auto;
    border-top: 1px solid var(--border);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.86rem;
  }

  th,
  td {
    padding: 0.55rem 0.8rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  th {
    background: var(--surface-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    font-weight: 600;
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
    font-size: 0.82rem;
    white-space: nowrap;
  }

  .file {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78rem;
    color: var(--muted);
    max-width: 220px;
    word-break: break-all;
  }
</style>
