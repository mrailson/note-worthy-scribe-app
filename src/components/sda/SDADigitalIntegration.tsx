import { useState, lazy, Suspense } from "react";
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


export const SDADigitalIntegration = () => {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string; title: string } | null>(null);
  const [tabExplorerOpen, setTabExplorerOpen] = useState(false);
  const [reportingPreviewOpen, setReportingPreviewOpen] = useState(false);

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
            <NRESReportingRequirements />
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
        {/* 1. Section Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-xl font-bold text-[#003087]">NRES New Models — ICB Contractual & Reporting Requirements Overview</h2>
              <p className="text-sm text-slate-500">Operational tools and reference documents</p>
            </div>
            <p className="text-xs text-slate-400">Last updated: 22 February 2026</p>
          </div>
        </div>

        {/* 2. Status Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { border: "#10B981", label: "OPERATIONS TOOL", value: "Excel V3.1 ✓ Ready", subtitle: "No additional funding required" },
            { border: "#F59E0B", label: "SERVICE GO-LIVE", value: "1 April 2026", subtitle: "39 days — operational from day one" },
            { border: "#7C3AED", label: "MANAGED BY", value: "Managerial Lead", subtitle: "Practice Managers to supply data not easily accessible via reports" },
            { border: "#2563EB", label: "PRACTICE BURDEN", value: "Medium", subtitle: "Resource funding TBC" },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-3" style={{ borderLeft: `4px solid ${card.border}` }}>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{card.label}</p>
              <p className="text-base font-bold" style={{ color: card.border }}>{card.value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{card.subtitle}</p>
            </div>
          ))}
        </div>

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

        {/* 3b. Section Divider — PRIMARY OPERATIONS TOOL */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase font-bold tracking-wider whitespace-nowrap" style={{ color: "#10B981" }}>● PRIMARY OPERATIONS TOOL</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* 4. Excel Workbook Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 space-y-4">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#ECFDF5", color: "#217346" }}>
              XL
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-bold text-[15px] text-slate-900">NRES SDA Rota Management and Buy Back Resource Workbook V3.1</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold" style={{ backgroundColor: "#ECFDF5", color: "#10B981", border: "1px solid #A7F3D0" }}>✓ Ready</span>
                <Button variant="outline" size="sm" asChild>
                  <a href="/documents/NRES_SDA_Rota_Management_V3_1.xlsx" download>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download Excel
                  </a>
                </Button>
              </div>
              <p className="text-sm text-slate-500">The operational tool for NRES service management from 1st April 2026</p>
            </div>
          </div>

          {/* Body text */}
          <p className="text-sm text-slate-600 leading-relaxed">
            The Managerial Lead will manage this workbook centrally, populating it directly where possible and working with practices to gather any data they can't source themselves. Formula-driven across 20 tabs with full open book financials visible to the NRES board and ICB.
          </p>

          {/* Expandable tab explorer */}
          <div>
            <button
              onClick={() => setTabExplorerOpen(!tabExplorerOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="text-sm text-slate-700">📋 <span className="font-medium">20 tabs</span> — Core · Rota · Finance · Compliance · Practice</span>
              {tabExplorerOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {tabExplorerOpen && (
              <div className="flex flex-wrap gap-2 mt-3 p-3 bg-slate-50 rounded-lg">
                {excelTabs.map((tab, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded text-xs text-slate-700 border border-slate-200" style={{ borderLeft: `3px solid ${tab.color}` }}>
                    <span>{tab.icon}</span> {tab.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Excel Resource Analysis */}
          <div className="bg-white rounded-lg p-4 space-y-3 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#EEF2FF", color: "#4F46E5" }}>
                📊
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-slate-900 mb-1">Operational Resource Analysis — Go-Live Method</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A detailed analysis of the resource requirements for operating the SDA programme using the Excel Workbook V3.1 from Day 1. This document is intended as a ready-to-start framework covering the major operational elements — weekly cycles, monthly reporting, practice burden, and central team effort — with a view to developing the full ICB reporting specification (shown below) in parallel during Year 1 operations.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="bg-white rounded px-2.5 py-1.5 border border-slate-200">
                <span className="text-slate-500">Central Team</span>
                <span className="font-semibold text-slate-800 ml-1">8–12 hrs/wk</span>
              </div>
              <div className="bg-white rounded px-2.5 py-1.5 border border-slate-200">
                <span className="text-slate-500">Per Practice</span>
                <span className="font-semibold text-slate-800 ml-1">1–2 hrs/wk</span>
              </div>
              <div className="bg-white rounded px-2.5 py-1.5 border border-slate-200">
                <span className="text-slate-500">Setup</span>
                <span className="font-semibold text-slate-800 ml-1">24 hrs (one-off)</span>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" size="sm" asChild>
                <a href="/documents/NRES_Excel_Operational_Resource_Analysis.docx" download>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download Resource Analysis
                </a>
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center pt-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">Formula-driven · Open book · No additional funding required</p>
          </div>
        </div>



      </div>
      {/* ===== END SDA Rota / Buy-Back Service Management ===== */}


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

      {/* Project Setup and Overview */}
      <CollapsibleCard
        title="Project Setup & Overview — Nov 2025 – Mar 2026"
        icon={<Calendar className="w-5 h-5" />}
        defaultOpen={false}
      >
        <div className="space-y-6">

      {/* Evidence Cards */}
      <CollapsibleCard
        title="GP Connect Technical Evidence"
        icon={<Monitor className="w-5 h-5" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Exhibit 1 */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Exhibit 1: System Configuration (NRES Mapping)</h3>
            <img 
              src={gpConnectSystmoneConfig} 
              alt="SystmOne GP Remote Booking - NRES SDA configuration showing available rotas at Brackley Medical Centre"
              className="w-full rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setLightboxImage({ src: gpConnectSystmoneConfig, alt: "SystmOne GP Remote Booking", title: "Exhibit 1 - System Configuration (NRES Mapping)" })}
            />
          </div>

          {/* Exhibit 2 */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Exhibit 2: Confirmed Cross-Provider Booking</h3>
            <img 
              src={gpConnectEmisBooking} 
              alt="EMIS Web GP Connect Appointments - Cross-provider booking at Brackley Medical Centre showing NRES SDA appointments"
              className="w-full rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setLightboxImage({ src: gpConnectEmisBooking, alt: "EMIS Web GP Connect Appointments", title: "Exhibit 2 - Confirmed Cross-Provider Booking" })}
            />
          </div>
        </div>
      </CollapsibleCard>

      {/* Risk Stratification Overview */}
      <CollapsibleCard
        title="Risk Stratification Overview & Patient Continuity of Care"
        icon={<FileText className="w-5 h-5" />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Exhibit 3: Risk Stratification Framework</h3>
            <img 
              src="/images/nres-risk-stratification.png" 
              alt="NRES SDA Hub Pilot Risk Stratification Overview showing RED, AMBER, GREEN patient categories and practice discretionary exemptions"
              className="w-full rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setLightboxImage({ src: "/images/nres-risk-stratification.png", alt: "Risk Stratification Overview", title: "Exhibit 3 - Risk Stratification Framework" })}
            />
          </div>
          <div className="border border-slate-200 rounded-lg p-4 flex flex-col">
            <h3 className="font-semibold text-slate-900 mb-3">Risk Stratification Details</h3>
            <div className="space-y-3 text-sm text-slate-700 flex-1">
              <p>Strategic approach to protecting vulnerable patients and optimising service utilisation across the NRES SDA Hub Pilot.</p>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Risk Levels</h4>
                <ul className="space-y-1 ml-4 list-disc">
                  <li><span className="font-medium text-red-700">RED (Exempt)</span> — End of Life, Severe Frailty, or 5+ co-morbidities. Completely exempt from Hub redirection.</li>
                  <li><span className="font-medium text-amber-700">AMBER (Clinical Discretion)</span> — Moderate complexity / 2–4 co-morbidities. Staff assess suitability before booking.</li>
                  <li><span className="font-medium text-green-700">GREEN (Eligible)</span> — Low complexity / routine need. Fully eligible for Hub booking.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Practice Discretionary Exemption</h4>
                <p>Additional protection for patients unable to travel, experiencing anxiety/stress in unfamiliar settings, or where local knowledge (safeguarding, complex family dynamics) is essential.</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/documents/NRES_Risk_Stratification_Overview.docx" download>
                  <Download className="h-4 w-4 mr-2" />
                  Full Document (Word)
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/documents/Risk_Stratification_Continuity_of_Care_EMIS.docx" download>
                  <Download className="h-4 w-4 mr-2" />
                  EMIS Bulk Loading Guide
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/documents/Risk_Stratification_Continuity_of_Care_SystmOne.docx" download>
                  <Download className="h-4 w-4 mr-2" />
                  SystmOne Bulk Loading Guide
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Patient Communication Strategy */}
        <div className="mt-6 border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Patient Communication Strategy — NHS App Risk Stratification Marker</h3>
          <div className="flex items-start gap-4">
            <img
              src={patientCommsRiskStrat}
              alt="NHS App Risk Stratification Marker - Patient Communication Strategy for Blue PCN"
              className="w-48 sm:w-56 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0"
              onClick={() => setLightboxImage({ src: patientCommsRiskStrat, alt: "Patient Communication Strategy", title: "NHS App Risk Stratification Marker — Patient Comms" })}
            />
            <div className="text-sm text-slate-600 space-y-1">
              <p>Click image to view full size. Covers context &amp; mandate, NHS App visibility challenge, pre-approved patient communication template, and current outcomes.</p>
              <p className="text-xs text-slate-500">Governance: Malcolm Railson, Digital and Transformation Lead, Blue PCN | Date: 13 February 2026</p>
            </div>
          </div>
        </div>
      </CollapsibleCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Status */}
        <CollapsibleCard
          title="Verification Complete"
          icon={<CheckCircle2 className="w-5 h-5" />}
          defaultOpen={false}
          className="bg-gradient-to-br from-green-50 to-emerald-50"
          badge={<Badge className="bg-green-600">100% ACCESS GRANTED</Badge>}
        >
          <p className="text-sm text-green-700">
            <strong>Confirmed:</strong> Alex Whitehead, Malcolm Railson, and Amanda Taylor have successfully verified functional clinical system access across all 7 practice clinical environments. All Data Sharing Agreements (DSAs) have been completed and signed.
          </p>
        </CollapsibleCard>

        {/* Remote Hardware Strategy */}
        <CollapsibleCard
          title="Remote Hardware Strategy"
          icon={<Laptop className="w-5 h-5" />}
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#005EB8] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Central Procurement</h4>
                <p className="text-sm text-slate-600">Laptops for all remote SDA staff managed centrally (Malcolm Railson?).</p>
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

            {/* Hardware & Software Cost Estimate */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-amber-800 mb-2">Hardware & Software Costs (Project Budget Item)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-700">£1,200</p>
                  <p className="text-sm text-amber-600">per laptop (Software & Hardware)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-700">8-10</p>
                  <p className="text-sm text-amber-600">laptops required</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-200 text-center">
                <p className="text-sm text-amber-700">
                  <strong>Estimated Total:</strong> £9,600 - £12,000
                </p>
              </div>
            </div>
          </div>
        </CollapsibleCard>
      </div>

      {/* System Access Summary */}
      <CollapsibleCard
        title="System Access Matrix"
        icon={<Settings className="w-5 h-5" />}
        defaultOpen={false}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { system: "SystmOne (TPP)", status: "Active", practices: 5, color: "bg-blue-50" },
              { system: "EMIS Web", status: "Active", practices: 2, color: "bg-cyan-50" },
              { system: "GP Connect", status: "Verified", practices: 7, color: "bg-green-50" },
              { system: "Ardem & Gem VPN", status: "Always On", practices: 7, color: "bg-purple-50" },
            ].map((item, index) => (
              <div key={index} className={`${item.color} rounded-lg p-4 text-center`}>
                <p className="text-sm text-slate-500 font-medium">{item.system}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{item.practices}</p>
                <p className="text-xs text-slate-500">practices</p>
                <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-200">
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>

          {/* Practice breakdown */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-semibold text-slate-900 mb-3">Practice System Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-[#005EB8]"></div>
                  <h5 className="font-semibold text-slate-900">SystmOne (TPP) - 5 Practices</h5>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-5">
                  <li>Brackley Medical Centre</li>
                  <li>The Parks (Roade, Blisworth, Hanslope, Grange Park)</li>
                  <li>Brook Health Centre</li>
                  <li>Denton Surgery</li>
                  <li>Bugbrooke Surgery</li>
                </ul>
              </div>
              <div className="bg-cyan-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-600"></div>
                  <h5 className="font-semibold text-slate-900">EMIS Web - 2 Practices</h5>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 ml-5">
                  <li>Springfield Surgery</li>
                  <li>Towcester Medical Centre</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Hardware note */}
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-slate-700">
              <strong>Hardware Access:</strong> All 7 practices clinical systems are accessible via standard Ardem & Gem Build Laptops with always-on VPN configuration.
            </p>
          </div>
        </div>
      </CollapsibleCard>

      {/* IT & Telephony Q&A */}
      <CollapsibleCard
        title="IT & Telephony - Key Questions"
        icon={<Phone className="w-5 h-5" />}
        defaultOpen={false}
      >
        <div className="space-y-6">
          {/* Question 1 - Triage Systems */}
          <div className="border-l-4 border-[#005EB8] pl-4">
            <div className="flex items-start gap-2 mb-2">
              <HelpCircle className="w-5 h-5 text-[#005EB8] flex-shrink-0 mt-0.5" />
              <h4 className="font-semibold text-slate-900">How will practice triage systems feed into the appointments?</h4>
            </div>
             <div className="ml-7 mb-3 bg-green-50 border border-green-300 rounded-lg p-3">
               <p className="text-sm font-semibold text-green-800">✓ Agreed: B. Practice-Led Triage</p>
               <p className="text-xs text-green-700 mt-1">Each practice triages their own patients but can book into neighbourhood-wide SDA slots when appropriate</p>
             </div>
            <div className="ml-7 bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h5 className="font-semibold text-purple-900 mb-2 text-sm">Options for Programme Board to Consider:</h5>
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-700">A.</span>
                  <span><strong>Centralised Triage Hub:</strong> Single triage team reviews all online/phone contacts and books directly into SDA slots across practices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-700">B.</span>
                  <span><strong>Practice-Led Triage:</strong> Each practice triages their own patients but can book into neighbourhood-wide SDA slots when appropriate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-700">C.</span>
                  <span><strong>Hybrid Model:</strong> Practice triage for registered patients; centralised overflow triage for high-demand periods</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-700">D.</span>
                  <span><strong>Other:</strong> Alternative approach to be proposed by the Board</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Question 2 - Cross-Practice Care */}
          <div className="border-l-4 border-[#005EB8] pl-4">
            <div className="flex items-start gap-2 mb-2">
              <HelpCircle className="w-5 h-5 text-[#005EB8] flex-shrink-0 mt-0.5" />
              <h4 className="font-semibold text-slate-900">If patients are seen at a different practice:</h4>
            </div>
            <div className="ml-7 space-y-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">Who is responsible for follow-up?</p>
                 <div className="bg-green-50 border border-green-300 rounded p-3 mt-1">
                   <p className="text-sm font-semibold text-green-800">✓ Agreed: A. Seeing clinician completes acute episode; registered practice handles ongoing care</p>
                 </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">Who orders pathology?</p>
                 <div className="bg-green-50 border border-green-300 rounded p-3 mt-1">
                   <p className="text-sm font-semibold text-green-800">✓ Agreed: D. Seeing clinician orders and a centralised review system reports unactioned Hub requested results (where the patient is from another practice — i.e. excluding patients of that Hub). A process for follow-up will be agreed by the PB and actioned TBC</p>
                 </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">Who handles referrals?</p>
                 <div className="bg-green-50 border border-green-300 rounded p-3 mt-1">
                   <p className="text-sm font-semibold text-green-800">✓ Agreed: A. Seeing clinician makes referral using patient's registered practice code</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Question 3 - Telephony Hub */}
          <div className="border-l-4 border-green-500 pl-4">
            <div className="flex items-start gap-2 mb-2">
              <Phone className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <h4 className="font-semibold text-slate-900">Telephony Hub Requirement</h4>
            </div>
            <div className="ml-7 space-y-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-600">UPDATE - 23rd Jan 2026</Badge>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    <strong>Current Status:</strong> 6 of 7 practices are on <strong>Surgery Connect</strong> phone system.
                  </p>
                  <p>
                    <strong>Outstanding:</strong> Denton Village Surgery is on a different provider.
                  </p>
                  <p>
                    <strong>Action Taken:</strong> Met with X-ON (Surgery Connect parent company) on 18th December 2025. Requested they fund the transfer of Denton Village Surgery to Surgery Connect (buy-out cost from existing provider).
                  </p>
                </div>
              </div>

              {/* X-ON Commercial Proposal */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-300">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h5 className="font-semibold text-slate-900">X-ON Commercial Proposal Received</h5>
                    <Badge className="bg-green-600 text-xs">15th January 2026</Badge>
                  </div>
                  <a 
                    href="/documents/X-ON_Intelligent_Care_Navigation_Proposal_NRES_Jan2026.pdf" 
                    download="X-ON_Intelligent_Care_Navigation_Proposal_NRES_Jan2026.pdf"
                    className="flex items-center gap-2 bg-[#005EB8] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#004494] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Proposal
                  </a>
                </div>
                <p className="text-sm text-slate-700 mb-3">
                  Following negotiations, X-ON has submitted an updated commercial proposal for the <strong>Intelligent Care Navigation System</strong>. Key terms include:
                </p>
                
                <div className="bg-white rounded-lg p-3 mb-3 border border-green-200">
                  <h6 className="font-semibold text-slate-900 text-sm mb-2">Key Commercial Terms:</h6>
                  <ul className="text-sm text-slate-700 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span><strong>17.7% discount</strong> from RRP across all products</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>X-ON will fund <strong>Denton Village Surgery telephony buy-out in full</strong> (£6,434.79 inc. VAT)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span><strong>Two-month rental-free period</strong> (£13,708.87 concession)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span>36-month contract term</span>
                    </li>
                  </ul>
                </div>

                <div className="flex items-center gap-3 p-3 bg-blue-100 rounded-lg border border-blue-300 mb-3">
                  <PoundSterling className="w-5 h-5 text-blue-700" />
                  <div>
                    <p className="text-blue-900 font-semibold">Annual Cost: £82,253.22</p>
                    <p className="text-blue-700 text-xs">(~£6,854/month for 6 practices)</p>
                  </div>
                </div>
              </div>

              {/* Products Included */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h5 className="font-semibold text-slate-900 mb-2">Products Included in Proposal</h5>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Surgery Assist</strong> - AI-powered 24/7 digital front door with multilingual support
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Surgery Insights</strong> - Unified analytics dashboard
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Omni-Consult</strong> - Voice/Web/Staff consultation forms
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Surgery Intellect</strong> - AI Scribe (TORTUS technology, UKCA Class I medical device)
                    </div>
                  </li>
                </ul>
                <p className="text-xs text-slate-500 mt-2 italic">Note: Surgery Connect telephony for Denton is a separate proposal (buy-out funded by X-ON)</p>
              </div>

              {/* Next Steps */}
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <h5 className="font-semibold text-amber-900 text-sm mb-2">Next Steps:</h5>
                <ul className="text-sm text-amber-800 space-y-1 list-disc ml-4">
                  <li>Walk-through meeting to be scheduled with X-ON</li>
                  <li>Formal evaluation against NRES requirements</li>
                  <li>Decision on commercial package</li>
                </ul>
                <p className="text-sm text-amber-800 mt-2">
                  <strong>Lead Contacts:</strong> Alex and Malcolm to provide ongoing updates on IT/practical setup progress.
                </p>
              </div>
            </div>
          </div>
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
            <span className="font-medium">Next Meeting:</span> 26th February 2026
          </p>
          <p className="text-sm text-slate-600">
            Updates will be available on the Notewell NRES portal and at the next Programme Board meeting.
          </p>
          <p className="text-xs text-slate-500 italic">
            Last updated: 12 January 2026
          </p>
        </div>
      </CollapsibleCard>

        </div>
      </CollapsibleCard>
    </div>
    </>
  );
};
