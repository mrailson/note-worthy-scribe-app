import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Calendar, PoundSterling, FileCheck, ChevronDown, ChevronUp, BarChart3, ClipboardList, FileText, Download, BookOpen, Info } from "lucide-react";
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
import NRESGlassMap from "./NRESGlassMap";

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

export const SDAExecutiveSummary = () => {
  const [chartsOpen, setChartsOpen] = useState(false);
  const [actionTrackerOpen, setActionTrackerOpen] = useState(false);
  const [actionLogOpen, setActionLogOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  
  const [mapBtnHovered, setMapBtnHovered] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

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
                <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">Patient List Size</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">89,584</p>
                        <p className="text-sm text-slate-600 mt-1">7 Practice Partners Across Neighbourhood</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-[#005EB8]" />
                      </div>
                    </div>
                    {/* Live Planning Map Button */}
                    <div
                      onMouseEnter={() => setMapBtnHovered(true)}
                      onMouseLeave={() => setMapBtnHovered(false)}
                      onClick={() => setShowMapModal(true)}
                      style={{
                        position: "relative",
                        cursor: "pointer",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        background: mapBtnHovered 
                          ? "linear-gradient(135deg, #009198 0%, #00737a 100%)" 
                          : "linear-gradient(135deg, #f0fafa 0%, #e8f6f7 100%)",
                        border: mapBtnHovered ? "1px solid #009198" : "1px solid rgba(0, 145, 152, 0.2)",
                        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                        animation: !mapBtnHovered ? "attentionPulse 3s ease-in-out infinite" : "none",
                        boxShadow: mapBtnHovered 
                          ? "0 8px 30px rgba(0, 145, 152, 0.3), 0 0 0 1px rgba(0, 145, 152, 0.1)" 
                          : "0 2px 12px rgba(0, 145, 152, 0.15)",
                        overflow: "hidden",
                        marginTop: "12px",
                        maxWidth: "100%",
                      }}
                    >
                      {mapBtnHovered && (
                        <div style={{
                          position: "absolute",
                          top: 0, left: 0, right: 0, bottom: 0,
                          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                          backgroundSize: "200% 100%",
                          animation: "shimmer 2s linear infinite",
                          pointerEvents: "none",
                        }} />
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 1 }}>
                        <div style={{
                          width: "36px", height: "36px", borderRadius: "8px",
                          background: mapBtnHovered ? "rgba(255,255,255,0.15)" : "rgba(0,145,152,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.3s ease", flexShrink: 0,
                        }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="8" r="2.5" fill={mapBtnHovered ? "#fff" : "#009198"} opacity="0.9">
                              <animate attributeName="r" values="2.5;3;2.5" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="6" cy="16" r="2" fill={mapBtnHovered ? "#fff" : "#009198"} opacity="0.7">
                              <animate attributeName="r" values="2;2.3;2" dur="2.5s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="18" cy="16" r="2" fill={mapBtnHovered ? "#fff" : "#009198"} opacity="0.7">
                              <animate attributeName="r" values="2;2.3;2" dur="2.5s" begin="0.5s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="5" cy="10" r="1.2" fill={mapBtnHovered ? "rgba(255,255,255,0.5)" : "rgba(0,145,152,0.4)"} />
                            <circle cx="19" cy="10" r="1.2" fill={mapBtnHovered ? "rgba(255,255,255,0.5)" : "rgba(0,145,152,0.4)"} />
                            <line x1="12" y1="8" x2="6" y2="16" stroke={mapBtnHovered ? "rgba(255,255,255,0.4)" : "rgba(0,145,152,0.3)"} strokeWidth="1" strokeDasharray="2 2">
                              <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="1.5s" repeatCount="indefinite" />
                            </line>
                            <line x1="12" y1="8" x2="18" y2="16" stroke={mapBtnHovered ? "rgba(255,255,255,0.4)" : "rgba(0,145,152,0.3)"} strokeWidth="1" strokeDasharray="2 2">
                              <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="1.5s" repeatCount="indefinite" />
                            </line>
                            <line x1="12" y1="8" x2="5" y2="10" stroke={mapBtnHovered ? "rgba(255,255,255,0.25)" : "rgba(0,145,152,0.2)"} strokeWidth="0.8" strokeDasharray="1.5 1.5">
                              <animate attributeName="stroke-dashoffset" from="0" to="-6" dur="2s" repeatCount="indefinite" />
                            </line>
                            <line x1="12" y1="8" x2="19" y2="10" stroke={mapBtnHovered ? "rgba(255,255,255,0.25)" : "rgba(0,145,152,0.2)"} strokeWidth="0.8" strokeDasharray="1.5 1.5">
                              <animate attributeName="stroke-dashoffset" from="0" to="-6" dur="2s" repeatCount="indefinite" />
                            </line>
                            <line x1="6" y1="16" x2="18" y2="16" stroke={mapBtnHovered ? "rgba(255,255,255,0.2)" : "rgba(0,145,152,0.15)"} strokeWidth="0.6" strokeDasharray="3 3">
                              <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="3s" repeatCount="indefinite" />
                            </line>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{
                              fontSize: "12px", fontWeight: 700, letterSpacing: "0.3px",
                              color: mapBtnHovered ? "#fff" : "#006b70",
                              transition: "color 0.3s ease",
                              whiteSpace: "nowrap",
                            }}>Live Planning Map</span>
                            <span style={{
                              fontSize: "7px", fontWeight: 700, letterSpacing: "1.5px",
                              padding: "2px 5px", borderRadius: "4px",
                              background: mapBtnHovered ? "rgba(255,255,255,0.2)" : "rgba(0,145,152,0.1)",
                              color: mapBtnHovered ? "rgba(255,255,255,0.9)" : "#009198",
                              transition: "all 0.3s ease",
                            }}>INTERACTIVE</span>
                          </div>
                          <div style={{
                            fontSize: "9px", marginTop: "2px",
                            color: mapBtnHovered ? "rgba(255,255,255,0.8)" : "#5a8a8d",
                            transition: "color 0.3s ease",
                          }}>Drive times, SDA capacity & resource modelling</div>
                        </div>
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "6px",
                          background: mapBtnHovered ? "rgba(255,255,255,0.15)" : "rgba(0,145,152,0.06)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.3s ease", flexShrink: 0,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M5 3L9 7L5 11" stroke={mapBtnHovered ? "#fff" : "#009198"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
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
                        <p className="text-sm text-slate-500 font-medium">Contract Value (per year)</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">£2.36m</p>
                        <p className="text-sm text-slate-600 mt-1">£2,358,746.72 p/a · 2-year pilot</p>
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

      {/* Programme Board ToR */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-[#005EB8]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Governance Document</p>
          <h3 className="font-semibold text-slate-900 text-sm mb-1">Same Day Access Innovator — Programme Board Terms of Reference</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Outlines the purpose, scope, membership, responsibilities, and governance structure of the NRES Neighbourhood SDA Programme Board. Covers voting and non-voting membership, workstream oversight, decision-making authority, and assurance arrangements for the Rural South and East neighbourhood, effective from April 2026.
          </p>
        </div>
        <div className="flex-shrink-0">
          <a href="/documents/Final_Terms_of_Reference_Programme_Board_SDA.docx" download>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white hover:bg-slate-50 transition-colors text-slate-700">
              <Download className="h-4 w-4" />
              Download (Word)
            </button>
          </a>
        </div>
      </div>

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
                  <p className="text-sm text-slate-500">Source: January 2026 List Size</p>
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

      {/* Glass Map Fullscreen Modal */}
      <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
        <DialogContent className="!max-w-none !w-screen !h-screen !max-h-screen !translate-x-[-50%] !translate-y-[-50%] !rounded-none p-0 overflow-auto border-0 bg-[#0e1a2e] mx-0 my-0">
          <DialogTitle className="sr-only">NRES Neighbourhood Map</DialogTitle>
          <NRESGlassMap />
        </DialogContent>
      </Dialog>

      {/* Keyframe animations for Live Planning Map button */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes attentionPulse {
          0% { box-shadow: 0 2px 12px rgba(0, 145, 152, 0.15); }
          50% { box-shadow: 0 2px 20px rgba(0, 145, 152, 0.35), 0 0 0 3px rgba(0, 145, 152, 0.08); }
          100% { box-shadow: 0 2px 12px rgba(0, 145, 152, 0.15); }
        }
      `}</style>
    </div>
  );
};
