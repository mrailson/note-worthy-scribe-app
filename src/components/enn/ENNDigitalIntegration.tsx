import { useState, useEffect, lazy, Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, BarChart3, FileText, AlertTriangle, Users, Download, X, ChevronDown, ChevronUp, Play } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";
import gpConnectEmisBooking from "@/assets/gp-connect-emis-booking.png";
import gpConnectSystmoneConfig from "@/assets/gp-connect-systmone-config.png";
import patientCommsRiskStrat from "@/assets/patient_comms_riskstrat_red_flag.png";


const ENNReportingRequirements = lazy(() => 
  import("@/components/enn/ENNReportingRequirements").catch(() => ({
    default: () => (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">ENNReportingRequirements component not found</p>
          <p className="text-sm">Place the ENNReportingRequirements.tsx file in /components/enn/</p>
        </div>
      </div>
    )
  }))
);

// Digital Task and Finish Action Log Data
const digitalTfActions = [
  { id: 1, description: "Confirm clinical system (EMIS/SystmOne) for each of the 10 ENN practices", owner: "Rebecca Gane", organisation: "3Sixty", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 2, description: "Scope the cost and level of work required for GP system write-back into NARP re patient PNG flags", owner: "TBC", organisation: "ICB", dueDate: "", status: "Pending", dateCompleted: "" },
  { id: 3, description: "Scope options around a manual vs automatic patient flagging mechanism", owner: "TBC", organisation: "ICB", dueDate: "", status: "Pending", dateCompleted: "" },
  { id: 4, description: "Work up the potential costs of additional ICE licenses for ENN hub staff working across multiple surgeries", owner: "TBC", organisation: "ICB", dueDate: "", status: "Pending", dateCompleted: "" },
  { id: 5, description: "Confirm GP Connect cross-booking capability across all 3 ENN hubs", owner: "TBC", organisation: "3Sixty", dueDate: "", status: "Pending", dateCompleted: "" },
  { id: 6, description: "Confirm hub premises capacity and room availability for each hub site", owner: "Rebecca Gane", organisation: "3Sixty", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 7, description: "Establish Practice Manager reporting leads for each of the 10 practices", owner: "Rebecca Gane", organisation: "3Sixty", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 8, description: "Confirm telephony platform status across all 10 ENN practices", owner: "TBC", organisation: "3Sixty", dueDate: "", status: "Pending", dateCompleted: "" },
  { id: 9, description: "Set up GPAD data exports and baseline reporting for ENN practices", owner: "Malcolm Railson", organisation: "PCN Services", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 10, description: "Confirm DSA and DPIA status for neighbourhood data sharing", owner: "Rebecca Gane", organisation: "3Sixty", dueDate: "", status: "Pending", dateCompleted: "" },
];

// Tab data for the Excel workbook explorer
const excelTabs = [
  { group: "blue", color: "#2563EB", icon: "⚙️", label: "Assumptions" },
  { group: "blue", color: "#2563EB", icon: "📊", label: "Allocations" },
  { group: "blue", color: "#2563EB", icon: "🏥", label: "Room Capacity" },
  { group: "teal", color: "#0D9488", icon: "📅", label: "Weekly Rota" },
  { group: "teal", color: "#0D9488", icon: "🗓️", label: "Monthly Rota" },
  { group: "teal", color: "#0D9488", icon: "👥", label: "Workforce" },
  { group: "green", color: "#10B981", icon: "🔄", label: "Buy-Back" },
  { group: "green", color: "#10B981", icon: "💰", label: "Cash Flow" },
  { group: "amber", color: "#F59E0B", icon: "✅", label: "Compliance" },
  { group: "amber", color: "#F59E0B", icon: "🚫", label: "DNA Tracking" },
  { group: "amber", color: "#F59E0B", icon: "📋", label: "Absence" },
  { group: "purple", color: "#7C3AED", icon: "🏠", label: "10× Practice Dashboards" },
  { group: "purple", color: "#7C3AED", icon: "📧", label: "Contacts" },
  { group: "purple", color: "#7C3AED", icon: "📝", label: "Audit Log" },
];


export const SDADigitalIntegration = () => {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string; title: string } | null>(null);
  const [reportingPreviewOpen, setReportingPreviewOpen] = useState(false);
  const [baselineFullscreen, setBaselineFullscreen] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'openBaselineFullscreen') setBaselineFullscreen(true);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);


  const handleDownloadImage = () => {
    if (!lightboxImage) return;
    const a = document.createElement('a');
    a.href = lightboxImage.src;
    a.download = `${lightboxImage.title.replace(/\s+/g, '_')}.png`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      {/* Reporting Requirements Fullscreen Modal */}
      {reportingPreviewOpen && (
        <div className="fixed inset-0 z-[200] bg-white overflow-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
            <span className="text-sm font-semibold text-slate-700">ICB Reporting Requirements Explorer</span>
            <Button variant="outline" size="sm" onClick={() => setReportingPreviewOpen(false)}>
              <X className="h-4 w-4 mr-1" /> Close Preview
            </Button>
          </div>
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-400">Loading preview…</div>}>
            <ENNReportingRequirements />
          </Suspense>
        </div>
      )}
    <div className="space-y-6">
      {/* Fullscreen Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxImage(null)}
        >
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
            <p className="text-white font-medium truncate max-w-[500px]">{lightboxImage.title}</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleDownloadImage(); }}>
                <Download className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setLightboxImage(null)}>
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center w-full h-full p-4 md:p-16" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage.src} alt={lightboxImage.alt} className="max-w-full max-h-full object-contain select-none" draggable={false} />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Esc</kbd> or click anywhere to close
          </div>
        </div>
      )}
      {/* ===== SDA Rota / Buy-Back Service Management ===== */}


      <div className="space-y-4">
        {/* 3. Section Divider — GPAD BASELINE REPORTS */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase font-bold tracking-wider whitespace-nowrap" style={{ color: "#10B981" }}>▸ GPAD BASELINE REPORTS</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* GPAD Baseline Dashboard Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Card Header */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#005EB8] flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    ENN Appointment Baseline Dashboard
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      v1.7
                    </span>
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Practice-level GPAD data · 10 practices · 3 hubs · 90,241 patients
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="/documents/ENN_ICB_Metrics_Requirements_Report_v1_0.docx" download="ENN_ICB_Metrics_Requirements_Report_v1_0.docx">
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download Reporting Requirements Report
                  </a>
                </Button>
              </div>
            </div>

            {/* Feature tags */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-md">Practice Filter</span>
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-md">Role Filter (GP / Nurses / DPC)</span>
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-md">Weekly / Monthly / Quarterly</span>
              <span className="px-2 py-1 bg-purple-50 text-purple-700 text-[10px] font-semibold rounded-md">30+ Min LTC Analysis</span>
              <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded-md">ICB Metrics Mapping</span>
            </div>
          </div>

          {/* Embedded Baseline Dashboard */}
          <div className="w-full" style={{ height: "800px" }}>
            <iframe
              src="/reports/enn_baseline_dashboard_v1_7.html"
              className="w-full h-full border-0"
              title="ENN Baseline Dashboard"
            />
          </div>
        </div>

      </div>


      <CollapsibleCard
        title="Full SDA Reporting Requirements from Specification — Overview & Planning"
        icon={<BarChart3 className="w-5 h-5" />}
        defaultOpen={true}
        
      >
        <div className="space-y-6">
          {/* Interactive Reporting Requirements Explorer */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 rounded-lg p-2.5 mt-0.5">
                <BarChart3 className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 text-lg mb-1">Interactive ICB Reporting Requirements Explorer</h4>
                <p className="text-sm text-slate-600 mb-3">
                  A comprehensive interactive guide covering all ICB reporting requirements extracted from the SDA specification. 
                  Explore 10 reporting domains including activity & performance, quality & safety, referrals, prescribing, workforce, 
                  Part B complex care, financial reporting, innovator site duties, and governance compliance — with direct quotes, 
                  mandatory status indicators, and data field specifications.
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium">30+ Mandatory Requirements</span>
                  <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full font-medium">10 Reporting Domains</span>
                  <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">ICB Specification Quotes</span>
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-medium">v1.7</span>
                </div>
                <Button 
                  onClick={() => setReportingPreviewOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-md"
                >
                  <Play className="h-4 w-4 mr-2" /> Open Interactive Preview
                </Button>
              </div>
            </div>
          </div>


          {/* KPI Grid */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Key Performance Indicators</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "Total Appointments Delivered", target: "Monthly", color: "bg-blue-50 border-blue-200" },
                { label: "Hub Utilisation Rate", target: "≥ 85%", color: "bg-green-50 border-green-200" },
                { label: "Patient Satisfaction Score", target: "≥ 4.0/5.0", color: "bg-purple-50 border-purple-200" },
                { label: "Workforce Rostering Compliance", target: "≥ 90%", color: "bg-cyan-50 border-cyan-200" },
                { label: "Financial Reconciliation", target: "Monthly", color: "bg-amber-50 border-amber-200" },
                { label: "Incident / Significant Events", target: "Real-time", color: "bg-red-50 border-red-200" },
              ].map((kpi, index) => (
                <div key={index} className={`${kpi.color} rounded-lg p-4 border`}>
                  <p className="text-sm font-medium text-slate-700">{kpi.label}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{kpi.target}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reporting Frequency */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Reporting Frequency & Submission</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-3 font-semibold text-slate-700 border border-slate-200">Report</th>
                    <th className="text-left p-3 font-semibold text-slate-700 border border-slate-200">Frequency</th>
                    <th className="text-left p-3 font-semibold text-slate-700 border border-slate-200">Owner</th>
                    <th className="text-left p-3 font-semibold text-slate-700 border border-slate-200">Submitted To</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { report: "Appointment Activity Report", frequency: "Monthly", owner: "Malcolm Railson", to: "ICB / Programme Board" },
                    { report: "Workforce Rota Summary", frequency: "Monthly", owner: "Practice Managers", to: "3Sixty Care Partnership" },
                    { report: "Financial Reconciliation", frequency: "Monthly", owner: "Finance Lead", to: "ICB Finance Team" },
                    { report: "Patient Satisfaction Dashboard", frequency: "Quarterly", owner: "Quality Lead", to: "Programme Board" },
                    { report: "Incident & SEA Log", frequency: "As required", owner: "Clinical Governance Lead", to: "ICB / CQC if required" },
                    { report: "Full Programme Evaluation", frequency: "End of Year 1 & Year 2", owner: "Programme Manager", to: "ICB / NHS England" },
                  ].map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="p-3 border border-slate-200 font-medium text-slate-800">{row.report}</td>
                      <td className="p-3 border border-slate-200 text-slate-600">{row.frequency}</td>
                      <td className="p-3 border border-slate-200 text-slate-600">{row.owner}</td>
                      <td className="p-3 border border-slate-200 text-slate-600">{row.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RAG Status */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">RAG Status Escalation Thresholds</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Badge className="bg-green-600 mt-0.5 flex-shrink-0">GREEN</Badge>
                <p className="text-sm text-slate-700">All KPIs on track. Hub utilisation ≥ 85%, patient satisfaction ≥ 4.0/5.0, no unresolved incidents.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Badge className="bg-amber-500 mt-0.5 flex-shrink-0">AMBER</Badge>
                <p className="text-sm text-slate-700">One or more KPIs below target for ≤ 4 weeks. Corrective action plan required within 10 working days.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <Badge className="bg-red-600 mt-0.5 flex-shrink-0">RED</Badge>
                <p className="text-sm text-slate-700">KPIs persistently below target for &gt; 4 weeks, patient safety concern, or financial discrepancy. Immediate escalation to ICB required.</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 italic">
            Source: ENN_SDA_Reporting_Plan.docx v1.0 | Last updated: 4 April 2026
          </p>
        </div>
      </CollapsibleCard>

      {/* Digital Task and Finish Action Log */}
      <CollapsibleCard
        title="Digital Task & Finish Group - Action Log"
        icon={<ClipboardList className="w-5 h-5" />}
        defaultOpen={false}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-20 font-semibold">Action ID</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="w-44 font-semibold">Owner</TableHead>
                <TableHead className="w-28 font-semibold">Due Date</TableHead>
                <TableHead className="w-28 font-semibold">Status</TableHead>
                <TableHead className="w-32 font-semibold">Date Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {digitalTfActions.map((action) => (
                <TableRow key={action.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{action.id}</TableCell>
                  <TableCell className="text-sm text-slate-700">{action.description}</TableCell>
                  <TableCell className="text-sm">
                    {action.owner ? (
                      <div>
                        <span>{action.owner}</span>
                        {action.organisation && (
                          <span className="text-xs text-slate-500 block">({action.organisation})</span>
                        )}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{action.dueDate || "-"}</TableCell>
                  <TableCell>
                    {action.status === "In progress" ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">In progress</Badge>
                    ) : action.status ? (
                      <Badge variant="outline">{action.status}</Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{action.dateCompleted || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
          <p className="text-sm text-slate-700">
            <span className="font-medium">Next Meeting:</span> TBC
          </p>
          <p className="text-sm text-slate-600">
            Updates will be available on the Notewell ENN portal and at the next Programme Board meeting.
          </p>
          <p className="text-xs text-slate-500 italic">
            Last updated: 4 April 2026
          </p>
        </div>
      </CollapsibleCard>

    </div>

      {/* Baseline Dashboard Fullscreen Modal */}
      {baselineFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-white overflow-auto" onClick={() => setBaselineFullscreen(false)}>
          <button
            onClick={() => setBaselineFullscreen(false)}
            className="absolute top-4 right-4 z-[10000] bg-slate-100 hover:bg-slate-200 rounded-full p-2 shadow-lg transition-colors"
            aria-label="Close fullscreen"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
          <div className="max-w-5xl mx-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-amber-900 mb-2">ENN Baseline Dashboard — Simulated Data</h2>
              <p className="text-amber-800 mb-4">Full interactive dashboard will be available once GPAD appointment exports are received from each of the 10 ENN practices.</p>
              <p className="text-sm text-amber-600">Use the inline dashboard in the main view for simulated data with hub/spoke filtering.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
