import { supabase } from '@/integrations/supabase/client';

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
 * Count weekdays (Mon-Fri) in a given month, then subtract bank holidays.
 * @param claimMonth - ISO date string for the 1st of the month, e.g. '2026-04-01'
 * @param bankHolidayDates - array of ISO date strings of bank holidays already fetched
 */
export const getWorkingDaysInMonth = (claimMonth: string, bankHolidayDates: string[] = []): number => {
  const start = new Date(claimMonth);
  const year = start.getFullYear();
  const month = start.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let weekdays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d).getDay();
    if (day !== 0 && day !== 6) weekdays++;
  }

  // Subtract bank holidays that fall on a weekday in this month
  const bhInMonth = bankHolidayDates.filter(dateStr => {
    const bh = new Date(dateStr);
    return bh.getFullYear() === year && bh.getMonth() === month && bh.getDay() !== 0 && bh.getDay() !== 6;
  });

  return weekdays - bhInMonth.length;
};

/**
 * Get working weeks in a month (working days / 5).
 */
export const getWorkingWeeksInMonth = (claimMonth: string, bankHolidayDates: string[] = []): number => {
  return getWorkingDaysInMonth(claimMonth, bankHolidayDates) / 5;
};

/**
 * Fetch bank holiday dates from the database for a given year range.
 */
export const fetchBankHolidayDates = async (startYear?: number, endYear?: number): Promise<string[]> => {
  try {
    let query = (supabase as any)
      .from('bank_holidays_closed_days')
      .select('date')
      .eq('type', 'bank_holiday');

    if (startYear) {
      query = query.gte('date', `${startYear}-01-01`);
    }
    if (endYear) {
      query = query.lte('date', `${endYear}-12-31`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching bank holidays:', error);
      return [];
    }
    return (data || []).map((r: any) => r.date);
  } catch {
    return [];
  }
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
  
  const isOverdue = today > deadline;
  const daysRemaining = isOverdue
    ? -calculateWorkingDays(deadline, today)
    : calculateWorkingDays(today, deadline);
  
  return daysRemaining;
};
