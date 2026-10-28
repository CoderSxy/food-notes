import { beforeEach,describe,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:null as null|{userId:string;phone:string},getFood:vi.fn(),nearbyFoods:vi.fn(),admin:vi.fn(),chat:vi.fn()}));
vi.mock('@/lib/auth/requestUser',()=>({requireUser:async()=>{if(!mocks.user){const {HttpError}=await import('@/lib/http');throw new HttpError('请先登录',401);}return mocks.user;}}));
vi.mock('@/lib/foods',()=>({getFood:mocks.getFood,listFoods:vi.fn(),nearbyFoods:mocks.nearbyFoods}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:mocks.admin}));
vi.mock('@/lib/ai/client',()=>({chatCompletion:mocks.chat,buildMessages:vi.fn(),parseRecommendations:vi.fn()}));
import { POST as create } from '@/app/api/foods/route';
import { DELETE as remove } from '@/app/api/foods/[id]/route';
import { POST as recommend } from '@/app/api/recommend/route';
beforeEach(()=>{vi.clearAllMocks();mocks.user=null;});
const id='11111111-1111-4111-8111-111111111111';
describe('API permission boundary',()=>{
 it('rejects anonymous food creation before touching DB',async()=>{expect((await create(new Request('http://localhost/api/foods',{method:'POST',body:'{}'}))).status).toBe(401);expect(mocks.admin).not.toHaveBeenCalled();});
 it('rejects anonymous recommendation before DB or AI',async()=>{expect((await recommend(new Request('http://localhost/api/recommend',{method:'POST',body:'{}'}))).status).toBe(401);expect(mocks.nearbyFoods).not.toHaveBeenCalled();expect(mocks.chat).not.toHaveBeenCalled();});
 it('rejects deleting another user record',async()=>{mocks.user={userId:'me',phone:'13800138000'};mocks.getFood.mockResolvedValue({id,user_id:'someone-else'});expect((await remove(new Request(`http://localhost/api/foods/${id}`,{method:'DELETE'}),{params:Promise.resolve({id})})).status).toBe(403);expect(mocks.admin).not.toHaveBeenCalled();});
 it('returns empty nearby message without calling AI',async()=>{mocks.user={userId:'me',phone:'13800138000'};mocks.nearbyFoods.mockResolvedValue([]);const response=await recommend(new Request('http://localhost/api/recommend',{method:'POST',body:JSON.stringify({lat:31,lng:121})}));expect(response.status).toBe(200);expect(await response.json()).toEqual({recommendations:[],message:'附近暂无足够样本，先去登记几家美食吧'});expect(mocks.chat).not.toHaveBeenCalled();});
});
