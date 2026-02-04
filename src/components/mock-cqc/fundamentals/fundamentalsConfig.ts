// Fundamentals checklist configuration for Mock CQC Inspection walkthrough
// Each item has a 'tier' indicating which inspection types include it:
// - 'short': Priority items only (shown in Short, Mid, Long)
// - 'mid': Standard items (shown in Mid, Long)
// - 'long': Comprehensive items (shown in Long only)

export type InspectionType = 'short' | 'mid' | 'long';
export type ItemTier = 'short' | 'mid' | 'long';

export interface FundamentalItem {
  key: string;
  name: string;
  description: string;
  tier: ItemTier;
}

export interface FundamentalCategory {
  key: string;
  name: string;
  icon: string;
  color: string;
  items: FundamentalItem[];
}

// Helper to check if an item should be visible for a given inspection type
export const isItemVisibleForType = (itemTier: ItemTier, inspectionType: InspectionType): boolean => {
  if (inspectionType === 'long') return true;
  if (inspectionType === 'mid') return itemTier === 'short' || itemTier === 'mid';
  if (inspectionType === 'short') return itemTier === 'short';
  return true;
};

// Get items for a category filtered by inspection type
export const getVisibleItems = (category: FundamentalCategory, inspectionType: InspectionType): FundamentalItem[] => {
  return category.items.filter(item => isItemVisibleForType(item.tier, inspectionType));
};

export const FUNDAMENTALS_CATEGORIES: FundamentalCategory[] = [
  {
    key: 'fire_safety',
    name: 'Fire Safety',
    icon: 'flame',
    color: 'text-red-600',
    items: [
      { key: 'fire_risk_assessment', name: 'Fire Risk Assessment', description: 'Current fire risk assessment document, reviewed annually', tier: 'short' },
      { key: 'fire_extinguisher_service', name: 'Fire Extinguisher Servicing', description: 'Annual service certificates and monthly visual checks', tier: 'short' },
      { key: 'fire_alarm_testing', name: 'Fire Alarm Testing', description: 'Weekly fire alarm test log and annual service certificate', tier: 'short' },
      { key: 'emergency_lighting', name: 'Emergency Lighting', description: 'Monthly function tests and annual duration tests', tier: 'mid' },
      { key: 'fire_drill_records', name: 'Fire Drill Records', description: 'Six-monthly fire evacuation drills with documented outcomes', tier: 'mid' },
      { key: 'fire_escape_routes', name: 'Fire Escape Routes', description: 'Clear and unobstructed escape routes, signage visible', tier: 'long' },
    ]
  },
  {
    key: 'electrical_safety',
    name: 'Electrical Safety',
    icon: 'zap',
    color: 'text-yellow-600',
    items: [
      { key: 'pat_testing', name: 'PAT Testing', description: 'Portable Appliance Testing certificates (annual or as risk assessed)', tier: 'short' },
      { key: 'eicr_certificate', name: 'Fixed Wiring Inspection (EICR)', description: 'Electrical Installation Condition Report (5-yearly)', tier: 'mid' },
      { key: 'rcd_testing', name: 'RCD Testing', description: 'Residual Current Device quarterly testing logs', tier: 'long' },
    ]
  },
  {
    key: 'clinical_equipment',
    name: 'Clinical Equipment',
    icon: 'thermometer',
    color: 'text-blue-600',
    items: [
      { key: 'fridge_temp_logs', name: 'Fridge Temperature Logs', description: 'Daily min/max temperature records for vaccine/medication fridges', tier: 'short' },
      { key: 'equipment_calibration', name: 'Equipment Calibration', description: 'Calibration certificates for clinical equipment (BP monitors, scales, etc.)', tier: 'short' },
      { key: 'autoclave_logs', name: 'Autoclave/Sterilisation Logs', description: 'Daily cycle logs, weekly protein tests, annual validation', tier: 'mid' },
      { key: 'emergency_equipment', name: 'Emergency Equipment Checks', description: 'Defibrillator, oxygen, anaphylaxis kit regular checks', tier: 'short' },
      { key: 'medical_gas_checks', name: 'Medical Gas Safety', description: 'Oxygen cylinder storage and checks if applicable', tier: 'long' },
    ]
  },
  {
    key: 'water_environment',
    name: 'Water & Environment',
    icon: 'droplets',
    color: 'text-cyan-600',
    items: [
      { key: 'legionella_assessment', name: 'Legionella Risk Assessment', description: 'Current risk assessment and management plan', tier: 'short' },
      { key: 'water_temp_checks', name: 'Water Temperature Checks', description: 'Monthly hot (>50°C) and cold (<20°C) water temperature logs', tier: 'mid' },
      { key: 'clinical_waste_disposal', name: 'Clinical Waste Disposal', description: 'Waste transfer notes, segregation evidence, contractor details', tier: 'short' },
      { key: 'hazardous_waste', name: 'Hazardous Waste Records', description: 'COSHH assessments and safe storage evidence', tier: 'mid' },
      { key: 'air_conditioning', name: 'Air Conditioning/Ventilation', description: 'Service records for HVAC systems if present', tier: 'long' },
    ]
  },
  {
    key: 'staff_compliance',
    name: 'Staff Compliance',
    icon: 'users',
    color: 'text-purple-600',
    items: [
      { key: 'dbs_register', name: 'DBS Checks Register', description: 'Up-to-date DBS/disclosure register for all staff', tier: 'short' },
      { key: 'training_records', name: 'Staff Training Records', description: 'Training matrix showing mandatory training completion', tier: 'short' },
      { key: 'basic_life_support', name: 'Basic Life Support Training', description: 'Annual BLS/resuscitation training certificates', tier: 'short' },
      { key: 'safeguarding_training', name: 'Safeguarding Training', description: 'Adult and child safeguarding training evidence', tier: 'short' },
      { key: 'information_governance', name: 'Information Governance Training', description: 'Annual IG/data protection training completion', tier: 'mid' },
      { key: 'professional_registration', name: 'Professional Registration Checks', description: 'GMC, NMC, GPhC registration verification records', tier: 'mid' },
    ]
  },
  {
    key: 'infection_control',
    name: 'Infection Control',
    icon: 'shield',
    color: 'text-green-600',
    items: [
      { key: 'cleaning_schedules', name: 'Cleaning Schedules', description: 'Daily/weekly cleaning schedules with sign-off', tier: 'short' },
      { key: 'hand_hygiene_audits', name: 'Hand Hygiene Audits', description: 'Regular hand hygiene compliance audits', tier: 'mid' },
      { key: 'sharps_disposal', name: 'Sharps Disposal Logs', description: 'Sharps bin assembly dates and collection records', tier: 'mid' },
      { key: 'ppe_stock', name: 'PPE Stock & Checks', description: 'Adequate PPE supplies and expiry date checks', tier: 'mid' },
      { key: 'spillage_kits', name: 'Spillage Kits', description: 'Blood/bodily fluid spillage kits available and in-date', tier: 'long' },
      { key: 'infection_control_policy', name: 'Infection Control Policy', description: 'Current IPC policy accessible to all staff', tier: 'long' },
    ]
  },
  {
    key: 'general_premises',
    name: 'General Premises',
    icon: 'building',
    color: 'text-gray-600',
    items: [
      { key: 'first_aid_kits', name: 'First Aid Kits', description: 'Stocked and in-date first aid supplies', tier: 'mid' },
      { key: 'fire_exit_signage', name: 'Fire Exit Signage', description: 'Illuminated signs visible and working', tier: 'mid' },
      { key: 'hand_hygiene_signage', name: 'Hand Hygiene Signage', description: 'Appropriate signage at sinks and dispensers', tier: 'long' },
      { key: 'accessibility', name: 'Accessibility Checks', description: 'Wheelchair access, hearing loops, accessible toilets', tier: 'long' },
      { key: 'security_measures', name: 'Security Measures', description: 'Door locks, CCTV, panic alarms as appropriate', tier: 'long' },
      { key: 'asbestos_register', name: 'Asbestos Register', description: 'Asbestos survey and management plan if applicable', tier: 'long' },
      { key: 'gas_safety', name: 'Gas Safety Certificate', description: 'Annual gas safety inspection certificate', tier: 'mid' },
    ]
  }
];

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'verified': return 'bg-green-100 text-green-800 border-green-300';
    case 'issue_found': return 'bg-red-100 text-red-800 border-red-300';
    case 'not_applicable': return 'bg-gray-100 text-gray-600 border-gray-300';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case 'verified': return 'Verified';
    case 'issue_found': return 'Issue Found';
    case 'not_applicable': return 'N/A';
    default: return 'Not Checked';
  }
};

// Inspection type configuration
export const INSPECTION_TYPES = {
  short: {
    label: 'Short',
    duration: 'Up to 3 hours',
    description: 'Priority items only – fire safety essentials, key clinical checks, staff compliance basics',
    icon: 'zap',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800'
  },
  mid: {
    label: 'Standard',
    duration: '3-5 hours',
    description: 'Comprehensive coverage of all key compliance areas with moderate detail',
    icon: 'clipboard-check',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  long: {
    label: 'Full',
    duration: '5+ hours',
    description: 'Complete deep-dive covering every compliance element – ideal for annual reviews',
    icon: 'shield-check',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800'
  }
} as const;

// Count items by tier
export const getItemCountsByType = () => {
  let short = 0;
  let mid = 0;
  let long = 0;

  FUNDAMENTALS_CATEGORIES.forEach(cat => {
    cat.items.forEach(item => {
      if (item.tier === 'short') short++;
      else if (item.tier === 'mid') mid++;
      else long++;
    });
  });

  return {
    short,
    mid: short + mid,
    long: short + mid + long
  };
};
