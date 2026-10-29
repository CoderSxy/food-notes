import { createAdminClient } from '@/lib/supabase/admin';
import { HttpError } from '@/lib/http';
export type Category = { id: string; name: string; parent_id: string | null };
export async function listRootCategories(): Promise<Category[]> {
  const { data, error } = await createAdminClient().from('categories').select('id,name,parent_id')
    .is('parent_id', null).order('created_at').order('slug');
  if (error) throw error;
  return data;
}
export async function listChildCategories(parentId: string): Promise<Category[]> {
  const { data, error } = await createAdminClient().from('categories').select('id,name,parent_id')
    .eq('parent_id', parentId).order('created_at').order('slug');
  if (error) throw error;
  return data;
}
export async function assertLeafCategoryIds(ids: string[]) {
  if (!ids.length) throw new HttpError('请至少选择一个物品小类');
  const { data, error } = await createAdminClient().from('categories').select('id,parent_id').in('id', ids);
  if (error) throw error;
  const leaves = new Set(data.filter(c => c.parent_id !== null).map(c => c.id));
  if (ids.some(id => !leaves.has(id))) throw new HttpError('请选择有效的物品小类，不能选择大类');
}
