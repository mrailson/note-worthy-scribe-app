import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Building2, Clock, Users, Calendar, LayoutGrid, CalendarDays, CalendarRange, ArrowUpDown, ArrowUp, ArrowDown, Sun, Snowflake, Layers, Info } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";

const APPTS_PER_SESSION = 14;

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
}

const ennPracticeSummary: ENNPracticeSummary[] = [
  { practice: "Harborough Field Surgery", odsCode: "K83007", listSize: 13991, annualAppts: 11604, weeklyAppts: 222, winterAppts: 3310, nonWinterAppts: 8294, weeklyWinter: 255, weeklyNonWinter: 213, annualIncome: 366383.03, role: "HUB", hub: "Harborough Field Surgery", system: "SystmOne" },
  { practice: "Oundle Medical Practice", odsCode: "K83023", listSize: 10600, annualAppts: 8792, weeklyAppts: 169, winterAppts: 2509, nonWinterAppts: 6284, weeklyWinter: 193, weeklyNonWinter: 161, annualIncome: 279098.00, role: "SPOKE", hub: "The Meadows Surgery", system: "SystmOne" },
  { practice: "Rushden Medical Centre", odsCode: "K83024", listSize: 9143, annualAppts: 7583, weeklyAppts: 146, winterAppts: 2163, nonWinterAppts: 5420, weeklyWinter: 166, weeklyNonWinter: 139, annualIncome: 240735.19, role: "SPOKE", hub: "Harborough Field Surgery", system: "SystmOne" },
  { practice: "Spinney Brook MC", odsCode: "K83028", listSize: 11537, annualAppts: 9569, weeklyAppts: 184, winterAppts: 2730, nonWinterAppts: 6839, weeklyWinter: 210, weeklyNonWinter: 175, annualIncome: 303769.21, role: "SPOKE", hub: "The Cottons MC", system: "SystmOne" },
  { practice: "The Cottons MC", odsCode: "K83030", listSize: 9372, annualAppts: 7773, weeklyAppts: 149, winterAppts: 2217, nonWinterAppts: 5556, weeklyWinter: 171, weeklyNonWinter: 142, annualIncome: 246764.76, role: "HUB", hub: "The Cottons MC", system: "SystmOne" },
  { practice: "Parklands Surgery", odsCode: "K83044", listSize: 13612, annualAppts: 11290, weeklyAppts: 217, winterAppts: 3221, nonWinterAppts: 8069, weeklyWinter: 248, weeklyNonWinter: 207, annualIncome: 358403.96, role: "SPOKE", hub: "Harborough Field Surgery", system: "SystmOne" },
  { practice: "Nene Valley Surgery", odsCode: "K83065", listSize: 6921, annualAppts: 5740, weeklyAppts: 110, winterAppts: 1638, nonWinterAppts: 4103, weeklyWinter: 126, weeklyNonWinter: 105, annualIncome: 182229.93, role: "SPOKE", hub: "The Meadows Surgery", system: "SystmOne" },
  { practice: "Marshalls Road Surgery", odsCode: "K83069", listSize: 3156, annualAppts: 2618, weeklyAppts: 50, winterAppts: 747, nonWinterAppts: 1871, weeklyWinter: 57, weeklyNonWinter: 48, annualIncome: 83097.48, role: "SPOKE", hub: "The Cottons MC", system: "SystmOne" },
  { practice: "Higham Ferrers Surgery", odsCode: "K83080", listSize: 5569, annualAppts: 4619, weeklyAppts: 89, winterAppts: 1318, nonWinterAppts: 3301, weeklyWinter: 101, weeklyNonWinter: 85, annualIncome: 146631.77, role: "SPOKE", hub: "Harborough Field Surgery", system: "SystmOne" },
  { practice: "The Meadows Surgery", odsCode: "K83616", listSize: 6340, annualAppts: 5258, weeklyAppts: 101, winterAppts: 1500, nonWinterAppts: 3758, weeklyWinter: 115, weeklyNonWinter: 96, annualIncome: 166932.20, role: "HUB", hub: "The Meadows Surgery", system: "SystmOne" },
];

const hubPracticeMapping: Record<string, string[]> = {
  "Harborough Field Surgery": ["Harborough Field Surgery", "Parklands Surgery", "Rushden Medical Centre", "Higham Ferrers Surgery"],
  "The Cottons MC": ["The Cottons MC", "Spinney Brook MC", "Marshalls Road Surgery"],
  "The Meadows Surgery": ["The Meadows Surgery", "Oundle Medical Practice", "Nene Valley Surgery"],
};

const totalListSize = ennPracticeSummary.reduce((sum, p) => sum + p.listSize, 0);
const ANNUAL_APPTS = 74846;

export const ENNEstatesCapacity = () => {
  const [season, setSeason] = useState<Season>("nonWinter");
  const [viewMode, setViewMode] = useState<"sessions" | "appointments">("sessions");
  const [viewLevel, setViewLevel] = useState<ViewLevel>("practice");
  const [practiceSortField, setPracticeSortField] = useState<PracticeSortField>("listSize");
  const [practiceSortDirection, setPracticeSortDirection] = useState<SortDirection>("desc");
  const [sitesDisplayMode, setSitesDisplayMode] = useState<SitesDisplayMode>("total");
  const [sessionsDisplayMode, setSessionsDisplayMode] = useState<SessionsDisplayMode>("total");
  const [durationDisplayMode, setDurationDisplayMode] = useState<DurationDisplayMode>("perSession");
  const [apptsDisplayMode, setApptsDisplayMode] = useState<ApptsDisplayMode>("perSession");

  const activeSplit = 50;
  const remoteSplitPct = 50;

  const multiplier = viewMode === "appointments" ? APPTS_PER_SESSION : 1;
  const unitLabel = viewMode === "appointments" ? "appointments" : "sessions";

  const capacityData = useMemo(() => ({
    nonWinter: {
      rate: "15.2 per 1,000",
      weeks: 39,
      apptsPerWeek: 1371,
      sessionsPerWeek: Math.round(1371 / APPTS_PER_SESSION * 10) / 10,
      sessionLength: "4h 10m",
      f2fRequired: Math.round(1371 / APPTS_PER_SESSION * 10) / 10 * (activeSplit / 100),
      remoteRequired: Math.round(1371 / APPTS_PER_SESSION * 10) / 10 * (remoteSplitPct / 100),
    },
    winter: {
      rate: "18.2 per 1,000",
      weeks: 13,
      apptsPerWeek: 1642,
      sessionsPerWeek: Math.round(1642 / APPTS_PER_SESSION * 10) / 10,
      sessionLength: "4h 10m",
      f2fRequired: Math.round(1642 / APPTS_PER_SESSION * 10) / 10 * (activeSplit / 100),
      remoteRequired: Math.round(1642 / APPTS_PER_SESSION * 10) / 10 * (remoteSplitPct / 100),
    },
  }), []);

  const totalCapacity = useMemo(() => ({
    rate: "15.2–18.2 per 1,000",
    weeks: 52,
    annualAppts: ANNUAL_APPTS,
    apptsPerWeek: Math.round(ANNUAL_APPTS / 52),
    sessionsPerWeek: Math.round(ANNUAL_APPTS / 52 / APPTS_PER_SESSION * 10) / 10,
    sessionLength: "4h 10m",
    f2fRequired: Math.round(ANNUAL_APPTS / 52 / APPTS_PER_SESSION * (activeSplit / 100) * 10) / 10,
    remoteRequired: Math.round(ANNUAL_APPTS / 52 / APPTS_PER_SESSION * (remoteSplitPct / 100) * 10) / 10,
  }), []);

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
        f2f: displayValue * (activeSplit / 100),
        remote: displayValue * (remoteSplitPct / 100),
      };
    });

    return [...withCalc].sort((a, b) => {
      let aVal: number | string, bVal: number | string;
      switch (practiceSortField) {
        case "practice": aVal = a.practice.toLowerCase(); bVal = b.practice.toLowerCase(); break;
        case "listSize": aVal = a.listSize; bVal = b.listSize; break;
        case "percentage": aVal = a.percentage; bVal = b.percentage; break;
        case "sessionsWeek": aVal = a.sessionsWeek; bVal = b.sessionsWeek; break;
        case "f2f": aVal = a.f2f; bVal = b.f2f; break;
        case "remote": aVal = a.remote; bVal = b.remote; break;
        default: return 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return practiceSortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return practiceSortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [practiceSortField, practiceSortDirection, currentCapacity.sessionsPerWeek, viewMode]);

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
      return {
        hubName,
        practices,
        listSize: hubListSize,
        percentage,
        totalRequired: displayValue,
        f2f: displayValue * (activeSplit / 100),
        remote: displayValue * (remoteSplitPct / 100),
      };
    });
  }, [currentCapacity.sessionsPerWeek, viewMode]);

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
              const f2fRequired = totalRequired * (activeSplit / 100);
              const remoteRequired = totalRequired * (remoteSplitPct / 100);
              const mul = viewMode === "appointments" ? APPTS_PER_SESSION : 1;

              return (
                <div
                  key={index}
                  className={`rounded-xl p-4 border transition-all hover:shadow-md ${practice.role === "HUB" ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-slate-900">{practice.practice}</h4>
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

                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Recruitment</p>
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-200">
                      <div className="bg-slate-300 w-full" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Not yet populated</p>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className="text-xs">{practice.system}</Badge>
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
                    <p className="text-sm text-slate-500">patients ({hub.percentage.toFixed(1)}%)</p>
                  </div>
                </div>

                <div className="mb-3 pb-3 border-b border-blue-200">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Required</p>
                  <p className="text-2xl font-bold text-slate-900">{hub.totalRequired.toFixed(1)}</p>
                  <p className="text-xs text-slate-500">{uLabel}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
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

                <div className="border-t border-blue-200 pt-3">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Assigned Practices</p>
                  <div className="space-y-1.5">
                    {hub.practices.map(p => (
                      <div key={p.practice} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${p.role === "HUB" ? "bg-[#005EB8] text-white border-[#005EB8]" : "bg-slate-200 text-slate-600 border-slate-300"}`}>
                            {p.role}
                          </Badge>
                          <span className="text-slate-700">{p.practice}</span>
                        </div>
                        <span className="text-slate-500 text-xs">{p.listSize.toLocaleString()}</span>
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
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">TOTAL</Badge>
              </div>
              <div className="mb-3 pb-3 border-b border-slate-200">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900">{totalListSize.toLocaleString()}</p>
                  <p className="text-sm text-slate-500">patients (100%)</p>
                </div>
              </div>
              <div className="mb-3 pb-3 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Required</p>
                <p className="text-2xl font-bold text-slate-900">{(currentCapacity.sessionsPerWeek * multiplier).toFixed(1)}</p>
                <p className="text-xs text-slate-500">{uLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                  <p className="text-xs font-medium text-green-700">F2F (On-Site)</p>
                  <p className="text-xl font-bold text-green-900">{(currentCapacity.f2fRequired * multiplier).toFixed(1)}</p>
                  <p className="text-[10px] text-green-600">{uLabel}</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-200">
                  <p className="text-xs font-medium text-indigo-700">Remote</p>
                  <p className="text-xl font-bold text-indigo-900">{(currentCapacity.remoteRequired * multiplier).toFixed(1)}</p>
                  <p className="text-[10px] text-indigo-600">{uLabel}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* Capacity Modelling */}
      <CollapsibleCard
        title="Capacity Modelling"
        icon={<Calendar className="w-5 h-5" />}
        badge={
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {ANNUAL_APPTS.toLocaleString()} Annual Appointments
          </Badge>
        }
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">Appointment and session modelling by season</p>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setSeason("nonWinter")} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${season === "nonWinter" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <Sun className="w-4 h-4" /> Non-Winter
              </button>
              <button onClick={() => setSeason("winter")} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${season === "winter" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <Snowflake className="w-4 h-4" /> Winter
              </button>
              <button onClick={() => setSeason("total")} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${season === "total" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <CalendarRange className="w-4 h-4" /> Combined
              </button>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode("sessions")} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "sessions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <LayoutGrid className="w-4 h-4" /> Sessions
              </button>
              <button onClick={() => setViewMode("appointments")} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "appointments" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <CalendarDays className="w-4 h-4" /> Appointments
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-500">Rate</p>
            <p className="text-xl font-bold text-slate-900">{currentCapacity.rate}</p>
            <p className="text-xs text-slate-400">patients</p>
          </div>
          <div className={`rounded-lg p-4 text-center ${season === "total" ? "bg-slate-700 text-white" : "bg-slate-50"}`}>
            <p className={`text-sm ${season === "total" ? "text-slate-300" : "text-slate-500"}`}>
              {season === "total" ? "Annual Appointments" : "Appointments/Week"}
            </p>
            <p className={`text-xl font-bold ${season === "total" ? "text-white" : "text-slate-900"}`}>
              {season === "total" ? ANNUAL_APPTS.toLocaleString() : currentCapacity.apptsPerWeek.toLocaleString()}
            </p>
            <p className={`text-xs ${season === "total" ? "text-slate-400" : "text-slate-400"}`}>
              {season === "total" ? "combined average" : "required"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-500">{season === "total" ? "Annual Sessions" : `${unitLabel}/Week`}</p>
            <p className="text-xl font-bold text-slate-900">
              {season === "total"
                ? Math.round(ANNUAL_APPTS / APPTS_PER_SESSION).toLocaleString()
                : viewMode === "appointments"
                  ? Math.round(currentCapacity.sessionsPerWeek * APPTS_PER_SESSION).toLocaleString()
                  : currentCapacity.sessionsPerWeek}
            </p>
            <p className="text-xs text-slate-400">{season === "total" ? "combined average" : "total needed"}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-500">Duration</p>
            <p className="text-xl font-bold text-slate-900">{currentCapacity.weeks}</p>
            <p className="text-xs text-slate-400">weeks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <h4 className="font-semibold text-green-800 mb-2">
              Face-to-Face {viewMode === "appointments" ? "Appointments" : "Sessions"} Required
            </h4>
            <p className="text-3xl font-bold text-green-700">
              {season === "total"
                ? Math.round(ANNUAL_APPTS * (activeSplit / 100)).toLocaleString()
                : viewMode === "appointments"
                  ? Math.round(currentCapacity.f2fRequired * APPTS_PER_SESSION).toLocaleString()
                  : currentCapacity.f2fRequired.toFixed(1)}
            </p>
            <p className="text-sm text-green-600">
              {season === "total" ? `appointments per year (${activeSplit}% split)` : `${unitLabel} per week (${activeSplit}% split)`}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">
              Remote {viewMode === "appointments" ? "Appointments" : "Sessions"} Required
            </h4>
            <p className="text-3xl font-bold text-blue-700">
              {season === "total"
                ? Math.round(ANNUAL_APPTS * (remoteSplitPct / 100)).toLocaleString()
                : viewMode === "appointments"
                  ? Math.round(currentCapacity.remoteRequired * APPTS_PER_SESSION).toLocaleString()
                  : currentCapacity.remoteRequired.toFixed(1)}
            </p>
            <p className="text-sm text-blue-600">
              {season === "total" ? `appointments per year (${remoteSplitPct}% split)` : `${unitLabel} per week (${remoteSplitPct}% split)`}
            </p>
          </div>
        </div>

        {/* Practice Breakdown Table */}
        <div className="mt-6">
          <h4 className="font-semibold text-slate-900 mb-3">
            {viewMode === "appointments" ? "Appointments" : "Sessions"} Required by Practice (Based on List Size)
          </h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => togglePracticeSort("practice")}>
                    <div className="flex items-center">Practice{getSortIcon("practice")}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => togglePracticeSort("listSize")}>
                    <div className="flex items-center justify-end">List Size{getSortIcon("listSize")}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => togglePracticeSort("percentage")}>
                    <div className="flex items-center justify-end">% of Total{getSortIcon("percentage")}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => togglePracticeSort("sessionsWeek")}>
                    <div className="flex items-center justify-end">{viewMode === "appointments" ? "Appts" : "Sessions"}/Week{getSortIcon("sessionsWeek")}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => togglePracticeSort("f2f")}>
                    <div className="flex items-center justify-end">F2F ({activeSplit}%){getSortIcon("f2f")}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => togglePracticeSort("remote")}>
                    <div className="flex items-center justify-end">Remote ({remoteSplitPct}%){getSortIcon("remote")}</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPracticeSummary.map((practice, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {practice.practice}
                      {practice.role === "HUB" && <Badge variant="outline" className="ml-2 text-[10px] bg-[#005EB8] text-white border-[#005EB8]">HUB</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{practice.listSize.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{practice.percentage.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-semibold">{Math.round(practice.sessionsWeek).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-700">{Math.round(practice.f2f).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-blue-700">{Math.round(practice.remote).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totalListSize.toLocaleString()}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                  <TableCell className="text-right">
                    {viewMode === "appointments"
                      ? Math.round(currentCapacity.sessionsPerWeek * APPTS_PER_SESSION).toLocaleString()
                      : currentCapacity.sessionsPerWeek}
                  </TableCell>
                  <TableCell className="text-right text-green-700">
                    {viewMode === "appointments"
                      ? Math.round(currentCapacity.f2fRequired * APPTS_PER_SESSION).toLocaleString()
                      : currentCapacity.f2fRequired.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right text-blue-700">
                    {viewMode === "appointments"
                      ? Math.round(currentCapacity.remoteRequired * APPTS_PER_SESSION).toLocaleString()
                      : currentCapacity.remoteRequired.toFixed(1)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> 1 session = {APPTS_PER_SESSION} × 15 min appointments (F2F and Virtual). Initially 15 mins for virtual appointments but the board may change to 10 mins at a later date.
          </p>
        </div>
      </CollapsibleCard>

      {/* Hub Location Status */}
      <CollapsibleCard
        title="Hub Location Status"
        icon={<Building2 className="w-5 h-5" />}
        badge={<span className="text-xs text-slate-500 font-normal">ENN Neighbourhood</span>}
      >
        <div className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-6">
                  {practices.map(p => (
                    <div key={p.practice} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className={`text-xs ${p.role === "HUB" ? "bg-[#005EB8] text-white border-[#005EB8]" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                        {p.role}
                      </Badge>
                      <span className="text-slate-700">{p.practice}</span>
                      <span className="text-slate-400 text-xs">({p.listSize.toLocaleString()})</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
