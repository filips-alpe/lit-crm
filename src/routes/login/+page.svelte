<script lang="ts">
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import DotGridBackground from '$lib/components/DotGridBackground.svelte';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import * as m from '$lib/paraglide/messages.js';
  import { loginSchema } from '$lib/schemas/login';
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { superForm } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const form = superForm(
    untrack(() => data.form),
    {
      validators: zod4Client(loginSchema),
      dataType: 'json',
    },
  );
  const { form: formData, enhance, submit, errors } = form;
</script>

<PageTitle name={m.hour_true_thrush_loop()} />

<DotGridBackground>
  {#if $errors.username}
    <div class="mx-auto w-full max-w-md px-5 pt-6">
      <div role="alert" class="alert alert-soft alert-error">
        <span>{$errors.username}</span>
      </div>
    </div>
  {/if}

  <h1 class="px-5 pt-10 text-center text-3xl font-semibold tracking-tight sm:pt-14 sm:text-4xl">
    LIT CRM
  </h1>

  <div class="flex flex-1 items-center justify-center px-5 py-12">
    <form method="POST" use:enhance>
      <div
        role="radiogroup"
        aria-label={m.hour_true_thrush_loop()}
        class="flex max-w-6xl flex-wrap items-start justify-center gap-x-10 gap-y-12"
      >
        {#each data.users as user, i (user.id)}
          <label
            in:fade={{ duration: 300, delay: i * 60 }}
            class="flex w-36 cursor-pointer flex-col items-center sm:w-44"
          >
            <input
              type="radio"
              name="username"
              value={user.username}
              bind:group={$formData.username}
              onchange={() => submit()}
              class="peer sr-only"
            />
            <span
              class="flex size-32 items-center justify-center rounded-full shadow-sm ring-0 transition duration-200 peer-focus-visible:ring-4 hover:scale-105 hover:shadow-xl hover:ring-4 sm:size-40"
              style="background: color-mix(in oklab, {user.color} 22%, var(--color-base-100)); --tw-ring-color: {user.color};"
            >
              <span class="rounded-full bg-base-100 p-1">
                <AvatarImage {user} class="size-24 sm:size-32" />
              </span>
            </span>
            <span class="mt-4 text-center">
              <span class="block text-base font-semibold text-base-content">{user.name}</span>
              <span class="mt-0.5 block text-xs text-base-content/60">@{user.username}</span>
            </span>
          </label>
        {/each}
      </div>
    </form>
  </div>
</DotGridBackground>
