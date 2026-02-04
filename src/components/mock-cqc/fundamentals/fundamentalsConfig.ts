// Fundamentals checklist configuration for Mock CQC Inspection walkthrough

export interface FundamentalItem {
  key: string;
  name: string;
  description: string;
}

export interface FundamentalCategory {
  key: string;
  name: string;
  icon: string;
  color: string;
  items: FundamentalItem[];
}

export const FUNDAMENTALS_CATEGORIES: FundamentalCategory[] = [
  {
    key: 'fire_safety',
    name: 'Fire Safety',
    icon: 'flame',
    color: 'text-red-600',
    items: [
      { key: 'fire_risk_assessment', name: 'Fire Risk Assessment', description: 'Current fire risk assessment document, reviewed annually' },
      { key: 'fire_extinguisher_service', name: 'Fire Extinguisher Servicing', description: 'Annual service certificates and monthly visual checks' },
      { key: 'fire_alarm_testing', name: 'Fire Alarm Testing', description: 'Weekly fire alarm test log and annual service certificate' },
      { key: 'emergency_lighting', name: 'Emergency Lighting', description: 'Monthly function tests and annual duration tests' },
      { key: 'fire_drill_records', name: 'Fire Drill Records', description: 'Six-monthly fire evacuation drills with documented outcomes' },
      { key: 'fire_escape_routes', name: 'Fire Escape Routes', description: 'Clear and unobstructed escape routes, signage visible' },
    ]
  },
  {
    key: 'electrical_safety',
    name: 'Electrical Safety',
    icon: 'zap',
    color: 'text-yellow-600',
    items: [
      { key: 'pat_testing', name: 'PAT Testing', description: 'Portable Appliance Testing certificates (annual or as risk assessed)' },
      { key: 'eicr_certificate', name: 'Fixed Wiring Inspection (EICR)', description: 'Electrical Installation Condition Report (5-yearly)' },
      { key: 'rcd_testing', name: 'RCD Testing', description: 'Residual Current Device quarterly testing logs' },
    ]
  },
  {
    key: 'clinical_equipment',
    name: 'Clinical Equipment',
    icon: 'thermometer',
    color: 'text-blue-600',
    items: [
      { key: 'fridge_temp_logs', name: 'Fridge Temperature Logs', description: 'Daily min/max temperature records for vaccine/medication fridges' },
      { key: 'equipment_calibration', name: 'Equipment Calibration', description: 'Calibration certificates for clinical equipment (BP monitors, scales, etc.)' },
      { key: 'autoclave_logs', name: 'Autoclave/Sterilisation Logs', description: 'Daily cycle logs, weekly protein tests, annual validation' },
      { key: 'emergency_equipment', name: 'Emergency Equipment Checks', description: 'Defibrillator, oxygen, anaphylaxis kit regular checks' },
      { key: 'medical_gas_checks', name: 'Medical Gas Safety', description: 'Oxygen cylinder storage and checks if applicable' },
    ]
  },
  {
    key: 'water_environment',
    name: 'Water & Environment',
    icon: 'droplets',
    color: 'text-cyan-600',
    items: [
      { key: 'legionella_assessment', name: 'Legionella Risk Assessment', description: 'Current risk assessment and management plan' },
      { key: 'water_temp_checks', name: 'Water Temperature Checks', description: 'Monthly hot (>50°C) and cold (<20°C) water temperature logs' },
      { key: 'clinical_waste_disposal', name: 'Clinical Waste Disposal', description: 'Waste transfer notes, segregation evidence, contractor details' },
      { key: 'hazardous_waste', name: 'Hazardous Waste Records', description: 'COSHH assessments and safe storage evidence' },
      { key: 'air_conditioning', name: 'Air Conditioning/Ventilation', description: 'Service records for HVAC systems if present' },
    ]
  },
  {
    key: 'staff_compliance',
    name: 'Staff Compliance',
    icon: 'users',
    color: 'text-purple-600',
    items: [
      { key: 'dbs_register', name: 'DBS Checks Register', description: 'Up-to-date DBS/disclosure register for all staff' },
      { key: 'training_records', name: 'Staff Training Records', description: 'Training matrix showing mandatory training completion' },
      { key: 'basic_life_support', name: 'Basic Life Support Training', description: 'Annual BLS/resuscitation training certificates' },
      { key: 'safeguarding_training', name: 'Safeguarding Training', description: 'Adult and child safeguarding training evidence' },
      { key: 'information_governance', name: 'Information Governance Training', description: 'Annual IG/data protection training completion' },
      { key: 'professional_registration', name: 'Professional Registration Checks', description: 'GMC, NMC, GPhC registration verification records' },
    ]
  },
  {
    key: 'infection_control',
    name: 'Infection Control',
    icon: 'shield',
    color: 'text-green-600',
    items: [
      { key: 'cleaning_schedules', name: 'Cleaning Schedules', description: 'Daily/weekly cleaning schedules with sign-off' },
      { key: 'hand_hygiene_audits', name: 'Hand Hygiene Audits', description: 'Regular hand hygiene compliance audits' },
      { key: 'sharps_disposal', name: 'Sharps Disposal Logs', description: 'Sharps bin assembly dates and collection records' },
      { key: 'ppe_stock', name: 'PPE Stock & Checks', description: 'Adequate PPE supplies and expiry date checks' },
      { key: 'spillage_kits', name: 'Spillage Kits', description: 'Blood/bodily fluid spillage kits available and in-date' },
      { key: 'infection_control_policy', name: 'Infection Control Policy', description: 'Current IPC policy accessible to all staff' },
    ]
  },
  {
    key: 'general_premises',
    name: 'General Premises',
    icon: 'building',
    color: 'text-gray-600',
    items: [
      { key: 'first_aid_kits', name: 'First Aid Kits', description: 'Stocked and in-date first aid supplies' },
      { key: 'fire_exit_signage', name: 'Fire Exit Signage', description: 'Illuminated signs visible and working' },
      { key: 'hand_hygiene_signage', name: 'Hand Hygiene Signage', description: 'Appropriate signage at sinks and dispensers' },
      { key: 'accessibility', name: 'Accessibility Checks', description: 'Wheelchair access, hearing loops, accessible toilets' },
      { key: 'security_measures', name: 'Security Measures', description: 'Door locks, CCTV, panic alarms as appropriate' },
      { key: 'asbestos_register', name: 'Asbestos Register', description: 'Asbestos survey and management plan if applicable' },
      { key: 'gas_safety', name: 'Gas Safety Certificate', description: 'Annual gas safety inspection certificate' },
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
