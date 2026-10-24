import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { defaults } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import LoginPage from './+page.svelte';
import { loginSchema } from '$lib/schemas/login';

describe('login page', () => {
  it('names each user button concisely and keeps the avatar decorative', async () => {
    render(LoginPage, {
      data: {
        users: [
          { id: 'u1', username: 'ada', name: 'Ada Lovelace', color: '#336699', avatarSeed: null },
        ],
        form: defaults(zod4(loginSchema)),
      },
    } as never);
    const button = page.getByRole('button', { name: 'Log in as Ada Lovelace' });
    await expect.element(button).toBeInTheDocument();
    await expect.element(button).toHaveAttribute('name', 'username');
    await expect.element(button).toHaveAttribute('value', 'ada');
    expect(document.querySelector('button[name=username] img')?.getAttribute('alt')).toBe('');
  });
});
