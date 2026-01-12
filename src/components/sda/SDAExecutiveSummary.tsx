import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Calendar, PoundSterling, FileCheck, ChevronDown, ChevronUp, BarChart3, ClipboardList } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import NRESLogo from "@/assets/nres-logo.png";
import DocMedLogo from "@/assets/docmed-logo.png";
import { BoardActionTracker } from "./board-actions/BoardActionTracker";
import { ActionLogTable } from "./ActionLogTable";
import { actionLogData, actionLogMetadata } from "@/data/nresBoardActionsData";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgrammePlanGantt } from "./programme-plan";

const populationData = [
  { name: "The Parks MC", value: 22689, color: "#005EB8" },
  { name: "Brackley MC", value: 16128, color: "#41B6E6" },
  { name: "Springfield", value: 12649, color: "#768692" },
  { name: "Towcester MC", value: 11439, color: "#003087" },
  { name: "Bugbrooke", value: 10773, color: "#0072CE" },
  { name: "Brook Health", value: 8983, color: "#AE2573" },
  { name: "Denton Village", value: 6277, color: "#00A499" },
];

const appointmentData = [
  { name: "Face to Face", hub: 30, spoke: 20, total: 50 },
  { name: "Remote", remote: 50, total: 50 },
];

export const SDAExecutiveSummary = () => {
  const [chartsOpen, setChartsOpen] = useState(false);
  const [actionTrackerOpen, setActionTrackerOpen] = useState(false);
  const [actionLogOpen, setActionLogOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);

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
                <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">Patient List Size</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">88,938</p>
                        <p className="text-sm text-slate-600 mt-1">7 Practice Partners Across Neighbourhood</p>
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
                        <p className="text-3xl font-bold text-slate-900 mt-1">73,775</p>
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
                        <p className="text-3xl font-bold text-slate-900 mt-1">£2.34m</p>
                        <p className="text-sm text-slate-600 mt-1">Equates to £26.33 per patient</p>
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
    </div>
  );
};
