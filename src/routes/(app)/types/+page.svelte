<script lang="ts">
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import { formatDate } from '$lib/utils/formatDate';
  import AlertIcon from './AlertIcon.svelte';
  import type { ActionData, PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data, form }: { data: PageData; form?: ActionData } = $props();

  // One shared confirm dialog: the row's delete button picks what it applies to.
  let confirmDialog = $state<HTMLDialogElement | null>(null);
  let pendingDelete = $state<{ id: string; code: string } | null>(null);

  function askDelete(row: { id: string; code: string }) {
    pendingDelete = { id: row.id, code: row.code };
    confirmDialog?.showModal();
  }
</script>

<svelte:head><title>{m.quiet_pink_parrot_clasp()}</title></svelte:head>

<h2 class="my-3 text-center text-lg font-semibold">{m.quiet_pink_parrot_clasp()}</h2>

<div class="mx-auto w-full max-w-[820px] px-3 sm:px-4">
  {#if form?.error}
    <div role="alert" class="mb-3 alert alert-error">
      <AlertIcon />
      <span>{form.error}</span>
    </div>
  {/if}

  <ul id="TypesList" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <li class="col-span-full">
      <a
        href={resolve('/(app)/types/new')}
        class="group/add relative flex h-full min-h-[108px] items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-stone-300 bg-white px-6 py-6 text-sm font-medium text-stone-700 transition-colors duration-300 hover:border-solid hover:border-emerald-300 hover:text-emerald-900"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-gradient-to-r from-emerald-50 via-emerald-100 to-emerald-50 transition-transform duration-500 ease-out group-hover/add:scale-x-100"
        ></span>
        <span
          aria-hidden="true"
          class="relative flex size-9 items-center justify-center rounded-full bg-emerald-100 text-base text-emerald-700 ring-1 ring-emerald-200 transition group-hover/add:bg-emerald-600 group-hover/add:text-white"
        >
          +
        </span>
        <span class="relative">{m.sour_gross_jellyfish_stab()}</span>
      </a>
    </li>

    {#each data.rows as row (row.id)}
      {@const deleted = row.status === 'INACTIVE'}
      <li class="relative">
        <a
          id={`type-${row.id}`}
          href={resolve('/(app)/types/[id]', { id: row.id })}
          class={[
            'flex h-full items-stretch overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-px hover:shadow-md',
            deleted ? 'border-stone-200 bg-white text-stone-400 line-through' : 'tinted-card',
          ]}
          style:--card-bg={deleted ? undefined : `${row.color}10`}
          style:--card-bg-hover={deleted ? undefined : `${row.color}22`}
          style:--card-border={deleted ? undefined : `${row.color}33`}
          style:--card-border-hover={deleted ? undefined : `${row.color}66`}
        >
          <div
            class="flex w-16 shrink-0 items-center justify-center self-stretch"
            style:background-color={row.color}
            style:opacity={deleted ? 0.4 : undefined}
          >
            <TypeBadge
              code={row.code}
              color={row.color}
              iconSeed={row.iconSeed}
              class="size-10 rounded-none"
            />
          </div>
          <div class="flex min-h-[64px] min-w-0 flex-1 flex-col justify-center px-4 py-3">
            <div class="flex items-center gap-2">
              <div class="truncate text-sm font-semibold">{row.code}</div>
              {#if deleted}
                <span class="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600"
                  >{m.long_direct_rook_grace()}</span
                >
              {/if}
            </div>
            {#if row.description}
              <div class="truncate text-xs text-stone-500">{row.description}</div>
            {/if}
            <div class="mt-0.5 pr-5 text-xs text-stone-500">
              {m.dirty_calm_firefox_taste({ date: formatDate(row.createdAt) })}
            </div>
          </div>
        </a>
        <!-- A sibling of the card link: a button may not nest inside an <a>. Deleted
             rows are restored or purged from their own page, so only active rows get it. -->
        {#if !deleted}
          <button
            type="button"
            class="btn absolute right-1.5 bottom-1.5 btn-square btn-ghost btn-xs btn-error"
            aria-label={m.warm_fluffy_lizard_inspire({ code: row.code })}
            title={m.warm_fluffy_lizard_inspire({ code: row.code })}
            onclick={() => askDelete(row)}
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-3.5"
            >
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
            </svg>
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  <form id="TypeRowDeleteForm" method="POST" action="?/delete" use:enhance>
    <input type="hidden" name="id" value={pendingDelete?.id ?? ''} />
  </form>
  <dialog
    bind:this={confirmDialog}
    class="modal"
    aria-labelledby="type-row-delete-title"
    aria-describedby="type-row-delete-body"
  >
    <div class="modal-box max-w-md">
      <h3 id="type-row-delete-title" class="text-base font-semibold">
        {m.dirty_trick_lynx_edit()}
      </h3>
      <p id="type-row-delete-body" class="mt-2 text-sm">
        {m.funny_nice_snake_ascend({ code: pendingDelete?.code ?? '' })}
      </p>
      <div class="modal-action">
        <button type="button" class="btn btn-ghost" onclick={() => confirmDialog?.close()}>
          {m.minor_basic_vulture_renew()}
        </button>
        <button
          type="submit"
          form="TypeRowDeleteForm"
          class="btn btn-error"
          onclick={() => confirmDialog?.close()}
        >
          {m.plane_small_ocelot_jest()}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button aria-label={m.major_sleek_macaw_shine()}>{m.yummy_alive_termite_commend()}</button>
    </form>
  </dialog>
</div>

<style>
  .tinted-card {
    background-color: var(--card-bg);
    border-color: var(--card-border);
  }
  .tinted-card:hover {
    background-color: var(--card-bg-hover);
    border-color: var(--card-border-hover);
  }
</style>
