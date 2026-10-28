import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const {from,results}=vi.hoisted(()=>({from:vi.fn(),results:[] as unknown[]}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from})}));
vi.mock('@/lib/env',()=>({getEnv:()=>({OTP_TEST_MODE:'true'})}));
import { createAndStoreOtp,verifyOtp } from '@/lib/auth/otp';
beforeEach(()=>{
 results.length=0;
 from.mockReset();
 from.mockImplementation(()=>{
 const result=results.shift();
 const chain:Record<string,unknown>={};
 for(const method of ['select','eq','gte','gt','is','order','limit','maybeSingle','single','update','insert','upsert'])chain[method]=vi.fn(()=>chain);
 chain.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve(result).then(resolve);
 return chain;
 });
});
afterEach(()=>vi.restoreAllMocks());
const row={id:'otp',code:'123456',expires_at:new Date(Date.now()+600000).toISOString()};
describe('OTP storage',()=>{
 it('stores test code and logs it only on the server',async()=>{results.push({data:[],error:null},{error:null});const log=vi.spyOn(console,'info').mockImplementation(()=>{});const otp=await createAndStoreOtp('138 0013 8000');expect(otp.code).toMatch(/^\d{6}$/);expect(log).toHaveBeenCalledWith(`[OTP_TEST] phone=13800138000 code=${otp.code}`);expect(from).toHaveBeenCalledWith('otp_codes');});
 it('does not log a code after a storage failure',async()=>{results.push({data:[],error:null},{error:new Error('database')});const log=vi.spyOn(console,'info').mockImplementation(()=>{});await expect(createAndStoreOtp('13800138000')).rejects.toThrow('database');expect(log).not.toHaveBeenCalled();});
 it('accepts correct code and consumes it before looking up user',async()=>{results.push({data:row,error:null},{data:[{id:'otp'}],error:null},{data:{id:'user'},error:null});await expect(verifyOtp('13800138000','123456')).resolves.toEqual({userId:'user'});expect(from.mock.calls.map(c=>c[0])).toEqual(['otp_codes','otp_codes','users']);});
 it('rejects wrong code',async()=>{results.push({data:row,error:null});await expect(verifyOtp('13800138000','000000')).rejects.toThrow('验证码错误');expect(from).toHaveBeenCalledTimes(1);});
 it('rejects expired code',async()=>{results.push({data:{...row,expires_at:new Date(Date.now()-1000).toISOString()},error:null});await expect(verifyOtp('13800138000','123456')).rejects.toThrow('验证码已过期');});
 it('rejects a concurrent consumption or reuse',async()=>{results.push({data:row,error:null},{data:[],error:null});await expect(verifyOtp('13800138000','123456')).rejects.toThrow('验证码已使用或过期');expect(from).not.toHaveBeenCalledWith('users');});
 it('propagates consumption failure',async()=>{results.push({data:row,error:null},{data:null,error:new Error('write failed')});await expect(verifyOtp('13800138000','123456')).rejects.toThrow('write failed');expect(from).not.toHaveBeenCalledWith('users');});
});
