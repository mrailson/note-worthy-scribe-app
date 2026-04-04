import { useState, useEffect, lazy, Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Monitor, Laptop, Settings, Phone, HelpCircle, Clock, ClipboardList, BarChart3, FileText, AlertTriangle, Users, Calendar, TrendingUp, Download, PoundSterling, X, ChevronDown, ChevronUp, Play } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";
import gpConnectEmisBooking from "@/assets/gp-connect-emis-booking.png";
import gpConnectSystmoneConfig from "@/assets/gp-connect-systmone-config.png";
import patientCommsRiskStrat from "@/assets/patient_comms_riskstrat_red_flag.png";


const NRESReportingRequirements = lazy(() => import("@/components/sda/NRESReportingRequirements"));

// Digital Task and Finish Action Log Data
const digitalTfActions = [
  { id: 2, description: "Scope the cost and level of work required for GP system write-back into NARP re patient PNG flags", owner: "Matt Hutton", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 3, description: "Scope options around a manual vs automatic patient flagging mechanism", owner: "Matt Hutton", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 4, description: "Work up the potential costs of additional ICE licenses, or complexities where an individual works across multiple surgeries", owner: "Clare Craven", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 5, description: "Add a member from the PCT to the T&F group", owner: "Ellie Wagg", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 7, description: "Work through the technical capability within ICE re routing for results", owner: "Clare Craven", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 8, description: "Review the SLAs in place for ICE account creation and management.", owner: "Clare Craven", organisation: "ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 9, description: "Set up a futures page to host shared documents", owner: "Kirstie Watson", organisation: "", dueDate: "", status: "", dateCompleted: "" },
  { id: 11, description: "Clarify if the True Hub model requires separate CQC registration and how it impacts reporting", owner: "Ellie Wagg", organisation: "ICB", dueDate: "", status: "", dateCompleted: "" },
  { id: 12, description: "CM speaking to Oxford colleges to ensure that OUH can see Northamptonshire SC records", owner: "Claire Mansfield", organisation: "ICB", dueDate: "", status: "", dateCompleted: "" },
  { id: 13, description: "Malcolm and Sue to share estimate of staffing numbers for ICE licenses (see ref 4)", owner: "Malcolm Railson/Sue Williams", organisation: "NRES Manager/ICB", dueDate: "", status: "In progress", dateCompleted: "" },
  { id: 14, description: "Malcolm and Sue to share SOP for test results (see ref 7)", owner: "", organisation: "", dueDate: "", status: "", dateCompleted: "" },
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
  { group: "purple", color: "#7C3AED", icon: "🏠", label: "7× Practice Dashboards" },
  { group: "purple", color: "#7C3AED", icon: "📧", label: "Contacts" },
  { group: "purple", color: "#7C3AED", icon: "📝", label: "Audit Log" },
];


interface SDADigitalIntegrationProps {
  CustomReportingRequirements?: React.ComponentType;
}

export const SDADigitalIntegration = ({ CustomReportingRequirements }: SDADigitalIntegrationProps = {}) => {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string; title: string } | null>(null);
  const [tabExplorerOpen, setTabExplorerOpen] = useState(false);
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
            {CustomReportingRequirements ? <CustomReportingRequirements /> : <NRESReportingRequirements />}
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
                    NRES Appointment Baseline Dashboard
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      ✓ Live
                    </span>
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Practice-level GPAD data · 7 practices · 48 weeks (Mar 2025 – Feb 2026) · 561,294 appointments
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="/documents/NRES_ICB_Metrics_Requirements_Report_v2_3.docx" download="NRES_ICB_Metrics_Requirements_Report_v2_3.docx">
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

          {/* Description */}
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-600 leading-relaxed">
            Interactive baseline dashboard for the NRES neighbourhood. Filters by individual practice,
            workforce role, and time period. Includes SDA metrics, 30+ minute appointment analysis
            (GP vs other roles for LTC baseline), and a detailed ICB metrics gap analysis with
            proposed resolutions and risk register. Prepared for Michael Chapman's Information Schedule requirements (11 March 2026).
          </div>

          {/* Embedded Dashboard */}
          <div className="w-full" style={{ height: "800px" }}>
            <iframe
              src="/reports/nres_baseline_iframe.html"
              className="w-full h-full border-0"
              title="NRES Baseline Dashboard"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>

          {/* Card Footer */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Data source: GPAD Practice Exports · Brackley · Brook Health · Bugbrooke · Denton · Springfield · The Parks · Towcester</span>
            <span>Last updated: March 2026</span>
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

          {/* Document reference */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <FileText className="w-5 h-5 text-[#005EB8]" />
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900">NRES SDA Reporting Requirements from Specification — Overview & Planning</h4>
              <p className="text-sm text-slate-600">Version 1.7.1 | March 2026</p>
            </div>
            <Button variant="outline" size="sm" asChild className="flex-shrink-0">
              <a href="/documents/NRES_SDA_Reporting_Plan_v1_7_1.docx" download>
                <Download className="h-4 w-4 mr-1" /> Word
              </a>
            </Button>
          </div>

          {/* Reporting Resource Projection */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-200">
            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 rounded-lg p-2.5 mt-0.5">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 text-lg mb-1">Reporting Resource Projection</h4>
                <p className="text-sm text-slate-600 mb-3">
                  A detailed resource analysis projecting the staffing effort required to meet all ICB reporting obligations. 
                  Covers first-time setup vs business-as-usual (BAU) effort for both the central management team and each of the 
                  7 GP practices — including monthly, quarterly, and annual reporting cycles. Identifies high-workload reports 
                  and estimates approximately 52 central hours/month and 4–6 practice hours/month once established.
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">Central: ~52 hrs/mth BAU</span>
                  <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">Per Practice: 4–6 hrs/mth</span>
                  <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-medium">Setup: 80–100 hrs/practice</span>
                  <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium">4 High-Workload Reports</span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/documents/NRES_Reporting_Resource_Analysis_v2.docx" download>
                    <Download className="h-4 w-4 mr-1" /> Download Resource Projection (Word)
                  </a>
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
                    { report: "Workforce Rota Summary", frequency: "Monthly", owner: "Practice Managers", to: "Lead Provider (DocMed/PML)" },
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
            Source: NRES_SDA_Reporting_Plan.docx v1.7.1 | Last updated: 16 March 2026
          </p>
        </div>
      </CollapsibleCard>

    </div>

      {/* Baseline Dashboard Fullscreen Modal */}
      {baselineFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-black/80" onClick={() => setBaselineFullscreen(false)}>
          <button
            onClick={() => setBaselineFullscreen(false)}
            className="absolute top-4 right-4 z-[10000] bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
            aria-label="Close fullscreen"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
          <iframe
            src="/reports/nres_baseline_iframe.html"
            className="w-full h-full border-0"
            title="NRES Baseline Dashboard Full Screen"
            sandbox="allow-scripts allow-same-origin"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
