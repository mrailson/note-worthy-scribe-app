import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, MapPin, Sun, Snowflake, Building2, Clock, Users, Calendar, LayoutGrid, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { TravelTimesThumbnail, TravelTimesSlideshow } from "./TravelTimesSlideshow";

type PracticeSortField = "practice" | "listSize" | "percentage" | "sessionsWeek" | "f2f" | "remote";
type SortDirection = "asc" | "desc";
type BadgeDisplayMode = "total" | "winter" | "nonWinter" | "onsite" | "remote";
type SitesDisplayMode = "total" | "hub" | "spoke" | "tbc";
type SessionsDisplayMode = "total" | "winter" | "nonWinter" | "onsite" | "remote";
type DurationDisplayMode = "perSession" | "perDay" | "perWeek";
type ApptsDisplayMode = "perSession" | "perHour" | "perDay";

// Room availability data by session
const sessionData = [
  { session: "Monday AM", theParks: 1, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 1, total: 7 },
  { session: "Monday PM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 3, total: 11 },
  { session: "Tuesday AM", theParks: 5, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 0, total: 11 },
  { session: "Tuesday PM", theParks: 6, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 2, total: 14 },
  { session: "Wednesday AM", theParks: 0, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 1, total: 6 },
  { session: "Wednesday PM", theParks: 0, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 4, total: 9 },
  { session: "Thursday AM", theParks: 4, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 0, total: 9 },
  { session: "Thursday PM", theParks: 4, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 0, total: 10 },
  { session: "Friday AM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 2, total: 10 },
  { session: "Friday PM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 4, total: 12 },
];

// Practice summary data with list sizes (matching Executive Summary population data)
const practiceSummary = [
  { 
    practice: "The Parks MC", 
    subPractices: ["Roade", "Blisworth", "Grange Park", "Hanslope"],
    totalSessions: 29,
    listSize: 22689,
    role: "HUB",
    system: "SystmOne"
  },
  { practice: "Brackley MC", totalSessions: 20, listSize: 16128, role: "HUB", system: "SystmOne", note: "Non-GMS rent required" },
  { practice: "Springfield", totalSessions: 10, listSize: 12649, role: "SPOKE", system: "EMIS" },
  { practice: "Towcester MC", totalSessions: 17, listSize: 11439, role: "SPOKE", system: "EMIS" },
  { practice: "Bugbrooke", totalSessions: 10, listSize: 10773, role: "SPOKE", system: "SystmOne" },
  { practice: "Brook Health", totalSessions: 10, listSize: 8983, role: "TBC", system: "SystmOne", note: "Awaiting NHFT meeting (15 Jan) - will report to board" },
  { practice: "Denton Village", totalSessions: 3, listSize: 6277, role: "SPOKE", system: "SystmOne", note: "Tue/Fri full day, Thu PM" },
];

const totalListSize = practiceSummary.reduce((sum, p) => sum + p.listSize, 0);

// Capacity planning data
const capacityData = {
  nonWinter: {
    rate: "15.2 per 1,000",
    weeks: 39,
    apptsPerWeek: 1352,
    sessionsPerWeek: 112.7,
    sessionLength: "4h 10m",
    f2fRequired: 56.35,
    remoteRequired: 56.35
  },
  winter: {
    rate: "18.2 per 1,000",
    weeks: 13,
    apptsPerWeek: 1619,
    sessionsPerWeek: 134.9,
    sessionLength: "4h 10m",
    f2fRequired: 67.45,
    remoteRequired: 67.45
  }
};

const getCellColor = (value: number) => {
  if (value === 0) return "bg-red-100 text-red-700";
  if (value >= 3) return "bg-green-100 text-green-700";
  return "bg-amber-50 text-amber-700";
};

export const SDAEstatesCapacity = () => {
  const [season, setSeason] = useState<"winter" | "nonWinter">("winter");
  const [viewMode, setViewMode] = useState<"sessions" | "appointments">("sessions");
  const [practiceSortField, setPracticeSortField] = useState<PracticeSortField>("listSize");
  const [practiceSortDirection, setPracticeSortDirection] = useState<SortDirection>("desc");
  const [badgeDisplayMode, setBadgeDisplayMode] = useState<BadgeDisplayMode>("total");
  const [travelTimesModalOpen, setTravelTimesModalOpen] = useState(false);
  
  // Top banner display modes
  const [sitesDisplayMode, setSitesDisplayMode] = useState<SitesDisplayMode>("total");
  const [sessionsDisplayMode, setSessionsDisplayMode] = useState<SessionsDisplayMode>("total");
  const [durationDisplayMode, setDurationDisplayMode] = useState<DurationDisplayMode>("perSession");
  const [apptsDisplayMode, setApptsDisplayMode] = useState<ApptsDisplayMode>("perSession");
  
  const currentCapacity = season === "winter" ? capacityData.winter : capacityData.nonWinter;
  const totalWeeklySessions = sessionData.reduce((sum, row) => sum + row.total, 0);
  const multiplier = viewMode === "appointments" ? 12 : 1;
  const unitLabel = viewMode === "appointments" ? "appointments" : "sessions";

  // Badge display calculations
  const getBadgeDisplay = () => {
    const baseTotal = totalWeeklySessions;
    const winterSessions = Math.round(baseTotal * 1.2); // 20% more in winter
    const nonWinterSessions = baseTotal;
    const onsiteSessions = baseTotal; // All matrix sessions are on-site
    const remoteSessions = Math.round(baseTotal * 0.5); // 50% remote capacity
    
    switch (badgeDisplayMode) {
      case "winter":
        return { value: winterSessions * multiplier, label: `Winter ${unitLabel}/Week` };
      case "nonWinter":
        return { value: nonWinterSessions * multiplier, label: `Non-Winter ${unitLabel}/Week` };
      case "onsite":
        return { value: onsiteSessions * multiplier, label: `On-Site ${unitLabel}/Week` };
      case "remote":
        return { value: remoteSessions * multiplier, label: `Remote ${unitLabel}/Week` };
      default:
        return { value: baseTotal * multiplier, label: `Total ${unitLabel}/Week` };
    }
  };

  const badgeDisplay = getBadgeDisplay();
  
  const cycleBadgeMode = () => {
    const modes: BadgeDisplayMode[] = ["total", "winter", "nonWinter", "onsite", "remote"];
    const currentIndex = modes.indexOf(badgeDisplayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setBadgeDisplayMode(modes[nextIndex]);
  };

  // Top banner cycling functions
  const cycleSitesMode = () => {
    const modes: SitesDisplayMode[] = ["total", "hub", "spoke", "tbc"];
    const currentIndex = modes.indexOf(sitesDisplayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setSitesDisplayMode(modes[nextIndex]);
  };

  const cycleSessionsMode = () => {
    const modes: SessionsDisplayMode[] = ["total", "winter", "nonWinter", "onsite", "remote"];
    const currentIndex = modes.indexOf(sessionsDisplayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setSessionsDisplayMode(modes[nextIndex]);
  };

  const cycleDurationMode = () => {
    const modes: DurationDisplayMode[] = ["perSession", "perDay", "perWeek"];
    const currentIndex = modes.indexOf(durationDisplayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setDurationDisplayMode(modes[nextIndex]);
  };

  const cycleApptsMode = () => {
    const modes: ApptsDisplayMode[] = ["perSession", "perDay"];
    const currentIndex = modes.indexOf(apptsDisplayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setApptsDisplayMode(modes[nextIndex]);
  };

  // Top banner display values
  const getSitesDisplay = () => {
    const hubCount = practiceSummary.filter(p => p.role === "HUB").length;
    const spokeCount = practiceSummary.filter(p => p.role === "SPOKE").length;
    const tbcCount = practiceSummary.filter(p => p.role === "TBC").length;
    
    switch (sitesDisplayMode) {
      case "hub": return { value: hubCount, label: "Hub Sites" };
      case "spoke": return { value: spokeCount, label: "Spoke Sites" };
      case "tbc": return { value: tbcCount, label: "TBC Sites" };
      default: return { value: 7, label: "Practice Sites" };
    }
  };

  const getSessionsDisplay = () => {
    const onsiteSessions = Math.round(currentCapacity.f2fRequired);
    const remoteSessions = Math.round(currentCapacity.remoteRequired);
    const totalSessions = Math.round(currentCapacity.sessionsPerWeek);
    const winterOnsite = Math.round(capacityData.winter.f2fRequired);
    const winterRemote = Math.round(capacityData.winter.remoteRequired);
    const winterTotal = Math.round(capacityData.winter.sessionsPerWeek);
    
    switch (sessionsDisplayMode) {
      case "winter": return { value: `${winterOnsite} + ${winterRemote}`, label: "On-Site + Remote/Week", sublabel: `(${winterTotal} Total - Winter)` };
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
      case "perHour": return { value: "2.9", label: "Appts/Hour" };
      case "perDay": return { value: "24", label: "Appts/Day" };
      default: return { value: "12", label: "Appts/Session" };
    }
  };

  const sitesDisplay = getSitesDisplay();
  const sessionsDisplay = getSessionsDisplay();
  const durationDisplay = getDurationDisplay();
  const apptsDisplay = getApptsDisplay();

  const togglePracticeSort = (field: PracticeSortField) => {
    if (practiceSortField === field) {
      setPracticeSortDirection(practiceSortDirection === "asc" ? "desc" : "asc");
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
    const withCalculatedValues = practiceSummary.map(practice => {
      const percentage = (practice.listSize / totalListSize) * 100;
      const practiceSessionsNeeded = currentCapacity.sessionsPerWeek * (practice.listSize / totalListSize);
      const displayValue = viewMode === "appointments" ? practiceSessionsNeeded * 12 : practiceSessionsNeeded;
      return {
        ...practice,
        percentage,
        sessionsWeek: displayValue,
        f2f: displayValue / 2,
        remote: displayValue / 2
      };
    });

    return [...withCalculatedValues].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (practiceSortField) {
        case "practice":
          aVal = a.practice.toLowerCase();
          bVal = b.practice.toLowerCase();
          break;
        case "listSize":
          aVal = a.listSize;
          bVal = b.listSize;
          break;
        case "percentage":
          aVal = a.percentage;
          bVal = b.percentage;
          break;
        case "sessionsWeek":
          aVal = a.sessionsWeek;
          bVal = b.sessionsWeek;
          break;
        case "f2f":
          aVal = a.f2f;
          bVal = b.f2f;
          break;
        case "remote":
          aVal = a.remote;
          bVal = b.remote;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return practiceSortDirection === "asc" 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      return practiceSortDirection === "asc" 
        ? (aVal as number) - (bVal as number) 
        : (bVal as number) - (aVal as number);
    });
  }, [practiceSortField, practiceSortDirection, currentCapacity.sessionsPerWeek, viewMode]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={cycleSitesMode}
        >
          <CardContent className="p-4 text-center">
            <Building2 className="w-6 h-6 text-[#005EB8] mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{sitesDisplay.value}</p>
            <p className="text-sm text-slate-600">{sitesDisplay.label}</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={cycleSessionsMode}
        >
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{sessionsDisplay.value}</p>
            <p className="text-sm text-slate-600">{sessionsDisplay.label}</p>
            {sessionsDisplay.sublabel && (
              <p className="text-xs text-green-700 font-medium mt-1">{sessionsDisplay.sublabel}</p>
            )}
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={cycleDurationMode}
        >
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{durationDisplay.value}</p>
            <p className="text-sm text-slate-600">{durationDisplay.label}</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-amber-50 to-amber-100 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={cycleApptsMode}
        >
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-900">{apptsDisplay.value}</p>
            <p className="text-sm text-slate-600">{apptsDisplay.label}</p>
          </CardContent>
        </Card>
      </div>

      {/* Session Availability Matrix */}
      <CollapsibleCard
        title="Room Availability Matrix"
        icon={<Calendar className="w-5 h-5" />}
        badge={
          <button
            onClick={cycleBadgeMode}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {badgeDisplay.value} {badgeDisplay.label}
            </Badge>
          </button>
        }
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">Available clinical rooms by day and session</p>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("sessions")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === "sessions" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setViewMode("appointments")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === "appointments" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Appointments
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Session</TableHead>
                <TableHead className="text-center font-semibold">
                  <div>The Parks</div>
                  <div className="text-xs font-normal text-slate-400">4 sites</div>
                </TableHead>
                <TableHead className="text-center font-semibold">Springfield</TableHead>
                <TableHead className="text-center font-semibold">Brackley</TableHead>
                <TableHead className="text-center font-semibold">Brook</TableHead>
                <TableHead className="text-center font-semibold">Bugbrooke</TableHead>
                <TableHead className="text-center font-semibold">Denton</TableHead>
                <TableHead className="text-center font-semibold">Towcester</TableHead>
                <TableHead className="text-center font-semibold bg-slate-100">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionData.map((row, index) => {
                const mult = viewMode === "appointments" ? 12 : 1;
                return (
                  <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <TableCell className="font-medium">{row.session}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.theParks)}`}>{row.theParks * mult}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.springfield)}`}>{row.springfield * mult}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.brackley)}`}>{row.brackley * mult}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.brook)}`}>{row.brook * mult}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.bugbrooke)}`}>{row.bugbrooke * mult}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.denton)}`}>{row.denton * mult}</TableCell>
                    <TableCell className={`text-center font-semibold ${getCellColor(row.towcester)}`}>{row.towcester * mult}</TableCell>
                    <TableCell className="text-center font-bold bg-slate-100">{row.total * mult}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-slate-100 font-bold">
                <TableCell>Weekly Total</TableCell>
                <TableCell className="text-center">{29 * (viewMode === "appointments" ? 12 : 1)}</TableCell>
                <TableCell className="text-center">{10 * (viewMode === "appointments" ? 12 : 1)}</TableCell>
                <TableCell className="text-center">{20 * (viewMode === "appointments" ? 12 : 1)}</TableCell>
                <TableCell className="text-center">{10 * (viewMode === "appointments" ? 12 : 1)}</TableCell>
                <TableCell className="text-center">{10 * (viewMode === "appointments" ? 12 : 1)}</TableCell>
                <TableCell className="text-center">{3 * (viewMode === "appointments" ? 12 : 1)}</TableCell>
                <TableCell className="text-center">{17 * (viewMode === "appointments" ? 12 : 1)}</TableCell>
                <TableCell className="text-center bg-[#005EB8] text-white">{totalWeeklySessions * (viewMode === "appointments" ? 12 : 1)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CollapsibleCard>

      {/* Practice Summary */}
      <CollapsibleCard
        title="Practice Estate Summary"
        icon={<Building2 className="w-5 h-5" />}
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {totalWeeklySessions * multiplier} Total On-Site {viewMode === "appointments" ? "Appts" : "Sessions"}
            </Badge>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
              {Math.max(0, Math.round(currentCapacity.sessionsPerWeek) - totalWeeklySessions) * multiplier} Remote {viewMode === "appointments" ? "Appts" : "Sessions"}
            </Badge>
          </div>
        }
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">Weekly on-site session availability by practice</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setSeason("nonWinter")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                  season === "nonWinter" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sun className="w-3 h-3" />
                Non-Winter
              </button>
              <button
                onClick={() => setSeason("winter")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                  season === "winter" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Snowflake className="w-3 h-3" />
                Winter
              </button>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("sessions")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "sessions" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sessions
              </button>
              <button
                onClick={() => setViewMode("appointments")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "appointments" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Appointments
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {practiceSummary.map((practice, index) => {
            const displayValue = viewMode === "appointments" 
              ? practice.totalSessions * 12 
              : practice.totalSessions;
            const displayUnit = viewMode === "appointments" 
              ? "appts/week (on-site)" 
              : "sessions/week (on-site)";
            
            return (
              <div 
                key={index} 
                className={`rounded-xl p-4 border ${
                  practice.role === "HUB" 
                    ? "bg-blue-50 border-blue-200" 
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">{practice.practice}</h4>
                    {practice.subPractices && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {practice.subPractices.join(", ")}
                      </p>
                    )}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      practice.role === "HUB" 
                        ? "bg-[#005EB8] text-white border-[#005EB8]" 
                        : "bg-slate-200 text-slate-700 border-slate-300"
                    }
                  >
                    {practice.role}
                  </Badge>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{displayValue}</p>
                    <p className="text-xs text-slate-500">{displayUnit}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {practice.system}
                  </Badge>
                </div>
                {practice.note && (
                  <p className="text-xs text-amber-600 mt-2 italic">{practice.note}</p>
                )}
              </div>
            );
          })}
          
          {/* Remote Sessions Balance Box */}
          {(() => {
            const totalOnsiteSessions = practiceSummary.reduce((sum, p) => sum + p.totalSessions, 0);
            const totalRequired = Math.round(currentCapacity.sessionsPerWeek);
            const remoteBalance = Math.max(0, totalRequired - totalOnsiteSessions);
            const remoteBalanceAppts = remoteBalance * 12;
            
            return (
              <div className="rounded-xl p-4 border bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-indigo-900">Remote Sessions</h4>
                    <p className="text-xs text-indigo-600 mt-0.5">
                      Balance after on-site capacity
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="bg-indigo-100 text-indigo-700 border-indigo-300"
                  >
                    REMOTE
                  </Badge>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-indigo-900">
                      {viewMode === "appointments" ? remoteBalanceAppts : remoteBalance}
                    </p>
                    <p className="text-xs text-indigo-600">
                      {viewMode === "appointments" ? "appts/week (remote)" : "sessions/week (remote)"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200">
                    {season === "winter" ? "Winter" : "Non-Winter"}
                  </Badge>
                </div>
                <p className="text-xs text-indigo-500 mt-2 italic">
                  {totalRequired} required − {totalOnsiteSessions} on-site = {remoteBalance} remote
                </p>
              </div>
            );
          })()}
        </div>
      </CollapsibleCard>

      {/* Capacity Planning */}
      <CollapsibleCard
        title="Capacity Planning"
        icon={<LayoutGrid className="w-5 h-5" />}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <p className="text-sm text-slate-500">
            {viewMode === "appointments" 
              ? "Showing appointments (1 session = 12 appointments)" 
              : "Capacity requirements by season"}
          </p>
          <div className="flex flex-wrap gap-2">
            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode("sessions")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "sessions" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Sessions
              </button>
              <button 
                onClick={() => setViewMode("appointments")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "appointments" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Appointments
              </button>
            </div>
            
            {/* Season Toggle */}
            <div className="flex gap-1">
              <button 
                onClick={() => setSeason("nonWinter")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  season === "nonWinter" 
                    ? "bg-amber-500 text-white" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Sun className="w-4 h-4" />
                Non-Winter
              </button>
              <button 
                onClick={() => setSeason("winter")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  season === "winter" 
                    ? "bg-blue-500 text-white" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Snowflake className="w-4 h-4" />
                Winter
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
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-500">Appointments/Week</p>
            <p className="text-xl font-bold text-slate-900">{currentCapacity.apptsPerWeek.toLocaleString()}</p>
            <p className="text-xs text-slate-400">required</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-500 capitalize">{unitLabel}/Week</p>
            <p className="text-xl font-bold text-slate-900">
              {viewMode === "appointments" 
                ? Math.round(currentCapacity.sessionsPerWeek * 12).toLocaleString()
                : currentCapacity.sessionsPerWeek
              }
            </p>
            <p className="text-xs text-slate-400">total needed</p>
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
              {viewMode === "appointments" 
                ? Math.round(currentCapacity.f2fRequired * 12).toLocaleString()
                : currentCapacity.f2fRequired
              }
            </p>
            <p className="text-sm text-green-600">{unitLabel} per week (50% split)</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">
              Remote {viewMode === "appointments" ? "Appointments" : "Sessions"} Required
            </h4>
            <p className="text-3xl font-bold text-blue-700">
              {viewMode === "appointments" 
                ? Math.round(currentCapacity.remoteRequired * 12).toLocaleString()
                : currentCapacity.remoteRequired
              }
            </p>
            <p className="text-sm text-blue-600">{unitLabel} per week (50% split)</p>
          </div>
        </div>

        {/* Practice Breakdown by List Size */}
        <div className="mt-6">
          <h4 className="font-semibold text-slate-900 mb-3">
            {viewMode === "appointments" ? "Appointments" : "Sessions"} Required by Practice (Based on List Size)
          </h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => togglePracticeSort("practice")}
                  >
                    <div className="flex items-center">
                      Practice
                      {getSortIcon("practice")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => togglePracticeSort("listSize")}
                  >
                    <div className="flex items-center justify-end">
                      List Size
                      {getSortIcon("listSize")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => togglePracticeSort("percentage")}
                  >
                    <div className="flex items-center justify-end">
                      % of Total
                      {getSortIcon("percentage")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => togglePracticeSort("sessionsWeek")}
                  >
                    <div className="flex items-center justify-end">
                      {viewMode === "appointments" ? "Appts" : "Sessions"}/Week
                      {getSortIcon("sessionsWeek")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => togglePracticeSort("f2f")}
                  >
                    <div className="flex items-center justify-end">
                      F2F (50%)
                      {getSortIcon("f2f")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => togglePracticeSort("remote")}
                  >
                    <div className="flex items-center justify-end">
                      Remote (50%)
                      {getSortIcon("remote")}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPracticeSummary.map((practice, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {practice.practice}
                      {practice.subPractices && (
                        <span className="text-xs text-slate-400 ml-1">({practice.subPractices.length} sites)</span>
                      )}
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
                      ? Math.round(currentCapacity.sessionsPerWeek * 12).toLocaleString()
                      : currentCapacity.sessionsPerWeek
                    }
                  </TableCell>
                  <TableCell className="text-right text-green-700">
                    {viewMode === "appointments" 
                      ? Math.round(currentCapacity.f2fRequired * 12).toLocaleString()
                      : currentCapacity.f2fRequired
                    }
                  </TableCell>
                  <TableCell className="text-right text-blue-700">
                    {viewMode === "appointments" 
                      ? Math.round(currentCapacity.remoteRequired * 12).toLocaleString()
                      : currentCapacity.remoteRequired
                    }
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> 1 session = 12 × 15 min appointments (F2F and Virtual). Initially 15 mins for virtual appointments but the board may change to 10 mins at a later date.
          </p>
        </div>
      </CollapsibleCard>

      {/* Hub Location Status */}
      <CollapsibleCard
        title="Hub Location Status"
        icon={<Building2 className="w-5 h-5" />}
        badge={<span className="text-xs text-slate-500 font-normal">Updated: 27 Jan 2026</span>}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">In Progress - Awaiting Funding confirmation of Non GMS Space</Badge>
            <span className="font-medium text-slate-900">Brackley Medical Centre</span>
            <span className="text-slate-600 text-sm">- Hub Location</span>
          </div>
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 cursor-help">In Progress - Awaiting NHFT/Funding Arrangements to be in place</Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md p-3 text-left">
                  <p className="text-sm"><strong>NHFT remains the tenant</strong> of the physio suite under its existing premises lease.</p>
                  <p className="text-sm mt-2">The landlord, Dr Supple, is <strong>content for NHFT to sublet or permit use of the room</strong> for the purposes of the Neighbourhood Access Service, via a sub-letting or permitted-use arrangement.</p>
                  <p className="text-sm mt-2">This confirms <strong>no change to the underlying tenancy or landlord arrangements</strong>, with NAS utilising the space under NHFT's occupancy.</p>
                  <p className="text-xs text-muted-foreground mt-2 italic">Source: Anita Carter (on behalf of Dr Supple), 23 Jan 2026</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="font-medium text-slate-900">Brook Health Centre</span>
            <span className="text-slate-600 text-sm">- Hub Location</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-green-100 text-green-800 border-green-300">Confirmed</Badge>
            <span className="font-medium text-slate-900">The Parks</span>
            <span className="text-slate-600 text-sm">- Hub Location</span>
          </div>
        </div>
      </CollapsibleCard>

      {/* Notes */}
      <CollapsibleCard
        title="Important Notes"
        icon={<MapPin className="w-5 h-5" />}
      >
        <div className="space-y-6">
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
              <span><strong>Brackley Medical Centre & Brook Health Centre:</strong> Non-GMS space requires rent. Awaiting confirmation on the rent request for the duration of the New Models pilot (as at 22 Jan 2026).</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
              <strong>Denton Village:</strong> Available Tuesday or Friday full day and afternoon on Thursday
            </li>
            <li className="flex items-start gap-2 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></span>
              <strong>The Parks:</strong> Combined availability from Roade, Blisworth, Grange Park and Hanslope
            </li>
          </ul>

          {/* Travel Times Analysis Section */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              Travel Times Analysis
            </h4>
            <p className="text-sm text-slate-600 mb-3">
              Comprehensive drive time mapping supporting strategic planning for the SDA Pilot Programme.
            </p>
            <div className="max-w-xs">
              <TravelTimesThumbnail onClick={() => setTravelTimesModalOpen(true)} />
            </div>
          </div>
        </div>
      </CollapsibleCard>

      <TravelTimesSlideshow 
        isOpen={travelTimesModalOpen} 
        onClose={() => setTravelTimesModalOpen(false)} 
      />
    </div>
  );
};
