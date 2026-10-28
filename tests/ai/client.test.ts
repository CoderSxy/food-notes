import { describe,it,expect,vi,afterEach,beforeEach } from 'vitest';
import { chatCompletion,parseRecommendations,buildMessages } from '@/lib/ai/client';
const candidate={id:'food-1',name:'小笼包',rating:5,lat:31,lng:121,user_id:'u',note:'好吃',address_text:null,created_at:'',cuisines:[],tags:[],distanceKm:1};
beforeEach(()=>{vi.stubEnv('AI_BASE_URL','https://example.com/v1/');vi.stubEnv('AI_API_KEY','test-key');vi.stubEnv('AI_MODEL','deepseek-v4.1-flash');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','anon');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','service');vi.stubEnv('SESSION_SECRET','x'.repeat(32));});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('AI client',()=>{
 it('returns content and sends server-side config',async()=>{const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:'hello'}}]})});vi.stubGlobal('fetch',fetch);await expect(chatCompletion([{role:'user',content:'hi'}])).resolves.toBe('hello');expect(fetch).toHaveBeenCalledWith('https://example.com/v1/chat/completions',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer test-key'}),body:expect.stringContaining('deepseek-v4.1-flash')}));});
 it('rejects missing key clearly',async()=>{vi.stubEnv('AI_API_KEY','');await expect(chatCompletion([])).rejects.toThrow('AI 服务尚未配置密钥');});
 it('handles HTTP errors',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));await expect(chatCompletion([])).rejects.toThrow('AI 服务暂时不可用');});
 it('handles network timeout',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('timeout','TimeoutError')));await expect(chatCompletion([])).rejects.toThrow('AI 请求超时或网络异常');});
 it('rejects malformed responses',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({})}));await expect(chatCompletion([])).rejects.toThrow('AI 返回内容无法解析');});
 it('drops unknown IDs and duplicates',()=>expect(parseRecommendations('[{"foodId":"made-up","reason":"虚构"},{"foodId":"food-1","reason":"值得试试"},{"foodId":"food-1","reason":"重复"}]',[candidate])).toEqual([{foodId:'food-1',reason:'值得试试',food:candidate}]));
 it('rejects invalid JSON and shape',()=>{expect(()=>parseRecommendations('hello',[candidate])).toThrow();expect(()=>parseRecommendations('[{"foodId":"food-1"}]',[candidate])).toThrow();});
 it('provides coordinates and only candidate data',()=>{const m=buildMessages({lat:31,lng:121},[candidate]);expect(m[0].content).toContain('只能');expect(m[1].content).toContain('food-1');expect(m[1].content).toContain('31');});
});
