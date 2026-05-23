<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';

  let { children } = $props();

  function isActive(href: string): boolean {
    return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
  }
</script>

<div class="app-shell">
  <header class="app-header">
    <div class="app-header-inner">
      <a class="brand" href="/">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6h15l-1.5 9h-12z" />
            <path d="M6 6 5 3H2" />
            <circle cx="9" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
          </svg>
        </span>
        <span class="brand-text">
          <span>Grocery Data</span>
          <small>CSV importer</small>
        </span>
      </a>
      <nav class="nav">
        <a href="/import" class:active={isActive('/import')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          Import
        </a>
        <a href="/view" class:active={isActive('/view')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M8 15h3" />
          </svg>
          View
        </a>
      </nav>
    </div>
  </header>
  <main class="app-main">
    {@render children()}
  </main>
</div>
