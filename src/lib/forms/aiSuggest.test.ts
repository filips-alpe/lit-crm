import { afterEach, describe, expect, it, vi } from 'vitest';
import { suggestFields } from './aiSuggest';
import type { FormLayout } from './layout';

function mockLanguageModel(reply: string, availability = 'available') {
  const session = {
    prompt: vi.fn().mockResolvedValue(reply),
    destroy: vi.fn(),
  };
  (globalThis as unknown as { LanguageModel: unknown }).LanguageModel = {
    availability: vi.fn().mockResolvedValue(availability),
    create: vi.fn().mockResolvedValue(session),
  };
  return session;
}

afterEach(() => {
  delete (globalThis as unknown as { LanguageModel?: unknown }).LanguageModel;
});

describe('suggestFields label dedup against existing fields', () => {
  it('does not surface a default-padded suggestion whose humanized label matches an existing field', async () => {
    // `title` humanizes to "Title" — the same as the existing field's label,
    // so the pad entry for that column must be dropped.
    const layout: FormLayout = {
      fields: [{ id: 'a', label: 'Title', kind: 'text', writeTo: 'note' }],
    };
    const result = await suggestFields(layout, {});
    const labels = result.map((s) => s.label.trim().toLowerCase());
    expect(labels).not.toContain('title');
  });

  it('matches existing labels case- and whitespace-insensitively', async () => {
    const layout: FormLayout = {
      fields: [{ id: 'a', label: '  title ', kind: 'text', writeTo: 'note' }],
    };
    const result = await suggestFields(layout, {});
    const labels = result.map((s) => s.label.trim().toLowerCase());
    expect(labels).not.toContain('title');
  });

  it('still returns other suggestions when the colliding default is removed', async () => {
    const layout: FormLayout = {
      fields: [{ id: 'a', label: 'Title', kind: 'text', writeTo: 'note' }],
    };
    const result = await suggestFields(layout, {});
    expect(result.length).toBeGreaterThan(0);
    // `title` is filtered out by the label collision; another text
    // column (e.g. `description`) should still show up via the pad.
    expect(result.some((s) => s.writeTo === 'description')).toBe(true);
  });

  it('surfaces a model-invented alternate label for a column whose default would collide', async () => {
    // Existing field "Title" on column `note` collides with the humanized
    // label for `title`. The model returns an alternate ("Implementation
    // memo") so the column still surfaces.
    mockLanguageModel(
      JSON.stringify([{ label: 'Implementation memo', kind: 'text', writeTo: 'title' }]),
    );
    const layout: FormLayout = {
      fields: [{ id: 'a', label: 'Title', kind: 'text', writeTo: 'note' }],
    };
    const result = await suggestFields(layout, { typeDescription: 'engagement' });
    const title = result.find((s) => s.writeTo === 'title');
    expect(title?.label).toBe('Implementation memo');
  });

  it('fires the model even when no type code or description is provided', async () => {
    const session = mockLanguageModel(
      JSON.stringify([{ label: 'Implementation memo', kind: 'text', writeTo: 'title' }]),
    );
    const layout: FormLayout = {
      fields: [{ id: 'a', label: 'Title', kind: 'text', writeTo: 'note' }],
    };
    await suggestFields(layout, {});
    expect(session.prompt).toHaveBeenCalled();
  });

  it('keeps an AI suggestion for a free column even when its label collides with an existing field', async () => {
    // The on-device model sometimes echoes the default label instead of
    // inventing an alternative. The column should still surface so the user
    // can rename it inline (FormBuilder flags the duplicate).
    mockLanguageModel(
      JSON.stringify([{ label: 'Description', kind: 'text', writeTo: 'description' }]),
    );
    const layout: FormLayout = {
      fields: [{ id: 'a', label: 'Description', kind: 'text', writeTo: 'note' }],
    };
    const result = await suggestFields(layout, { typeDescription: 'engagement' });
    expect(result.some((s) => s.writeTo === 'description')).toBe(true);
  });

  it('surfaces every AI-returned column even when two entries share a label', async () => {
    // The on-device model occasionally repeats a label across two entries
    // whose default humanized names happen to match the repeated label —
    // previously the second column was dropped entirely. It must still surface
    // (with a suffixed label) so FormBuilder's duplicate-label indicator flags
    // it for the user.
    mockLanguageModel(
      JSON.stringify([
        { label: 'Marker', kind: 'text', writeTo: 'title' },
        { label: 'Marker', kind: 'text', writeTo: 'description' },
      ]),
    );
    const layout: FormLayout = {
      fields: [{ id: 'a', label: 'Untitled', kind: 'text', writeTo: 'note' }],
    };
    const result = await suggestFields(layout, { typeDescription: 'engagement' });
    expect(result.some((s) => s.writeTo === 'title')).toBe(true);
    expect(result.some((s) => s.writeTo === 'description')).toBe(true);
  });

  it('dedupes suggestions that share a label among themselves', async () => {
    // With type description "note", the heuristic rule emits a Footnote entry on
    // writeTo='description'. Default padding would otherwise emit the same label
    // on the same column — and even after that, no other source should be
    // allowed to add a second "Footnote".
    const layout: FormLayout = {
      fields: [{ id: 'a', label: 'Untitled', kind: 'text', writeTo: 'note' }],
    };
    const result = await suggestFields(layout, { typeDescription: 'note' });
    const footnoteHits = result.filter((s) => s.label.trim().toLowerCase() === 'footnote');
    expect(footnoteHits.length).toBeLessThanOrEqual(1);
  });
});

describe('suggestFields heuristics and model gating', () => {
  const layout: FormLayout = {
    fields: [{ id: 'a', label: 'Untitled', kind: 'text', writeTo: 'note' }],
  };

  it('matches whole keywords, not substrings ("update" is not "date")', async () => {
    const hit = await suggestFields(layout, { typeCode: 'DEADLINE' });
    expect(hit[0].writeTo).toBe('date');
    const miss = await suggestFields(layout, { typeCode: 'UPDATE' });
    expect(miss[0].label).not.toBe('Date');
  });

  it('reads snake_case type codes as separate words', async () => {
    const result = await suggestFields(layout, { typeCode: 'trip_log' });
    expect(result.some((s) => s.writeTo === 'fromGeo')).toBe(true);
  });

  it('does not touch the model when it still has to be downloaded', async () => {
    const create = vi.fn();
    (globalThis as unknown as { LanguageModel: unknown }).LanguageModel = {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create,
    };
    await suggestFields(layout, { typeCode: 'trip' });
    expect(create).not.toHaveBeenCalled();
  });

  it('passes the abort signal to the model', async () => {
    const session = mockLanguageModel('[]');
    const controller = new AbortController();
    await suggestFields(layout, { typeCode: 'trip' }, controller.signal);
    const create = (
      globalThis as unknown as { LanguageModel: { create: ReturnType<typeof vi.fn> } }
    ).LanguageModel.create;
    expect(create.mock.calls[0][0].signal).toBe(controller.signal);
    expect(session.prompt.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
