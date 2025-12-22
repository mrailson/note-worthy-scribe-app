import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Lightbulb, Truck, Heart } from "lucide-react";

export const SDAWorkforceInnovation = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workforce Requirements */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge className="bg-[#005EB8]">WTE</Badge>
              <CardTitle className="text-lg font-semibold text-slate-900">Workforce Requirements</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-4xl font-bold text-[#005EB8]">8.5</p>
                <p className="font-semibold text-slate-900 mt-1">GP WTE Sessions</p>
                <p className="text-sm text-slate-500">Assumes 26 appointments per day per session.</p>
              </div>
              <div className="bg-cyan-50 rounded-xl p-4 text-center">
                <p className="text-4xl font-bold text-cyan-600">6.9</p>
                <p className="font-semibold text-slate-900 mt-1">ACP WTE Sessions</p>
                <p className="text-sm text-slate-500">Advanced Clinical Practitioners (Prescribing).</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-4">
              <div className="w-10 h-10 rounded-full bg-[#005EB8] flex items-center justify-center">
                <span className="text-white font-bold">AP</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Anshal Pratyush</p>
                <p className="text-sm text-slate-500">Recruitment Strategy Lead</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Innovation Component */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-lg font-semibold text-slate-900">Innovation Component (£306k Budget)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      </div>

      {/* VCSE Partners */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            VCSE Infrastructure Partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              "Aspire Northants",
              "Black Communities Together",
              "Social Action West Northants",
              "Age Well Asset Groups"
            ].map((partner, index) => (
              <Badge key={index} variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 px-3 py-1">
                {partner}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            Mapping complete for patient engagement, LTC support, and connecting residents to local community health champions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
