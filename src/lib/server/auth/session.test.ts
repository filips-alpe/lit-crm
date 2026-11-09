import { describe, expect, it } from 'vitest';
import { checkAuthSecret } from './session';

describe('AUTH_SECRET check', () => {
  it('refuses missing, short and placeholder values, including the one in .env.example', () => {
    expect(() => checkAuthSecret(undefined)).toThrow(/at least 16/);
    expect(() => checkAuthSecret('short')).toThrow(/at least 16/);
    expect(() => checkAuthSecret('change-me-to-a-long-random-string')).toThrow(/placeholder/);
    expect(() => checkAuthSecret('CHANGEME-CHANGEME-CHANGEME')).toThrow(/placeholder/);
    expect(() => checkAuthSecret('your_secret_goes_here_ok')).toThrow(/placeholder/);
  });
  it('accepts a random secret', () => {
    expect(checkAuthSecret('k3J9xQ0vZp7Lm2Rt8WcYb5Nd1HfGaUe4')).toBe(
      'k3J9xQ0vZp7Lm2Rt8WcYb5Nd1HfGaUe4',
    );
  });
});
