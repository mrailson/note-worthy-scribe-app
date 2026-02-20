import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Calendar, PoundSterling, FileCheck, ChevronDown, ChevronUp, BarChart3, ClipboardList, FileText, Download, BookOpen, Info, X } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import NRESLogo from "@/assets/nres-logo.png";
import DocMedLogo from "@/assets/docmed-logo.png";
import { BoardActionTracker } from "./board-actions/BoardActionTracker";
import { ActionLogTable } from "./ActionLogTable";
import { actionLogData, actionLogMetadata } from "@/data/nresBoardActionsData";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgrammePlanGantt } from "./programme-plan";
import { SDAPartnerQuickGuide } from "./SDAPartnerQuickGuide";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const populationData = [
  { name: "The Parks MC", value: 22827, color: "#005EB8" },
  { name: "Brackley MC", value: 16212, color: "#41B6E6" },
  { name: "Springfield", value: 12611, color: "#768692" },
  { name: "Towcester MC", value: 11748, color: "#003087" },
  { name: "Bugbrooke", value: 10788, color: "#0072CE" },
  { name: "Brook Health", value: 9069, color: "#AE2573" },
  { name: "Denton Village", value: 6329, color: "#00A499" },
];

const appointmentData = [
  { name: "Face to Face", hub: 30, spoke: 20, total: 50 },
  { name: "Remote", remote: 50, total: 50 },
];

const practiceCapacityData = [
  { practice: "The Parks MC", listSize: 22827, role: "HUB", system: "SystmOne", pct: 25.5, monthly: 50086, budget75: 450776, wklyNonWinter: 347.0, f2fNW: 173.5, remoteNW: 173.5, wklyWinter: 415.5, f2fW: 207.7, remoteW: 207.7, annualTarget: 18933 },
  { practice: "Brackley MC", listSize: 16212, role: "HUB", system: "SystmOne", pct: 18.1, monthly: 35572, budget75: 320146, wklyNonWinter: 246.4, f2fNW: 123.2, remoteNW: 123.2, wklyWinter: 295.1, f2fW: 147.5, remoteW: 147.5, annualTarget: 13446 },
  { practice: "Springfield Surgery", listSize: 12611, role: "SPOKE", system: "EMIS", pct: 14.1, monthly: 27671, budget75: 249036, wklyNonWinter: 191.7, f2fNW: 95.8, remoteNW: 95.8, wklyWinter: 229.5, f2fW: 114.8, remoteW: 114.8, annualTarget: 10460 },
  { practice: "Towcester MC", listSize: 11748, role: "SPOKE", system: "EMIS", pct: 13.1, monthly: 25777, budget75: 231994, wklyNonWinter: 178.6, f2fNW: 89.3, remoteNW: 89.3, wklyWinter: 213.8, f2fW: 106.9, remoteW: 106.9, annualTarget: 9744 },
  { practice: "Bugbrooke Surgery", listSize: 10788, role: "SPOKE", system: "SystmOne", pct: 12.0, monthly: 23671, budget75: 213036, wklyNonWinter: 164.0, f2fNW: 82.0, remoteNW: 82.0, wklyWinter: 196.3, f2fW: 98.2, remoteW: 98.2, annualTarget: 8948 },
  { practice: "Brook Health Centre", listSize: 9069, role: "SPOKE", system: "SystmOne", pct: 10.1, monthly: 19899, budget75: 179090, wklyNonWinter: 137.8, f2fNW: 68.9, remoteNW: 68.9, wklyWinter: 165.1, f2fW: 82.5, remoteW: 82.5, annualTarget: 7522 },
  { practice: "Denton Village Surgery", listSize: 6329, role: "SPOKE", system: "SystmOne", pct: 7.1, monthly: 13887, budget75: 124982, wklyNonWinter: 96.2, f2fNW: 48.1, remoteNW: 48.1, wklyWinter: 115.2, f2fW: 57.6, remoteW: 57.6, annualTarget: 5249 },
];

export const SDAExecutiveSummary = () => {
  const [chartsOpen, setChartsOpen] = useState(false);
  const [actionTrackerOpen, setActionTrackerOpen] = useState(false);
  const [actionLogOpen, setActionLogOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [listSizeOpen, setListSizeOpen] = useState(true);
  const [appointmentsOpen, setAppointmentsOpen] = useState(true);

  const handleDownloadBidRequirements = () => {
    const link = document.createElement('a');
    link.href = '/documents/New_Models_Primary_Care_Service_Specification_v5.pdf';
    link.download = 'ICB_New_Models_SDA_Pilot_Bid_Requirements.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Collapsible Key Metrics Row */}
      <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen}>
        <Card className="bg-white border-0 shadow-sm">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#005EB8]" />
                <span className="font-semibold text-slate-900">Key Programme Metrics</span>
              </div>
              {metricsOpen ? (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setCapacityModalOpen(true)}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">Patient List Size</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">89,584</p>
                        <p className="text-sm text-slate-600 mt-1">7 Practice Partners Across Neighbourhood</p>
                        <p className="text-xs text-[#005EB8] mt-2 flex items-center gap-1">
                          <Info className="w-3 h-3" /> Click for capacity breakdown
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Users className="w-6 h-6 text-[#005EB8]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">Annual Capacity</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">74,301</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          50% Remote Assumption
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-cyan-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">Contract Value</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">£2.36m</p>
                        <p className="text-sm text-slate-600 mt-1">£2,358,746.72 total contract</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                        <PoundSterling className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-col gap-4">
                  <div className="flex justify-center items-center gap-4">
                    <img 
                      src={NRESLogo} 
                      alt="NRES - Northamptonshire Rural East and South Neighbourhood" 
                      className="h-28 w-auto object-contain"
                    />
                    <img 
                      src={DocMedLogo} 
                      alt="DocMed Northamptonshire - PML" 
                      className="h-20 w-auto object-contain"
                    />
                  </div>
                  <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-slate-500 font-medium">Governance Status</p>
                          <p className="text-3xl font-bold text-green-600 mt-1">SIGNED</p>
                          <p className="text-sm text-slate-600 mt-1">Data Sharing Agreement Complete</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Collapsible SDA Requirements */}
      <Collapsible open={requirementsOpen} onOpenChange={setRequirementsOpen}>
        <Card className="bg-white border-0 shadow-sm">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#005EB8]" />
                <span className="font-semibold text-slate-900">New Models Overview and Requirements</span>
              </div>
              {requirementsOpen ? (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-6">
                {/* GP Partner Quick Guide */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-[#005EB8]" />
                    <h3 className="font-semibold text-slate-900">GP Partner Quick Guide: 20 Things You Need to Know</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    Essential information for GP practice partners about the NRES Neighbourhood SDA Pilot – what it is, how it works, and what's expected from member practices.
                  </p>
                  <SDAPartnerQuickGuide />
                </div>

                {/* Original document download */}
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 mb-3">
                    Access the original ICB issued bid requirements and service specification for the New Models SDA Pilot and Innovator Site.
                  </p>
                  <Card className="bg-slate-50 border border-slate-200 hover:border-[#005EB8] transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">New Models Primary Care Service Specification v5</p>
                            <p className="text-sm text-slate-500">Original ICB Bid Requirements for SDA Pilot & Innovator Site</p>
                          </div>
                        </div>
                        <Button 
                          onClick={handleDownloadBidRequirements}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 hover:bg-[#005EB8] hover:text-white transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Collapsible Programme Board Action Log */}
      <Collapsible open={actionLogOpen} onOpenChange={setActionLogOpen}>
        <Card className="bg-white border-0 shadow-sm">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#005EB8]" />
                <span className="font-semibold text-slate-900">Programme Board Action Log</span>
              </div>
              {actionLogOpen ? (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ActionLogTable actions={actionLogData} metadata={actionLogMetadata} />
              <p className="text-xs text-slate-500 pt-2 mt-3 border-t border-slate-100">
                Source: {actionLogMetadata.sourceMeeting} • Next Meeting: {actionLogMetadata.nextMeeting}
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Collapsible Board Action Tracker */}
      <Collapsible open={actionTrackerOpen} onOpenChange={setActionTrackerOpen}>
        <Card className="bg-white border-0 shadow-sm">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#005EB8]" />
                <span className="font-semibold text-slate-900">Programme Delivery Schedule</span>
              </div>
              {actionTrackerOpen ? (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 pt-2">
            <ProgrammePlanGantt />
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Collapsible Charts Section - Moved to bottom */}
      <Collapsible open={chartsOpen} onOpenChange={setChartsOpen}>
        <Card className="bg-white border-0 shadow-sm">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#005EB8]" />
                <span className="font-semibold text-slate-900">Population & Allocation Charts</span>
              </div>
              {chartsOpen ? (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 pt-0">
              {/* Population Mix Chart */}
              <Card className="bg-slate-50 border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">Practice Population Mix</CardTitle>
                  <p className="text-sm text-slate-500">Source: April 25 List Size</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                        <Pie
                          data={populationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent, value }) => `${name} ${(percent * 100).toFixed(1)}% (${value.toLocaleString()})`}
                          labelLine={true}
                        >
                          {populationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [value.toLocaleString(), 'Patients']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Appointment Allocation */}
              <Card className="bg-slate-50 border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">Appointment Allocation Model</CardTitle>
                  <p className="text-sm text-slate-500">Mandatory Split</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={appointmentData} layout="vertical">
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip />
                        <Bar dataKey="hub" stackId="a" fill="#41B6E6" name="Hub" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="spoke" stackId="a" fill="#768692" name="Spoke" radius={[0, 8, 8, 0]} />
                        <Bar dataKey="remote" stackId="b" fill="#005EB8" name="Remote" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#005EB8]">50%</p>
                      <p className="text-sm text-slate-600">REMOTE</p>
                      <p className="text-xs text-slate-500 mt-1">36,888 appts/year</p>
                    </div>
                    <div className="text-center border-l border-slate-200 pl-6">
                      <p className="text-2xl font-bold text-slate-700">50%</p>
                      <p className="text-sm text-slate-600">FACE TO FACE</p>
                      <p className="text-xs text-slate-500 mt-1">36,887 appts/year</p>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded" style={{ backgroundColor: "#41B6E6" }}></span>
                          Hub 30% (22,133)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded" style={{ backgroundColor: "#768692" }}></span>
                          Spoke 20% (14,755)
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Practice Capacity Breakdown Modal */}
      <Dialog open={capacityModalOpen} onOpenChange={setCapacityModalOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] overflow-y-auto p-0">
          {/* NHS-styled header */}
          <div className="sticky top-0 z-10 bg-[#005EB8] text-white px-6 py-4 rounded-t-lg">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight">NRES Neighbourhood – Practice Capacity Breakdown</h2>
                <p className="text-blue-200 text-sm mt-0.5">April 2025 List Sizes · Appointment Planning Model</p>
              </div>
              <button onClick={() => setCapacityModalOpen(false)} className="text-white/70 hover:text-white transition-colors mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Rate badges */}
            <div className="flex gap-3 mt-3">
              <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-[#41B6E6]"></span>
                Non-Winter: 15.2 per 1,000 list · 39 weeks
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-[#AE2573]"></span>
                Winter: 18.2 per 1,000 list · 13 weeks
              </span>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Practice List Sizes – collapsible */}
            <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setListSizeOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#005EB8] text-white hover:bg-[#004f9f] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-[#41B6E6]"></div>
                  <span className="text-sm font-bold uppercase tracking-wider">Practice List Sizes</span>
                </div>
                {listSizeOpen ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
              </button>
              {listSizeOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#005EB8] text-white">
                        <th className="px-4 py-2.5 text-left font-semibold">Practice</th>
                        <th className="px-4 py-2.5 text-right font-semibold">List Size</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Hub / Spoke</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Clinical System</th>
                        <th className="px-4 py-2.5 text-right font-semibold">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {practiceCapacityData.map((p, i) => (
                        <tr key={p.practice} className={`transition-colors hover:bg-blue-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/70"}`}>
                          <td className="px-4 py-2.5 font-semibold text-slate-900 border-b border-slate-100">{p.practice}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-b border-slate-100">{p.listSize.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-center border-b border-slate-100">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${p.role === "HUB" ? "bg-[#005EB8] text-white" : "bg-slate-100 text-slate-600 border border-slate-300"}`}>
                              {p.role}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center border-b border-slate-100">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${p.system === "EMIS" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                              {p.system}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-b border-slate-100">{p.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#005EB8] text-white font-bold">
                        <td className="px-4 py-2.5">TOTAL</td>
                        <td className="px-4 py-2.5 text-right font-mono">89,584</td>
                        <td colSpan={2}></td>
                        <td className="px-4 py-2.5 text-right font-mono">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Appointment Capacity – collapsible */}
            <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setAppointmentsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#005EB8] text-white hover:bg-[#004f9f] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-[#AE2573]"></div>
                  <span className="text-sm font-bold uppercase tracking-wider">Appointment Requirements & Financial Allocation</span>
                </div>
                {appointmentsOpen ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
              </button>
              {appointmentsOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#003087] text-white">
                        <th className="px-3 py-2.5 text-left font-semibold" rowSpan={2}>Practice</th>
                        <th className="px-3 py-2.5 text-right font-semibold" rowSpan={2}>Monthly (£)</th>
                        <th className="px-3 py-2.5 text-right font-semibold" rowSpan={2}>Budget 75% (£)</th>
                        <th className="px-3 py-2 text-center font-semibold bg-[#0072CE] border-l-2 border-white/30" colSpan={3}>
                          <div className="flex items-center justify-center gap-1.5 text-white">
                            <span className="w-2 h-2 rounded-full bg-[#41B6E6]"></span>
                            Non-Winter · 15.2/1,000 · 39 wks
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold bg-[#AE2573] border-l-2 border-white/30" colSpan={3}>
                          <div className="flex items-center justify-center gap-1.5 text-white">
                            <span className="w-2 h-2 rounded-full bg-pink-300"></span>
                            Winter · 18.2/1,000 · 13 wks
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold bg-indigo-600 text-white border-l-2 border-white/30" rowSpan={2}>Annual Target</th>
                        <th className="px-3 py-2.5 text-center font-semibold" rowSpan={2}>Hub/Spoke</th>
                      </tr>
                      <tr>
                        <th className="px-3 py-2 text-right font-semibold text-white bg-[#0072CE]/80 border-l-2 border-white/30 text-xs">Wkly Min</th>
                        <th className="px-3 py-2 text-right font-semibold text-white bg-[#0072CE]/80 text-xs">F2F 50%</th>
                        <th className="px-3 py-2 text-right font-semibold text-white bg-[#0072CE]/80 text-xs">Remote 50%</th>
                        <th className="px-3 py-2 text-right font-semibold text-white bg-[#AE2573]/80 border-l-2 border-white/30 text-xs">Wkly Min</th>
                        <th className="px-3 py-2 text-right font-semibold text-white bg-[#AE2573]/80 text-xs">F2F 50%</th>
                        <th className="px-3 py-2 text-right font-semibold text-white bg-[#AE2573]/80 text-xs">Remote 50%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {practiceCapacityData.map((p, i) => (
                        <tr key={p.practice} className={`transition-colors hover:bg-blue-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/70"}`}>
                          <td className="px-3 py-2.5 font-semibold text-slate-900 border-b border-slate-100">{p.practice}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700 border-b border-slate-100">£{p.monthly.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700 border-b border-slate-100">£{p.budget75.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-[#0072CE] border-b border-slate-100 border-l-2 border-blue-100 bg-blue-50/30">{p.wklyNonWinter.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600 border-b border-slate-100 bg-blue-50/20">{p.f2fNW.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600 border-b border-slate-100 bg-blue-50/20">{p.remoteNW.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-[#AE2573] border-b border-slate-100 border-l-2 border-pink-100 bg-pink-50/30">{p.wklyWinter.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600 border-b border-slate-100 bg-pink-50/20">{p.f2fW.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600 border-b border-slate-100 bg-pink-50/20">{p.remoteW.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-[#003087] border-b border-slate-100 border-l-2 border-indigo-100 bg-indigo-50/30">{p.annualTarget.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-center border-b border-slate-100">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${p.role === "HUB" ? "bg-[#005EB8] text-white" : "bg-slate-100 text-slate-600 border border-slate-300"}`}>
                              {p.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#005EB8] text-white font-bold">
                        <td className="px-3 py-3 font-bold">NEIGHBOURHOOD TOTAL</td>
                        <td className="px-3 py-3 text-right font-mono">£196,562</td>
                        <td className="px-3 py-3 text-right font-mono">£1,769,060</td>
                        <td className="px-3 py-3 text-right font-mono bg-[#0072CE]/60 border-l-2 border-white/20">1,361.7</td>
                        <td className="px-3 py-3 text-right font-mono bg-[#0072CE]/60">680.8</td>
                        <td className="px-3 py-3 text-right font-mono bg-[#0072CE]/60">680.8</td>
                        <td className="px-3 py-3 text-right font-mono bg-[#AE2573]/60 border-l-2 border-white/20">1,630.4</td>
                        <td className="px-3 py-3 text-right font-mono bg-[#AE2573]/60">815.2</td>
                        <td className="px-3 py-3 text-right font-mono bg-[#AE2573]/60">815.2</td>
                        <td className="px-3 py-3 text-right font-mono bg-[#003087]/80 border-l-2 border-white/20">74,301</td>
                        <td className="bg-[#003087]/40"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Based on April 2025 list sizes. Wkly Min = weekly minimum appointment requirement. F2F and Remote each at 50% of total.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
