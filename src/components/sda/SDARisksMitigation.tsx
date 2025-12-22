import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Shield, Scale, Users, PoundSterling, UserCheck, Building2, Laptop, Handshake, FileText, ClipboardCheck, ShieldCheck, FileCheck, Calendar, Target, Pill, DoorOpen, RefreshCw, ShieldAlert, Database, Banknote, HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";

const decisions = [
  { id: 1, title: "Brook Hub/Spoke Status", desc: "Final decision on designation for April go-live." },
  { id: 2, title: "ToR Ratification", desc: "Approval of final Governance framework." },
  { id: 3, title: "Innovation Pilots", desc: "Agreement on specific Part B clinics (Frailty/COPD)." },
  { id: 4, title: "Recruitment Panels", desc: "Establishing the JD and Interview groups for January." },
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

const projectRisks = [
  {
    id: 1,
    risk: "Legal: GMS Agreement Change",
    category: "Legal/Contract",
    rating: "HIGH",
    icon: FileText,
    concerns: "Neighbourhood model requires formal variation to GMS contracts for participating practices. Without legal sign-off, practices cannot formally participate in shared clinics.",
    mitigation: "Early engagement with NHSE legal team; template variation drafted for January review; legal opinion sought on 'collaborative working' interpretation.",
    owner: "ICB Legal"
  },
  {
    id: 2,
    risk: "Financial Governance - Centralised PML Funding",
    category: "Financial",
    rating: "HIGH",
    icon: PoundSterling,
    concerns: "All practice funding will flow through PML, not retained by individual practices. Key questions: What happens if practices disagree on spend priorities? How are practice contributions calculated and tracked? What is the exit mechanism if a practice leaves? Who has signatory authority on the pooled fund? How is transparency ensured?",
    mitigation: "Formal SLA between PML and practices; independent annual audit; clear governance ToR with weighted voting rights; ring-fencing of practice allocations; defined exit clause with 90-day notice period; quarterly financial reporting to all partners.",
    owner: "PML Board / PCN Leads"
  },
  {
    id: 3,
    risk: "Recruitment & Workforce",
    category: "Workforce",
    rating: "HIGH",
    icon: UserCheck,
    concerns: "Failure to recruit sufficient GPs/ANPs by April 2026 go-live. Competition from other neighbourhoods and private sector for limited workforce pool.",
    mitigation: "Brackley Medical Centre has identified a candidate (new GP) for the pilot. Early advertisement (Jan 2026); competitive packages with portfolio career options; flexible working arrangements; partnership with local training practices.",
    owner: "HR Lead"
  },
  {
    id: 4,
    risk: "Digital Integration",
    category: "Digital",
    rating: "MEDIUM",
    icon: Laptop,
    concerns: "EMIS/SystemOne interoperability delays or technical issues. Potential data sharing consent complications with the 550 opt-outs.",
    mitigation: "Parallel testing phase from February; fallback to telephone triage protocols; dedicated IT support during go-live week.",
    owner: "Digital Lead"
  },
  {
    id: 5,
    risk: "Estate Readiness",
    category: "Estates",
    rating: "MEDIUM",
    icon: Building2,
    concerns: "Parks Medical Centre or BMC Hub rooms not ready/equipped by April. Potential delays in equipment procurement or building works.",
    mitigation: "Early works schedule commencing January; alternative venue contingency identified (Brackley Community Centre); equipment pre-ordered.",
    owner: "Estates Lead"
  },
  {
    id: 6,
    risk: "Stakeholder Buy-in",
    category: "Engagement",
    rating: "LOW-MEDIUM",
    icon: Handshake,
    concerns: "Practice partners or staff resistance to new working model. Patient concern about travelling to Hub locations.",
    mitigation: "Regular partner engagement sessions; clear governance and benefits communication; patient engagement events in January; transport support for vulnerable patients.",
    owner: "Programme Lead"
  },
  {
    id: 7,
    risk: "CQC Registration Delay",
    category: "Regulatory",
    rating: "HIGH",
    icon: ClipboardCheck,
    concerns: "CQC registration not approved before April 2026 go-live, preventing service launch. Registration process delays could impact entire programme timeline.",
    mitigation: "Early CQC engagement initiated; application submitted with buffer time; regular progress tracking with CQC liaison; contingency plans for phased launch if delays occur.",
    owner: "Programme Lead"
  },
  {
    id: 8,
    risk: "Recruitment Shortfall",
    category: "Workforce",
    rating: "HIGH",
    icon: UserCheck,
    concerns: "Unable to recruit sufficient clinical and administrative staff by go-live. Competition for limited workforce pool may delay operational readiness.",
    mitigation: "Early recruitment campaign (Jan 2026); competitive salary packages; flexible working options; partnership with training practices; contingency for agency cover during initial phase.",
    owner: "HR Lead"
  },
  {
    id: 9,
    risk: "Insurance & Indemnity Gaps",
    category: "Legal/Insurance",
    rating: "HIGH",
    icon: ShieldCheck,
    concerns: "Inadequate insurance cover or indemnity arrangements for new service model. Practices may have gaps in coverage for Hub-based working.",
    mitigation: "Insurance review underway (Amanda Taylor checking); confirmation checklist for all practices; early engagement with MDOs; template indemnity arrangements being drafted.",
    owner: "Amanda Taylor"
  }
];

const getRatingBadgeStyles = (rating: string) => {
  switch (rating) {
    case "HIGH":
      return "bg-red-100 text-red-700 border-red-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "LOW-MEDIUM":
      return "bg-green-100 text-green-700 border-green-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export const SDARisksMitigation = () => {
  return (
    <div className="space-y-6">
      {/* LES Contract: Top 10 Practice Awareness Points */}
      <Card className="bg-white border-0 shadow-sm border-t-4 border-t-[#005EB8]">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#005EB8] flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900">LES Contract: Top 10 Practice Awareness Points</CardTitle>
                <p className="text-sm text-slate-500">Key issues from the GMS Contract Variation – with ICB clarifications received 18 Dec 2025</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-[#005EB8] border-[#005EB8]">
              Meeting: Brackley 23 Dec 2025
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          {/* Outstanding Questions Summary */}
          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              <h4 className="font-semibold text-amber-900">Outstanding Questions for Brackley Meeting (23 Dec)</h4>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {outstandingQuestions.map((question, index) => (
                <li key={index} className="text-sm text-amber-800 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-semibold text-xs flex-shrink-0">
                    {index + 1}
                  </span>
                  {question}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Legal: GMS Agreement Change */}
        <Card className="bg-white border-0 shadow-sm border-l-4 border-l-red-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-500" />
              <CardTitle className="text-lg font-semibold text-slate-900">Legal: GMS Contract Variation Required</CardTitle>
            </div>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 w-fit">
              CRITICAL PARTNER DECISION REQUIRED
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2">The Core Issue</h4>
              <p className="text-sm text-red-800">
                The Neighbourhood Model requires a <strong>formal variation to each practice's GMS contract</strong>. Without this legal sign-off, practices cannot formally participate in shared Hub clinics or pool resources under PML.
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 text-sm mb-2">Key Partner Decisions</h4>
              <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                <li>Do we need independent legal review before signing?</li>
                <li>Do we contract as individual practices or collectively via PML?</li>
                <li>What governance protections are needed before signing?</li>
                <li>Who has authority to sign on behalf of each partnership?</li>
              </ul>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-900 text-sm mb-1">LMC Recommendation</h4>
              <p className="text-sm text-blue-700 italic">Awaiting LMC guidance - to be added.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-slate-100">GMS Variation</Badge>
              <Badge variant="outline" className="bg-slate-100">NHSE Legal</Badge>
              <Badge variant="outline" className="bg-slate-100">Partner Sign-off</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Financial Governance - PML Funding */}
        <Card className="bg-white border-0 shadow-sm border-l-4 border-l-red-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PoundSterling className="w-5 h-5 text-red-500" />
              <CardTitle className="text-lg font-semibold text-slate-900">Financial: Centralised PML Funding Model</CardTitle>
            </div>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 w-fit">
              CRITICAL PARTNER DECISION REQUIRED
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2">The Core Issue</h4>
              <p className="text-sm text-red-800">
                All practice funding will flow through PML, <strong>not retained by individual practices</strong>. This is a fundamental change to how practices receive and control their income.
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 text-sm mb-2">Key Questions for Partners</h4>
              <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                <li>What happens if practices disagree on spend priorities?</li>
                <li>How are practice contributions calculated and tracked?</li>
                <li>What is the exit mechanism if a practice leaves?</li>
                <li>Who has signatory authority on the pooled fund?</li>
                <li>How is transparency of spend ensured?</li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-slate-100">Pooled Funding</Badge>
              <Badge variant="outline" className="bg-slate-100">PML Governance</Badge>
              <Badge variant="outline" className="bg-slate-100">Exit Clause</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Risks Register */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Project Risks Register
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[50px] font-semibold">#</TableHead>
                  <TableHead className="font-semibold">Risk</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Rating</TableHead>
                  <TableHead className="font-semibold min-w-[250px]">Key Concerns</TableHead>
                  <TableHead className="font-semibold min-w-[250px]">Mitigation</TableHead>
                  <TableHead className="font-semibold">Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectRisks.map((risk) => {
                  const IconComponent = risk.icon;
                  return (
                    <TableRow key={risk.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-semibold text-slate-500">{risk.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <span className="font-medium text-slate-900">{risk.risk}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                          {risk.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getRatingBadgeStyles(risk.rating)}>
                          {risk.rating}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{risk.concerns}</TableCell>
                      <TableCell className="text-sm text-slate-600">{risk.mitigation}</TableCell>
                      <TableCell className="text-sm font-medium text-slate-700">{risk.owner}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Board Decisions Pipeline */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#005EB8]" />
            Board Decisions Pipeline: 23 Dec 2025
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {decisions.map((decision) => (
              <div 
                key={decision.id} 
                className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200"
              >
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[#005EB8] flex items-center justify-center text-white font-bold text-sm">
                  {decision.id}
                </div>
                <h4 className="font-semibold text-slate-900 mt-2">{decision.title}</h4>
                <p className="text-sm text-slate-600 mt-1">{decision.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
