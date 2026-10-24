<script lang="ts">
  import type { Snippet } from 'svelte';
  import { resolve } from '$app/paths';
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import ProjectMultiselect from '$lib/components/ProjectMultiselect.svelte';
  import { formatDate } from '$lib/utils/formatDate';
  import type { RendererDetailProps } from '$lib/render/props';
  import * as m from '$lib/paraglide/messages.js';

  // Outer frame for an editable detail view. Owns the universal chrome — the
  // <form> wired to the save action, the type/creator/date header, the deleted
  // badge, and the Save footer — so each detail renderer only draws its
  // distinctive body (and any renderer-specific navigation) inside {@render children()}.
  let {
    sf,
    record,
    children,
  }: {
    sf: RendererDetailProps['sf'];
    record: RendererDetailProps['record'];
    children: Snippet;
  } = $props();

  // enhance is a stable action from the parent-created superForm.
  // svelte-ignore state_referenced_locally
  const { form: formData, enhance } = sf;
  const date = $derived(formatDate(record.createdAt));

  const selectedProjects = $derived(
    Array.isArray($formData.projectIds) ? ($formData.projectIds as string[]) : [],
  );
</script>

<form
  method="POST"
  action={`${resolve('/(app)/data/[id]', { id: record.id })}?/save`}
  use:enhance
  class="flex w-full flex-col gap-4"
>
  <header class="flex items-center gap-3 border-b border-stone-200 pb-3">
    <TypeBadge
      code={record.type.code}
      color={record.type.color}
      iconSeed={record.type.iconSeed}
      class="size-10 shrink-0 rounded-lg"
    />
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-sm font-semibold text-stone-800">{record.type.code}</span>
      {#if date}<span class="text-xs text-stone-500">{date}</span>{/if}
    </div>
    {#if record.status !== 'ACTIVE'}
      <span class="rounded bg-stone-200 px-1.5 py-0.5 text-xs text-stone-600"
        >{m.long_direct_rook_grace()}</span
      >
    {/if}
    {#if record.creator}
      <span title={record.creator.name} class="ml-auto shrink-0">
        <AvatarImage user={record.creator} class="size-9" />
      </span>
    {/if}
  </header>

  <ProjectMultiselect
    selected={selectedProjects}
    onChange={(ids) => (($formData.projectIds as unknown) = ids)}
  />

  {@render children()}

  <footer class="flex items-center justify-end gap-3 border-t border-stone-200 pt-3">
    <button
      type="submit"
      class="rounded bg-stone-700 px-4 py-1.5 text-sm text-white hover:bg-stone-800"
      >{m.lime_gross_mole_radiate()}</button
    >
  </footer>
</form>
