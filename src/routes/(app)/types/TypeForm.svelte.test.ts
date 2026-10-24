import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { defaults } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import TypeForm from './TypeForm.svelte';
import { typeSchema } from '$lib/schemas/types';

function build() {
  return defaults(
    {
      id: '',
      code: 'GEO',
      layout: {
        fields: [{ id: 'g', label: 'Where', kind: 'location' as const, writeTo: 'fromGeo' }],
      },
    },
    zod4(typeSchema),
  );
}

describe('TypeForm invalid default', () => {
  it('blocks saving with a visible error while a default does not fit its kind', async () => {
    render(TypeForm, { form: build(), mode: 'create' });
    const save = page.getByRole('button', { name: /save|create/i });
    await expect.element(save).toBeEnabled();

    await page.getByTestId('field-default-g').fill('not coordinates');
    await expect.element(save).toBeDisabled();
    // Both the per-field error and the save-bar notice are shown.
    expect(document.querySelectorAll('[role=alert]').length).toBeGreaterThanOrEqual(2);

    await page.getByTestId('field-default-g').fill('51.5,-0.1');
    await expect.element(save).toBeEnabled();
  });
});
