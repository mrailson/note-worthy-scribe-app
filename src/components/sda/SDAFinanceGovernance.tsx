import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Lock, PieChart, ShieldCheck, AlertTriangle } from "lucide-react";

const boardMembers = [
  { name: "Dr Mark Gray", role: "SRO / Medical Director" },
  { name: "Maureen Green", role: "Programme Director" },
  { name: "Dr Simon Ellis", role: "Clinical Lead (Towcester)" },
  { name: "Amanda Taylor", role: "Managerial Lead" },
  { name: "Malcolm Railson", role: "Digital Lead" },
  { name: "Alex Whitehead", role: "Practice Access Lead" },
];

const insuranceRequirements = [
  { type: "Employer's (Compulsory) Liability Insurance", amount: "£5,000,000", required: true },
  { type: "Public Liability Insurance", amount: "£10,000,000", required: true },
  { type: "Professional Negligence", amount: "£5,000,000", required: true },
  { type: "Clinical Negligence", amount: "£10,000,000", required: true },
];

const practiceInsuranceChecklist = [
  { practice: "Towcester Medical Centre", confirmed: false },
  { practice: "Brackley Medical Centre", confirmed: false },
  { practice: "The Parks Medical", confirmed: false },
  { practice: "Springfield Surgery", confirmed: false },
  { practice: "Brook Health Centre", confirmed: false },
  { practice: "Bugbrooke Medical Practice", confirmed: false },
  { practice: "Denton Village", confirmed: false },
];

export const SDAFinanceGovernance = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Programme Board */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#005EB8]" />
              Programme Board Governance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {boardMembers.map((member, index) => (
                <div key={index} className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#005EB8] to-[#003087] mx-auto mb-2 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.role}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Finance Section */}
        <div className="space-y-4">
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
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#005EB8]" />
                Operating Budget Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-[#005EB8]">14%</p>
                  <p className="text-sm text-slate-600 mt-1">Management Oversight</p>
                </div>
                <div className="bg-cyan-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-cyan-600">16%</p>
                  <p className="text-sm text-slate-600 mt-1">Innovation Pathways</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
            <p className="text-xs text-slate-500 mt-3 italic">
              An answer of "Yes" provides confirmation of self-certification. If you self-certify that you meet the requirements, evidence of this will be requested.
            </p>
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
              {practiceInsuranceChecklist.map((practice, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Checkbox id={`insurance-${index}`} disabled />
                  <label htmlFor={`insurance-${index}`} className="text-sm text-slate-700 cursor-pointer">
                    {practice.practice}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
