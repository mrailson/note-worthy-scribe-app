import { FileText, PoundSterling, UserCheck, Laptop, Building2, Handshake, ClipboardCheck, ShieldCheck, Users, Megaphone, BarChart3, Stethoscope, LucideIcon } from "lucide-react";

export interface AssuranceItem {
  id: number;
  text: string;
  completed: boolean;
}

export interface ProjectRisk {
  id: number;
  risk: string;
  category: string;
  riskType: 'principal' | 'operational' | 'project';
  originalLikelihood: number;
  originalConsequence: number;
  originalScore: number;
  currentLikelihood: number;
  currentConsequence: number;
  currentScore: number;
  icon: LucideIcon;
  concerns: string;
  mitigation: string;
  owner: string;
  lastReviewed: string;
  assuranceIndicators: AssuranceItem[];
  comments?: string;
}

export const projectRisks: ProjectRisk[] = [
  // Original risks (updated with PML format) - Last updated January 2026
  {
    id: 1,
    risk: "Legal: LES Contract Variation",
    category: "Legal/Contract",
    riskType: 'principal',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 4,
    currentConsequence: 5,
    currentScore: 20,
    icon: FileText,
    concerns: "Legal considerations in context of clinicians working across different sites but under the same registered manager. Understanding of roles and responsibilities of individuals in delivering services. Clear MOU with practices and SNO required.",
    mitigation: "LMC legal advice being sought; Clear MOU to be developed between practices and SNO; Roles and responsibilities documented; Governance framework to include legal accountability.",
    owner: "ICB Legal/LMC",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Legal opinion received", completed: false },
      { id: 2, text: "MOU drafted", completed: false },
      { id: 3, text: "Governance framework agreed", completed: false }
    ],
    comments: "Jan-26: LMC legal advice being sought. Risk score increased to 20 pending legal clarity on MOU requirements."
  },
  {
    id: 2,
    risk: "Financial Governance - £2,358,746.72 Funding",
    category: "Financial",
    riskType: 'principal',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 4,
    currentConsequence: 5,
    currentScore: 20,
    icon: PoundSterling,
    concerns: "Part A funding sustainability dependent on demonstrable outcomes. 1st April 2026 go-live date requires all governance, estates and workforce in place. Risk of delayed go-live impacting funding.",
    mitigation: "Clear milestones mapped to funding release; Monthly financial reporting; ICB finance liaison; Contingency planning for delayed go-live.",
    owner: "PML Board / ICB",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Funding agreement signed", completed: false },
      { id: 2, text: "Reporting framework agreed", completed: false },
      { id: 3, text: "Milestones on track", completed: false }
    ],
    comments: "Jan-26: 1st April 2026 go-live confirmed. All workstreams must align to this date."
  },
  {
    id: 3,
    risk: "Recruitment & Workforce Strategy",
    category: "Workforce",
    riskType: 'operational',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 4,
    currentConsequence: 5,
    currentScore: 20,
    icon: UserCheck,
    concerns: "Failure to recruit sufficient GPs/ANPs by April 2026 go-live. Competition from other areas. Host organisation for employed staff not yet determined. Adverts posted but recruitment timeline tight.",
    mitigation: "Adverts now posted; Competitive packages offered; Host organisation to be agreed (PML or practice); Early identification of candidates through networks.",
    owner: "Managerial Lead/Programme Board",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Adverts live", completed: true },
      { id: 2, text: "Host organisation confirmed", completed: false },
      { id: 3, text: "Candidates in pipeline", completed: false }
    ],
    comments: "Jan-26: Adverts posted. Host organisation to be determined - critical decision required. Risk score increased to 20."
  },
  {
    id: 4,
    risk: "Digital Integration",
    category: "Digital",
    riskType: 'project',
    originalLikelihood: 4,
    originalConsequence: 4,
    originalScore: 16,
    currentLikelihood: 4,
    currentConsequence: 4,
    currentScore: 16,
    icon: Laptop,
    concerns: "ICE ordering system access for hub clinicians not yet confirmed. SystmOne slot type configuration required for new service model. Risk of delays in digital readiness.",
    mitigation: "ICB digital team engagement; ICE access requirements being scoped; SystmOne slot types to be configured; Testing phase planned.",
    owner: "Digital Lead",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "ICE access confirmed", completed: false },
      { id: 2, text: "Slot types configured", completed: false },
      { id: 3, text: "Testing complete", completed: false }
    ],
    comments: "Jan-26: ICE ordering and SystmOne slot type issues identified. Risk score increased to 16."
  },
  {
    id: 5,
    risk: "Estates Strategy - Hub & Spoke",
    category: "Estates",
    riskType: 'project',
    originalLikelihood: 3,
    originalConsequence: 3,
    originalScore: 9,
    currentLikelihood: 3,
    currentConsequence: 4,
    currentScore: 12,
    icon: Building2,
    concerns: "Hub and spoke model still being finalised. Equipment requirements dependent on agreed locations. Risk of delays if estates decisions not made promptly.",
    mitigation: "Hub and spoke sessions ongoing to agree model; Equipment inventory to follow once locations confirmed; Early engagement with estates teams.",
    owner: "Estates Lead",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Hub/spoke model agreed", completed: false },
      { id: 2, text: "Equipment list finalised", completed: false },
      { id: 3, text: "Works scheduled", completed: false }
    ],
    comments: "Jan-26: Hub and spoke sessions ongoing. Risk score increased to 12 pending model agreement."
  },
  {
    id: 6,
    risk: "Stakeholder Buy-in",
    category: "Engagement",
    riskType: 'operational',
    originalLikelihood: 3,
    originalConsequence: 3,
    originalScore: 9,
    currentLikelihood: 2,
    currentConsequence: 3,
    currentScore: 6,
    icon: Handshake,
    concerns: "Practice partners or staff resistance to new working model. Patient concern about travelling to Hub locations.",
    mitigation: "Regular partner engagement sessions; clear governance and benefits communication; patient engagement events in January; transport support for vulnerable patients.",
    owner: "Programme Director",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Partner meetings scheduled", completed: true },
      { id: 2, text: "Patient engagement plan in place", completed: true },
      { id: 3, text: "Transport options identified", completed: false }
    ],
    comments: "Jan-26: Good engagement continues. Patient sessions ongoing."
  },
  {
    id: 7,
    risk: "CQC Registration Delay",
    category: "Regulatory",
    riskType: 'principal',
    originalLikelihood: 3,
    originalConsequence: 5,
    originalScore: 15,
    currentLikelihood: 3,
    currentConsequence: 5,
    currentScore: 15,
    icon: ClipboardCheck,
    concerns: "CQC registration not approved before April 2026 go-live, preventing service launch. Registration process delays could impact entire programme timeline.",
    mitigation: "Early CQC engagement initiated; application submitted with buffer time; regular progress tracking with CQC liaison; contingency plans for phased launch if delays occur.",
    owner: "Programme Director",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "CQC liaison established", completed: true },
      { id: 2, text: "Application timeline agreed", completed: true },
      { id: 3, text: "Contingency plan documented", completed: false }
    ],
    comments: "Jan-26: CQC engagement positive. Application in progress."
  },
  {
    id: 8,
    risk: "Recruitment Shortfall",
    category: "Workforce",
    riskType: 'operational',
    originalLikelihood: 4,
    originalConsequence: 4,
    originalScore: 16,
    currentLikelihood: 3,
    currentConsequence: 4,
    currentScore: 12,
    icon: UserCheck,
    concerns: "Unable to recruit sufficient clinical and administrative staff by go-live. Competition for limited workforce pool may delay operational readiness.",
    mitigation: "Early recruitment campaign (Jan 2026); competitive salary packages; flexible working options; partnership with training practices; contingency for agency cover during initial phase.",
    owner: "Managerial Lead/Member Practices/Programme Board",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Recruitment timeline agreed", completed: true },
      { id: 2, text: "Salary benchmarking complete", completed: true },
      { id: 3, text: "Agency contingency in place", completed: false }
    ],
    comments: "Jan-26: Linked to Risk #3. Admin recruitment underway."
  },
  {
    id: 9,
    risk: "Insurance & Indemnity Gaps",
    category: "Legal/Insurance",
    riskType: 'principal',
    originalLikelihood: 3,
    originalConsequence: 4,
    originalScore: 12,
    currentLikelihood: 3,
    currentConsequence: 4,
    currentScore: 12,
    icon: ShieldCheck,
    concerns: "Inadequate insurance cover or indemnity arrangements for new service model. Practices may have gaps in coverage for Hub-based working.",
    mitigation: "Insurance review underway (Amanda Taylor checking); confirmation checklist for all practices; early engagement with MDOs; template indemnity arrangements being drafted.",
    owner: "Amanda Taylor",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Insurance review complete", completed: false },
      { id: 2, text: "All practices confirmed cover", completed: false },
      { id: 3, text: "MDO guidance received", completed: false }
    ],
    comments: "Jan-26: Amanda Taylor reviewing current policies. Checklist circulated."
  },
  
  // NEW RISKS FROM PML (V1.1) - Updated January 2026
  {
    id: 10,
    risk: "Programme Board Governance",
    category: "Governance",
    riskType: 'principal',
    originalLikelihood: 3,
    originalConsequence: 4,
    originalScore: 12,
    currentLikelihood: 3,
    currentConsequence: 4,
    currentScore: 12,
    icon: Users,
    concerns: "Ensuring the Programme Board delivers on its objectives without getting entangled in day-to-day operational tasks. Risk of governance confusion between strategic and operational layers.",
    mitigation: "Clear ToR defining PB role vs operational management; Regular review of meeting agendas against strategic objectives; Escalation framework documented; Operational matters delegated to workstream leads.",
    owner: "PML Chair",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "ToR ratified", completed: true },
      { id: 2, text: "Escalation framework agreed", completed: true },
      { id: 3, text: "Workstream leads identified", completed: true }
    ],
    comments: "Jan-26: ToRs now clear. Risk maintained at 12."
  },
  {
    id: 11,
    risk: "Communication Strategy",
    category: "Engagement",
    riskType: 'operational',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 4,
    currentConsequence: 5,
    currentScore: 20,
    icon: Megaphone,
    concerns: "Multi-stranded patient and population engagement strategy not yet fully developed. VCSE engagement, PPG groups, and patient-facing communications all require coordination.",
    mitigation: "Dedicated communications workstream; VCSE engagement planned; PPG group involvement; ICB communications team support; Phased messaging strategy aligned to programme milestones.",
    owner: "Managerial Lead",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Communications plan approved", completed: false },
      { id: 2, text: "VCSE engaged", completed: false },
      { id: 3, text: "PPG briefed", completed: false },
      { id: 4, text: "Patient materials drafted", completed: false }
    ],
    comments: "Jan-26: High priority - score 20. VCSE, PPG groups and patient engagement work ongoing."
  },
  {
    id: 12,
    risk: "Financial Governance - £30k Grant",
    category: "Financial",
    riskType: 'project',
    originalLikelihood: 3,
    originalConsequence: 4,
    originalScore: 12,
    currentLikelihood: 3,
    currentConsequence: 4,
    currentScore: 12,
    icon: PoundSterling,
    concerns: "ICB grant application and monthly reporting requirements. Risk of delayed funding or clawback if reporting not compliant.",
    mitigation: "Monthly financial reporting framework established; Named finance lead identified; Clear grant expenditure tracking; ICB finance liaison for guidance on requirements.",
    owner: "Programme Director",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Reporting template agreed", completed: true },
      { id: 2, text: "Finance lead confirmed", completed: true },
      { id: 3, text: "Reports submitted on time", completed: true }
    ],
    comments: "Jan-26: Grant application in progress. Monthly reporting to ICB ongoing."
  },
  {
    id: 13,
    risk: "Population Health Part B",
    category: "Clinical",
    riskType: 'operational',
    originalLikelihood: 4,
    originalConsequence: 4,
    originalScore: 16,
    currentLikelihood: 4,
    currentConsequence: 4,
    currentScore: 16,
    icon: Stethoscope,
    concerns: "Part B clinic planning (Frailty/COPD) options still being considered. Need to clarify outcomes required and pathway design.",
    mitigation: "Part B options being reviewed; Clinical leads identified for Frailty and COPD; Pathway mapping underway; Integration with existing practice chronic disease management.",
    owner: "Clinical Lead",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Clinical leads confirmed", completed: true },
      { id: 2, text: "Pathways mapped", completed: false },
      { id: 3, text: "Outcomes defined", completed: false },
      { id: 4, text: "Pilot sites agreed", completed: false }
    ],
    comments: "Jan-26: Part B options and outcomes still under consideration."
  },
  {
    id: 14,
    risk: "SDA Delivery Model",
    category: "Operational",
    riskType: 'operational',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 3,
    currentConsequence: 4,
    currentScore: 12,
    icon: Building2,
    concerns: "Hub/spoke appointment delivery model and SOPs not yet fully developed. SOPs to be developed once estates model agreed.",
    mitigation: "Hub operational protocols being developed; Standard Operating Procedures (SOPs) workstream; Staff training programme; Patient journey mapping; Clear escalation pathways between hub and spoke sites.",
    owner: "Programme Board",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "SOPs drafted", completed: false },
      { id: 2, text: "Training programme agreed", completed: false },
      { id: 3, text: "Patient pathways documented", completed: false },
      { id: 4, text: "Escalation routes clear", completed: false }
    ],
    comments: "Jan-26: SOPs to be developed once estates agreed. Risk score reduced to 12 as model progresses."
  },
  {
    id: 15,
    risk: "KPI Development",
    category: "Performance",
    riskType: 'principal',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 4,
    currentConsequence: 5,
    currentScore: 20,
    icon: BarChart3,
    concerns: "Performance dashboard metrics and coding requirements not yet finalised. Risk of inability to demonstrate outcomes or evidence value of SDA model.",
    mitigation: "KPI workstream established; Dashboard specification drafted; Coding guidance being developed with ICB; Baseline data collection underway; Quarterly reporting framework aligned to ICB requirements.",
    owner: "Digital Lead",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "KPIs agreed with ICB", completed: false },
      { id: 2, text: "Dashboard live", completed: false },
      { id: 3, text: "Coding training complete", completed: false },
      { id: 4, text: "Baseline established", completed: false }
    ],
    comments: "Jan-26: High priority - score 20. Performance dashboard work ongoing."
  },
  
  // NEW RISK - Added January 2026
  {
    id: 16,
    risk: "Equipment Requirements & Procurement",
    category: "Operational",
    riskType: 'project',
    originalLikelihood: 4,
    originalConsequence: 4,
    originalScore: 16,
    currentLikelihood: 4,
    currentConsequence: 4,
    currentScore: 16,
    icon: Laptop,
    concerns: "Clinical and non-clinical equipment inventory not yet agreed. Hub and spoke sites require clinical equipment, laptops, desktops, printers etc. Risk of delays if equipment not procured in time for go-live.",
    mitigation: "Full inventory to be agreed once hub and spoke locations finalised; Equipment to be fully costed; Procurement timeline to align with estates completion; Early ordering for long-lead items.",
    owner: "MR/AT",
    lastReviewed: "Jan-26",
    assuranceIndicators: [
      { id: 1, text: "Equipment inventory agreed", completed: false },
      { id: 2, text: "Full costings complete", completed: false },
      { id: 3, text: "Procurement orders placed", completed: false }
    ],
    comments: "Jan-26: NEW RISK. As estates model is agreed, full inventory with costings required for go-live."
  }
];

export const getRatingFromScore = (score: number): string => {
  if (score >= 16) return "HIGH";
  if (score >= 10) return "SIGNIFICANT";
  if (score >= 5) return "MODERATE";
  return "LOW";
};

export const getRatingBadgeStyles = (score: number) => {
  if (score >= 16) return "bg-red-100 text-red-700 border-red-200";
  if (score >= 10) return "bg-amber-100 text-amber-700 border-amber-200";
  if (score >= 5) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-green-100 text-green-700 border-green-200";
};

export const getRiskTypeBadgeStyles = (type: 'principal' | 'operational' | 'project') => {
  switch (type) {
    case 'principal':
      return "bg-red-100 text-red-700 border-red-200";
    case 'operational':
      return "bg-amber-100 text-amber-700 border-amber-200";
    case 'project':
      return "bg-blue-100 text-blue-700 border-blue-200";
  }
};

export const getRiskTypeLabel = (type: 'principal' | 'operational' | 'project') => {
  switch (type) {
    case 'principal':
      return "Principal";
    case 'operational':
      return "Operational";
    case 'project':
      return "Project";
  }
};
