import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  user: null as null | { userId: string },
  get: vi.fn(),
  list: vi.fn(),
  page: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  nearby: vi.fn(),
  roots: vi.fn(),
  children: vi.fn(),
  admin: vi.fn(),
}));
vi.mock('@/lib/auth/requestUser', () => ({ requireUser: async () => { if (!mocks.user) { const { HttpError } = await import('@/lib/http'); throw new HttpError('请先登录', 401); } return mocks.user; } }));
vi.mock('@/lib/entries', () => ({
  getEntry: mocks.get,
  listEntries: mocks.list,
  listEntryPage: mocks.page,
  createEntry: mocks.create,
  updateEntry: mocks.update,
  nearbyPlaceEntries: mocks.nearby,
  isPlaceEntry: (e: { kind: string; lat: number | null; lng: number | null }) =>
    e.kind === 'place' && e.lat !== null && e.lng !== null,
}));
vi.mock('@/lib/categories', () => ({ listRootCategories: mocks.roots, listChildCategories: mocks.children }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }));
import { GET, POST } from '@/app/api/entries/route';
import { GET as detail, DELETE, PUT } from '@/app/api/entries/[id]/route';
import { GET as categories } from '@/app/api/categories/route';
import { GET as nearby } from '@/app/api/entries/nearby/route';
import { GET as oldDetail, DELETE as oldDelete } from '@/app/api/foods/[id]/route';
import { GET as oldList, POST as oldCreate } from '@/app/api/foods/route';
const id = '11111111-1111-4111-8111-111111111111';
const req = (path: string, body?: unknown) => new Request(`http://localhost/api/${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : undefined);
beforeEach(() => { vi.clearAllMocks(); mocks.user = null; });
describe('entries APIs', () => {
  it('requires auth for entries, categories, detail and nearby before DB', async () => {
    for (const response of [await GET(req('entries')), await POST(req('entries', {})), await categories(req('categories')), await detail(req(`entries/${id}`), { params: Promise.resolve({ id }) }), await DELETE(req(`entries/${id}`), { params: Promise.resolve({ id }) }), await nearby(req('entries/nearby?lat=31&lng=121'))]) expect(response.status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.roots).not.toHaveBeenCalled();
  });
  it('validates the kind filter and returns item records', async () => {
    mocks.user = { userId: 'u' }; mocks.page.mockResolvedValue({entries:[{id,kind:'item'}],total:1,page:1,pageSize:20});
    expect((await GET(req('entries?kind=nope'))).status).toBe(400);
    const response = await GET(req('entries?kind=item'));
    expect(await response.json()).toEqual({entries:[{id,kind:'item'}],total:1,page:1,pageSize:20});
    expect(mocks.page).toHaveBeenCalledWith('u',{scope:'mine',kind:'item',q:'',page:1,pageSize:20});
  });
  it('creates an item without coordinates', async () => {
    mocks.user = { userId: 'u' }; mocks.create.mockResolvedValue({ id, kind: 'item' });
    const response = await POST(req('entries', { kind: 'item', name: 'IPA', rating: 5, categoryIds: [id], tagNames: [] }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ entry: { id, kind: 'item' } });
    expect(mocks.create).toHaveBeenCalledWith('u', expect.objectContaining({ kind: 'item', categoryIds: [id] }));
  });
  it('rejects place creation without coordinates', async () => {
    mocks.user = { userId: 'u' };
    expect((await POST(req('entries', { kind: 'place', name: '面馆', rating: 4, cuisineIds: [], tagNames: [] }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('forbids deleting another user item', async () => {
    mocks.user = { userId: 'u' }; mocks.get.mockResolvedValue({ id, kind: 'item', user_id: 'other' });
    expect((await DELETE(req(`entries/${id}`), { params: Promise.resolve({ id }) })).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('validates category parent IDs and loads roots or children', async () => {
    mocks.user = { userId: 'u' }; mocks.roots.mockResolvedValue([]); mocks.children.mockResolvedValue([{ id, name: '啤酒' }]);
    expect((await categories(req('categories?parent_id=bad'))).status).toBe(400);
    expect(await (await categories(req('categories'))).json()).toEqual({ categories: [] });
    expect(await (await categories(req(`categories?parent_id=${id}`))).json()).toEqual({ categories: [{ id, name: '啤酒' }] });
    expect(mocks.children).toHaveBeenCalledWith(id);
  });
  it('legacy foods cannot read or delete an item ID', async () => {
    mocks.user = { userId: 'u' }; mocks.get.mockResolvedValue({ id, kind: 'item', user_id: 'u', lat: 31, lng: 121 });
    expect((await oldDetail(req(`foods/${id}`), { params: Promise.resolve({ id }) })).status).toBe(404);
    expect((await oldDelete(req(`foods/${id}`), { params: Promise.resolve({ id }) })).status).toBe(404);
    expect(mocks.get).toHaveBeenCalledWith(id, 'place');
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('legacy create accepts missing kind and uses the place schema', async () => {
    mocks.user = { userId: 'u' }; mocks.create.mockResolvedValue({ id, kind: 'place' });
    const response = await oldCreate(req('foods', { name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ food: { id, kind: 'place' } });
    expect(mocks.create).toHaveBeenCalledWith('u', expect.objectContaining({ kind: 'place' }));
  });
  it('nearby delegates only to the coordinate-bearing place query', async () => {
    mocks.user = { userId: 'u' }; mocks.nearby.mockResolvedValue([{ id, kind: 'place' }]);
    expect(await (await nearby(req('entries/nearby?lat=31&lng=121'))).json()).toEqual({ entries: [{ id, kind: 'place' }] });
    expect(mocks.nearby).toHaveBeenCalledWith({ lat: 31, lng: 121, radiusKm: 5 }, 5, undefined);
  });
  it('legacy foods list ignores item filters and creation rejects explicit items', async () => {
    mocks.user = { userId: 'u' }; mocks.list.mockResolvedValue([]);
    expect(await (await oldList(req('foods?kind=item'))).json()).toEqual({ foods: [] });
    expect(mocks.list).toHaveBeenCalledWith({ kind: 'place' }, 100);
    expect((await oldCreate(req('foods', { kind: 'item', name: 'IPA', rating: 5, lat: 31, lng: 121, cuisineIds: [], tagNames: [], categoryIds: [id] }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  const put = (body: unknown) =>
    new Request(`http://localhost/api/entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('requires auth for PUT before DB', async () => {
    expect((await PUT(put({ kind: 'place', name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }), { params: Promise.resolve({ id }) })).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('forbids editing another user entry', async () => {
    mocks.user = { userId: 'u' };
    mocks.get.mockResolvedValue({ id, kind: 'place', user_id: 'other' });
    expect((await PUT(put({ kind: 'place', name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }), { params: Promise.resolve({ id }) })).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the entry is missing', async () => {
    mocks.user = { userId: 'u' };
    mocks.get.mockResolvedValue(null);
    expect((await PUT(put({ kind: 'place', name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }), { params: Promise.resolve({ id }) })).status).toBe(404);
  });

  it('rejects a kind change with a Chinese 400', async () => {
    mocks.user = { userId: 'u' };
    mocks.get.mockResolvedValue({ id, kind: 'place', user_id: 'u' });
    const response = await PUT(
      put({ kind: 'item', name: 'IPA', rating: 5, categoryIds: [id], tagNames: [] }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '不能更改记录类型' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('fills omitted kind from the stored entry and updates', async () => {
    mocks.user = { userId: 'u' };
    mocks.get.mockResolvedValue({ id, kind: 'place', user_id: 'u' });
    mocks.update.mockResolvedValue({ id, kind: 'place', name: '新面馆' });
    const response = await PUT(
      put({ name: '新面馆', rating: 5, lat: 31, lng: 121, cuisineIds: [], tagNames: [] }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entry: { id, kind: 'place', name: '新面馆' } });
    expect(mocks.update).toHaveBeenCalledWith(
      'u',
      id,
      expect.objectContaining({ kind: 'place', name: '新面馆', rating: 5 }),
    );
  });
});
