// DTAC (Digital Technology Assessment Criteria) Types for NHS Digital

export interface DTACAssessment {
  id: string;
  organisation_id?: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'in_review' | 'submitted' | 'approved';
  version: string;
  companyInfo: CompanyInformation;
  valueProposition: ValueProposition;
  clinicalSafety: ClinicalSafety;
  dataProtection: DataProtection;
  technicalSecurity: TechnicalSecurity;
  interoperability: Interoperability;
  usabilityAccessibility: UsabilityAccessibility;
}

// Section A: Company Information
export interface CompanyInformation {
  a1_companyName: string;
  a2_productName: string;
  a3_productType: string;
  a4_contactName: string;
  a5_contactEmail: string;
  a6_contactPhone: string;
  a7_companyRegistrationNumber: string;
  a8_registeredAddress: string;
  a9_websiteUrl: string;
  a10_yearsTrading: string;
}

// Section B: Value Proposition
export interface ValueProposition {
  b1_targetUsers: string;
  b2_problemSolved: string;
  b3_benefits: string;
  b4_evidenceBase: string;
}

// Section C1: Clinical Safety
export interface ClinicalSafety {
  c1_1_csoName: string;
  c1_1_csoQualifications: string;
  c1_1_csoContact: string;
  c1_2_dcb0129Compliant: boolean;
  c1_2_dcb0129Evidence: string;
  c1_3_mhraRegistered: boolean;
  c1_3_mhraDetails: string;
  c1_4_hazardLog: boolean;
  c1_4_hazardLogSummary: string;
}

// Section C2: Data Protection
export interface DataProtection {
  c2_1_icoRegistered: boolean;
  c2_1_icoNumber: string;
  c2_2_dpoName: string;
  c2_2_dpoContact: string;
  c2_3_dsptStatus: string;
  c2_3_dsptEvidence: string;
  c2_3_2_dpiaCompleted: boolean;
  c2_3_2_dpiaDate: string;
  c2_3_2_dpiaSummary: string;
  c2_4_dataMinimisation: string;
  c2_5_dataLocation: string;
  c2_5_dataLocationDetails: string;
}

// Section C3: Technical Security
export interface TechnicalSecurity {
  c3_1_cyberEssentials: boolean;
  c3_1_cyberEssentialsPlus: boolean;
  c3_1_certificateNumber: string;
  c3_2_penetrationTesting: boolean;
  c3_2_testingFrequency: string;
  c3_2_lastTestDate: string;
  c3_3_vulnerabilityManagement: string;
  c3_4_incidentResponse: string;
}

// Section C4: Interoperability
export interface Interoperability {
  c4_1_standardsCompliance: string[];
  c4_1_standardsDetails: string;
  c4_2_apiAvailable: boolean;
  c4_2_apiDocumentation: string;
  c4_3_integrationSupport: string;
}

// Section D: Usability & Accessibility
export interface UsabilityAccessibility {
  d1_1_userTesting: boolean;
  d1_1_userTestingDetails: string;
  d1_2_accessibilityStandard: string;
  d1_2_wcagLevel: string;
  d1_3_accessibilityTesting: string;
  d1_4_userSupport: string;
  d1_5_trainingProvided: boolean;
  d1_5_trainingDetails: string;
}

export interface DTACProgress {
  sectionA: number; // 0-100
  sectionB: number;
  sectionC1: number;
  sectionC2: number;
  sectionC3: number;
  sectionC4: number;
  sectionD: number;
  overall: number;
}

export interface DTACEvidence {
  id: string;
  assessment_id: string;
  question_code: string;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_at: string;
}
