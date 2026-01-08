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
