import { BPReading } from '@/hooks/useBPCalculator';

export interface BPAverages {
  systolic: number;
  diastolic: number;
  pulse?: number;
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
  pulseMin?: number;
  pulseMax?: number;
}

export interface NHSCategory {
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  description: string;
  isUrgent?: boolean;
}

export interface NICEHomeBPAverage {
  systolic: number | null;
  diastolic: number | null;
  readingsUsed: number;
  message: string;
  isValid: boolean;
}

export interface BPTrends {
  systolicTrend: string;
  diastolicTrend: string;
  pulseTrend: string;
  patternFlags: string[];
}

export interface DataQuality {
  score: number;
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  reasons: string[];
}

export interface DateRange {
  start: string | null;
  end: string | null;
}

export interface QOFRelevance {
  meetsBPMonitoring: boolean;
  suitableForAnnualReview: boolean;
  monitorValidation: string;
}

export interface PosturalDrop {
  systolic: number;
  diastolic: number;
  isOrthostatic: boolean;
  message: string;
}

export interface SitStandAverages {
  sitting: BPAverages | null;
  standing: BPAverages | null;
  posturalDrop: PosturalDrop | null;
  sittingCount: number;
  standingCount: number;
  diaryEntryCount: number; // Unique date/time combinations (rows in the diary)
}

// Group readings by date
export const groupReadingsByDate = (readings: BPReading[]): Map<string, BPReading[]> => {
  const groups = new Map<string, BPReading[]>();
  
  readings.forEach(r => {
    const date = r.date || 'unknown';
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(r);
  });
  
  return groups;
};

// Parse date string (DD/MM/YYYY) to Date object
export const parseUKDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  // Try DD/MM/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Try YYYY-MM-DD format
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return null;
};

// Get readings sorted by date
export const getReadingsSortedByDate = (readings: BPReading[]): BPReading[] => {
  return [...readings].sort((a, b) => {
    const dateA = parseUKDate(a.date || '');
    const dateB = parseUKDate(b.date || '');
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  });
};

// Calculate NICE Home BP Average (NG136) - excludes Day 1
export const calculateNICEHomeBPAverage = (readings: BPReading[]): NICEHomeBPAverage => {
  const includedReadings = readings.filter(r => r.included);
  
  if (includedReadings.length === 0) {
    return {
      systolic: null,
      diastolic: null,
      readingsUsed: 0,
      message: 'No readings available',
      isValid: false
    };
  }
  
  // Get readings with valid dates
  const readingsWithDates = includedReadings.filter(r => r.date && parseUKDate(r.date));
  
  if (readingsWithDates.length === 0) {
    return {
      systolic: null,
      diastolic: null,
      readingsUsed: 0,
      message: 'No readings with valid dates for NICE calculation',
      isValid: false
    };
  }
  
  // Find Day 1 (earliest date)
  const sortedReadings = getReadingsSortedByDate(readingsWithDates);
  const day1Date = sortedReadings[0].date;
  
  // Exclude Day 1 readings
  const day2PlusReadings = sortedReadings.filter(r => r.date !== day1Date);
  
  if (day2PlusReadings.length < 4) {
    return {
      systolic: null,
      diastolic: null,
      readingsUsed: day2PlusReadings.length,
      message: `Not enough readings for NICE-compliant home BP average (need 4+, have ${day2PlusReadings.length} after excluding Day 1)`,
      isValid: false
    };
  }
  
  const avgSystolic = Math.round(
    day2PlusReadings.reduce((sum, r) => sum + r.systolic, 0) / day2PlusReadings.length
  );
  const avgDiastolic = Math.round(
    day2PlusReadings.reduce((sum, r) => sum + r.diastolic, 0) / day2PlusReadings.length
  );
  
  return {
    systolic: avgSystolic,
    diastolic: avgDiastolic,
    readingsUsed: day2PlusReadings.length,
    message: `Based on ${day2PlusReadings.length} readings from Day 2 onwards (Day 1 excluded per NICE NG136)`,
    isValid: true
  };
};

// Get NHS/NICE category for HOME BP readings
export const getNICEHomeBPCategory = (systolic: number, diastolic: number): NHSCategory => {
  // Severe hypertension check first
  if (systolic >= 180 || diastolic >= 120) {
    return {
      label: 'Severe Hypertension',
      color: 'red',
      description: 'Urgent clinical review recommended',
      isUrgent: true
    };
  }
  
  // Stage 2 Hypertension (Home BP ≥150/95)
  if (systolic >= 150 || diastolic >= 95) {
    return {
      label: 'Stage 2 Hypertension',
      color: 'red',
      description: 'High blood pressure - medical attention recommended'
    };
  }
  
  // Stage 1 Hypertension (Home BP 135-149/85-94)
  if ((systolic >= 135 && systolic < 150) || (diastolic >= 85 && diastolic < 95)) {
    return {
      label: 'Stage 1 Hypertension',
      color: 'orange',
      description: 'Elevated blood pressure - lifestyle changes recommended'
    };
  }
  
  // Normal (Home BP <135/85)
  return {
    label: 'Normal',
    color: 'green',
    description: 'Blood pressure within normal home monitoring range'
  };
};

// Calculate trends
export const calculateTrends = (readings: BPReading[]): BPTrends => {
  const includedReadings = readings.filter(r => r.included);
  const sortedReadings = getReadingsSortedByDate(includedReadings);
  
  // Generate trend strings
  const systolicValues = sortedReadings.map(r => r.systolic);
  const diastolicValues = sortedReadings.map(r => r.diastolic);
  const pulseValues = sortedReadings.filter(r => r.pulse).map(r => r.pulse!);
  
  const systolicTrend = systolicValues.length > 1 
    ? systolicValues.join(' → ') 
    : systolicValues[0]?.toString() || 'No data';
  const diastolicTrend = diastolicValues.length > 1 
    ? diastolicValues.join(' → ') 
    : diastolicValues[0]?.toString() || 'No data';
  const pulseTrend = pulseValues.length > 1 
    ? pulseValues.join(' → ') 
    : pulseValues[0]?.toString() || 'No data';
  
  // Detect pattern flags
  const patternFlags: string[] = [];
  
  // High variability (>20 mmHg systolic range)
  if (systolicValues.length > 1) {
    const systolicRange = Math.max(...systolicValues) - Math.min(...systolicValues);
    if (systolicRange > 20) {
      patternFlags.push(`High variability: ${systolicRange} mmHg systolic range`);
    }
  }
  
  // Morning hypertension detection (if we have time data)
  const morningReadings = sortedReadings.filter(r => {
    if (!r.time) return false;
    const hour = parseInt(r.time.split(':')[0]);
    return hour >= 6 && hour < 12;
  });
  if (morningReadings.length > 0) {
    const morningAvgSys = morningReadings.reduce((sum, r) => sum + r.systolic, 0) / morningReadings.length;
    const otherReadings = sortedReadings.filter(r => {
      if (!r.time) return true;
      const hour = parseInt(r.time.split(':')[0]);
      return hour < 6 || hour >= 12;
    });
    if (otherReadings.length > 0) {
      const otherAvgSys = otherReadings.reduce((sum, r) => sum + r.systolic, 0) / otherReadings.length;
      if (morningAvgSys > otherAvgSys + 10) {
        patternFlags.push('Morning hypertension detected');
      }
    }
  }
  
  // Missing pulses
  const missingPulses = includedReadings.filter(r => !r.pulse).length;
  if (missingPulses > 0 && missingPulses < includedReadings.length) {
    patternFlags.push(`${missingPulses} reading(s) missing pulse data`);
  }
  
  // Repeated identical readings (possible transcription error)
  const readingStrings = includedReadings.map(r => `${r.systolic}/${r.diastolic}`);
  const duplicates = readingStrings.filter((item, index) => readingStrings.indexOf(item) !== index);
  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)];
    patternFlags.push(`Repeated identical readings: ${uniqueDuplicates.join(', ')}`);
  }
  
  return {
    systolicTrend,
    diastolicTrend,
    pulseTrend,
    patternFlags
  };
};

// Calculate data quality score (0-5)
export const calculateDataQuality = (readings: BPReading[]): DataQuality => {
  const allReadings = readings;
  const includedReadings = readings.filter(r => r.included);
  const reasons: string[] = [];
  let score = 5;
  
  // 1. Percentage of valid readings
  if (allReadings.length > 0) {
    const validPercentage = (includedReadings.length / allReadings.length) * 100;
    if (validPercentage < 80) {
      score -= 1;
      reasons.push(`${(100 - validPercentage).toFixed(0)}% of readings excluded`);
    }
  }
  
  // 2. Minimum readings requirement
  if (includedReadings.length < 4) {
    score -= 1;
    reasons.push(`Only ${includedReadings.length} valid readings (recommend 4+)`);
  }
  
  // 3. Date coverage
  const readingsWithDates = includedReadings.filter(r => r.date && parseUKDate(r.date));
  if (readingsWithDates.length < includedReadings.length * 0.8) {
    score -= 0.5;
    reasons.push('Many readings missing date information');
  }
  
  // 4. Time spacing (check if readings are at least 1 hour apart when time is available)
  const readingsWithTimes = includedReadings.filter(r => r.time && r.date);
  if (readingsWithTimes.length >= 2) {
    let closeReadings = 0;
    for (let i = 1; i < readingsWithTimes.length; i++) {
      const prev = readingsWithTimes[i - 1];
      const curr = readingsWithTimes[i];
      if (prev.date === curr.date && prev.time && curr.time) {
        const prevMins = parseInt(prev.time.split(':')[0]) * 60 + parseInt(prev.time.split(':')[1]);
        const currMins = parseInt(curr.time.split(':')[0]) * 60 + parseInt(curr.time.split(':')[1]);
        if (Math.abs(currMins - prevMins) < 60) {
          closeReadings++;
        }
      }
    }
    if (closeReadings > 0) {
      score -= 0.5;
      reasons.push(`${closeReadings} reading(s) taken within 1 hour of another`);
    }
  }
  
  // 5. Pulse completeness
  const readingsWithPulse = includedReadings.filter(r => r.pulse);
  if (readingsWithPulse.length < includedReadings.length * 0.5) {
    score -= 0.5;
    reasons.push('Less than 50% of readings include pulse');
  }
  
  // 6. Consistency/variability check
  if (includedReadings.length > 1) {
    const systolicValues = includedReadings.map(r => r.systolic);
    const range = Math.max(...systolicValues) - Math.min(...systolicValues);
    if (range > 40) {
      score -= 0.5;
      reasons.push(`High variability: ${range} mmHg systolic range`);
    }
  }
  
  // Ensure score is within bounds
  score = Math.max(0, Math.min(5, score));
  score = Math.round(score * 2) / 2; // Round to nearest 0.5
  
  let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  if (score >= 4.5) rating = 'Excellent';
  else if (score >= 3.5) rating = 'Good';
  else if (score >= 2.5) rating = 'Fair';
  else rating = 'Poor';
  
  if (reasons.length === 0) {
    reasons.push('Good data quality with adequate readings and completeness');
  }
  
  return { score, rating, reasons };
};

// Get date range from readings
export const getDateRange = (readings: BPReading[]): DateRange => {
  const includedReadings = readings.filter(r => r.included && r.date);
  
  if (includedReadings.length === 0) {
    return { start: null, end: null };
  }
  
  const sortedReadings = getReadingsSortedByDate(includedReadings);
  
  return {
    start: sortedReadings[0]?.date || null,
    end: sortedReadings[sortedReadings.length - 1]?.date || null
  };
};

// Get QOF relevance
export const getQOFRelevance = (readings: BPReading[], niceAverage: NICEHomeBPAverage): QOFRelevance => {
  const includedReadings = readings.filter(r => r.included);
  
  return {
    meetsBPMonitoring: includedReadings.length >= 2 && niceAverage.isValid,
    suitableForAnnualReview: niceAverage.isValid && niceAverage.readingsUsed >= 4,
    monitorValidation: 'Unknown unless provided'
  };
};

// Get target BP based on NICE guidelines
export const getTargetBP = () => ({
  clinic: {
    general: '<140/90 mmHg',
    over80: '<150/90 mmHg',
    diabetes: '<140/90 mmHg'
  },
  home: {
    general: '<135/85 mmHg',
    over80: '<145/85 mmHg',
    diabetes: '<135/85 mmHg'
  }
});

// Get clinical considerations (non-directive)
export const getClinicalConsiderations = (category: NHSCategory): string[] => {
  const considerations: string[] = [];
  
  if (category.isUrgent) {
    considerations.push('Consider urgent clinical review');
    considerations.push('Consider secondary causes investigation');
  }
  
  if (category.label.includes('Stage 2')) {
    considerations.push('Consider reviewing antihypertensive therapy');
    considerations.push('Consider ABPM if diagnostic uncertainty');
  }
  
  if (category.label.includes('Stage 1')) {
    considerations.push('Consider lifestyle advice reinforcement');
    considerations.push('Consider cardiovascular risk assessment');
  }
  
  if (category.label === 'Normal') {
    considerations.push('Continue regular monitoring');
  }
  
  return considerations;
};

// Calculate averages for a subset of readings
const calculateSubsetAverages = (readings: BPReading[]): BPAverages | null => {
  if (readings.length === 0) return null;

  const systolicValues = readings.map(r => r.systolic);
  const diastolicValues = readings.map(r => r.diastolic);
  const pulseValues = readings.filter(r => r.pulse).map(r => r.pulse!);

  return {
    systolic: Math.round(systolicValues.reduce((a, b) => a + b, 0) / systolicValues.length),
    diastolic: Math.round(diastolicValues.reduce((a, b) => a + b, 0) / diastolicValues.length),
    pulse: pulseValues.length > 0 
      ? Math.round(pulseValues.reduce((a, b) => a + b, 0) / pulseValues.length)
      : undefined,
    systolicMin: Math.min(...systolicValues),
    systolicMax: Math.max(...systolicValues),
    diastolicMin: Math.min(...diastolicValues),
    diastolicMax: Math.max(...diastolicValues),
    pulseMin: pulseValues.length > 0 ? Math.min(...pulseValues) : undefined,
    pulseMax: pulseValues.length > 0 ? Math.max(...pulseValues) : undefined
  };
};

// Calculate sit/stand averages with postural drop
export const calculateSitStandAverages = (readings: BPReading[]): SitStandAverages => {
  const includedReadings = readings.filter(r => r.included);
  
  const sittingReadings = includedReadings.filter(r => r.position === 'sitting');
  const standingReadings = includedReadings.filter(r => r.position === 'standing');
  
  const sitting = calculateSubsetAverages(sittingReadings);
  const standing = calculateSubsetAverages(standingReadings);
  
  // Calculate diary entry count (unique date/time combinations)
  // Each diary row typically has both a sitting and standing reading
  const diaryEntryCount = Math.max(sittingReadings.length, standingReadings.length);
  
  let posturalDrop: PosturalDrop | null = null;
  
  if (sitting && standing) {
    const systolicDrop = standing.systolic - sitting.systolic;
    const diastolicDrop = standing.diastolic - sitting.diastolic;
    
    // Orthostatic hypotension: systolic drop ≥20 mmHg OR diastolic drop ≥10 mmHg
    const isOrthostatic = systolicDrop <= -20 || diastolicDrop <= -10;
    
    let message: string;
    if (isOrthostatic) {
      if (systolicDrop <= -20 && diastolicDrop <= -10) {
        message = 'Significant systolic and diastolic drop detected - orthostatic hypotension criteria met';
      } else if (systolicDrop <= -20) {
        message = `Systolic drop of ${Math.abs(systolicDrop)} mmHg meets orthostatic hypotension criteria (≥20 mmHg)`;
      } else {
        message = `Diastolic drop of ${Math.abs(diastolicDrop)} mmHg meets orthostatic hypotension criteria (≥10 mmHg)`;
      }
    } else if (systolicDrop <= -15 || diastolicDrop <= -8) {
      message = 'Borderline postural drop - consider repeat testing';
    } else {
      message = 'No significant postural blood pressure drop detected';
    }
    
    posturalDrop = {
      systolic: systolicDrop,
      diastolic: diastolicDrop,
      isOrthostatic,
      message
    };
  }
  
  return { 
    sitting, 
    standing, 
    posturalDrop,
    sittingCount: sittingReadings.length,
    standingCount: standingReadings.length,
    diaryEntryCount
  };
};
