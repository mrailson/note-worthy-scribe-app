import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, FileDown, Send, Search, Copy, Info, ShieldCheck, ListChecks, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDrillThrough } from "@/hooks/useDrillThrough";
import { useNarpIdentifiableAccess } from "@/hooks/useNarpIdentifiableAccess";
import { IdentifiableExportModal } from "@/components/nres/IdentifiableExportModal";
import { AddToWorklistDialog } from "@/components/nres/AddToWorklistDialog";
import { ScoreInfoTooltip } from "@/components/nres/ScoreInfoTooltip";
import { Kpi } from "@/components/dashboard/Kpi";
import { DrawerModeTransition } from "@/components/nres/DrawerModeTransition";
import { scoreTooltips } from "@/lib/narp-reference";
import {
  ALL_FILTERS,
  applyFilters,
  getFilter,
  overlappingFilters,
  type NarpFilterableRow,
} from "@/lib/narp-filters";

/**
 * Full row contract used by the drawer for display.
 * The filter library only needs the subset in NarpFilterableRow.
 */
export interface DrillPatientRow extends NarpFilterableRow {
  nhsNumber?: string;
  forenames?: string;
  surname?: string;
  rub: string;
  poLoS: number | null;
  aeAttendances: number;
  electiveAdmissions?: number;
  outpatientFirst?: number;
  outpatientFollowUp?: number;
  practiceName: string;
}

interface PatientDrillDrawerProps {
  rows: DrillPatientRow[];
  /**
   * The current user holds `can_view_narp_identifiable` for the selected practice.
   * When true, NHS no / name render INLINE — no per-row reveal button is shown.
   */
  canViewPII?: boolean;
  /**
   * The current user holds `can_export_narp_identifiable` for the selected practice.
   * Controls visibility of the "Export – with identifiers" button.
   */
  canExportPII?: boolean;
  /**
   * The current user has identifiable access for SOME practice but not the
   * one currently selected. Enables the cross-practice exception path:
   * a single banner-level "Reveal identifiers + reason" prompt rather than
   * the per-row reveal flow.
   */
  hasViewElsewhere?: boolean;
  /** UUID of the gp_practices row currently being viewed (for audit + export RPC). */
  practiceId?: string | null;
  /** Display name of the current practice (used in the export modal + filename). */
  practiceName?: string;
  /** Route key for the page-load audit log. */
  route?: string;
  /** Persisted page-level preference for inline identifiable display. */
  identifiersVisible?: boolean;
  /** Updates the persisted page-level preference for inline identifiable display. */
  onIdentifiersVisibleChange?: (visible: boolean) => void;
}

type SortKey = "poA" | "poLoS" | "drugCount" | "inpatientAdmissions" | "age";
type IdentifiableDetails = { nhs_number: string | null; forenames: string | null; surname: string | null };
type IdentifierLookupStatus = "idle" | "loading" | "ready" | "unavailable";
type CohortSnapshot = { scrollTop: number; selectedIds: string[]; filterKeys: string[]; sortBy: SortKey; search: string; quickChips: string[] };

const DEMO_IDENTIFIABLE_DETAILS: Record<string, IdentifiableDetails> = {
  "DEMO-001": { nhs_number: "9990000001", forenames: "Demo Patient", surname: "One" },
  "DEMO-002": { nhs_number: "9990000002", forenames: "Demo Patient", surname: "Two" },
  "DEMO-003": { nhs_number: "9990000003", forenames: "Demo Patient", surname: "Three" },
  "DEMO-004": { nhs_number: "9990000004", forenames: "Demo Patient", surname: "Four" },
  "DEMO-005": { nhs_number: "9990000005", forenames: "Demo Patient", surname: "Five" },
  "DEMO-006": { nhs_number: "9990000006", forenames: "Demo Patient", surname: "Six" },
  "DEMO-007": { nhs_number: "9990000007", forenames: "Demo Patient", surname: "Seven" },
  "DEMO-008": { nhs_number: "9990000008", forenames: "Demo Patient", surname: "Eight" },
};

const fmt = (n: number) => n.toLocaleString("en-GB");
const pct = (n: number) => `${n.toFixed(1)}%`;
const csvEscape = (value: unknown): string => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const patientDisplayName = (details?: IdentifiableDetails, row?: Pick<DrillPatientRow, "forenames" | "surname">) =>
  [details?.forenames ?? row?.forenames, details?.surname ?? row?.surname].filter(Boolean).join(" ");

const titleTextFromFilters = (keys: string[]) => {
  const labels = keys.map(getFilter).filter((f): f is NonNullable<ReturnType<typeof getFilter>> => f !== null).map((f) => f.label);
  if (!labels.length) return "Patient list";
  return labels.length === 1 ? labels[0] : `${labels[0]} + ${labels.length - 1} more`;
};

const QUICK_CHIPS: { label: string; key: string }[] = [
  { label: "Age 65+", key: "_quick_65plus" },
  { label: "Frailty Mod/Sev", key: "_quick_modsev" },
  { label: "Drugs 10+", key: "_quick_drugs10" },
];

const quickPredicate = (key: string): ((r: DrillPatientRow) => boolean) | null => {
  switch (key) {
    case "_quick_65plus":  return (r) => (r.age ?? 0) >= 65;
    case "_quick_modsev":  return (r) => r.frailty === "Moderate" || r.frailty === "Severe";
    case "_quick_drugs10": return (r) => r.drugCount >= 10;
    default: return null;
  }
};

export const PatientDrillDrawer = ({
  rows,
  canViewPII = false,
  canExportPII = false,
  hasViewElsewhere = false,
  practiceId = null,
  practiceName,
  route,
  identifiersVisible: identifiersVisibleProp,
  onIdentifiersVisibleChange,
}: PatientDrillDrawerProps) => {
  const { isOpen, mode, filterKeys, cohortContext, selectedPatient, open, openPatient, backToCohort, add, remove, close } = useDrillThrough();
  const [sortBy, setSortBy] = useState<SortKey>("poA");
  const [search, setSearch] = useState("");
  const [quickChips, setQuickChips] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renderLimit, setRenderLimit] = useState(200);
  const [internalIdentifiersVisible, setInternalIdentifiersVisible] = useState(false);
  const [identifierDetails, setIdentifierDetails] = useState<Record<string, IdentifiableDetails>>({});
  const [identifierLookupUnavailable, setIdentifierLookupUnavailable] = useState(false);
  const [identifierLookupStatus, setIdentifierLookupStatus] = useState<IdentifierLookupStatus>("idle");
  const identifierLookupToastShownRef = useRef(false);
  const identifiersVisible = identifiersVisibleProp ?? internalIdentifiersVisible;
  const setIdentifiersVisible = onIdentifiersVisibleChange ?? setInternalIdentifiersVisible;

  // Cross-practice exception path: identifiers are hidden by default but the
  // user has identifiable rights for OTHER practices. They can opt in to an
  // audit-logged reveal for this session with a reason.
  const [exceptionRevealed, setExceptionRevealed] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");

  // Identifiable CSV export modal — Phase B
  const [identifiableExportOpen, setIdentifiableExportOpen] = useState(false);

  // Add-to-worklist dialog — Phase C
  const [worklistDialogOpen, setWorklistDialogOpen] = useState(false);
  const cohortScrollRef = useRef<HTMLDivElement | null>(null);
  const patientHeaderRef = useRef<HTMLHeadingElement | null>(null);
  const lastPatientTriggerRef = useRef<HTMLElement | null>(null);
  const transitionLockedRef = useRef(false);
  const [, setCohortSnapshot] = useState<CohortSnapshot | null>(null);
  const reducedMotion = useReducedMotion();

  // Effective inline-PII mode: either the user has direct view rights, OR
  // they've completed the cross-practice exception reveal for this session.
  const identifiersAllowed = mode === "patient" ? canViewPII : canViewPII && identifiersVisible;
  const showInlinePII = (identifiersAllowed || (hasViewElsewhere && exceptionRevealed)) && identifierLookupStatus === "ready" && !identifierLookupUnavailable;

  const captureCohortState = () => {
    setCohortSnapshot({
      scrollTop: cohortScrollRef.current?.scrollTop ?? 0,
      selectedIds: Array.from(selected),
      filterKeys,
      sortBy,
      search,
      quickChips,
    });
  };

  const openPatientFromCohort = (patientId: string, trigger: HTMLElement | null = null) => {
    captureCohortState();
    lastPatientTriggerRef.current = trigger;
    openPatient(patientId, currentCohortContext);
  };

  const handleBackToCohort = () => {
    if (transitionLockedRef.current) return;
    transitionLockedRef.current = true;
    backToCohort();
    window.setTimeout(() => {
      transitionLockedRef.current = false;
      lastPatientTriggerRef.current?.focus();
    }, 250);
  };

  useEffect(() => {
    if (!identifiersVisible) {
      setIdentifierLookupUnavailable(false);
      setIdentifierLookupStatus("idle");
      identifierLookupToastShownRef.current = false;
    }
  }, [identifiersVisible]);

  const showIdentifierLookupFailedToast = () => {
    identifierLookupToastShownRef.current = true;
  };

  // Resolve the current filters
  const filters = useMemo(
    () => filterKeys.map(getFilter).filter((f): f is NonNullable<ReturnType<typeof getFilter>> => f !== null),
    [filterKeys],
  );

  // Apply named filters → quick chips → search
  const filteredRows = useMemo(() => {
    let result = applyFilters(rows, filterKeys);
    for (const chipKey of quickChips) {
      const pred = quickPredicate(chipKey);
      if (pred) result = result.filter(pred);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) =>
        r.fkPatientLinkId.toLowerCase().includes(q) ||
        (showInlinePII && (r.nhsNumber ?? "").toLowerCase().includes(q)) ||
        (showInlinePII && [r.forenames, r.surname].filter(Boolean).join(" ").toLowerCase().includes(q)),
      );
    }
    return result;
  }, [rows, filterKeys, quickChips, search, showInlinePII]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const av = (a[sortBy] as number | null) ?? -Infinity;
      const bv = (b[sortBy] as number | null) ?? -Infinity;
      return bv === av ? 0 : bv > av ? 1 : -1;
    });
  }, [filteredRows, sortBy]);

  const visibleRows = sortedRows.slice(0, renderLimit);
  const singlePatientRef = sortedRows.length === 1 ? sortedRows[0].fkPatientLinkId : null;
  const patientRow = useMemo(
    () => selectedPatient ? rows.find((r) => r.fkPatientLinkId === selectedPatient) ?? null : null,
    [rows, selectedPatient],
  );
  const visibleRefKey = (mode === "patient" && patientRow ? [patientRow] : visibleRows).map((r) => r.fkPatientLinkId).join("|");

  useEffect(() => {
    if (mode !== "patient") return;
    window.setTimeout(() => patientHeaderRef.current?.focus(), reducedMotion ? 100 : 280);
  }, [mode, selectedPatient, reducedMotion]);

  const currentCohortContext = useMemo(() => ({
    filterKey: filterKeys[0] ?? "all",
    label: titleTextFromFilters(filterKeys),
    count: sortedRows.length,
  }), [filterKeys, sortedRows.length]);

  const patientCohorts = useMemo(() => {
    if (!patientRow) return [];
    return ALL_FILTERS.filter((filter) => filter.group === "cohort" && filter.predicate(patientRow));
  }, [patientRow]);

  useEffect(() => {
    const refs = visibleRefKey.split("|").filter(Boolean);
    if (!canViewPII || !identifiersAllowed || identifierLookupUnavailable || !practiceId || !refs.length) return;
    const missingRefs = refs.filter((id) => !identifierDetails[id]);
    if (!missingRefs.length) {
      setIdentifierLookupStatus("ready");
      return;
    }
    setIdentifierLookupStatus("loading");
    const demoRefs = missingRefs.filter((id) => DEMO_IDENTIFIABLE_DETAILS[id]);
    if (demoRefs.length) {
      setIdentifierDetails((prev) => {
        const next = { ...prev };
        for (const id of demoRefs) next[id] = DEMO_IDENTIFIABLE_DETAILS[id];
        return next;
      });
    }
    const rpcRefs = missingRefs.filter((id) => !DEMO_IDENTIFIABLE_DETAILS[id]);
    if (!rpcRefs.length) {
      setIdentifierLookupStatus("ready");
      return;
    }

    let cancelled = false;
    (supabase as any).rpc("get_narp_identifiable_by_refs", {
      _practice_id: practiceId,
      _fk_patient_link_ids: rpcRefs,
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || (data ?? []).length === 0) {
        if (error) console.warn("[PatientDrillDrawer] Could not load identifiable details", error);
        setIdentifierLookupUnavailable(true);
        setIdentifierLookupStatus("unavailable");
        showIdentifierLookupFailedToast();
        return;
      }
      setIdentifierLookupUnavailable(false);
      setIdentifierLookupStatus("ready");
      identifierLookupToastShownRef.current = false;
      setIdentifierDetails((prev) => {
        const next = { ...prev };
        for (const row of data ?? []) {
          next[row.fk_patient_link_id] = {
            nhs_number: row.nhs_number ?? null,
            forenames: row.forenames ?? null,
            surname: row.surname ?? null,
          };
        }
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [canViewPII, identifierDetails, identifierLookupUnavailable, identifiersAllowed, practiceId, visibleRefKey]);

  // Per-page-load audit: writes ONE row per (practice, route, count) bucket
  // when identifiers are actually rendered. Suppressed when no patients are
  // visible or when the user lacks view rights.
  useNarpIdentifiableAccess({
    practiceId,
    patientCountRendered: showInlinePII && isOpen ? visibleRows.length : 0,
    route: route ?? "/nres/population-risk#drawer",
    enableAudit: true,
  });

  // Summary strip
  const summary = useMemo(() => {
    const n = filteredRows.length;
    const meanPoA = n ? filteredRows.reduce((s, r) => s + (r.poA ?? 0), 0) / n : 0;
    const aged65 = filteredRows.filter((r) => (r.age ?? 0) >= 65).length;
    const withAdm = filteredRows.filter((r) => r.inpatientAdmissions >= 1).length;
    return {
      n,
      meanPoA,
      pct65: n ? (aged65 / n) * 100 : 0,
      pctAdm: n ? (withAdm / n) * 100 : 0,
    };
  }, [filteredRows]);

  // Cross-cohort overlap chips
  const overlap = useMemo(
    () => overlappingFilters(filteredRows, filterKeys),
    [filteredRows, filterKeys],
  );

  // Reset transient state when drawer closes or filters change
  const onCloseDrawer = () => {
    setSelected(new Set());
    setSearch("");
    setQuickChips([]);
    setRenderLimit(200);
    setCohortSnapshot(null);
    lastPatientTriggerRef.current = null;
    transitionLockedRef.current = false;
    close();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(visibleRows.map((r) => r.fkPatientLinkId)));
  };

  const selectAllInCohort = () => {
    setSelected(new Set(sortedRows.map((r) => r.fkPatientLinkId)));
  };

  const clearSelection = () => setSelected(new Set());

  const sendToBuyBack = () => {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast.info("Select at least one patient first");
      return;
    }
    // TODO (Phase 1 handoff): persist FK_Patient_Link_IDs into a
    // narp_buyback_handoffs table and route to BuyBackClaimsTab.
    // For now, emit a console payload and confirm to the user.
    console.log("[NRES] Send to Buy-Back Claims", { count: ids.length, fkIds: ids });
    toast.success(`${ids.length} patient${ids.length === 1 ? "" : "s"} queued for Buy-Back Claims`);
    clearSelection();
  };

  /**
   * Anonymised CSV export — always available to drawer users.
   * No identifiers; no modal; downloads immediately.
   * Logged via the export-log table once Phase B's edge function lands.
   */
  const resolveDetailsForRows = async (targetRows: DrillPatientRow[]) => {
    if (!practiceId) {
      toast.error("Select a single practice before exporting identifiers");
      return null;
    }
    let details = { ...identifierDetails };
    const missingRefs = targetRows.map((r) => r.fkPatientLinkId).filter((id) => !details[id]);
    const demoRefs = missingRefs.filter((id) => DEMO_IDENTIFIABLE_DETAILS[id]);
    for (const id of demoRefs) details[id] = DEMO_IDENTIFIABLE_DETAILS[id];
    const rpcRefs = missingRefs.filter((id) => !DEMO_IDENTIFIABLE_DETAILS[id]);
    if (rpcRefs.length) {
      const { data, error } = await (supabase as any).rpc("get_narp_identifiable_by_refs", {
        _practice_id: practiceId,
        _fk_patient_link_ids: rpcRefs,
      });
      if (error) {
        setIdentifierLookupUnavailable(true);
        setIdentifierLookupStatus("unavailable");
        showIdentifierLookupFailedToast();
        return null;
      }
      if ((data ?? []).length === 0) {
        setIdentifierLookupUnavailable(true);
        setIdentifierLookupStatus("unavailable");
        showIdentifierLookupFailedToast();
        return null;
      }
      setIdentifierLookupUnavailable(false);
      setIdentifierLookupStatus("ready");
      identifierLookupToastShownRef.current = false;
      for (const row of data ?? []) {
        details[row.fk_patient_link_id] = {
          nhs_number: row.nhs_number ?? null,
          forenames: row.forenames ?? null,
          surname: row.surname ?? null,
        };
      }
    }
    setIdentifierDetails(details);
    return details;
  };

  const exportCsvAnonymised = async () => {
    if (!sortedRows.length) {
      toast.info("Nothing to export");
      return;
    }
    const includeIdentifiers = showInlinePII;
    const details = includeIdentifiers ? await resolveDetailsForRows(sortedRows) : null;
    if (includeIdentifiers && !details) return;
    const headers = includeIdentifiers
      ? ["NHS_Number", "Name", "Age", "Frailty_eFI", "Drug_Count", "Inpatient_Admissions", "AE_Attendances", "RUB", "PoA_pct", "PoLoS_pct"]
      : ["FK_Patient_Link_ID", "Age", "Frailty_eFI", "Drug_Count", "Inpatient_Admissions", "AE_Attendances", "RUB", "PoA_pct", "PoLoS_pct"];
    const csvRows: string[] = [headers.join(",")];
    for (const r of sortedRows) {
      const base = [
        r.age ?? "",
        r.frailty,
        r.drugCount,
        r.inpatientAdmissions,
        r.aeAttendances,
        r.rub ?? "",
        r.poA ?? "",
        r.poLoS ?? "",
      ];
      const values = includeIdentifiers
        ? [details?.[r.fkPatientLinkId]?.nhs_number ?? r.nhsNumber ?? "", patientDisplayName(details?.[r.fkPatientLinkId], r), ...base]
        : [r.fkPatientLinkId, ...base];
      csvRows.push(values.map(csvEscape).join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = filters.map((f) => f.key).join("+") || "all";
    a.href = url; a.download = includeIdentifiers ? `narp-${slug}-identifiable.csv` : `narp-${slug}-anonymised.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Identifiable CSV export — opens the reason+consent modal.
   * The modal calls the `narp-export-identifiable` edge function which
   * decrypts PII server-side, returns CSV bytes + SHA-256, and writes
   * one audit row to `narp_export_log`.
   */
  const exportCsvIdentifiable = () => {
    if (!practiceId) {
      toast.error("Select a single practice before exporting identifiers");
      return;
    }
    if (!sortedRows.length) {
      toast.info("Nothing to export");
      return;
    }
    setIdentifiableExportOpen(true);
  };

  const titleText = filters.length === 0
    ? "Patient list"
    : filters.length === 1
      ? filters[0].label
      : `${filters[0].label} + ${filters.length - 1} more`;

  const subtitleText = filters.length
    ? `${filters.map((f) => f.subtitle).join(" · ")} · ${fmt(summary.n)} of ${fmt(rows.length)}`
    : `${fmt(summary.n)} patients`;

  const renderCohortMode = () => (
    <>
      <SheetHeader className="px-5 pt-5 pb-3 border-b">
        <SheetTitle className="text-lg flex items-center gap-2 pr-8 flex-wrap">
          {titleText}
          {singlePatientRef && (
            <Badge variant="outline" className="text-sm font-mono border-primary/40 text-primary bg-primary/5">
              Ref {singlePatientRef}
            </Badge>
          )}
        </SheetTitle>
        <SheetDescription className="text-xs">{subtitleText}</SheetDescription>
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {filters.map((ff) => (
              <Badge key={ff.key} variant="secondary" className="gap-1 pr-1">
                {ff.label}
                <button type="button" onClick={() => remove(ff.key)} className="ml-1 rounded-sm hover:bg-background/50 p-0.5" aria-label={`Remove ${ff.label}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </SheetHeader>

      {singlePatientRef && (
        <div className="px-5 py-2 border-b bg-primary/5 text-sm">
          <span className="text-muted-foreground">Patient record reference: </span>
          <span className="font-mono font-semibold text-primary">{singlePatientRef}</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 px-5 py-3 bg-muted/40 border-b text-center">
        <Stat label="In cohort" value={fmt(summary.n)} />
        <Stat label="Mean PoA" value={pct(summary.meanPoA)} />
        <Stat label="Aged 65+" value={pct(summary.pct65)} />
        <Stat label="≥1 admission" value={pct(summary.pctAdm)} />
      </div>

      {overlap.length > 0 && (
        <div className="px-5 py-2 border-b bg-background">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            Overlaps with
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">Click to narrow this list to patients who are ALSO in that cohort.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {overlap.map(({ filter, overlap: n }) => (
              <button key={filter.key} type="button" onClick={() => add(filter.key)} className="text-xs px-2 py-1 border rounded-md hover:bg-muted">
                {filter.label} <span className="text-muted-foreground">({fmt(n)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="poA">PoA (highest)</SelectItem>
              <SelectItem value="poLoS">PoLoS</SelectItem>
              <SelectItem value="drugCount">Drug count</SelectItem>
              <SelectItem value="inpatientAdmissions">Admissions</SelectItem>
              <SelectItem value="age">Age</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={showInlinePII ? "Ref, NHS number or name" : "Patient ref"} className="pl-7 h-8 text-xs" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map((c) => {
            const active = quickChips.includes(c.key);
            return (
              <button key={c.key} type="button" onClick={() => setQuickChips((prev) => active ? prev.filter((k) => k !== c.key) : [...prev, c.key])} className={`text-[11px] px-2 py-0.5 rounded-full border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                {c.label}
              </button>
            );
          })}
          {canViewPII && (
            <div className="ml-auto flex items-center gap-2 rounded-md border px-2 py-1 bg-background">
              <Label htmlFor="drawer-show-identifiers" className="text-[11px] text-muted-foreground cursor-pointer">Show identifiable details</Label>
              <Switch id="drawer-show-identifiers" checked={identifiersVisible} onCheckedChange={setIdentifiersVisible} aria-label="Show identifiable details" />
              {identifierLookupStatus === "loading" && <span className="text-[11px] text-muted-foreground">Looking up identifiable details…</span>}
              {identifierLookupStatus === "unavailable" && <span className="text-[11px] text-muted-foreground">Identifiable lookup unavailable — showing REF only</span>}
            </div>
          )}
        </div>
      </div>

      <div ref={cohortScrollRef} className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 sticky top-0 z-10">
            <tr className="text-left">
              <th className="p-2 w-8"><Checkbox checked={visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.fkPatientLinkId))} onCheckedChange={(v) => v ? selectAllVisible() : clearSelection()} aria-label="Select all visible" /></th>
              <th className="p-2">Ref</th>
              {showInlinePII && <th className="p-2">NHS no.</th>}
              {showInlinePII && <th className="p-2">Name</th>}
              <th className="p-2">Age</th>
              <th className="p-2"><HeaderTip label="Frailty" tip={scoreTooltips.frailty} /></th>
              <th className="p-2 text-right"><HeaderTip label="Drugs" tip={scoreTooltips.drugs} align="right" /></th>
              <th className="p-2 text-right">Inpt</th>
              <th className="p-2 text-right">A&E</th>
              <th className="p-2"><HeaderTip label="RUB" tip={scoreTooltips.rub} /></th>
              <th className="p-2 text-right"><HeaderTip label="PoA" tip={scoreTooltips.poa} align="right" /></th>
              <th className="p-2 text-right"><HeaderTip label="PoLoS" tip={scoreTooltips.polos} align="right" /></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.fkPatientLinkId} tabIndex={0} className="border-b hover:bg-muted/40 cursor-pointer focus:outline-none focus:bg-muted/50" onClick={(e) => openPatientFromCohort(r.fkPatientLinkId, e.currentTarget)} style={{ contentVisibility: "auto", containIntrinsicSize: "32px" }}>
                <td className="p-2" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(r.fkPatientLinkId)} onCheckedChange={() => toggleSelect(r.fkPatientLinkId)} aria-label={`Select patient ${r.fkPatientLinkId}`} /></td>
                <td className="p-2 font-semibold text-primary tabular-nums">{r.fkPatientLinkId}</td>
                {showInlinePII && <td className="p-2 tabular-nums" style={{ msoNumberFormat: "@" } as React.CSSProperties}>{identifierDetails[r.fkPatientLinkId]?.nhs_number || r.nhsNumber || "—"}</td>}
                {showInlinePII && <td className="p-2">{[identifierDetails[r.fkPatientLinkId]?.forenames ?? r.forenames, identifierDetails[r.fkPatientLinkId]?.surname ?? r.surname].filter(Boolean).join(" ") || "—"}</td>}
                <td className="p-2 tabular-nums">{r.age ?? "—"}</td>
                <td className="p-2">{r.frailty}</td>
                <td className="p-2 text-right tabular-nums">{r.drugCount}</td>
                <td className="p-2 text-right tabular-nums">{r.inpatientAdmissions}</td>
                <td className="p-2 text-right tabular-nums">{r.aeAttendances}</td>
                <td className="p-2">{r.rub || "—"}</td>
                <td className="p-2 text-right font-semibold tabular-nums">{r.poA !== null ? pct(r.poA) : "—"}</td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">{r.poLoS !== null ? pct(r.poLoS) : "—"}</td>
              </tr>
            ))}
            {!visibleRows.length && <tr><td colSpan={showInlinePII ? 12 : 10} className="p-8 text-center text-muted-foreground">No patients match these filters.</td></tr>}
          </tbody>
        </table>
        {sortedRows.length > visibleRows.length && (
          <div className="p-3 text-center border-t"><Button variant="outline" size="sm" onClick={() => setRenderLimit((n) => n + 500)}>Show more ({fmt(sortedRows.length - visibleRows.length)} remaining)</Button></div>
        )}
      </div>

      <div className="border-t bg-background px-5 py-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{selected.size > 0 ? `${selected.size} selected` : `Click rows to view details`}</span>
          <div className="flex gap-2">
            <button type="button" className="hover:underline" onClick={selectAllVisible}>Select visible</button><span>·</span>
            <button type="button" className="hover:underline" onClick={selectAllInCohort}>Select all ({fmt(sortedRows.length)})</button>
            {selected.size > 0 && <><span>·</span><button type="button" className="hover:underline" onClick={clearSelection}>Clear</button></>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="flex-1 min-w-[180px]" onClick={sendToBuyBack} disabled={!selected.size}><Send className="h-4 w-4 mr-1.5" />Send {selected.size || ""} to Buy-Back Claims</Button>
          <Button size="sm" variant="outline" onClick={() => { if (!selected.size) return toast.info("Select at least one patient first"); if (!practiceId) return toast.error("Select a single practice before adding to a worklist"); setWorklistDialogOpen(true); }} disabled={!selected.size || !practiceId}><ListChecks className="h-4 w-4 mr-1.5" />Add {selected.size || ""} to worklist</Button>
          <Button size="sm" variant="outline" onClick={exportCsvAnonymised}><FileDown className="h-4 w-4 mr-1.5" />Export – anonymised</Button>
          {canExportPII && <Button size="sm" variant="outline" onClick={exportCsvIdentifiable}><ShieldCheck className="h-4 w-4 mr-1.5" />Export – with identifiers</Button>}
        </div>
      </div>
    </>
  );

  const patientSelection = patientRow ? new Set([patientRow.fkPatientLinkId]) : new Set<string>();
  const selectedRowsForDialog = mode === "patient" && patientRow ? [patientRow] : sortedRows.filter((r) => selected.has(r.fkPatientLinkId));

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(o) => { if (!o) onCloseDrawer(); }}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 flex flex-col overflow-hidden">
          <div className="sr-only" aria-live="polite">
            {mode === "patient" && cohortContext ? "Showing patient detail. Press Escape to return to cohort." : mode === "patient" ? "Showing patient detail." : "Showing cohort list."}
          </div>
          <div className="relative flex-1 overflow-hidden">
            <DrawerModeTransition activeMode={mode} layer="cohort" ariaHidden={mode === "patient"}>
              {renderCohortMode()}
            </DrawerModeTransition>
            <DrawerModeTransition activeMode={mode} layer="patient" ariaHidden={mode !== "patient"}>
              <AnimatePresence initial={false} mode="popLayout">
                {patientRow ? (
                  <motion.div
                    key={patientRow.fkPatientLinkId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0.1 : 0.18, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-0 flex min-h-0 flex-col bg-background"
                  >
                    <PatientDetail
                      patient={patientRow}
                      headerRef={patientHeaderRef}
                      cohortContext={cohortContext}
                      allRowsCount={rows.length}
                      patientCohorts={patientCohorts}
                      identifierDetails={identifierDetails[patientRow.fkPatientLinkId]}
                      showIdentifiers={showInlinePII}
                      canViewPII={canViewPII}
                      hasExceptionPath={hasViewElsewhere && !canViewPII}
                      exceptionRevealed={exceptionRevealed}
                      exceptionReason={exceptionReason}
                      setExceptionReason={setExceptionReason}
                      identifierLookupStatus={identifierLookupStatus}
                      practiceName={practiceName ?? patientRow.practiceName}
                      onBack={cohortContext ? handleBackToCohort : undefined}
                      onOpenCohort={(key) => open(key)}
                      onReveal={() => {
                        if (!practiceId || exceptionReason.trim().length < 10) return;
                        void supabase.rpc("log_narp_pii_page_access", {
                          _practice_id: practiceId,
                          _route: (route ?? "/nres/population-risk#drawer") + "?exception_reveal=" + encodeURIComponent(exceptionReason.trim().slice(0, 200)),
                          _patient_count_rendered: 1,
                        });
                        setExceptionRevealed(true);
                        toast.success("Identifiers revealed for this session. Audit row written.");
                      }}
                      onSendToBuyBack={() => {
                        console.log("[NRES] Single patient → Buy-Back Claims", patientRow.fkPatientLinkId);
                        toast.success(`Patient ${patientRow.fkPatientLinkId} queued for Buy-Back Claims`);
                      }}
                      onAddToWorklist={() => {
                        setSelected(patientSelection);
                        setWorklistDialogOpen(true);
                      }}
                    />
                  </motion.div>
                ) : mode === "patient" ? (
                  <motion.div key="patient-loading" className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Loading patient details…</motion.div>
                ) : null}
              </AnimatePresence>
            </DrawerModeTransition>
          </div>
        </SheetContent>
      </Sheet>

      <AddToWorklistDialog
        open={worklistDialogOpen}
        onOpenChange={setWorklistDialogOpen}
        practiceId={practiceId}
        practiceName={practiceName}
        cohortLabel={filters.length > 0 ? filters.map((f) => f.label).join(" + ") : undefined}
        patients={selectedRowsForDialog.map((r) => ({
          fk_patient_link_id: r.fkPatientLinkId,
          added_risk_tier: typeof r.poA === "number" ? (r.poA > 50 ? "very_high" : r.poA >= 20 ? "high" : r.poA >= 10 ? "moderate" : r.poA >= 5 ? "rising" : "low") : null,
          added_poa: r.poA,
          added_polos: r.poLoS,
          added_drug_count: r.drugCount,
          added_frailty_category: r.frailty,
        }))}
        onAdded={() => clearSelection()}
      />

      <IdentifiableExportModal
        open={identifiableExportOpen}
        onOpenChange={setIdentifiableExportOpen}
        practiceId={practiceId}
        practiceName={practiceName}
        cohortLabel={filters.length > 0 ? filters.map((f) => f.label).join(" + ") : undefined}
        rowCountHint={sortedRows.length}
      />
    </>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-base font-bold tabular-nums leading-tight">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

const HeaderTip = ({ label, tip, align = "left" }: { label: string; tip: { text: string; anchor: string }; align?: "left" | "right" }) => (
  <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
    <span>{label}</span>
    <ScoreInfoTooltip text={tip.text} anchor={tip.anchor} />
  </span>
);

// ── Single-patient detail drawer mode ────────────────────────────────────
interface PatientDetailProps {
  patient: DrillPatientRow;
  cohortContext: { filterKey: string; label: string; count?: number } | null;
  allRowsCount: number;
  patientCohorts: Array<{ key: string; label: string }>;
  identifierDetails?: IdentifiableDetails;
  showIdentifiers: boolean;
  canViewPII: boolean;
  hasExceptionPath: boolean;
  exceptionRevealed: boolean;
  exceptionReason: string;
  setExceptionReason: (reason: string) => void;
  identifierLookupStatus: IdentifierLookupStatus;
  practiceName?: string;
  onBack?: () => void;
  onOpenCohort: (key: string) => void;
  onReveal: () => void;
  onSendToBuyBack: () => void;
  onAddToWorklist: () => void;
}

const PatientDetail = ({ patient, cohortContext, allRowsCount, patientCohorts, identifierDetails, showIdentifiers, canViewPII, hasExceptionPath, exceptionRevealed, exceptionReason, setExceptionReason, identifierLookupStatus, practiceName, onBack, onOpenCohort, onReveal, onSendToBuyBack, onAddToWorklist }: PatientDetailProps) => {
  const copyRef = () => {
    navigator.clipboard.writeText(patient.fkPatientLinkId);
    toast.success("Reference copied");
  };
  const poaTone = (patient.poA ?? 0) >= 20 ? "critical" : (patient.poA ?? 0) >= 5 ? "warn" : "default";
  const polosTone = (patient.poLoS ?? 0) >= 30 ? "critical" : (patient.poLoS ?? 0) >= 15 ? "warn" : "default";
  const rubTone = String(patient.rub).startsWith("5") ? "critical" : String(patient.rub).startsWith("4") ? "warn" : "default";
  const frailtyTone = patient.frailty === "Severe" ? "critical" : patient.frailty === "Moderate" ? "warn" : "default";

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-3 border-b">
        {cohortContext && onBack && (
          <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {cohortContext.label}
          </button>
        )}
        <SheetTitle className="narp-display text-[22px] font-semibold pr-8">Patient {patient.fkPatientLinkId}</SheetTitle>
        <SheetDescription className="text-xs">{practiceName || patient.practiceName || "Selected practice"} · 1 of {fmt(cohortContext?.count ?? allRowsCount)}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <Kpi label={<span>PoA · Probability of admission <ScoreInfoTooltip text={scoreTooltips.poa.text} anchor={scoreTooltips.poa.anchor} /></span>} value={patient.poA !== null ? pct(patient.poA) : "—"} tone={poaTone} className="px-3 py-3" />
          <Kpi label={<span>PoLoS · Length of stay risk <ScoreInfoTooltip text={scoreTooltips.polos.text} anchor={scoreTooltips.polos.anchor} /></span>} value={patient.poLoS !== null ? pct(patient.poLoS) : "—"} tone={polosTone} className="px-3 py-3" />
          <Kpi label={<span>RUB · Resource band <ScoreInfoTooltip text={scoreTooltips.rub.text} anchor={scoreTooltips.rub.anchor} /></span>} value={patient.rub || "—"} tone={rubTone} className="px-3 py-3" />
          <Kpi label={<span>Frailty · eFI category <ScoreInfoTooltip text={scoreTooltips.frailty.text} anchor={scoreTooltips.frailty.anchor} /></span>} value={patient.frailty} tone={frailtyTone} className="px-3 py-3" />
        </div>

        <Section title="Clinical profile">
          <KV k="Age" v={patient.age ?? "—"} />
          <KV k="Frailty category" v={patient.frailty} />
          <KV k="Drug count" v={patient.drugCount} />
          <KV k="Named GP" v="—" />
        </Section>

        <Section title="Utilisation">
          <KV k="Inpatient admissions" v={patient.inpatientAdmissions} />
          <KV k="A&E attendances" v={patient.aeAttendances} />
          <KV k="Outpatient first" v={patient.outpatientFirst ?? "—"} />
          <KV k="Outpatient follow-up" v={patient.outpatientFollowUp ?? "—"} />
        </Section>

        <Section title="Cohort memberships">
          <div className="flex flex-wrap gap-1.5">
            {patientCohorts.map((cohort) => (
              <button key={cohort.key} type="button" onClick={() => onOpenCohort(cohort.key)} className="text-xs px-2 py-1 border rounded-md hover:bg-muted text-left">
                {cohort.label}
              </button>
            ))}
          </div>
        </Section>

        {(canViewPII || hasExceptionPath || exceptionRevealed) && (
          <Section title="Identifiers">
            {showIdentifiers ? (
              <>
                <KV k="NHS Number" v={identifierDetails?.nhs_number ?? patient.nhsNumber ?? "—"} />
                <KV k="Surname" v={identifierDetails?.surname ?? patient.surname ?? "—"} />
                <KV k="Forename" v={identifierDetails?.forenames ?? patient.forenames ?? "—"} />
                <KV k="DOB" v="—" />
                {exceptionRevealed && <p className="text-[11px] text-muted-foreground pt-1">Revealed by you · Reason: “{exceptionReason.trim()}”</p>}
              </>
            ) : hasExceptionPath ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">NHS Number, name and DOB hidden under DSA</p>
                <Input value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} placeholder="Reason for access (≥10 chars)" className="text-xs" />
                <Button variant="outline" size="sm" onClick={onReveal} disabled={exceptionReason.trim().length < 10}>Reveal identifiers</Button>
              </div>
            ) : identifierLookupStatus === "loading" ? <p className="text-xs text-muted-foreground">Looking up identifiable details…</p> : null}
          </Section>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-background px-5 py-3 flex gap-2">
        <Button size="sm" className="flex-1" onClick={onSendToBuyBack}><Send className="h-4 w-4 mr-1.5" />Send to Buy-Back Claims</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onAddToWorklist}><ListChecks className="h-4 w-4 mr-1.5" />Add to worklist</Button>
        <Button size="sm" variant="ghost" onClick={copyRef} aria-label="Copy patient reference"><Copy className="h-4 w-4" /></Button>
      </div>
    </>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{title}</div>
    <div className="space-y-1">{children}</div>
  </div>
);

const KV = ({ k, v, tip }: { k: string; v: React.ReactNode; tip?: { text: string; anchor: string } }) => (
  <div className="flex justify-between text-sm">
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {k}
      {tip && <ScoreInfoTooltip text={tip.text} anchor={tip.anchor} />}
    </span>
    <span className="font-medium tabular-nums">{v}</span>
  </div>
);
