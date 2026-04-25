import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  Users, AlertTriangle, TrendingUp, Heart, Layers, Target,
  Upload, FileDown, ListChecks, Loader2, CalendarIcon, FileCheck2,
} from "lucide-react";
import { NRESHeader } from "@/components/nres/NRESHeader";
import { EditorialHeader } from "@/components/dashboard/EditorialHeader";
import { Kpi } from "@/components/dashboard/Kpi";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { PatientDrillDrawer } from "@/components/nres/PatientDrillDrawer";
import { WorklistsTab } from "@/components/nres/WorklistsTab";
import { DrillThroughProvider, useDrillThrough } from "@/hooks/useDrillThrough";
import { useNarpIdentifiableAccess } from "@/hooks/useNarpIdentifiableAccess";
import { useGpPracticeIdByName } from "@/hooks/useGpPracticeIdByName";
import { useAuth } from "@/contexts/AuthContext";
import { ageRiskFilterKey, type AgeBandKey, type RiskTierKey } from "@/lib/narp-filters";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { useIsIPhone } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { ingestNarpExport } from "@/lib/narp-ingest";
import { NarpGlossaryModal } from "@/components/nres/NarpGlossaryModal";
import { ScoreInfoTooltip } from "@/components/nres/ScoreInfoTooltip";
import { cohortTooltips, scoreTooltips } from "@/lib/narp-reference";

/* ────────────────────────────────────────────────────────────
   NRES Population Risk (PoC)
   PoC: parses NARP Patient Activity export client-side.
   TODO: persist parsed rows in Supabase table `narp_exports`
         (practice_id, export_date, patient_rows jsonb) once
         schema is approved by IG.
   ──────────────────────────────────────────────────────────── */

// Risk colour tokens — match existing NRES dashboard palette
const palette = {
  ok: "#15803d",
  rising: "#ca8a04",
  mod: "#d97706",
  high: "#b91c1c",
  vhigh: "#7f1d1d",
  unknown: "#94a3b8",
  accent: "#005EB8",
  accentSoft: "#e7f0f4",
};

type NarpRow = {
  fkPatientLinkId: string;
  nhsNumber?: string;
  forenames?: string;
  surname?: string;
  age: number | null;
  practiceName: string;
  practiceKey: string; // normalised: upper-cased + trimmed + collapsed whitespace
  drugCount: number;
  frailty: "Fit" | "Mild" | "Moderate" | "Severe" | "Unknown";
  inpatientAdmissions: number;
  aeAttendances: number;
  electiveAdmissions: number;
  outpatientFirst: number;
  outpatientFollowUp: number;
  rub: string;
  poA: number | null;        // probability of emergency admission %
  poLoS: number | null;      // probability of extended LoS %
};

type RiskTier = "Very High" | "High" | "Moderate" | "Rising" | "Low" | "Unknown";
type IdentifiableDetails = { nhs_number: string | null; forenames: string | null; surname: string | null };
type IdentifierLookupStatus = "idle" | "loading" | "ready" | "unavailable";
type NarpExportRow = {
  id: string;
  export_date: string;
  uploaded_at: string;
  uploaded_by: string | null;
  patient_count: number;
  status: "processing" | "ready" | "failed";
  error_message: string | null;
  file_name: string | null;
};

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

const tierFor = (poA: number | null): RiskTier => {
  if (poA === null || isNaN(poA)) return "Unknown";
  if (poA > 50) return "Very High";
  if (poA >= 20) return "High";
  if (poA >= 10) return "Moderate";
  if (poA >= 5) return "Rising";
  return "Low";
};

const tierColour: Record<RiskTier, string> = {
  "Very High": palette.vhigh,
  "High": palette.high,
  "Moderate": palette.mod,
  "Rising": palette.rising,
  "Low": palette.ok,
  "Unknown": palette.unknown,
};

const frailtyFromCategory = (raw: string | undefined): NarpRow["frailty"] => {
  if (!raw) return "Unknown";
  const v = raw.toLowerCase();
  if (v.includes("severe")) return "Severe";
  if (v.includes("moderate")) return "Moderate";
  if (v.includes("mild")) return "Mild";
  if (v.includes("fit")) return "Fit";
  return "Unknown";
};

// Robustly convert "12.34%", "(unavailable)", "-", "" to a number or null
const parsePct = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || s === "-" || s.toLowerCase().includes("unavailable")) return null;
  const cleaned = s.replace(/%/g, "").replace(/[(),]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

const parseInt0 = (raw: unknown): number => {
  if (raw === null || raw === undefined || raw === "") return 0;
  const n = parseInt(String(raw).replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
};

const parseAge = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = parseInt(String(raw).replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? null : n;
};

/** Normalise a practice name for matching (case- and whitespace-insensitive) */
const normalisePracticeKey = (raw: unknown): string =>
  String(raw ?? "").toUpperCase().replace(/\s+/g, " ").trim();

const BUGBROOKE_PRACTICE_ID = "85cd140c-2980-40df-8e19-0ffc8a9346d5";
const BUGBROOKE_KEY = normalisePracticeKey("Bugbrooke Medical Practice");

const makeDemoNarpRows = (): NarpRow[] => {
  const names = [
    ["Ada", "Patel", 86, "Severe", 18, 3, 62.4, 41.2, "High complexity frailty"],
    ["George", "Wilson", 79, "Moderate", 12, 2, 34.8, 27.5, "Multiple LTCs"],
    ["Mary", "Thomas", 72, "Mild", 10, 1, 18.2, 19.1, "Rising utilisation"],
    ["Iris", "Ahmed", 91, "Severe", 16, 2, 54.6, 36.8, "Advanced frailty"],
    ["John", "Evans", 68, "Moderate", 9, 1, 22.7, 21.4, "LTC anchor"],
    ["Nora", "Clarke", 64, "Fit", 7, 0, 7.9, 8.5, "Prevention cohort"],
    ["Henry", "Brown", 83, "Moderate", 14, 2, 29.3, 24.6, "SMR candidate"],
    ["Elsie", "Green", 76, "Mild", 5, 0, 4.2, 6.1, "Stable LTC"],
  ] as const;

  return names.map(([forenames, surname, age, frailty, drugCount, admissions, poA, poLoS, rub], index) => ({
    fkPatientLinkId: `DEMO-${String(index + 1).padStart(3, "0")}`,
    nhsNumber: `9449300${String(index + 1).padStart(3, "0")}`,
    forenames,
    surname,
    age,
    practiceName: "Bugbrooke Medical Practice",
    practiceKey: BUGBROOKE_KEY,
    drugCount,
    frailty,
    inpatientAdmissions: admissions,
    aeAttendances: Math.max(0, admissions - 1),
    electiveAdmissions: 0,
    outpatientFirst: 1,
    outpatientFollowUp: 2,
    rub,
    poA,
    poLoS,
  }));
};

/** Map a parsed row from the NARP export to our internal shape */
const mapNarpRow = (r: Record<string, unknown>): NarpRow | null => {
  const fk = r["FK_Patient_Link_ID"] ?? r["FK Patient Link ID"];
  if (!fk) return null;
  return {
    fkPatientLinkId: String(fk),
    nhsNumber: r["NHS Number"] ? String(r["NHS Number"]) : undefined,
    forenames: r["Forenames"] ? String(r["Forenames"]) : undefined,
    surname: r["Surname"] ? String(r["Surname"]) : undefined,
    age: parseAge(r["Age"]),
    practiceName: String(r["PracticeName"] ?? ""),
    practiceKey: normalisePracticeKey(r["PracticeName"]),
    drugCount: parseInt0(r["Drug Count"]),
    frailty: frailtyFromCategory(r["Frailty (eFI) Category"] as string),
    inpatientAdmissions: parseInt0(r["Inpatient - Total Admissions"]),
    aeAttendances: parseInt0(r["A&E Attendances"]),
    electiveAdmissions: parseInt0(r["Inpatient - Elective Admissions"]),
    outpatientFirst: parseInt0(r["Outpatient - First Appointments"]),
    outpatientFollowUp: parseInt0(r["Outpatient - Follow-Up Appointments"]),
    rub: String(r["RUB"] ?? ""),
    poA: parsePct(r["Probability of Emergency Admission"]),
    poLoS: parsePct(r["Probability of Extended LoS"]),
  };
};

// Simple CSV parser (no external dep). Handles quoted fields with commas.
const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ""; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch === '\r') { /* skip */ }
      else { cell += ch; }
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(c => c && c.length)).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
};

const fmt = (n: number) => n.toLocaleString("en-GB");
const fmtDate = (iso?: string | null) => iso
  ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  : "not loaded";
const today = () => new Date().toISOString().slice(0, 10);

const csvEscape = (value: unknown): string => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const patientDisplayName = (details?: IdentifiableDetails, row?: Pick<NarpRow, "forenames" | "surname">) =>
  [details?.forenames ?? row?.forenames, details?.surname ?? row?.surname].filter(Boolean).join(" ");

const NRESPopulationRiskInner = () => {
  const drill = useDrillThrough();
  const isIPhone = useIsIPhone();
  const { user } = useAuth();
  const [rows, setRows] = useState<NarpRow[]>([]);
  const [selectedPractice, setSelectedPractice] = useState<string>(BUGBROOKE_KEY);
  const [tab, setTab] = useState("overview");
  const [showIdentifiersPreference, setShowIdentifiersPreferenceState] = useState(false);
  const [identifierPreferenceLoaded, setIdentifierPreferenceLoaded] = useState(false);
  const [uploadsRefreshSignal, setUploadsRefreshSignal] = useState(0);
  const [isHeaderUploading, setIsHeaderUploading] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [narpExports, setNarpExports] = useState<NarpExportRow[]>([]);
  const [exportsLoading, setExportsLoading] = useState(false);
  const [exportDate, setExportDate] = useState(today());
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [canUploadNarp, setCanUploadNarp] = useState(false);
  const identifierPreferenceKey = user?.id
    ? `nres:population-risk:show-identifiers:${user.id}`
    : null;

  useEffect(() => {
    setIdentifierPreferenceLoaded(false);
    if (!identifierPreferenceKey) {
      setShowIdentifiersPreferenceState(false);
      setIdentifierPreferenceLoaded(true);
      return;
    }
    try {
      setShowIdentifiersPreferenceState(localStorage.getItem(identifierPreferenceKey) === "true");
    } catch (error) {
      console.warn("[NRESPopulationRisk] Could not read identifier preference", error);
      setShowIdentifiersPreferenceState(false);
    } finally {
      setIdentifierPreferenceLoaded(true);
    }
  }, [identifierPreferenceKey]);

  useEffect(() => {
    if (!identifierPreferenceKey || !identifierPreferenceLoaded) return;
    try {
      localStorage.setItem(identifierPreferenceKey, showIdentifiersPreference ? "true" : "false");
    } catch (error) {
      console.warn("[NRESPopulationRisk] Could not save identifier preference", error);
    }
  }, [identifierPreferenceKey, identifierPreferenceLoaded, showIdentifiersPreference]);

  const setShowIdentifiersPreference = useCallback((visible: boolean) => {
    setShowIdentifiersPreferenceState(visible);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "?" && !isTyping) {
        event.preventDefault();
        setGlossaryOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Resolve the selected practice's UUID so we can scope the NMoC DSA
  // identifiable-data permission check correctly. "All Practices" deliberately
  // resolves to null — there is no single practice to grant permission for, so
  // identifiers stay hidden in that mode.
  const { data: selectedPracticeId } = useGpPracticeIdByName(
    selectedPractice === "All Practices" ? null : selectedPractice,
  );

  // Per-practice NARP identifiable-data access (NMoC DSA).
  // - canView: see NHS number / name inline for THIS practice
  // - canExport: see "Export with identifiers" button for THIS practice
  // - hasViewElsewhere: rare cross-practice exception (reveal + reason flow)
  const narpAccess = useNarpIdentifiableAccess({
    practiceId: selectedPracticeId ?? null,
    patientCountRendered: 0, // updated below once `filtered` is computed
    route: "/nres/population-risk",
    enableAudit: false, // audit fires from the inner effect using filtered.length
  });
  const canViewPII = narpAccess.canView;
  const canExportPII = narpAccess.canExport;
  const hasViewElsewhere = narpAccess.hasViewElsewhere;

  const narpExportPracticeId = selectedPracticeId ?? BUGBROOKE_PRACTICE_ID;

  const loadNarpExports = useCallback(async () => {
    setExportsLoading(true);
    const { data, error } = await supabase
      .from("narp_exports")
      .select("id, export_date, uploaded_at, uploaded_by, patient_count, status, error_message, file_name")
      .eq("practice_id", narpExportPracticeId)
      .order("export_date", { ascending: false })
      .limit(5);
    if (error) {
      toast.error(`Could not load uploads: ${error.message}`);
      setNarpExports([]);
    } else {
      setNarpExports((data ?? []) as NarpExportRow[]);
    }
    setExportsLoading(false);
  }, [narpExportPracticeId]);

  useEffect(() => { loadNarpExports(); }, [loadNarpExports, uploadsRefreshSignal]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !narpExportPracticeId) {
      setCanUploadNarp(false);
      return;
    }
    (supabase as any).rpc("has_narp_upload_access", {
      p_user: user.id,
      p_practice: narpExportPracticeId,
    }).then(({ data, error }) => {
      if (!cancelled) setCanUploadNarp(!error && data === true);
    });
    return () => { cancelled = true; };
  }, [user?.id, narpExportPracticeId]);

  const reloadPersistedExport = useCallback(async (exportId: string) => {
    const { data, error } = await supabase
      .from("narp_patient_snapshots" as any)
      .select("fk_patient_link_id, age, drug_count, frailty_category, inpatient_total_admissions, ae_attendances, inpatient_elective, outpatient_first, outpatient_followup, rub, poa, polos")
      .eq("export_id", exportId)
      .order("poa", { ascending: false, nullsFirst: false });
    if (error) {
      toast.error(`Could not refresh persisted NARP rows: ${error.message}`);
      return;
    }

    const persistedRows = ((data ?? []) as any[]).map((row): NarpRow => ({
      fkPatientLinkId: String(row.fk_patient_link_id ?? ""),
      age: typeof row.age === "number" ? row.age : null,
      practiceName: "Bugbrooke Medical Practice",
      practiceKey: BUGBROOKE_KEY,
      drugCount: Number(row.drug_count ?? 0),
      frailty: (row.frailty_category ?? "Unknown") as NarpRow["frailty"],
      inpatientAdmissions: Number(row.inpatient_total_admissions ?? 0),
      aeAttendances: Number(row.ae_attendances ?? 0),
      electiveAdmissions: Number(row.inpatient_elective ?? 0),
      outpatientFirst: Number(row.outpatient_first ?? 0),
      outpatientFollowUp: Number(row.outpatient_followup ?? 0),
      rub: String(row.rub ?? ""),
      poA: typeof row.poa === "number" ? row.poa : null,
      poLoS: typeof row.polos === "number" ? row.polos : null,
    })).filter((row) => row.fkPatientLinkId);

    if (persistedRows.length) {
      setRows(persistedRows);
    }
  }, []);

  const handleUpload = useCallback(async (file: File, dataAsAt = today()) => {
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      let raw: Record<string, unknown>[] = [];
      if (ext === "csv") {
        const text = await file.text();
        raw = parseCsv(text);
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else {
        toast.error("Unsupported file type — upload .xlsx or .csv");
        return;
      }
      const mapped = raw.map(mapNarpRow).filter((r): r is NarpRow => r !== null);
      if (!mapped.length) {
        toast.error("No valid patient rows found in file");
        return;
      }
      setRows(mapped);
      toast.success(`Loaded ${fmt(mapped.length)} patients from ${file.name}`);
      setIsHeaderUploading(true);
      const ingestToast = toast.loading(`Persisting ${file.name}…`);
      try {
        const body = await ingestNarpExport({
          file,
          practiceId: BUGBROOKE_PRACTICE_ID,
          exportDate: dataAsAt,
          parsedRows: raw,
        });
        toast.dismiss(ingestToast);
        if (body.duplicate) {
          toast.warning("This file has already been uploaded — using the existing export.");
        } else {
          toast.success(
            `Ingested ${body.patient_count?.toLocaleString("en-GB") ?? fmt(mapped.length)} patients from ${file.name}`,
          );
        }
        setUploadsRefreshSignal((value) => value + 1);
        await reloadPersistedExport(body.export_id);
      } catch (ingestError) {
        toast.dismiss(ingestToast);
        throw ingestError;
      } finally {
        setIsHeaderUploading(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload file: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }, [reloadPersistedExport]);

  // Available practices in the loaded data — keyed by normalised name, label is first-seen casing
  const practices = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.practiceKey && !map.has(r.practiceKey)) {
        map.set(r.practiceKey, r.practiceName || r.practiceKey);
      }
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // Filtered rows for selected practice (compare on normalised key)
  const filtered = useMemo(() => {
    if (!rows.length) return [];
    if (selectedPractice === "All Practices") return rows;
    return rows.filter(r => r.practiceKey === selectedPractice);
  }, [rows, selectedPractice]);

  // ── Aggregations ─────────────────────────────────────────
  const summary = useMemo(() => {
    const total = filtered.length;
    const aged65Plus = filtered.filter(r => (r.age ?? 0) >= 65).length;
    const ages = filtered.map(r => r.age).filter((a): a is number => a !== null);
    const meanAge = ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : 0;
    const severe = filtered.filter(r => r.frailty === "Severe").length;
    const moderate = filtered.filter(r => r.frailty === "Moderate").length;
    const mild = filtered.filter(r => r.frailty === "Mild").length;
    const poly10 = filtered.filter(r => r.drugCount >= 10).length;
    const poly15 = filtered.filter(r => r.drugCount >= 15).length;
    const poly20 = filtered.filter(r => r.drugCount >= 20).length;
    const adm1 = filtered.filter(r => r.inpatientAdmissions >= 1).length;
    const adm2 = filtered.filter(r => r.inpatientAdmissions >= 2).length;
    return {
      total, aged65Plus,
      pct65Plus: total ? (aged65Plus / total) * 100 : 0,
      meanAge, severe, moderate, mild, poly10, poly15, poly20, adm1, adm2,
    };
  }, [filtered]);

  const riskPyramid = useMemo(() => {
    const buckets: Record<RiskTier, number> = {
      "Very High": 0, "High": 0, "Moderate": 0, "Rising": 0, "Low": 0, "Unknown": 0,
    };
    filtered.forEach(r => { buckets[tierFor(r.poA)]++; });
    const total = filtered.length || 1;
    return (Object.keys(buckets) as RiskTier[]).map(tier => ({
      tier,
      band: tier === "Very High" ? ">50% PoA" :
            tier === "High" ? "20–50% PoA" :
            tier === "Moderate" ? "10–20% PoA" :
            tier === "Rising" ? "5–10% PoA" :
            tier === "Low" ? "<5% PoA" : "no data",
      n: buckets[tier],
      pct: (buckets[tier] / total) * 100,
      colour: tierColour[tier],
    }));
  }, [filtered]);

  const frailtyStats = useMemo(() => {
    const groups: NarpRow["frailty"][] = ["Fit", "Mild", "Moderate", "Severe"];
    return groups.map(g => {
      const set = filtered.filter(r => r.frailty === g);
      const n = set.length;
      const meanPoA = n ? set.reduce((s, r) => s + (r.poA ?? 0), 0) / n : 0;
      const meanAdm = n ? set.reduce((s, r) => s + r.inpatientAdmissions, 0) / n : 0;
      const meanDrugs = n ? set.reduce((s, r) => s + r.drugCount, 0) / n : 0;
      return {
        name: g, n,
        mean_PoA: +meanPoA.toFixed(2),
        mean_adm: +meanAdm.toFixed(2),
        mean_drugs: +meanDrugs.toFixed(1),
      };
    });
  }, [filtered]);

  const ageBands = useMemo(() => {
    const bands = [
      { band: "0–17",  test: (a: number) => a <= 17 },
      { band: "18–39", test: (a: number) => a >= 18 && a <= 39 },
      { band: "40–64", test: (a: number) => a >= 40 && a <= 64 },
      { band: "65–74", test: (a: number) => a >= 65 && a <= 74 },
      { band: "75–84", test: (a: number) => a >= 75 && a <= 84 },
      { band: "85+",   test: (a: number) => a >= 85 },
    ];
    return bands.map(b => ({
      band: b.band,
      n: filtered.filter(r => r.age !== null && b.test(r.age)).length,
    }));
  }, [filtered]);

  const ageRiskHeatmap = useMemo(() => {
    const bands = [
      { age: "0–17",  test: (a: number) => a <= 17 },
      { age: "18–39", test: (a: number) => a >= 18 && a <= 39 },
      { age: "40–64", test: (a: number) => a >= 40 && a <= 64 },
      { age: "65–74", test: (a: number) => a >= 65 && a <= 74 },
      { age: "75–84", test: (a: number) => a >= 75 && a <= 84 },
      { age: "85+",   test: (a: number) => a >= 85 },
    ];
    return bands.map(b => {
      const set = filtered.filter(r => r.age !== null && b.test(r.age));
      const counts = { VeryHigh: 0, High: 0, Moderate: 0, Rising: 0, Low: 0 };
      set.forEach(r => {
        const t = tierFor(r.poA);
        if (t === "Very High") counts.VeryHigh++;
        else if (t === "High") counts.High++;
        else if (t === "Moderate") counts.Moderate++;
        else if (t === "Rising") counts.Rising++;
        else if (t === "Low") counts.Low++;
      });
      return { age: b.age, ...counts };
    });
  }, [filtered]);

  const cohorts = useMemo(() => {
    const intensiveMDT = filtered.filter(r => (r.poA ?? 0) >= 20);
    const ltcAnchor = filtered.filter(r => (r.age ?? 0) >= 65 && (r.frailty === "Moderate" || r.frailty === "Severe"));
    const smr = filtered.filter(r => r.drugCount >= 10);
    const rising = filtered.filter(r => { const p = r.poA; return p !== null && p >= 5 && p < 10; });
    const admissions = filtered.filter(r => r.inpatientAdmissions >= 2);
    const falls = filtered.filter(r => r.frailty === "Severe");
    const frailtyReview = filtered.filter(r => r.frailty === "Moderate" || r.frailty === "Severe");
    return [
      { id: "vhhr",   label: "Intensive MDT caseload",      detail: "Very High + High risk (PoA ≥ 20%)",      n: intensiveMDT.length, weekly: Math.max(1, Math.round(intensiveMDT.length / 50)),  intervention: "Weekly MDT review · care coordinator · PCP", colour: palette.vhigh },
      { id: "ltc",    label: "LTC anchor cohort",           detail: "65+ with Moderate/Severe frailty",       n: ltcAnchor.length,    weekly: Math.max(1, Math.round(ltcAnchor.length / 50)),     intervention: "Annual structured LTC review · ACP in place", colour: palette.high },
      { id: "smr",    label: "SMR-eligible (polypharmacy)", detail: "10+ repeat medications",                  n: smr.length,          weekly: Math.max(1, Math.round(smr.length / 52)),           intervention: "Clinical Pharmacist structured medication review", colour: palette.mod },
      { id: "rising", label: "Rising-risk prevention",      detail: "PoA 5–10% — pre-frailty / emerging LTC",  n: rising.length,       weekly: Math.max(1, Math.round(rising.length / 52)),        intervention: "SPLW / HCA annual review · lifestyle + screening", colour: palette.rising },
      { id: "adm",    label: "Admission avoidance",         detail: "2+ inpatient admissions in year",         n: admissions.length,   weekly: Math.max(1, Math.round(admissions.length / 50)),    intervention: "Post-discharge review · ACP · virtual ward flag", colour: palette.high },
      { id: "falls",  label: "Falls-risk cohort",           detail: "Severe frailty (all ages)",               n: falls.length,        weekly: Math.max(1, Math.round(falls.length / 50)),         intervention: "Falls pathway · home assessment · strength/balance", colour: palette.vhigh },
      { id: "frev",   label: "Frailty review backlog",      detail: "Moderate + Severe eFI",                   n: frailtyReview.length,weekly: Math.max(1, Math.round(frailtyReview.length / 50)), intervention: "CGA · ReSPECT · annual frailty review", colour: palette.high },
    ];
  }, [filtered]);

  const topRisk = useMemo(() => {
    return [...filtered]
      .filter(r => r.poA !== null)
      .sort((a, b) => (b.poA ?? 0) - (a.poA ?? 0))
      .slice(0, 25);
  }, [filtered]);

  const resolveIdentifiableDetails = useCallback(async (targetRows: NarpRow[]) => {
    if (!selectedPracticeId) {
      toast.error("Select a single practice before exporting identifiers");
      return null;
    }
    const details: Record<string, IdentifiableDetails> = {};
    const refs = Array.from(new Set(targetRows.map((r) => r.fkPatientLinkId).filter(Boolean)));
    const rpcRefs: string[] = [];
    for (const ref of refs) {
      if (DEMO_IDENTIFIABLE_DETAILS[ref]) details[ref] = DEMO_IDENTIFIABLE_DETAILS[ref];
      else rpcRefs.push(ref);
    }
    if (rpcRefs.length) {
      const { data, error } = await (supabase as any).rpc("get_narp_identifiable_by_refs", {
        _practice_id: selectedPracticeId,
        _fk_patient_link_ids: rpcRefs,
      });
      if (error) {
        toast.error("Could not load identifiable details");
        return null;
      }
      for (const row of data ?? []) {
        details[row.fk_patient_link_id] = {
          nhs_number: row.nhs_number ?? null,
          forenames: row.forenames ?? null,
          surname: row.surname ?? null,
        };
      }
    }
    return details;
  }, [selectedPracticeId]);

  const exportCohortCsv = async (cohortId: string) => {
    const cohortMap: Record<string, NarpRow[]> = {
      vhhr:   filtered.filter(r => (r.poA ?? 0) >= 20),
      ltc:    filtered.filter(r => (r.age ?? 0) >= 65 && (r.frailty === "Moderate" || r.frailty === "Severe")),
      smr:    filtered.filter(r => r.drugCount >= 10),
      rising: filtered.filter(r => { const p = r.poA; return p !== null && p >= 5 && p < 10; }),
      adm:    filtered.filter(r => r.inpatientAdmissions >= 2),
      falls:  filtered.filter(r => r.frailty === "Severe"),
      frev:   filtered.filter(r => r.frailty === "Moderate" || r.frailty === "Severe"),
    };
    const data = cohortMap[cohortId] ?? [];
    if (!data.length) { toast.info("No patients in cohort"); return; }
    const includeIdentifiers = canViewPII && showIdentifiersPreference;
    const details = includeIdentifiers ? await resolveIdentifiableDetails(data) : null;
    if (includeIdentifiers && !details) return;
    const headers = includeIdentifiers
      ? ["NHS_Number", "Name", "Age", "Frailty", "Drug Count", "Inpatient Admissions", "RUB", "PoA %", "PoLoS %"]
      : ["FK_Patient_Link_ID", "Age", "Frailty", "Drug Count", "Inpatient Admissions", "RUB", "PoA %", "PoLoS %"];
    const lines = [headers.join(",")].concat(data.map(r => {
      const base = [r.age ?? "", r.frailty, r.drugCount, r.inpatientAdmissions, r.rub, r.poA ?? "", r.poLoS ?? ""];
      const values = includeIdentifiers
        ? [details?.[r.fkPatientLinkId]?.nhs_number ?? r.nhsNumber ?? "", patientDisplayName(details?.[r.fkPatientLinkId], r), ...base]
        : [r.fkPatientLinkId, ...base];
      return values.map(csvEscape).join(",");
    }));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nres-cohort-${cohortId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const empty = !rows.length;

  const loadDemoData = () => {
    const demoRows = makeDemoNarpRows();
    setRows(demoRows);
    setSelectedPractice(BUGBROOKE_KEY);
    toast.success(`Loaded ${fmt(demoRows.length)} demo patients`);
  };

  const submitDrawerUpload = async () => {
    if (!pickedFile) {
      toast.error("Choose a NARP file first");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exportDate)) {
      toast.error("Choose a valid export date");
      return;
    }
    await handleUpload(pickedFile, exportDate);
    setPickedFile(null);
    setUploadDrawerOpen(false);
    await loadNarpExports();
  };

  const latestExport = narpExports[0];
  const practiceOptions = [
    { key: BUGBROOKE_KEY, label: "Bugbrooke Medical Practice" },
    { key: "All Practices", label: "All Practices (in upload)" },
    ...practices.filter(p => p.key !== BUGBROOKE_KEY),
  ];

  return (
    <div className="narp-editorial min-h-screen bg-narp-mist">
      <NRESHeader activeTab="population-risk" />
      <EditorialHeader
        practiceName={selectedPractice === "All Practices" ? "All Practices" : "Bugbrooke Medical Practice"}
        patientCount={fmt(summary.total)}
        dataAsAt={fmtDate(latestExport?.export_date)}
        pcnName="Blue PCN"
        selectedPractice={selectedPractice}
        practices={practiceOptions}
        onPracticeChange={setSelectedPractice}
        canUploadNarp={canUploadNarp}
        showDemoAction={!import.meta.env.PROD && empty}
        onUpload={() => setUploadDrawerOpen(true)}
        onManageExports={() => setUploadDrawerOpen(true)}
        onGlossary={() => setGlossaryOpen(true)}
        onLoadDemo={loadDemoData}
      />

      <div className={`container mx-auto py-4 ${isIPhone ? "px-2" : "px-4"} space-y-4`}>
        {empty && (
          <div className="border border-narp-line bg-card p-12 text-center">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No data loaded</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Upload an NARP Patient Activity export to see risk stratification, frailty profile,
              action cohorts and the top-25 highest-risk patient list.
            </p>
            <Button onClick={() => setUploadDrawerOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload NARP file
            </Button>
          </div>
        )}

        {!empty && (
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="overview" className="gap-2"><Layers className="w-4 h-4" />Overview</TabsTrigger>
              <TabsTrigger value="ltc" className="gap-2"><Heart className="w-4 h-4" />LTC Focus</TabsTrigger>
              <TabsTrigger value="cohorts" className="gap-2"><Target className="w-4 h-4" />NRES Cohorts</TabsTrigger>
              <TabsTrigger value="toprisk" className="gap-2"><AlertTriangle className="w-4 h-4" />Top 25 Risk</TabsTrigger>
              <TabsTrigger value="worklists" className="gap-2"><ListChecks className="w-4 h-4" />Worklists</TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi icon={Users} label="Registered patients" value={fmt(summary.total)} sub={`${summary.pct65Plus.toFixed(1)}% aged 65+`} onClick={() => drill.open("all")} />
                <Kpi icon={AlertTriangle} label={<span className="inline-flex items-center gap-1">High-risk (PoA ≥ 20%)<ScoreInfoTooltip text={scoreTooltips.highRisk.text} anchor={scoreTooltips.highRisk.anchor} /></span>} value={fmt(riskPyramid[0].n + riskPyramid[1].n)} sub="MDT caseload" tone="critical" onClick={() => drill.open("high_risk")} />
                <Kpi icon={TrendingUp} label={<span className="inline-flex items-center gap-1">Rising-risk (5–10% PoA)<ScoreInfoTooltip text={scoreTooltips.risingRisk.text} anchor={scoreTooltips.risingRisk.anchor} /></span>} value={fmt(riskPyramid[3].n)} sub="Prevention target" tone="warn" onClick={() => drill.open("rising_risk")} />
                <Kpi icon={Heart} label={<span className="inline-flex items-center gap-1">Mod/Severe frailty<ScoreInfoTooltip text={scoreTooltips.frailty.text} anchor={scoreTooltips.frailty.anchor} /></span>} value={fmt(summary.severe + summary.moderate)} sub={`${summary.severe} severe · ${summary.moderate} moderate`} tone="warn" onClick={() => drill.open("mod_sev_frailty")} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Risk pyramid */}
                <div className="border border-narp-line bg-card p-5">
                  <SectionTitle eyebrow="Risk stratification" title="Population risk pyramid" lede="Tiered by Probability of Emergency Admission (PoA). Click any row to drill in.">
                    <ScoreInfoTooltip text={scoreTooltips.riskTier.text} anchor={scoreTooltips.riskTier.anchor} />
                  </SectionTitle>
                  <div className="space-y-2">
                    {riskPyramid.filter(r => r.tier !== "Unknown").map(r => {
                      const maxN = Math.max(...riskPyramid.filter(x => x.tier !== "Unknown").map(x => x.n), 1);
                      const w = (r.n / maxN) * 100;
                      const tierKey = ({ "Very High": "tier_very_high", "High": "tier_high", "Moderate": "tier_moderate", "Rising": "tier_rising", "Low": "tier_low" } as const)[r.tier as Exclude<RiskTier, "Unknown">];
                      return (
                        <button
                          key={r.tier}
                          type="button"
                          disabled={!r.n}
                          onClick={() => drill.open(tierKey)}
                          className="w-full text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold">{r.tier} <span className="text-muted-foreground font-normal">· {r.band}</span></span>
                            <span className="tabular-nums group-hover:underline">{fmt(r.n)} <span className="text-muted-foreground">({r.pct.toFixed(1)}%)</span></span>
                          </div>
                          <div className="h-5 bg-slate-100 rounded-sm overflow-hidden">
                            <div className="h-full transition-all group-hover:opacity-80" style={{ width: `${w}%`, background: r.colour }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {riskPyramid[5].n > 0 && (
                    <button
                      type="button"
                      onClick={() => drill.open("tier_unknown")}
                      className="text-xs text-muted-foreground mt-3 pt-3 border-t border-dashed w-full text-left hover:underline"
                    >
                      {fmt(riskPyramid[5].n)} patients ({riskPyramid[5].pct.toFixed(1)}%) have no PoA.
                    </button>
                  )}
                </div>

                {/* Frailty bar chart */}
                <div className="border border-narp-line bg-card p-5">
                  <SectionTitle eyebrow="Where to aim effort" title="Utilisation by frailty" lede="Click a frailty category to drill into its patients." />
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={frailtyStats}
                      onClick={(e: any) => {
                        const name = e?.activeLabel as string | undefined;
                        if (!name) return;
                        const map: Record<string, string> = { Fit: "frailty_fit", Mild: "frailty_mild", Moderate: "frailty_moderate", Severe: "frailty_severe" };
                        if (map[name]) drill.open(map[name]);
                      }}
                    >
                      <CartesianGrid strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                      <Bar dataKey="mean_PoA" name="Mean PoA (%)" fill={palette.accent} className="cursor-pointer" />
                      <Bar dataKey="mean_drugs" name="Mean drug count" fill={palette.mod} className="cursor-pointer" />
                      <Bar dataKey="mean_adm" name="Mean admissions" fill={palette.vhigh} className="cursor-pointer" />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Age x risk heatmap */}
              <div className="border border-narp-line bg-card p-5">
                <SectionTitle eyebrow="Risk by age" title="Age band × risk tier" lede="Where the risk sits — older bands carry the High and Very-High load; the 40–64 Rising-risk cell is the upstream prevention opportunity.">
                  <ScoreInfoTooltip text={scoreTooltips.riskTier.text} anchor={scoreTooltips.riskTier.anchor} />
                </SectionTitle>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-muted-foreground uppercase tracking-wide">
                        <th className="text-left p-2 border-b">Age band</th>
                        <th className="p-2 border-b">Very High</th>
                        <th className="p-2 border-b">High</th>
                        <th className="p-2 border-b">Moderate</th>
                        <th className="p-2 border-b">Rising</th>
                        <th className="p-2 border-b">Low</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ageRiskHeatmap.map(r => {
                        const max = (k: keyof typeof r) => Math.max(...ageRiskHeatmap.map(x => x[k] as number), 1);
                        const ageBandKey = r.age.replace("–", "-") as AgeBandKey;
                        const cell = (v: number, m: number, c: string, tierKey: RiskTierKey, subtle = false) => {
                          const i = Math.min(v / m, 1);
                          const bg = subtle
                            ? `rgba(21,128,61,${i * 0.12})`
                            : hexToRgba(c, i * 0.85 + 0.05);
                          return (
                            <td className="p-0 border-b" style={{ background: bg }}>
                              <button
                                type="button"
                                disabled={!v}
                                onClick={() => drill.open(ageRiskFilterKey(ageBandKey, tierKey))}
                                className="w-full h-full p-3 text-center tabular-nums hover:underline disabled:cursor-not-allowed disabled:no-underline"
                                style={{ color: i > 0.5 && !subtle ? "#fff" : undefined, fontWeight: i > 0.4 ? 600 : 400 }}
                              >
                                {fmt(v)}
                              </button>
                            </td>
                          );
                        };
                        return (
                          <tr key={r.age}>
                            <td className="p-3 font-semibold border-b">{r.age}</td>
                            {cell(r.VeryHigh, max("VeryHigh"), palette.vhigh, "very_high")}
                            {cell(r.High,     max("High"),     palette.high,  "high")}
                            {cell(r.Moderate, max("Moderate"), palette.mod,   "moderate")}
                            {cell(r.Rising,   max("Rising"),   palette.rising,"rising")}
                            {cell(r.Low,      max("Low"),      palette.ok,    "low", true)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Age band distribution */}
              <div className="border border-narp-line bg-card p-5">
                <SectionTitle eyebrow="Population shape" title="Age band distribution" />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ageBands}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="n" name="Patients" fill={palette.accent} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* LTC */}
            <TabsContent value="ltc" className="space-y-4">
              <LtcSection summary={summary} filtered={filtered} onDrill={drill.open} />
            </TabsContent>

            {/* COHORTS */}
            <TabsContent value="cohorts" className="space-y-4">
              <CohortsSection cohorts={cohorts} totalPatients={summary.total} onExport={exportCohortCsv} onDrill={drill.open} />
            </TabsContent>

            {/* TOP 25 */}
            <TabsContent value="toprisk" className="space-y-4">
              <TopRiskSection
                rows={topRisk}
                canViewPII={canViewPII}
                identifiersVisible={showIdentifiersPreference}
                onIdentifiersVisibleChange={setShowIdentifiersPreference}
                practiceId={selectedPracticeId ?? null}
                onDrill={drill.open}
              />
            </TabsContent>

            {/* WORKLISTS */}
            <TabsContent value="worklists" className="space-y-4">
              <WorklistsTab
                practiceId={selectedPracticeId ?? null}
                practiceName={selectedPractice === "All Practices" ? undefined : selectedPractice}
                onOpenPatient={drill.open}
              />
            </TabsContent>
          </Tabs>
        )}
        <footer className="border-t border-narp-line pt-3 text-right text-[11px] text-muted-foreground">
          Proof of Concept · v0.4 · {fmtDate(latestExport?.export_date)}
        </footer>
      </div>

      {/* Drill-through drawer (single source of truth for every clickable count) */}
      <PatientDrillDrawer
        rows={filtered}
        canViewPII={canViewPII}
        canExportPII={canExportPII}
        hasViewElsewhere={hasViewElsewhere}
        identifiersVisible={showIdentifiersPreference}
        onIdentifiersVisibleChange={setShowIdentifiersPreference}
        practiceId={selectedPracticeId ?? null}
        practiceName={selectedPractice === "All Practices" ? undefined : selectedPractice}
        route="/nres/population-risk"
      />
      <Sheet open={uploadDrawerOpen} onOpenChange={setUploadDrawerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle className="narp-display text-2xl font-medium">Upload NARP export</SheetTitle>
            <SheetDescription>Adds a monthly snapshot for Bugbrooke Medical Practice</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>Export date (data as at)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(`${exportDate}T00:00:00`), "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(`${exportDate}T00:00:00`)}
                    onSelect={(date) => date && setExportDate(date.toISOString().slice(0, 10))}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="narp-upload-file">NARP file (.xlsx or .csv)</Label>
              <input
                id="narp-upload-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => setPickedFile(event.target.files?.[0] ?? null)}
                className="h-10 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:text-xs"
                disabled={isHeaderUploading}
              />
            </div>

            <Button onClick={submitDrawerUpload} disabled={!pickedFile || isHeaderUploading} className="w-full">
              {isHeaderUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isHeaderUploading ? "Uploading…" : "Upload"}
            </Button>

            <div className="border-t border-narp-line pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-narp-slate">Recent uploads</h3>
              {exportsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
              ) : narpExports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No uploads yet. Choose an export date and NARP file to create the first monthly snapshot.</p>
              ) : (
                <div className="space-y-2">
                  {narpExports.map((item) => (
                    <div key={item.id} className="border border-narp-line bg-card p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-narp-ink">{fmtDate(item.export_date)}</span>
                        <span className="inline-flex items-center gap-1 border border-narp-line px-2 py-0.5 text-[11px] uppercase tracking-wide text-narp-slate">
                          {item.status === "ready" ? <FileCheck2 className="h-3 w-3 text-narp-good" /> : item.status === "processing" ? <Loader2 className="h-3 w-3 animate-spin text-narp-warn" /> : <AlertTriangle className="h-3 w-3 text-narp-critical" />}
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {item.uploaded_by ?? "Unknown user"} · {fmt(item.patient_count ?? 0)} rows · {fmtDate(item.uploaded_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="mt-6 border-t border-narp-line pt-4 text-left text-xs text-muted-foreground sm:justify-start">
            All uploads are logged. SHA-256 checksums prevent duplicate processing.
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <NarpGlossaryModal open={glossaryOpen} onOpenChange={setGlossaryOpen} />
    </div>
  );
};

const NRESPopulationRisk = () => (
  <DrillThroughProvider>
    <NRESPopulationRiskInner />
  </DrillThroughProvider>
);

/* ─── Sub-components ──────────────────────────────────────── */

const ScoreHeader = ({ label, tip, align = "left" }: { label: string; tip: { text: string; anchor: string }; align?: "left" | "right" }) => (
  <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
    <span>{label}</span>
    <ScoreInfoTooltip text={tip.text} anchor={tip.anchor} />
  </span>
);

const LtcSection = ({ summary, filtered, onDrill }: { summary: ReturnType<typeof Object>; filtered: NarpRow[]; onDrill?: (key: string) => void }) => {
  const ltcBreakdown = useMemo(() => {
    const set = filtered.filter(r => (r.age ?? 0) >= 65);
    const fit = set.filter(r => r.frailty === "Fit").length;
    const mild = set.filter(r => r.frailty === "Mild").length;
    const mod = set.filter(r => r.frailty === "Moderate").length;
    const sev = set.filter(r => r.frailty === "Severe").length;
    return [
      { name: "Fit (65+)",          value: fit, colour: palette.ok },
      { name: "Mild frailty (65+)", value: mild, colour: palette.rising },
      { name: "Moderate (65+)",     value: mod, colour: palette.mod },
      { name: "Severe (65+)",       value: sev, colour: palette.vhigh },
    ];
  }, [filtered]);
  const totalLTC = ltcBreakdown.reduce((s, x) => s + x.value, 0);

  const frailtyScatter = useMemo(() => {
    const groups: NarpRow["frailty"][] = ["Fit", "Mild", "Moderate", "Severe"];
    return groups.map((g, i) => {
      const set = filtered.filter(r => r.frailty === g);
      const n = set.length;
      const drugs = n ? set.reduce((s, r) => s + r.drugCount, 0) / n : 0;
      const poA = n ? set.reduce((s, r) => s + (r.poA ?? 0), 0) / n : 0;
      return { name: g, drugs: +drugs.toFixed(1), mean_PoA: +poA.toFixed(2), n, fill: [palette.ok, palette.rising, palette.mod, palette.vhigh][i] };
    });
  }, [filtered]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-narp-line bg-card p-5">
          <SectionTitle eyebrow="LTC focus" title="65+ population by frailty" lede={`${totalLTC.toLocaleString("en-GB")} patients`} />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ltcBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                {ltcBreakdown.map((e, i) => <Cell key={i} fill={e.colour} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {ltcBreakdown.map(e => {
              const drillKey: Record<string, string> = {
                "Fit (65+)": "over65_fit",
                "Mild frailty (65+)": "over65_mild",
                "Moderate (65+)": "over65_moderate",
                "Severe (65+)": "over65_severe",
              };
              const k = drillKey[e.name];
              return (
                <button
                  key={e.name}
                  type="button"
                  onClick={k && onDrill ? () => onDrill(k) : undefined}
                  className={`flex items-center gap-2 text-xs text-left rounded px-1 py-0.5 ${k && onDrill ? "hover:bg-slate-100 cursor-pointer" : ""}`}
                >
                  <span className="w-2.5 h-2.5 inline-block" style={{ background: e.colour }} />
                  <span className="text-slate-600 flex-1">{e.name}</span>
                  <span className="font-semibold tabular-nums">{e.value.toLocaleString("en-GB")}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border border-narp-line bg-card p-5">
          <SectionTitle eyebrow="Medicines optimisation" title="Polypharmacy — SMR opportunity" lede="Clinical Pharmacist structured medication review targets" />
          <PolyBar label="10+ repeat medications" value={summary.poly10} max={summary.poly10 || 1} colour={palette.mod} detail="Primary SMR cohort" filterKey="drugs_10_plus" onDrill={onDrill} />
          <PolyBar label="15+ repeat medications" value={summary.poly15} max={summary.poly10 || 1} colour={palette.high} detail="Complex polypharmacy" filterKey="drugs_15_plus" onDrill={onDrill} />
          <PolyBar label="20+ repeat medications" value={summary.poly20} max={summary.poly10 || 1} colour={palette.vhigh} detail="Very complex" filterKey="drugs_20_plus" onDrill={onDrill} />
          <div className="bg-[#e7f0f4] p-3 mt-4 text-xs border-l-4 border-[#005EB8]">
            <strong>NRES ask:</strong> {summary.poly10} patients × 20 min/review ≈{" "}
            {Math.round((summary.poly10 * 20) / 60)} CP hours/year.
          </div>
        </div>
      </div>

      <div className="border border-narp-line bg-card p-5">
        <SectionTitle eyebrow="LTC Focus — where to aim effort" title="The 65+ population is the backbone of LTC demand" lede="2,044 patients are 65+. Of those, 649 carry moderate or severe frailty — your highest-yield cohort for structured LTC reviews." />
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="2 4" />
            <XAxis type="number" dataKey="drugs" name="Mean drug count" tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="mean_PoA" name="Mean PoA (%)" tick={{ fontSize: 11 }} />
            <ZAxis type="number" dataKey="n" range={[120, 1200]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 12 }} />
            <Scatter data={frailtyScatter}>
              {frailtyScatter.map((f, i) => <Cell key={i} fill={f.fill} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2">Bubble size = cohort size.</p>
      </div>
    </>
  );
};

const PolyBar = ({ label, value, max, colour, detail, filterKey, onDrill }: { label: string; value: number; max: number; colour: string; detail: string; filterKey?: string; onDrill?: (key: string) => void }) => {
  const w = (value / max) * 100;
  const clickable = !!filterKey && !!onDrill;
  return (
    <button
      type="button"
      onClick={clickable ? () => onDrill!(filterKey!) : undefined}
      className={`mb-3 w-full text-left ${clickable ? "cursor-pointer hover:bg-slate-50 rounded p-1 -m-1" : ""}`}
      disabled={!clickable}
    >
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="font-semibold tabular-nums">{value.toLocaleString("en-GB")}</span>
      </div>
      <div className="h-2.5 bg-slate-100">
        <div className="h-full" style={{ width: `${w}%`, background: colour }} />
      </div>
      <div className="text-xs text-muted-foreground mt-1">{detail}</div>
    </button>
  );
};

const CohortsSection = ({
  cohorts, totalPatients, onExport, onDrill,
}: { cohorts: any[]; totalPatients: number; onExport: (id: string) => void; onDrill?: (key: string) => void }) => {
  const [selected, setSelected] = useState(cohorts[0]?.id ?? "vhhr");
  const c = cohorts.find(x => x.id === selected) ?? cohorts[0];

  return (
    <>
      <SectionTitle eyebrow="NRES action cohorts" title="Seven priority cohorts mapped to interventions" lede="Each cohort has a defined intervention and a weekly review target. Click a cohort to see detail and export the patient list." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cohorts.map(co => {
          const cohortFilterKey: Record<string, string> = {
            vhhr: "mdt_intensive", ltc: "ltc_anchor", smr: "smr_eligible",
            rising: "rising_prevention", adm: "admission_avoidance",
            falls: "falls_risk", frev: "frailty_review",
          };
          return (
            <button
              key={co.id}
              onClick={() => {
                setSelected(co.id);
                onDrill?.(cohortFilterKey[co.id]);
              }}
              className={`text-left p-4 border rounded-lg transition-all ${
                selected === co.id ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:border-slate-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 inline-block" style={{ background: co.colour }} />
                <span className={`text-[10px] uppercase tracking-wider font-semibold ${selected === co.id ? "text-slate-300" : "text-muted-foreground"}`}>
                  {co.detail}
                </span>
                <ScoreInfoTooltip
                  text={cohortTooltips[co.id]?.text ?? co.detail}
                  anchor={cohortTooltips[co.id]?.anchor ?? "risk-stratification-framework-used-here"}
                  className={selected === co.id ? "text-slate-300 hover:text-white" : ""}
                />
              </div>
              <div className="font-semibold mt-1">{co.label}</div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold tabular-nums hover:underline">{fmt(co.n)}</span>
                <span className={`text-xs ${selected === co.id ? "text-slate-300" : "text-muted-foreground"}`}>{co.weekly}/week</span>
              </div>
            </button>
          );
        })}
      </div>

      {c && (
        <div className="border border-l-4 border-narp-line bg-card p-6" style={{ borderLeftColor: c.colour }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: c.colour }}>Selected cohort</div>
              <h3 className="text-2xl font-bold mt-1">{c.label}</h3>
              <p className="text-sm text-muted-foreground">{c.detail}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Kpi icon={Users} label="Patients" value={fmt(c.n)} tone="default" />
                <Kpi icon={Target} label="Reviews/week" value={c.weekly} tone="warn" />
                <Kpi icon={Layers} label="of list" value={`${((c.n / Math.max(totalPatients, 1)) * 100).toFixed(1)}%`} tone="good" />
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Intervention</div>
                <div className="text-sm">{c.intervention}</div>
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => onExport(c.id)}>
                <FileDown className="w-4 h-4 mr-2" />
                Export cohort (CSV)
              </Button>
            </div>
            <div className="bg-[#fafaf7] p-4 border-l">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">NRES reporting alignment</div>
              <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-700">
                <li>Counts for Part A (reach) — number offered / reviewed</li>
                <li>Counts for Part B (outcome) — change in PoA / admissions over baseline</li>
                <li>Maps to ICB New Models Programme KPI set (Apr 2026 go-live)</li>
                <li>Buy-Back Claims: discrete intervention units per patient / month</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 text-white rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Total across all cohorts</div>
          <div className="text-lg font-bold mt-1">
            {fmt(cohorts.reduce((s, x) => s + x.n, 0))} patient episodes
            <span className="text-slate-400 text-xs ml-2">(overlap expected)</span>
          </div>
        </div>
        <div className="text-xs text-slate-300">
          ~{cohorts.reduce((s, x) => s + x.weekly, 0)} review slots / week required
        </div>
      </div>
    </>
  );
};

const TopRiskSection = ({
  rows,
  canViewPII,
  identifiersVisible,
  onIdentifiersVisibleChange,
  practiceId,
  onDrill,
}: {
  rows: NarpRow[];
  canViewPII: boolean;
  identifiersVisible: boolean;
  onIdentifiersVisibleChange: (visible: boolean) => void;
  practiceId?: string | null;
  onDrill?: (key: string) => void;
}) => {
  const [sortBy, setSortBy] = useState<"poA" | "poLoS" | "drugCount" | "inpatientAdmissions" | "age">("poA");
  const [identifierDetails, setIdentifierDetails] = useState<Record<string, IdentifiableDetails>>({});
  const [identifierLookupUnavailable, setIdentifierLookupUnavailable] = useState(false);
  const [identifierLookupStatus, setIdentifierLookupStatus] = useState<IdentifierLookupStatus>("idle");
  const identifierLookupToastShownRef = useRef(false);
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => ((b[sortBy] as number) ?? 0) - ((a[sortBy] as number) ?? 0)),
  [rows, sortBy]);
  const refKey = sorted.map((r) => r.fkPatientLinkId).join("|");
  const showIdentifiers = canViewPII && identifiersVisible && identifierLookupStatus === "ready" && !identifierLookupUnavailable;

  useEffect(() => {
    if (!identifiersVisible) {
      setIdentifierLookupUnavailable(false);
      setIdentifierLookupStatus("idle");
      identifierLookupToastShownRef.current = false;
    }
  }, [identifiersVisible]);

  const showIdentifierLookupFailedToast = () => {
    if (identifierLookupToastShownRef.current) return;
    identifierLookupToastShownRef.current = true;
    toast.error("Could not load identifiable details", { id: "narp-identifiers-load-failed" });
  };

  useEffect(() => {
    const refs = refKey.split("|").filter(Boolean);
    if (!canViewPII || !identifiersVisible || identifierLookupUnavailable || !practiceId || !refs.length) return;
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
  }, [canViewPII, identifierDetails, identifierLookupUnavailable, identifiersVisible, practiceId, refKey]);

  const exportTopRiskCsv = async () => {
    if (!sorted.length) {
      toast.info("Nothing to export");
      return;
    }
    let includeIdentifiers = showIdentifiers;
    let details = identifierDetails;
    if (includeIdentifiers && practiceId) {
      const missingRefs = sorted.map((r) => r.fkPatientLinkId).filter((id) => !details[id]);
      const demoRefs = missingRefs.filter((id) => DEMO_IDENTIFIABLE_DETAILS[id]);
      if (demoRefs.length) {
        details = { ...details };
        for (const id of demoRefs) details[id] = DEMO_IDENTIFIABLE_DETAILS[id];
      }
      const rpcRefs = missingRefs.filter((id) => !DEMO_IDENTIFIABLE_DETAILS[id]);
      if (rpcRefs.length) {
        const { data, error } = await (supabase as any).rpc("get_narp_identifiable_by_refs", {
          _practice_id: practiceId,
          _fk_patient_link_ids: rpcRefs,
        });
        if (error || (data ?? []).length === 0) {
          setIdentifierLookupUnavailable(true);
          setIdentifierLookupStatus("unavailable");
          showIdentifierLookupFailedToast();
          includeIdentifiers = false;
        }
        if (includeIdentifiers) {
          setIdentifierLookupUnavailable(false);
          setIdentifierLookupStatus("ready");
          identifierLookupToastShownRef.current = false;
          details = { ...details };
          for (const row of data ?? []) {
            details[row.fk_patient_link_id] = {
              nhs_number: row.nhs_number ?? null,
              forenames: row.forenames ?? null,
              surname: row.surname ?? null,
            };
          }
        }
      }
      setIdentifierDetails(details);
    }
    const headers = includeIdentifiers
      ? ["NHS_Number", "Name", "Age", "Frailty", "Drug Count", "Inpatient Admissions", "RUB", "PoA %", "PoLoS %"]
      : ["FK_Patient_Link_ID", "Age", "Frailty", "Drug Count", "Inpatient Admissions", "RUB", "PoA %", "PoLoS %"];
    const lines = [headers.join(",")].concat(sorted.map((r) => {
      const base = [r.age ?? "", r.frailty, r.drugCount, r.inpatientAdmissions, r.rub, r.poA ?? "", r.poLoS ?? ""];
      const values = includeIdentifiers
        ? [details[r.fkPatientLinkId]?.nhs_number ?? r.nhsNumber ?? "", patientDisplayName(details[r.fkPatientLinkId], r), ...base]
        : [r.fkPatientLinkId, ...base];
      return values.map(csvEscape).join(",");
    }));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = includeIdentifiers ? "nres-top-25-risk-identifiable.csv" : "nres-top-25-risk.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const rubColour = (rub: string) => {
    if (rub.startsWith("5")) return palette.vhigh;
    if (rub.startsWith("4")) return palette.high;
    if (rub.startsWith("3")) return palette.mod;
    return palette.unknown;
  };
  const frailtyColour = (f: string) =>
    f === "Severe" ? palette.vhigh :
    f === "Moderate" ? palette.mod :
    f === "Mild" ? palette.rising : palette.ok;

  return (
    <>
      <SectionTitle
        eyebrow="Case-finding priority list"
        title="Top 25 highest-risk patients"
        lede={canViewPII ? "Full identifiable view enabled by your role permission." : "Patients shown by FK_Patient_Link_ID — identifiable details (NHS number, name) are hidden by RBAC."}
      />

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground">Sort by:</span>
        {([["poA", "PoA"], ["poLoS", "PoLoS"], ["drugCount", "Drugs"], ["inpatientAdmissions", "Admissions"], ["age", "Age"]] as const).map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            className={`px-3 py-1.5 border ${sortBy === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700"}`}
          >{lbl}</button>
        ))}
        {canViewPII && (
          <div className="ml-auto flex items-center gap-2 rounded-md border px-2 py-1.5 bg-background">
            <Label htmlFor="top-risk-show-identifiers" className="text-xs text-muted-foreground cursor-pointer">
              Show identifiable details
            </Label>
            <Switch
              id="top-risk-show-identifiers"
              checked={identifiersVisible}
              onCheckedChange={onIdentifiersVisibleChange}
              aria-label="Show identifiable details"
            />
            {identifierLookupStatus === "loading" && (
              <span className="text-xs text-muted-foreground">Looking up identifiable details…</span>
            )}
            {identifierLookupStatus === "unavailable" && (
              <span className="text-xs text-muted-foreground">Identifiable lookup unavailable — showing REF only</span>
            )}
          </div>
        )}
        <Button size="sm" variant="outline" onClick={exportTopRiskCsv}>
          <FileDown className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-50 text-muted-foreground uppercase text-[10px] tracking-wider">
            <tr>
              <th className="text-left p-3">Ref</th>
              {showIdentifiers && <th className="text-left p-3">NHS Number</th>}
              {showIdentifiers && <th className="text-left p-3">Name</th>}
              <th className="text-left p-3">Age</th>
              <th className="text-left p-3"><ScoreHeader label="Frailty" tip={scoreTooltips.frailty} /></th>
              <th className="text-left p-3"><ScoreHeader label="Drugs" tip={scoreTooltips.drugs} /></th>
              <th className="text-left p-3">Inpt adm</th>
              <th className="text-left p-3"><ScoreHeader label="RUB" tip={scoreTooltips.rub} /></th>
              <th className="text-right p-3"><ScoreHeader label="PoA" tip={scoreTooltips.poa} align="right" /></th>
              <th className="text-right p-3"><ScoreHeader label="PoLoS" tip={scoreTooltips.polos} align="right" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const tier = tierFor(p.poA);
              const tierKey: Record<RiskTier, string> = {
                "Very High": "tier_very_high",
                "High": "tier_high",
                "Moderate": "tier_moderate",
                "Rising": "tier_rising",
                "Low": "tier_low",
                "Unknown": "tier_unknown",
              };
              const drillKey = tierKey[tier];
              const clickable = !!onDrill && !!drillKey;
              return (
                <tr
                  key={p.fkPatientLinkId}
                  onClick={clickable ? () => onDrill!(drillKey) : undefined}
                  className={`${i % 2 ? "bg-slate-50/50" : ""} ${clickable ? "cursor-pointer hover:bg-slate-100" : ""}`}
                >
                  <td className="p-3 font-semibold text-[#005EB8] tabular-nums">{p.fkPatientLinkId}</td>
                  {showIdentifiers && <td className="p-3 tabular-nums">{identifierDetails[p.fkPatientLinkId]?.nhs_number ?? p.nhsNumber ?? "—"}</td>}
                  {showIdentifiers && <td className="p-3">{[identifierDetails[p.fkPatientLinkId]?.forenames ?? p.forenames, identifierDetails[p.fkPatientLinkId]?.surname ?? p.surname].filter(Boolean).join(" ") || "—"}</td>}
                  <td className="p-3 tabular-nums">{p.age ?? "—"}</td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: frailtyColour(p.frailty) }}>
                      {p.frailty}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{p.drugCount}</td>
                  <td className="p-3 tabular-nums">{p.inpatientAdmissions}</td>
                  <td className="p-3 font-semibold" style={{ color: rubColour(p.rub) }}>{p.rub || "—"}</td>
                  <td className="p-3 text-right font-bold tabular-nums" style={{ color: palette.vhigh }}>
                    {p.poA !== null ? `${p.poA.toFixed(1)}%` : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums text-slate-600">
                    {p.poLoS !== null ? `${p.poLoS.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-[#e7f0f4] p-4 border-l-4 border-[#005EB8] text-sm text-slate-700">
        <strong>Notewell integration (TODO):</strong> this list will drop into the NRES Buy-Back
        Claims patient picker. Each review against these refs will generate a Part A reach
        claim plus (if PoA falls on next refresh) a Part B outcome claim.
      </div>
    </>
  );
};

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default NRESPopulationRisk;
