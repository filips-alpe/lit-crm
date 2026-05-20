<script lang="ts">
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import * as m from '$lib/paraglide/messages.js';
  import { userSettingsSchema } from '$lib/schemas/userSettings';
  import { Control, Field, FieldErrors, Fieldset, Legend } from 'formsnap';
  import { untrack } from 'svelte';
  import { superForm } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const form = superForm(
    untrack(() => data.form),
    {
      validators: zod4Client(userSettingsSchema),
      dataType: 'json',
      invalidateAll: true,
      resetForm: false,
    },
  );
  const { form: formData, enhance, submit } = form;

  const COUNT = 40;
  function ensureInList(list: string[], element: string | null | undefined): string[] {
    if (!element || list.includes(element)) return list;
    return [element, ...list.slice(0, COUNT - 1)];
  }
  const initialSeeds = ensureInList(
    Array.from({ length: COUNT }, (_, i) => `s${String(i + 1).padStart(2, '0')}`),
    untrack(() => data.user.avatarSeed),
  );
  let seeds = $state<string[]>(initialSeeds);
  function shuffleSeeds() {
    seeds = ensureInList(
      Array.from({ length: COUNT }, () => Math.random().toString(36).slice(2, 10)),
      $formData.avatarSeed,
    );
  }

  const COLORS = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#d946ef',
    '#ec4899',
  ];

  const currentColor = $derived($formData.color.toLowerCase());
  const currentSeed = $derived($formData.avatarSeed ?? '');

  function pickColor(color: string) {
    $formData.color = color;
    submit();
  }

  function pickSeed(seed: string) {
    $formData.avatarSeed = seed;
    submit();
  }
</script>

<PageTitle name={m.tiny_due_hornet_trim()} />

<div class="mx-auto w-full max-w-4xl px-5 py-6">
  <header class="mb-6">
    <h1 class="text-2xl font-semibold">{m.tiny_due_hornet_trim()}</h1>
  </header>

  <form method="POST" use:enhance>
    <Fieldset {form} name="color" class="mb-8">
      <Legend class="mb-3 text-sm font-medium text-base-content/70">
        {m.bad_true_coyote_bless()}
      </Legend>
      <div class="flex flex-wrap gap-3">
        {#each COLORS as color (color)}
          {@const selected = color.toLowerCase() === currentColor}
          <button
            type="button"
            onclick={() => pickColor(color)}
            class="size-10 cursor-pointer rounded-full border-2 transition hover:scale-110 {selected
              ? 'border-primary ring-2 ring-primary/40'
              : 'border-base-300'}"
            style="background-color: {color}"
            title={color}
            aria-label={color}
          ></button>
        {/each}
        <label
          class="flex size-10 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-base-300 text-base-content/60 transition hover:border-primary hover:text-primary"
          title={m.spry_least_boar_view()}
        >
          <input
            type="color"
            value={$formData.color}
            class="sr-only"
            onchange={(e) => pickColor(e.currentTarget.value)}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path
              d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.8 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5-4.5-9-10-9z"
            />
          </svg>
        </label>
      </div>
      <FieldErrors class="mt-2 text-sm text-error" />
    </Fieldset>

    <Field {form} name="avatarSeed">
      <Control>
        {#snippet children({ props })}
          <div {...props}>
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-base-content/70">
                {m.jolly_livid_clownfish_commend()}
              </h3>
              <button
                type="button"
                onclick={shuffleSeeds}
                class="btn btn-square btn-ghost btn-sm"
                aria-label={m.cool_home_fox_dance()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
                  <path d="m18 2 4 4-4 4" />
                  <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
                  <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
                  <path d="m18 14 4 4-4 4" />
                </svg>
              </button>
            </div>
            <div class="grid grid-cols-4 gap-4 sm:grid-cols-5">
              {#each seeds as seed (seed)}
                {@const selected = seed === currentSeed}
                <button
                  type="button"
                  onclick={() => pickSeed(seed)}
                  class="flex w-full cursor-pointer flex-col items-center gap-1 rounded-box border-2 p-2 transition hover:bg-base-100 {selected
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent'}"
                  title={seed}
                >
                  <AvatarImage user={{ ...data.user, avatarSeed: seed }} class="size-24" />
                </button>
              {/each}
            </div>
          </div>
        {/snippet}
      </Control>
      <FieldErrors class="mt-2 text-sm text-error" />
    </Field>
  </form>
</div>
