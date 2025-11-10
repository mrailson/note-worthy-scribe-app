export interface RiskAssessment {
  id: string;
  hazard: string;
  clinicalContext: string;
  severity: 'CATASTROPHIC' | 'MAJOR' | 'MODERATE' | 'LOW';
  likelihood: 'VERY LOW' | 'LOW' | 'MEDIUM' | 'HIGH';
  riskRating: 'HIGH' | 'MEDIUM' | 'LOW';
  currentControls: string[];
  residualRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY LOW';
  furtherActions: string[];
}

export interface ServiceDescription {
  name: string;
  purpose: string;
  capabilities: string[];
  userBase: string;
  dataProcessed: string[];
}

export interface ComplianceItem {
  requirement: string;
  ai4gp: string;
  meetingNotes: string;
  complaints: string;
  status: 'COMPLIANT' | 'PARTIAL' | 'OUTSTANDING';
  evidence: string;
}

export interface SecurityControl {
  category: string;
  implementation: string;
  effectiveness: 'HIGH' | 'MEDIUM' | 'LOW';
  gaps: string;
}

export interface ThirdPartyRisk {
  service: string;
  purpose: string;
  dataShared: string;
  assuranceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  risk: string;
  mitigation: string[];
}

export interface ChecklistItem {
  item: string;
  status: 'COMPLETE' | 'PARTIAL' | 'OUTSTANDING';
  owner: string;
  targetDate: string;
}

export const services: ServiceDescription[] = [
  {
    name: "AI4GP Service",
    purpose: "AI-powered clinical and practice management assistant providing evidence-based guidance, information retrieval, and decision support for primary care clinicians and practice managers.",
    capabilities: [
      "Real-time AI chat interface with clinical query handling",
      "Integration with OpenAI GPT-5 and Grok models for advanced reasoning",
      "Clinical verification system with confidence scoring",
      "Document upload and analysis (PDFs, clinical documents)",
      "Translation services for patient communication",
      "Practice context awareness (practice details, PCN information)",
      "Search history and session management",
      "Clinical disclaimer and safety warnings"
    ],
    userBase: "GPs, Practice Managers, Clinical Staff, Administrative Staff",
    dataProcessed: [
      "Clinical queries and conversations",
      "Patient-related queries (anonymised/pseudonymised)",
      "Practice operational data",
      "User interaction logs",
      "Uploaded clinical documents",
      "Search history"
    ]
  },
  {
    name: "Meeting Notes System",
    purpose: "Live transcription and AI-powered meeting minutes generation for NHS practice meetings, clinical discussions, and administrative meetings.",
    capabilities: [
      "Real-time speech-to-text transcription (browser-based and Deepgram)",
      "Live transcript display with speaker identification",
      "Multiple AI-generated note styles (6 variations)",
      "Audio file upload and transcription",
      "Meeting context capture (attendees, agenda, location)",
      "Word document and PDF export",
      "Email distribution of meeting minutes",
      "Transcript cleaning and formatting",
      "Meeting history and search"
    ],
    userBase: "Practice Managers, Clinical Teams, Administrative Staff, Meeting Secretaries",
    dataProcessed: [
      "Live audio recordings (temporary)",
      "Meeting transcripts",
      "Participant information",
      "Meeting metadata (date, time, location, attendees)",
      "Generated meeting minutes",
      "Audio file uploads"
    ]
  },
  {
    name: "Complaints Management System",
    purpose: "Comprehensive NHS complaints handling system compliant with NHS complaints regulations and patient safety requirements.",
    capabilities: [
      "Structured complaint intake with patient data capture",
      "Patient data masking and role-based access controls",
      "Automated acknowledgement letter generation",
      "Staff response collection system",
      "AI-assisted outcome letter generation",
      "Compliance checking against NHS standards",
      "Audit trail and activity logging",
      "Document export (Word, PDF)",
      "Timeline tracking and status management",
      "Integration with patient safety reporting"
    ],
    userBase: "Complaints Managers, Practice Managers, Clinical Staff involved in complaints",
    dataProcessed: [
      "Patient identifiable information (PII)",
      "Complaint details and descriptions",
      "Staff responses and investigations",
      "Outcome decisions and letters",
      "Compliance check data",
      "Audit logs with access tracking",
      "Email communications"
    ]
  }
];

export const ai4gpRisks: RiskAssessment[] = [
  {
    id: "AI4GP-001",
    hazard: "Incorrect Clinical Information Provided",
    clinicalContext: "All clinical queries; diagnosis, treatment, prescribing decisions",
    severity: "MAJOR",
    likelihood: "MEDIUM",
    riskRating: "HIGH",
    currentControls: [
      "Multi-model verification (GPT-5, Grok)",
      "Clinical disclaimer displayed",
      "Confidence scoring system",
      "User acknowledgement required",
      "Audit trail of all queries"
    ],
    residualRisk: "MEDIUM",
    furtherActions: [
      "Implement clinical validation workflow",
      "Add medical terminology verification",
      "Integrate with NICE/BNF APIs for verification",
      "Monthly review of flagged responses",
      "Clinical oversight committee"
    ]
  },
  {
    id: "AI4GP-002",
    hazard: "Misinterpretation of User Query",
    clinicalContext: "Complex clinical scenarios, ambiguous queries, emergency situations",
    severity: "MAJOR",
    likelihood: "MEDIUM",
    riskRating: "HIGH",
    currentControls: [
      "Query clarification prompts",
      "Context retention in conversation",
      "Practice context awareness",
      "User ability to provide additional context"
    ],
    residualRisk: "MEDIUM",
    furtherActions: [
      "Enhanced query parsing",
      "Ambiguity detection system",
      "Emergency scenario identification",
      "Automatic escalation triggers"
    ]
  },
  {
    id: "AI4GP-003",
    hazard: "Inappropriate Use for Clinical Decisions",
    clinicalContext: "All clinical decisions, particularly high-risk scenarios",
    severity: "CATASTROPHIC",
    likelihood: "LOW",
    riskRating: "HIGH",
    currentControls: [
      "Prominent disclaimer on every page",
      "AI-generated content watermarking",
      "Regular user reminders",
      "Access restricted to clinical staff",
      "Training materials emphasise limitations"
    ],
    residualRisk: "MEDIUM",
    furtherActions: [
      "Mandatory training module",
      "Periodic competency assessment",
      "Clinical supervision protocols",
      "Usage guidelines integration"
    ]
  },
  {
    id: "AI4GP-004",
    hazard: "Data Privacy Breach",
    clinicalContext: "Queries containing patient identifiable data, clinical history",
    severity: "MAJOR",
    likelihood: "LOW",
    riskRating: "MEDIUM",
    currentControls: [
      "End-to-end encryption",
      "Query sanitisation guidance",
      "Audit logging",
      "RLS policies",
      "User authentication required"
    ],
    residualRisk: "LOW",
    furtherActions: [
      "Automated PII detection",
      "Query sanitisation automation",
      "Enhanced privacy training",
      "Periodic privacy audits"
    ]
  }
];

export const meetingNotesRisks: RiskAssessment[] = [
  {
    id: "MN-001",
    hazard: "Inaccurate Transcription of Clinical Discussions",
    clinicalContext: "Clinical meetings, MDT meetings, patient case discussions",
    severity: "MAJOR",
    likelihood: "MEDIUM",
    riskRating: "HIGH",
    currentControls: [
      "Live transcript review capability",
      "Post-meeting editing functionality",
      "Multiple transcription services (Whisper, Deepgram)",
      "Word count and quality metrics",
      "Manual review required notice"
    ],
    residualRisk: "MEDIUM",
    furtherActions: [
      "Mandatory human verification step",
      "Critical information highlighting",
      "Accuracy benchmarking",
      "User training on verification",
      "Clinical terminology dictionary"
    ]
  },
  {
    id: "MN-002",
    hazard: "Lost or Incomplete Meeting Data",
    clinicalContext: "Emergency planning meetings, serious incident reviews",
    severity: "MAJOR",
    likelihood: "LOW",
    riskRating: "MEDIUM",
    currentControls: [
      "Auto-save functionality",
      "Multiple data backup locations",
      "Session recovery mechanisms",
      "Real-time storage to Supabase",
      "Audio backup option"
    ],
    residualRisk: "LOW",
    furtherActions: [
      "Redundant recording systems",
      "Manual fallback procedures",
      "Data recovery testing",
      "Periodic backup verification"
    ]
  },
  {
    id: "MN-003",
    hazard: "Unauthorised Access to Meeting Records",
    clinicalContext: "All meetings containing patient information, staff discussions",
    severity: "MAJOR",
    likelihood: "LOW",
    riskRating: "MEDIUM",
    currentControls: [
      "Row Level Security (RLS) enforced",
      "User authentication required",
      "Meeting ownership model",
      "Share controls with audit",
      "Encryption at rest and transit"
    ],
    residualRisk: "LOW",
    furtherActions: [
      "Enhanced access logging",
      "Periodic access reviews",
      "Role-based sharing limits",
      "Automatic access expiry"
    ]
  },
  {
    id: "MN-004",
    hazard: "AI-Generated Notes Misrepresent Discussions",
    clinicalContext: "Action item allocation, clinical decision documentation",
    severity: "MODERATE",
    likelihood: "MEDIUM",
    riskRating: "MEDIUM",
    currentControls: [
      "6 different note styles for comparison",
      "Full transcript always available",
      "Edit functionality for all notes",
      "Version history maintained",
      "Clearly marked as AI-generated"
    ],
    residualRisk: "LOW",
    furtherActions: [
      "Mandatory review protocol",
      "Critical item highlighting",
      "Comparison tools",
      "Approval workflow",
      "Responsible person assignment"
    ]
  }
];

export const complaintsRisks: RiskAssessment[] = [
  {
    id: "CM-001",
    hazard: "Patient Safety Complaint Missed or Delayed",
    clinicalContext: "All complaints with patient safety implications",
    severity: "CATASTROPHIC",
    likelihood: "LOW",
    riskRating: "HIGH",
    currentControls: [
      "Mandatory categorisation",
      "Priority flagging system",
      "Response due dates",
      "Status tracking workflow",
      "Audit trail of all actions"
    ],
    residualRisk: "MEDIUM",
    furtherActions: [
      "Automatic safety keyword detection",
      "Mandatory senior clinician review",
      "Direct integration with incident reporting",
      "Escalation time limits",
      "Safety committee notifications"
    ]
  },
  {
    id: "CM-002",
    hazard: "Unauthorised Access to Patient Identifiable Information",
    clinicalContext: "All complaints containing patient PII, medical history",
    severity: "MAJOR",
    likelihood: "LOW",
    riskRating: "MEDIUM",
    currentControls: [
      "Patient data masking by default",
      "Justification required for full data access",
      "Time-limited access sessions",
      "Role-based access controls",
      "Comprehensive audit logging"
    ],
    residualRisk: "LOW",
    furtherActions: [
      "Enhanced access justification workflow",
      "Automatic session expiry (5 hours)",
      "Periodic access audits",
      "Suspicious access alerts",
      "Data minimisation enforcement"
    ]
  },
  {
    id: "CM-003",
    hazard: "Incorrect or Incomplete Patient Data in Complaint",
    clinicalContext: "All complaint intake, manual data entry",
    severity: "MAJOR",
    likelihood: "MEDIUM",
    riskRating: "HIGH",
    currentControls: [
      "Structured data entry forms",
      "Validation at input",
      "Patient confirmation fields",
      "Manual review process",
      "Edit capability"
    ],
    residualRisk: "MEDIUM",
    furtherActions: [
      "Patient identifier verification (NHS number)",
      "Duplicate checking",
      "Mandatory verification steps",
      "Patient record linking",
      "Confirmation workflows"
    ]
  },
  {
    id: "CM-004",
    hazard: "AI-Generated Response Inappropriate or Inadequate",
    clinicalContext: "All auto-generated letters, especially outcome letters",
    severity: "MODERATE",
    likelihood: "MEDIUM",
    riskRating: "MEDIUM",
    currentControls: [
      "Letters marked AI-generated",
      "Full editing capability",
      "Template-based generation",
      "Manager review before sending",
      "Version history"
    ],
    residualRisk: "LOW",
    furtherActions: [
      "Mandatory human review for all outcomes",
      "Clinical input for clinical complaints",
      "Tone and sentiment checking",
      "Template quality assurance",
      "Regular content audits"
    ]
  }
];

export const gdprCompliance: ComplianceItem[] = [
  {
    requirement: "Lawful Basis for Processing",
    ai4gp: "Legitimate Interest (clinical support)",
    meetingNotes: "Legitimate Interest (organisational records)",
    complaints: "Legal Obligation (NHS complaints regulations)",
    status: "COMPLIANT",
    evidence: "Privacy notices, user consent mechanisms"
  },
  {
    requirement: "Data Minimisation",
    ai4gp: "Queries may contain excessive patient data",
    meetingNotes: "Meeting transcripts capture all spoken content",
    complaints: "Structured forms collect necessary data only",
    status: "PARTIAL",
    evidence: "AI4GP needs query sanitisation guidance"
  },
  {
    requirement: "Purpose Limitation",
    ai4gp: "Clear purpose (clinical guidance)",
    meetingNotes: "Clear purpose (meeting documentation)",
    complaints: "Clear purpose (complaints handling)",
    status: "COMPLIANT",
    evidence: "System design, user documentation"
  },
  {
    requirement: "Accuracy",
    ai4gp: "AI-generated content may contain errors",
    meetingNotes: "Transcription accuracy 85-95%",
    complaints: "User-entered data, validation required",
    status: "PARTIAL",
    evidence: "All systems require human verification protocols"
  },
  {
    requirement: "Storage Limitation",
    ai4gp: "30-day default retention (configurable)",
    meetingNotes: "Indefinite retention (operational need)",
    complaints: "7-year retention (regulatory requirement)",
    status: "COMPLIANT",
    evidence: "Data retention policies defined"
  },
  {
    requirement: "Integrity & Confidentiality",
    ai4gp: "Encryption, authentication, RLS",
    meetingNotes: "Encryption, authentication, RLS",
    complaints: "Encryption, authentication, RLS, masking",
    status: "COMPLIANT",
    evidence: "Technical security measures documented"
  }
];

export const securityControls: SecurityControl[] = [
  {
    category: "Authentication",
    implementation: "Supabase Auth with email/password, MFA available, secure session management",
    effectiveness: "HIGH",
    gaps: "Consider mandating MFA for clinical users"
  },
  {
    category: "Authorization",
    implementation: "Role-based access control (RBAC), Row Level Security (RLS), practice-based data isolation",
    effectiveness: "HIGH",
    gaps: "Regular permission audits needed"
  },
  {
    category: "Encryption",
    implementation: "TLS in transit, AES-256 at rest (Supabase)",
    effectiveness: "HIGH",
    gaps: "None"
  },
  {
    category: "Input Validation",
    implementation: "Form validation, file upload restrictions, XSS/SQL injection prevention",
    effectiveness: "MEDIUM",
    gaps: "Enhanced validation needed for AI4GP queries"
  },
  {
    category: "Session Management",
    implementation: "User sessions table, activity tracking, auto-timeout (5 hours), secure storage",
    effectiveness: "MEDIUM",
    gaps: "Consider shorter timeout for sensitive operations"
  },
  {
    category: "Audit Logging",
    implementation: "Comprehensive system audit log, security events table, access tracking",
    effectiveness: "HIGH",
    gaps: "Log retention policy to be defined"
  },
  {
    category: "User Interface Security",
    implementation: "Secure navigation paths, protected documentation access, role-based feature visibility",
    effectiveness: "HIGH",
    gaps: "Continue monitoring for unauthorised access attempts"
  }
];

export const thirdPartyRisks: ThirdPartyRisk[] = [
  {
    service: "OpenAI GPT-5",
    purpose: "AI responses in AI4GP, Meeting notes, Complaints",
    dataShared: "Clinical queries, meeting transcripts, complaint text",
    assuranceLevel: "MEDIUM",
    risk: "Data processing outside UK/EEA, potential for data retention by provider",
    mitigation: [
      "Data Processing Agreement required",
      "No PII in prompts guidance",
      "OpenAI enterprise tier consideration",
      "UK region if available"
    ]
  },
  {
    service: "Grok/xAI",
    purpose: "Alternative AI model in AI4GP",
    dataShared: "Clinical queries",
    assuranceLevel: "LOW",
    risk: "Less established provider, limited UK presence",
    mitigation: [
      "Usage monitoring",
      "DPA required",
      "Consider removal if DPA unavailable"
    ]
  },
  {
    service: "Deepgram",
    purpose: "Speech-to-text transcription",
    dataShared: "Audio from meetings",
    assuranceLevel: "MEDIUM",
    risk: "Audio contains patient information, processed by third party",
    mitigation: [
      "DPA required",
      "Verify UK/EEA processing",
      "Temporary audio storage only",
      "Fallback to browser speech recognition"
    ]
  },
  {
    service: "Supabase",
    purpose: "Primary database and backend",
    dataShared: "All system data",
    assuranceLevel: "HIGH",
    risk: "Core infrastructure dependency",
    mitigation: [
      "AWS UK region",
      "Automatic backups",
      "Encryption at rest and transit",
      "BAA available"
    ]
  }
];

export const preDeploymentChecklist: ChecklistItem[] = [
  {
    item: "Formal CSO appointed",
    status: "OUTSTANDING",
    owner: "Organisation",
    targetDate: "Before deployment"
  },
  {
    item: "Clinical Safety Case completed",
    status: "PARTIAL",
    owner: "CSO",
    targetDate: "Ready for review once CSO appointed"
  },
  {
    item: "Hazard Log approved",
    status: "PARTIAL",
    owner: "CSO",
    targetDate: "Ready for review once CSO appointed"
  },
  {
    item: "DPIA completed and signed",
    status: "OUTSTANDING",
    owner: "DPO",
    targetDate: "Before deployment"
  },
  {
    item: "SIRO approval obtained",
    status: "OUTSTANDING",
    owner: "SIRO",
    targetDate: "Before deployment"
  },
  {
    item: "Caldicott Guardian approval",
    status: "OUTSTANDING",
    owner: "Caldicott Guardian",
    targetDate: "Before deployment"
  },
  {
    item: "DPAs with AI providers signed",
    status: "COMPLETE",
    owner: "IG Lead",
    targetDate: "Complete"
  },
  {
    item: "Security warnings resolved",
    status: "COMPLETE",
    owner: "Technical Lead",
    targetDate: "Complete"
  },
  {
    item: "Penetration testing completed",
    status: "OUTSTANDING",
    owner: "InfoSec Team",
    targetDate: "Before deployment"
  },
  {
    item: "User access controls configured",
    status: "COMPLETE",
    owner: "System Admin",
    targetDate: "Complete"
  },
  {
    item: "System navigation and documentation access verified",
    status: "COMPLETE",
    owner: "System Admin",
    targetDate: "Complete"
  },
  {
    item: "Training materials developed",
    status: "PARTIAL",
    owner: "Training Lead",
    targetDate: "2 weeks before deployment"
  }
];

export const recommendations = {
  immediate: [
    "Formal DCB0129 Compliance: Appoint CSO, complete Clinical Safety Case, establish Hazard Log",
    "Data Protection Compliance: Complete DPIA, obtain SIRO and Caldicott Guardian approval",
    "Clinical Validation Workflows: Implement mandatory human review for AI-generated clinical content",
    "Training Programme: Develop and deliver all mandatory training modules before user access",
    "Navigation & Access Controls: Complete documentation of all system navigation paths and security documentation access"
  ],
  shortTerm: [
    "Establish Clinical Governance Committee for AI oversight",
    "Implement clinical terminology verification in AI4GP",
    "Integrate complaints system with incident reporting",
    "Enhanced patient data detection and sanitisation",
    "Deploy automated reminders and escalations in complaints system",
    "Conduct user acceptance testing with representative user groups",
    "Establish feedback mechanisms for users to report issues",
    "Implement enhanced audit reporting for regulatory readiness"
  ],
  longTerm: [
    "Integration with NHS Digital systems (Spine, GP Connect)",
    "AI model performance benchmarking against clinical guidelines",
    "Natural language processing for clinical term extraction and verification",
    "Advanced analytics dashboard for clinical governance",
    "Mobile application development for wider accessibility",
    "Multi-practice and PCN-wide deployment capabilities",
    "Research and evaluation of clinical and operational impact"
  ]
};
