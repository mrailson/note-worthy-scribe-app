import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, MapPin, Sun, Snowflake, Building2, Clock, Users, Calendar, LayoutGrid, CalendarDays, CalendarRange, ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Info, Pencil, Save, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { PracticeDetailModal } from "./PracticeDetailModal";
import { TravelTimesThumbnail, TravelTimesSlideshow } from "./TravelTimesSlideshow";
import { useEstatesConfig, RoomRow, PRACTICE_KEYS, PracticeKey } from "@/hooks/useEstatesConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';

type PracticeSortField = "practice" | "listSize" | "percentage" | "sessionsWeek" | "f2f" | "remote";
type SortDirection = "asc" | "desc";
type BadgeDisplayMode = "total" | "winter" | "nonWinter" | "onsite" | "remote";
type SitesDisplayMode = "total" | "hub" | "spoke" | "tbc";
type SessionsDisplayMode = "total" | "winter" | "nonWinter" | "onsite" | "remote";
type Season = "nonWinter" | "winter" | "total";
type DurationDisplayMode = "perSession" | "perDay" | "perWeek";
type ApptsDisplayMode = "perSession" | "perHour" | "perDay";

// Practice summary data with list sizes (matching Executive Summary population data)
const practiceSummary = [
  { 
    practice: "The Parks MC", 
    subPractices: ["Roade", "Blisworth", "Grange Park", "Hanslope"],
    listSize: 22827,
    role: "HUB",
    system: "SystmOne",
    key: "theParks" as PracticeKey,
  },
  { practice: "Brackley MC", listSize: 16212, role: "HUB", system: "SystmOne", key: "brackley" as PracticeKey },
  { practice: "Springfield", listSize: 12611, role: "SPOKE", system: "EMIS", key: "springfield" as PracticeKey },
  { practice: "Towcester MC", listSize: 11748, role: "SPOKE", system: "EMIS", key: "towcester" as PracticeKey },
  { practice: "Bugbrooke", listSize: 10788, role: "SPOKE", system: "SystmOne", key: "bugbrooke" as PracticeKey },
  { practice: "Brook Health", listSize: 9069, role: "TBC", system: "SystmOne", key: "brook" as PracticeKey },
  { practice: "Denton Village", listSize: 6329, role: "SPOKE", system: "SystmOne", key: "denton" as PracticeKey },
];

const totalListSize = practiceSummary.reduce((sum, p) => sum + p.listSize, 0);

const getCellColor = (value: number) => {
  if (value === 0) return "bg-red-100 text-red-700";
  if (value >= 3) return "bg-green-100 text-green-700";
  return "bg-amber-50 text-amber-700";
};

export const SDAEstatesCapacity = () => {
  const { user, isSystemAdmin } = useAuth();
  const canEditEstates = isSystemAdmin || (user?.email && NRES_ADMIN_EMAILS.includes(user.email));
  const { roomData, f2fSplitPct, updatedAt, isLoading, updateConfig } = useEstatesConfig();

  const [isEditing, setIsEditing] = useState(false);
  const [editRoomData, setEditRoomData] = useState<RoomRow[]>([]);
  const [editF2fSplit, setEditF2fSplit] = useState(50);
  const [isSaving, setIsSaving] = useState(false);

  const [season, setSeason] = useState<Season>("winter");
  const [viewMode, setViewMode] = useState<"sessions" | "appointments">("sessions");
  const [practiceSortField, setPracticeSortField] = useState<PracticeSortField>("listSize");
  const [practiceSortDirection, setPracticeSortDirection] = useState<SortDirection>("desc");
  const [badgeDisplayMode, setBadgeDisplayMode] = useState<BadgeDisplayMode>("total");
  const [travelTimesModalOpen, setTravelTimesModalOpen] = useState(false);
  const [listSizeOpen, setListSizeOpen] = useState(true);
  const [selectedPracticeIndex, setSelectedPracticeIndex] = useState<number | null>(null);
  const [appointmentsOpen, setAppointmentsOpen] = useState(true);
  
  const [sitesDisplayMode, setSitesDisplayMode] = useState<SitesDisplayMode>("total");
  const [sessionsDisplayMode, setSessionsDisplayMode] = useState<SessionsDisplayMode>("total");
  const [durationDisplayMode, setDurationDisplayMode] = useState<DurationDisplayMode>("perSession");
  const [apptsDisplayMode, setApptsDisplayMode] = useState<ApptsDisplayMode>("perSession");

  // Use the active data source (edit draft or saved)
  const activeRoomData = isEditing ? editRoomData : roomData;
  const activeSplit = isEditing ? editF2fSplit : f2fSplitPct;
  const remoteSplitPct = 100 - activeSplit;

  // Compute totals from room data
  const sessionDataWithTotals = useMemo(() => {
    return activeRoomData.map(row => ({
      ...row,
      total: PRACTICE_KEYS.reduce((sum, key) => sum + (row[key] || 0), 0),
    }));
  }, [activeRoomData]);

  // Compute practice column totals
  const practiceColumnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    PRACTICE_KEYS.forEach(key => {
      totals[key] = activeRoomData.reduce((sum, row) => sum + (row[key] || 0), 0);
    });
    return totals;
  }, [activeRoomData]);

  // Practice summary with dynamic totalSessions from room data
  const practiceSummaryWithSessions = useMemo(() => {
    return practiceSummary.map(p => ({
      ...p,
      totalSessions: practiceColumnTotals[p.key] || 0,
    }));
  }, [practiceColumnTotals]);

  const totalWeeklySessions = sessionDataWithTotals.reduce((sum, row) => sum + row.total, 0);

  // Capacity data derived from split
  const capacityData = useMemo(() => ({
    nonWinter: {
      rate: "15.2 per 1,000",
      weeks: 39,
      apptsPerWeek: 1362,
      sessionsPerWeek: 113.5,
      sessionLength: "4h 10m",
      f2fRequired: 113.5 * (activeSplit / 100),
      remoteRequired: 113.5 * (remoteSplitPct / 100),
    },
    winter: {
      rate: "18.2 per 1,000",
      weeks: 13,
      apptsPerWeek: 1630,
      sessionsPerWeek: 135.9,
      sessionLength: "4h 10m",
      f2fRequired: 135.9 * (activeSplit / 100),
      remoteRequired: 135.9 * (remoteSplitPct / 100),
    },
  }), [activeSplit, remoteSplitPct]);

  const totalCapacity = useMemo(() => ({
    rate: "15.2–18.2 per 1,000",
    weeks: 52,
    annualAppts: 74301,
    apptsPerWeek: Math.round(74301 / 52),
    sessionsPerWeek: Math.round(74301 / 52 / 12 * 10) / 10,
    sessionLength: "4h 10m",
    f2fRequired: Math.round(74301 / 52 / 12 * (activeSplit / 100) * 10) / 10,
    remoteRequired: Math.round(74301 / 52 / 12 * (remoteSplitPct / 100) * 10) / 10,
  }), [activeSplit, remoteSplitPct]);

  const currentCapacity = season === "winter" 
    ? capacityData.winter 
    : season === "total" 
      ? totalCapacity 
      : capacityData.nonWinter;

  const multiplier = viewMode === "appointments" ? 12 : 1;
  const unitLabel = viewMode === "appointments" ? "appointments" : "sessions";

  // Practice capacity breakdown (dynamic)
  const practiceCapacityData = useMemo(() => {
    return practiceSummaryWithSessions.map(p => {
      const pct = Math.round((p.listSize / totalListSize) * 1000) / 10;
      const monthly = Math.round((p.listSize * 26.33) / 12 * 100) / 100;
      const budget75 = Math.round(monthly * 9);
      const wklyNonWinter = Math.round(capacityData.nonWinter.apptsPerWeek * (p.listSize / totalListSize) * 10) / 10;
      const wklyWinter = Math.round(capacityData.winter.apptsPerWeek * (p.listSize / totalListSize) * 10) / 10;
      const annualTarget = Math.round(74301 * (p.listSize / totalListSize));
      return {
        practice: p.practice,
        listSize: p.listSize,
        role: p.role,
        system: p.system,
        pct,
        monthly,
        budget75,
        wklyNonWinter,
        f2fNW: Math.round(wklyNonWinter * (activeSplit / 100) * 10) / 10,
        remoteNW: Math.round(wklyNonWinter * (remoteSplitPct / 100) * 10) / 10,
        wklyWinter,
        f2fW: Math.round(wklyWinter * (activeSplit / 100) * 10) / 10,
        remoteW: Math.round(wklyWinter * (remoteSplitPct / 100) * 10) / 10,
        annualTarget,
      };
    });
  }, [practiceSummaryWithSessions, capacityData, activeSplit, remoteSplitPct]);

  // Edit handlers
  const startEditing = () => {
    setEditRoomData(JSON.parse(JSON.stringify(roomData)));
    setEditF2fSplit(f2fSplitPct);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditRoomData([]);
    setEditF2fSplit(50);
  };

  const handleCellChange = (rowIndex: number, key: PracticeKey, value: string) => {
    const num = parseInt(value, 10);
    if (value !== '' && (isNaN(num) || num < 0)) return;
    setEditRoomData(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [key]: value === '' ? 0 : num };
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateConfig(editRoomData, editF2fSplit);
    setIsSaving(false);
    if (success) {
      setIsEditing(false);
    }
  };

  // Badge display calculations
  const getBadgeDisplay = () => {
    const baseTotal = totalWeeklySessions;
    const winterSessions = Math.round(baseTotal * 1.2);
    const nonWinterSessions = baseTotal;
    const onsiteSessions = baseTotal;
    const remoteSessions = Math.round(baseTotal * (remoteSplitPct / 100));
    
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
    setBadgeDisplayMode(modes[(currentIndex + 1) % modes.length]);
  };

  const cycleSitesMode = () => {
    const modes: SitesDisplayMode[] = ["total", "hub", "spoke", "tbc"];
    const currentIndex = modes.indexOf(sitesDisplayMode);
    setSitesDisplayMode(modes[(currentIndex + 1) % modes.length]);
  };

  const cycleSessionsMode = () => {
    const modes: SessionsDisplayMode[] = ["total", "winter", "nonWinter", "onsite", "remote"];
    const currentIndex = modes.indexOf(sessionsDisplayMode);
    setSessionsDisplayMode(modes[(currentIndex + 1) % modes.length]);
  };

  const cycleDurationMode = () => {
    const modes: DurationDisplayMode[] = ["perSession", "perDay", "perWeek"];
    const currentIndex = modes.indexOf(durationDisplayMode);
    setDurationDisplayMode(modes[(currentIndex + 1) % modes.length]);
  };

  const cycleApptsMode = () => {
    const modes: ApptsDisplayMode[] = ["perSession", "perDay"];
    const currentIndex = modes.indexOf(apptsDisplayMode);
    setApptsDisplayMode(modes[(currentIndex + 1) % modes.length]);
  };

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
        f2f: displayValue * (activeSplit / 100),
        remote: displayValue * (remoteSplitPct / 100),
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
  }, [practiceSortField, practiceSortDirection, currentCapacity.sessionsPerWeek, viewMode, activeSplit, remoteSplitPct]);

  // Footer totals for practice capacity breakdown
  const footerTotals = useMemo(() => {
    const totalMonthly = practiceCapacityData.reduce((s, p) => s + p.monthly, 0);
    const totalBudget = practiceCapacityData.reduce((s, p) => s + p.budget75, 0);
    const totalNW = practiceCapacityData.reduce((s, p) => s + p.wklyNonWinter, 0);
    const totalF2fNW = practiceCapacityData.reduce((s, p) => s + p.f2fNW, 0);
    const totalRemoteNW = practiceCapacityData.reduce((s, p) => s + p.remoteNW, 0);
    const totalW = practiceCapacityData.reduce((s, p) => s + p.wklyWinter, 0);
    const totalF2fW = practiceCapacityData.reduce((s, p) => s + p.f2fW, 0);
    const totalRemoteW = practiceCapacityData.reduce((s, p) => s + p.remoteW, 0);
    const totalAnnual = practiceCapacityData.reduce((s, p) => s + p.annualTarget, 0);
    return { totalMonthly, totalBudget, totalNW, totalF2fNW, totalRemoteNW, totalW, totalF2fW, totalRemoteW, totalAnnual };
  }, [practiceCapacityData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Edit Controls */}
      {canEditEstates && (
        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <>
              {/* F2F Split Control */}
              <div className="flex items-center gap-3 mr-4 bg-slate-50 rounded-lg px-4 py-2 border">
                <span className="text-sm font-medium text-slate-700 whitespace-nowrap">F2F / Remote Split:</span>
                <Slider
                  value={[editF2fSplit]}
                  onValueChange={(v) => setEditF2fSplit(v[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-32"
                />
                <span className="text-sm font-bold text-green-700 whitespace-nowrap">{editF2fSplit}%</span>
                <span className="text-sm text-slate-400">/</span>
                <span className="text-sm font-bold text-blue-700 whitespace-nowrap">{100 - editF2fSplit}%</span>
              </div>
              <Button size="sm" variant="outline" onClick={cancelEditing} disabled={isSaving}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Pencil className="w-4 h-4 mr-1" />
              Edit Data
            </Button>
          )}
        </div>
      )}

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
                <TableHead className="text-center font-semibold">Brackley</TableHead>
                <TableHead className="text-center font-semibold">Springfield</TableHead>
                <TableHead className="text-center font-semibold">Towcester</TableHead>
                <TableHead className="text-center font-semibold">Bugbrooke</TableHead>
                <TableHead className="text-center font-semibold">Brook</TableHead>
                <TableHead className="text-center font-semibold">Denton</TableHead>
                <TableHead className="text-center font-semibold bg-slate-100">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionDataWithTotals.map((row, index) => {
                const mult = viewMode === "appointments" ? 12 : 1;
                return (
                  <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <TableCell className="font-medium">{row.session}</TableCell>
                    {PRACTICE_KEYS.map(key => (
                      <TableCell key={key} className={`text-center font-semibold ${getCellColor(row[key])}`}>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={row[key]}
                            onChange={(e) => handleCellChange(index, key, e.target.value)}
                            className="w-12 h-7 text-center rounded border border-slate-300 bg-white/80 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        ) : (
                          row[key] * mult
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-slate-100">
                      {isEditing ? row.total : row.total * mult}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-slate-100 font-bold">
                <TableCell>Weekly Total</TableCell>
                {PRACTICE_KEYS.map(key => (
                  <TableCell key={key} className="text-center">
                    {practiceColumnTotals[key] * (viewMode === "appointments" && !isEditing ? 12 : 1)}
                  </TableCell>
                ))}
                <TableCell className="text-center bg-[#005EB8] text-white">
                  {totalWeeklySessions * (viewMode === "appointments" && !isEditing ? 12 : 1)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {updatedAt && (
          <p className="text-xs text-slate-400 mt-2">
            Last updated: {new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </CollapsibleCard>

      {/* Practice Summary */}
      <CollapsibleCard
        title="Practice Estates and Capacity Summary"
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
              <button
                onClick={() => setSeason("total")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                  season === "total" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarRange className="w-3 h-3" />
                Combined
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
          {practiceSummaryWithSessions.map((practice, index) => {
            const multiplierVal = viewMode === "appointments" ? 12 : 1;
            const unitLabel = viewMode === "appointments" ? "appts/week" : "sessions/week";
            const totalRequired = currentCapacity.sessionsPerWeek * (practice.listSize / totalListSize);
            const f2fAvailable = practice.totalSessions;
            const remoteRequired = Math.max(0, totalRequired - f2fAvailable);
            
            return (
              <div 
                key={index} 
                className={`rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] ${
                  practice.role === "HUB" 
                    ? "bg-blue-50 border-blue-200" 
                    : "bg-slate-50 border-slate-200"
                }`}
                onClick={() => setSelectedPracticeIndex(index)}
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

                {/* Total Required */}
                <div className="mb-3 pb-2 border-b border-slate-200">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Required</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {(totalRequired * multiplierVal).toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-500">{unitLabel}</p>
                </div>

                {/* F2F / Remote split */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
                    <p className="text-xs font-medium text-green-700">F2F (On-Site)</p>
                    <p className="text-lg font-bold text-green-900">{f2fAvailable * multiplierVal}</p>
                    <p className="text-[10px] text-green-600">{unitLabel}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-2 text-center border border-indigo-200">
                    <p className="text-xs font-medium text-indigo-700">Remote</p>
                    <p className="text-lg font-bold text-indigo-900">{(remoteRequired * multiplierVal).toFixed(1)}</p>
                    <p className="text-[10px] text-indigo-600">{unitLabel}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <Badge variant="outline" className="text-xs">
                    {practice.system}
                  </Badge>
                </div>
                {'note' in practice && practice.note && (
                  <p className="text-xs text-amber-600 mt-1 italic">{String(practice.note)}</p>
                )}
              </div>
            );
          })}
          
          {/* Neighbourhood Totals Box */}
          {(() => {
            const totalOnsiteSessions = practiceSummaryWithSessions.reduce((sum, p) => sum + p.totalSessions, 0);
            const totalRequired = currentCapacity.sessionsPerWeek;
            const remoteBalance = Math.max(0, totalRequired - totalOnsiteSessions);
            const multiplierVal = viewMode === "appointments" ? 12 : 1;
            const unitLabel = viewMode === "appointments" ? "appts/week" : "sessions/week";
            
            return (
              <div className="rounded-xl p-4 border bg-gradient-to-br from-slate-100 to-blue-50 border-blue-300">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">Neighbourhood Total</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      All practices combined
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="bg-blue-100 text-blue-700 border-blue-300"
                  >
                    TOTAL
                  </Badge>
                </div>

                {/* Total Required */}
                <div className="mb-3 pb-2 border-b border-slate-200">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Required</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {(totalRequired * multiplierVal).toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-500">{unitLabel}</p>
                </div>

                {/* F2F / Remote split */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
                    <p className="text-xs font-medium text-green-700">F2F (On-Site)</p>
                    <p className="text-lg font-bold text-green-900">{totalOnsiteSessions * multiplierVal}</p>
                    <p className="text-[10px] text-green-600">{unitLabel}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-2 text-center border border-indigo-200">
                    <p className="text-xs font-medium text-indigo-700">Remote</p>
                    <p className="text-lg font-bold text-indigo-900">{(remoteBalance * multiplierVal).toFixed(1)}</p>
                    <p className="text-[10px] text-indigo-600">{unitLabel}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                    {season === "winter" ? "Winter" : season === "total" ? "Combined" : "Non-Winter"}
                  </Badge>
                </div>
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
            {/* Season Toggle */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setSeason("nonWinter")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  season === "nonWinter" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sun className="w-4 h-4" />
                Non-Winter
              </button>
              <button 
                onClick={() => setSeason("winter")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  season === "winter" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Snowflake className="w-4 h-4" />
                Winter
              </button>
              <button 
                onClick={() => setSeason("total")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  season === "total" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarRange className="w-4 h-4" />
                Combined
              </button>
            </div>

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
              {season === "total" 
                ? (74301).toLocaleString()
                : currentCapacity.apptsPerWeek.toLocaleString()
              }
            </p>
            <p className={`text-xs ${season === "total" ? "text-slate-400" : "text-slate-400"}`}>
              {season === "total" ? "combined average" : "required"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-500 capitalize">
              {season === "total" ? "Annual Sessions" : `${unitLabel}/Week`}
            </p>
            <p className="text-xl font-bold text-slate-900">
              {season === "total"
                ? Math.round(74301 / 12).toLocaleString()
                : viewMode === "appointments" 
                  ? Math.round(currentCapacity.sessionsPerWeek * 12).toLocaleString()
                  : currentCapacity.sessionsPerWeek
              }
            </p>
            <p className="text-xs text-slate-400">
              {season === "total" ? "combined average" : "total needed"}
            </p>
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
              Face-to-Face {season === "total" ? "Appointments" : viewMode === "appointments" ? "Appointments" : "Sessions"} Required
            </h4>
            <p className="text-3xl font-bold text-green-700">
              {season === "total"
                ? Math.round(74301 * (activeSplit / 100)).toLocaleString()
                : viewMode === "appointments" 
                  ? Math.round(currentCapacity.f2fRequired * 12).toLocaleString()
                  : currentCapacity.f2fRequired.toFixed(1)
              }
            </p>
            <p className="text-sm text-green-600">
              {season === "total" ? `appointments per year (${activeSplit}% split)` : `${unitLabel} per week (${activeSplit}% split)`}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">
              Remote {season === "total" ? "Appointments" : viewMode === "appointments" ? "Appointments" : "Sessions"} Required
            </h4>
            <p className="text-3xl font-bold text-blue-700">
              {season === "total"
                ? Math.round(74301 * (remoteSplitPct / 100)).toLocaleString()
                : viewMode === "appointments" 
                  ? Math.round(currentCapacity.remoteRequired * 12).toLocaleString()
                  : currentCapacity.remoteRequired.toFixed(1)
              }
            </p>
            <p className="text-sm text-blue-600">
              {season === "total" ? `appointments per year (${remoteSplitPct}% split)` : `${unitLabel} per week (${remoteSplitPct}% split)`}
            </p>
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
                      F2F ({activeSplit}%)
                      {getSortIcon("f2f")}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => togglePracticeSort("remote")}
                  >
                    <div className="flex items-center justify-end">
                      Remote ({remoteSplitPct}%)
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
                      : currentCapacity.f2fRequired.toFixed(1)
                    }
                  </TableCell>
                  <TableCell className="text-right text-blue-700">
                    {viewMode === "appointments" 
                      ? Math.round(currentCapacity.remoteRequired * 12).toLocaleString()
                      : currentCapacity.remoteRequired.toFixed(1)
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
        badge={<span className="text-xs text-slate-500 font-normal">Updated: 18 Feb 2026</span>}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-green-100 text-green-800 border-green-300">Confirmed</Badge>
            <span className="font-medium text-slate-900">Brackley Medical Centre</span>
            <span className="text-slate-600 text-sm">- Hub Location</span>
          </div>
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="bg-slate-100 text-slate-600 border-slate-300 cursor-help">Removed from Hub Status</Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md p-3 text-left">
                  <p className="text-sm">May be revisited in future depending on NHFT communications.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="font-medium text-slate-900">Brook Health Centre</span>
            <span className="text-slate-600 text-sm line-through">- Hub Location</span>
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
              <span><strong>Brackley Medical Centre:</strong> Non-GMS space has received confirmation on the rent request for the duration of the New Models pilot (as at 19 Feb 2026). <strong>Brook Health Centre</strong> has been removed from Hub Status — may be revisited depending on NHFT communications.</span>
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
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Travel Times Analysis
              </h4>
              <span className="text-xs text-muted-foreground">Updated: 18 Feb 2026</span>
            </div>
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

      {selectedPracticeIndex !== null && (
        <PracticeDetailModal
          open={selectedPracticeIndex !== null}
          onOpenChange={(open) => { if (!open) setSelectedPracticeIndex(null); }}
          practice={practiceSummaryWithSessions[selectedPracticeIndex]}
          totalListSize={totalListSize}
          capacityNonWinter={capacityData.nonWinter}
          capacityWinter={capacityData.winter}
          activeSplit={activeSplit}
          viewMode={viewMode}
          canEditRecruitment={!!canEditEstates}
        />
      )}
    </div>
  );
};
