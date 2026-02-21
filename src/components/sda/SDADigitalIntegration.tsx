import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Monitor, Laptop, Settings, Phone, HelpCircle, Clock, ClipboardList, BarChart3, FileText, AlertTriangle, Users, Calendar, TrendingUp, Download, PoundSterling, X, ChevronDown, ChevronUp, Play } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";
import gpConnectEmisBooking from "@/assets/gp-connect-emis-booking.png";
import gpConnectSystmoneConfig from "@/assets/gp-connect-systmone-config.png";

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

// Thumbnail configs for the gold standard panel
const thumbnails = [
  { label: "Overview", badge: "5 KPIs", bg: "linear-gradient(135deg, #F8FAFC, #EFF6FF)" },
  { label: "Practices", badge: "7 rows", bg: "linear-gradient(135deg, #F8FAFC, #EFF6FF)" },
  { label: "Rota & Capacity", badge: "Capacity", bg: "linear-gradient(135deg, #F0FDFA, #F8FAFC)" },
  { label: "Buy-Back", badge: "6 steps", bg: "linear-gradient(135deg, #F5F3FF, #F8FAFC)" },
  { label: "Part B Evidence", badge: "4 categories", bg: "linear-gradient(135deg, #EEF2FF, #F8FAFC)" },
  { label: "Timeline", badge: "4 phases", bg: "linear-gradient(135deg, #FDF8E1, #F8FAFC)" },
];

export const SDADigitalIntegration = () => {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string; title: string } | null>(null);
  const [tabExplorerOpen, setTabExplorerOpen] = useState(false);

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
              <h2 className="text-xl font-bold text-[#003087]">SDA Rota / Buy-Back Service Management</h2>
              <p className="text-sm text-slate-500">Operational tools and reference documents</p>
            </div>
            <p className="text-xs text-slate-400">Last updated: 20 February 2026</p>
          </div>
        </div>

        {/* 2. Status Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { border: "#10B981", label: "OPERATIONS TOOL", value: "Excel V3.1 ✓ Ready", subtitle: "No additional funding required" },
            { border: "#F59E0B", label: "SERVICE GO-LIVE", value: "1 April 2026", subtitle: "39 days — operational from day one" },
            { border: "#7C3AED", label: "MANAGED BY", value: "Railson & Palin", subtitle: "Populated centrally, practices consulted" },
            { border: "#2563EB", label: "PRACTICE BURDEN", value: "Minimal", subtitle: "Data gathered centrally where possible" },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-3" style={{ borderLeft: `4px solid ${card.border}` }}>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{card.label}</p>
              <p className="text-base font-bold" style={{ color: card.border }}>{card.value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{card.subtitle}</p>
            </div>
          ))}
        </div>

        {/* 3. Section Divider — PRIMARY OPERATIONS TOOL */}
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
                <h3 className="font-bold text-[15px] text-slate-900">NRES SDA Rota Management Workbook V3.1</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold" style={{ backgroundColor: "#ECFDF5", color: "#10B981", border: "1px solid #A7F3D0" }}>✓ Ready</span>
              </div>
              <p className="text-sm text-slate-500">The operational tool for NRES service management from 1st April 2026</p>
            </div>
          </div>

          {/* Body text */}
          <p className="text-sm text-slate-600 leading-relaxed">
            Malcolm Railson and Amanda Palin will manage this workbook centrally, populating it directly where possible and working with practices to gather any data they can't source themselves. Formula-driven across 20 tabs with full open book financials visible to the NRES board and ICB.
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

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">Formula-driven · Open book · No additional funding required</p>
            <Button variant="outline" size="sm" asChild>
              <a href="/documents/NRES_SDA_Rota_Management_V3_1.xlsx" download>
                <Download className="h-4 w-4 mr-1" />
                Download Excel
              </a>
            </Button>
          </div>
        </div>

        {/* 5. Green Callout Banner */}
        <div className="rounded-lg p-4 flex items-start gap-3" style={{ backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0" }}>
          <span className="text-lg flex-shrink-0">✅</span>
          <p className="text-sm leading-relaxed" style={{ color: "#065F46" }}>
            <span className="font-bold" style={{ color: "#047857" }}>No additional funding or resources required.</span> This workbook is complete, tested, and ready for service launch. It provides full operational management capability for the NRES programme from day one without any system build, licensing, or infrastructure costs.
          </p>
        </div>

        {/* 6. Functional Spec Reference Doc */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EFF6FF" }}>
            <FileText className="w-5 h-5" style={{ color: "#2563EB" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-slate-900">Functional Specification v2.3</h3>
            <p className="text-xs text-slate-500">Technical reference — appointment targets, buy-back logic, compliance reporting. Describes both Excel and potential future system.</p>
          </div>
          <Button variant="outline" size="sm" asChild className="flex-shrink-0">
            <a href="/documents/NRES_SDA_Rota_Spec_v2.3.docx" download>
              <Download className="h-4 w-4 mr-1" />
              Word
            </a>
          </Button>
        </div>

        <div className="flex items-center gap-3 pt-3">
          <span className="text-[11px] uppercase font-bold tracking-wider whitespace-nowrap" style={{ color: "#D4A800" }}>✦ FOR PROGRAMME BOARD CONSIDERATION POST GO-LIVE IF NEEDED</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* 8. Gold Standard Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {/* Gold ribbon */}
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #F5C518, #D4A800, #F5C518)" }} />

          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: "#FDF8E1" }}>✦</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[14px] text-slate-900">Notewell AI — Live Dashboard System</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold" style={{ backgroundColor: "#FDF8E1", border: "1px solid #F0DC82", color: "#92400E" }}>Gold Standard Option</span>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold" style={{ backgroundColor: "#FDF8E1", border: "1px solid #F0DC82", color: "#92400E" }}>⏳ Subject to Programme Board approval</span>
            </div>

            {/* Body text */}
            <p className="text-sm text-slate-600 leading-relaxed">
              This is not a requirement of the NRES project. The Excel workbook above provides everything needed to run the service. However, should the Programme Board consider that gold standard management of the operational detail would benefit the programme, a live web-based system could replace the Excel over time — providing real-time dashboards, automated compliance alerts, audit trails, and multi-user access with role-based permissions. This would be a decision for the board based on perceived value, not a project dependency.
            </p>

            {/* Screen preview strip */}
            <div className="rounded-lg p-4" style={{ backgroundColor: "#FAFBFC" }}>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3">What the system could look like — 6 interactive sections</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {thumbnails.map((thumb, i) => (
                  <div
                    key={i}
                    className="group rounded-lg border border-slate-200 overflow-hidden transition-all hover:border-[#7C3AED] hover:-translate-y-0.5 cursor-pointer"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(124,58,237,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
                  >
                    <div className="h-[72px] relative p-2" style={{ background: thumb.bg }}>
                      {/* Mini chart graphics per thumbnail */}
                      {i === 0 && (
                        <div className="flex items-end gap-1 h-full">
                          <div className="w-3 h-6 rounded-sm" style={{ backgroundColor: "#003087" }} />
                          <div className="w-3 h-8 rounded-sm" style={{ backgroundColor: "#005EB8" }} />
                          <div className="w-3 h-5 rounded-sm" style={{ backgroundColor: "#0D9488" }} />
                          <div className="ml-auto w-6 h-6 rounded-full border-2" style={{ borderColor: "#10B981" }} />
                        </div>
                      )}
                      {i === 1 && (
                        <div className="flex flex-col gap-[2px] h-full justify-center">
                          {[...Array(5)].map((_, r) => (
                            <div key={r} className="flex gap-[2px]">
                              <div className="w-3 h-2 rounded-[1px]" style={{ backgroundColor: "#2563EB", opacity: 0.6 }} />
                              <div className="w-4 h-2 rounded-[1px] bg-slate-200" />
                              <div className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: r < 3 ? "#10B981" : r < 4 ? "#F59E0B" : "#EF4444", opacity: 0.7 }} />
                            </div>
                          ))}
                        </div>
                      )}
                      {i === 2 && (
                        <div className="flex items-end gap-[3px] h-full">
                          {[70, 85, 60, 90, 75, 80, 30].map((h, bi) => (
                            <div key={bi} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, backgroundColor: bi === 6 ? "#EF4444" : "#0D9488", opacity: 0.7 }} />
                          ))}
                        </div>
                      )}
                      {i === 3 && (
                        <div className="flex items-center justify-center gap-3 h-full">
                          {[0, 1, 2].map((d) => (
                            <div key={d} className="relative">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#7C3AED" }} />
                              {d < 2 && <div className="absolute top-1/2 left-full w-4 h-[2px] -translate-y-1/2" style={{ backgroundColor: "#C4B5FD" }} />}
                            </div>
                          ))}
                        </div>
                      )}
                      {i === 4 && (
                        <div className="flex flex-col gap-[4px] h-full justify-center">
                          {[100, 80, 60, 45].map((w, bi) => (
                            <div key={bi} className="h-2 rounded-full" style={{ width: `${w}%`, backgroundColor: ["#4F46E5", "#7C3AED", "#0D9488", "#2563EB"][bi], opacity: 0.6 }} />
                          ))}
                        </div>
                      )}
                      {i === 5 && (
                        <div className="flex items-center justify-center gap-2 h-full">
                          {[{ fill: "#D4A800", opacity: 1 }, { fill: "#2563EB", opacity: 0.4 }, { fill: "#10B981", opacity: 0.4 }].map((d, di) => (
                            <div key={di} className="relative">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill, opacity: d.opacity }} />
                              {di < 2 && <div className="absolute top-1/2 left-full w-3 h-[1px] -translate-y-1/2 bg-slate-300" />}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Badge */}
                      <span className="absolute top-1 right-1 text-[8px] font-semibold px-1 py-0.5 rounded bg-white/90 text-slate-500">{thumb.badge}</span>
                    </div>
                    <div className="p-1.5 text-center">
                      <p className="text-[10px] font-medium text-slate-600">{thumb.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview button */}
              <div className="flex justify-center mt-4">
                <button className="inline-flex items-center gap-2 px-5 py-2 rounded-md text-white text-xs font-bold" style={{ backgroundColor: "#7C3AED" }}>
                  <Play className="w-3 h-3" /> Open Interactive Preview
                </button>
              </div>
            </div>

            {/* Gold footer note */}
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "#FDF8E1", borderTop: "1px solid #F0DC82" }}>
              <span className="flex-shrink-0 text-sm">✦</span>
              <p className="text-xs leading-relaxed" style={{ color: "#92400E" }}>
                <span className="font-semibold">Programme Board decision only.</span> The interactive preview above shows what a live system could deliver. This is offered as an option for the board to consider if they feel it would add value — it is not a dependency, not currently budgeted, and the Excel workbook is fully sufficient to operate the NRES programme.
              </p>
            </div>
          </div>
        </div>

      </div>
      {/* ===== END SDA Rota / Buy-Back Service Management ===== */}


      <CollapsibleCard
        title="SDA Pilot Reporting Plan"
        icon={<BarChart3 className="w-5 h-5" />}
        defaultOpen={false}
        
      >
        <div className="space-y-6">
          {/* Document reference */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <FileText className="w-5 h-5 text-[#005EB8]" />
            <div>
              <h4 className="font-semibold text-slate-900">NRES SDA Pilot Reporting Plan</h4>
              <p className="text-sm text-slate-600">Version 1.4 | February 2026</p>
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
            Source: NRES_SDA_Pilot_Reporting_Plan.docx v1.4 | Last updated: February 2026
          </p>
        </div>
      </CollapsibleCard>

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
            <div className="mt-4 pt-3 border-t border-slate-200">
              <Button variant="outline" size="sm" asChild>
                <a href="/documents/NRES_Risk_Stratification_Overview.docx" download>
                  <Download className="h-4 w-4 mr-2" />
                  Download Full Document (Word)
                </a>
              </Button>
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
            <p className="text-sm text-slate-600 ml-7 mb-3">
              <span className="italic text-amber-600">Answer pending - to be confirmed with clinical leads</span>
            </p>
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
                <p className="text-sm text-slate-600 mt-1 mb-2">
                  <span className="italic text-amber-600">Answer pending - governance to be agreed</span>
                </p>
                <div className="bg-purple-50 rounded p-3 border border-purple-200">
                  <h6 className="font-semibold text-purple-900 mb-1 text-xs">Options for Board:</h6>
                  <ul className="text-xs text-slate-700 space-y-1">
                    <li><span className="font-semibold text-purple-700">A.</span> Seeing clinician completes acute episode; registered practice handles ongoing care</li>
                    <li><span className="font-semibold text-purple-700">B.</span> All follow-up returns to registered practice with clear handover protocol</li>
                    <li><span className="font-semibold text-purple-700">C.</span> Time-limited follow-up (e.g., 72hrs) with seeing clinician, then handover</li>
                    <li><span className="font-semibold text-purple-700">D.</span> Other: Alternative approach to be proposed by the Board</li>
                  </ul>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">Who orders pathology?</p>
                <p className="text-sm text-slate-600 mt-1 mb-2">
                  <span className="italic text-amber-600">Answer pending - governance to be agreed</span>
                </p>
                <div className="bg-purple-50 rounded p-3 border border-purple-200">
                  <h6 className="font-semibold text-purple-900 mb-1 text-xs">Options for Board:</h6>
                  <ul className="text-xs text-slate-700 space-y-1">
                    <li><span className="font-semibold text-purple-700">A.</span> Seeing clinician orders and actions results (requires cross-practice permissions)</li>
                    <li><span className="font-semibold text-purple-700">B.</span> Registered practice orders on behalf with shared task in clinical system</li>
                    <li><span className="font-semibold text-purple-700">C.</span> Seeing clinician orders; results route to registered practice for action</li>
                    <li><span className="font-semibold text-purple-700">D.</span> Other: Alternative approach to be proposed by the Board</li>
                  </ul>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">Who handles referrals?</p>
                <p className="text-sm text-slate-600 mt-1 mb-2">
                  <span className="italic text-amber-600">Answer pending - governance to be agreed</span>
                </p>
                <div className="bg-purple-50 rounded p-3 border border-purple-200">
                  <h6 className="font-semibold text-purple-900 mb-1 text-xs">Options for Board:</h6>
                  <ul className="text-xs text-slate-700 space-y-1">
                    <li><span className="font-semibold text-purple-700">A.</span> Seeing clinician makes referral using patient's registered practice code</li>
                    <li><span className="font-semibold text-purple-700">B.</span> Referral tasked to registered practice to process</li>
                    <li><span className="font-semibold text-purple-700">C.</span> Centralised referral hub processes all SDA-generated referrals</li>
                    <li><span className="font-semibold text-purple-700">D.</span> Other: Alternative approach to be proposed by the Board</li>
                  </ul>
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
  );
};
