import { describe, expect, it } from 'vitest';
import { actions, load } from './+page.server';
import { addType, getTypeById } from '$lib/server/repos/types';
import { createRecord } from '$lib/server/repos/records';
import { typeFormRequest } from '../testEvent';

function event(id: string, form: Record<string, unknown> = {}) {
  return {
    request: typeFormRequest(form),
    url: new URL('http://localhost/'),
    params: { id },
    locals: { user: { id: 'u1' } },
  } as never;
}

function isRedirectTo(value: unknown, location: string) {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { status?: number }).status === 303 &&
    (value as { location?: string }).location === location
  );
}

function anonymousEvent(id: string) {
  return { ...(event(id) as object), locals: {} } as never;
}

describe('/types/[id] actions', () => {
  it('delete returns 404 when id does not exist', async () => {
    const result = await actions.delete(event('ghost'));
    expect((result as { status: number }).status).toBe(404);
  });

  it('delete soft-deletes an existing row then redirects to /types', async () => {
    const saved = await addType({ code: 'D1' });
    await expect(actions.delete(event(saved.id))).rejects.toSatisfy((e) =>
      isRedirectTo(e, '/types'),
    );
    expect((await getTypeById(saved.id))?.status).toBe('INACTIVE');
  });

  it('restore flips a soft-deleted row back to ACTIVE then redirects', async () => {
    const saved = await addType({ code: 'R1' });
    await expect(actions.delete(event(saved.id))).rejects.toSatisfy((e) =>
      isRedirectTo(e, '/types'),
    );
    await expect(actions.restore(event(saved.id))).rejects.toSatisfy((e) =>
      isRedirectTo(e, '/types'),
    );
    expect((await getTypeById(saved.id))?.status).toBe('ACTIVE');
  });

  it('restore returns 404 when id does not exist', async () => {
    const result = await actions.restore(event('ghost'));
    expect((result as { status: number }).status).toBe(404);
  });

  it('permanentlyDelete returns 404 when id does not exist', async () => {
    const result = await actions.permanentlyDelete(event('ghost'));
    expect((result as { status: number }).status).toBe(404);
  });

  it('permanentlyDelete returns 409 with record count when type still has records', async () => {
    const saved = await addType({ code: 'P1' });
    await createRecord({ typeId: saved.id, note: 'a' });
    await createRecord({ typeId: saved.id, note: 'b' });
    const result = await actions.permanentlyDelete(event(saved.id));
    expect((result as { status: number }).status).toBe(409);
    expect((result as { data: { recordCount: number } }).data.recordCount).toBe(2);
    expect(await getTypeById(saved.id)).not.toBeNull();
  });

  it('permanentlyDelete hard-deletes a type with no records then redirects', async () => {
    const saved = await addType({ code: 'P2' });
    await expect(actions.permanentlyDelete(event(saved.id))).rejects.toSatisfy((e) =>
      isRedirectTo(e, '/types'),
    );
    expect(await getTypeById(saved.id)).toBeNull();
  });

  it('save updates an existing type from the posted form then redirects', async () => {
    const saved = await addType({ code: 'S1' });
    const layout = { fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'note' }] };
    await expect(
      actions.save(event(saved.id, { code: 'S1B', color: '#22c55e', layout })),
    ).rejects.toSatisfy((e) => isRedirectTo(e, '/types'));
    const row = await getTypeById(saved.id);
    expect(row?.code).toBe('S1B');
    expect(row?.color).toBe('#22c55e');
    expect(row?.layout).toEqual(layout);
  });

  it('save 404s when the type does not exist', async () => {
    await expect(actions.save(event('ghost', { code: 'G' }))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('save returns a field error for a duplicate code', async () => {
    await addType({ code: 'TAKEN' });
    const saved = await addType({ code: 'S2' });
    const result = (await actions.save(event(saved.id, { code: 'TAKEN' }))) as {
      data: { form: { errors: { code?: string[] } } };
    };
    expect(result.data.form.errors.code?.length).toBeGreaterThan(0);
  });

  it('save rejects a layout whose writeTo does not fit its kind', async () => {
    const saved = await addType({ code: 'S3' });
    const layout = { fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'status' }] };
    const result = (await actions.save(event(saved.id, { code: 'S3', layout }))) as {
      status: number;
    };
    expect(result.status).toBe(400);
    expect((await getTypeById(saved.id))?.layout).toBeNull();
  });
});

describe('/types/[id] load', () => {
  it('provides per-column counts of records that hold data', async () => {
    const saved = await addType({ code: 'LOADC' });
    await createRecord({ typeId: saved.id, note: 'a' });
    await createRecord({ typeId: saved.id, note: 'b', title: 'T' });
    const data = (await (load as never as (e: unknown) => Promise<unknown>)(event(saved.id))) as {
      columnCounts: Record<string, number>;
    };
    expect(data.columnCounts.note).toBe(2);
    expect(data.columnCounts.title).toBe(1);
    expect(data.columnCounts.sum).toBe(0);
  });
});

describe('/types/[id] auth', () => {
  it('redirects unauthenticated callers to /login from load and every action', async () => {
    const saved = await addType({ code: 'AUTH1' });
    const calls = [
      () => (load as never as (e: unknown) => Promise<unknown>)(anonymousEvent(saved.id)),
      () => actions.save(anonymousEvent(saved.id)),
      () => actions.delete(anonymousEvent(saved.id)),
      () => actions.restore(anonymousEvent(saved.id)),
      () => actions.permanentlyDelete(anonymousEvent(saved.id)),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toSatisfy((e) => isRedirectTo(e, '/login'));
    }
    expect((await getTypeById(saved.id))?.status).toBe('ACTIVE');
  });
});
