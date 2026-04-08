import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from "@/components/ui/popover";
import { CheckCircle2, Building2, Clock, Users, Calendar, LayoutGrid, CalendarRange, ArrowUpDown, ArrowUp, ArrowDown, Sun, Snowflake, Layers, Info, Settings, Car, Bus, MapPin } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { ENNNeighbourhoodMap } from "@/components/enn/ENNNeighbourhoodMap";

const APPTS_PER_SESSION = 14;

/** Travel data for each practice to its nearest hub */
type TravelInfo = {
  miles?: number;
  carMin?: number;
  publicTransportMin?: number;
  busService?: string;
};

const PRACTICE_TRAVEL: Record<string, TravelInfo> = {
  'Harborough Field Surgery': { miles: 0 },
  'Parklands Surgery': { miles: 1.1, carMin: 4, publicTransportMin: 8, busService: '25' },
  'Rushden Medical Centre': { miles: 1.1, carMin: 5, publicTransportMin: 5, busService: 'X46' },
  'Higham Ferrers Surgery': { miles: 2.4, carMin: 5, publicTransportMin: 10, busService: '94' },
  'The Cottons MC': { miles: 0 },
  'Spinney Brook MC': { miles: 5.2, carMin: 11, publicTransportMin: 35, busService: 'X47' },
  'Marshalls Road Surgery': { miles: 0.4, carMin: 2, publicTransportMin: 5, busService: 'X47' },
  'The Meadows Surgery': { miles: 0 },
  'Oundle Medical Practice': { miles: 8, carMin: 13, publicTransportMin: 34, busService: '94 or DTRS' },
  'Nene Valley Surgery': { carMin: 0, publicTransportMin: 0, busService: '16' },
};

/** Travel data from each practice to Corby Urgent Care Centre */
const CUCC_TRAVEL: Record<string, { miles: number; carMin: number; publicTransport: string; busService: string }> = {
  'Harborough Field Surgery': { miles: 21.3, carMin: 34, publicTransport: '2h 8m', busService: 'X46/EMR/X4/1' },
  'Spinney Brook MC': { miles: 17.8, carMin: 30, publicTransport: '1h 28m', busService: '48/EMR/X4' },
  'The Cottons MC': { miles: 23, carMin: 33, publicTransport: '1h 43m', busService: '16/X4/1' },
  'Parklands Surgery': { miles: 22.3, carMin: 38, publicTransport: '1h 55m', busService: '46/X4' },
  'Nene Valley Surgery': { miles: 19.4, carMin: 29, publicTransport: '1h 23m', busService: 'X16/X4/DTRS' },
  'Marshalls Road Surgery': { miles: 23.4, carMin: 33, publicTransport: '2h 5m', busService: '16/X4/1' },
  'Higham Ferrers Surgery': { miles: 19.6, carMin: 11, publicTransport: '2h 12m', busService: '50/X4' },
  'The Meadows Surgery': { miles: 19.3, carMin: 29, publicTransport: '1h 23m', busService: 'X16/DTRS/X4' },
  'Oundle Medical Practice': { miles: 12.9, carMin: 26, publicTransport: '0h 56m', busService: 'X4' },
  'Rushden Medical Centre': { miles: 21.9, carMin: 37, publicTransport: '1h 30m', busService: 'X47/X4' },
};

type PracticeSortField = "practice" | "listSize" | "percentage" | "sessionsWeek" | "f2f" | "remote" | "annualAppts" | "weeklyAppts" | "winterAppts" | "nonWinterAppts" | "weeklyWinter" | "weeklyNonWinter" | "annualIncome" | "hub";
type SortDirection = "asc" | "desc";
type Season = "nonWinter" | "winter" | "total";
type SitesDisplayMode = "total" | "hub" | "spoke";
type SessionsDisplayMode = "total" | "winter" | "nonWinter" | "onsite" | "remote";
type DurationDisplayMode = "perSession" | "perDay" | "perWeek";
type ApptsDisplayMode = "perSession" | "perHour" | "perDay";
type ViewLevel = "practice" | "hub";

interface ENNPracticeSummary {
  practice: string;
  odsCode: string;
  listSize: number;
  annualAppts: number;
  weeklyAppts: number;
  winterAppts: number;
  nonWinterAppts: number;
  weeklyWinter: number;
  weeklyNonWinter: number;
  annualIncome: number;
  role: "HUB" | "SPOKE";
  hub: string;
  system: string;
  systemNote?: string;
  branchSite?: string;
}

const ennPracticeSummary: ENNPracticeSummary[] = [
  { practice: "Harborough Field Surgery", odsCode: "K83007", listSize: 13991, annualAppts: 11604, weeklyAppts: 222, winterAppts: 3310, nonWinterAppts: 8294, weeklyWinter: 255, weeklyNonWinter: 213, annualIncome: 366383.03, role: "HUB", hub: "Harborough Field Surgery", system: "EMIS" },
  { practice: "Oundle Medical Practice", odsCode: "K83023", listSize: 10600, annualAppts: 8792, weeklyAppts: 169, winterAppts: 2509, nonWinterAppts: 6284, weeklyWinter: 193, weeklyNonWinter: 161, annualIncome: 279098.00, role: "SPOKE", hub: "The Meadows Surgery", system: "SystmOne" },
  { practice: "Rushden Medical Centre", odsCode: "K83024", listSize: 9143, annualAppts: 7583, weeklyAppts: 146, winterAppts: 2163, nonWinterAppts: 5420, weeklyWinter: 166, weeklyNonWinter: 139, annualIncome: 240735.19, role: "SPOKE", hub: "Harborough Field Surgery", system: "SystmOne" },
  { practice: "Spinney Brook MC", odsCode: "K83028", listSize: 11537, annualAppts: 9569, weeklyAppts: 184, winterAppts: 2730, nonWinterAppts: 6839, weeklyWinter: 210, weeklyNonWinter: 175, annualIncome: 303769.21, role: "SPOKE", hub: "The Cottons MC", system: "EMIS", systemNote: "Due to switch to S1 in September", branchSite: "Branch: Woodford Surgery, 13 Thrapston Rd, Kettering NN14 4HY" },
  { practice: "The Cottons MC", odsCode: "K83030", listSize: 9372, annualAppts: 7773, weeklyAppts: 149, winterAppts: 2217, nonWinterAppts: 5556, weeklyWinter: 171, weeklyNonWinter: 142, annualIncome: 246764.76, role: "HUB", hub: "The Cottons MC", system: "SystmOne" },
  { practice: "Parklands Surgery", odsCode: "K83044", listSize: 13612, annualAppts: 11290, weeklyAppts: 217, winterAppts: 3221, nonWinterAppts: 8069, weeklyWinter: 248, weeklyNonWinter: 207, annualIncome: 358403.96, role: "SPOKE", hub: "Harborough Field Surgery", system: "EMIS" },
  { practice: "Nene Valley Surgery", odsCode: "K83065", listSize: 6921, annualAppts: 5740, weeklyAppts: 110, winterAppts: 1638, nonWinterAppts: 4103, weeklyWinter: 126, weeklyNonWinter: 105, annualIncome: 182229.93, role: "SPOKE", hub: "The Meadows Surgery", system: "EMIS", systemNote: "Due to switch to S1 in May" },
  { practice: "Marshalls Road Surgery", odsCode: "K83069", listSize: 3156, annualAppts: 2618, weeklyAppts: 50, winterAppts: 747, nonWinterAppts: 1871, weeklyWinter: 57, weeklyNonWinter: 48, annualIncome: 83097.48, role: "SPOKE", hub: "The Cottons MC", system: "SystmOne" },
  { practice: "Higham Ferrers Surgery", odsCode: "K83080", listSize: 5569, annualAppts: 4619, weeklyAppts: 89, winterAppts: 1318, nonWinterAppts: 3301, weeklyWinter: 101, weeklyNonWinter: 85, annualIncome: 146631.77, role: "SPOKE", hub: "Harborough Field Surgery", system: "EMIS" },
  { practice: "The Meadows Surgery", odsCode: "K83616", listSize: 6340, annualAppts: 5258, weeklyAppts: 101, winterAppts: 1500, nonWinterAppts: 3758, weeklyWinter: 115, weeklyNonWinter: 96, annualIncome: 166932.20, role: "HUB", hub: "The Meadows Surgery", system: "SystmOne" },
];

const hubPracticeMapping: Record<string, string[]> = {
  "Harborough Field Surgery": ["Harborough Field Surgery", "Parklands Surgery", "Rushden Medical Centre", "Higham Ferrers Surgery"],
  "The Cottons MC": ["The Cottons MC", "Spinney Brook MC", "Marshalls Road Surgery"],
  "The Meadows Surgery": ["The Meadows Surgery", "Oundle Medical Practice", "Nene Valley Surgery"],
};

const totalListSize = ennPracticeSummary.reduce((sum, p) => sum + p.listSize, 0);
const ANNUAL_APPTS = 74846;

const LS_KEY = 'enn-estates-settings';

function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function persistSettings(patch: Record<string, unknown>) {
  try {
    const existing = loadPersistedSettings();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, ...patch }));
  } catch { /* ignore */ }
}

export const ENNEstatesCapacity = () => {
  const saved = useMemo(() => loadPersistedSettings(), []);

  const [season, setSeason] = useState<Season>("total");
  const [viewMode, setViewMode] = useState<"sessions" | "appointments">("appointments");
  const [viewLevel, setViewLevel] = useState<ViewLevel>("hub");
  const [practiceSortField, setPracticeSortField] = useState<PracticeSortField>("listSize");
  const [practiceSortDirection, setPracticeSortDirection] = useState<SortDirection>("desc");
  const [sitesDisplayMode, setSitesDisplayMode] = useState<SitesDisplayMode>("total");
  const [sessionsDisplayMode, setSessionsDisplayMode] = useState<SessionsDisplayMode>("total");
  const [durationDisplayMode, setDurationDisplayMode] = useState<DurationDisplayMode>("perSession");
  const [apptsDisplayMode, setApptsDisplayMode] = useState<ApptsDisplayMode>("perSession");

  const [onsitePct, setOnsitePct] = useState(saved.onsitePct ?? 50);
  const remotePct = 100 - onsitePct;
  const [gpPct, setGpPct] = useState(saved.gpPct ?? 50);

  const hubNames = Object.keys(hubPracticeMapping);
  const [hubOnsitePcts, setHubOnsitePcts] = useState<Record<string, number>>(
    () => saved.hubOnsitePcts ?? Object.fromEntries(hubNames.map(h => [h, 50]))
  );
  const setHubOnsitePct = (hubName: string, val: number) => {
    setHubOnsitePcts(prev => {
      const next = { ...prev, [hubName]: val };
      persistSettings({ hubOnsitePcts: next });
      return next;
    });
  };
  const [hubGpPcts, setHubGpPcts] = useState<Record<string, number>>(
    () => saved.hubGpPcts ?? Object.fromEntries(hubNames.map(h => [h, 50]))
  );
  const setHubGpPct = (hubName: string, val: number) => {
    setHubGpPcts(prev => {
      const next = { ...prev, [hubName]: val };
      persistSettings({ hubGpPcts: next });
      return next;
    });
  };

  // Cost settings — persisted
  const [gpRate, setGpRate] = useState<number>(saved.gpRate ?? 11000);
  const [anpRate, setAnpRate] = useState<number>(saved.anpRate ?? 60000);
  const [onCostsPct, setOnCostsPct] = useState<number>(saved.onCostsPct ?? 30);
  

  const updateGpPct = (val: number) => { setGpPct(val); persistSettings({ gpPct: val }); };
  const updateOnsitePct = (val: number) => { setOnsitePct(val); persistSettings({ onsitePct: val }); };
  const updateGpRate = (val: number) => { setGpRate(val); persistSettings({ gpRate: val }); };
  const updateAnpRate = (val: number) => { setAnpRate(val); persistSettings({ anpRate: val }); };
  const updateOnCostsPct = (val: number) => { setOnCostsPct(val); persistSettings({ onCostsPct: val }); };

  const HOURS_PER_SESSION = 4.1667;
  const HOURS_PER_WTE = 37.5;
  const calcWTE = (sessions: number) => (sessions * HOURS_PER_SESSION) / HOURS_PER_WTE;

  const onCostsMultiplier = 1 + onCostsPct / 100;
  const GP_COST_PER_SESSION = gpRate * onCostsMultiplier;
  const ANP_COST_PER_WTE = anpRate * onCostsMultiplier;
  const calcGpCost = (sessions: number) => sessions * GP_COST_PER_SESSION;
  const calcAnpCost = (wte: number) => wte * ANP_COST_PER_WTE;
  const formatCost = (cost: number) => cost >= 1000000 ? `£${(cost / 1000000).toFixed(2)}M` : `£${(cost / 1000).toFixed(0)}K`;
  const costLabel = `GP £${(gpRate/1000).toFixed(0)}K/sess + ${onCostsPct}% on-costs · ANP £${(anpRate/1000).toFixed(0)}K/WTE + ${onCostsPct}% on-costs · excl. overhead & innovation`;

  type ColumnGroup = "listIncome" | "winter" | "nonWinter";
  const [expandedGroups, setExpandedGroups] = useState<Set<ColumnGroup>>(new Set());

  const toggleGroup = (group: ColumnGroup) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const multiplier = viewMode === "appointments" ? APPTS_PER_SESSION : 1;
  const unitLabel = viewMode === "appointments" ? "appointments" : "sessions";

  const capacityData = useMemo(() => ({
    nonWinter: {
      rate: "15.2 per 1,000",
      weeks: 39,
      apptsPerWeek: 1371,
      sessionsPerWeek: Math.round(1371 / APPTS_PER_SESSION * 10) / 10,
      sessionLength: "4h 10m",
      f2fRequired: Math.round(1371 / APPTS_PER_SESSION * 10) / 10 * (onsitePct / 100),
      remoteRequired: Math.round(1371 / APPTS_PER_SESSION * 10) / 10 * (remotePct / 100),
    },
    winter: {
      rate: "18.2 per 1,000",
      weeks: 13,
      apptsPerWeek: 1642,
      sessionsPerWeek: Math.round(1642 / APPTS_PER_SESSION * 10) / 10,
      sessionLength: "4h 10m",
      f2fRequired: Math.round(1642 / APPTS_PER_SESSION * 10) / 10 * (onsitePct / 100),
      remoteRequired: Math.round(1642 / APPTS_PER_SESSION * 10) / 10 * (remotePct / 100),
    },
  }), [onsitePct, remotePct]);

  const totalCapacity = useMemo(() => ({
    rate: "15.2–18.2 per 1,000",
    weeks: 52,
    annualAppts: ANNUAL_APPTS,
    apptsPerWeek: Math.round(ANNUAL_APPTS / 52),
    sessionsPerWeek: Math.round(ANNUAL_APPTS / 52 / APPTS_PER_SESSION * 10) / 10,
    sessionLength: "4h 10m",
    f2fRequired: Math.round(ANNUAL_APPTS / 52 / APPTS_PER_SESSION * (onsitePct / 100) * 10) / 10,
    remoteRequired: Math.round(ANNUAL_APPTS / 52 / APPTS_PER_SESSION * (remotePct / 100) * 10) / 10,
  }), [onsitePct, remotePct]);

  const currentCapacity = season === "winter"
    ? capacityData.winter
    : season === "total"
      ? totalCapacity
      : capacityData.nonWinter;

  const togglePracticeSort = (field: PracticeSortField) => {
    if (practiceSortField === field) {
      setPracticeSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setPracticeSortField(field);
      setPracticeSortDirection("desc");
    }
  };

  const getSortIcon = (field: PracticeSortField) => {
    if (practiceSortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return practiceSortDirection === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const sortedPracticeSummary = useMemo(() => {
    const withCalc = ennPracticeSummary.map(p => {
      const percentage = (p.listSize / totalListSize) * 100;
      const sessionsNeeded = currentCapacity.sessionsPerWeek * (p.listSize / totalListSize);
      const displayValue = viewMode === "appointments" ? sessionsNeeded * APPTS_PER_SESSION : sessionsNeeded;
      return {
        ...p,
        percentage,
        sessionsWeek: displayValue,
        f2f: displayValue * (onsitePct / 100),
        remote: displayValue * (remotePct / 100),
      };
    });

    return [...withCalc].sort((a, b) => {
      let aVal: number | string, bVal: number | string;
      switch (practiceSortField) {
        case "practice": aVal = a.practice.toLowerCase(); bVal = b.practice.toLowerCase(); break;
        case "hub": aVal = a.hub.toLowerCase(); bVal = b.hub.toLowerCase(); break;
        case "listSize": aVal = a.listSize; bVal = b.listSize; break;
        case "percentage": aVal = a.percentage; bVal = b.percentage; break;
        case "sessionsWeek": aVal = a.sessionsWeek; bVal = b.sessionsWeek; break;
        case "f2f": aVal = a.f2f; bVal = b.f2f; break;
        case "remote": aVal = a.remote; bVal = b.remote; break;
        case "annualAppts": aVal = a.annualAppts; bVal = b.annualAppts; break;
        case "weeklyAppts": aVal = a.weeklyAppts; bVal = b.weeklyAppts; break;
        case "winterAppts": aVal = a.winterAppts; bVal = b.winterAppts; break;
        case "nonWinterAppts": aVal = a.nonWinterAppts; bVal = b.nonWinterAppts; break;
        case "weeklyWinter": aVal = a.weeklyWinter; bVal = b.weeklyWinter; break;
        case "weeklyNonWinter": aVal = a.weeklyNonWinter; bVal = b.weeklyNonWinter; break;
        case "annualIncome": aVal = a.annualIncome; bVal = b.annualIncome; break;
        default: return 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return practiceSortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return practiceSortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [practiceSortField, practiceSortDirection, currentCapacity.sessionsPerWeek, viewMode, onsitePct, remotePct]);

  // Hub aggregation data
  const hubAggregatedData = useMemo(() => {
    return Object.entries(hubPracticeMapping).map(([hubName, practiceNames]) => {
      const practices = ennPracticeSummary
        .filter(p => practiceNames.includes(p.practice))
        .sort((a, b) => {
          if (a.role === "HUB" && b.role !== "HUB") return -1;
          if (a.role !== "HUB" && b.role === "HUB") return 1;
          return b.listSize - a.listSize;
        });
      const hubListSize = practices.reduce((sum, p) => sum + p.listSize, 0);
      const percentage = (hubListSize / totalListSize) * 100;
      const sessionsNeeded = currentCapacity.sessionsPerWeek * (hubListSize / totalListSize);
      const displayValue = viewMode === "appointments" ? sessionsNeeded * APPTS_PER_SESSION : sessionsNeeded;
      const hubOnsite = hubOnsitePcts[hubName] ?? onsitePct;
      const hubRemote = 100 - hubOnsite;
      const hubGp = hubGpPcts[hubName] ?? gpPct;
      return {
        hubName,
        practices,
        listSize: hubListSize,
        percentage,
        totalRequired: displayValue,
        f2f: displayValue * (hubOnsite / 100),
        remote: displayValue * (hubRemote / 100),
        onsitePct: hubOnsite,
        gpPct: hubGp,
      };
    });
  }, [currentCapacity.sessionsPerWeek, viewMode, onsitePct, hubOnsitePcts, gpPct, hubGpPcts]);

  const cycleSitesMode = () => {
    const modes: SitesDisplayMode[] = ["total", "hub", "spoke"];
    setSitesDisplayMode(modes[(modes.indexOf(sitesDisplayMode) + 1) % modes.length]);
  };
  const cycleSessionsMode = () => {
    const modes: SessionsDisplayMode[] = ["total", "winter", "nonWinter", "onsite", "remote"];
    setSessionsDisplayMode(modes[(modes.indexOf(sessionsDisplayMode) + 1) % modes.length]);
  };
  const cycleDurationMode = () => {
    const modes: DurationDisplayMode[] = ["perSession", "perDay", "perWeek"];
    setDurationDisplayMode(modes[(modes.indexOf(durationDisplayMode) + 1) % modes.length]);
  };
  const cycleApptsMode = () => {
    const modes: ApptsDisplayMode[] = ["perSession", "perHour", "perDay"];
    setApptsDisplayMode(modes[(modes.indexOf(apptsDisplayMode) + 1) % modes.length]);
  };

  const getSitesDisplay = () => {
    const hubCount = ennPracticeSummary.filter(p => p.role === "HUB").length;
    const spokeCount = ennPracticeSummary.filter(p => p.role === "SPOKE").length;
    switch (sitesDisplayMode) {
      case "hub": return { value: hubCount, label: "Hub Sites" };
      case "spoke": return { value: spokeCount, label: "Spoke Sites" };
      default: return { value: 10, label: "Practice Sites" };
    }
  };

  const getSessionsDisplay = () => {
    const onsiteSessions = Math.round(currentCapacity.f2fRequired);
    const remoteSessions = Math.round(currentCapacity.remoteRequired);
    const totalSessions = Math.round(currentCapacity.sessionsPerWeek);
    switch (sessionsDisplayMode) {
      case "winter": return { value: `${Math.round(capacityData.winter.f2fRequired)} + ${Math.round(capacityData.winter.remoteRequired)}`, label: "On-Site + Remote/Week", sublabel: `(${Math.round(capacityData.winter.sessionsPerWeek)} Total - Winter)` };
      case "nonWinter": return { value: `${onsiteSessions} + ${remoteSessions}`, label: "On-Site + Remote/Week", sublabel: `(${totalSessions} Total - Non-Winter)` };
      case "onsite": return { value: Math.round(currentCapacity.f2fRequired), label: "On-Site/Week" };
      case "remote": return { value: Math.round(currentCapacity.remoteRequired), label: "Remote/Week" };
      default: return { value: totalSessions, label: "Total Sessions/Week" };
    }
  };

  const getDurationDisplay = () => {
    switch (durationDisplayMode) {
      case "perDay": return { value: "8h 20m", label: "Per Day (2 sessions)" };
      case "perWeek": return { value: "41h 40m", label: "Per Week (10 sessions)" };
      default: return { value: "4h 10m", label: "Per Session" };
    }
  };

  const getApptsDisplay = () => {
    switch (apptsDisplayMode) {
      case "perHour": return { value: "3.4", label: "Appts/Hour" };
      case "perDay": return { value: "28", label: "Appts/Day" };
      default: return { value: String(APPTS_PER_SESSION), label: "Appts/Session" };
    }
  };

  const sitesDisplay = getSitesDisplay();
  const sessionsDisplay = getSessionsDisplay();
  const durationDisplay = getDurationDisplay();
  const apptsDisplay = getApptsDisplay();
  const uLabel = viewMode === "appointments" ? "appts/week" : "sessions/week";

  return (
    <div className="space-y-6">
      {/* Practice Estates, Capacity & Workforce Status */}
      <CollapsibleCard
        title="Practice Estates, Capacity & Workforce Status"
        icon={<Building2 className="w-5 h-5" />}
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              10 Practices • {totalListSize.toLocaleString()} Patients
            </Badge>
          </div>
        }
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm text-slate-500">Weekly session requirements by practice</p>
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Level Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => setViewLevel("practice")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${viewLevel === "practice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <LayoutGrid className="w-3 h-3" /> By Practice
              </button>
              <button onClick={() => setViewLevel("hub")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${viewLevel === "hub" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <Layers className="w-3 h-3" /> By Hub
              </button>
            </div>
            {/* Season Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => setSeason("nonWinter")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${season === "nonWinter" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <Sun className="w-3 h-3" /> Non-Winter
              </button>
              <button onClick={() => setSeason("winter")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${season === "winter" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <Snowflake className="w-3 h-3" /> Winter
              </button>
              <button onClick={() => setSeason("total")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${season === "total" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <CalendarRange className="w-3 h-3" /> Combined
              </button>
            </div>
            {/* Sessions/Appointments Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => setViewMode("sessions")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === "sessions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>Sessions</button>
              <button onClick={() => setViewMode("appointments")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === "appointments" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>Appointments</button>
            </div>
          </div>
        </div>



        {viewLevel === "practice" ? (
          /* Practice cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ennPracticeSummary.map((practice, index) => {
              const totalRequired = currentCapacity.sessionsPerWeek * (practice.listSize / totalListSize);
              const f2fRequired = totalRequired * (onsitePct / 100);
              const remoteRequired = totalRequired * (remotePct / 100);
              const mul = viewMode === "appointments" ? APPTS_PER_SESSION : 1;

              return (
                <div
                  key={index}
                  className={`rounded-xl p-4 border transition-all hover:shadow-md ${practice.role === "HUB" ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">{practice.practice}</h4>
                      {practice.branchSite && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{practice.branchSite}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={practice.role === "HUB" ? "bg-[#005EB8] text-white border-[#005EB8]" : "bg-slate-200 text-slate-700 border-slate-300"}>
                      {practice.role}
                    </Badge>
                  </div>

                  <div className="mb-3 pb-2 border-b border-slate-200">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Required</p>
                    <p className="text-2xl font-bold text-slate-900">{(totalRequired * mul).toFixed(1)}</p>
                    <p className="text-xs text-slate-500">{uLabel}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
                      <p className="text-xs font-medium text-green-700">F2F (On-Site)</p>
                      <p className="text-lg font-bold text-green-900">{(f2fRequired * mul).toFixed(1)}</p>
                      <p className="text-[10px] text-green-600">{uLabel}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2 text-center border border-indigo-200">
                      <p className="text-xs font-medium text-indigo-700">Remote</p>
                      <p className="text-lg font-bold text-indigo-900">{(remoteRequired * mul).toFixed(1)}</p>
                      <p className="text-[10px] text-indigo-600">{uLabel}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 text-center mt-1.5">
                    {(f2fRequired).toFixed(1)} sessions on-site • {(remoteRequired).toFixed(1)} sessions remote
                  </p>

                  {/* GP / ANP-ACP Workforce Breakdown */}
                  {(() => {
                    const gpSessions = totalRequired * (gpPct / 100);
                    const anpSessions = totalRequired * ((100 - gpPct) / 100);
                    const gpWTE = calcWTE(gpSessions);
                    const anpWTE = calcWTE(anpSessions);
                    const gpCost = calcGpCost(gpSessions);
                    const anpCost = calcAnpCost(anpWTE);
                    const totalCost = gpCost + anpCost;
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
                            <p className="text-[10px] font-medium text-blue-700">GP</p>
                            <p className="text-sm font-bold text-blue-900">{gpSessions.toFixed(1)} sess</p>
                            <p className="text-[10px] font-semibold text-blue-800">{gpWTE.toFixed(2)} WTE</p>
                            <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{formatCost(gpCost)}/yr</p>
                          </div>
                          <div className="bg-cyan-50 rounded-lg p-2 text-center border border-cyan-200">
                            <p className="text-[10px] font-medium text-cyan-700">ANP/ACP</p>
                            <p className="text-sm font-bold text-cyan-900">{anpSessions.toFixed(1)} sess</p>
                            <p className="text-[10px] font-semibold text-cyan-800">{anpWTE.toFixed(2)} WTE</p>
                            <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{formatCost(anpCost)}/yr</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-center font-semibold text-emerald-800 mt-1">Est. workforce cost: {formatCost(totalCost)}/yr</p>
                      </>
                    );
                  })()}

                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Recruitment</p>
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-200">
                      <div className="bg-slate-300 w-full" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Not yet populated</p>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">{practice.system}</Badge>
                      {practice.systemNote && (
                        <span className="text-[10px] text-amber-600 font-medium">{practice.systemNote}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Neighbourhood Totals Box */}
            <div className="rounded-xl p-4 border bg-gradient-to-br from-slate-100 to-blue-50 border-blue-300">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-slate-900">Neighbourhood Total</h4>
                  <p className="text-xs text-slate-500 mt-0.5">All practices combined</p>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">TOTAL</Badge>
              </div>
              <div className="mb-3 pb-2 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Required</p>
                <p className="text-2xl font-bold text-slate-900">
                  {(currentCapacity.sessionsPerWeek * multiplier).toFixed(1)}
                </p>
                <p className="text-xs text-slate-500">{uLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
                  <p className="text-xs font-medium text-green-700">F2F (On-Site)</p>
                  <p className="text-lg font-bold text-green-900">{(currentCapacity.f2fRequired * multiplier).toFixed(1)}</p>
                  <p className="text-[10px] text-green-600">{uLabel}</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-2 text-center border border-indigo-200">
                  <p className="text-xs font-medium text-indigo-700">Remote</p>
                  <p className="text-lg font-bold text-indigo-900">{(currentCapacity.remoteRequired * multiplier).toFixed(1)}</p>
                  <p className="text-[10px] text-indigo-600">{uLabel}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center mt-1.5">
                {currentCapacity.f2fRequired.toFixed(1)} sessions on-site • {currentCapacity.remoteRequired.toFixed(1)} sessions remote
              </p>

              {/* Global GP/ANP slider for practice view */}
              <div className="mt-3 pt-2 border-t border-slate-200 px-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-slate-500">GP / ANP-ACP Split</span>
                  <span className="text-[10px] font-semibold text-slate-700">{gpPct}% GP / {100 - gpPct}% ANP</span>
                </div>
                <Slider
                  value={[gpPct]}
                  onValueChange={(val) => updateGpPct(val[0])}
                  min={50}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>50% GP</span>
                  <span>100% GP</span>
                </div>
              </div>

              {(() => {
                const totalSessions = currentCapacity.sessionsPerWeek;
                const gpSess = totalSessions * (gpPct / 100);
                const anpSess = totalSessions * ((100 - gpPct) / 100);
                const gpW = calcWTE(gpSess);
                const anpW = calcWTE(anpSess);
                const gpCost = calcGpCost(gpSess);
                const anpCost = calcAnpCost(anpW);
                const totalCost = gpCost + anpCost;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
                        <p className="text-[10px] font-medium text-blue-700">GP</p>
                        <p className="text-sm font-bold text-blue-900">{gpSess.toFixed(1)} sess</p>
                        <p className="text-[10px] font-semibold text-blue-800">{gpW.toFixed(2)} WTE</p>
                        <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{formatCost(gpCost)}/yr</p>
                      </div>
                      <div className="bg-cyan-50 rounded-lg p-2 text-center border border-cyan-200">
                        <p className="text-[10px] font-medium text-cyan-700">ANP/ACP</p>
                        <p className="text-sm font-bold text-cyan-900">{anpSess.toFixed(1)} sess</p>
                        <p className="text-[10px] font-semibold text-cyan-800">{anpW.toFixed(2)} WTE</p>
                        <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{formatCost(anpCost)}/yr</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-center font-semibold text-emerald-800 mt-1">Est. workforce cost: {formatCost(totalCost)}/yr</p>
                    <p className="text-[9px] text-center text-slate-400 mt-0.5 italic">{costLabel}</p>
                  </>
                );
              })()}

              <div className="flex items-center justify-between mt-2">
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                  {season === "winter" ? "Winter" : season === "total" ? "Combined" : "Non-Winter"}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          /* Hub aggregated view */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {hubAggregatedData.map((hub) => (
              <div
                key={hub.hubName}
                className="rounded-xl p-5 border-2 bg-blue-50 border-blue-300 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-lg text-slate-900">{hub.hubName}</h4>
                    <p className="text-xs text-slate-500">{hub.practices.length} practices assigned</p>
                  </div>
                  <Badge className="bg-[#005EB8] text-white border-[#005EB8]">HUB</Badge>
                </div>

                <div className="mb-3 pb-3 border-b border-blue-200">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-slate-900">{hub.listSize.toLocaleString()}</p>
                    <p className="text-sm text-slate-500">patients ({hub.percentage.toFixed(2)}%)</p>
                  </div>
                </div>

                <div className="mb-3 pb-3 border-b border-blue-200">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Required</p>
                  <p className="text-2xl font-bold text-slate-900">{hub.totalRequired.toFixed(1)}</p>
                  <p className="text-xs text-slate-500">{uLabel}</p>
                </div>

                {/* Collapsible workforce section */}
                {(() => {
                  const sectionId = `hub-workforce-${hub.hubName.replace(/\s/g, '-')}`;
                  return (
                    <details className="group mb-3">
                      <summary className="cursor-pointer select-none text-xs font-semibold text-[#005EB8] flex items-center gap-1 mb-3 hover:underline">
                        <ArrowDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                        Workforce &amp; Capacity Planning
                      </summary>

                      {/* On-site slider FIRST */}
                      <div className="mb-3 px-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-slate-500">On-Site Split</span>
                          <span className="text-[10px] font-semibold text-slate-700">{hub.onsitePct}% On-Site / {100 - hub.onsitePct}% Remote</span>
                        </div>
                        <Slider
                          value={[hub.onsitePct]}
                          onValueChange={(val) => setHubOnsitePct(hub.hubName, val[0])}
                          min={50}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* F2F / Remote cards */}
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                          <p className="text-xs font-medium text-green-700">F2F (On-Site)</p>
                          <p className="text-xl font-bold text-green-900">{hub.f2f.toFixed(1)}</p>
                          <p className="text-[10px] text-green-600">{uLabel}</p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-200">
                          <p className="text-xs font-medium text-indigo-700">Remote</p>
                          <p className="text-xl font-bold text-indigo-900">{hub.remote.toFixed(1)}</p>
                          <p className="text-[10px] text-indigo-600">{uLabel}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 text-center mb-3">
                        {(hub.f2f / APPTS_PER_SESSION).toFixed(1)} sessions on-site • {(hub.remote / APPTS_PER_SESSION).toFixed(1)} sessions remote
                      </p>

                      {/* GP/ANP slider */}
                      <div className="mb-3 px-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-slate-500">GP / ANP-ACP Split</span>
                          <span className="text-[10px] font-semibold text-slate-700">{hub.gpPct}% GP / {100 - hub.gpPct}% ANP</span>
                        </div>
                        <Slider
                          value={[hub.gpPct]}
                          onValueChange={(val) => setHubGpPct(hub.hubName, val[0])}
                          min={50}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                          <span>50% GP</span>
                          <span>100% GP</span>
                        </div>
                      </div>

                      {/* GP / ANP-ACP Workforce Breakdown */}
                      {(() => {
                        const totalSessions = hub.totalRequired / (viewMode === "appointments" ? APPTS_PER_SESSION : 1);
                        const gpSessions = totalSessions * (hub.gpPct / 100);
                        const anpSessions = totalSessions * ((100 - hub.gpPct) / 100);
                        const gpWTE = calcWTE(gpSessions);
                        const anpWTE = calcWTE(anpSessions);
                        const gpCost = calcGpCost(gpSessions);
                        const anpCost = calcAnpCost(anpWTE);
                        const totalCost = gpCost + anpCost;
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-2 mb-1">
                              <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
                                <p className="text-[10px] font-medium text-blue-700">GP</p>
                                <p className="text-lg font-bold text-blue-900">{gpSessions.toFixed(1)}</p>
                                <p className="text-[10px] text-blue-600">sessions/week</p>
                                <p className="text-xs font-semibold text-blue-800 mt-1">{gpWTE.toFixed(2)} WTE</p>
                                <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{formatCost(gpCost)}/yr</p>
                              </div>
                              <div className="bg-cyan-50 rounded-lg p-2 text-center border border-cyan-200">
                                <p className="text-[10px] font-medium text-cyan-700">ANP/ACP</p>
                                <p className="text-lg font-bold text-cyan-900">{anpSessions.toFixed(1)}</p>
                                <p className="text-[10px] text-cyan-600">sessions/week</p>
                                <p className="text-xs font-semibold text-cyan-800 mt-1">{anpWTE.toFixed(2)} WTE</p>
                                <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{formatCost(anpCost)}/yr</p>
                              </div>
                            </div>
                            <p className="text-[10px] text-center font-semibold text-emerald-800 mb-3">Est. workforce cost: {formatCost(totalCost)}/yr</p>
                          </>
                        );
                      })()}
                    </details>
                  );
                })()}

                <div className="border-t border-blue-200 pt-3">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Assigned Practices</p>
                  <div className="space-y-1.5">
                    {hub.practices.map(p => (
                      <div key={p.practice}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${p.role === "HUB" ? "bg-[#005EB8] text-white border-[#005EB8]" : "bg-slate-200 text-slate-600 border-slate-300"}`}>
                              {p.role}
                            </Badge>
                            <span className="text-slate-700">{p.practice}</span>
                          </div>
                          <span className="text-slate-500 text-xs">{p.listSize.toLocaleString()}</span>
                        </div>
                        {p.branchSite && (
                          <p className="text-[10px] text-slate-500 italic ml-14 mt-0.5">{p.branchSite}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Neighbourhood Totals Box */}
            <div className="rounded-xl p-5 border-2 bg-gradient-to-br from-slate-100 to-blue-50 border-blue-300">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-lg text-slate-900">Neighbourhood Total</h4>
                  <p className="text-xs text-slate-500">All 3 hubs combined</p>
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 transition-colors shadow-sm" title="Cost assumptions">
                        <Settings className="w-4 h-4 text-slate-700" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" side="top" align="end" sideOffset={8}>
                      <div className="px-5 py-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm text-slate-900">Cost Assumptions</h4>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">GP Rate (£/session p.a.)</label>
                            <input
                              type="number"
                              value={gpRate}
                              onChange={(e) => updateGpRate(Number(e.target.value))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min={0}
                              step={500}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">ANP/ACP Rate (£/WTE p.a.)</label>
                            <input
                              type="number"
                              value={anpRate}
                              onChange={(e) => updateAnpRate(Number(e.target.value))}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min={0}
                              step={1000}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">On-Costs (%)</label>
                            <input
                              type="number"
                              value={onCostsPct}
                              onChange={(e) => updateOnCostsPct(Math.round(Number(e.target.value) * 100) / 100)}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min={0}
                              max={100}
                              step={0.5}
                            />
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-400 italic">Excludes overhead &amp; innovation costs. Changes auto-save locally.</p>
                        <PopoverClose asChild>
                          <button type="button" className="w-full mt-1 py-2 rounded-md bg-[#005EB8] text-white text-sm font-medium hover:bg-[#004a93] transition-colors">
                            Save &amp; Close
                          </button>
                        </PopoverClose>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">TOTAL</Badge>
                </div>
              </div>
              <div className="mb-3 pb-3 border-b border-slate-200">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900">{totalListSize.toLocaleString()}</p>
                  <p className="text-sm text-slate-500">patients (100%)</p>
                </div>
              </div>
              <div className="mb-3 pb-3 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Required</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{(currentCapacity.sessionsPerWeek * multiplier).toFixed(1)}</p>
                    <p className="text-xs text-slate-500">{uLabel} / week</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{(currentCapacity.sessionsPerWeek * multiplier * 52).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</p>
                    <p className="text-xs text-slate-500">{uLabel} / year</p>
                  </div>
                </div>
              </div>
              {(() => {
                const aggF2f = hubAggregatedData.reduce((s, h) => s + h.f2f, 0);
                const aggRemote = hubAggregatedData.reduce((s, h) => s + h.remote, 0);
                const aggF2fSess = aggF2f / (viewMode === "appointments" ? APPTS_PER_SESSION : 1);
                const aggRemoteSess = aggRemote / (viewMode === "appointments" ? APPTS_PER_SESSION : 1);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                        <p className="text-xs font-medium text-green-700">F2F (On-Site)</p>
                        <p className="text-xl font-bold text-green-900">{aggF2f.toFixed(1)}</p>
                        <p className="text-[10px] text-green-600">{uLabel} / week</p>
                        <p className="text-sm font-semibold text-green-800 mt-1">{(aggF2f * 52).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} / yr</p>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-200">
                        <p className="text-xs font-medium text-indigo-700">Remote</p>
                        <p className="text-xl font-bold text-indigo-900">{aggRemote.toFixed(1)}</p>
                        <p className="text-[10px] text-indigo-600">{uLabel} / week</p>
                        <p className="text-sm font-semibold text-indigo-800 mt-1">{(aggRemote * 52).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} / yr</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center mt-1.5">
                      {aggF2fSess.toFixed(1)} sessions on-site • {aggRemoteSess.toFixed(1)} sessions remote
                    </p>
                  </>
                );
              })()}

              {/* Aggregated GP / ANP-ACP WTE for all hubs */}
              {(() => {
                const allGpSess = hubAggregatedData.reduce((sum, h) => {
                  const totalSess = h.totalRequired / (viewMode === "appointments" ? APPTS_PER_SESSION : 1);
                  return sum + totalSess * (h.gpPct / 100);
                }, 0);
                const allAnpSess = hubAggregatedData.reduce((sum, h) => {
                  const totalSess = h.totalRequired / (viewMode === "appointments" ? APPTS_PER_SESSION : 1);
                  return sum + totalSess * ((100 - h.gpPct) / 100);
                }, 0);
                const gpCostAll = calcGpCost(allGpSess);
                const anpCostAll = calcAnpCost(calcWTE(allAnpSess));
                const totalCostAll = gpCostAll + anpCostAll;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
                        <p className="text-[10px] font-medium text-blue-700">GP Total</p>
                        <p className="text-lg font-bold text-blue-900">{allGpSess.toFixed(1)}</p>
                        <p className="text-[10px] text-blue-600">sessions/week</p>
                        <p className="text-xs font-semibold text-blue-800 mt-1">{calcWTE(allGpSess).toFixed(2)} WTE</p>
                        <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{formatCost(gpCostAll)}/yr</p>
                      </div>
                      <div className="bg-cyan-50 rounded-lg p-2 text-center border border-cyan-200">
                        <p className="text-[10px] font-medium text-cyan-700">ANP/ACP Total</p>
                        <p className="text-lg font-bold text-cyan-900">{allAnpSess.toFixed(1)}</p>
                        <p className="text-[10px] text-cyan-600">sessions/week</p>
                        <p className="text-xs font-semibold text-cyan-800 mt-1">{calcWTE(allAnpSess).toFixed(2)} WTE</p>
                        <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{formatCost(anpCostAll)}/yr</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-center font-semibold text-emerald-800 mt-1">Est. workforce cost: {formatCost(totalCostAll)}/yr</p>
                    <p className="text-[9px] text-center text-slate-400 mt-0.5 italic">{costLabel}</p>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* ENN Neighbourhood Appointment Allocation */}
      <CollapsibleCard
        title="ENN Neighbourhood Appointment Allocation"
        icon={<Calendar className="w-5 h-5" />}
        badge={
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {ANNUAL_APPTS.toLocaleString()} Annual Appointments
          </Badge>
        }
      >
        {/* Info Banner */}
        <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#005EB8] mt-0.5 shrink-0" />
            <div className="space-y-1.5 text-sm text-slate-700">
              <p><strong className="text-[#003087]">How these numbers are calculated:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                <li><strong>Non-Winter rate:</strong> 15.2 appointments per 1,000 patients (39 weeks)</li>
                <li><strong>Winter rate:</strong> 18.2 appointments per 1,000 patients (13 weeks)</li>
                <li><strong>Clinician split:</strong> Minimum 50% GP appointments · remaining 50% ANP/ACP</li>
                <li><strong>Delivery split:</strong> 50% on-site (hub/spoke) · up to 50% remote</li>
                <li><strong>Session size:</strong> {APPTS_PER_SESSION} × 15 min appointments per session (4h 10m including admin)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Column group toggles */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Show columns:</span>
          <button
            onClick={() => toggleGroup("listIncome")}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${expandedGroups.has("listIncome") ? "bg-[#005EB8] text-white border-[#005EB8]" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
          >
            List & Income
          </button>
          <button
            onClick={() => toggleGroup("winter")}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${expandedGroups.has("winter") ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
          >
            <span className="inline-flex items-center gap-1"><Snowflake className="w-3 h-3" />Winter</span>
          </button>
          <button
            onClick={() => toggleGroup("nonWinter")}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${expandedGroups.has("nonWinter") ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}
          >
            <span className="inline-flex items-center gap-1"><Sun className="w-3 h-3" />Non-Winter</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("practice")}>
                  <div className="flex items-center">Practice{getSortIcon("practice")}</div>
                </TableHead>
                {expandedGroups.has("listIncome") && (
                  <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("listSize")}>
                    <div className="flex items-center justify-end">List Size{getSortIcon("listSize")}</div>
                  </TableHead>
                )}
                <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("annualAppts")}>
                  <div className="flex items-center justify-end">Annual Appts{getSortIcon("annualAppts")}</div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("weeklyAppts")}>
                  <div className="flex items-center justify-end">Weekly Appts{getSortIcon("weeklyAppts")}</div>
                </TableHead>
                {expandedGroups.has("listIncome") && (
                  <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("annualIncome")}>
                    <div className="flex items-center justify-end">Annual Income{getSortIcon("annualIncome")}</div>
                  </TableHead>
                )}
                {expandedGroups.has("winter") && (
                  <>
                    <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("winterAppts")}>
                      <div className="flex items-center justify-end">Winter Appts{getSortIcon("winterAppts")}</div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("weeklyWinter")}>
                      <div className="flex items-center justify-end">Weekly Winter{getSortIcon("weeklyWinter")}</div>
                    </TableHead>
                  </>
                )}
                {expandedGroups.has("nonWinter") && (
                  <>
                    <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("nonWinterAppts")}>
                      <div className="flex items-center justify-end">Non-Winter Appts{getSortIcon("nonWinterAppts")}</div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("weeklyNonWinter")}>
                      <div className="flex items-center justify-end">Weekly Non-Winter{getSortIcon("weeklyNonWinter")}</div>
                    </TableHead>
                  </>
                )}
                <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => togglePracticeSort("hub")}>
                  <div className="flex items-center justify-end">Hub{getSortIcon("hub")}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPracticeSummary.map((practice, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <div>
                      {practice.practice}
                      {practice.role === "HUB" && <Badge variant="outline" className="ml-2 text-[10px] bg-[#005EB8] text-white border-[#005EB8]">HUB</Badge>}
                      {practice.branchSite && (
                        <p className="text-[10px] text-slate-500 italic font-normal mt-0.5">{practice.branchSite}</p>
                      )}
                    </div>
                  </TableCell>
                  {expandedGroups.has("listIncome") && (
                    <TableCell className="text-right">{practice.listSize.toLocaleString()}</TableCell>
                  )}
                  <TableCell className="text-right">{practice.annualAppts.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">{practice.weeklyAppts.toLocaleString()}</TableCell>
                  {expandedGroups.has("listIncome") && (
                    <TableCell className="text-right">£{practice.annualIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  )}
                  {expandedGroups.has("winter") && (
                    <>
                      <TableCell className="text-right text-blue-700">{practice.winterAppts.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-blue-700 font-semibold">{practice.weeklyWinter.toLocaleString()}</TableCell>
                    </>
                  )}
                  {expandedGroups.has("nonWinter") && (
                    <>
                      <TableCell className="text-right text-amber-700">{practice.nonWinterAppts.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-amber-700 font-semibold">{practice.weeklyNonWinter.toLocaleString()}</TableCell>
                    </>
                  )}
                  <TableCell className="text-right text-xs text-slate-600 whitespace-nowrap">{practice.hub}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-100 font-bold">
                <TableCell>Total</TableCell>
                {expandedGroups.has("listIncome") && (
                  <TableCell className="text-right">{totalListSize.toLocaleString()}</TableCell>
                )}
                <TableCell className="text-right">{ennPracticeSummary.reduce((s, p) => s + p.annualAppts, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right">{ennPracticeSummary.reduce((s, p) => s + p.weeklyAppts, 0).toLocaleString()}</TableCell>
                {expandedGroups.has("listIncome") && (
                  <TableCell className="text-right">£{ennPracticeSummary.reduce((s, p) => s + p.annualIncome, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                )}
                {expandedGroups.has("winter") && (
                  <>
                    <TableCell className="text-right text-blue-700">{ennPracticeSummary.reduce((s, p) => s + p.winterAppts, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-blue-700">{ennPracticeSummary.reduce((s, p) => s + p.weeklyWinter, 0).toLocaleString()}</TableCell>
                  </>
                )}
                {expandedGroups.has("nonWinter") && (
                  <>
                    <TableCell className="text-right text-amber-700">{ennPracticeSummary.reduce((s, p) => s + p.nonWinterAppts, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-amber-700">{ennPracticeSummary.reduce((s, p) => s + p.weeklyNonWinter, 0).toLocaleString()}</TableCell>
                  </>
                )}
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> 1 session = {APPTS_PER_SESSION} × 15 min appointments (F2F and Virtual). Initially 15 mins for virtual appointments but the board may change to 10 mins at a later date.
          </p>
        </div>
      </CollapsibleCard>

      {/* Hub Location Status & Drive Times */}
      <CollapsibleCard
        title="Hub Location Status & Drive Times"
        icon={<Building2 className="w-5 h-5" />}
        badge={<span className="text-xs text-slate-500 font-normal">ENN Neighbourhood</span>}
      >
        <div className="space-y-6">
          {/* Hub Practice Listings */}
          {Object.entries(hubPracticeMapping).map(([hubName, practiceNames]) => {
            const practices = ennPracticeSummary.filter(p => practiceNames.includes(p.practice));
            const hubListSize = practices.reduce((sum, p) => sum + p.listSize, 0);
            return (
              <div key={hubName} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">Hub</Badge>
                  <span className="font-semibold text-slate-900">{hubName}</span>
                  <span className="text-slate-500 text-sm">— {hubListSize.toLocaleString()} patients</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold">Practice</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Population</TableHead>
                      <TableHead className="text-xs font-semibold text-center">
                        <div className="flex items-center justify-center gap-1"><MapPin className="w-3.5 h-3.5" />Miles</div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center">
                        <div className="flex items-center justify-center gap-1"><Car className="w-3.5 h-3.5" />By Car</div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center">
                        <div className="flex items-center justify-center gap-1"><Bus className="w-3.5 h-3.5" />Public Transport</div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center">
                        <div className="flex items-center justify-center gap-1"><Bus className="w-3.5 h-3.5" />Bus Service</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {practices.map(p => {
                      const isHub = p.role === "HUB";
                      const travel = PRACTICE_TRAVEL[p.practice] || {};
                      const carMin = travel.carMin;
                      let carColour = "text-slate-500";
                      if (carMin != null && carMin > 0) {
                        if (carMin < 10) carColour = "text-green-700";
                        else if (carMin <= 15) carColour = "text-amber-700";
                        else carColour = "text-red-700";
                      }
                      return (
                        <TableRow key={p.practice} className={isHub ? "bg-blue-50/50 font-medium" : ""}>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 ${isHub ? "bg-[#005EB8] text-white border-[#005EB8]" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                                {p.role}
                              </Badge>
                              <span>{p.practice}</span>
                            </div>
                            {p.branchSite && (
                              <span className="text-[10px] text-slate-500 italic ml-16 block">{p.branchSite}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{p.listSize.toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-center tabular-nums text-slate-600">
                            {travel.miles != null ? (travel.miles === 0 ? "—" : travel.miles.toFixed(1)) : ""}
                          </TableCell>
                          <TableCell className={`text-sm text-center tabular-nums font-medium ${carColour}`}>
                            {carMin != null ? (carMin === 0 ? "—" : `${carMin}m`) : ""}
                          </TableCell>
                          <TableCell className="text-sm text-center tabular-nums text-slate-600">
                            {travel.publicTransportMin != null ? (travel.publicTransportMin === 0 ? "—" : `${travel.publicTransportMin}m`) : ""}
                          </TableCell>
                          <TableCell className="text-sm text-center font-medium text-blue-700">
                            {travel.busService || ""}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}

          {/* Travel to Corby Urgent Care Centre */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Badge className="bg-red-100 text-red-800 border-red-300">CUCC</Badge>
              <span className="font-semibold text-slate-900">Travel to Corby Urgent Care Centre</span>
              <span className="text-slate-500 text-sm">— All 10 practices</span>
            </div>
            <CUCCSortableTable practices={ennPracticeSummary} />
          </div>


          <div className="border-t pt-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-2">Neighbourhood Drive Time Overview</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The interactive map below shows the geographical spread of all 10 ENN practices across the 3 hub sites. 
                Use <strong>Hub View</strong> to see practice groupings and patient volumes, or switch to <strong>Map &amp; Drive Times</strong> to 
                explore estimated travel distances between practices. Drive time data helps inform session planning, clinician routing, 
                and ensures equitable access across the neighbourhood — particularly for outlying practices such as Oundle and Nene Valley.
              </p>
            </div>
            <ENNNeighbourhoodMap />
          </div>
        </div>
      </CollapsibleCard>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={cycleSitesMode}>
          <CardContent className="p-4 text-center">
            <Building2 className="w-6 h-6 text-[#005EB8] mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{sitesDisplay.value}</p>
            <p className="text-sm text-slate-600">{sitesDisplay.label}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={cycleSessionsMode}>
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{sessionsDisplay.value}</p>
            <p className="text-sm text-slate-600">{sessionsDisplay.label}</p>
            {'sublabel' in sessionsDisplay && sessionsDisplay.sublabel && (
              <p className="text-xs text-green-700 font-medium mt-1">{sessionsDisplay.sublabel}</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={cycleDurationMode}>
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{durationDisplay.value}</p>
            <p className="text-sm text-slate-600">{durationDisplay.label}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={cycleApptsMode}>
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{apptsDisplay.value}</p>
            <p className="text-sm text-slate-600">{apptsDisplay.label}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
