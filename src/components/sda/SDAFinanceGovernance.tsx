import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FileText
} from "lucide-react";

const seniorLeadership = [
  { name: "Dr Mark Gray", role: "Senior Responsible Officer (SRO) / Chair", organisation: "PML Medical Director", isVoting: true, icon: Crown },
  { name: "Maureen Green", role: "Programme Director", organisation: "Director of Community Services, PML", isVoting: false, icon: Building2 },
  { name: "Dr Simon Ellis", role: "Clinical Lead", organisation: "GP", isVoting: true, icon: Stethoscope },
  { name: "Dr Muhammed Chisti", role: "Supporting Clinical Lead", organisation: "GP", isVoting: true, icon: Stethoscope },
  { name: "Amanda Taylor", role: "Managerial Lead", organisation: "PML", isVoting: false, icon: UserCog },
  { name: "Lucy Hibberd", role: "Supporting Managerial Lead", organisation: "PML", isVoting: false, icon: UserCog },
  { name: "Malcolm Railson", role: "Digital & Estates Lead", organisation: "PML", isVoting: false, icon: Monitor },
  { name: "Alex Whitehead", role: "Supporting Digital & Estates Lead", organisation: "PML", isVoting: false, icon: Monitor },
];

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
  { type: "Professional Negligence", amount: "£5,000,000", required: true },
  { type: "Clinical Negligence", amount: "£10,000,000", required: true },
];

const practiceInsuranceChecklist = [
  { practice: "Towcester Medical Centre", insurances: [{ confirmed: true, amount: "£10m", type: "Public" }] },
  { practice: "Brook Health Centre", insurances: [{ confirmed: true, amount: "£10m", type: "Public" }] },
  { practice: "Brackley Medical Centre", insurances: [{ confirmed: true, amount: "£5m", type: "Public" }] },
  { practice: "Springfield Surgery", insurances: [{ confirmed: true, amount: "£5m", type: "Public" }] },
  { practice: "Denton Village Surgery", insurances: [
    { confirmed: true, amount: "£10m", type: "Public" },
    { confirmed: true, amount: "£10m", type: "Employers" },
    { confirmed: true, amount: "No Limit", type: "Prof/MDU" },
    { confirmed: true, amount: "No Limit", type: "Clinical/CNSGP" },
  ]},
  { practice: "The Parks Medical Practice", insurances: [{ confirmed: false, amount: "Pending", type: "Public" }] },
  { practice: "Bugbrooke Medical Practice", insurances: [
    { confirmed: true, amount: "£5m", type: "Public" },
    { confirmed: true, amount: "£5m", type: "Employers" },
  ]},
];

export const SDAFinanceGovernance = () => {
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
                <p className="text-sm text-green-300 mt-1">✓ Approved as final by Programme Board on 23rd December 2025</p>
              </div>
            </div>
            <Button 
              onClick={handleDownloadTOR}
              variant="secondary"
              className="bg-white text-[#005EB8] hover:bg-blue-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download TOR (PDF)
            </Button>
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
              Same Day Access Innovator – Rural South and East Programme Board
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Part of Northamptonshire ICB New Models of Care programme, helping patients stay well for longer 
              by improving health and care services in local communities across neighbourhoods.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-[#005EB8]">
                <Calendar className="h-3 w-3 mr-1" />
                Launch: April 2026
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
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#005EB8]" />
            Programme Board Leadership
          </CardTitle>
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
      </Card>

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
                Voting Members (8 Total)
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#005EB8] font-bold">•</span>
                  <span><strong>7 Practices</strong> - 1 GP + 1 Practice Manager per practice = 1 vote per practice (7 votes total)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#005EB8] font-bold">•</span>
                  <span><strong>SRO (Dr Mark Gray)</strong> - Deciding vote in event of a tie</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Quorum Requirements
              </h4>
              <p className="text-sm text-slate-600 mb-2">
                <strong>Quorum:</strong> One representative from each of the 7 Practices required
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
                <p className="text-xs text-slate-600">At DocMed</p>
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
                <p className="text-sm text-slate-700">{responsibility}</p>
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
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Amanda Taylor checking
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {practiceInsuranceChecklist.map((practice, index) => {
                const allConfirmed = practice.insurances.every(ins => ins.confirmed);
                return (
                  <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <Checkbox id={`insurance-${index}`} checked={allConfirmed} disabled />
                    <label htmlFor={`insurance-${index}`} className={`text-sm cursor-pointer flex-shrink-0 ${allConfirmed ? 'text-slate-700' : 'text-amber-600'}`}>
                      {practice.practice}
                    </label>
                    <div className="flex flex-wrap gap-1 ml-auto">
                      {practice.insurances.map((ins, insIndex) => {
                        const isAmber = !ins.confirmed || (ins.type === "Public" && ins.amount !== "£10m");
                        return (
                          <Badge 
                            key={insIndex}
                            variant="outline" 
                            className={`text-xs ${
                              isAmber 
                                ? 'text-amber-600 border-amber-600 bg-amber-50' 
                                : 'text-green-600 border-green-600 bg-green-50'
                            }`}
                          >
                            {ins.type}: {ins.amount}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
