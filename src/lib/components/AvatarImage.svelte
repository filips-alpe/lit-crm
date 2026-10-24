<script lang="ts">
  import { avatarUrl } from '$lib/icons/avatar';
  import * as m from '$lib/paraglide/messages.js';
  import type { User } from '../../../generated/prisma/client';

  let {
    user,
    class: className = 'size-10',
    decorative = false,
  }: {
    user: Pick<User, 'username' | 'color' | 'avatarSeed'>;
    class?: string;
    /** The name is rendered next to the avatar, so the image carries no alt text. */
    decorative?: boolean;
  } = $props();

  const src = $derived(avatarUrl(user.avatarSeed ?? user.username, user.color));
</script>

<div class="overflow-hidden rounded-full bg-base-200 {className}">
  <img {src} alt={decorative ? '' : m.big_mealy_gadfly_approve({ username: user.username })} />
</div>
