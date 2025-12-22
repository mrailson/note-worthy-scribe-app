import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Monitor, Laptop, Settings } from "lucide-react";

export const SDADigitalIntegration = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Digital Interoperability Proof of Concept</h2>
        <p className="text-slate-600 mt-1">
          Verification evidence for cross-system clinical booking using GP Connect between EMIS and SystmOne (TPP) sites.
        </p>
      </div>

      {/* Evidence Cards */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#005EB8]" />
            GP Connect Technical Evidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exhibit 1 */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Exhibit 1: System Configuration (NRES Mapping)</h3>
              <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                <span className="text-slate-400">[System Configuration Screenshot]</span>
              </div>
            </div>

            {/* Exhibit 2 */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Exhibit 2: Confirmed Cross-Provider Booking</h3>
              <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                <span className="text-slate-400">[Cross-Provider Booking Screenshot]</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Status */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-green-800">Verification Complete</h3>
                  <Badge className="bg-green-600">100% ACCESS GRANTED</Badge>
                </div>
                <p className="text-sm text-green-700">
                  <strong>Confirmed:</strong> Alex Whitehead, Malcolm Railson, and Amanda Taylor have successfully verified functional clinical system access across all 7 practice clinical environments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remote Hardware Strategy */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Laptop className="w-5 h-5 text-[#005EB8]" />
              Remote Hardware Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#005EB8] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Central Procurement</h4>
                <p className="text-sm text-slate-600">Laptops for all remote SDA staff managed centrally by PML.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#005EB8] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Clinical-Grade Config</h4>
                <p className="text-sm text-slate-600">Pre-configured VPNs and local EMIS/TPP shortcuts for home sessions.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Access Summary */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#005EB8]" />
            System Access Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { system: "EMIS Web", status: "Active", practices: 4 },
              { system: "SystmOne", status: "Active", practices: 3 },
              { system: "GP Connect", status: "Verified", practices: 7 },
              { system: "VPN Access", status: "Configured", practices: 7 },
            ].map((item, index) => (
              <div key={index} className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-500">{item.system}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{item.practices}</p>
                <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-200">
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
