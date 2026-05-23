<script lang="ts">
  import { resolve } from '$app/paths';
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import * as m from '$lib/paraglide/messages.js';
  import { getLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime';
  import type { User } from '../../../generated/prisma/client';

  let { user }: { user: User } = $props();

  const localeDisplay: Record<Locale, { flag: string; code: string }> = {
    en: { flag: '🇬🇧', code: 'EN' },
    lv: { flag: '🇱🇻', code: 'LV' },
  };
</script>

<header class="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur">
  <nav class="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-3">
    <a href={resolve('/')} class="text-lg font-semibold tracking-tight">LIT CRM</a>

    <div class="ml-auto flex items-center gap-3">
      <div class="dropdown dropdown-end">
        <button
          type="button"
          tabindex="0"
          aria-label={m.tough_flaky_crab_kiss()}
          aria-haspopup="menu"
          class="btn gap-2 btn-ghost btn-sm"
        >
          <span aria-hidden="true">{localeDisplay[getLocale()].flag}</span>
          <span>{localeDisplay[getLocale()].code}</span>
        </button>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <ul
          tabindex="0"
          class="dropdown-content menu z-40 mt-2 w-32 rounded-box bg-base-100 p-2 shadow"
        >
          {#each locales as locale (locale)}
            <li>
              <button
                type="button"
                class="flex items-center gap-2"
                aria-current={locale === getLocale() ? 'true' : undefined}
                onclick={() => setLocale(locale)}
              >
                <span aria-hidden="true">{localeDisplay[locale].flag}</span>
                <span>{localeDisplay[locale].code}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>

      <div class="dropdown dropdown-end">
        <button
          type="button"
          tabindex="0"
          aria-label={m.misty_bad_pelican_loop()}
          aria-haspopup="menu"
          class="flex items-center gap-2 rounded-full p-1 ring-2 ring-transparent transition hover:ring-primary"
        >
          <AvatarImage {user} class="size-9" />
          <span class="pr-2 text-sm font-medium">{user.username}</span>
        </button>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <ul
          tabindex="0"
          class="dropdown-content menu z-40 mt-2 min-w-30 rounded-box bg-base-100 p-2 shadow"
        >
          <li>
            <a href={resolve('/(app)/settings')}>
              {m.tiny_due_hornet_trim()}
            </a>
          </li>
          <li>
            <button type="submit" form="logout-form" class="w-full text-left">
              {m.white_zesty_tortoise_bloom()}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <form id="logout-form" action={resolve('/logout')} method="POST" hidden></form>
</header>
