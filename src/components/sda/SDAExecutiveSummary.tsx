import { useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Calendar, PoundSterling, FileCheck, ChevronDown, ChevronUp, BarChart3, ClipboardList, FileText, Download, BookOpen, Info, X, Bot } from "lucide-react";
import { ContractAskAI } from "./ContractAskAI";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import NRESLogo from "@/assets/nres-logo.png";
import DocMedLogo from "@/assets/docmed-logo.png";
import SNVBLogo from "@/assets/snvb-logo.png";

export interface SDAExecutiveSummaryProps {
  customLogos?: { src: string; alt: string }[];
  customMetrics?: {
    patientListSize: string;
    practiceCount: string;
    annualCapacity: string;
    contractValue: string;
    contractDetail: string;
  };
  /** Override the default patient list size */
  patientListSize?: number;
  /** Override the default practice count */
  practiceCount?: number;
  /** Override the default annual capacity figure */
  annualCapacity?: number;
  /** Override the population breakdown for the pie chart */
  populationBreakdown?: { name: string; value: number; color: string }[];
  /** Override the go-live date for the countdown (default: 1st April 2026) */
  goLiveDate?: Date;
  /** Override the neighbourhood name used in text (default: 'NRES') */
  neighbourhoodName?: string;
  /** Custom reporting requirements component */
  CustomReportingRequirements?: React.ComponentType;
  /** Custom buy-back explainer component */
  CustomBuybackExplainer?: React.ComponentType;
  /** Custom action log data (empty array to clear) */
  customActionLogData?: import("@/data/nresBoardActionsData").ActionLogItem[];
  /** Custom action log metadata */
  customActionLogMetadata?: { lastUpdated: string; nextMeeting: string; sourceMeeting: string };
  /** Custom appointment allocation stats */
  customApptStats?: {
    remoteAppts: string;
    f2fAppts: string;
    hubPercent: string;
    hubAppts: string;
    spokePercent: string;
    spokeAppts: string;
  };
  /** Custom programme plan data for the Gantt chart */
  customProgrammePlan?: import("@/types/sdaProgrammePlan").ProgrammePlan;
  /** Custom maintained-by info for the programme plan */
  customMaintainedBy?: { name: string; organisation: string; email: string };
}
import { BoardActionTracker } from "./board-actions/BoardActionTracker";
import { ActionLogTable } from "./ActionLogTable";
import { actionLogData, actionLogMetadata } from "@/data/nresBoardActionsData";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgrammePlanGantt } from "./programme-plan";
import { SDAPartnerQuickGuide } from "./SDAPartnerQuickGuide";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BoardPresentationExplainer from "@/components/nres/hours-tracker/BoardPresentationExplainer";


const NRESReportingRequirements = lazy(() => import("@/components/sda/NRESReportingRequirements"));

const defaultPopulationData = [
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

export const SDAExecutiveSummary = ({ customLogos, customMetrics, patientListSize = 89584, practiceCount = 7, annualCapacity = 74301, populationBreakdown, goLiveDate, neighbourhoodName = 'NRES', CustomReportingRequirements, CustomBuybackExplainer, customActionLogData, customActionLogMetadata, customApptStats, customProgrammePlan }: SDAExecutiveSummaryProps = {}) => {
  const populationData = populationBreakdown || defaultPopulationData;
  const activeActionLogData = customActionLogData ?? actionLogData;
  const activeActionLogMetadata = customActionLogMetadata ?? actionLogMetadata;
  const [chartsOpen, setChartsOpen] = useState(false);
  const [actionTrackerOpen, setActionTrackerOpen] = useState(false);
  const [actionLogOpen, setActionLogOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  
  const [reportingBtnHovered, setReportingBtnHovered] = useState(false);
  const [buybackBtnHovered, setBuybackBtnHovered] = useState(false);
  const [showReportingPreview, setShowReportingPreview] = useState(false);
  const [showContractAskAI, setShowContractAskAI] = useState(false);
  const [showBuybackExplainer, setShowBuybackExplainer] = useState(false);

  const handleDownloadBidRequirements = () => {
    const link = document.createElement('a');
    link.href = '/documents/New_Models_Primary_Care_Service_Specification_v5.pdf';
    link.download = 'ICB_New_Models_SDA_Pilot_Bid_Requirements.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Reporting Requirements Fullscreen Modal */}
      {showReportingPreview && (
        <div className="fixed inset-0 z-[200] bg-white overflow-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
            <span className="text-sm font-semibold text-slate-700">ICB Reporting Requirements Explorer</span>
            <Button variant="outline" size="sm" onClick={() => setShowReportingPreview(false)}>
              <X className="h-4 w-4 mr-1" /> Close Preview
            </Button>
          </div>
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-400">Loading preview…</div>}>
            {CustomReportingRequirements ? <CustomReportingRequirements /> : <NRESReportingRequirements />}
          </Suspense>
        </div>
      )}

      {/* Buy-Back Explainer Fullscreen Dialog */}
      <Dialog open={showBuybackExplainer} onOpenChange={setShowBuybackExplainer}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[92vh] h-[92vh] p-0 overflow-hidden">
          {CustomBuybackExplainer ? <CustomBuybackExplainer /> : <BoardPresentationExplainer />}
        </DialogContent>
      </Dialog>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                  <CardContent className="p-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">Patient List Size</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">{customMetrics?.patientListSize || patientListSize.toLocaleString()}</p>
                        <p className="text-sm text-slate-600 mt-1">{customMetrics?.practiceCount || practiceCount} Practices Across Neighbourhood</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-[#005EB8]" />
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-3">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Annual Capacity</p>
                        <p className="text-xl font-bold text-slate-900">{customMetrics?.annualCapacity || annualCapacity.toLocaleString()}</p>
                      </div>
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full">
                        50% Remote Assumption
                      </span>
                    </div>
                    <div className="flex-1" />
                    {/* Workforce Buy-Back Explainer Button */}
                    <div
                      onClick={() => setShowBuybackExplainer(true)}
                      onMouseEnter={() => setBuybackBtnHovered(true)}
                      onMouseLeave={() => setBuybackBtnHovered(false)}
                      style={{
                        position: "relative",
                        cursor: "pointer",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        display: "block",
                        textDecoration: "none",
                        background: buybackBtnHovered 
                          ? "linear-gradient(135deg, #0D9488 0%, #0f766e 100%)" 
                          : "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
                        border: buybackBtnHovered ? "1px solid #0D9488" : "1px solid rgba(13, 148, 136, 0.2)",
                        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                        boxShadow: buybackBtnHovered 
                          ? "0 8px 30px rgba(13, 148, 136, 0.3), 0 0 0 1px rgba(13, 148, 136, 0.1)" 
                          : "0 2px 12px rgba(13, 148, 136, 0.15)",
                        overflow: "hidden",
                        marginTop: "12px",
                        maxWidth: "100%",
                      }}
                    >
                      {buybackBtnHovered && (
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
                          background: buybackBtnHovered ? "rgba(255,255,255,0.15)" : "rgba(13,148,136,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.3s ease", flexShrink: 0,
                        }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="9" stroke={buybackBtnHovered ? "#fff" : "#0D9488"} strokeWidth="1.5" fill="none">
                              <animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <path d="M8 12h8M12 8v8" stroke={buybackBtnHovered ? "rgba(255,255,255,0.7)" : "rgba(13,148,136,0.5)"} strokeWidth="1.2" strokeLinecap="round" />
                            <path d="M9 15l3-3 3 3" stroke={buybackBtnHovered ? "#fff" : "#0D9488"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                              <animate attributeName="opacity" values="0.7;1;0.7" dur="2.5s" repeatCount="indefinite" />
                            </path>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{
                              fontSize: "12px", fontWeight: 700, letterSpacing: "0.3px",
                              color: buybackBtnHovered ? "#fff" : "#0f766e",
                              transition: "color 0.3s ease",
                              whiteSpace: "nowrap",
                            }}>Workforce Buy-Back Explainer</span>
                            <span style={{
                              fontSize: "7px", fontWeight: 700, letterSpacing: "1.5px",
                              padding: "2px 5px", borderRadius: "4px",
                              background: buybackBtnHovered ? "rgba(255,255,255,0.2)" : "rgba(13,148,136,0.1)",
                              color: buybackBtnHovered ? "rgba(255,255,255,0.9)" : "#0D9488",
                              transition: "all 0.3s ease",
                            }}>GUIDE</span>
                          </div>
                          <div style={{
                            fontSize: "9px", marginTop: "2px",
                            color: buybackBtnHovered ? "rgba(255,255,255,0.8)" : "#5a8d8a",
                            transition: "color 0.3s ease",
                          }}>SDA buy-back rules, process & quick reference</div>
                        </div>
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "6px",
                          background: buybackBtnHovered ? "rgba(255,255,255,0.15)" : "rgba(13,148,136,0.06)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.3s ease", flexShrink: 0,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M5 3L9 7L5 11" stroke={buybackBtnHovered ? "#fff" : "#0D9488"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Updated: 09 March 2026</p>
                  </CardContent>
                </Card>


                <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <CardContent className="p-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500 font-medium">Contract Value (per year)</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">{customMetrics?.contractValue || '£2.36m'}</p>
                        <p className="text-sm text-slate-600 mt-1">{customMetrics?.contractDetail || '£2,358,746.72 p/a · 2-year pilot'}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                        <PoundSterling className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1" />
                    {/* Reporting Requirements Button */}
                    <div
                      onMouseEnter={() => setReportingBtnHovered(true)}
                      onMouseLeave={() => setReportingBtnHovered(false)}
                      onClick={() => setShowReportingPreview(true)}
                      style={{
                        position: "relative",
                        cursor: "pointer",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        background: reportingBtnHovered 
                          ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" 
                          : "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                        border: reportingBtnHovered ? "1px solid #7c3aed" : "1px solid rgba(124, 58, 237, 0.2)",
                        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                        animation: !reportingBtnHovered ? "reportingPulse 3s ease-in-out infinite" : "none",
                        boxShadow: reportingBtnHovered 
                          ? "0 8px 30px rgba(124, 58, 237, 0.3), 0 0 0 1px rgba(124, 58, 237, 0.1)" 
                          : "0 2px 12px rgba(124, 58, 237, 0.15)",
                        overflow: "hidden",
                        marginTop: "12px",
                        maxWidth: "100%",
                      }}
                    >
                      {reportingBtnHovered && (
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
                          background: reportingBtnHovered ? "rgba(255,255,255,0.15)" : "rgba(124,58,237,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.3s ease", flexShrink: 0,
                        }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="4" y="3" width="16" height="18" rx="2" stroke={reportingBtnHovered ? "#fff" : "#7c3aed"} strokeWidth="1.5" fill="none">
                              <animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite" />
                            </rect>
                            <line x1="8" y1="8" x2="16" y2="8" stroke={reportingBtnHovered ? "rgba(255,255,255,0.7)" : "rgba(124,58,237,0.5)"} strokeWidth="1.2" />
                            <line x1="8" y1="12" x2="14" y2="12" stroke={reportingBtnHovered ? "rgba(255,255,255,0.5)" : "rgba(124,58,237,0.35)"} strokeWidth="1.2" />
                            <line x1="8" y1="16" x2="12" y2="16" stroke={reportingBtnHovered ? "rgba(255,255,255,0.5)" : "rgba(124,58,237,0.35)"} strokeWidth="1.2" />
                            <circle cx="17" cy="17" r="4" fill={reportingBtnHovered ? "rgba(255,255,255,0.2)" : "rgba(124,58,237,0.1)"} stroke={reportingBtnHovered ? "#fff" : "#7c3aed"} strokeWidth="1.2">
                              <animate attributeName="r" values="4;4.5;4" dur="2.5s" repeatCount="indefinite" />
                            </circle>
                            <path d="M15.5 17H18.5M17 15.5V18.5" stroke={reportingBtnHovered ? "#fff" : "#7c3aed"} strokeWidth="1" strokeLinecap="round" />
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{
                              fontSize: "12px", fontWeight: 700, letterSpacing: "0.3px",
                              color: reportingBtnHovered ? "#fff" : "#5b21b6",
                              transition: "color 0.3s ease",
                              whiteSpace: "nowrap",
                            }}>Reporting Requirements</span>
                            <span style={{
                              fontSize: "7px", fontWeight: 700, letterSpacing: "1.5px",
                              padding: "2px 5px", borderRadius: "4px",
                              background: reportingBtnHovered ? "rgba(255,255,255,0.2)" : "rgba(124,58,237,0.1)",
                              color: reportingBtnHovered ? "rgba(255,255,255,0.9)" : "#7c3aed",
                              transition: "all 0.3s ease",
                            }}>INTERACTIVE</span>
                          </div>
                          <div style={{
                            fontSize: "9px", marginTop: "2px",
                            color: reportingBtnHovered ? "rgba(255,255,255,0.8)" : "#7c6da0",
                            transition: "color 0.3s ease",
                          }}>ICB specification requirements & compliance guide</div>
                        </div>
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "6px",
                          background: reportingBtnHovered ? "rgba(255,255,255,0.15)" : "rgba(124,58,237,0.06)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.3s ease", flexShrink: 0,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M5 3L9 7L5 11" stroke={reportingBtnHovered ? "#fff" : "#7c3aed"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Updated: 09 March 2026</p>
                  </CardContent>
                </Card>

                <div className="flex flex-col gap-4 h-full">
                  <div className="flex justify-center items-center gap-6">
                    {customLogos ? (
                      customLogos.map((logo, i) => (
                        <img 
                          key={i}
                          src={logo.src} 
                          alt={logo.alt} 
                          className="h-20 w-auto object-contain"
                        />
                      ))
                    ) : (
                      <>
                        <img 
                          src={NRESLogo} 
                          alt="NRES - Northamptonshire Rural East and South Neighbourhood" 
                          className="h-20 w-auto object-contain"
                        />
                        <img 
                          src={DocMedLogo} 
                          alt="DocMed Northamptonshire - PML" 
                          className="h-20 w-auto object-contain"
                        />
                        <img 
                          src={SNVBLogo} 
                          alt="SNVB - Supporting Voluntary Activity" 
                          className="h-20 w-auto object-contain"
                        />
                      </>
                    )}
                  </div>
                  {/* Working Days Countdown */}
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const goLive = goLiveDate || new Date(2026, 3, 1); // default 1st April 2026
                    let count = 0;
                    const d = new Date(today);
                    while (d < goLive) {
                      d.setDate(d.getDate() + 1);
                      const day = d.getDay();
                      if (day !== 0 && day !== 6) count++;
                    }
                    return (
                      <div className="flex items-center justify-center gap-3 py-2">
                        <p className="text-4xl font-bold text-[#005EB8]">{count}</p>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Working Days<br />to Go-Live</p>
                      </div>
                    );
                  })()}
                  <div className="flex-1" />
                  <Card className="bg-slate-50 border border-slate-200 hover:border-[#005EB8] transition-colors">
                    <CardContent className="p-3">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-red-600" />
                          </div>
                         <div>
                            <p 
                              className="font-medium text-slate-900 text-xs cursor-pointer hover:text-[#005EB8] hover:underline transition-colors"
                              onClick={handleDownloadBidRequirements}
                            >
                              New Models Primary Care Service Specification v5
                            </p>
                            <p className="text-[10px] text-slate-500">Original ICB Bid Requirements for SDA Pilot & Innovator Site</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => setShowContractAskAI(true)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1 hover:bg-[#005EB8] hover:text-white transition-colors text-xs h-7 px-2"
                        >
                          <Bot className="w-3 h-3" />
                          Ask AI about the New Models Pilot
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
                    Essential information for GP practice partners about the {neighbourhoodName} Neighbourhood SDA Pilot – what it is, how it works, and what's expected from member practices.
                  </p>
                  <SDAPartnerQuickGuide neighbourhoodName={neighbourhoodName} />
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
              <ActionLogTable actions={activeActionLogData} metadata={activeActionLogMetadata} />
              <p className="text-xs text-slate-500 pt-2 mt-3 border-t border-slate-100">
                Next Programme Board Meeting: {activeActionLogMetadata.nextMeeting}
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
            <ProgrammePlanGantt customPlanData={customProgrammePlan} maintainedBy={customMaintainedBy} />
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
                      <p className="text-xs text-slate-500 mt-1">{customApptStats?.remoteAppts || '36,888'} appts/year</p>
                    </div>
                    <div className="text-center border-l border-slate-200 pl-6">
                      <p className="text-2xl font-bold text-slate-700">50%</p>
                      <p className="text-sm text-slate-600">FACE TO FACE</p>
                      <p className="text-xs text-slate-500 mt-1">{customApptStats?.f2fAppts || '36,887'} appts/year</p>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded" style={{ backgroundColor: "#41B6E6" }}></span>
                          Hub {customApptStats?.hubPercent || '30%'} ({customApptStats?.hubAppts || '22,133'})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded" style={{ backgroundColor: "#768692" }}></span>
                          Spoke {customApptStats?.spokePercent || '20%'} ({customApptStats?.spokeAppts || '14,755'})
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

      {/* Keyframe animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes reportingPulse {
          0% { box-shadow: 0 2px 12px rgba(124, 58, 237, 0.15); }
          50% { box-shadow: 0 2px 20px rgba(124, 58, 237, 0.35), 0 0 0 3px rgba(124, 58, 237, 0.08); }
          100% { box-shadow: 0 2px 12px rgba(124, 58, 237, 0.15); }
        }
      `}</style>
    </div>
    <ContractAskAI open={showContractAskAI} onOpenChange={setShowContractAskAI} />
    </>
  );
};
