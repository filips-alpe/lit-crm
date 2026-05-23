<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { User } from '../../../generated/prisma/client';

  let {
    user,
    class: className = 'size-10',
  }: {
    user: Pick<User, 'username' | 'color' | 'avatarSeed'>;
    class?: string;
  } = $props();

  const hex = $derived(user.color.replace(/^#/, ''));
  const seed = $derived(user.avatarSeed ?? user.username);
  const src = $derived(
    `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}&hairColor=${hex}`,
  );
</script>

<div class="overflow-hidden rounded-full bg-base-200 {className}">
  <img {src} alt={m.big_mealy_gadfly_approve({ username: user.username })} />
</div>
