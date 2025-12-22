import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Lock, PieChart } from "lucide-react";

const boardMembers = [
  { name: "Dr Mark Gray", role: "SRO / Medical Director" },
  { name: "Maureen Green", role: "Programme Director" },
  { name: "Dr Simon Ellis", role: "Clinical Lead (Towcester)" },
  { name: "Amanda Taylor", role: "Managerial Lead" },
  { name: "Malcolm Railson", role: "Digital Lead" },
  { name: "Alex Whitehead", role: "Practice Access Lead" },
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
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-0 shadow-lg text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">
                  <Lock className="w-3 h-3 mr-1" />
                  PRIVATE
                </Badge>
              </div>
              <CardTitle className="text-lg font-semibold">Confidential Redundancy Fund</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white mb-1">£312,000</p>
              <p className="text-slate-300 text-sm mb-3">Phase 1 Risk Mitigation Fund</p>
              <p className="text-sm text-slate-400">
                <strong className="text-slate-200">Strictly Confidential to Phase 1 Sites.</strong> The ICB has agreed this exceptional provision to mitigate potential redundancy exposure for pioneering neighbourhoods.
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
    </div>
  );
};
