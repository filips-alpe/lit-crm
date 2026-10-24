<script lang="ts">
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import AlertIcon from './AlertIcon.svelte';
  import * as m from '$lib/paraglide/messages.js';

  // Soft delete / restore / permanent delete for an existing type, each behind a
  // native confirm dialog. The names in the dialog use the saved code.
  let {
    typeId,
    savedCode,
    editingDeleted,
  }: { typeId?: string; savedCode: string; editingDeleted: boolean } = $props();

  let permaDeleteError = $state<string | null>(null);
  let permaDeleteCount = $state(0);
  let confirmDialog = $state<HTMLDialogElement | null>(null);
  let confirming = $state<'delete' | 'permanentlyDelete'>('delete');

  function askConfirm(kind: 'delete' | 'permanentlyDelete') {
    confirming = kind;
    confirmDialog?.showModal();
  }
</script>

<section class="card mt-8 border border-error/30 bg-error/5">
  <div class="card-body p-5 sm:p-6">
    <h2 class="card-title text-sm text-error">{m.merry_every_beaver_gulp()}</h2>
    <p class="text-xs text-error/80">
      {#if editingDeleted}
        {m.cozy_flat_crab_rush()}
      {:else}
        {m.mushy_muddy_monkey_grin()}
      {/if}
    </p>

    <div class="mt-2 card-actions">
      {#if !editingDeleted}
        <form id="TypeDeleteForm" method="POST" action="?/delete" use:enhance></form>
        <button
          type="button"
          class="btn btn-outline btn-sm btn-error"
          onclick={() => askConfirm('delete')}>{m.plane_small_ocelot_jest()}</button
        >
      {:else}
        <form method="POST" action="?/restore" use:enhance>
          <button type="submit" class="btn btn-outline btn-sm"
            >{m.busy_low_jellyfish_foster()}</button
          >
        </form>
        <form
          id="TypePermanentDeleteForm"
          method="POST"
          action="?/permanentlyDelete"
          use:enhance={() =>
            async ({ result, update }) => {
              if (result.type === 'failure') {
                const d = result.data as { error?: string; recordCount?: number } | undefined;
                permaDeleteError = d?.error ?? m.mild_jumpy_pig_persist();
                permaDeleteCount = d?.recordCount ?? 0;
                return;
              }
              await update();
            }}
        ></form>
        <button
          type="button"
          class="btn btn-sm btn-error"
          onclick={() => askConfirm('permanentlyDelete')}>{m.cool_candid_piranha_chop()}</button
        >
      {/if}
    </div>

    <dialog
      bind:this={confirmDialog}
      class="modal"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
    >
      <div class="modal-box max-w-md">
        <h3 id="confirm-dialog-title" class="text-base font-semibold">
          {m.dirty_trick_lynx_edit()}
        </h3>
        <p id="confirm-dialog-body" class="mt-2 text-sm">
          {confirming === 'delete'
            ? m.funny_nice_snake_ascend({ code: savedCode })
            : m.inner_late_earthworm_savor({ code: savedCode })}
        </p>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" onclick={() => confirmDialog?.close()}>
            {m.minor_basic_vulture_renew()}
          </button>
          <button
            type="submit"
            form={confirming === 'delete' ? 'TypeDeleteForm' : 'TypePermanentDeleteForm'}
            class="btn btn-error"
            onclick={() => confirmDialog?.close()}
          >
            {confirming === 'delete' ? m.plane_small_ocelot_jest() : m.cool_candid_piranha_chop()}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button aria-label={m.major_sleek_macaw_shine()}>{m.yummy_alive_termite_commend()}</button>
      </form>
    </dialog>

    {#if permaDeleteError}
      <div role="alert" class="mt-3 alert alert-error">
        <AlertIcon />
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{permaDeleteError}</span>
          {#if permaDeleteCount > 0 && typeId}
            <!-- href is resolve()-built but carries a query string, which the rule can't verify -->
            <!-- eslint-disable svelte/no-navigation-without-resolve -->
            <a
              href={resolve('/(app)/data') + `?type=${encodeURIComponent(typeId)}&deleted=1`}
              class="link whitespace-nowrap"
            >
              {m.candid_smug_cowfish_tickle({ count: permaDeleteCount })}
            </a>
            <!-- eslint-enable svelte/no-navigation-without-resolve -->
          {/if}
        </div>
      </div>
    {/if}
  </div>
</section>
