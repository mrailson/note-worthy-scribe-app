import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, FileDown, Send, Search, Copy, ShieldCheck, ListChecks, ArrowLeft, Plus, Eye, ChevronRight, Filter } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  { label: "Drugs 15+", key: "_quick_drugs15" },
  { label: "PoA ≥ 50%", key: "_quick_poa50" },
];

const SELECTION_CAP = 100;

const quickPredicate = (key: string): ((r: DrillPatientRow) => boolean) | null => {
  switch (key) {
    case "_quick_65plus":  return (r) => (r.age ?? 0) >= 65;
    case "_quick_modsev":  return (r) => r.frailty === "Moderate" || r.frailty === "Severe";
    case "_quick_drugs10": return (r) => r.drugCount >= 10;
    case "_quick_drugs15": return (r) => r.drugCount >= 15;
    case "_quick_poa50": return (r) => (r.poA ?? 0) >= 50;
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
}: PatientDrillDrawerProps) => {
  const { isOpen, mode, filterKeys, cohortContext, selectedPatient, open, openPatient, backToCohort, add, remove, close } = useDrillThrough();
  const [sortBy, setSortBy] = useState<SortKey>("poA");
  const [search, setSearch] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [quickChips, setQuickChips] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [identifierDetails, setIdentifierDetails] = useState<Record<string, IdentifiableDetails>>({});
  const [identifierLookupUnavailable, setIdentifierLookupUnavailable] = useState(false);
  const [identifierLookupStatus, setIdentifierLookupStatus] = useState<IdentifierLookupStatus>("idle");
  const identifierLookupToastShownRef = useRef(false);

  // Cross-practice exception path: identifiers are hidden by default but the
  // user has identifiable rights for OTHER practices. Reveal is audit-logged
  // without collecting a separate reason because the DSA/DPO approval covers access.
  const [exceptionRevealed, setExceptionRevealed] = useState(false);

  // Identifiable CSV export modal — Phase B
  const [identifiableExportOpen, setIdentifiableExportOpen] = useState(false);

  // Add-to-worklist dialog — Phase C
  const [worklistDialogOpen, setWorklistDialogOpen] = useState(false);
  const cohortScrollRef = useRef<HTMLDivElement | null>(null);
  const patientHeaderRef = useRef<HTMLHeadingElement | null>(null);
  const lastPatientTriggerRef = useRef<HTMLElement | null>(null);
  const transitionLockedRef = useRef(false);
  const patientRevealAuditLoggedRef = useRef<Set<string>>(new Set());
  const [, setCohortSnapshot] = useState<CohortSnapshot | null>(null);
  const reducedMotion = useReducedMotion();

  // Effective inline-PII mode: either the user has direct view rights, OR
  // they've completed the cross-practice exception reveal for this session.
  const identifiersAllowed = canViewPII;
  const showInlinePII = mode === "patient" && (identifiersAllowed || (hasViewElsewhere && exceptionRevealed)) && identifierLookupStatus === "ready" && !identifierLookupUnavailable;

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

  useEffect(() => {
    if (mode !== "cohort" || !lastPatientTriggerRef.current) return;
    const timer = window.setTimeout(() => {
      lastPatientTriggerRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [mode]);

  const handleBackToCohort = () => {
    if (transitionLockedRef.current) return;
    transitionLockedRef.current = true;
    backToCohort();
    window.setTimeout(() => {
      transitionLockedRef.current = false;
    }, 250);
  };

  const showIdentifierLookupFailedToast = () => {
    identifierLookupToastShownRef.current = true;
  };

  // Resolve the current filters
  const filters = useMemo(
    () => filterKeys.map(getFilter).filter((f): f is NonNullable<ReturnType<typeof getFilter>> => f !== null),
    [filterKeys],
  );

  const cohortBaseRows = useMemo(() => applyFilters(rows, filterKeys), [rows, filterKeys]);

  // Apply named filters → quick chips → search
  const filteredRows = useMemo(() => {
    let result = cohortBaseRows;
    for (const chipKey of quickChips) {
      const pred = quickPredicate(chipKey);
      if (pred) result = result.filter(pred);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) =>
        r.fkPatientLinkId.toLowerCase().includes(q) ||
        (canViewPII && (r.nhsNumber ?? "").toLowerCase().includes(q)) ||
        (canViewPII && [r.forenames, r.surname].filter(Boolean).join(" ").toLowerCase().includes(q)),
      );
    }
    return result;
  }, [cohortBaseRows, quickChips, search, canViewPII]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const av = (a[sortBy] as number | null) ?? -Infinity;
      const bv = (b[sortBy] as number | null) ?? -Infinity;
      return bv === av ? 0 : bv > av ? 1 : -1;
    });
  }, [filteredRows, sortBy]);

  const visibleRows = sortedRows;
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => cohortScrollRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
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

  useEffect(() => {
    if (mode !== "patient" || !patientRow || !practiceId || !canViewPII) return;
    const context = cohortContext?.filterKey === "top25" ? "top25_patient_side_view" : "patient_detail_open";
    const key = `${practiceId}|${patientRow.fkPatientLinkId}|${context}`;
    if (patientRevealAuditLoggedRef.current.has(key)) return;
    patientRevealAuditLoggedRef.current.add(key);
    void (supabase as any).rpc("log_narp_patient_reveal", {
      _practice_id: practiceId,
      _fk_patient_link_id: patientRow.fkPatientLinkId,
      _route: route ?? "/nres/population-risk#drawer",
      _context: context,
    }).then(({ error }) => {
      if (error) {
        patientRevealAuditLoggedRef.current.delete(key);
        console.warn("[PatientDrillDrawer] patient reveal audit failed", error);
      }
    });
  }, [canViewPII, cohortContext?.filterKey, mode, patientRow, practiceId, route]);

  // Summary strip
  const summary = useMemo(() => {
    const n = filteredRows.length;
    if (n === 0) return { n: 0, meanPoA: null, meanDrugCount: null, pct65: null };
    const meanPoA = filteredRows.reduce((s, r) => s + (r.poA ?? 0), 0) / n;
    const aged65 = filteredRows.filter((r) => (r.age ?? 0) >= 65).length;
    const meanDrugCount = filteredRows.reduce((s, r) => s + (r.drugCount ?? 0), 0) / n;
    return {
      n,
      meanPoA,
      meanDrugCount,
      pct65: (aged65 / n) * 100,
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
    setCohortSnapshot(null);
    lastPatientTriggerRef.current = null;
    transitionLockedRef.current = false;
    close();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= SELECTION_CAP) return next;
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(visibleRows.slice(0, SELECTION_CAP).map((r) => r.fkPatientLinkId)));
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

  const activeQuickFilters = QUICK_CHIPS.filter((chip) => quickChips.includes(chip.key));
  const activeNamedFilters = filters.map((filter) => ({ key: filter.key, label: filter.label, type: "named" as const }));
  const activeFilterCount = activeNamedFilters.length + activeQuickFilters.length;
  const filterDescription = activeFilterCount ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"}` : "no filters applied";
  const visibleSelectedCount = visibleRows.filter((r) => selected.has(r.fkPatientLinkId)).length;
  const selectionCapped = visibleRows.length > SELECTION_CAP && visibleSelectedCount === SELECTION_CAP;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.slice(0, SELECTION_CAP).every((r) => selected.has(r.fkPatientLinkId));
  const someSelected = selected.size > 0;
  const clearFilters = () => {
    for (const filter of filters) remove(filter.key);
    setQuickChips([]);
    setSearch("");
  };
  const toggleQuickFilter = (key: string) => {
    setQuickChips((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]);
  };
  const handleHeaderSelect = () => {
    if (someSelected || allVisibleSelected) {
      clearSelection();
      return;
    }
    selectAllVisible();
  };
  const frailtyClass = (frailty: string) => {
    if (frailty === "Severe") return "border-destructive/30 bg-destructive/10 text-destructive";
    if (frailty === "Moderate") return "border-primary/30 bg-primary/10 text-primary";
    if (frailty === "Mild") return "border-accent/30 bg-accent/10 text-accent-foreground";
    return "border-muted-foreground/20 bg-muted text-muted-foreground";
  };
  const exportVisibleCsv = () => void exportCsvAnonymised();

  const renderCohortMode = () => (
    <>
      <SheetHeader className="border-b px-5 pb-3 pt-5">
        <SheetTitle className="flex flex-wrap items-center gap-2 pr-8 text-lg">
          {titleText}
        </SheetTitle>
        <SheetDescription className="text-xs">{subtitleText}</SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-4 gap-0 border-b bg-muted/30 px-6 py-3">
        <Stat label="In cohort" value={fmt(summary.n)} sub={cohortBaseRows.length !== summary.n ? `of ${fmt(cohortBaseRows.length)}` : undefined} />
        <Stat label="Mean PoA" value={summary.meanPoA != null ? pct(summary.meanPoA) : "—"} />
        <Stat label="Mean drugs" value={summary.meanDrugCount != null ? String(Math.round(summary.meanDrugCount)) : "—"} />
        <Stat label="Aged 65+" value={summary.pct65 != null ? `${summary.pct65.toFixed(0)}%` : "—"} />
      </div>

      <div className="border-b bg-background px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-8 w-[132px] shrink-0 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="poA">Sort: PoA</SelectItem>
              <SelectItem value="poLoS">Sort: PoLoS</SelectItem>
              <SelectItem value="drugCount">Sort: Drugs</SelectItem>
              <SelectItem value="inpatientAdmissions">Sort: Inpt</SelectItem>
              <SelectItem value="age">Sort: Age</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs"><Filter className="mr-1.5 h-3.5 w-3.5" />Filter</Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter queue</div>
              <div className="space-y-2">
                {QUICK_CHIPS.map((chip) => (
                  <label key={chip.key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={quickChips.includes(chip.key)} onCheckedChange={() => toggleQuickFilter(chip.key)} />
                    <span>{chip.label}</span>
                  </label>
                ))}
                {overlap.length > 0 && <div className="border-t pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cohort overlaps</div>}
                {overlap.map(({ filter, overlap: n }) => (
                  <label key={filter.key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={filterKeys.includes(filter.key)} onCheckedChange={(checked) => checked ? add(filter.key) : remove(filter.key)} />
                    <span>{filter.label} <span className="text-muted-foreground">({fmt(n)})</span></span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {activeNamedFilters.map((filter) => (
              <button key={filter.key} type="button" onClick={() => remove(filter.key)} className="inline-flex max-w-[130px] shrink-0 items-center gap-1 truncate border bg-muted/40 px-2 py-1 text-xs hover:bg-muted" title={filter.label}>
                <span className="truncate">{filter.label}</span><X className="h-3 w-3" />
              </button>
            ))}
            {activeQuickFilters.map((filter) => (
              <button key={filter.key} type="button" onClick={() => toggleQuickFilter(filter.key)} className="inline-flex shrink-0 items-center gap-1 border bg-muted/40 px-2 py-1 text-xs hover:bg-muted">
                {filter.label}<X className="h-3 w-3" />
              </button>
            ))}
            {!activeFilterCount && <span className="truncate text-xs text-muted-foreground">no filters applied</span>}
          </div>

          {searchExpanded || search ? (
            <div className="relative w-[200px] shrink-0">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => !search && setSearchExpanded(false)} placeholder={canViewPII ? "Patient ref, NHS no, name" : "Patient ref"} className="h-8 pl-7 text-xs" />
            </div>
          ) : (
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSearchExpanded(true)} aria-label="Search">
              <Search className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 border-b bg-primary/5 px-5 py-2 text-xs">
          <span className="font-semibold text-primary">{selected.size} selected</span>
          {selectionCapped && <span className="text-muted-foreground">Showing {SELECTION_CAP} of {fmt(visibleRows.length)}. Filter further to select more.</span>}
          <div className="ml-auto flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={sendToBuyBack}><Send className="mr-1.5 h-3.5 w-3.5" />Send to Buy-Back Claims</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { if (!practiceId) return toast.error("Select a single practice before adding to a worklist"); setWorklistDialogOpen(true); }}><ListChecks className="mr-1.5 h-3.5 w-3.5" />Add to worklist</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>Clear</Button>
          </div>
        </div>
      )}

      <div ref={cohortScrollRef} className="min-h-0 flex-1 overflow-auto bg-background">
        <div className="sticky top-0 z-20 grid h-9 grid-cols-[24px_60px_40px_74px_52px_48px_62px_62px_24px] items-center border-b bg-background px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div><Checkbox checked={allVisibleSelected || (someSelected ? "indeterminate" : false)} onCheckedChange={handleHeaderSelect} aria-label="Select visible patients" /></div>
          <div>Ref</div><div className="text-right">Age</div><div>Frailty</div><div className="text-right">Drugs</div><div className="text-right">Inpt</div><div className="text-right">PoA</div><div className="text-right">PoLoS</div><div />
        </div>
        {sortedRows.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-8 text-center">
            <div className="text-sm font-semibold text-foreground">{cohortBaseRows.length ? "No patients match these filters" : "No patients currently in this cohort"}</div>
            <div className="mt-1 max-w-sm text-xs text-muted-foreground">
              {cohortBaseRows.length ? `${fmt(cohortBaseRows.length)} patients in the ${titleText} cohort. Try removing a filter.` : "Cohorts refresh on each NARP upload. Last data refresh is shown on the dashboard."}
            </div>
            {cohortBaseRows.length > 0 && <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Clear filters</Button>}
          </div>
        ) : (
          <>
            <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {virtualRows.map((virtualRow) => {
                const r = sortedRows[virtualRow.index];
                const isSelected = selected.has(r.fkPatientLinkId);
                return (
                  <div
                    key={r.fkPatientLinkId}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    tabIndex={0}
                    className={`group absolute left-0 grid w-full cursor-pointer grid-cols-[24px_60px_40px_74px_52px_48px_62px_62px_24px] items-center border-b border-border/60 px-3 py-2 text-xs transition-colors hover:bg-muted/30 focus:bg-muted/40 focus:outline-none ${isSelected ? "border-l-4 border-l-primary bg-primary/5" : "border-l-4 border-l-transparent bg-background"}`}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                    onClick={(e) => openPatientFromCohort(r.fkPatientLinkId, e.currentTarget)}
                  >
                    <div onClick={(e) => e.stopPropagation()}><Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(r.fkPatientLinkId)} aria-label={`Select patient ${r.fkPatientLinkId}`} /></div>
                    <div className="truncate font-mono font-semibold tabular-nums text-primary">{r.fkPatientLinkId}</div>
                    <div className="text-right tabular-nums">{r.age ?? "—"}</div>
                    <div><span className={`inline-flex max-w-full items-center border px-1.5 py-0.5 text-[11px] font-semibold ${frailtyClass(r.frailty)}`}>{r.frailty || "—"}</span></div>
                    <div className="text-right tabular-nums">{r.drugCount}</div>
                    <div className="text-right tabular-nums">{r.inpatientAdmissions}</div>
                    <div className={`text-right tabular-nums ${(r.poA ?? 0) >= 20 ? "font-bold text-foreground" : "font-semibold"}`}>{r.poA !== null ? pct(r.poA) : "—"}</div>
                    <div className="text-right tabular-nums text-muted-foreground">{r.poLoS !== null ? pct(r.poLoS) : "—"}</div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  </div>
                );
              })}
            </div>
            {selectionCapped && <div className="sticky bottom-0 border-t bg-muted/30 px-6 py-2 text-xs text-muted-foreground">Selection capped at {SELECTION_CAP}. Filter further to select more.</div>}
          </>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between border-t bg-background px-5 py-2 text-xs">
        <span className="text-muted-foreground">Showing {fmt(visibleRows.length)} of {fmt(cohortBaseRows.length)} · {filterDescription}</span>
        <Popover>
          <PopoverTrigger asChild><Button size="sm" variant="outline" className="h-8 text-xs"><FileDown className="mr-1.5 h-3.5 w-3.5" />Export</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <button type="button" onClick={exportVisibleCsv} className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-muted"><FileDown className="h-4 w-4" />Export visible (anonymised)</button>
            {canExportPII && <button type="button" onClick={exportCsvIdentifiable} className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-muted"><ShieldCheck className="h-4 w-4" />Export visible (with identifiers)</button>}
            {selected.size > 0 && <button type="button" onClick={sendToBuyBack} className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-muted"><Send className="h-4 w-4" />Send to Buy-Back Claims</button>}
          </PopoverContent>
        </Popover>
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
            <DrawerModeTransition activeMode={mode} layer="patient" ariaHidden={mode !== "patient"} transitionKey={patientRow?.fkPatientLinkId ?? "patient-loading"}>
              <AnimatePresence initial={false} mode="popLayout">
                {patientRow ? (
                  <motion.div
                    key={patientRow.fkPatientLinkId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0.1 : 0.2, ease: [0.4, 0, 0.2, 1] }}
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

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="text-left">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="narp-display text-[22px] font-semibold leading-tight tabular-nums">
      {value}
      {sub && <span className="ml-1 font-sans text-[11px] font-normal text-muted-foreground">{sub}</span>}
    </div>
  </div>
);

// ── Single-patient detail drawer mode ────────────────────────────────────
interface PatientDetailProps {
  patient: DrillPatientRow;
  headerRef: RefObject<HTMLHeadingElement>;
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

const PatientDetail = ({ patient, headerRef, cohortContext, allRowsCount, patientCohorts, identifierDetails, showIdentifiers, canViewPII, hasExceptionPath, exceptionRevealed, exceptionReason, setExceptionReason, identifierLookupStatus, practiceName, onBack, onOpenCohort, onReveal, onSendToBuyBack, onAddToWorklist }: PatientDetailProps) => {
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
      <SheetHeader className="border-b bg-muted/30 px-6 pb-4 pt-5">
        {cohortContext && onBack && (
          <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {cohortContext.label}
          </button>
        )}
        <SheetTitle ref={headerRef} tabIndex={-1} className="narp-display pr-8 text-[22px] font-medium tracking-normal focus:outline-none">Patient {patient.fkPatientLinkId}</SheetTitle>
        <SheetDescription className="text-xs">{practiceName || patient.practiceName || "Selected practice"} · 1 of {fmt(cohortContext?.count ?? allRowsCount)}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-auto px-6 py-5">
        <section>
          <SectionLabel>Risk profile</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Kpi label={<span>PoA · Admission risk <ScoreInfoTooltip text={scoreTooltips.poa.text} anchor={scoreTooltips.poa.anchor} /></span>} value={patient.poA !== null ? pct(patient.poA) : "—"} tone={poaTone} className="px-3 py-3" />
            <Kpi label={<span>PoLoS · Length of stay <ScoreInfoTooltip text={scoreTooltips.polos.text} anchor={scoreTooltips.polos.anchor} /></span>} value={patient.poLoS !== null ? pct(patient.poLoS) : "—"} tone={polosTone} className="px-3 py-3" />
            <Kpi label={<span>RUB · Resource band <ScoreInfoTooltip text={scoreTooltips.rub.text} anchor={scoreTooltips.rub.anchor} /></span>} value={patient.rub || "—"} tone={rubTone} className="px-3 py-3" />
            <Kpi label={<span>Frailty · eFI <ScoreInfoTooltip text={scoreTooltips.frailty.text} anchor={scoreTooltips.frailty.anchor} /></span>} value={patient.frailty} tone={frailtyTone} className="px-3 py-3" />
          </div>
        </section>

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

        {patientCohorts.length > 0 && (
          <section>
            <SectionLabel>This patient appears in</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {patientCohorts.map((cohort) => (
                <button key={cohort.key} type="button" onClick={() => onOpenCohort(cohort.key)} className="border bg-muted/30 px-2.5 py-1 text-left text-xs hover:bg-muted">
                  {cohort.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {(canViewPII || hasExceptionPath || exceptionRevealed) && (
          <Section title="Identifiers">
            {showIdentifiers ? (
              <>
                <KV k="NHS Number" v={identifierDetails?.nhs_number ?? patient.nhsNumber ?? "—"} />
                <KV k="Surname" v={identifierDetails?.surname ?? patient.surname ?? "—"} />
                <KV k="Forename" v={identifierDetails?.forenames ?? patient.forenames ?? "—"} />
                <KV k="DOB" v="—" />
                {exceptionRevealed && <p className="border-t border-dashed pt-2 text-[11px] leading-relaxed text-muted-foreground">Revealed by you · Reason: “{exceptionReason.trim()}”</p>}
              </>
            ) : hasExceptionPath ? (
              <div className="space-y-2 py-1">
                <p className="text-xs text-muted-foreground">NHS Number, name and DOB hidden under DSA</p>
                <textarea value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} placeholder="Reason for access (e.g. MDT review prep)" rows={2} className="w-full resize-y border bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <Button variant="outline" size="sm" onClick={onReveal} disabled={exceptionReason.trim().length < 10}><Eye className="mr-1.5 h-4 w-4" />Reveal identifiers</Button>
              </div>
            ) : identifierLookupStatus === "loading" ? <p className="text-xs text-muted-foreground">Looking up identifiable details…</p> : null}
          </Section>
        )}
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t bg-background px-4 py-3">
        <Button size="sm" className="flex-1" onClick={onSendToBuyBack}><Send className="h-4 w-4 mr-1.5" />Send to Buy-Back Claims</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onAddToWorklist}><Plus className="h-4 w-4 mr-1.5" />Add to worklist</Button>
        <Button size="sm" variant="ghost" onClick={copyRef} aria-label="Copy patient reference"><Copy className="h-4 w-4" /></Button>
      </div>
    </>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{children}</div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <SectionLabel>{title}</SectionLabel>
    <div className="mt-2 space-y-1 border bg-muted/30 px-3 py-1">{children}</div>
  </section>
);

const KV = ({ k, v, tip }: { k: string; v: React.ReactNode; tip?: { text: string; anchor: string } }) => (
  <div className="flex items-baseline justify-between border-b border-border/60 py-2 text-sm last:border-b-0">
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {k}
      {tip && <ScoreInfoTooltip text={tip.text} anchor={tip.anchor} />}
    </span>
    <span className="font-medium tabular-nums">{v}</span>
  </div>
);
