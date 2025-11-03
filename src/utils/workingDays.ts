/**
 * Calculate the number of working days between two dates (excluding weekends)
 */
export const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

/**
 * Add working days to a date (excluding weekends)
 */
export const addWorkingDays = (startDate: Date, daysToAdd: number): Date => {
  const result = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  return result;
};

/**
 * Calculate days remaining until the 20 working day deadline from a complaint's submitted date
 * Returns null if the complaint hasn't been submitted yet
 */
export const calculateDaysUntilDeadline = (submittedAt: string | null): number | null => {
  if (!submittedAt) return null;
  
  const submittedDate = new Date(submittedAt);
  const deadline = addWorkingDays(submittedDate, 20);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  
  const daysRemaining = calculateWorkingDays(today, deadline);
  
  return daysRemaining;
};
