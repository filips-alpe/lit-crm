import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import RendererPicker from './RendererPicker.svelte';

const layout = {
  fields: [{ id: 'who', label: 'Who', kind: 'text' as const, writeTo: 'title' }],
};

function base(onChange: (id: string | null) => void, value: string | null = null) {
  return {
    value,
    onChange,
    layout,
    code: 'demo',
    color: '#445566',
    iconSeed: null,
    accent: '#445566',
  };
}

describe('RendererPicker', () => {
  it('renders a radio per renderer, with Default first', async () => {
    render(
      RendererPicker,
      base(() => {}),
    );
    await expect.element(page.getByRole('radio', { name: 'Default' })).toBeInTheDocument();
    await expect.element(page.getByRole('radio', { name: 'Headline' })).toBeInTheDocument();
    await expect.element(page.getByRole('radio', { name: 'Amount' })).toBeInTheDocument();
  });

  it('marks the current value as checked', async () => {
    render(
      RendererPicker,
      base(() => {}, 'amount'),
    );
    await expect
      .element(page.getByRole('radio', { name: 'Amount' }))
      .toHaveAttribute('aria-checked', 'true');
    await expect
      .element(page.getByRole('radio', { name: 'Default' }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the renderer id when a card is clicked', async () => {
    const onChange = vi.fn();
    render(RendererPicker, base(onChange));
    await page.getByRole('radio', { name: 'Letter', exact: true }).click();
    expect(onChange).toHaveBeenCalledWith('correspondence');
  });

  it('passes null when the Default card is chosen', async () => {
    const onChange = vi.fn();
    render(RendererPicker, base(onChange, 'amount'));
    await page.getByRole('radio', { name: 'Default' }).click();
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
