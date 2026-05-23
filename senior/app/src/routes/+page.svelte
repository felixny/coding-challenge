<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/import');
  });
</script>

<div class="page-card">
  <h1 class="page-title">Grocery Data</h1>
  <p class="page-desc">Redirecting to import…</p>
</div>
