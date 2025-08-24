/**
 * Determines if a GP can initiate a drug based on traffic light status
 * Following Northamptonshire/NPAG guidelines
 */

export interface GPInitiationResult {
  canInitiate: 'Yes' | 'Yes – after specialist recommendation' | 'No' | 'No/Unknown – not assessed' | 'Unknown';
  description: string;
  statusUsed: string;
}

export function canGPInitiateDrug(
  statusEnum?: string | null,
  statusRaw?: string | null
): GPInitiationResult {
  
  const status = (statusEnum || '').toUpperCase();
  const raw = (statusRaw || '').toLowerCase();

  // Handle GREEN status with qualifiers
  if (status === 'GREEN') {
    if (raw.includes('(si)')) {
      return {
        canInitiate: 'No',
        description: 'Specialist must start (Green SI)',
        statusUsed: `${status} (SI)`
      };
    }
    if (raw.includes('(sr)')) {
      return {
        canInitiate: 'Yes – after specialist recommendation',
        description: 'GP can initiate after specialist recommendation',
        statusUsed: `${status} (SR)`
      };
    }
    return {
      canInitiate: 'Yes',
      description: 'Routine primary care',
      statusUsed: status
    };
  }

  // Handle AMBER_1 status with qualifiers
  if (status === 'AMBER_1' || status === 'AMBER1') {
    if (raw.includes('(si)')) {
      return {
        canInitiate: 'No',
        description: 'Specialist initiates; significant monitoring; follow shared care if exists',
        statusUsed: `${status} (SI)`
      };
    }
    if (raw.includes('(sr)')) {
      return {
        canInitiate: 'Yes – after specialist recommendation',
        description: 'GP can initiate after specialist recommendation; significant monitoring; follow shared care if exists',
        statusUsed: `${status} (SR)`
      };
    }
    // Default AMBER_1 without qualifier - treat as SI
    return {
      canInitiate: 'No',
      description: 'Specialist initiates; significant monitoring; follow shared care if exists',
      statusUsed: status
    };
  }

  // Handle AMBER_2 status with qualifiers
  if (status === 'AMBER_2' || status === 'AMBER2') {
    if (raw.includes('(si)')) {
      return {
        canInitiate: 'No',
        description: 'Specialist initiates; little/no GP monitoring',
        statusUsed: `${status} (SI)`
      };
    }
    if (raw.includes('(sr)')) {
      return {
        canInitiate: 'Yes – after specialist recommendation',
        description: 'GP can initiate after specialist recommendation; little/no GP monitoring',
        statusUsed: `${status} (SR)`
      };
    }
    // Default AMBER_2 without qualifier - treat as SI
    return {
      canInitiate: 'No',
      description: 'Specialist initiates; little/no GP monitoring',
      statusUsed: status
    };
  }

  // Handle RED status
  if (status === 'RED') {
    return {
      canInitiate: 'No',
      description: 'Secondary care only',
      statusUsed: status
    };
  }

  // Handle DOUBLE_RED status
  if (status === 'DOUBLE_RED' || status === 'DOUBLERED') {
    return {
      canInitiate: 'No',
      description: 'Not recommended / PA/IFR only as per ICB',
      statusUsed: status
    };
  }

  // Handle special commissioning routes
  if (raw.includes('blueteq') || raw.includes('specialised commissioning')) {
    return {
      canInitiate: 'No',
      description: 'Specialist commissioning route only',
      statusUsed: `${status} (${raw.includes('blueteq') ? 'Blueteq' : 'Specialised Commissioning'})`
    };
  }

  // Handle GREY status
  if (status === 'GREY' || status === 'GRAY') {
    return {
      canInitiate: 'No/Unknown – not assessed',
      description: 'Not assessed; avoid where possible',
      statusUsed: status
    };
  }

  // Handle SPECIALIST_INITIATED
  if (status === 'SPECIALIST_INITIATED') {
    return {
      canInitiate: 'No',
      description: 'Specialist must initiate',
      statusUsed: status
    };
  }

  // Handle SPECIALIST_RECOMMENDED
  if (status === 'SPECIALIST_RECOMMENDED') {
    return {
      canInitiate: 'Yes – after specialist recommendation',
      description: 'GP can initiate after specialist recommendation',
      statusUsed: status
    };
  }

  // Default case
  return {
    canInitiate: 'Unknown',
    description: 'Status not recognized in NPAG guidelines',
    statusUsed: status || 'Not provided'
  };
}

/**
 * Gets the display color for GP initiation status
 */
export function getGPInitiationColor(canInitiate: string): string {
  switch (canInitiate) {
    case 'Yes':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'Yes – after specialist recommendation':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'No':
    case 'No/Unknown – not assessed':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}