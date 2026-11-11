<script lang="ts">
  import { extensionShell } from '$extensions/shell';
  import type { PageData } from './$types';
  import LoginPicker from './LoginPicker.svelte';

  let { data }: { data: PageData } = $props();

  // An extension's shell may replace the user picker.
  const Login = extensionShell.Login;
</script>

{#if Login}
  <Login {data} />
{:else}
  <LoginPicker {data} />
{/if}
