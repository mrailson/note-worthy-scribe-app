import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Lock, 
  PieChart, 
  ShieldCheck, 
  AlertTriangle, 
  Target, 
  Calendar, 
  Vote, 
  ClipboardList,
  Building2,
  Stethoscope,
  Monitor,
  UserCog,
  Crown,
  CheckCircle2,
  Clock,
  MapPin,
  Download,
  FileText,
  Lightbulb,
  Truck,
  Scale,
  ExternalLink
} from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { useNRESPeople } from "@/contexts/NRESPeopleContext";
import { PeopleDirectoryDialog } from "./PeopleDirectoryDialog";
import { useENNInsuranceChecklist } from "@/hooks/useENNInsuranceChecklist";

const roleIcons: Record<string, any> = {
  "SRO / Chair": Crown,
  "Programme Director": Building2,
  "Clinical Lead": Stethoscope,
  "Supporting Clinical Lead": Stethoscope,
  "Managerial Lead": UserCog,
  "Supporting Managerial Lead": UserCog,
  "Digital & Estates Lead": Monitor,
  "Supporting Digital & Estates Lead": Monitor,
};

const votingRoles = ["SRO / Chair", "Clinical Lead", "Supporting Clinical Lead"];

const nonVotingMembers = [
  "ICB Representative - ensures SDA initiative aligns with service specification",
  "VCSE Representatives - co-opted as appropriate for Third Sector support",
  "Patient Representatives - engaged via task and finish groups and PPG newsletters",
  "Deputies from each practice - may attend if nominated representative unavailable",
];

const keyResponsibilities = [
  "Decision-making Board in collaboration with all membership",
  "Reviewing and approving actions/tasks delegated to operational teams",
  "Scrutinising update reports and directing actions to keep project on time",
  "Producing regular performance reports to submit to the ICB",
  "Escalation of issues that may affect programme progress or reputation",
  "Ensure financial governance within the financial envelope",
  "Agree external and internal communication plans",
  "Agree Key Performance Indicators (KPIs) for measurable positive outcomes",
  "Agree the recruitment strategy to deliver outcomes",
  "Agree the hub and spoke model of care",
  "Agree Part B of the innovation for measurable outcomes",
  "Ensure Standard Operating Procedures and Policies cover all patient pathways",
  "Agree training plan and scope training/skills gaps",
  "Agree Risk Register - reviewed at every meeting and shared at PML Board",
];

const insuranceRequirements = [
  { type: "Employer's (Compulsory) Liability Insurance", amount: "£5,000,000", required: true },
  { type: "Public Liability Insurance", amount: "£10,000,000", required: true },
  { type: "Professional Negligence*", amount: "£5,000,000", required: true },
  { type: "Clinical Negligence†", amount: "£10,000,000", required: true },
];

const practiceInsuranceChecklist = [
  { practice: "Towcester Medical Centre", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£10m", type: "Employers" },
    { confirmed: true, amount: "No Limit", type: "Prof/MDU" },
    { confirmed: true, amount: "No Limit", type: "Clinical/CNSGP" },
  ]},
  { practice: "Brook Health Centre", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£5m", type: "Employers" },
    { confirmed: true, amount: "No Limit", type: "Prof/MDU" },
    { confirmed: true, amount: "No Limit", type: "Clinical/CNSGP" },
  ]},
  { practice: "Brackley Medical Centre", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£10m", type: "Employers" },
    { confirmed: true, amount: "No Limit", type: "Prof/MDU" },
    { confirmed: true, amount: "No Limit", type: "Clinical/CNSGP" },
  ]},
  { practice: "Springfield Surgery", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£10m", type: "Employers" },
    { confirmed: true, amount: "No Limit", type: "Prof/MDU" },
    { confirmed: true, amount: "No Limit", type: "Clinical/CNSGP" },
  ]},
  { practice: "Denton Village Surgery", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£10m", type: "Employers" },
    { confirmed: true, amount: "No Limit", type: "Prof/MDU" },
    { confirmed: true, amount: "No Limit", type: "Clinical/CNSGP" },
  ]},
  { practice: "The Parks Medical Practice", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£10m", type: "Employers" },
    { confirmed: true, amount: "No Limit", type: "Prof/MDU" },
    { confirmed: true, amount: "No Limit", type: "Clinical/CNSGP" },
  ]},
  { practice: "Bugbrooke Medical Practice", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£10m", type: "Employers" },
    { confirmed: true, amount: "No Limit", type: "Prof/MDU" },
    { confirmed: true, amount: "No Limit", type: "Clinical/CNSGP" },
  ]},
  { practice: "Principal Medical Limited (PML)", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£10m", type: "Employers" },
    { confirmed: true, amount: "£10m", type: "Prof Negligence" },
    { confirmed: true, amount: "CNSGP", type: "Clinical" },
  ]},
];

interface SDAFinanceGovernanceProps {
  hideBoardLeadership?: boolean;
  customInsuranceChecklist?: typeof practiceInsuranceChecklist;
  customInsuranceCheckedBy?: string;
  customInsuranceUpdatedDate?: string;
  neighbourhoodName?: 'NRES' | 'ENN';
  interactiveInsurance?: boolean;
}

export const SDAFinanceGovernance = ({ hideBoardLeadership = false, customInsuranceChecklist, customInsuranceCheckedBy, customInsuranceUpdatedDate, neighbourhoodName = 'NRES', interactiveInsurance = false }: SDAFinanceGovernanceProps) => {
  const isENN = neighbourhoodName === 'ENN';
  const { people } = useNRESPeople();
  const [peopleDialogOpen, setPeopleDialogOpen] = useState(false);
  const [activeInsuranceId, setActiveInsuranceId] = useState<string | null>(null);
  const ennChecklist = useENNInsuranceChecklist();

  const seniorLeadership = people.filter((p) => p.isActive).map((p) => ({
    name: p.name,
    role: p.role,
    organisation: p.organisation,
    email: p.email,
    isVoting: votingRoles.includes(p.role),
    icon: roleIcons[p.role] || Users,
  }));

  const handleDownloadTOR = () => {
    const link = document.createElement('a');
    link.href = '/documents/Final_Terms_of_Reference_for_the_Programme_Board_SDA_innovator.pdf';
    link.download = 'Terms_of_Reference_SDA_Programme_Board.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Download TOR Button */}
      <Card className="bg-gradient-to-r from-[#005EB8] to-[#003087] border-0 shadow-lg">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 text-white">
              <FileText className="h-8 w-8" />
              <div>
                <h3 className="font-semibold text-lg">Terms of Reference</h3>
                <p className="text-sm text-blue-100">Official Programme Board governance document</p>
                {isENN ? (
                  <p className="text-sm text-amber-300 mt-1">⏳ TBC — awaiting creation for ENN Programme Board</p>
                ) : (
                  <p className="text-sm text-green-300 mt-1">✓ Approved as final by Programme Board on 23rd December 2025</p>
                )}
              </div>
            </div>
            {!isENN && (
              <Button 
                onClick={handleDownloadTOR}
                variant="secondary"
                className="bg-white text-[#005EB8] hover:bg-blue-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Download TOR (PDF)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#005EB8]" />
            Programme Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-lg text-[#005EB8] mb-2">
              {isENN 
                ? 'Same Day Access Innovator – East Northants Neighbourhood Programme Board'
                : 'Same Day Access Innovator – Rural East and South Programme Board'}
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Part of Northamptonshire ICB New Models of Care programme, helping patients stay well for longer 
              by improving health and care services in local communities across neighbourhoods.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-[#005EB8]">
                <Calendar className="h-3 w-3 mr-1" />
                Launch: {isENN ? 'July 2026' : 'April 2026'}
              </Badge>
              <Badge variant="outline" className="border-[#005EB8] text-[#005EB8]">Neighbourhood Access Service</Badge>
              <Badge variant="outline" className="border-[#005EB8] text-[#005EB8]">Complex Care & Long-Term Conditions</Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Providing Assurance
              </h4>
              <p className="text-xs text-slate-600">
                Ensuring leadership, management, and governance arrangements are robust for positive patient outcomes.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[#005EB8]" />
                Oversight of Workstreams
              </h4>
              <p className="text-xs text-slate-600">
                Monitoring progress of various workstreams ensuring alignment with overall programme objectives.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Vote className="h-4 w-4 text-purple-600" />
                Decision-Making
              </h4>
              <p className="text-xs text-slate-600">
                Acting as approving body for workstreams with transparent and timely feedback to the ICB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Programme Board Members */}
      {!hideBoardLeadership && <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#005EB8]" />
              Programme Board Leadership
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setPeopleDialogOpen(true)} className="flex items-center gap-1.5">
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">Manage People</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {seniorLeadership.map((member, index) => {
              const IconComponent = member.icon;
              return (
                <div 
                  key={index} 
                  className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#005EB8] to-[#003087] flex items-center justify-center flex-shrink-0">
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-slate-900">{member.name}</p>
                      <Badge 
                        variant={member.isVoting ? "default" : "secondary"} 
                        className={member.isVoting ? "bg-green-600 text-xs" : "text-xs"}
                      >
                        {member.isVoting ? "Voting" : "Non-Voting"}
                      </Badge>
                    </div>
                    <p className="text-sm text-[#005EB8] font-medium">{member.role}</p>
                    <p className="text-xs text-slate-500">{member.organisation}</p>
                    {member.email && <p className="text-xs text-slate-400">{member.email}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-slate-900">
              <Users className="h-4 w-4 text-[#005EB8]" />
              Additional Non-Voting Members
            </h4>
            <ul className="space-y-2">
              {nonVotingMembers.map((member, index) => (
                <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-[#005EB8] mt-1">•</span>
                  {member}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>}

      {/* Voting Structure & Meeting Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voting Structure */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Vote className="w-5 h-5 text-[#005EB8]" />
              Voting Structure & Governance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Voting Members ({isENN ? '11' : '8'} Total)
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#005EB8] font-bold">•</span>
                  <span><strong>{isENN ? '10 Practices' : '7 Practices'}</strong> - 1 GP + 1 Practice Manager per practice = 1 vote per practice ({isENN ? '10' : '7'} votes total)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#005EB8] font-bold">•</span>
                  <span><strong>{isENN ? 'SRO (TBC)' : 'SRO (Dr Mark Gray)'}</strong> - Deciding vote in event of a tie</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Quorum Requirements
              </h4>
              <p className="text-sm text-slate-600 mb-2">
                <strong>Quorum:</strong> One representative from each of the {isENN ? '10' : '7'} Practices required
              </p>
              <p className="text-sm text-slate-600">
                <strong>Voting:</strong> Majority wins. In a tie, the SRO has the deciding vote.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Meeting Schedule */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#005EB8]" />
              Meeting Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <Clock className="h-6 w-6 text-[#005EB8] mx-auto mb-2" />
                <h4 className="font-semibold text-sm">Frequency</h4>
                <p className="text-xs text-slate-600">Fortnightly</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <MapPin className="h-6 w-6 text-green-600 mx-auto mb-2" />
               <h4 className="font-semibold text-sm">In-Person</h4>
                <p className="text-xs text-slate-600">{isENN ? 'TBC' : 'At DocMed'}</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <Monitor className="h-6 w-6 text-[#005EB8] mx-auto mb-2" />
                <h4 className="font-semibold text-sm">Virtual</h4>
                <p className="text-xs text-slate-600">Alternate</p>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-slate-700">
                <strong>Note:</strong> Meeting rooms available between Programme Board meetings for task and finish groups.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conflicts of Interest Section */}
      <CollapsibleCard 
        title="Conflicts of Interest (Declarations & Management)" 
        icon={<Scale className="w-5 h-5" />}
        defaultOpen={false}
        className="border-0"
      >
        <div className="space-y-6">
          {/* Governance Statement */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-slate-700 leading-relaxed">
              {neighbourhoodName} operates in line with <strong>NHS England conflicts of interest guidance</strong>. All Board members, clinical leads, and individuals involved in decision-making are required to declare relevant interests. Declarations are reviewed at least annually and at meetings where decisions are made.
            </p>
          </div>

          {/* Status Snapshot */}
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-slate-900">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Status Snapshot
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs font-medium text-slate-900">COI Policy</p>
                <p className="text-xs text-green-600 font-semibold">In Place</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs font-medium text-slate-900">Register</p>
                <p className="text-xs text-green-600 font-semibold">Maintained</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <Calendar className="h-5 w-5 text-[#005EB8] mx-auto mb-1" />
                <p className="text-xs font-medium text-slate-900">Last Review</p>
                <p className="text-xs text-[#005EB8] font-semibold">Jan 2026</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs font-medium text-slate-900">Declarations</p>
                <p className="text-xs text-green-600 font-semibold">Up to Date</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <ShieldCheck className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs font-medium text-slate-900">Conflicts</p>
                <p className="text-xs text-green-600 font-semibold">Managed</p>
              </div>
            </div>
          </div>

          {/* Declaration Summary */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-slate-900">Declaration Summary</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-3 font-semibold text-slate-900 rounded-tl-lg">Role</th>
                    <th className="text-left p-3 font-semibold text-slate-900">Declared Interest</th>
                    <th className="text-left p-3 font-semibold text-slate-900 rounded-tr-lg">Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-white">
                    <td className="p-3 text-slate-700">SRO / Chair</td>
                    <td className="p-3 text-slate-600">{isENN ? 'Transformation Manager, 3Sixty Care Partnership' : 'Medical Director, PML'}</td>
                    <td className="p-3 text-slate-600">{isENN ? 'Noted; excluded from 3Sixty-specific financial votes' : 'Noted; excluded from PML-specific financial votes'}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-3 text-slate-700">Clinical Lead</td>
                    <td className="p-3 text-slate-600">GP Partner in member practice</td>
                    <td className="p-3 text-slate-600">Noted; excluded from practice-specific votes</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-3 text-slate-700">Digital Lead</td>
                    <td className="p-3 text-slate-600">Digital/AI product involvement</td>
                    <td className="p-3 text-slate-600">Declared; decisions recorded in minutes</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-3 text-slate-700">Programme Director</td>
                    <td className="p-3 text-slate-600">{isENN ? 'Director, 3Sixty Care Partnership' : 'Director of Community Services, PML'}</td>
                    <td className="p-3 text-slate-600">{isENN ? 'Noted; excluded from 3Sixty contract discussions' : 'Noted; excluded from PML contract discussions'}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-3 text-slate-700">Managerial Lead</td>
                    <td className="p-3 text-slate-600">None declared</td>
                    <td className="p-3 text-slate-500 italic">N/A</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Decision-specific handling */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Decision-Specific Conflict Handling
            </h4>
            <p className="text-sm text-slate-700">
              Where a conflict arises in relation to a specific decision, the individual is excluded from discussion and decision-making, and this is recorded in the formal meeting minutes.
            </p>
          </div>

          {/* Link to full register */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#005EB8]" />
              <span className="text-sm font-medium text-slate-900">Full Conflicts of Interest Register</span>
              <span className="text-xs text-slate-500">(Held by {isENN ? 'ENN' : 'NRES'} governance team{isENN ? ' / 3Sixty Care Partnership' : ' / PML'})</span>
            </div>
            <Badge variant="outline" className="border-[#005EB8] text-[#005EB8]">
              <ExternalLink className="h-3 w-3 mr-1" />
              Available on Request
            </Badge>
          </div>

          {/* Compliance statement */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  <strong>Conflicts of Interest Declaration:</strong> All individuals involved in {neighbourhoodName} governance and decision-making are required to declare relevant interests in line with NHS England guidance. A register of interests is maintained and reviewed at least annually and at meetings where relevant decisions are made. Where a conflict is identified, appropriate mitigating actions are taken and recorded.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {/* Key Responsibilities */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#005EB8]" />
            Key Responsibilities (14)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {keyResponsibilities.map((responsibility, index) => (
              <div 
                key={index} 
                className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#005EB8] text-white text-xs font-semibold flex items-center justify-center">
                  {index + 1}
                </span>
                <p className="text-sm text-slate-700">{isENN ? responsibility.replace('PML Board', '3Sixty Care Partnership Board') : responsibility}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Finance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidential Fund */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300">
                <Lock className="w-3 h-3 mr-1" />
                PRIVATE
              </Badge>
            </div>
            <CardTitle className="text-lg font-semibold text-slate-800">Confidential Redundancy Fund</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-[#005EB8] mb-1">£305,219</p>
            <p className="text-slate-600 text-sm mb-3">Phase 1 Risk Mitigation Fund</p>
            <p className="text-sm text-slate-600">
              <strong className="text-slate-800">Strictly Confidential to Phase 1 Sites.</strong> The ICB has agreed this exceptional provision to mitigate potential redundancy exposure for pioneering neighbourhoods.
            </p>
          </CardContent>
        </Card>

        {/* Budget Breakdown */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#005EB8]" />
              Operating Budget Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-[#005EB8]">14%</p>
                <p className="text-lg font-semibold text-[#005EB8]">£327,600</p>
                <p className="text-sm text-slate-600 mt-1">Overheads</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-cyan-600">16%</p>
                <p className="text-lg font-semibold text-cyan-600">£374,400</p>
                <p className="text-sm text-slate-600 mt-1">Innovation Pathways</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Innovation Component */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Innovation Component (£306k Budget)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">"Hot Clinics" Programme</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8]"></span>
                    Paediatric Sprains (10-14 yrs)
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8]"></span>
                    COPD Remote Monitoring
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8]"></span>
                    Frailty GPwSI Strategy
                  </li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-[#005EB8]" />
                  <h4 className="font-semibold text-slate-900">Mobile Outreach Van</h4>
                </div>
                <p className="text-sm text-slate-600 italic">
                  "Following the University of Huddersfield model, a mobile clinic van will support hard-to-reach rural residents in South Northants."
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insurance Requirements Section */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#005EB8]" />
            Insurance Requirements - Risk Mitigation
          </CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            Each practice (and any sub-contractors and consortia members) must confirm they hold or can commit to obtaining the following insurance cover prior to contract commencement.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Insurance Levels */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3">Required Insurance Cover Levels</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insuranceRequirements.map((insurance, index) => (
                <div key={index} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-700">{insurance.type}</span>
                  <span className="font-bold text-[#005EB8]">{insurance.amount}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <strong>Legal Requirement:</strong> All companies must hold Employer's (Compulsory) Liability Insurance of £5 million as a minimum. This requirement is not applicable to Sole Traders.
              </p>
            </div>
          </div>

          {/* Practice Confirmation Checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-900">Practice Confirmation Checklist</h4>
              {!interactiveInsurance && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Updated: {customInsuranceUpdatedDate || '11 Mar 2026'}</span>
                  <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                    {customInsuranceCheckedBy || (isENN ? 'Rebecca Gane' : 'Amanda Taylor')} Checked
                  </Badge>
                </div>
              )}
            </div>

            {interactiveInsurance ? (
              /* Interactive ENN insurance checklist */
              ennChecklist.isLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-500">Loading checklist…</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ennChecklist.practices.map((practice) => {
                    const allConfirmed = practice.insurances.every(ins => ins.confirmed);
                    
                    const parseAmount = (amt: string): number => {
                      const m = amt.match(/[\d.]+/);
                      if (!m) return 0;
                      const num = parseFloat(m[0]);
                      if (amt.toLowerCase().includes('m')) return num * 1_000_000;
                      return num;
                    };

                    const activeInsurance = practice.insurances.find((ins) => ins.id === activeInsuranceId);

                    return (
                      <div key={practice.practice} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="mb-2">
                          <span className={`text-sm font-medium ${allConfirmed ? 'text-slate-700' : 'text-amber-600'}`}>
                            {practice.practice}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {practice.insurances.map((ins) => {
                            const isEditable = ins.insurance_type === 'Public' || ins.insurance_type === 'Employers';
                            const isTbc = ins.amount === 'TBC';
                            const isEmployersLow = ins.insurance_type === 'Employers' && ins.confirmed && parseAmount(ins.amount) < 5_000_000;
                            const isAmber = isTbc || !ins.confirmed || isEmployersLow;

                            const shortType = ins.insurance_type
                              .replace('Prof/MDU', 'MDU')
                              .replace('Clinical/CNSGP', 'CNSGP');
                            const shortAmount = ins.amount === 'No Limit' ? '∞' : ins.amount;

                            if (!isEditable) {
                              return (
                                <Badge
                                  key={ins.id}
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0.5 font-medium ${
                                    ins.confirmed
                                      ? 'text-green-700 border-green-400 bg-green-50'
                                      : 'text-amber-700 border-amber-400 bg-amber-50'
                                  }`}
                                >
                                  {shortType} {shortAmount}
                                </Badge>
                              );
                            }

                            return (
                              <button
                                key={ins.id}
                                type="button"
                                onClick={() => setActiveInsuranceId(activeInsuranceId === ins.id ? null : ins.id)}
                                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 ${
                                  isAmber
                                    ? 'text-amber-700 border-amber-400 bg-amber-50'
                                    : 'text-green-700 border-green-400 bg-green-50'
                                }`}
                              >
                                {shortType} {shortAmount}
                              </button>
                            );
                          })}
                        </div>

                        {activeInsurance && (
                          <div className="mt-3 rounded-lg border border-border bg-background p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {activeInsurance.insurance_type} Liability
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setActiveInsuranceId(null)}
                              >
                                Close
                              </Button>
                            </div>

                            <div className="mt-3 space-y-3">
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Status</label>
                                <div className="flex gap-1.5">
                                  <Button
                                    type="button"
                                    variant={activeInsurance.confirmed ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => ennChecklist.toggleConfirmed({ id: activeInsurance.id, confirmed: true })}
                                  >
                                    Confirmed
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={!activeInsurance.confirmed ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => ennChecklist.toggleConfirmed({ id: activeInsurance.id, confirmed: false })}
                                  >
                                    Not confirmed
                                  </Button>
                                </div>
                              </div>

                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Insured amount</label>
                                <div className="flex flex-wrap gap-1.5">
                                  {['£5m', '£10m', 'TBC'].map((preset) => (
                                    <Button
                                      key={preset}
                                      type="button"
                                      variant={activeInsurance.amount === preset ? 'default' : 'outline'}
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => ennChecklist.updateAmount({ id: activeInsurance.id, amount: preset })}
                                    >
                                      {preset}
                                    </Button>
                                  ))}
                                  <Input
                                    placeholder="Other"
                                    className="h-7 w-24 text-xs"
                                    defaultValue={!['£5m', '£10m', 'TBC', 'No Limit'].includes(activeInsurance.amount) ? activeInsurance.amount : ''}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val && val !== activeInsurance.amount) {
                                        ennChecklist.updateAmount({ id: activeInsurance.id, amount: val });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {practice.lastUpdatedBy && (
                          <p className="mt-1.5 text-[10px] text-slate-400">
                            Updated by {practice.lastUpdatedBy} · {new Date(practice.lastUpdatedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Static NRES insurance checklist */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(customInsuranceChecklist || practiceInsuranceChecklist).map((practice, index) => {
                  const allConfirmed = practice.insurances.every(ins => ins.confirmed);
                  
                  const formatBadgeText = (type: string, amount: string) => {
                    const shortType = type
                      .replace('Prof/MDU', 'MDU')
                      .replace('Clinical/CNSGP', 'CNSGP')
                      .replace('Prof Negligence', 'Prof Neg');
                    const shortAmount = amount === 'No Limit' ? '∞' : amount;
                    return `${shortType} ${shortAmount}`;
                  };

                  return (
                    <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox id={`insurance-${index}`} checked={allConfirmed} disabled />
                        <label 
                          htmlFor={`insurance-${index}`} 
                          className={`text-sm font-medium ${allConfirmed ? 'text-slate-700' : 'text-amber-600'}`}
                        >
                          {practice.practice}
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-1.5 ml-6">
                        {practice.insurances.map((ins, insIndex) => {
                          const isTbc = ins.amount === "TBC";
                          const isPublicNotConfirmed = ins.type === "Public" && !ins.confirmed && !isTbc;
                          const isPublicLowAmount = ins.type === "Public" && ins.confirmed && ins.amount !== "£10m";
                          const isAmber = isTbc || (!ins.confirmed && ins.type !== "Public") || isPublicLowAmount;
                          return (
                            <Badge 
                              key={insIndex}
                              variant="outline" 
                              className={`text-[10px] px-1.5 py-0.5 font-medium ${
                                isPublicNotConfirmed
                                  ? 'text-red-700 border-red-400 bg-red-50'
                                  : isAmber 
                                    ? 'text-amber-700 border-amber-400 bg-amber-50' 
                                    : 'text-green-700 border-green-400 bg-green-50'
                              }`}
                            >
                              {isPublicNotConfirmed ? 'Public Unconfirmed' : formatBadgeText(ins.type, ins.amount)}
                            </Badge>
                          );
                        })}
                        {!practice.insurances.some(ins => ins.type === "Employers") && (
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5 py-0.5 font-medium text-red-700 border-red-400 bg-red-50"
                          >
                            Employers Unconfirmed
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Indemnity Coverage Explanation */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-slate-700 leading-relaxed">
                <span className="font-semibold">† Clinical negligence</span> liabilities arising from NHS-commissioned SDA services are covered under the NHS Clinical Negligence Scheme for General Practice (CNSGP), which provides uncapped indemnity and therefore exceeds the £10m requirement. <span className="font-semibold">* Professional negligence</span> and medico-legal liabilities are covered through Medical Defence Union (MDU) membership held by the practice clinicians, which exceeds the £5m requirement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <PeopleDirectoryDialog open={peopleDialogOpen} onOpenChange={setPeopleDialogOpen} />
    </div>
  );
};
