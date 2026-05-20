<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  let mx = $state('50%');
  let my = $state('50%');
  let hue = $state(0);

  function handleMouseMove(e: MouseEvent) {
    mx = `${e.clientX}px`;
    my = `${e.clientY}px`;
    hue = ((e.clientX + e.clientY * 0.6) / 3) % 360;
  }
</script>

<svelte:window onmousemove={handleMouseMove} />

<div
  style="--mx: {mx}; --my: {my}; --hue: {hue};"
  class="relative flex min-h-screen flex-col bg-base-200 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--color-base-content)_8%,transparent)_1px,transparent_0)] [background-size:22px_22px]"
>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,hsl(var(--hue)_70%_55%)_55%,transparent)_1.6px,transparent_0)] [mask-image:radial-gradient(circle_180px_at_var(--mx)_var(--my),black,transparent)] [background-size:22px_22px] [-webkit-mask-image:radial-gradient(circle_180px_at_var(--mx)_var(--my),black,transparent)]"
  ></div>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,hsl(var(--hue)_75%_55%)_70%,transparent)_2.4px,transparent_0)] [mask-image:radial-gradient(circle_110px_at_var(--mx)_var(--my),black,transparent)] [background-size:22px_22px] [-webkit-mask-image:radial-gradient(circle_110px_at_var(--mx)_var(--my),black,transparent)]"
  ></div>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,hsl(var(--hue)_80%_55%)_85%,transparent)_3.2px,transparent_0)] [mask-image:radial-gradient(circle_55px_at_var(--mx)_var(--my),black,transparent)] [background-size:22px_22px] [-webkit-mask-image:radial-gradient(circle_55px_at_var(--mx)_var(--my),black,transparent)]"
  ></div>

  <div class="relative flex flex-1 flex-col">
    {@render children()}
  </div>
</div>
