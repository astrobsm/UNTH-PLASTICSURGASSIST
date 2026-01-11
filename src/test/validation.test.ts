import { describe, it, expect } from 'vitest';
import { 
  validateHospitalNumber, 
  validatePhoneNumber,
  validateEmail,
  validateAge,
  validatePassword
} from '../utils/validation';

describe('Validation Utilities', () => {
  describe('validateHospitalNumber', () => {
    it('should validate correct hospital number formats', () => {
      expect(validateHospitalNumber('UNTH/123456').isValid).toBe(true);
      expect(validateHospitalNumber('NCH/2024/001').isValid).toBe(true);
      expect(validateHospitalNumber('FMC/98765').isValid).toBe(true);
    });

    it('should reject invalid hospital number formats', () => {
      expect(validateHospitalNumber('123456').isValid).toBe(false);
      expect(validateHospitalNumber('UNTH-123456').isValid).toBe(false);
      expect(validateHospitalNumber('').isValid).toBe(false);
    });

    it('should provide error messages', () => {
      const result = validateHospitalNumber('invalid');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate Nigerian phone numbers', () => {
      expect(validatePhoneNumber('+2348012345678').isValid).toBe(true);
      expect(validatePhoneNumber('08012345678').isValid).toBe(true);
      expect(validatePhoneNumber('09012345678').isValid).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhoneNumber('1234567890').isValid).toBe(false);
      expect(validatePhoneNumber('+1234567890').isValid).toBe(false);
    });

    it('should allow empty phone numbers (optional field)', () => {
      expect(validatePhoneNumber('').isValid).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('user@example.com').isValid).toBe(true);
      expect(validateEmail('test.user@domain.co.uk').isValid).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid').isValid).toBe(false);
      expect(validateEmail('@example.com').isValid).toBe(false);
      expect(validateEmail('user@').isValid).toBe(false);
      expect(validateEmail('').isValid).toBe(false);
    });
  });

  describe('validateAge', () => {
    it('should validate reasonable ages', () => {
      expect(validateAge(25).isValid).toBe(true);
      expect(validateAge('30').isValid).toBe(true);
      expect(validateAge(0).isValid).toBe(true);
      expect(validateAge(150).isValid).toBe(true);
    });

    it('should reject invalid ages', () => {
      expect(validateAge(-1).isValid).toBe(false);
      expect(validateAge(151).isValid).toBe(false);
      expect(validateAge('abc').isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      expect(validatePassword('Password123').isValid).toBe(true);
      expect(validatePassword('Test1234').isValid).toBe(true);
      expect(validatePassword('MyP@ssw0rd').isValid).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('short').isValid).toBe(false);
      expect(validatePassword('alllowercase123').isValid).toBe(false);
      expect(validatePassword('ALLUPPERCASE123').isValid).toBe(false);
      expect(validatePassword('NoNumbers').isValid).toBe(false);
      expect(validatePassword('').isValid).toBe(false);
    });

    it('should provide specific error messages', () => {
      expect(validatePassword('short').error).toContain('8 characters');
      expect(validatePassword('alllower123').error).toContain('uppercase');
      expect(validatePassword('ALLUPPER123').error).toContain('lowercase');
      expect(validatePassword('NoNumbers').error).toContain('number');
    });
  });
});
