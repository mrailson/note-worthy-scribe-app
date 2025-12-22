import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Shield, Scale, Users, PoundSterling, UserCheck, Building2, Laptop, Handshake, FileText, Heart } from "lucide-react";

const decisions = [
  { id: 1, title: "Brook Hub/Spoke Status", desc: "Final decision on designation for April go-live." },
  { id: 2, title: "ToR Ratification", desc: "Approval of final Governance framework." },
  { id: 3, title: "Innovation Pilots", desc: "Agreement on specific Part B clinics (Frailty/COPD)." },
  { id: 4, title: "Recruitment Panels", desc: "Establishing the JD and Interview groups for January." },
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

      {/* VCSE Infrastructure Partners */}
      <Card className="bg-white border-0 shadow-sm border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-green-600" />
            VCSE Infrastructure Partners
          </CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 w-fit">
            Task & Finish Meeting: 22 Dec 2025
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">Meeting Summary</h4>
            <p className="text-sm text-green-800">
              Meeting discussed integration of voluntary sector into South Rural innovation site and SDA project. Primary focus on collaboration to improve patient outcomes in long-term and complex care, whilst ensuring financial viability.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 text-sm mb-2">Key Outcomes</h4>
              <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                <li>VCSE representation on Programme Board agreed</li>
                <li>Helen & Russ to act as conduit to wider sector</li>
                <li>Innovation Fund available for practice pilots</li>
                <li>Two-year pilot to demonstrate ROI to ICB</li>
              </ul>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 text-sm mb-2">Target Cohorts (Feb 2026)</h4>
              <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                <li>Frailty</li>
                <li>Children's mental health in schools</li>
                <li>Diabetes/Hypertension</li>
                <li>Long-term complex conditions</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 text-sm mb-2">Priority Actions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                <span className="text-slate-700">Helen & Russ: Confirm Board representation by 05/01</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                <span className="text-slate-700">Helen: Attend Programme Board 23 Dec at BMC</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Med</Badge>
                <span className="text-slate-700">Maureen: Send background presentations by 05/01</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">High</Badge>
                <span className="text-slate-700">TBC: Establish KPIs with ICB/Neighbourhoods (Feb)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-slate-100">Attendees: Mark Graham, Amanda Taylor, Maureen Green, Ellie, Russ, Helen</Badge>
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
