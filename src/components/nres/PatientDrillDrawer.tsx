import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, FileDown, Send, Search, Eye, Copy, Info, ShieldCheck, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDrillThrough } from "@/hooks/useDrillThrough";
import { useNarpIdentifiableAccess } from "@/hooks/useNarpIdentifiableAccess";
import { IdentifiableExportModal } from "@/components/nres/IdentifiableExportModal";
import { AddToWorklistDialog } from "@/components/nres/AddToWorklistDialog";
import {
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
}

type SortKey = "poA" | "poLoS" | "drugCount" | "inpatientAdmissions" | "age";
type IdentifiableDetails = { nhs_number: string | null; forenames: string | null; surname: string | null };

const fmt = (n: number) => n.toLocaleString("en-GB");
const pct = (n: number) => `${n.toFixed(1)}%`;

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
}: PatientDrillDrawerProps) => {
  const { isOpen, filterKeys, add, remove, close } = useDrillThrough();
  const [sortBy, setSortBy] = useState<SortKey>("poA");
  const [search, setSearch] = useState("");
  const [quickChips, setQuickChips] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activePatient, setActivePatient] = useState<DrillPatientRow | null>(null);
  const [renderLimit, setRenderLimit] = useState(200);
  const [identifiersVisible, setIdentifiersVisible] = useState(false);
  const [identifierDetails, setIdentifierDetails] = useState<Record<string, IdentifiableDetails>>({});

  // Cross-practice exception path: identifiers are hidden by default but the
  // user has identifiable rights for OTHER practices. They can opt in to a
  // single audit-logged reveal for the current cohort with a reason.
  const [exceptionRevealed, setExceptionRevealed] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);

  // Identifiable CSV export modal — Phase B
  const [identifiableExportOpen, setIdentifiableExportOpen] = useState(false);

  // Add-to-worklist dialog — Phase C
  const [worklistDialogOpen, setWorklistDialogOpen] = useState(false);

  // Effective inline-PII mode: either the user has direct view rights, OR
  // they've completed the cross-practice exception reveal for this session.
  const showInlinePII = (canViewPII && identifiersVisible) || (hasViewElsewhere && exceptionRevealed);

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
  const visibleRefKey = visibleRows.map((r) => r.fkPatientLinkId).join("|");

  useEffect(() => {
    if (!canViewPII || !identifiersVisible || !practiceId || !visibleRows.length) return;
    const refs = visibleRefKey.split("|").filter(Boolean);
    const missingRefs = refs.filter((id) => !identifierDetails[id]);
    if (!missingRefs.length) return;

    let cancelled = false;
    (supabase as any).rpc("get_narp_identifiable_by_refs", {
      _practice_id: practiceId,
      _fk_patient_link_ids: missingRefs,
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        toast.error("Could not load identifiable details");
        setIdentifiersVisible(false);
        return;
      }
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
  }, [canViewPII, identifierDetails, identifiersVisible, practiceId, visibleRefKey]);

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
  const exportCsvAnonymised = () => {
    if (!sortedRows.length) {
      toast.info("Nothing to export");
      return;
    }
    const headers = ["FK_Patient_Link_ID", "Age", "Frailty_eFI", "Drug_Count", "Inpatient_Admissions", "AE_Attendances", "RUB", "PoA_pct", "PoLoS_pct"];
    const csvRows: string[] = [headers.join(",")];
    for (const r of sortedRows) {
      csvRows.push([
        r.fkPatientLinkId,
        r.age ?? "",
        r.frailty,
        r.drugCount,
        r.inpatientAdmissions,
        r.aeAttendances,
        `"${(r.rub ?? "").replace(/"/g, '""')}"`,
        r.poA ?? "",
        r.poLoS ?? "",
      ].join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = filters.map((f) => f.key).join("+") || "all";
    a.href = url; a.download = `narp-${slug}-anonymised.csv`; a.click();
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

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(o) => { if (!o) onCloseDrawer(); }}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 flex flex-col">
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

            {/* Breadcrumb of stacked filters */}
            {filters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filters.map((ff) => (
                  <Badge key={ff.key} variant="secondary" className="gap-1 pr-1">
                    {ff.label}
                    <button
                      type="button"
                      onClick={() => remove(ff.key)}
                      className="ml-1 rounded-sm hover:bg-background/50 p-0.5"
                      aria-label={`Remove ${ff.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </SheetHeader>

          {/* Summary strip */}
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

          {/* Cross-cohort overlap chips */}
          {overlap.length > 0 && (
            <div className="px-5 py-2 border-b bg-background">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                Overlaps with
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Click to narrow this list to patients who are ALSO in that cohort.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {overlap.map(({ filter, overlap: n }) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => add(filter.key)}
                    className="text-xs px-2 py-1 border rounded-md hover:bg-muted"
                  >
                    {filter.label} <span className="text-muted-foreground">({fmt(n)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
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
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={showInlinePII ? "Ref, NHS number or name" : "Patient ref"}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CHIPS.map((c) => {
                const active = quickChips.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setQuickChips((prev) => active ? prev.filter((k) => k !== c.key) : [...prev, c.key])}
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Patient table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="p-2 w-8">
                    <Checkbox
                      checked={visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.fkPatientLinkId))}
                      onCheckedChange={(v) => v ? selectAllVisible() : clearSelection()}
                      aria-label="Select all visible"
                    />
                  </th>
                  <th className="p-2">Ref</th>
                  {showInlinePII && <th className="p-2">NHS no.</th>}
                  {showInlinePII && <th className="p-2">Name</th>}
                  <th className="p-2">Age</th>
                  <th className="p-2">Frailty</th>
                  <th className="p-2 text-right">Drugs</th>
                  <th className="p-2 text-right">Inpt</th>
                  <th className="p-2 text-right">A&E</th>
                  <th className="p-2">RUB</th>
                  <th className="p-2 text-right">PoA</th>
                  <th className="p-2 text-right">PoLoS</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr
                    key={r.fkPatientLinkId}
                    className="border-b hover:bg-muted/40 cursor-pointer"
                    onClick={() => setActivePatient(r)}
                    style={{ contentVisibility: "auto", containIntrinsicSize: "32px" }}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(r.fkPatientLinkId)}
                        onCheckedChange={() => toggleSelect(r.fkPatientLinkId)}
                        aria-label={`Select patient ${r.fkPatientLinkId}`}
                      />
                    </td>
                    <td className="p-2 font-semibold text-primary tabular-nums">{r.fkPatientLinkId}</td>
                    {showInlinePII && (
                      <td className="p-2 tabular-nums" style={{ msoNumberFormat: "@" } as React.CSSProperties}>
                        {r.nhsNumber || "—"}
                      </td>
                    )}
                    {showInlinePII && (
                      <td className="p-2">
                        {[r.forenames, r.surname].filter(Boolean).join(" ") || "—"}
                      </td>
                    )}
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
                {!visibleRows.length && (
                  <tr><td colSpan={showInlinePII ? 12 : 10} className="p-8 text-center text-muted-foreground">No patients match these filters.</td></tr>
                )}
              </tbody>
            </table>
            {sortedRows.length > visibleRows.length && (
              <div className="p-3 text-center border-t">
                <Button variant="outline" size="sm" onClick={() => setRenderLimit((n) => n + 500)}>
                  Show more ({fmt(sortedRows.length - visibleRows.length)} remaining)
                </Button>
              </div>
            )}
          </div>

          {/* Sticky action bar */}
          <div className="border-t bg-background px-5 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selected.size > 0 ? `${selected.size} selected` : `Click rows to select`}</span>
              <div className="flex gap-2">
                <button type="button" className="hover:underline" onClick={selectAllVisible}>Select visible</button>
                <span>·</span>
                <button type="button" className="hover:underline" onClick={selectAllInCohort}>Select all ({fmt(sortedRows.length)})</button>
                {selected.size > 0 && <>
                  <span>·</span>
                  <button type="button" className="hover:underline" onClick={clearSelection}>Clear</button>
                </>}
              </div>
            </div>
            {/* Cross-practice exception path: user has identifiable rights for
                another practice but not this one. Single audit-logged reveal
                with a reason — no per-row prompt. */}
            {hasViewElsewhere && !canViewPII && !exceptionRevealed && (
              <div className="border border-amber-300 bg-amber-50 rounded-md p-2 text-xs text-amber-900">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Identifiers hidden — viewing outside your assigned practice
                </div>
                <div className="mb-2">Reveal requires a reason. Audit-logged.</div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExceptionDialogOpen(true)}>
                  Reveal identifiers (audit-logged)
                </Button>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="flex-1 min-w-[180px]" onClick={sendToBuyBack} disabled={!selected.size}>
                <Send className="h-4 w-4 mr-1.5" />
                Send {selected.size || ""} to Buy-Back Claims
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!selected.size) {
                    toast.info("Select at least one patient first");
                    return;
                  }
                  if (!practiceId) {
                    toast.error("Select a single practice before adding to a worklist");
                    return;
                  }
                  setWorklistDialogOpen(true);
                }}
                disabled={!selected.size || !practiceId}
              >
                <ListChecks className="h-4 w-4 mr-1.5" />
                Add {selected.size || ""} to worklist
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsvAnonymised}>
                <FileDown className="h-4 w-4 mr-1.5" />
                Export – anonymised
              </Button>
              {canExportPII && (
                <Button size="sm" variant="outline" onClick={exportCsvIdentifiable}>
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  Export – with identifiers
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add-to-worklist dialog — Phase C */}
      <AddToWorklistDialog
        open={worklistDialogOpen}
        onOpenChange={setWorklistDialogOpen}
        practiceId={practiceId}
        practiceName={practiceName}
        cohortLabel={filters.length > 0 ? filters.map((f) => f.label).join(" + ") : undefined}
        patients={sortedRows
          .filter((r) => selected.has(r.fkPatientLinkId))
          .map((r) => ({
            fk_patient_link_id: r.fkPatientLinkId,
            added_risk_tier: typeof r.poA === "number"
              ? (r.poA > 50 ? "very_high" : r.poA >= 20 ? "high" : r.poA >= 10 ? "moderate" : r.poA >= 5 ? "rising" : "low")
              : null,
            added_poa: r.poA,
            added_polos: r.poLoS,
            added_drug_count: r.drugCount,
            added_frailty_category: r.frailty,
          }))}
        onAdded={() => clearSelection()}
      />

      {/* Cross-practice exception reveal dialog */}
      <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal identifiers for this cohort</DialogTitle>
            <DialogDescription>
              You have identifiable access for another practice but not the one currently selected.
              This reveal will be audit-logged against your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              placeholder="Reason for access (min. 10 characters)"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setExceptionDialogOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={exceptionReason.trim().length < 10 || !practiceId}
                onClick={() => {
                  if (!practiceId) return;
                  void supabase.rpc("log_narp_pii_page_access", {
                    _practice_id: practiceId,
                    _route: (route ?? "/nres/population-risk#drawer") + "?exception_reveal=" + encodeURIComponent(exceptionReason.trim().slice(0, 200)),
                    _patient_count_rendered: visibleRows.length,
                  });
                  setExceptionRevealed(true);
                  setExceptionDialogOpen(false);
                  toast.success("Identifiers revealed for this session. Audit row written.");
                }}
              >
                Reveal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Identifiable CSV export — reason + consent modal */}
      <IdentifiableExportModal
        open={identifiableExportOpen}
        onOpenChange={setIdentifiableExportOpen}
        practiceId={practiceId}
        practiceName={practiceName}
        cohortLabel={filters.length > 0 ? filters.map((f) => f.label).join(" + ") : undefined}
        rowCountHint={sortedRows.length}
      />

      <PatientDetailModal
        patient={activePatient}
        canViewPII={canViewPII}
        onClose={() => setActivePatient(null)}
        onSendToBuyBack={(p) => {
          // TODO (Phase 1): persist single-patient handoff
          console.log("[NRES] Single patient → Buy-Back Claims", p.fkPatientLinkId);
          toast.success(`Patient ${p.fkPatientLinkId} queued for Buy-Back Claims`);
          setActivePatient(null);
        }}
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

// ── Single-patient detail modal ──────────────────────────────────────────
interface PatientDetailModalProps {
  patient: DrillPatientRow | null;
  canViewPII: boolean;
  onClose: () => void;
  onSendToBuyBack: (p: DrillPatientRow) => void;
}

const PatientDetailModal = ({ patient, canViewPII, onClose, onSendToBuyBack }: PatientDetailModalProps) => {
  const [revealed, setRevealed] = useState<{ nhsNumber?: string; name?: string } | null>(null);
  const [reason, setReason] = useState("");
  const [revealing, setRevealing] = useState(false);

  // Reset on patient change
  useMemo(() => {
    setRevealed(null);
    setReason("");
  }, [patient?.fkPatientLinkId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!patient) return null;

  const handleReveal = async () => {
    if (!canViewPII) {
      toast.error("Your role does not permit identifier reveal");
      return;
    }
    if (reason.trim().length < 4) {
      toast.error("Please provide a reason for accessing identifiers");
      return;
    }
    setRevealing(true);
    try {
      // TODO (Phase 1): call get_patient_identifiable RPC which logs to
      // narp_pii_access_log with { user_id, snapshot_id, reason_text }.
      // For PoC, the data is already in memory from the upload — show it
      // and write a console-side audit breadcrumb.
      console.log("[NRES][audit] Identifier reveal", { fk: patient.fkPatientLinkId, reason });
      setRevealed({
        nhsNumber: patient.nhsNumber,
        name: [patient.forenames, patient.surname].filter(Boolean).join(" ") || undefined,
      });
    } finally {
      setRevealing(false);
    }
  };

  const copyRef = () => {
    navigator.clipboard.writeText(patient.fkPatientLinkId);
    toast.success("Reference copied");
  };

  return (
    <Dialog open={!!patient} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Patient {patient.fkPatientLinkId}
          </DialogTitle>
          <DialogDescription>{patient.practiceName || "Anonymised view"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <Section title="Clinical profile">
            <KV k="Age" v={patient.age ?? "—"} />
            <KV k="Frailty (eFI)" v={patient.frailty} />
            <KV k="Drug count" v={patient.drugCount} />
            <KV k="RUB" v={patient.rub || "—"} />
          </Section>

          <Section title="Utilisation">
            <KV k="Inpatient admissions" v={patient.inpatientAdmissions} />
            <KV k="A&E attendances" v={patient.aeAttendances} />
          </Section>

          <Section title="Risk">
            <KV k="PoA" v={patient.poA !== null ? pct(patient.poA) : "—"} />
            <KV k="PoLoS" v={patient.poLoS !== null ? pct(patient.poLoS) : "—"} />
          </Section>

          {canViewPII && (
            <Section title="Identifiers">
              {revealed ? (
                <>
                  <KV k="NHS Number" v={revealed.nhsNumber ?? "—"} />
                  <KV k="Name" v={revealed.name ?? "—"} />
                </>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for access (e.g. MDT review prep)"
                    className="text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={handleReveal} disabled={revealing}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Reveal identifiers
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Reveals are recorded against your account.
                  </p>
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" className="flex-1" onClick={() => onSendToBuyBack(patient)}>
            <Send className="h-4 w-4 mr-1.5" />
            Send to Buy-Back Claims
          </Button>
          <Button size="sm" variant="outline" onClick={copyRef}>
            <Copy className="h-4 w-4 mr-1.5" />
            Copy ref
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{title}</div>
    <div className="space-y-1">{children}</div>
  </div>
);

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{k}</span>
    <span className="font-medium tabular-nums">{v}</span>
  </div>
);
