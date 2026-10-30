import { describe, expect, it } from 'vitest';
import { actions, load } from './+page.server';
import { addType } from '$lib/server/repos/types';
import { prisma } from '$lib/prisma';
import { typeFormRequest } from '../testEvent';

function postEvent(form: Record<string, unknown>, user: object | null = { id: 'u1' }) {
  return {
    request: typeFormRequest(form),
    url: new URL('http://localhost/'),
    params: {},
    locals: user ? { user } : {},
  } as never;
}

const validLayout = {
  fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'note' }],
};

function isRedirectTo(value: unknown, location: string) {
  const r = value as { status?: number; location?: string };
  return r.status === 303 && r.location === location;
}

describe('/types/new', () => {
  it('load seeds the starter layout and default color', async () => {
    const data = (await (load as never as (e: unknown) => Promise<unknown>)(postEvent({}))) as {
      form: { data: { color: string; layout: { fields: unknown[] } } };
    };
    expect(data.form.data.color).toBe('#3b82f6');
    expect(data.form.data.layout.fields.length).toBeGreaterThan(0);
  });

  it('save creates the type then redirects to /types', async () => {
    await expect(
      actions.save(postEvent({ code: 'NEWT', color: '#ef4444', layout: validLayout })),
    ).rejects.toSatisfy((e) => isRedirectTo(e, '/types'));
    const row = await prisma.type.findFirst({ where: { code: 'NEWT' } });
    expect(row?.color).toBe('#ef4444');
    expect(row?.layout).toEqual(validLayout);
  });

  it('save returns a code error for a duplicate code', async () => {
    await addType({ code: 'DUPE' });
    const result = (await actions.save(postEvent({ code: 'DUPE', layout: validLayout }))) as {
      data: { form: { errors: { code?: string[] } } };
    };
    expect(result.data.form.errors.code?.length).toBeGreaterThan(0);
  });

  it('save returns 400 for a missing code', async () => {
    const result = (await actions.save(postEvent({ code: '', layout: validLayout }))) as {
      status: number;
    };
    expect(result.status).toBe(400);
  });

  it('save rejects a layout with no fields', async () => {
    const result = (await actions.save(postEvent({ code: 'EMPTYL', layout: { fields: [] } }))) as {
      status: number;
    };
    expect(result.status).toBe(400);
    expect(await prisma.type.findFirst({ where: { code: 'EMPTYL' } })).toBeNull();
  });

  it('save rejects a layout whose writeTo is not a column of its kind', async () => {
    const layout = { fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'typeId' }] };
    const result = (await actions.save(postEvent({ code: 'CRAFTED', layout }))) as {
      status: number;
    };
    expect(result.status).toBe(400);
    expect(await prisma.type.findFirst({ where: { code: 'CRAFTED' } })).toBeNull();
  });

  it('load and save redirect unauthenticated callers to /login', async () => {
    await expect(
      (load as never as (e: unknown) => Promise<unknown>)(postEvent({}, null)),
    ).rejects.toSatisfy((e) => isRedirectTo(e, '/login'));
    await expect(
      actions.save(postEvent({ code: 'ANON', layout: validLayout }, null)),
    ).rejects.toSatisfy((e) => isRedirectTo(e, '/login'));
    expect(await prisma.type.findFirst({ where: { code: 'ANON' } })).toBeNull();
  });
});
