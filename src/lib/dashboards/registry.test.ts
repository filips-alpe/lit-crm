import { describe, expect, it } from 'vitest';
import { dashboardFor } from './registry';
import FallbackDashboard from './FallbackDashboard.svelte';

describe('dashboard registry', () => {
  it('falls back for a user with no registered dashboard', () => {
    expect(dashboardFor('nobody')).toBe(FallbackDashboard);
  });
});
