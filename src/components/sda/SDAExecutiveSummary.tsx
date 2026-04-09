import { useState, lazy, Suspense } from "react";
import { NRESWidgetEmbed } from "@/components/nres/NRESWidgetLoader";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Calendar, PoundSterling, FileCheck, ChevronDown, ChevronUp, BarChart3, ClipboardList, FileText, Download, BookOpen, Info, X, Bot, Handshake } from "lucide-react";
import { ContractAskAI } from "./ContractAskAI";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import NRESLogo from "@/assets/nres-logo.png";
import DocMedLogo from "@/assets/docmed-logo.png";
import SNVBLogo from "@/assets/snvb-logo.png";
import NHSNorthantsICBLogo from "@/assets/nhs-northants-icb-logo.png";

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
  /** Custom label for the buyback/explainer button */
  customBuybackLabel?: { title: string; subtitle: string; badge: string; date: string };
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
  /** Custom guide items for the Partner Quick Guide */
  customGuideItems?: import("./SDAPartnerQuickGuide").GuideItem[];
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

export const SDAExecutiveSummary = ({ customLogos, customMetrics, patientListSize = 89584, practiceCount = 7, annualCapacity = 74301, populationBreakdown, goLiveDate, neighbourhoodName = 'NRES', CustomReportingRequirements, CustomBuybackExplainer, customBuybackLabel, customActionLogData, customActionLogMetadata, customApptStats, customProgrammePlan, customMaintainedBy, customGuideItems }: SDAExecutiveSummaryProps = {}) => {
  const populationData = populationBreakdown || defaultPopulationData;
  const activeActionLogData = customActionLogData ?? actionLogData;
  const activeActionLogMetadata = customActionLogMetadata ?? actionLogMetadata;
  const [chartsOpen, setChartsOpen] = useState(false);
  const [actionTrackerOpen, setActionTrackerOpen] = useState(false);
  const [actionLogOpen, setActionLogOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  
  const [reportingBtnHovered, setReportingBtnHovered] = useState(false);
  const [aiCardTab, setAiCardTab] = useState<"Overview" | "Patient" | "GP" | "Practice Manager" | "NRES" | "Buy-Back" | "Translate">("Overview");
  const [showReportingPreview, setShowReportingPreview] = useState(false);
  const [showContractAskAI, setShowContractAskAI] = useState(false);

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
                <span className="font-semibold text-slate-900">Programme Dashboard</span>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                {/* Column 1 — Innovation */}
                <div className="flex flex-col gap-2 h-full">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"/></svg>
                    <span className="font-semibold text-slate-900">Innovation</span>
                  </div>
                {/* Card 1 — GP Notewell AI Assistant */}
                <Card className="border-0 shadow-sm hover:shadow-lg transition-shadow flex flex-col flex-1 overflow-hidden" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 50%, #f0f0ff 100%)' }}>
                  <CardContent className="p-6 flex flex-col flex-1 relative">
                    <div className="absolute top-4 right-4 opacity-60">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="#6366f1" opacity="0.7"/></svg>
                    </div>
                    <p className="text-lg font-bold text-slate-900">GP Notewell AI</p>
                    <p className="text-xs text-slate-500 mt-0.5">Your intelligent programme assistant</p>

                     {/* Audience tabs */}
                     <div className="flex flex-wrap gap-1 mt-3">
                       {(["Overview", "Patient", "GP", "Practice Manager", "NRES", "Buy-Back", "Translate"] as const).map((tab) => (
                         <button
                           key={tab}
                           onClick={() => setAiCardTab(tab)}
                           className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
                             aiCardTab === tab
                               ? tab === "Translate" ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                               : tab === "Translate" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                           }`}
                         >
                           {tab === "Translate" ? "🌍 Translate" : tab}
                         </button>
                       ))}
                     </div>

                    {/* Tab content */}
                    <div className="mt-3 flex-1">
                      {aiCardTab === "Overview" && (
                        <>
                          <ul className="space-y-2 text-xs text-slate-700">
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🩺</span><span>Ask clinical questions — get GP-level guidance instantly</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📊</span><span>NRES programme knowledge — targets, funding, buy-back, practices</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📋</span><span>Practice management — CQC, HR, complaints, NHS contracts</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">❤️</span><span>Patient support — plain English health advice</span></li>
                          </ul>
                          <p className="text-[10px] text-indigo-600 font-medium mt-3 italic">Powered by AI, grounded in NHS guidance. Try it now.</p>
                        </>
                      )}
                      {aiCardTab === "Patient" && (
                        <>
                          <p className="text-xs font-semibold text-slate-800 italic mb-2">"Talk to me like your GP would"</p>
                          <ul className="space-y-2 text-xs text-slate-700">
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">💬</span><span>Describe your symptoms — I'll ask the right questions</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">💊</span><span>Get advice on over-the-counter medications and dosing</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🔬</span><span>Understand your test results in plain English</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🚨</span><span>I'll always tell you when to seek urgent help</span></li>
                          </ul>
                          <p className="text-[10px] text-indigo-600 font-medium mt-3 italic">No jargon. No judgement. Just clear, caring advice.</p>
                        </>
                      )}
                      {aiCardTab === "GP" && (
                        <>
                          <p className="text-xs font-semibold text-slate-800 italic mb-2">"Your senior colleague, always available"</p>
                          <ul className="space-y-2 text-xs text-slate-700">
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📖</span><span>NICE/CKS guidelines with source references</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">💊</span><span>BNF prescribing guidance and MHRA alerts</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🔀</span><span>Differential diagnosis support</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📋</span><span>2WW referral criteria and red flag screening</span></li>
                          </ul>
                          <p className="text-[10px] text-indigo-600 font-medium mt-3 italic">Evidence-based. Source-cited. Verify before you prescribe.</p>
                        </>
                      )}
                      {aiCardTab === "Practice Manager" && (
                        <>
                          <p className="text-xs font-semibold text-slate-800 italic mb-2">"Like having a senior PM consultant on call"</p>
                          <ul className="space-y-2 text-xs text-slate-700">
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">✅</span><span>CQC inspection prep — checklists, gap analysis, evidence</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📄</span><span>NHS contracts — GMS/PMS, QOF, Enhanced Services, ARRS</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">👥</span><span>HR guidance — recruitment, sickness, disciplinary, TUPE</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📝</span><span>Complaints handling — process, templates, PHSO escalation</span></li>
                          </ul>
                          <p className="text-[10px] text-indigo-600 font-medium mt-3 italic">Practical, actionable, grounded in regulation.</p>
                        </>
                      )}
                      {aiCardTab === "NRES" && (
                        <>
                          <p className="text-xs font-semibold text-slate-800 italic mb-2">"Full programme knowledge at your fingertips"</p>
                          <ul className="space-y-2 text-xs text-slate-700">
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🏥</span><span>All 7 practices — list sizes, targets, allocations</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">💰</span><span>Buy-back scheme — rates, claims process, evidence requirements</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📊</span><span>GPAD data, ICB metrics, reporting schedules</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">👤</span><span>Key contacts — ICB, PML, programme team</span></li>
                          </ul>
                          <p className="text-[10px] text-indigo-600 font-medium mt-3 italic">Everything about the pilot, instantly.</p>
                        </>
                      )}
                      {aiCardTab === "Buy-Back" && (
                        <>
                          <p className="text-xs font-semibold text-slate-800 italic mb-2">"The buy-back scheme explained, step by step"</p>
                          <ul className="space-y-2 text-xs text-slate-700">
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">💰</span><span>How buy-back works — existing staff delivering SDA reclaim costs against your allocation</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📊</span><span>Your practice budget — list size × £26.33, the 70/16/14 split, and what you actually get</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">📝</span><span>Claims process — the 6-step workflow from submission to payment</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">💷</span><span>Approved rates — GP session rates, ANP/ACP hourly rates, on-costs at 29.38%</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">✅</span><span>Evidence requirements — what you need to submit and what gets approved</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🔄</span><span>Part A to Part B link — how buy-back funds must be spent on new proactive care</span></li>
                            <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">⚠️</span><span>Common pitfalls — unclaimed funds, cumulative budgets, locum rate caps</span></li>
                          </ul>
                          <p className="text-[10px] text-indigo-600 font-medium mt-3 italic">Complex scheme, simple answers. Ask me anything about your practice's position.</p>
                        </>
                       )}
                       {aiCardTab === "Translate" && (
                         <>
                           <p className="text-xs font-semibold text-emerald-800 italic mb-2">"Real-time patient translation — no interpreter needed"</p>
                           <ul className="space-y-2 text-xs text-slate-700">
                             <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🌍</span><span>Just say "I need translation" and name the language</span></li>
                             <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🗣️</span><span>You speak English — your patient speaks their language — I translate both ways live</span></li>
                             <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🏥</span><span>Medical terms translated into plain language your patient will understand</span></li>
                             <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">⚡</span><span>Instant — no booking interpreters, no waiting, no phone loops</span></li>
                             <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🚨</span><span>Safety built in — I'll flag any clinical red flags I hear during translation</span></li>
                             <li className="flex items-start gap-2"><span className="mt-0.5 shrink-0">🌐</span><span>Any language — Polish, Urdu, Arabic, Romanian, Bengali, Mandarin, and many more</span></li>
                           </ul>
                             <p className="text-[10px] text-emerald-600 font-medium mt-3 italic">Launch the dedicated interpreter below — instant, no booking, any language.</p>
                             <a
                               href="https://elevenlabs.io/app/talk-to?agent_id=agent_2601knsxn311f9evq5zs0rrese7s"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-teal-700 transition-all"
                            >
                              🌍 Launch Notewell Translate
                            </a>
                          </>
                       )}
                     </div>

                    <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200 text-center">
                      👋 Click <strong>Start a Consultation</strong> in the bottom-right corner to get started
                    </p>
                  </CardContent>
                </Card>
                </div>

                {/* Column 2 — Key Programme Metrics */}
                <div className="flex flex-col gap-2 h-full">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[#005EB8]" />
                    <span className="font-semibold text-slate-900">Key Programme Metrics</span>
                  </div>
                <Card className="bg-slate-50 border-0 shadow-sm hover:shadow-md transition-shadow flex flex-col flex-1">
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

                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Contract Value (per year)</p>
                          <p className="text-2xl font-bold text-slate-900 mt-0.5">{customMetrics?.contractValue || '£2.36m'}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{customMetrics?.contractDetail || '£2,358,746.72 p/a · 2-year pilot'}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                          <PoundSterling className="w-5 h-5 text-green-600" />
                        </div>
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
                    {/* Reporting Requirements Button */}
                    <div className="mt-3">
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
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Updated: 09 April 2026</p>
                  </CardContent>
                </Card>
                </div>

                <div className="flex flex-col gap-2 h-full">
                  <div className="flex items-center gap-2">
                    <Handshake className="h-5 w-5 text-[#005EB8]" />
                    <span className="font-semibold text-slate-900">Programme Partners</span>
                  </div>
                <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow flex flex-col flex-1">
                  <CardContent className="p-6 flex flex-col flex-1 justify-between">
                    <div className="grid grid-cols-2 gap-4 place-items-center">
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
                          <img 
                            src={NHSNorthantsICBLogo} 
                            alt="NHS Northamptonshire Integrated Care Board" 
                            className="h-20 w-auto object-contain"
                          />
                        </>
                      )}
                    </div>

                    {/* Days Since Go-Live */}
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const goLive = goLiveDate || new Date(2026, 3, 1);
                      goLive.setHours(0, 0, 0, 0);
                      const diffMs = today.getTime() - goLive.getTime();
                      const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                      return (
                        <div className="flex items-center justify-center gap-3 py-4">
                          <p className="text-4xl font-bold text-[#005EB8]">{daysSince}</p>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">DAYS SINCE<br />GO-LIVE</p>
                        </div>
                      );
                    })()}

                    <Card className="bg-white/80 border border-slate-200 hover:border-[#005EB8] transition-colors">
                      <CardContent className="p-3 flex items-center min-h-[56px]">
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
                      </CardContent>
                    </Card>
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
                  <SDAPartnerQuickGuide neighbourhoodName={neighbourhoodName} customGuideItems={customGuideItems} />
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
              <ActionLogTable actions={activeActionLogData} metadata={activeActionLogMetadata} neighbourhoodName={neighbourhoodName as 'NRES' | 'ENN'} />
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
            <div className="space-y-6 p-4 pt-0">
              {/* Population Mix Chart */}
              <Card className="bg-slate-50 border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">Practice Population Mix</CardTitle>
                  <p className="text-sm text-slate-500">Source: January 2026 List Size</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 10, right: 80, bottom: 10, left: 80 }}>
                        <Pie
                          data={populationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent, value }) => `${name} ${(percent * 100).toFixed(1)}% (${value.toLocaleString()})`}
                          labelLine={true}
                          style={{ fontSize: '11px' }}
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

              {/* Key Practice Info Table */}
              <Card className="bg-slate-50 border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">Key Practice Information</CardTitle>
                  <p className="text-sm text-slate-500">ODS codes, addresses &amp; hub assignments — January 2026 data</p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wider">
                        <th className="text-left p-2 border-b font-semibold">ODS Code</th>
                        <th className="text-left p-2 border-b font-semibold">Practice</th>
                        <th className="text-right p-2 border-b font-semibold">List Size</th>
                        <th className="text-right p-2 border-b font-semibold">Annual Appts</th>
                        <th className="text-right p-2 border-b font-semibold">Weekly Appts</th>
                        <th className="text-left p-2 border-b font-semibold">Hub</th>
                        <th className="text-left p-2 border-b font-semibold">Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { ods: 'K83007', name: 'Harborough Field Surgery', list: 13991, annual: 11604, weekly: 222, hub: 'Harborough Field Surgery', address: '160 Newton Rd, Rushden NN10 0GP' },
                        { ods: 'K83023', name: 'Oundle Medical Practice', list: 10600, annual: 8792, weekly: 169, hub: 'The Meadows Surgery', address: 'Glapthorn Rd, Peterborough PE8 4JA' },
                        { ods: 'K83024', name: 'Rushden Medical Centre', list: 9143, annual: 7583, weekly: 146, hub: 'Harborough Field Surgery', address: 'Adnitt Road, Rushden NN10 9TR' },
                        { ods: 'K83028', name: 'Spinney Brook Medical Centre', list: 11537, annual: 9569, weekly: 184, hub: 'The Cottons', address: '59 High St, Irthlingborough NN9 5GA' },
                        { ods: 'K83030', name: 'The Cottons Medical Centre', list: 9372, annual: 7773, weekly: 149, hub: 'The Cottons', address: 'Meadow Lane, Raunds NN9 6UA' },
                        { ods: 'K83044', name: 'Parklands Medical Centre', list: 13612, annual: 11290, weekly: 217, hub: 'Harborough Field Surgery', address: 'Wymington Road, Rushden NN10 9EB' },
                        { ods: 'K83065', name: 'Nene Valley Surgery', list: 6921, annual: 5740, weekly: 110, hub: 'The Meadows Surgery', address: 'Green Lane, Thrapston NN14 4QL' },
                        { ods: 'K83069', name: 'Marshalls Road Surgery', list: 3156, annual: 2618, weekly: 50, hub: 'The Cottons', address: "7 Marshall's Rd, Raunds NN9 6ET" },
                        { ods: 'K83080', name: 'Higham Ferrers Surgery', list: 5569, annual: 4619, weekly: 89, hub: 'Harborough Field Surgery', address: 'Saffron Rd, Higham Ferrers NN10 8ED' },
                        { ods: 'K83616', name: 'The Meadows Surgery', list: 6340, annual: 5258, weekly: 101, hub: 'The Meadows Surgery', address: 'Meadow Lane, Thrapston, Kettering, Northamptonshire, NN14 4GD' },
                      ].map((p, i) => (
                        <tr key={p.ods} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-2 border-b font-mono text-xs text-slate-600">{p.ods}</td>
                          <td className="p-2 border-b font-medium text-slate-900">{p.name}</td>
                          <td className="p-2 border-b text-right tabular-nums">{p.list.toLocaleString()}</td>
                          <td className="p-2 border-b text-right tabular-nums">{p.annual.toLocaleString()}</td>
                          <td className="p-2 border-b text-right tabular-nums">{p.weekly.toLocaleString()}</td>
                          <td className="p-2 border-b text-slate-700 text-xs">{p.hub}</td>
                          <td className="p-2 border-b text-slate-500 text-xs">{p.address}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-200 font-semibold">
                        <td className="p-2 border-b" colSpan={2}>Total</td>
                        <td className="p-2 border-b text-right tabular-nums">90,241</td>
                        <td className="p-2 border-b text-right tabular-nums">74,846</td>
                        <td className="p-2 border-b text-right tabular-nums">1,438</td>
                        <td className="p-2 border-b" colSpan={2}>10 practices · 3 hubs</td>
                      </tr>
                    </tbody>
                  </table>
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
    <ContractAskAI open={showContractAskAI} onOpenChange={setShowContractAskAI} neighbourhoodName={neighbourhoodName} />
    <NRESWidgetEmbed />
    </>
  );
};
