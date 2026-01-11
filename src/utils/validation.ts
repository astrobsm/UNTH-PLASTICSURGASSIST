/**
 * Input validation utilities for forms and user input
 * Prevents invalid data and potential security issues
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate hospital number format (e.g., UNTH/123456, NCH/2024/001)
 */
export function validateHospitalNumber(hospitalNumber: string): ValidationResult {
  if (!hospitalNumber || hospitalNumber.trim() === '') {
    return { isValid: false, error: 'Hospital number is required' };
  }

  // Format: 2-4 uppercase letters, slash, 4-6 digits (optionally with year)
  const regex = /^[A-Z]{2,4}\/(\d{4}\/)?(\d{4,6})$/;
  
  if (!regex.test(hospitalNumber.trim())) {
    return { 
      isValid: false, 
      error: 'Invalid hospital number format (e.g., UNTH/123456 or NCH/2024/001)' 
    };
  }

  return { isValid: true };
}

/**
 * Validate Nigerian phone number
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { isValid: true }; // Optional field
  }

  // Format: +234XXXXXXXXXX or 0XXXXXXXXXX
  const regex = /^(\+234|0)[7-9][0-1]\d{8}$/;
  
  if (!regex.test(phone.replace(/[\s-]/g, ''))) {
    return { 
      isValid: false, 
      error: 'Invalid phone number (use format: +2348012345678 or 08012345678)' 
    };
  }

  return { isValid: true };
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!regex.test(email.trim())) {
    return { isValid: false, error: 'Invalid email address' };
  }

  return { isValid: true };
}

/**
 * Validate date is not in the future (for birth dates, admission dates, etc.)
 */
export function validatePastDate(date: string, fieldName: string = 'Date'): ValidationResult {
  if (!date || date.trim() === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const inputDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today

  if (isNaN(inputDate.getTime())) {
    return { isValid: false, error: `Invalid ${fieldName.toLowerCase()}` };
  }

  if (inputDate > today) {
    return { isValid: false, error: `${fieldName} cannot be in the future` };
  }

  return { isValid: true };
}

/**
 * Validate date range (start must be before end)
 */
export function validateDateRange(
  startDate: string, 
  endDate: string, 
  startLabel: string = 'Start date',
  endLabel: string = 'End date'
): ValidationResult {
  if (!startDate || !endDate) {
    return { isValid: false, error: 'Both dates are required' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }

  if (start > end) {
    return { isValid: false, error: `${startLabel} must be before ${endLabel}` };
  }

  return { isValid: true };
}

/**
 * Validate age is reasonable (0-150 years)
 */
export function validateAge(age: number | string): ValidationResult {
  const ageNum = typeof age === 'string' ? parseInt(age, 10) : age;

  if (isNaN(ageNum)) {
    return { isValid: false, error: 'Age must be a number' };
  }

  if (ageNum < 0 || ageNum > 150) {
    return { isValid: false, error: 'Age must be between 0 and 150' };
  }

  return { isValid: true };
}

/**
 * Validate file upload (type and size)
 */
export function validateFile(
  file: File, 
  allowedTypes: string[], 
  maxSizeMB: number = 10
): ValidationResult {
  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  // Check file type
  const fileType = file.type;
  if (allowedTypes.length > 0 && !allowedTypes.includes(fileType)) {
    return { 
      isValid: false, 
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` 
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { 
      isValid: false, 
      error: `File too large. Maximum size: ${maxSizeMB}MB` 
    };
  }

  return { isValid: true };
}

/**
 * Validate required field (non-empty string)
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
}

/**
 * Validate number in range
 */
export function validateNumberRange(
  value: number | string, 
  min: number, 
  max: number, 
  fieldName: string
): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a number` };
  }

  if (num < min || num > max) {
    return { isValid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { isValid: true };
}

/**
 * Validate medication dosage
 */
export function validateDosage(dosage: string): ValidationResult {
  if (!dosage || dosage.trim() === '') {
    return { isValid: false, error: 'Dosage is required' };
  }

  // Should contain a number followed by a unit (e.g., 500mg, 10ml, 2 tablets)
  const regex = /^\d+(\.\d+)?\s*(mg|g|ml|mcg|units?|tablets?|capsules?|drops?|IU)$/i;
  
  if (!regex.test(dosage.trim())) {
    return { 
      isValid: false, 
      error: 'Invalid dosage format (e.g., 500mg, 10ml, 2 tablets)' 
    };
  }

  return { isValid: true };
}

/**
 * Sanitize string input (remove potentially dangerous characters)
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove HTML tags and scripts
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }

  return { isValid: true };
}
