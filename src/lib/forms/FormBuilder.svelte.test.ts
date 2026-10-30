import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import FormBuilderHarness from './FormBuilderHarness.svelte';
import type { FormLayout } from './layout';

const initial: FormLayout = {
  fields: [
    { id: 'n', label: 'Amount', kind: 'number', writeTo: 'sum' },
    { id: 't', label: 'Title', kind: 'text', writeTo: 'title' },
    { id: 'g', label: 'Where', kind: 'location', writeTo: 'fromGeo' },
  ],
};

const layoutOut = () =>
  JSON.parse(document.querySelector('[data-testid=layout]')!.textContent!) as FormLayout;
const bad = () => document.querySelector('[data-testid=bad]')!.textContent;

describe('FormBuilder required/default controls', () => {
  it('toggles required on a field', async () => {
    render(FormBuilderHarness, { initial });
    await page.getByTestId('field-required-t').click();
    expect(layoutOut().fields[1].required).toBe(true);
    await page.getByTestId('field-required-t').click();
    expect(layoutOut().fields[1].required).toBeFalsy();
  });

  it('stores a valid typed default', async () => {
    render(FormBuilderHarness, { initial });
    await page.getByTestId('field-default-n').fill('12.5');
    expect(layoutOut().fields[0].defaultValue).toBe(12.5);
    expect(bad()).toBe('false');
  });

  it('flags an invalid default: error shown, flag raised, last valid default kept', async () => {
    render(FormBuilderHarness, { initial });
    await page.getByTestId('field-default-g').fill('51.5,-0.1');
    await page.getByTestId('field-default-g').fill('abc');
    await expect.element(page.getByRole('alert')).toBeVisible();
    await expect
      .element(page.getByTestId('field-default-g'))
      .toHaveAttribute('aria-invalid', 'true');
    expect(bad()).toBe('true');
    // The layout never holds the invalid text.
    expect(layoutOut().fields[2].defaultValue).toBe('51.5,-0.1');
  });

  it('clears the flag once the default is fixed or emptied', async () => {
    render(FormBuilderHarness, { initial });
    await page.getByTestId('field-default-g').fill('abc');
    expect(bad()).toBe('true');
    await page.getByTestId('field-default-g').fill('1,2');
    expect(bad()).toBe('false');
    await page.getByTestId('field-default-g').fill('abc');
    await page.getByTestId('field-default-g').fill('');
    expect(bad()).toBe('false');
    expect(layoutOut().fields[2].defaultValue).toBeUndefined();
  });

  it('drops the flag when the field with the bad default is removed', async () => {
    render(FormBuilderHarness, { initial });
    await page.getByTestId('field-default-g').fill('nope');
    expect(bad()).toBe('true');
    await page
      .getByRole('button', { name: /remove|delete/i })
      .last()
      .click();
    expect(bad()).toBe('false');
  });
});
