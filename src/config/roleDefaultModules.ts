// Role-based default module access configuration
// These defaults are applied when a new user is created or when role changes

export interface ModuleAccess {
  meeting_notes_access: boolean;
  gp_scribe_access: boolean;
  complaints_manager_access: boolean;
  ai4gp_access: boolean;
  enhanced_access: boolean;
  cqc_compliance_access: boolean;
  shared_drive_access: boolean;
  mic_test_service_access: boolean;
  api_testing_service_access: boolean;
  translation_service_access: boolean;
  fridge_monitoring_access: boolean;
  cso_governance_access: boolean;
  lg_capture_access: boolean;
  bp_service_access: boolean;
}

export type UserRole = 'practice_user' | 'practice_manager' | 'pcn_manager' | 'system_admin' | 'gp' | 'nurse' | 'admin_staff' | 'icb_user';

// Module categories for organised display
export const moduleCategories = {
  core: {
    label: 'Core Features',
    description: 'Essential tools for day-to-day operations',
    modules: ['meeting_notes_access', 'shared_drive_access', 'translation_service_access']
  },
  clinical: {
    label: 'Clinical Tools',
    description: 'Tools for clinical staff and patient care',
    modules: ['gp_scribe_access', 'bp_service_access', 'ai4gp_access']
  },
  compliance: {
    label: 'Compliance & Governance',
    description: 'Regulatory and quality assurance tools',
    modules: ['complaints_manager_access', 'cqc_compliance_access', 'cso_governance_access']
  },
  practice: {
    label: 'Practice Management',
    description: 'Administrative and operational tools',
    modules: ['enhanced_access', 'fridge_monitoring_access', 'lg_capture_access']
  },
  developer: {
    label: 'Developer & Testing',
    description: 'Technical tools for system administrators',
    modules: ['mic_test_service_access', 'api_testing_service_access']
  }
} as const;

// Human-readable labels and descriptions for each module
export const moduleInfo: Record<keyof ModuleAccess, { label: string; description: string }> = {
  meeting_notes_access: {
    label: 'Meeting Notes',
    description: 'Meeting recording and note-taking features'
  },
  gp_scribe_access: {
    label: 'Scribe',
    description: 'Consultation transcription and note generation'
  },
  complaints_manager_access: {
    label: 'Complaints Manager',
    description: 'View and manage patient complaints'
  },
  ai4gp_access: {
    label: 'AI4GP Service',
    description: 'AI-powered GP practice support'
  },
  enhanced_access: {
    label: 'Enhanced Access',
    description: 'Enhanced appointment booking and patient services'
  },
  cqc_compliance_access: {
    label: 'CQC Compliance',
    description: 'CQC compliance monitoring and assessment tools'
  },
  shared_drive_access: {
    label: 'Shared Drive',
    description: 'Shared file storage and collaboration'
  },
  mic_test_service_access: {
    label: 'Mic Test Service',
    description: 'Microphone testing and recording playback'
  },
  api_testing_service_access: {
    label: 'API Testing Service',
    description: 'AI model comparison and API testing'
  },
  translation_service_access: {
    label: 'Translation Service',
    description: 'Multilingual patient communication tool'
  },
  fridge_monitoring_access: {
    label: 'Fridge Monitoring',
    description: 'Practice fridge temperature monitoring'
  },
  cso_governance_access: {
    label: 'CSO Governance',
    description: 'CSO Report, DPIA, Hazard Log, and clinical safety docs'
  },
  lg_capture_access: {
    label: 'LG Capture',
    description: 'Lloyd George record scanning and digitisation'
  },
  bp_service_access: {
    label: 'BP Average Service',
    description: 'Blood pressure averaging calculator'
  }
};

// Default module access for each role
export const roleDefaultModules: Record<UserRole, ModuleAccess> = {
  // Practice User - minimal access
  practice_user: {
    meeting_notes_access: true,
    gp_scribe_access: false,
    complaints_manager_access: false,
    ai4gp_access: false,
    enhanced_access: false,
    cqc_compliance_access: false,
    shared_drive_access: false,
    mic_test_service_access: false,
    api_testing_service_access: false,
    translation_service_access: false,
    fridge_monitoring_access: false,
    cso_governance_access: false,
    lg_capture_access: false,
    bp_service_access: false
  },

  // Practice Manager - core management access (excludes Shared Drive, GP Scribe, CQC Compliance, Enhanced Access, Fridge Monitoring)
  practice_manager: {
    meeting_notes_access: true,
    gp_scribe_access: false,
    complaints_manager_access: true,
    ai4gp_access: true,
    enhanced_access: false,
    cqc_compliance_access: false,
    shared_drive_access: false,
    mic_test_service_access: false,
    api_testing_service_access: false,
    translation_service_access: true,
    fridge_monitoring_access: false,
    cso_governance_access: true,
    lg_capture_access: true,
    bp_service_access: true
  },

  // PCN Manager - oversight across practices
  pcn_manager: {
    meeting_notes_access: true,
    gp_scribe_access: false,
    complaints_manager_access: true,
    ai4gp_access: false,
    enhanced_access: true,
    cqc_compliance_access: true,
    shared_drive_access: true,
    mic_test_service_access: false,
    api_testing_service_access: false,
    translation_service_access: false,
    fridge_monitoring_access: false,
    cso_governance_access: true,
    lg_capture_access: false,
    bp_service_access: false
  },

  // System Admin - full access to everything
  system_admin: {
    meeting_notes_access: true,
    gp_scribe_access: true,
    complaints_manager_access: true,
    ai4gp_access: true,
    enhanced_access: true,
    cqc_compliance_access: true,
    shared_drive_access: true,
    mic_test_service_access: true,
    api_testing_service_access: true,
    translation_service_access: true,
    fridge_monitoring_access: true,
    cso_governance_access: true,
    lg_capture_access: true,
    bp_service_access: true
  },

  // GP - clinical focus
  gp: {
    meeting_notes_access: true,
    gp_scribe_access: true,
    complaints_manager_access: true,
    ai4gp_access: true,
    enhanced_access: false,
    cqc_compliance_access: false,
    shared_drive_access: true,
    mic_test_service_access: false,
    api_testing_service_access: false,
    translation_service_access: true,
    fridge_monitoring_access: false,
    cso_governance_access: true,
    lg_capture_access: false,
    bp_service_access: true
  },

  // Nurse - clinical with limited admin
  nurse: {
    meeting_notes_access: true,
    gp_scribe_access: true,
    complaints_manager_access: false,
    ai4gp_access: false,
    enhanced_access: false,
    cqc_compliance_access: false,
    shared_drive_access: true,
    mic_test_service_access: false,
    api_testing_service_access: false,
    translation_service_access: true,
    fridge_monitoring_access: true,
    cso_governance_access: false,
    lg_capture_access: false,
    bp_service_access: true
  },

  // Admin Staff - administrative focus
  admin_staff: {
    meeting_notes_access: true,
    gp_scribe_access: false,
    complaints_manager_access: true,
    ai4gp_access: false,
    enhanced_access: true,
    cqc_compliance_access: false,
    shared_drive_access: true,
    mic_test_service_access: false,
    api_testing_service_access: false,
    translation_service_access: true,
    fridge_monitoring_access: true,
    cso_governance_access: false,
    lg_capture_access: true,
    bp_service_access: false
  },

  // ICB User - oversight and governance focus
  icb_user: {
    meeting_notes_access: false,
    gp_scribe_access: false,
    complaints_manager_access: false,
    ai4gp_access: false,
    enhanced_access: false,
    cqc_compliance_access: true,
    shared_drive_access: true,
    mic_test_service_access: false,
    api_testing_service_access: false,
    translation_service_access: false,
    fridge_monitoring_access: false,
    cso_governance_access: true,
    lg_capture_access: false,
    bp_service_access: false
  }
};

// Helper function to get defaults for a role
export const getDefaultModulesForRole = (role: string): ModuleAccess => {
  const knownRole = role as UserRole;
  if (roleDefaultModules[knownRole]) {
    return { ...roleDefaultModules[knownRole] };
  }
  // Default to 'practice_user' role if unknown
  return { ...roleDefaultModules.practice_user };
};
