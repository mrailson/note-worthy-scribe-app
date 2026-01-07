import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, Shield, Scale, Users, PoundSterling, UserCheck, Building2, Laptop, Handshake, FileText, ClipboardCheck, ShieldCheck, FileCheck, Calendar, Target, Pill, DoorOpen, RefreshCw, ShieldAlert, Database, Banknote, HelpCircle, CheckCircle2, AlertCircle, ChevronDown, TrendingDown, TrendingUp, Minus, ArrowUpDown, ArrowUp, ArrowDown, Clock, Gavel, UserPlus, ShieldCheck as InsuranceIcon, UsersRound } from "lucide-react";
import { RiskAssessmentGuidance } from "./risk-register/RiskAssessmentGuidance";
import { RiskMatrixHeatmap } from "./risk-register/RiskMatrixHeatmap";
import { projectRisks, getRatingFromScore, getRatingBadgeStyles, getRiskTypeBadgeStyles, getRiskTypeLabel, ProjectRisk } from "./risk-register/projectRisksData";

type SortField = 'id' | 'risk' | 'riskType' | 'originalScore' | 'currentScore' | 'category' | 'owner';
type SortDirection = 'asc' | 'desc';
type DecisionStatus = 'decision-required' | 'pending-review' | 'ready';

interface BoardDecision {
  id: number;
  title: string;
  desc: string;
  status: DecisionStatus;
  options?: string[];
  note?: string;
  targetDate?: string;
  notPreferred?: string;
}

// January 2026 Decision Pipeline - Pending items carried forward
const januaryDecisions: BoardDecision[] = [
  { 
    id: 1, 
    title: "Brook Hub/Spoke Status", 
    desc: "Designation for April go-live – Brook practice currently reviewing capacity.",
    status: "pending-review",
    options: ["Hub", "Spoke"],
    note: "Carried forward from Dec 2025 – awaiting Brook capacity review",
    targetDate: "27th January 2026"
  },
  { 
    id: 2, 
    title: "Innovation Pilots", 
    desc: "Agreement on specific Part B clinics (Frailty/COPD).",
    status: "pending-review",
    note: "Carried forward – Part B options and outcomes still under consideration"
  },
  { 
    id: 3, 
    title: "Insurance Approach", 
    desc: "How practices obtain insurance for the programme.",
    status: "pending-review",
    note: "Carried forward – Amanda Taylor verifying insurance amounts with each practice"
  },
  { 
    id: 4, 
    title: "Recruitment Panels", 
    desc: "Establishing the JD and Interview groups.",
    status: "pending-review",
    note: "Carried forward – Malcolm arranging recruitment panel with PML",
    targetDate: "27th January 2026"
  },
  { 
    id: 5, 
    title: "Host Organisation", 
    desc: "Determine whether PML or individual practice will host employed staff.",
    status: "decision-required",
    options: ["PML", "Practice"],
    note: "NEW – Critical decision required for recruitment to proceed"
  },
  { 
    id: 6, 
    title: "Hub & Spoke Model", 
    desc: "Finalise the estates model for hub and spoke locations.",
    status: "pending-review",
    note: "Hub and spoke sessions ongoing – required for equipment procurement"
  },
  { 
    id: 7, 
    title: "Equipment Procurement", 
    desc: "Agree equipment inventory and costings for clinical/non-clinical items.",
    status: "pending-review",
    note: "Dependent on Hub/Spoke model agreement"
  },
  { 
    id: 8, 
    title: "Digital Access (ICE/SystmOne)", 
    desc: "Confirm ICE ordering access and SystmOne slot type configuration.",
    status: "pending-review",
    note: "ICB digital team engagement ongoing"
  },
];

// 23 December 2025 Decision Pipeline - Approved items only
const decemberDecisions: BoardDecision[] = [
  { 
    id: 1, 
    title: "ToR Ratification", 
    desc: "Approval of final Governance framework.",
    status: "ready",
    note: "✓ Ratified at Programme Board meeting on 23 December 2025"
  },
  { 
    id: 2, 
    title: "Recruitment Model", 
    desc: "How staff are employed for the SDA programme.",
    status: "ready",
    note: "✓ Decision reached – Malcolm to create job adverts for Indeed and NHS Jobs"
  },
  { 
    id: 3, 
    title: "Legal Review for LES", 
    desc: "Whether legal review is required for the LES enhancement to GMS contract.",
    status: "ready",
    note: "✓ Actioned – Joining with Wellingborough to Hensons Solicitors via LMC for review"
  },
  { 
    id: 4, 
    title: "PPG Protocol", 
    desc: "Patient Participation Group protocol and nominee numbers per practice.",
    status: "ready",
    note: "✓ Process agreed by Board – to be shared with Practice Managers and PPGs"
  },
];

const lesAwarenessPoints = [
  {
    id: 1,
    title: "Term & Termination",
    icon: Calendar,
    keyPoints: "Minimum 24-month pilot (1 Apr 2026 – 31 Mar 2028); 6 months' notice required to exit.",
    icbClarification: "ICB confirmed earliest notice is 1 Oct 2027, effective exit 31 Mar 2028.",
    status: "confirmed",
    outstandingQuestion: "Can practices serve notice within the pilot period, or only the ICB?"
  },
  {
    id: 2,
    title: "Funding Flow via SNO (PML)",
    icon: PoundSterling,
    keyPoints: "All payments go to PML at £26.33/patient/month; practices do not retain funds directly.",
    icbClarification: "Payments made monthly in arrears based on list size, like any other Enhanced Service payment.",
    status: "confirmed",
    outstandingQuestion: "Practices must agree funding distribution with PML. SNO-to-Practice MOU recommended but not yet drafted."
  },
  {
    id: 3,
    title: "Part A / Part B Conditionality",
    icon: Target,
    keyPoints: "Access to Part A 'held funds' is conditional on delivering Part B proactive care commitments.",
    icbClarification: "ICB confirmed: operational challenges understood, but KPI achievement required for Board to approve ongoing funding.",
    status: "confirmed",
    outstandingQuestion: "What happens if delivery constraints arise from workforce/estates issues rather than practice intent?"
  },
  {
    id: 4,
    title: "KPIs & Performance Thresholds",
    icon: ClipboardCheck,
    keyPoints: "KPIs being developed with neighbourhoods; will define baseline proactive care levels expected across all practices.",
    icbClarification: "Failure = improvement plans → reallocation of appointments → potential termination/clawback.",
    status: "pending",
    outstandingQuestion: "Specific KPI definitions, coding requirements, and measurement frequency still TBC."
  },
  {
    id: 5,
    title: "Prescribing Budget Oversight",
    icon: Pill,
    keyPoints: "NAS prescribing sits within primary care prescribing budget; must follow formulary guidance.",
    icbClarification: "Linked to Prescribing Achievement Framework. ICB prescribing team to issue further guidance.",
    status: "pending",
    outstandingQuestion: "How will prescribing variances be treated – is there financial risk to practices?"
  },
  {
    id: 6,
    title: "Practice Exit / Neighbourhood Viability",
    icon: DoorOpen,
    keyPoints: "If one practice exits, viability of remaining neighbourhood is at ICB's discretion.",
    icbClarification: "ICB may terminate contract if minimum standards cannot be met after a practice leaves or merges.",
    status: "confirmed",
    outstandingQuestion: "What constitutes 'good faith' protection for remaining practices if one exits?"
  },
  {
    id: 7,
    title: "SNO Change Process",
    icon: RefreshCw,
    keyPoints: "Any change to SNO requires prior written consent from the ICB.",
    icbClarification: "Transition requires governance review, updated MOU, operational handover plan. New SNO must meet specification criteria.",
    status: "confirmed",
    outstandingQuestion: "What is the process if practices collectively wish to change the SNO arrangement?"
  },
  {
    id: 8,
    title: "Insurance Requirements",
    icon: ShieldAlert,
    keyPoints: "Must hold: Employer's Liability (£5m), Public Liability (£10m), Professional Negligence (£5m), Clinical Negligence (£10m).",
    icbClarification: "Each practice must self-certify or provide evidence of coverage.",
    status: "pending",
    outstandingQuestion: "Amanda Taylor checking current coverage. All practices need to confirm adequacy."
  },
  {
    id: 9,
    title: "Data Submission & Reporting",
    icon: Database,
    keyPoints: "Monthly data submissions mandatory; named reporting lead required per practice.",
    icbClarification: "Failure to submit = performance review → interrogation → remodelling → termination/clawback.",
    status: "confirmed",
    outstandingQuestion: "What specific data items are required? What is the exact reporting template?"
  },
  {
    id: 10,
    title: "Stranded Costs Protection",
    icon: Banknote,
    keyPoints: "ICB will reimburse up to £305,219 for redundancy costs if pilot ends 31 Mar 2028.",
    icbClarification: "Costs must be itemised; redeployment efforts required; 60-day payment terms after ICB agreement.",
    status: "confirmed",
    outstandingQuestion: "Does this cover all potential stranded costs or just redundancy? What evidence is required?"
  }
];

const outstandingQuestions = [
  "SNO MOU between PML and practices – template/draft still to be shared",
  "Clarity on who can serve notice and when (practices vs ICB during pilot period)",
  "Detail on how Part B threshold measurements will work in practice",
  "Specific KPI definitions and clinical coding requirements",
  "What constitutes 'good faith' protection for remaining practices if one exits?",
  "How will prescribing variances be treated – financial risk to practices?",
  "Insurance confirmation from all practices needed"
];

// Risk summary calculations
const riskSummary = {
  high: projectRisks.filter(r => r.currentScore >= 16).length,
  significant: projectRisks.filter(r => r.currentScore >= 10 && r.currentScore < 16).length,
  moderate: projectRisks.filter(r => r.currentScore >= 5 && r.currentScore < 10).length,
  low: projectRisks.filter(r => r.currentScore < 5).length,
  requiresEscalation: projectRisks.filter(r => r.currentScore >= 12).length,
};

export const SDARisksMitigation = () => {
  const [sortField, setSortField] = useState<SortField>('currentScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const getScoreChangeIndicator = (original: number, current: number) => {
    if (current < original) return <TrendingDown className="w-3 h-3 text-green-600" />;
    if (current > original) return <TrendingUp className="w-3 h-3 text-red-600" />;
    return <Minus className="w-3 h-3 text-slate-400" />;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-[#005EB8]" />
      : <ArrowDown className="w-3 h-3 ml-1 text-[#005EB8]" />;
  };

  const sortedRisks = useMemo(() => {
    const sorted = [...projectRisks].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'risk':
          aValue = a.risk.toLowerCase();
          bValue = b.risk.toLowerCase();
          break;
        case 'riskType':
          const typeOrder = { principal: 0, operational: 1, project: 2 };
          aValue = typeOrder[a.riskType];
          bValue = typeOrder[b.riskType];
          break;
        case 'originalScore':
          aValue = a.originalScore;
          bValue = b.originalScore;
          break;
        case 'currentScore':
          aValue = a.currentScore;
          bValue = b.currentScore;
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'owner':
          aValue = a.owner.toLowerCase();
          bValue = b.owner.toLowerCase();
          break;
        default:
          aValue = a.currentScore;
          bValue = b.currentScore;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [sortField, sortDirection]);

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={["risk-guidance", "les-contract", "critical-decisions", "risks-register", "board-decisions"]} className="space-y-4">
        
        {/* PML Risk Assessment Framework */}
        <RiskAssessmentGuidance />

        {/* Project Risks Register */}
        <AccordionItem value="risks-register" className="border-0">
          <Card className="bg-white border-0 shadow-sm">
            <AccordionTrigger className="hover:no-underline px-6 py-4 [&[data-state=open]>div>svg.chevron]:rotate-180">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                  <div className="text-left">
                    <CardTitle className="text-lg font-semibold text-slate-900">Project Risks Register</CardTitle>
                    <p className="text-sm text-slate-500">Full risk register with PML framework – {projectRisks.length} risks tracked</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {riskSummary.high} High
                  </Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {riskSummary.significant} Significant
                  </Badge>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    {riskSummary.requiresEscalation} Require Escalation (≥12)
                  </Badge>
                  <ChevronDown className="chevron h-5 w-5 text-slate-500 transition-transform duration-200" />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0 space-y-6">
                
                {/* Risk Matrix Heatmap */}
                <RiskMatrixHeatmap risks={projectRisks} />

                {/* Risk Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead 
                          className="w-[40px] font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('id')}
                        >
                          <div className="flex items-center"># {getSortIcon('id')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('risk')}
                        >
                          <div className="flex items-center">Risk {getSortIcon('risk')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('riskType')}
                        >
                          <div className="flex items-center">Type {getSortIcon('riskType')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs text-center cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('originalScore')}
                        >
                          <div className="flex items-center justify-center">Original<br/>Score {getSortIcon('originalScore')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs text-center cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('currentScore')}
                        >
                          <div className="flex items-center justify-center">Current<br/>Score {getSortIcon('currentScore')}</div>
                        </TableHead>
                        <TableHead 
                          className="font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('currentScore')}
                        >
                          <div className="flex items-center">Rating {getSortIcon('currentScore')}</div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs min-w-[200px]">Key Concerns</TableHead>
                        <TableHead className="font-semibold text-xs min-w-[200px]">Mitigation</TableHead>
                        <TableHead 
                          className="font-semibold text-xs cursor-pointer hover:bg-slate-100"
                          onClick={() => handleSort('owner')}
                        >
                          <div className="flex items-center">Owner {getSortIcon('owner')}</div>
                        </TableHead>
                        <TableHead className="font-semibold text-xs">Last<br/>Reviewed</TableHead>
                        <TableHead className="font-semibold text-xs min-w-[150px]">Assurance Indicators</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRisks.map((risk) => {
                        const IconComponent = risk.icon;
                        return (
                          <TableRow key={risk.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-semibold text-slate-500 text-xs">{risk.id}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <IconComponent className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                <div>
                                  <span className="font-medium text-slate-900 text-xs">{risk.risk}</span>
                                  {risk.comments && (
                                    <p className="text-[10px] text-slate-500 mt-0.5">{risk.comments}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${getRiskTypeBadgeStyles(risk.riskType)} text-[10px]`}>
                                {getRiskTypeLabel(risk.riskType)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="text-xs text-slate-500">
                                {risk.originalLikelihood}×{risk.originalConsequence}=
                                <span className="font-semibold">{risk.originalScore}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs">
                                  {risk.currentLikelihood}×{risk.currentConsequence}=
                                  <span className="font-bold">{risk.currentScore}</span>
                                </span>
                                {getScoreChangeIndicator(risk.originalScore, risk.currentScore)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${getRatingBadgeStyles(risk.currentScore)} text-[10px]`}>
                                {getRatingFromScore(risk.currentScore)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-600">{risk.concerns}</TableCell>
                            <TableCell className="text-[11px] text-slate-600">{risk.mitigation}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-700">{risk.owner}</TableCell>
                            <TableCell className="text-xs text-slate-500">{risk.lastReviewed}</TableCell>
                            <TableCell className="text-[11px] text-slate-600">{risk.assuranceIndicators}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Risk Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="text-2xl font-bold text-red-700">{riskSummary.high}</div>
                    <div className="text-xs text-red-600">High (16-25)</div>
                    <div className="text-[10px] text-red-500 mt-1">Immediate action required</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-2xl font-bold text-amber-700">{riskSummary.significant}</div>
                    <div className="text-xs text-amber-600">Significant (10-15)</div>
                    <div className="text-[10px] text-amber-500 mt-1">Active management</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-700">{riskSummary.moderate}</div>
                    <div className="text-xs text-yellow-600">Moderate (5-9)</div>
                    <div className="text-[10px] text-yellow-500 mt-1">Monitor and manage</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-700">{riskSummary.low}</div>
                    <div className="text-xs text-green-600">Low (1-4)</div>
                    <div className="text-[10px] text-green-500 mt-1">Routine monitoring</div>
                  </div>
                </div>

                {/* Escalation Notice */}
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Governance Escalation Required</h4>
                  </div>
                  <p className="text-sm text-purple-700">
                    <strong>{riskSummary.requiresEscalation} risks</strong> have a score of ≥12 and require review by the Programme Board and ICB per the PML Risk Assessment Framework.
                  </p>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
        
        {/* LES Contract: Top 10 Practice Awareness Points */}
        <AccordionItem value="les-contract" className="border-0">
          <Card className="bg-white border-0 shadow-sm border-t-4 border-t-[#005EB8]">
            <AccordionTrigger className="hover:no-underline px-6 py-4 [&[data-state=open]>div>svg.chevron]:rotate-180">
              <div className="flex items-center justify-between flex-wrap gap-4 w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#005EB8] flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-lg font-semibold text-slate-900">LES Contract: Top 10 Practice Awareness Points</CardTitle>
                    <p className="text-sm text-slate-500">Key issues from the GMS Contract Variation – with ICB clarifications received 18 Dec 2025</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-blue-50 text-[#005EB8] border-[#005EB8]">
                    Meeting: Brackley 23 Dec 2025
                  </Badge>
                  <ChevronDown className="chevron h-5 w-5 text-slate-500 transition-transform duration-200" />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-4 pt-0">
                {/* Programme Board Meeting Update */}
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">Programme Board Meeting Update (23 Dec 2025)</h4>
                  </div>
                  <p className="text-sm text-green-800 leading-relaxed">
                    These matters were discussed at the Programme Board Meeting. The Practices are joining the 
                    <strong> Wellingborough Neighbourhood</strong> and are obtaining <strong>legal advice</strong> as 
                    part of the due diligence for this pilot project.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  {lesAwarenessPoints.map((point) => {
                    const IconComponent = point.icon;
                    return (
                      <div 
                        key={point.id}
                        className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200"
                      >
                        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[#005EB8] flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {point.id}
                        </div>
                        <div className="flex items-start gap-3 mt-1">
                          <IconComponent className="w-5 h-5 text-[#005EB8] flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-slate-900">{point.title}</h4>
                              {point.status === "confirmed" ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  ICB Confirmed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 mt-1">{point.keyPoints}</p>
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                              <p className="text-xs text-blue-800">
                                <strong>ICB Response:</strong> {point.icbClarification}
                              </p>
                            </div>
                            {point.outstandingQuestion && (
                              <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100">
                                <p className="text-xs text-amber-800 flex items-start gap-1">
                                  <HelpCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                  <span><strong>Outstanding:</strong> {point.outstandingQuestion}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* January 2026 Decision Pipeline */}
        <AccordionItem value="january-decisions" className="border-0">
          <Card className="bg-white border-0 shadow-sm">
            <AccordionTrigger className="hover:no-underline px-6 py-4 [&[data-state=open]>div>svg.chevron]:rotate-180">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-[#005EB8]" />
                  <div className="text-left">
                    <CardTitle className="text-lg font-semibold text-slate-900">Board Decisions Pipeline: January 2026</CardTitle>
                    <p className="text-sm text-slate-500">Key decisions pending for the January Board meeting</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {januaryDecisions.filter(d => d.status === 'decision-required').length} Decision Required
                  </Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {januaryDecisions.filter(d => d.status === 'pending-review').length} Pending Review
                  </Badge>
                  <ChevronDown className="chevron h-5 w-5 text-slate-500 transition-transform duration-200" />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 pt-4">
                  {januaryDecisions.map((decision) => {
                    const statusStyles = {
                      'decision-required': {
                        bg: 'bg-gradient-to-br from-red-50 to-red-100',
                        border: 'border-red-200',
                        badge: 'bg-red-100 text-red-700 border-red-300',
                        badgeText: 'Decision Required',
                        numberBg: 'bg-red-600'
                      },
                      'pending-review': {
                        bg: 'bg-gradient-to-br from-amber-50 to-amber-100',
                        border: 'border-amber-200',
                        badge: 'bg-amber-100 text-amber-700 border-amber-300',
                        badgeText: 'Pending Review',
                        numberBg: 'bg-amber-500'
                      },
                      'ready': {
                        bg: 'bg-gradient-to-br from-blue-50 to-slate-100',
                        border: 'border-blue-200',
                        badge: 'bg-blue-100 text-blue-700 border-blue-300',
                        badgeText: 'Approved by Board',
                        numberBg: 'bg-[#005EB8]'
                      }
                    };
                    const styles = statusStyles[decision.status];
                    
                    return (
                      <div 
                        key={decision.id} 
                        className={`relative ${styles.bg} rounded-lg p-4 border ${styles.border}`}
                      >
                        <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full ${styles.numberBg} flex items-center justify-center text-white font-bold text-sm`}>
                          {decision.id}
                        </div>
                        <div className="flex justify-end mb-2">
                          <Badge variant="outline" className={`${styles.badge} text-[10px]`}>
                            {styles.badgeText}
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-slate-900">{decision.title}</h4>
                        <p className="text-sm text-slate-600 mt-1">{decision.desc}</p>
                        
                        {decision.options && decision.options.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {decision.options.map((option, idx) => (
                              <Badge 
                                key={idx} 
                                variant="outline" 
                                className={`text-[10px] ${
                                  decision.notPreferred === option 
                                    ? 'bg-slate-100 text-slate-500 border-slate-300 line-through' 
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {option}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {decision.note && (
                          <p className="text-[11px] text-slate-500 mt-2 italic">{decision.note}</p>
                        )}
                        
                        {decision.targetDate && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>Target: {decision.targetDate}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* 23 December 2025 Decision Pipeline - Approved Items */}
        <AccordionItem value="december-decisions" className="border-0">
          <Card className="bg-white border-0 shadow-sm">
            <AccordionTrigger className="hover:no-underline px-6 py-4 [&[data-state=open]>div>svg.chevron]:rotate-180">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-green-600" />
                  <div className="text-left">
                    <CardTitle className="text-lg font-semibold text-slate-900">Board Decisions Pipeline: 23 Dec 2025</CardTitle>
                    <p className="text-sm text-slate-500">Decisions approved at the December Board meeting</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {decemberDecisions.length} Approved by Board
                  </Badge>
                  <ChevronDown className="chevron h-5 w-5 text-slate-500 transition-transform duration-200" />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 pt-4">
                  {decemberDecisions.map((decision) => {
                    const styles = {
                      bg: 'bg-gradient-to-br from-green-50 to-green-100',
                      border: 'border-green-200',
                      badge: 'bg-green-100 text-green-700 border-green-300',
                      badgeText: 'Approved by Board',
                      numberBg: 'bg-green-600'
                    };
                    
                    return (
                      <div 
                        key={decision.id} 
                        className={`relative ${styles.bg} rounded-lg p-4 border ${styles.border}`}
                      >
                        <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full ${styles.numberBg} flex items-center justify-center text-white font-bold text-sm`}>
                          {decision.id}
                        </div>
                        <div className="flex justify-end mb-2">
                          <Badge variant="outline" className={`${styles.badge} text-[10px]`}>
                            {styles.badgeText}
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-slate-900">{decision.title}</h4>
                        <p className="text-sm text-slate-600 mt-1">{decision.desc}</p>
                        
                        {decision.note && (
                          <p className="text-[11px] text-green-700 mt-2 italic">{decision.note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

      </Accordion>
    </div>
  );
};
