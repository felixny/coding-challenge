<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import DataQualityPanel from '$lib/components/DataQualityPanel.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  let { data, form } = $props();

  let vendorChoice = $state('');
  let uploading = $state(false);
  let dragActive = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  let selectedFiles = $state<File[]>([]);
  let dropMessage = $state('');
  let showResetConfirm = $state(false);
  let wipeForm = $state<HTMLFormElement | null>(null);

  onMount(() => {
    vendorChoice = data.vendors[0]?.folder ?? '__new__';
  });

  const counts = $derived(form?.counts ?? data.counts);
  const qualityDetails = $derived(form?.qualityDetails ?? data.qualityDetails);
  const showNewVendor = $derived(vendorChoice === '__new__');

  function isCsvFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
  }

  function syncInputFiles(files: File[]) {
    selectedFiles = files;
    if (!fileInput) return;

    const transfer = new DataTransfer();
    for (const file of files) {
      transfer.items.add(file);
    }
    fileInput.files = transfer.files;
  }

  function addFiles(incoming: File[]) {
    const csvFiles = incoming.filter(isCsvFile);
    const rejected = incoming.length - csvFiles.length;

    if (rejected > 0) {
      dropMessage = `${rejected} non-CSV file${rejected === 1 ? '' : 's'} skipped.`;
    } else {
      dropMessage = '';
    }

    if (csvFiles.length === 0) return;

    const merged = [...selectedFiles];
    for (const file of csvFiles) {
      const duplicate = merged.some(
        (existing) => existing.name === file.name && existing.size === file.size
      );
      if (!duplicate) merged.push(file);
    }

    syncInputFiles(merged);
  }

  function onInputChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    addFiles([...(input.files ?? [])]);
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    dragActive = true;
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault();
    dragActive = false;
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragActive = false;
    addFiles([...(event.dataTransfer?.files ?? [])]);
  }

  function openFilePicker() {
    fileInput?.click();
  }

  function removeFile(index: number) {
    syncInputFiles(selectedFiles.filter((_, i) => i !== index));
  }

  function clearFiles() {
    dropMessage = '';
    syncInputFiles([]);
    if (fileInput) fileInput.value = '';
  }

  const countMeta: Record<string, { label: string; tone: string }> = {
    grocers: { label: 'Grocers', tone: 'tone-grocers' },
    stores: { label: 'Stores', tone: 'tone-stores' },
    products: { label: 'Products', tone: 'tone-products' },
    prices: { label: 'Prices', tone: 'tone-prices' },
    sales: { label: 'Sales', tone: 'tone-sales' }
  };
</script>

<div class="page-card">
  <header class="page-hero">
    <div>
      <p class="page-kicker">Data pipeline</p>
      <h1 class="page-title">Import</h1>
      <p class="page-desc">Upload CSV files from grocery vendors to load products, prices, and sales.</p>
    </div>
    <div class="page-hero-art" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    </div>
  </header>

  <div class="page-body">
  <section class="panel upload-panel">
    <div class="section-headline">
      <span class="section-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      </span>
      <div>
        <h2>Upload CSV files</h2>
        <p>Drag and drop CSVs here, or browse to select files. Re-importing the same file replaces its previous rows.</p>
      </div>
    </div>

    <form
      method="POST"
      action="?/upload"
      enctype="multipart/form-data"
      use:enhance={({ formData, cancel }) => {
        if (selectedFiles.length === 0) {
          cancel();
          return;
        }

        formData.delete('files');
        for (const file of selectedFiles) {
          formData.append('files', file);
        }

        uploading = true;
        return async ({ update, result }) => {
          uploading = false;
          if (result.type === 'success') {
            clearFiles();
          }
          await update();
        };
      }}
      class="upload-form"
    >
      <label class="field">
        <span class="field-label">Grocer</span>
        <select name="vendor" bind:value={vendorChoice} disabled={uploading}>
          {#each data.vendors as vendor}
            <option value={vendor.folder}>{vendor.name}</option>
          {/each}
          <option value="__new__">New vendor…</option>
        </select>
      </label>

      {#if showNewVendor}
        <label class="field">
          <span class="field-label">New vendor folder name</span>
          <input
            type="text"
            name="newVendor"
            placeholder="e.g. fresh-foods-co"
            required
            disabled={uploading}
          />
        </label>
      {/if}

      <div class="field">
        <span class="field-label">CSV files</span>
        <div
          class="dropzone"
          class:active={dragActive}
          role="button"
          tabindex="0"
          onclick={openFilePicker}
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openFilePicker();
            }
          }}
          ondragover={onDragOver}
          ondragleave={onDragLeave}
          ondrop={onDrop}
        >
          <span class="dropzone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 16V8" />
              <path d="m8 12 4-4 4 4" />
              <path d="M4 20h16" />
            </svg>
          </span>
          <p class="dropzone-title">{dragActive ? 'Drop files here' : 'Drag CSV files here'}</p>
          <p class="dropzone-sub">or click to browse · multiple files OK</p>
        </div>

        <input
          bind:this={fileInput}
          class="file-input-hidden"
          type="file"
          name="files"
          accept=".csv,text/csv"
          multiple
          required={selectedFiles.length === 0}
          disabled={uploading}
          onchange={onInputChange}
        />

        {#if dropMessage}
          <p class="drop-message">{dropMessage}</p>
        {/if}

        {#if selectedFiles.length > 0}
          <ul class="selected-files">
            {#each selectedFiles as file, index}
              <li>
                <span>{file.name}</span>
                <button type="button" class="link-btn" onclick={() => removeFile(index)} disabled={uploading}>
                  Remove
                </button>
              </li>
            {/each}
          </ul>
          <button type="button" class="link-btn clear-btn" onclick={clearFiles} disabled={uploading}>
            Clear all
          </button>
        {/if}
      </div>

      <button type="submit" class="btn" disabled={uploading || selectedFiles.length === 0}>
        {uploading ? 'Importing…' : 'Upload and import'}
      </button>
    </form>
  </section>

  <section class="panel samples-panel">
    <div class="section-headline">
      <span class="section-icon tone-sales" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
          <path d="M6 7l1 12h10l1-12" />
        </svg>
      </span>
      <div>
        <h2>Sample imports</h2>
        <p>Loads bundled demo files from disk. Re-importing the same file replaces its previous rows.</p>
      </div>
    </div>

    <div class="sample-grid">
      <form method="POST" action="?/importAll" use:enhance class="sample-card featured">
        <button type="submit" class="sample-btn">
          <span class="sample-title">Import all sample files</span>
          <span class="sample-sub">All three vendors · 45 files</span>
        </button>
      </form>
      {#each data.vendors as vendor}
        <form method="POST" action="?/importVendor" use:enhance class="sample-card">
          <input type="hidden" name="vendor" value={vendor.folder} />
          <button type="submit" class="sample-btn">
            <span class="sample-title">{vendor.name}</span>
            <span class="sample-sub">Vendor folder only</span>
          </button>
        </form>
      {/each}
    </div>

    <div class="danger-zone">
      <p class="danger-zone-label">Maintenance</p>
      <div class="actions">
        <form method="POST" action="?/clearData" use:enhance>
          <button type="submit" class="btn secondary">Clear imported data</button>
        </form>
        <button type="button" class="btn danger" onclick={() => (showResetConfirm = true)}>
          Reset everything
        </button>
        <form bind:this={wipeForm} method="POST" action="?/wipeDatabase" use:enhance class="sr-only">
          <button type="submit">Reset everything</button>
        </form>
      </div>
    </div>
  </section>

  {#if form?.error}
    <div class="toast error">
      <span class="toast-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </span>
      <span>{form.error}</span>
    </div>
  {/if}

  {#if form?.cleared && !showResetConfirm}
    <div class="toast success">
      <span class="toast-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m22 4-10 10-3-3" />
        </svg>
      </span>
      <span>
        Imported data cleared. Products, prices, sales, and stores removed. The three sample grocers remain for re-import.
      </span>
    </div>
  {/if}

  {#if form?.wiped && !showResetConfirm}
    <div class="toast success">
      <span class="toast-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m22 4-10 10-3-3" />
        </svg>
      </span>
      <span>Database reset. All tables are empty. Import sample files or upload CSVs to start again.</span>
    </div>
  {/if}

  {#if form?.summary}
    <section class="panel results">
      <div class="section-headline">
        <span class="section-icon tone-products" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="m22 4-10 10-3-3" />
          </svg>
        </span>
        <div>
          <h2>Import summary</h2>
          <p>
            {form.summary.fileCount} files · {form.summary.uniqueProducts} products ·
            {form.summary.inserted.prices} prices · {form.summary.inserted.sales} sales
            {#if form.summary.inserted.skipped > 0}
              · {form.summary.inserted.skipped} skipped
            {/if}
          </p>
        </div>
      </div>

      {#if form.result?.files.length}
        <ul class="file-results">
          {#each form.result.files as file}
            <li>
              <strong>{file.filename}</strong>
              <span class="muted">({file.fileKind})</span>
              inserted {file.inserted}, updated {file.updated}, skipped {file.skipped}
            </li>
          {/each}
        </ul>
      {/if}

      {#if form.summary.warnings.length > 0}
        <h3>Warnings ({form.summary.warningCount})</h3>
        <ul class="warnings">
          {#each form.summary.warnings as warning}
            <li>{warning}</li>
          {/each}
          {#if form.summary.warningCount > form.summary.warnings.length}
            <li>…and {form.summary.warningCount - form.summary.warnings.length} more</li>
          {/if}
        </ul>
      {/if}

      {#if form.result?.errors.length}
        <ul class="errors">
          {#each form.result.errors as error}
            <li>{error}</li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if qualityDetails}
    <DataQualityPanel details={qualityDetails} defaultOpen />
  {/if}

  <section class="panel counts">
    <div class="section-headline">
      <span class="section-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      </span>
      <div>
        <h2>Table counts</h2>
        <p>Live row counts across the SQLite schema.</p>
      </div>
    </div>
    <div class="stat-grid">
      {#each Object.entries(counts) as [table, count]}
        {@const meta = countMeta[table] ?? { label: table, tone: '' }}
        <div class="stat-card {meta.tone}">
          <div class="stat-card-top">
            <span class="stat-label">{meta.label}</span>
            <span class="stat-icon" aria-hidden="true">
              {#if table === 'grocers'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 7h18" />
                  <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
                  <path d="M5 7l1 14h12l1-14" />
                </svg>
              {:else if table === 'stores'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              {:else if table === 'products'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <path d="M3.3 7l8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
              {:else if table === 'prices'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <circle cx="7" cy="7" r="1.5" />
                </svg>
              {:else if table === 'sales'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h5" />
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </svg>
              {/if}
            </span>
          </div>
          <span class="stat-value">{count}</span>
        </div>
      {/each}
    </div>
  </section>
  </div>
</div>

<ConfirmModal
  bind:open={showResetConfirm}
  title="Reset everything?"
  message="This deletes all grocers, stores, products, prices, and sales. This cannot be undone."
  confirmLabel="Reset database"
  cancelLabel="Cancel"
  danger
  onConfirm={() => wipeForm?.requestSubmit()}
/>

<style>
  .panel {
    margin-bottom: 1.25rem;
    padding: 1.2rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-muted);
    box-shadow: var(--shadow-sm);
  }

  .upload-panel {
    border-color: var(--accent-muted);
    background:
      linear-gradient(135deg, rgba(227, 243, 234, 0.55) 0%, rgba(255, 255, 255, 0.9) 100%);
  }

  .samples-panel {
    background: linear-gradient(180deg, var(--surface-muted) 0%, var(--surface) 100%);
  }

  .panel h3 {
    margin: 0.85rem 0 0.35rem;
    font-size: 0.92rem;
  }

  .upload-form {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    max-width: 560px;
  }

  .dropzone {
    border: 2px dashed var(--accent-muted);
    border-radius: var(--radius-md);
    padding: 1.35rem 1rem 1.55rem;
    text-align: center;
    background: var(--surface);
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  .dropzone:hover,
  .dropzone.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .dropzone-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    margin-bottom: 0.55rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid var(--accent-muted);
    transition: transform 0.2s ease;
  }

  .dropzone.active .dropzone-icon {
    transform: scale(1.08);
  }

  .dropzone-icon svg {
    width: 1.35rem;
    height: 1.35rem;
  }

  .dropzone-title {
    margin: 0;
    font-weight: 700;
  }

  .dropzone-sub {
    margin: 0.35rem 0 0;
    font-size: 0.86rem;
    color: var(--muted);
  }

  .file-input-hidden {
    display: none;
  }

  .drop-message {
    margin: 0;
    font-size: 0.86rem;
    color: var(--danger);
  }

  .selected-files {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    overflow: hidden;
  }

  .selected-files li {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.8rem;
    font-size: 0.9rem;
    border-bottom: 1px solid var(--border);
  }

  .selected-files li:last-child {
    border-bottom: none;
  }

  .link-btn {
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 0.84rem;
    cursor: pointer;
    padding: 0;
  }

  .link-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .clear-btn {
    align-self: flex-start;
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

  select,
  input[type='text'] {
    padding: 0.58rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  select:hover,
  input[type='text']:hover {
    border-color: var(--border-strong);
  }

  .sample-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.65rem;
    margin-bottom: 1rem;
  }

  .sample-card {
    margin: 0;
  }

  .sample-btn {
    width: 100%;
    text-align: left;
    padding: 0.85rem 0.95rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    cursor: pointer;
    font: inherit;
    color: inherit;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  .sample-btn:hover {
    border-color: var(--accent-muted);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }

  .sample-card.featured .sample-btn {
    border-color: var(--accent-muted);
    background: linear-gradient(135deg, var(--accent-soft), var(--surface));
  }

  .sample-title {
    display: block;
    font-weight: 700;
    font-size: 0.92rem;
    color: var(--text);
  }

  .sample-sub {
    display: block;
    margin-top: 0.2rem;
    font-size: 0.78rem;
    color: var(--muted);
  }

  .danger-zone {
    padding-top: 0.85rem;
    border-top: 1px dashed var(--border-strong);
  }

  .danger-zone-label {
    margin: 0 0 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }

  .btn {
    border: none;
    border-radius: var(--radius-sm);
    padding: 0.58rem 1.05rem;
    background: var(--accent);
    color: #fff;
    font-weight: 700;
    cursor: pointer;
    align-self: flex-start;
    box-shadow: var(--shadow-sm);
    transition:
      background 0.15s ease,
      transform 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }

  .btn.secondary {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    box-shadow: none;
  }

  .btn.secondary:hover:not(:disabled) {
    background: var(--bg);
    transform: none;
  }

  .btn.danger {
    background: var(--danger);
    color: #fff;
  }

  .btn.danger:hover:not(:disabled) {
    background: #962018;
    transform: translateY(-1px);
  }

  .file-results,
  .warnings,
  .errors {
    margin: 0.5rem 0 0;
    padding-left: 1.1rem;
  }

  .muted {
    color: var(--muted);
  }

  .errors {
    color: var(--danger);
  }

  .results {
    background: var(--surface);
  }
</style>
