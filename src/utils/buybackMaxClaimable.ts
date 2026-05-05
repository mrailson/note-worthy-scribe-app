/**
 * Max Claimable calculation helpers for Buy-Back claims.
 * Used across Practice, Verifier, and PML dashboards to show
 * how invoice totals are derived and whether they exceed limits.
 */

const MINUTES_PER_SESSION = 250; // 4h 10m

/** Format locum hours from sessions */
export function formatLocumHours(sessions: number) {
  const totalMins = Math.round(sessions * MINUTES_PER_SESSION);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return { display: m > 0 ? `${h}h ${m}m` : `${h}h`, decimal: (totalMins / 60).toFixed(1) };
}

export interface MaxClaimableInfo {
  maxAmount: number;
  formula: string;
}

/**
 * Derive the max claimable amount and a human-readable formula string
 * for a single staff detail line.
 */
export function formatMaxClaimableInfo(staff: any): MaxClaimableInfo {
  const category = staff.staff_category || 'buyback';
  const allocType = staff.allocation_type || '';
  const allocValue = staff.allocation_value ?? 0;
  const calculatedAmount = staff.calculated_amount ?? 0;
  const rate = staff.hourly_rate ?? 0;

  if (category === 'gp_locum') {
    if (allocType === 'daily') {
      return {
        maxAmount: calculatedAmount || allocValue * 750,
        formula: `${allocValue} day${allocValue !== 1 ? 's' : ''} × £750 = £${(calculatedAmount || allocValue * 750).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      };
    }
    // sessions (default for locum) — display as hours if practice entered in hours
    const sessionMax = calculatedAmount || allocValue * 375;
    if (staff.entry_unit === 'hours') {
      const hrs = staff.entered_value ?? (allocValue * (25 / 6));
      const hourlyRate = sessionMax / Math.max(allocValue, 0.0001) / (25 / 6);
      const totalMins = Math.round(hrs * 60);
      const hh = Math.floor(totalMins / 60);
      const mm = totalMins % 60;
      const hrsLabel = hh && mm ? `${hh}h ${mm}m` : hh ? `${hh}h` : `${mm}m`;
      return {
        maxAmount: sessionMax,
        formula: `${hrsLabel} × £${hourlyRate.toLocaleString('en-GB', { minimumFractionDigits: 2 })}/hr = £${sessionMax.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      };
    }
    return {
      maxAmount: sessionMax,
      formula: `${allocValue} session${allocValue !== 1 ? 's' : ''} × £375 = £${sessionMax.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
    };
  }

  if (category === 'meeting') {
    const hrs = staff.total_hours ?? allocValue ?? 0;
    return {
      maxAmount: calculatedAmount || hrs * rate,
      formula: `${hrs} hr${hrs !== 1 ? 's' : ''} × £${rate}/hr = £${(calculatedAmount || hrs * rate).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
    };
  }

  if (category === 'management') {
    if (allocType === 'hours') {
      // hrs/wk × ~4.33 weeks × rate
      const weeks = 4.33;
      const max = calculatedAmount || allocValue * weeks * rate;
      return {
        maxAmount: max,
        formula: `${allocValue} hrs/wk × ${weeks} wks × £${rate}/hr = £${max.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      };
    }
    return {
      maxAmount: calculatedAmount,
      formula: `Max £${calculatedAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
    };
  }

  // Salaried / Buy-Back / New SDA — WTE-based
  if (allocType === 'wte' && calculatedAmount > 0) {
    return {
      maxAmount: calculatedAmount,
      formula: `${allocValue} WTE × on-costs = £${calculatedAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
    };
  }

  // Fallback
  return {
    maxAmount: calculatedAmount,
    formula: calculatedAmount > 0 ? `Max £${calculatedAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—',
  };
}

/** Check if a claimed amount exceeds the max */
export function isOverMax(claimedAmount: number, maxAmount: number): boolean {
  return maxAmount > 0 && claimedAmount > maxAmount;
}

/** Format GBP */
export function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Build a management claim calculation breakdown object.
 * Returns null if no management staff lines exist.
 */
export function getManagementBreakdown(staffLines: any[], holidayWeeksDeducted: number = 0): {
  rate: number;
  weeklyHours: number;
  rawWeeks: number;
  holidayWeeks: number;
  workingWeeks: number;
  total: number;
  staffName: string;
} | null {
  const mgmtLine = staffLines.find((s: any) => s.staff_category === 'management' || s.staff_role === 'NRES Management');
  if (!mgmtLine) return null;

  const rate = mgmtLine.hourly_rate ?? 0;
  const weeklyHours = mgmtLine.allocation_value ?? 0;
  const total = mgmtLine.calculated_amount ?? mgmtLine.claimed_amount ?? 0;

  // Reverse-derive raw weeks from the formula: total = rate × weeklyHours × workingWeeks
  let workingWeeks = 0;
  let rawWeeks = 0;
  if (rate > 0 && weeklyHours > 0) {
    workingWeeks = total / (rate * weeklyHours);
    rawWeeks = workingWeeks + holidayWeeksDeducted;
  }

  return {
    rate,
    weeklyHours,
    rawWeeks: Math.round(rawWeeks * 100) / 100,
    holidayWeeks: holidayWeeksDeducted,
    workingWeeks: Math.round(workingWeeks * 100) / 100,
    total,
    staffName: mgmtLine.staff_name || mgmtLine.name || 'Management',
  };
}
