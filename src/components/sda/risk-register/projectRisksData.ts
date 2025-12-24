import { FileText, PoundSterling, UserCheck, Laptop, Building2, Handshake, ClipboardCheck, ShieldCheck, Users, Megaphone, BarChart3, Stethoscope, LucideIcon } from "lucide-react";

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
  assuranceIndicators: string;
  comments?: string;
}

export const projectRisks: ProjectRisk[] = [
  // Original risks (updated with PML format)
  {
    id: 1,
    risk: "Legal: GMS Agreement Change",
    category: "Legal/Contract",
    riskType: 'principal',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 3,
    currentConsequence: 5,
    currentScore: 15,
    icon: FileText,
    concerns: "Neighbourhood model requires formal variation to GMS contracts for participating practices. Without legal sign-off, practices cannot formally participate in shared clinics.",
    mitigation: "Early engagement with NHSE legal team; template variation drafted for January review; legal opinion sought on 'collaborative working' interpretation.",
    owner: "ICB Legal",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Legal opinion received; Template drafted; Practice sign-off scheduled",
    comments: "ICB legal team engaged. Draft variation expected by end of January 2026."
  },
  {
    id: 2,
    risk: "Financial Governance - Centralised PML Funding",
    category: "Financial",
    riskType: 'principal',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 4,
    currentConsequence: 5,
    currentScore: 20,
    icon: PoundSterling,
    concerns: "All practice funding will flow through PML, not retained by individual practices. Key questions: What happens if practices disagree on spend priorities? How are practice contributions calculated and tracked? What is the exit mechanism if a practice leaves?",
    mitigation: "Formal SLA between PML and practices; independent annual audit; clear governance ToR with weighted voting rights; ring-fencing of practice allocations; defined exit clause with 90-day notice period; quarterly financial reporting.",
    owner: "PML Board / Member Practices",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "SLA drafted; Governance ToR agreed; Exit clause defined",
    comments: "Practices require detailed breakdown of funding allocation model before signing."
  },
  {
    id: 3,
    risk: "Recruitment & Workforce",
    category: "Workforce",
    riskType: 'operational',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 3,
    currentConsequence: 5,
    currentScore: 15,
    icon: UserCheck,
    concerns: "Failure to recruit sufficient GPs/ANPs by April 2026 go-live. Competition from other neighbourhoods and private sector for limited workforce pool.",
    mitigation: "Brackley Medical Centre has identified a candidate (new GP) for the pilot. Early advertisement (Jan 2026); competitive packages with portfolio career options; flexible working arrangements; partnership with local training practices.",
    owner: "Managerial Lead/Member Practices/Programme Board",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "GP candidate identified; JDs finalised; Interview panels scheduled",
    comments: "One GP candidate identified through BMC networks. Requires interview panel formation."
  },
  {
    id: 4,
    risk: "Digital Integration",
    category: "Digital",
    riskType: 'project',
    originalLikelihood: 3,
    originalConsequence: 4,
    originalScore: 12,
    currentLikelihood: 3,
    currentConsequence: 4,
    currentScore: 12,
    icon: Laptop,
    concerns: "EMIS/SystemOne interoperability delays or technical issues. Potential data sharing consent complications with the 550 opt-outs.",
    mitigation: "Parallel testing phase from February; fallback to telephone triage protocols; dedicated IT support during go-live week.",
    owner: "Digital Lead",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Testing schedule confirmed; IT support contract in place; Fallback protocols documented",
    comments: "ICB digital team providing support. Testing window confirmed Feb 2026."
  },
  {
    id: 5,
    risk: "Estate Readiness",
    category: "Estates",
    riskType: 'project',
    originalLikelihood: 3,
    originalConsequence: 3,
    originalScore: 9,
    currentLikelihood: 2,
    currentConsequence: 3,
    currentScore: 6,
    icon: Building2,
    concerns: "Parks Medical Centre or BMC Hub rooms not ready/equipped by April. Potential delays in equipment procurement or building works.",
    mitigation: "Early works schedule commencing January; alternative venue contingency identified (Brackley Community Centre); equipment pre-ordered.",
    owner: "Estates Lead",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Works schedule confirmed; Equipment ordered; Contingency venue identified",
    comments: "Room allocation confirmed. Minor works scheduled for February."
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
    owner: "Programme Lead",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Partner meetings scheduled; Patient engagement plan in place; Transport options identified",
    comments: "Good engagement at December practice meetings. January patient sessions planned."
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
    owner: "Programme Lead",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "CQC liaison established; Application timeline agreed; Contingency plan documented",
    comments: "CQC engagement positive. Application to be submitted Q1 2026."
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
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Recruitment timeline agreed; Salary benchmarking complete; Agency contingency in place",
    comments: "Linked to Risk #3. Admin recruitment to commence January."
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
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Insurance review complete; All practices confirmed cover; MDO guidance received",
    comments: "Amanda Taylor reviewing current policies. Checklist to be circulated January."
  },
  
  // NEW RISKS FROM PML (V1.1)
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
    lastReviewed: "18/12/2025",
    assuranceIndicators: "ToR ratified; Escalation framework agreed; Workstream leads identified",
    comments: "ToR to be finalised at 23 Dec Board meeting. Clear delineation between PB and SNO operational matters needed."
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
    concerns: "Multi-stranded patient and population engagement strategy not yet fully developed. Risk of patient confusion, poor uptake, or negative publicity if communications not coordinated effectively.",
    mitigation: "Dedicated communications workstream; Patient engagement events scheduled; Practice-level briefing packs; ICB communications team support; Phased messaging strategy aligned to programme milestones.",
    owner: "Managerial Lead",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Communications plan approved; Patient materials drafted; Practice briefings scheduled",
    comments: "High priority - score 20. Requires dedicated resource. ICB comms team engagement needed urgently."
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
    concerns: "ICB grant application and monthly reporting requirements not yet fully understood. Risk of delayed funding or clawback if reporting not compliant.",
    mitigation: "Monthly financial reporting framework established; Named finance lead identified; Clear grant expenditure tracking; ICB finance liaison for guidance on requirements.",
    owner: "Finance Lead",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Reporting template agreed; Finance lead confirmed; First report submitted on time",
    comments: "£30k grant secured. Monthly reporting to ICB required. Template to be agreed with ICB finance."
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
    concerns: "Part B clinic planning (Frailty/COPD) not yet finalised. Risk of delayed innovation pilots or failure to meet proactive care commitments tied to Part A funding.",
    mitigation: "Part B workstream established; Clinical leads identified for Frailty and COPD; Pathway mapping underway; Integration with existing practice chronic disease management; Pilot sites identified.",
    owner: "Clinical Director",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "Clinical leads confirmed; Pathways mapped; Pilot sites agreed; Coding requirements defined",
    comments: "Critical dependency on Part A funding. Frailty pathway prioritised for Q2 2026 launch."
  },
  {
    id: 14,
    risk: "SDA Delivery Model",
    category: "Operational",
    riskType: 'operational',
    originalLikelihood: 4,
    originalConsequence: 5,
    originalScore: 20,
    currentLikelihood: 4,
    currentConsequence: 5,
    currentScore: 20,
    icon: Building2,
    concerns: "Hub/spoke appointment delivery model and SOPs not yet fully developed. Risk of operational confusion, patient safety issues, or inconsistent service delivery across sites.",
    mitigation: "Hub operational protocols being developed; Standard Operating Procedures (SOPs) workstream; Staff training programme; Patient journey mapping; Clear escalation pathways between hub and spoke sites.",
    owner: "Programme Board",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "SOPs drafted; Training programme agreed; Patient pathways documented; Escalation routes clear",
    comments: "High priority - score 20. SOPs critical for go-live. Training must be complete by March 2026."
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
    concerns: "Performance dashboard metrics and coding requirements not yet finalised. Risk of inability to demonstrate outcomes, potential funding clawback, or inability to evidence value of SDA model.",
    mitigation: "KPI workstream established; Dashboard specification drafted; Coding guidance being developed with ICB; Baseline data collection underway; Quarterly reporting framework aligned to ICB requirements.",
    owner: "Digital Lead",
    lastReviewed: "18/12/2025",
    assuranceIndicators: "KPIs agreed with ICB; Dashboard live; Coding training complete; Baseline established",
    comments: "High priority - score 20. KPI definitions pending ICB confirmation. Critical for Part A/B conditionality."
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
