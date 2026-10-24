<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as m from '$lib/paraglide/messages.js';

  // History-driven modal: opened while page.state holds detail data, dismissed
  // by navigating back. Native <dialog> + DaisyUI, matching the app's modal
  // pattern (see types/TypeForm.svelte). `onclose` should pop the history entry.
  let { onclose, children }: { onclose: () => void; children: Snippet } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    const d = dialog;
    if (d && !d.open) d.showModal();
  });
</script>

<dialog bind:this={dialog} class="modal" {onclose}>
  <div class="modal-box flex max-h-[90vh] w-full max-w-4xl flex-col overflow-y-auto p-4 sm:p-6">
    {@render children()}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label={m.major_sleek_macaw_shine()}>{m.yummy_alive_termite_commend()}</button>
  </form>
</dialog>
