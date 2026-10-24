import { describe, expect, it } from 'vitest';
import { defaults } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { InvalidDateError } from '$lib/server/repos/records';
import { applyInvalidDateError } from './relationErrors';

describe('applyInvalidDateError', () => {
  it('puts an InvalidDateError on the offending column and reports it handled', () => {
    const form = defaults(zod4(z.object({ date: z.string().default('') })));
    expect(applyInvalidDateError(form, new InvalidDateError('date', 'nope'))).toBe(true);
    expect(form.errors.date?.length).toBeGreaterThan(0);
    expect(form.valid).toBe(false);
  });

  it('leaves other errors for the caller to rethrow', () => {
    const form = defaults(zod4(z.object({ date: z.string().default('') })));
    expect(applyInvalidDateError(form, new Error('boom'))).toBe(false);
    expect(form.errors.date).toBeUndefined();
  });
});
