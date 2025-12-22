import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Scale, Users } from "lucide-react";

const decisions = [
  { id: 1, title: "Brook Hub/Spoke Status", desc: "Final decision on designation for April go-live." },
  { id: 2, title: "ToR Ratification", desc: "Approval of final Governance framework." },
  { id: 3, title: "Innovation Pilots", desc: "Agreement on specific Part B clinics (Frailty/COPD)." },
  { id: 4, title: "Recruitment Panels", desc: "Establishing the JD and Interview groups for January." },
];

export const SDARisksMitigation = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Safety Risk */}
        <Card className="bg-white border-0 shadow-sm border-l-4 border-l-red-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" />
              <CardTitle className="text-lg font-semibold text-slate-900">Governance: The 550 Opt-Outs</CardTitle>
            </div>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 w-fit">
              CRITICAL PATIENT SAFETY BARRIER
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2">The "Home Practice" Mandate</h4>
              <p className="text-sm text-red-800">
                Patients who have explicitly dissented from sharing their records for local care <strong>MUST</strong> be seen at their own surgery (The Spoke). Neighbourhood Hub clinicians will have no legal access to their records.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-slate-100">National Opt-out</Badge>
              <Badge variant="outline" className="bg-slate-100">Type 1 Opt-out</Badge>
              <Badge variant="outline" className="bg-slate-100">Local Care Block</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Legal Challenge Risk */}
        <Card className="bg-white border-0 shadow-sm border-l-4 border-l-amber-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-lg font-semibold text-slate-900">Legal: Public Consultation Challenge</CardTitle>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 w-fit">
              TIMELINE & SCRUTINY COMMITTEE RISK
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                A local Brackley councillor has challenged the consultation requirement. If mandated by the Scrutiny Committee, the April launch will be delayed.
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 text-sm">Current Mitigation</h4>
              <p className="text-sm text-slate-600 italic">
                "ICB seeking expert legal advice on 'rapid engagement' options for Jan 2026."
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
