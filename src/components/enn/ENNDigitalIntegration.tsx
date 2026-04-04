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
  const [tabExplorerOpen, setTabExplorerOpen] = useState(false);
  const [reportingPreviewOpen, setReportingPreviewOpen] = useState(false);
  const [baselineFullscreen, setBaselineFullscreen] = useState(false);
  const [hubFilter, setHubFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ENN Practice data — SIMULATED (15% below NRES observed rates)
  const ennPractices = [
    { ods: 'K83007', name: 'Harborough Field Surgery', short: 'Harborough Field', list: 13991, hub: 'harborough', isHub: true, simGP: 28842, simNurse: 19228, simOther: 16023, weeklyReq: 222, annualReq: 11604, winterWk: 253, nonWinterWk: 213 },
    { ods: 'K83023', name: 'Oundle Medical Practice', short: 'Oundle', list: 10600, hub: 'harborough', isHub: false, simGP: 21845, simNurse: 14563, simOther: 12136, weeklyReq: 169, annualReq: 8792, winterWk: 193, nonWinterWk: 161 },
    { ods: 'K83024', name: 'Rushden Medical Centre', short: 'Rushden MC', list: 9143, hub: 'harborough', isHub: false, simGP: 18843, simNurse: 12562, simOther: 10468, weeklyReq: 146, annualReq: 7583, winterWk: 166, nonWinterWk: 139 },
    { ods: 'K83028', name: 'Spinney Brook Medical Centre', short: 'Spinney Brook', list: 11537, hub: 'cottons', isHub: false, simGP: 23777, simNurse: 15851, simOther: 13209, weeklyReq: 184, annualReq: 9569, winterWk: 210, nonWinterWk: 175 },
    { ods: 'K83030', name: 'The Cottons Medical Centre', short: 'The Cottons', list: 9372, hub: 'cottons', isHub: true, simGP: 19315, simNurse: 12877, simOther: 10731, weeklyReq: 149, annualReq: 7773, winterWk: 171, nonWinterWk: 142 },
    { ods: 'K83044', name: 'Parklands Medical Centre', short: 'Parklands', list: 13612, hub: 'harborough', isHub: false, simGP: 28060, simNurse: 18707, simOther: 15589, weeklyReq: 217, annualReq: 11290, winterWk: 248, nonWinterWk: 207 },
    { ods: 'K83065', name: 'Nene Valley Surgery', short: 'Nene Valley', list: 6921, hub: 'harborough', isHub: false, simGP: 14266, simNurse: 9511, simOther: 7926, weeklyReq: 110, annualReq: 5740, winterWk: 126, nonWinterWk: 105 },
    { ods: 'K83069', name: 'Marshalls Road Surgery', short: 'Marshalls Rd', list: 3156, hub: 'cottons', isHub: false, simGP: 6505, simNurse: 4337, simOther: 3614, weeklyReq: 50, annualReq: 2618, winterWk: 57, nonWinterWk: 48 },
    { ods: 'K83080', name: 'Higham Ferrers Surgery', short: 'Higham Ferrers', list: 5569, hub: 'meadows', isHub: false, simGP: 11479, simNurse: 7653, simOther: 6377, weeklyReq: 89, annualReq: 4619, winterWk: 101, nonWinterWk: 85 },
    { ods: 'K83616', name: 'The Meadows Surgery', short: 'The Meadows', list: 6340, hub: 'meadows', isHub: true, simGP: 13068, simNurse: 8712, simOther: 7260, weeklyReq: 101, annualReq: 5258, winterWk: 115, nonWinterWk: 96 },
  ];

  const hubMeta: Record<string, { name: string; color: string; bg: string; border: string }> = {
    harborough: { name: 'Harborough Field Hub', color: '#005EB8', bg: 'bg-blue-50', border: 'border-blue-200' },
    cottons: { name: 'The Cottons Hub', color: '#00875A', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    meadows: { name: 'The Meadows Hub', color: '#D4531E', bg: 'bg-orange-50', border: 'border-orange-200' },
  };

  const filteredPractices = ennPractices
    .filter(p => hubFilter === 'all' || p.hub === hubFilter)
    .sort((a, b) => {
      let va: any, vb: any;
      switch (sortField) {
        case 'list': va = a.list; vb = b.list; break;
        case 'total': va = a.simGP + a.simNurse + a.simOther; vb = b.simGP + b.simNurse + b.simOther; break;
        case 'weekly': va = a.weeklyReq; vb = b.weeklyReq; break;
        default: va = a.name; vb = b.name;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totals = filteredPractices.reduce((acc, p) => ({
    list: acc.list + p.list,
    gp: acc.gp + p.simGP,
    nurse: acc.nurse + p.simNurse,
    other: acc.other + p.simOther,
    weeklyReq: acc.weeklyReq + p.weeklyReq,
    annualReq: acc.annualReq + p.annualReq,
    winterWk: acc.winterWk + p.winterWk,
    nonWinterWk: acc.nonWinterWk + p.nonWinterWk,
  }), { list: 0, gp: 0, nurse: 0, other: 0, weeklyReq: 0, annualReq: 0, winterWk: 0, nonWinterWk: 0 });

  const handleBaselineSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

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

      {/* SIMULATED DATA BANNER */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-4">
        <div className="bg-amber-400 rounded-lg p-2 mt-0.5">
          <AlertTriangle className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-amber-900">SIMULATED DATA — East Northants Neighbourhood (ENN)</h3>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">4 April 2026</span>
          </div>
          <p className="text-sm text-amber-800 mt-1">
            All appointment figures on this page are <strong>simulated estimates</strong> based on practice list sizes, modelled at approximately 15% below NRES observed rates. 
            These numbers will be replaced with actual GPAD appointment data once raw exports are received from each ENN practice.
          </p>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-amber-700">
            <span>📊 <strong>10 practices</strong> · 3 hubs</span>
            <span>👥 <strong>90,241</strong> registered patients</span>
            <span>💷 <strong>£2.38M</strong> annual budget</span>
            <span>🏥 <strong>3Sixty Care Partnership</strong> (SNO)</span>
          </div>
        </div>
      </div>

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
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      ⏳ Simulated Data
                    </span>
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Practice-level GPAD data · 10 practices · 3 hubs · 90,241 patients · Awaiting raw GPAD exports
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

          {/* Description */}
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 leading-relaxed">
            <strong>⚠️ Simulated baseline data</strong> for the ENN neighbourhood. Once GPAD exports are received from each of the 10 practices, 
            this dashboard will be populated with actual appointment data. Filters will include individual practice, 
            hub grouping (Harborough Field / The Cottons / The Meadows), workforce role, and time period. 
            Prepared for 3Sixty Care Partnership programme requirements.
          </div>

          {/* Inline Baseline Dashboard */}
          <div className="p-5 space-y-4">
            {/* Hub Filter Bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">View:</span>
              {[
                { value: 'all', label: 'All ENN Practices', count: 10 },
                { value: 'harborough', label: '🔵 Harborough Field Hub', count: 5 },
                { value: 'cottons', label: '🟢 The Cottons Hub', count: 3 },
                { value: 'meadows', label: '🟠 The Meadows Hub', count: 2 },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setHubFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    hubFilter === opt.value
                      ? 'bg-[#005EB8] text-white border-[#005EB8] shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label} ({opt.count})
                </button>
              ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: 'Practices', value: filteredPractices.length.toString(), color: '#005EB8' },
                { label: 'Patients', value: totals.list.toLocaleString(), color: '#005EB8' },
                { label: 'Sim. GP Appts', value: totals.gp.toLocaleString(), color: '#7C3AED' },
                { label: 'Sim. Nurse Appts', value: totals.nurse.toLocaleString(), color: '#0D9488' },
                { label: 'Sim. Other Appts', value: totals.other.toLocaleString(), color: '#6B7280' },
                { label: 'Sim. Total (48wk)', value: (totals.gp + totals.nurse + totals.other).toLocaleString(), color: '#D97706' },
              ].map((card, i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200 p-3 text-center" style={{ borderTop: `3px solid ${card.color}` }}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{card.label}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* SDA Requirements Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
                <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Weekly Required</p>
                <p className="text-xl font-bold text-blue-700 mt-1">{totals.weeklyReq.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
                <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-semibold">Non-Winter /wk</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{totals.nonWinterWk.toLocaleString()}</p>
              </div>
              <div className="bg-orange-50 rounded-lg border border-orange-200 p-3 text-center">
                <p className="text-[10px] text-orange-500 uppercase tracking-wider font-semibold">Winter /wk</p>
                <p className="text-xl font-bold text-orange-700 mt-1">{totals.winterWk.toLocaleString()}</p>
              </div>
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 text-center">
                <p className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold">Annual Required</p>
                <p className="text-xl font-bold text-amber-700 mt-1">{totals.annualReq.toLocaleString()}</p>
              </div>
            </div>

            {/* Practice Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    {[
                      { key: 'name', label: 'Practice' },
                      { key: 'hub', label: 'Hub' },
                      { key: 'list', label: 'List Size' },
                      { key: 'total', label: 'Sim. Total (48wk)' },
                      { key: 'gp', label: 'GP' },
                      { key: 'nurse', label: 'Nurse' },
                      { key: 'other', label: 'Other' },
                      { key: 'weekly', label: 'Weekly Req' },
                      { key: 'nonwinter', label: 'Non-Win /wk' },
                      { key: 'winter', label: 'Winter /wk' },
                    ].map(col => (
                      <th
                        key={col.key}
                        className="p-2.5 font-semibold text-slate-600 text-xs cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                        onClick={() => handleBaselineSort(col.key)}
                      >
                        {col.label} {sortField === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPractices.map((p, i) => {
                    const hm = hubMeta[p.hub];
                    return (
                      <tr key={p.ods} className={`border-t border-slate-100 ${p.isHub ? hm.bg : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-2.5 font-medium text-slate-800 whitespace-nowrap">
                          {p.isHub && <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: hm.color }} />}
                          {p.short}
                          {p.isHub && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: hm.color }}>HUB</span>}
                        </td>
                        <td className="p-2.5 text-xs" style={{ color: hm.color }}>{hm.name.replace(' Hub', '')}</td>
                        <td className="p-2.5 text-right font-medium">{p.list.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-bold text-amber-700">{(p.simGP + p.simNurse + p.simOther).toLocaleString()}</td>
                        <td className="p-2.5 text-right text-purple-600">{p.simGP.toLocaleString()}</td>
                        <td className="p-2.5 text-right text-teal-600">{p.simNurse.toLocaleString()}</td>
                        <td className="p-2.5 text-right text-slate-500">{p.simOther.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-semibold text-blue-700">{p.weeklyReq}</td>
                        <td className="p-2.5 text-right text-emerald-600">{p.nonWinterWk}</td>
                        <td className="p-2.5 text-right text-orange-600">{p.winterWk}</td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <td className="p-2.5 text-slate-800">{hubFilter === 'all' ? 'ENN TOTAL' : hubMeta[hubFilter]?.name + ' Total'}</td>
                    <td className="p-2.5"></td>
                    <td className="p-2.5 text-right">{totals.list.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-amber-700">{(totals.gp + totals.nurse + totals.other).toLocaleString()}</td>
                    <td className="p-2.5 text-right text-purple-600">{totals.gp.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-teal-600">{totals.nurse.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-slate-500">{totals.other.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-blue-700">{totals.weeklyReq}</td>
                    <td className="p-2.5 text-right text-emerald-600">{totals.nonWinterWk}</td>
                    <td className="p-2.5 text-right text-orange-600">{totals.winterWk}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-[10px] text-slate-400 italic text-center">
              ⚠️ Simulated appointment data · Based on list sizes at ~15% below NRES observed rates (5.32 appts/patient/48wk) · Role split: 45% GP / 30% Nurse / 25% Other · 4 April 2026
            </div>
          </div>

          {/* Card Footer */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Data source: Simulated from list sizes · Harborough Field · Oundle · Rushden MC · Spinney Brook · The Cottons · Parklands · Nene Valley · Marshalls Rd · Higham Ferrers · The Meadows</span>
            <span>Simulated: 4 April 2026 · Awaiting raw GPAD data</span>
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
              <h4 className="font-semibold text-slate-900">ENN SDA Reporting Requirements from Specification — Overview & Planning</h4>
              <p className="text-sm text-slate-600">Version 1.7.1 | March 2026</p>
            </div>
            <Button variant="outline" size="sm" asChild className="flex-shrink-0">
              <a href="/documents/ENN_SDA_Reporting_Plan_v1_0.docx" download>
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
                  10 GP practices — including monthly, quarterly, and annual reporting cycles. Identifies high-workload reports 
                  and estimates approximately 52 central hours/month and 4–6 practice hours/month once established.
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">Central: ~52 hrs/mth BAU</span>
                  <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">Per Practice: 4–6 hrs/mth</span>
                  <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-medium">Setup: 80–100 hrs/practice</span>
                  <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium">4 High-Workload Reports</span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/documents/ENN_Reporting_Resource_Analysis_v1_0.docx" download>
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
