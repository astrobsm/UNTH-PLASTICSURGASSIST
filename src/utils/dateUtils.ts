/**
 * Date utility functions for the Plastic Surgeon Assistant PWA
 */

/**
 * Calculate age in years from date of birth
 * @param dateOfBirth - Date of birth as Date object or string
 * @returns Age in years, or null if invalid date
 */
export function calculateAge(dateOfBirth: Date | string | null | undefined): number | null {
  if (!dateOfBirth) return null;

  try {
    const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    
    // Validate date
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year yet
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 0 ? age : null;
  } catch (error) {
    console.error('Error calculating age:', error);
    return null;
  }
}

/**
 * Format age for display
 * @param age - Age in years
 * @returns Formatted age string (e.g., "25y" or "N/A")
 */
export function formatAge(age: number | null): string {
  return age !== null && age >= 0 ? `${age}y` : 'N/A';
}

/**
 * Calculate age from date of birth and format for display
 * @param dateOfBirth - Date of birth as Date object or string
 * @returns Formatted age string (e.g., "25y" or "N/A")
 */
export function calculateAndFormatAge(dateOfBirth: Date | string | null | undefined): string {
  const age = calculateAge(dateOfBirth);
  return formatAge(age);
}

/**
 * Format date for display
 * @param date - Date object or string
 * @returns Formatted date string (e.g., "Jan 15, 2025")
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'N/A';
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'N/A';
  }
}

/**
 * Get patient age object from date of birth
 * Used for forms and calculations
 */
export function getPatientAgeData(dateOfBirth: Date | string | null | undefined) {
  const age = calculateAge(dateOfBirth);
  return {
    age: age || 0,
    ageFormatted: formatAge(age),
    isValid: age !== null && age >= 0
  };
}

/**
 * Calculate detailed age breakdown (years, months, days)
 * Useful for pediatric patients
 */
export function calculateDetailedAge(dateOfBirth: Date | string | null | undefined): {
  years: number;
  months: number;
  days: number;
  formatted: string;
  shortFormatted: string;
} | null {
  if (!dateOfBirth) return null;

  try {
    const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    
    // Validate date
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    // Adjust for negative days
    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }
    
    // Adjust for negative months
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years < 0) return null;

    // Format based on age
    let formatted: string;
    let shortFormatted: string;
    
    if (years === 0 && months === 0) {
      formatted = `${days} day${days !== 1 ? 's' : ''} old`;
      shortFormatted = `${days}d`;
    } else if (years === 0) {
      formatted = `${months} month${months !== 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''} old`;
      shortFormatted = `${months}m ${days}d`;
    } else if (years < 3) {
      formatted = `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''} old`;
      shortFormatted = `${years}y ${months}m`;
    } else {
      formatted = `${years} year${years !== 1 ? 's' : ''} old`;
      shortFormatted = `${years}y`;
    }

    return {
      years,
      months,
      days,
      formatted,
      shortFormatted
    };
  } catch (error) {
    console.error('Error calculating detailed age:', error);
    return null;
  }
}

/**
 * Check if patient is a pediatric patient (under 18)
 */
export function isPediatric(dateOfBirth: Date | string | null | undefined): boolean {
  const age = calculateAge(dateOfBirth);
  return age !== null && age < 18;
}

/**
 * Check if patient is an elderly patient (65 or older)
 */
export function isElderly(dateOfBirth: Date | string | null | undefined): boolean {
  const age = calculateAge(dateOfBirth);
  return age !== null && age >= 65;
}

/**
 * Get age category for clinical purposes
 */
export function getAgeCategory(dateOfBirth: Date | string | null | undefined): string {
  const age = calculateAge(dateOfBirth);
  if (age === null) return 'Unknown';
  
  if (age < 1) return 'Infant';
  if (age < 3) return 'Toddler';
  if (age < 12) return 'Child';
  if (age < 18) return 'Adolescent';
  if (age < 65) return 'Adult';
  if (age < 80) return 'Elderly';
  return 'Very Elderly';
}
