<script lang="ts">
  // Test harness: exposes the bound layout and the bad-default flag as text.
  import FormBuilder from './FormBuilder.svelte';
  import type { FormLayout } from './layout';

  let { initial }: { initial: FormLayout } = $props();
  // svelte-ignore state_referenced_locally
  let layout = $state(initial);
  let hasBadDefault = $state(false);
</script>

<FormBuilder bind:layout bind:hasBadDefault />
<output data-testid="layout">{JSON.stringify(layout)}</output>
<output data-testid="bad">{hasBadDefault}</output>
