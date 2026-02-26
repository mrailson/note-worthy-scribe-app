import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Building2, PoundSterling, Sun, Snowflake, SlidersHorizontal, Users, Pencil, Plus, Trash2, Save, X } from "lucide-react";
import { format } from "date-fns";
import { SystmOneIcon } from "@/components/icons/SystmOneIcon";
import { EmisIcon } from "@/components/icons/EmisIcon";
import { PracticeKey } from "@/hooks/useEstatesConfig";
import { useRecruitmentConfig } from "@/hooks/useRecruitmentConfig";
import { useAuth } from "@/contexts/AuthContext";
import { InfoTooltip } from "@/components/nres/InfoTooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getRecruitmentDataForPractice,
  calculatePracticeTotals,
  statusConfig,
  practiceKeyToRecruitmentId,
  type StaffMember,
  type RecruitmentPractice,
} from "@/data/nresRecruitmentData";

interface PracticeData {
  practice: string;
  subPractices?: string[];
  listSize: number;
  role: string;
  system: string;
  note?: string;
  key: PracticeKey;
  totalSessions: number;
}

interface CapacityData {
  rate: string;
  weeks: number;
  apptsPerWeek: number;
  sessionsPerWeek: number;
  sessionLength: string;
  f2fRequired: number;
  remoteRequired: number;
}

interface PracticeDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practice: PracticeData;
  totalListSize: number;
  capacityNonWinter: CapacityData;
  capacityWinter: CapacityData;
  activeSplit: number;
  viewMode: "sessions" | "appointments";
  canEditRecruitment: boolean;
}

const STATUS_OPTIONS: StaffMember["status"][] = ["recruited", "confirmed", "offered", "potential", "tbc", "outstanding"];

type WorkforceCategory = "gp" | "acp" | "buyBack";

const buildPracticeAuditEntries = (
  originalPractice: RecruitmentPractice,
  updatedPractice: RecruitmentPractice,
  userEmail: string,
  timestamp: string
) => {
  const entries: any[] = [];

  for (const category of ["gp", "acp", "buyBack"] as const) {
    const originalStaff = originalPractice.workforce[category] ?? [];
    const updatedStaff = updatedPractice.workforce[category] ?? [];
    const maxLen = Math.max(originalStaff.length, updatedStaff.length);

    for (let i = 0; i < maxLen; i++) {
      const before = originalStaff[i];
      const after = updatedStaff[i];

      if (!before && after) {
        entries.push({
          timestamp,
          user_email: userEmail,
          action: "Added",
          practice_name: updatedPractice.name,
          staff_name: after.name || `New ${category.toUpperCase()} staff`,
          field: "Staff",
          old_value: null,
          new_value: `${after.sessions} sessions, ${after.status}`,
        });
        continue;
      }

      if (before && !after) {
        entries.push({
          timestamp,
          user_email: userEmail,
          action: "Deleted",
          practice_name: originalPractice.name,
          staff_name: before.name,
          field: "Staff",
          old_value: `${before.sessions} sessions, ${before.status}`,
          new_value: null,
        });
        continue;
      }

      if (before && after) {
        const staffName = after.name || before.name || `Row ${i + 1}`;

        if (before.name !== after.name) {
          entries.push({
            timestamp,
            user_email: userEmail,
            action: "Edited",
            practice_name: updatedPractice.name,
            staff_name: staffName,
            field: "Name",
            old_value: before.name,
            new_value: after.name,
          });
        }
        if (before.sessions !== after.sessions) {
          entries.push({
            timestamp,
            user_email: userEmail,
            action: "Edited",
            practice_name: updatedPractice.name,
            staff_name: staffName,
            field: "Sessions",
            old_value: String(before.sessions),
            new_value: String(after.sessions),
          });
        }
        if (before.status !== after.status) {
          entries.push({
            timestamp,
            user_email: userEmail,
            action: "Edited",
            practice_name: updatedPractice.name,
            staff_name: staffName,
            field: "Status",
            old_value: before.status,
            new_value: after.status,
          });
        }
        if (before.type !== after.type) {
          entries.push({
            timestamp,
            user_email: userEmail,
            action: "Edited",
            practice_name: updatedPractice.name,
            staff_name: staffName,
            field: "Type",
            old_value: before.type,
            new_value: after.type,
          });
        }
        if ((before.notes || "") !== (after.notes || "")) {
          entries.push({
            timestamp,
            user_email: userEmail,
            action: "Edited",
            practice_name: updatedPractice.name,
            staff_name: staffName,
            field: "Notes",
            old_value: before.notes || "",
            new_value: after.notes || "",
          });
        }
      }
    }
  }

  return entries;
};

const RecruitmentStatusSection = ({
  practiceKey,
  canEditRecruitment,
}: {
  practiceKey: PracticeKey;
  canEditRecruitment: boolean;
}) => {
  const { user } = useAuth();
  const { practices, isLoading, updateConfig } = useRecruitmentConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftPractice, setDraftPractice] = useState<RecruitmentPractice | null>(null);

  const practiceId = practiceKeyToRecruitmentId[practiceKey];
  const livePractice = useMemo(
    () => practices.find((p) => p.id === practiceId) || getRecruitmentDataForPractice(practiceKey),
    [practiceId, practiceKey, practices]
  );

  const recruitmentData = isEditing ? draftPractice : livePractice;

  const updateStaffField = (
    category: WorkforceCategory,
    staffIdx: number,
    field: keyof StaffMember,
    value: string | number
  ) => {
    setDraftPractice((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as RecruitmentPractice;
      (next.workforce[category][staffIdx] as any)[field] = value;
      next.workforce[category][staffIdx].lastUpdated = new Date().toISOString();
      return next;
    });
  };

  const addStaff = (category: WorkforceCategory) => {
    setDraftPractice((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as RecruitmentPractice;
      next.workforce[category].push({
        name: "",
        sessions: 0,
        status: "outstanding",
        type: category === "buyBack" ? "Buy-Back" : "New Recruit",
        notes: "",
        lastUpdated: new Date().toISOString(),
      });
      return next;
    });
  };

  const deleteStaff = (category: WorkforceCategory, staffIdx: number) => {
    setDraftPractice((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as RecruitmentPractice;
      next.workforce[category].splice(staffIdx, 1);
      return next;
    });
  };

  const startEditing = () => {
    if (!livePractice) return;
    setDraftPractice(JSON.parse(JSON.stringify(livePractice)) as RecruitmentPractice);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setDraftPractice(null);
  };

  const saveChanges = async () => {
    if (!livePractice || !draftPractice || !user?.email) {
      toast.error("You must be logged in to save recruitment changes.");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const nextPractices = practices.map((p) => (p.id === draftPractice.id ? draftPractice : p));

      const auditEntries = buildPracticeAuditEntries(livePractice, draftPractice, user.email, now);
      if (auditEntries.length > 0) {
        const { error: auditError } = await supabase.from("nres_recruitment_audit" as any).insert(auditEntries as any);
        if (auditError) {
          console.error("Error writing modal recruitment audit entries:", auditError);
        }
      }

      const success = await updateConfig(nextPractices);
      if (success) {
        setIsEditing(false);
        setDraftPractice(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !recruitmentData) {
    return <p className="text-xs text-slate-500">Loading recruitment data…</p>;
  }

  if (!recruitmentData) return null;

  const totals = calculatePracticeTotals(recruitmentData, "combined");
  const filledPct = totals.required > 0 ? Math.min((totals.totalFilled / totals.required) * 100, 100) : 0;
  const pipelinePct = totals.required > 0 ? Math.min((totals.totalPipeline / totals.required) * 100, 100 - filledPct) : 0;
  const outstandingPct = totals.required > 0 ? Math.min((totals.totalOutstanding / totals.required) * 100, 100 - filledPct - pipelinePct) : 0;

  const EditableStaffRow = ({ staff, category, staffIdx }: { staff: StaffMember; category: WorkforceCategory; staffIdx: number }) => {
    const config = statusConfig[staff.status];

    return (
      <div className={`flex items-center gap-2 p-2 rounded-lg ${config.bgLight} ${config.border} border mb-1.5 text-sm`}>
        <input
          className="flex-1 min-w-0 px-2 py-1 text-xs border rounded bg-white"
          placeholder="Name"
          value={staff.name}
          onChange={(e) => updateStaffField(category, staffIdx, "name", e.target.value)}
        />
        <input
          className="w-14 px-2 py-1 text-xs border rounded bg-white text-center"
          type="number"
          min={0}
          value={staff.sessions}
          onChange={(e) => updateStaffField(category, staffIdx, "sessions", Number(e.target.value))}
        />
        <select
          className="px-2 py-1 text-xs border rounded bg-white"
          value={staff.status}
          onChange={(e) => updateStaffField(category, staffIdx, "status", e.target.value)}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {statusConfig[status].label}
            </option>
          ))}
        </select>
        <input
          className="w-20 px-2 py-1 text-xs border rounded bg-white"
          placeholder="Type"
          value={staff.type}
          onChange={(e) => updateStaffField(category, staffIdx, "type", e.target.value)}
        />
        <input
          className="w-28 px-2 py-1 text-xs border rounded bg-white"
          placeholder="Notes"
          value={staff.notes || ""}
          onChange={(e) => updateStaffField(category, staffIdx, "notes", e.target.value)}
        />
        <button
          className="p-1 text-red-500 hover:text-red-700"
          onClick={() => deleteStaff(category, staffIdx)}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderCategory = (
    label: string,
    icon: string,
    iconClass: string,
    category: WorkforceCategory,
    staffList: StaffMember[],
    sessionCount: number
  ) => {
    if (!isEditing && staffList.length === 0) return null;

    return (
      <div>
        <h4 className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${iconClass}`}>{icon}</span>
          {label} ({sessionCount} GP-eq sessions)
          {category === "acp" && sessionCount > 0 && (
            <span className="font-normal text-purple-600">= {sessionCount * 4} hrs/wk · {(sessionCount * 4 / 37.5).toFixed(2)} WTE</span>
          )}
        </h4>

        {isEditing ? (
          <>
            {staffList.map((staff, index) => (
              <EditableStaffRow key={`${category}-${index}`} staff={staff} category={category} staffIdx={index} />
            ))}
            <button
              className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 mt-1"
              onClick={() => addStaff(category)}
            >
              <Plus className="h-3.5 w-3.5" /> Add {label}
            </button>
          </>
        ) : (
          staffList.map((staff, index) => <StaffRowCompact key={`${category}-${index}`} staff={staff} category={category} />)
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#003087]" />
          <h3 className="font-semibold text-[#003087] text-sm">
            Recruitment Status <span className="font-normal text-slate-400 text-xs">as at 23rd February 2026</span>
          </h3>
        </div>

        {canEditRecruitment && (
          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={cancelEditing} disabled={isSaving}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={saveChanges} disabled={isSaving}>
                  <Save className="w-3.5 h-3.5 mr-1" /> Save
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={startEditing}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Data
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
          <p className="text-xs text-green-600 mb-0.5">Filled</p>
          <p className="text-xl font-bold text-green-700">{totals.totalFilled}</p>
          <p className="text-[10px] text-green-500">{totals.filledPercent}% of {totals.required}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-center">
          <p className="text-xs text-amber-600 mb-0.5">Pipeline</p>
          <p className="text-xl font-bold text-amber-700">{totals.totalPipeline}</p>
          <p className="text-[10px] text-amber-500">{totals.pipelinePercent}% TBC/Potential</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
          <p className="text-xs text-red-600 mb-0.5">Outstanding</p>
          <p className="text-xl font-bold text-red-700">{totals.totalOutstanding}</p>
          <p className="text-[10px] text-red-500">{totals.outstandingPercent}% recruiting</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="h-5 bg-gray-200 rounded-full overflow-hidden flex">
          {filledPct > 0 && (
            <div className="bg-green-500 h-full flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${filledPct}%` }}>
              {filledPct >= 12 && `${Math.round(filledPct)}%`}
            </div>
          )}
          {pipelinePct > 0 && (
            <div className="bg-amber-400 h-full flex items-center justify-center text-[10px] text-amber-900 font-medium" style={{ width: `${pipelinePct}%` }}>
              {pipelinePct >= 12 && `${Math.round(pipelinePct)}%`}
            </div>
          )}
          {outstandingPct > 0 && (
            <div className="bg-red-400 h-full flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${outstandingPct}%` }}>
              {outstandingPct >= 12 && `${Math.round(outstandingPct)}%`}
            </div>
          )}
        </div>
        <div className="flex justify-between text-[10px] mt-1 text-slate-500">
          <span>{totals.totalPlanned} / {totals.required} sessions planned</span>
          <span>{totals.required - totals.totalPlanned > 0 ? `${totals.required - totals.totalPlanned} gap` : "✓ Covered"}</span>
        </div>
      </div>

      <div className="space-y-3">
        {renderCategory("GP", "GP", "bg-blue-100 text-blue-600", "gp", recruitmentData.workforce.gp, totals.byType.gp)}
        {renderCategory("ACP/ANP", "ACP", "bg-purple-100 text-purple-600", "acp", recruitmentData.workforce.acp, totals.byType.acp)}
        {renderCategory("Buy-Back", "BB", "bg-gray-200 text-gray-600", "buyBack", recruitmentData.workforce.buyBack, totals.byType.buyBack)}
      </div>
    </div>
  );
};

const StaffRowCompact = ({ staff, category = "gp" }: { staff: StaffMember; category?: "gp" | "acp" | "buyBack" }) => {
  const config = statusConfig[staff.status];
  const isACPRole = category === "acp" || (category === "buyBack" && (staff.name.toLowerCase().includes('anp') || staff.name.toLowerCase().includes('acp') || staff.notes?.toLowerCase().includes('anp') || staff.notes?.toLowerCase().includes('acp')));
  const hours = staff.sessions * 4;
  const wte = (hours / 37.5).toFixed(2);

  const hasLastUpdated = !!staff.lastUpdated && !Number.isNaN(new Date(staff.lastUpdated).getTime());

  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${config.bgLight} ${config.border} border mb-1.5 text-sm`}>
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full ${config.color} flex items-center justify-center text-white font-bold text-xs`}>{staff.sessions}</div>
        <div>
          <div className="font-medium text-slate-900 text-xs flex items-center gap-1.5">
            <span>{staff.name}</span>
            {staff.notes && <InfoTooltip content={staff.notes} />}
            {isACPRole ? (
              <>
                <span className="font-normal text-purple-600">— {hours} hrs/wk ({wte} WTE)</span>
                <span className="font-normal text-slate-400">· {staff.sessions} GP-equivalent {staff.sessions === 1 ? "session" : "sessions"}</span>
              </>
            ) : (
              <span className="font-normal text-slate-500">— {staff.sessions} {staff.sessions === 1 ? "session" : "sessions"}</span>
            )}
          </div>
          {hasLastUpdated && (
            <div className="text-[10px] text-slate-500 mt-0.5">Updated: {format(new Date(staff.lastUpdated as string), "dd/MM/yy HH:mm")}</div>
          )}
        </div>
      </div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bgLight} ${config.textColor} ${config.border} border`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.color} mr-1`}></span>
        {config.label}
      </span>
    </div>
  );
};

export const PracticeDetailModal = ({
  open,
  onOpenChange,
  practice,
  totalListSize,
  capacityNonWinter,
  capacityWinter,
  activeSplit,
  viewMode,
  canEditRecruitment,
}: PracticeDetailModalProps) => {
  const [gpPct, setGpPct] = useState(50);
  const [capacitySeason, setCapacitySeason] = useState<"summer" | "winter">("summer");
  const acpPct = 100 - gpPct;
  const multiplier = viewMode === "appointments" ? 12 : 1;
  const unitLabel = viewMode === "appointments" ? "appointments" : "sessions";
  const pct = ((practice.listSize / totalListSize) * 100).toFixed(1);

  // Financial calculations
  const monthlyBudget = Math.round((practice.listSize * 26.33) / 12 * 100) / 100;
  const budget75 = Math.round(monthlyBudget * 9);

  // Seasonal calculations using activeSplit (F2F/Remote from parent)
  const nwTotal = capacityNonWinter.sessionsPerWeek * (practice.listSize / totalListSize);
  const nwF2f = nwTotal * (activeSplit / 100);
  const nwRemote = nwTotal * ((100 - activeSplit) / 100);
  const nwRate = ((nwTotal * 12) / practice.listSize * 1000).toFixed(1);

  const wTotal = capacityWinter.sessionsPerWeek * (practice.listSize / totalListSize);
  const wF2f = wTotal * (activeSplit / 100);
  const wRemote = wTotal * ((100 - activeSplit) / 100);
  const wRate = ((wTotal * 12) / practice.listSize * 1000).toFixed(1);

  const nonWinterAppts = Math.round(nwTotal * 12 * 39);
  const winterAppts = Math.round(wTotal * 12 * 13);
  const annualTarget = nonWinterAppts + winterAppts;

  // F2F from room matrix
  const f2fFromRooms = practice.totalSessions;
  const capacityTotal = capacitySeason === "winter" ? wTotal : nwTotal;
  const remoteRequired = Math.max(0, capacityTotal - f2fFromRooms);

  // GP/ACP resource mix calculations
  const gpSessionCost = 11000 * 1.2938;
  const acpAnnualCost = 60000 * 1.2938;
  const gpBudget = budget75 * (gpPct / 100);
  const acpBudget = budget75 * (acpPct / 100);
  const gpSessions = gpBudget / gpSessionCost;
  const acpFte = acpBudget / acpAnnualCost;

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setGpPct(50);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl bg-white max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl px-8 sm:px-10" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(48rem, calc(100vw - 4rem))' }}>
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="text-xl font-bold text-[#003087]">
              {practice.practice}
            </DialogTitle>
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
            <div className="flex items-center gap-1">
              {practice.system === "EMIS" ? <EmisIcon size="sm" /> : <SystmOneIcon size="sm" />}
            </div>
          </div>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {practice.subPractices && (
              <span className="mr-2">{practice.subPractices.join(", ")} · </span>
            )}
            <span className="font-medium text-slate-700">{practice.listSize.toLocaleString()}</span> patients ({pct}% of neighbourhood)
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <PoundSterling className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
              Finance & Capacity
            </TabsTrigger>
            <TabsTrigger value="resource" className="text-xs sm:text-sm">
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
              Resource Mix
            </TabsTrigger>
            <TabsTrigger value="recruitment" className="text-xs sm:text-sm">
              <Users className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
              Recruitment
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Financial Summary + Seasonal Breakdown + On-Site Capacity */}
          <TabsContent value="overview" className="mt-0 space-y-4">
            {/* Financial Summary */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <PoundSterling className="w-4 h-4 text-[#003087]" />
                <h3 className="font-semibold text-[#003087] text-sm">Financial Summary</h3>
              </div>
              <div className="bg-[#F0F4F5] rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Monthly SDA Allocation</p>
                    <p className="text-xl font-bold text-slate-900">£{monthlyBudget.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Budget @ 75%</p>
                    <p className="text-xl font-bold text-slate-900">£{budget75.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Annual Appointment Target</p>
                    <p className="text-xl font-bold text-slate-900">{annualTarget.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>


            <Separator />

            {/* Seasonal Breakdown */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sun className="w-4 h-4 text-[#003087]" />
                <h3 className="font-semibold text-[#003087] text-sm">Seasonal Breakdown</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <h4 className="font-semibold text-slate-800 text-sm">Non-Winter</h4>
                    <Badge variant="outline" className="text-[10px] ml-auto">39 wks</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Weekly Requirement</span>
                      <span className="font-semibold text-slate-900">{(nwTotal * multiplier).toFixed(1)} {unitLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">F2F</span>
                      <span className="font-semibold text-green-700">{(nwF2f * multiplier).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-indigo-600">Remote</span>
                      <span className="font-semibold text-indigo-700">{(nwRemote * multiplier).toFixed(1)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">Weekly Appointments</span>
                      <span className="font-bold text-slate-900">{Math.round(nwTotal * 12).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">Total Non-Winter SDA Appts</span>
                      <span className="font-bold text-slate-900">{nonWinterAppts.toLocaleString()}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Rate per 1,000</span>
                      <span className="text-slate-500">{nwRate}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Snowflake className="w-4 h-4 text-blue-500" />
                    <h4 className="font-semibold text-slate-800 text-sm">Winter</h4>
                    <Badge variant="outline" className="text-[10px] ml-auto">13 wks</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Weekly Requirement</span>
                      <span className="font-semibold text-slate-900">{(wTotal * multiplier).toFixed(1)} {unitLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">F2F</span>
                      <span className="font-semibold text-green-700">{(wF2f * multiplier).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-indigo-600">Remote</span>
                      <span className="font-semibold text-indigo-700">{(wRemote * multiplier).toFixed(1)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">Weekly Appointments</span>
                      <span className="font-bold text-slate-900">{Math.round(wTotal * 12).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">Total Winter SDA Appts</span>
                      <span className="font-bold text-slate-900">{winterAppts.toLocaleString()}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Rate per 1,000</span>
                      <span className="text-slate-500">{wRate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Room-Based On-Site Capacity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#003087]" />
                  <h3 className="font-semibold text-[#003087] text-sm">On-Site Capacity (from Room Matrix)</h3>
                </div>
                <div className="flex items-center gap-1 bg-[#F0F4F5] rounded-lg p-0.5">
                  <button
                    onClick={() => setCapacitySeason("summer")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${capacitySeason === "summer" ? "bg-white text-[#003087] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    ☀️ Non-Winter
                  </button>
                  <button
                    onClick={() => setCapacitySeason("winter")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${capacitySeason === "winter" ? "bg-white text-[#003087] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    ❄️ Winter
                  </button>
                </div>
              </div>
              <div className="bg-[#F0F4F5] rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">F2F Sessions Available/Week</p>
                    <p className="text-2xl font-bold text-green-700">{f2fFromRooms}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">F2F Appointments Available/Week</p>
                    <p className="text-2xl font-bold text-green-700">{f2fFromRooms * 12}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Remote Required/Week</p>
                    <p className={`text-2xl font-bold ${remoteRequired > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                      {viewMode === "appointments"
                        ? Math.round(remoteRequired * 12)
                        : remoteRequired.toFixed(1)
                      }
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">{viewMode === "appointments" ? "appointments" : "sessions"} to meet SDA target</p>
                  </div>
                </div>
              </div>
            </div>

          </TabsContent>

          {/* Tab 2: Resource Mix Explorer */}
          <TabsContent value="resource" className="mt-0">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal className="w-4 h-4 text-[#003087]" />
                <h3 className="font-semibold text-[#003087] text-sm">Resource Mix Explorer</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Adjust the GP / ACP workforce split to explore different resource allocations. Changes are exploratory only.
              </p>

              <div className="bg-[#F0F4F5] rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#005EB8]">GP: {gpPct}%</span>
                  <span className="text-sm font-medium text-purple-700">ACP: {acpPct}%</span>
                </div>
                <Slider
                  value={[gpPct]}
                  onValueChange={(v) => setGpPct(v[0])}
                  min={50}
                  max={100}
                  step={25}
                  className="my-3"
                />
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant={gpPct === 50 ? "default" : "outline"} onClick={() => setGpPct(50)} className="text-xs">50 / 50</Button>
                  <Button size="sm" variant={gpPct === 75 ? "default" : "outline"} onClick={() => setGpPct(75)} className="text-xs">75 / 25</Button>
                  <Button size="sm" variant={gpPct === 100 ? "default" : "outline"} onClick={() => setGpPct(100)} className="text-xs">100 / 0</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-center">
                  <p className="text-xs font-medium text-[#005EB8] mb-1">GP Sessions</p>
                  <p className="text-3xl font-bold text-[#003087]">{gpSessions.toFixed(1)}</p>
                  <p className="text-xs text-slate-500 mt-1">sessions from 9-month budget</p>
                  <Separator className="my-2" />
                  <p className="text-lg font-bold text-[#005EB8]">£{Math.round(gpBudget).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">GP budget allocation</p>
                </div>
                <div className={`bg-purple-50 rounded-xl p-4 border border-purple-200 text-center ${acpPct === 0 ? 'opacity-40' : ''}`}>
                  <p className="text-xs font-medium text-purple-700 mb-1">ACP WTE</p>
                  <p className="text-3xl font-bold text-purple-800">{acpPct === 0 ? '—' : acpFte.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">whole-time equivalents</p>
                  <Separator className="my-2" />
                  <p className="text-lg font-bold text-purple-700">{acpPct === 0 ? '—' : `£${Math.round(acpBudget).toLocaleString()}`}</p>
                  <p className="text-xs text-slate-400">ACP budget allocation</p>
                </div>
              </div>

              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <span className="font-semibold text-[#005EB8]">GP</span> £11,000/session + 29.38% on-costs = £{Math.round(gpSessionCost).toLocaleString()}/session &nbsp;·&nbsp;
                  <span className="font-semibold text-purple-700">ACP</span> £60,000/yr + 29.38% on-costs = £{Math.round(acpAnnualCost).toLocaleString()}/yr
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Recruitment Status */}
          <TabsContent value="recruitment" className="mt-0">
            <RecruitmentStatusSection practiceKey={practice.key} canEditRecruitment={canEditRecruitment} />
          </TabsContent>
        </Tabs>

        {practice.note && (
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 mt-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> {practice.note}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
