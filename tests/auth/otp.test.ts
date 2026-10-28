import { describe,it,expect } from 'vitest';
import { normalizePhone,generateOtpCode } from '@/lib/auth/otp';
describe('otp helpers',()=>{
 it('normalizes phone',()=>expect(normalizePhone(' 138 0013 8000 ')).toBe('13800138000'));
 it('six digits',()=>expect(generateOtpCode()).toMatch(/^\d{6}$/));
});
