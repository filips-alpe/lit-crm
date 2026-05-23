<script lang="ts">
  let { name }: { name?: string } = $props();
</script>

<svelte:head>
  <title>{name ? `${name} | LIT CRM` : 'LIT CRM'}</title>
</svelte:head>
