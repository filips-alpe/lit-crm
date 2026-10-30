<script lang="ts">
  // Test harness: swaps the detail props in place, keyed on the record id the
  // way the data page's modal does, to prove nothing from the first record leaks.
  import RecordDetail from './RecordDetail.svelte';
  import type { ComponentProps } from 'svelte';

  let {
    first,
    second,
  }: { first: ComponentProps<typeof RecordDetail>; second: ComponentProps<typeof RecordDetail> } =
    $props();
  let showSecond = $state(false);
  const detail = $derived(showSecond ? second : first);
</script>

<button type="button" onclick={() => (showSecond = !showSecond)}>flip</button>
{#key detail.record.id}
  <RecordDetail {...detail} />
{/key}
