import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FindingsDocumentViewer } from "@/components/admin/FindingsDocumentViewer";
import {
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Printer,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
  Eye,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

type DocKind = "text" | "pdf" | "image";

const MAX_BYTES = 5 * 1024 * 1024;

interface QueuedDoc {
  id: string;
  name: string;
  kind: DocKind;
  text?: string;
  base64?: string;
  mediaType?: string;
  status: "queued" | "analysing" | "done" | "error";
  error?: string;
  result?: EchoResult;
  reviewed?: Record<number, boolean>;
}

interface EchoResult {
  document_type: string;
  contains_echo_findings: boolean;
  patient?: {
    name: string | null;
    date_of_birth: string | null;
    nhs_number: string | null;
    hospital_number: string | null;
    address: string | null;
    gender: string | null;
  } | null;
  echo_date: string | null;
  reporting_site: string | null;
  lvef: { value: string | null; category: string };
  track_a_findings: Array<{
    finding_key?: string;
    finding?: string;
    severity: string | null;
    evidence_snippet: string;
    suggested_snomed?: string;
    confidence: "high" | "medium" | "low";
  }>;
  track_b_flags: Array<{
    finding_key?: string;
    pattern: string;
    evidence_snippet: string;
    rationale: string;
    recommended_action: string;
    confidence: "high" | "medium" | "low";
  }>;
  summary: string;
  uncertainty_notes: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function lvefChipClasses(category: string) {
  const c = (category || "").toLowerCase();
  if (c.includes("preserved")) return "bg-green-100 text-green-800 border-green-300";
  if (c.includes("mildly") || c.includes("moderately"))
    return "bg-amber-100 text-amber-800 border-amber-300";
  if (c.includes("severely")) return "bg-red-100 text-red-800 border-red-300";
  return "bg-muted text-muted-foreground border-border";
}

function confidenceClasses(c: string) {
  if (c === "high") return "bg-green-100 text-green-800 border-green-300";
  if (c === "medium") return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-muted text-muted-foreground border-border";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const idx = result.indexOf("base64,");
      res(idx >= 0 ? result.slice(idx + 7) : result);
    };
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export default function AdminFindingsMinerPoc() {
  const { isSystemAdmin, loading, user } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isSystemAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <FindingsMinerContent showHeading />
      </div>
    </div>
  );
}

export interface CodebookEntry {
  finding_key: string;
  display_name: string;
  track: "A" | "B";
  snomed_term: string;
  snomed_code: string | null;
}

export type Codebook = Record<string, CodebookEntry>;

const FINDING_NAME_ALIASES: Array<[string, string]> = [
  ["left ventricular systolic dysfunction", "lvsd"],
  ["global hypokinesis", "lvsd"],
  ["dilated left ventricle", "lv_dilatation"],
  ["left ventricular dilatation", "lv_dilatation"],
  ["regional wall motion", "rwma"],
  ["akinesis", "rwma"],
  ["mitral regurg", "mitral_regurg"],
  ["hypertrophy", "lvh"],
  ["aortic stenosis", "aortic_stenosis"],
];

function normaliseFindingKey(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function aliasKeyForFindingName(finding?: string | null) {
  const name = (finding || "").trim().toLowerCase();
  if (!name) return undefined;
  return FINDING_NAME_ALIASES.find(([alias]) => name.includes(alias))?.[1];
}

export const ECHO_FINDING_CODE_CLUSTERS: Record<string, string[]> = {
  lvsd: ["134401001"],
  lvh: ["55827005"],
  mitral_regurg: ["48724000", "G5401", "XE0Ux"],
  aortic_stenosis: ["60573004"],
  aortic_regurg: ["60234000"],
  tricuspid_regurg: ["111287006"],
  pulm_htn: ["70995007"],
  lv_dilatation: [],
  rwma: [],
  la_dilatation: [],
  aortic_sclerosis: [],
  pericardial_effusion: [],
};

export interface ExistingCodeRow {
  nhs_number: string; // normalised (no spaces)
  patient_name: string;
  code: string;
  code_system: string;
  code_term: string;
  date_recorded: string;
}

export function normaliseNhs(value?: string | null) {
  return (value || "").replace(/\s+/g, "").trim();
}

function parseCsv(text: string): ExistingCodeRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Simple CSV parser supporting quoted fields
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else cur += ch;
      } else {
        if (ch === ',') { out.push(cur); cur = ""; }
        else if (ch === '"') inQ = true;
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/^"|"$/g, ""));
  const idx = (name: string) => headers.indexOf(name);
  const iNhs = idx("nhs_number");
  const iName = idx("patient_name");
  const iCode = idx("code");
  const iSys = idx("code_system");
  const iTerm = idx("code_term");
  const iDate = idx("date_recorded");
  if (iNhs < 0 || iCode < 0) {
    throw new Error("CSV must include at least nhs_number and code columns");
  }
  const rows: ExistingCodeRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = parseLine(lines[li]);
    rows.push({
      nhs_number: normaliseNhs(cells[iNhs]),
      patient_name: iName >= 0 ? cells[iName] || "" : "",
      code: (cells[iCode] || "").trim(),
      code_system: iSys >= 0 ? cells[iSys] || "" : "",
      code_term: iTerm >= 0 ? cells[iTerm] || "" : "",
      date_recorded: iDate >= 0 ? cells[iDate] || "" : "",
    });
  }
  return rows;
}

export type GapState =
  | { kind: "coded_status_unknown" }
  | { kind: "already_coded"; code: string; code_term: string; date_recorded: string }
  | { kind: "coding_gap" };

export function computeGapState(
  findingKey: string | undefined,
  patientNhs: string | null | undefined,
  existing: ExistingCodeRow[] | null,
): GapState {
  if (!existing) return { kind: "coded_status_unknown" };
  const cluster = (findingKey && ECHO_FINDING_CODE_CLUSTERS[findingKey]) || [];
  const nhs = normaliseNhs(patientNhs);
  if (!nhs) return { kind: "coding_gap" };
  const patientRows = existing.filter((r) => r.nhs_number === nhs);
  for (const row of patientRows) {
    if (cluster.includes(row.code)) {
      return {
        kind: "already_coded",
        code: row.code,
        code_term: row.code_term,
        date_recorded: row.date_recorded,
      };
    }
  }
  return { kind: "coding_gap" };
}

function useCodebook(): Codebook {
  const [book, setBook] = useState<Codebook>({});
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("echo_finding_codes")
        .select("finding_key, display_name, track, snomed_term, snomed_code")
        .eq("status", "active");
      if (error) {
        console.error("Failed to load echo_finding_codes:", error);
        return;
      }
      const map: Codebook = {};
      for (const row of (data || []) as CodebookEntry[]) {
        map[normaliseFindingKey(row.finding_key)] = row;
      }
      setBook(map);
    })();
  }, []);
  return book;
}

export function FindingsMinerContent({ showHeading = false }: { showHeading?: boolean }) {
  const [pasteText, setPasteText] = useState("");
  const [queue, setQueue] = useState<QueuedDoc[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const codebook = useCodebook();

  const addPasted = () => {
    if (!pasteText.trim()) return;
    setQueue((q) => [
      ...q,
      {
        id: uid(),
        name: `Pasted text (${pasteText.length} chars)`,
        kind: "text",
        text: pasteText,
        status: "queued",
      },
    ]);
    setPasteText("");
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase().split(".").pop() || "";
      try {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: exceeds 5 MB limit.`);
          continue;
        }
        if (ext === "pdf") {
          const base64 = await fileToBase64(file);
          setQueue((q) => [
            ...q,
            {
              id: uid(),
              name: file.name,
              kind: "pdf",
              base64,
              mediaType: "application/pdf",
              status: "queued",
            },
          ]);
        } else if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
          const base64 = await fileToBase64(file);
          const mediaType =
            ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
          setQueue((q) => [
            ...q,
            {
              id: uid(),
              name: file.name,
              kind: "image",
              base64,
              mediaType,
              status: "queued",
            },
          ]);
        } else {
          toast.error(`Unsupported file type: ${file.name}`);
        }
      } catch (e) {
        toast.error(`Could not load ${file.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeDoc = (id: string) => setQueue((q) => q.filter((d) => d.id !== id));

  const analyseDoc = async (doc: QueuedDoc): Promise<QueuedDoc> => {
    try {
      let payload: { kind: DocKind; content: string; mediaType?: string };
      if (doc.kind === "image" || doc.kind === "pdf") {
        if (!doc.base64) throw new Error("No file data");
        payload = { kind: doc.kind, content: doc.base64, mediaType: doc.mediaType };
      } else {
        if (!doc.text) throw new Error("No text content");
        payload = { kind: "text", content: doc.text };
      }
      const { data, error } = await supabase.functions.invoke("findings-miner-poc", {
        body: payload,
      });
      if (error) throw new Error(error.message || "Edge function error");
      if (!data?.result) throw new Error(data?.error || "Invalid response");
      return { ...doc, status: "done", result: data.result as EchoResult };
    } catch (e) {
      return {
        ...doc,
        status: "error",
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  };

  const analyseAll = async () => {
    if (!queue.length) return;
    setAnalysing(true);
    setQueue((q) => q.map((d) => (d.status === "queued" ? { ...d, status: "analysing" } : d)));
    const work = [...queue];
    for (let i = 0; i < work.length; i++) {
      if (work[i].status !== "analysing" && work[i].status !== "queued") continue;
      const updated = await analyseDoc({ ...work[i], status: "analysing" });
      work[i] = updated;
      setQueue([...work]);
    }
    setAnalysing(false);
  };

  const [existingCodes, setExistingCodes] = useState<ExistingCodeRow[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const onCsvImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      setExistingCodes(rows);
      setCsvFileName(file.name);
      const patientCount = new Set(rows.map((r) => r.nhs_number)).size;
      toast.success(`Imported ${rows.length} coded entries across ${patientCount} patient(s) (session only).`);
    } catch (e) {
      toast.error(`CSV import failed: ${e instanceof Error ? e.message : "parse error"}`);
    }
    if (csvRef.current) csvRef.current.value = "";
  };

  const clearExistingCodes = () => {
    setExistingCodes(null);
    setCsvFileName(null);
  };

  const resolveFindingLookupKey = (f: { finding_key?: string; finding?: string }) => {
    const rawKey = normaliseFindingKey(f.finding_key);
    const aliasKey = !rawKey || rawKey === "other" ? aliasKeyForFindingName(f.finding) : undefined;
    return aliasKey || rawKey;
  };

  const stats = useMemo(() => {
    const analysed = queue.filter((d) => d.status === "done");
    let trackA = 0;
    let trackB = 0;
    let noFindings = 0;
    let codingGaps = 0;
    let alreadyCoded = 0;
    for (const d of analysed) {
      trackA += d.result?.track_a_findings?.length || 0;
      trackB += d.result?.track_b_flags?.length || 0;
      if (
        !d.result?.contains_echo_findings ||
        ((d.result?.track_a_findings?.length || 0) === 0 &&
          (d.result?.track_b_flags?.length || 0) === 0)
      ) {
        noFindings++;
      }
      const nhs = d.result?.patient?.nhs_number;
      for (const f of d.result?.track_a_findings || []) {
        const key = resolveFindingLookupKey(f);
        const state = computeGapState(key, nhs, existingCodes);
        if (state.kind === "coding_gap") codingGaps++;
        else if (state.kind === "already_coded") alreadyCoded++;
      }
    }
    return { analysed: analysed.length, trackA, trackB, noFindings, codingGaps, alreadyCoded };
  }, [queue, existingCodes]);


  const toggleReviewed = (docId: string, idx: number) => {
    setQueue((q) =>
      q.map((d) =>
        d.id === docId
          ? { ...d, reviewed: { ...(d.reviewed || {}), [idx]: !d.reviewed?.[idx] } }
          : d
      )
    );
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: white !important; }
        }
      `}</style>

      {showHeading && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coded Findings Miner — Echo POC</h1>
          <p className="text-muted-foreground mt-1">
            Read &amp; report demonstration. Identifies echocardiogram findings that may be missing
            from a patient's coded record.
          </p>
        </div>
      )}

        <Alert className="border-amber-400 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 !text-amber-700" />
          <AlertTitle className="text-amber-900">Proof of concept — read &amp; report only</AlertTitle>
          <AlertDescription className="text-amber-900/90">
            No codes are written to any clinical system. All findings require clinician
            verification. Not for clinical decision-making in its current form.
          </AlertDescription>
        </Alert>

        <Card className="no-print">
          <CardHeader>
            <CardTitle className="text-base">Add documents to the batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="paste">Paste document text</Label>
              <Textarea
                id="paste"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste an echo report, clinic letter, or discharge summary…"
                className="min-h-[140px] mt-2"
              />
              <div className="mt-2 flex justify-end">
                <Button onClick={addPasted} disabled={!pasteText.trim()} size="sm">
                  Add pasted text
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload PDFs or images
              </Button>
              <p className="text-xs text-muted-foreground">
                PDFs and images are sent directly to Claude Opus 4.7 (vision). Max ~5 MB per file.
              </p>
            </div>
          </CardContent>
        </Card>

        {queue.length > 0 && (
          <Card className="no-print">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Batch ({queue.length})</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setQueue([])} disabled={analysing}>
                  Clear all
                </Button>
                <Button onClick={analyseAll} disabled={analysing}>
                  {analysing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Analyse batch
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {queue.map((d) => (
                  <li key={d.id} className="py-2 flex items-center gap-3">
                    {d.kind === "image" ? (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate text-sm">{d.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {d.kind === "image" ? "image" : d.kind === "pdf" ? "PDF" : "text"}
                    </Badge>
                    {d.status === "analysing" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {d.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {d.status === "error" && <XCircle className="h-4 w-4 text-red-600" />}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDoc(d.id)}
                      disabled={analysing}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {stats.analysed > 0 && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Report summary</CardTitle>
                <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
                  <Printer className="h-4 w-4 mr-2" />
                  Export report
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryStat label="Documents analysed" value={stats.analysed} />
                  <SummaryStat label="Track A findings" value={stats.trackA} accent="primary" />
                  <SummaryStat label="Track B flags" value={stats.trackB} accent="amber" />
                  <SummaryStat label="No echo findings" value={stats.noFindings} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {queue
                .filter((d) => d.status === "done" || d.status === "error")
                .map((d) => (
                  <DocResultCard
                    key={d.id}
                    doc={d}
                    codebook={codebook}
                    onToggleReviewed={(i) => toggleReviewed(d.id, i)}
                  />
                ))}
            </div>
          </>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "amber";
}) {
  const colour =
    accent === "primary"
      ? "text-primary"
      : accent === "amber"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className={`text-2xl font-semibold ${colour}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function DocResultCard({
  doc,
  codebook,
  onToggleReviewed,
}: {
  doc: QueuedDoc;
  codebook: Codebook;
  onToggleReviewed: (idx: number) => void;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);

  if (doc.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            {doc.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Could not analyse: {doc.error || "unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const r = doc.result!;
  const noFindings =
    !r.contains_echo_findings ||
    ((r.track_a_findings?.length || 0) === 0 && (r.track_b_flags?.length || 0) === 0);

  const p = r.patient;
  const hasPatient =
    p && (p.name || p.date_of_birth || p.nhs_number || p.hospital_number || p.address || p.gender);

  const canView = doc.kind !== "text" && !!doc.base64;
  const dataUrl =
    canView && doc.base64
      ? `data:${doc.mediaType || (doc.kind === "pdf" ? "application/pdf" : "image/png")};base64,${doc.base64}`
      : null;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {r.document_type || "unknown"}
          </Badge>
          {r.echo_date && (
            <Badge variant="outline" className="text-xs">
              Echo date: {r.echo_date}
            </Badge>
          )}
          {r.reporting_site && (
            <Badge variant="outline" className="text-xs">
              {r.reporting_site}
            </Badge>
          )}
          <Badge className={`border ${lvefChipClasses(r.lvef?.category || "not stated")}`}>
            LVEF: {r.lvef?.value || "—"} ({r.lvef?.category || "not stated"})
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            {canView && (
              <Button
                variant="outline"
                size="sm"
                className="no-print h-7"
                onClick={() => setViewerOpen(true)}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                View document
              </Button>
            )}
            <span className="text-xs text-muted-foreground truncate max-w-[240px]">
              {doc.name}
            </span>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Patient details (as printed on document — verify before coding)
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
            <PatientField label="Name" value={p?.name || "Not stated"} />
            <PatientField label="Date of birth" value={p?.date_of_birth || "Not stated"} />
            <PatientField label="NHS number" value={p?.nhs_number || "Not stated"} mono />
            <PatientField label="Hospital no." value={p?.hospital_number || "Not stated"} mono />
            <PatientField label="Gender" value={p?.gender || "Not stated"} />
            <PatientField label="Address" value={p?.address || "Not stated"} />
          </div>
          {!hasPatient && (
            <p className="text-xs text-muted-foreground italic mt-2">
              No patient demographics were printed on this document.
            </p>
          )}
        </div>

        {r.summary && <p className="text-sm text-muted-foreground">{r.summary}</p>}
      </CardHeader>

      <CardContent className="space-y-6">
        {noFindings ? (
          <p className="text-sm text-muted-foreground italic">
            No echo findings detected in this document.
          </p>
        ) : (
          <>
            {r.track_a_findings?.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary">Codeable findings</h3>
                  <span className="text-xs text-muted-foreground">
                    Codes drawn from a curated, clinician-approved set. AI classifies findings only; it does not generate codes.
                  </span>
                </div>
                <div className="space-y-3">
                  {r.track_a_findings.map((f, i) => {
                    const rawKey = normaliseFindingKey(f.finding_key);
                    const aliasKey = !rawKey || rawKey === "other" ? aliasKeyForFindingName(f.finding) : undefined;
                    const lookupKey = aliasKey || rawKey;
                    const entry = lookupKey && lookupKey !== "other" ? codebook[lookupKey] : undefined;
                    const pendingVerification = !!entry && !entry.snomed_code;
                    const uncategorised = !entry;
                    console.info("[FindingsMiner] finding_key lookup", {
                      finding_key: f.finding_key || null,
                      normalised_key: rawKey || null,
                      alias_key: aliasKey || null,
                      lookup_key: lookupKey || null,
                      matched: !!entry,
                    });
                    const displayName =
                      entry?.display_name ||
                      f.finding ||
                      (lookupKey && lookupKey !== "other" ? lookupKey : "Uncategorised finding");
                    return (
                      <div
                        key={i}
                        className={`rounded-md border-l-4 p-3 ${
                          uncategorised
                            ? "border-amber-500 bg-amber-50"
                            : "border-primary bg-primary/5"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-medium">{displayName}</span>
                          {f.severity && f.severity !== "none" && (
                            <Badge variant="outline" className="text-xs capitalize">
                              Severity: {f.severity}
                            </Badge>
                          )}
                          {pendingVerification && (
                            <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-300">
                              Code pending verification
                            </Badge>
                          )}
                          {uncategorised && (
                            <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-300">
                              Uncategorised — needs clinician review
                            </Badge>
                          )}
                          <Badge className={`text-xs border ${confidenceClasses(f.confidence)}`}>
                            {f.confidence} confidence
                          </Badge>
                          <div className="ml-auto flex items-center gap-2 no-print">
                            <Switch
                              id={`rev-${doc.id}-${i}`}
                              checked={!!doc.reviewed?.[i]}
                              onCheckedChange={() => onToggleReviewed(i)}
                            />
                            <Label htmlFor={`rev-${doc.id}-${i}`} className="text-xs">
                              Mark reviewed
                            </Label>
                          </div>
                        </div>
                        <blockquote className="text-xs italic text-muted-foreground border-l-2 border-muted pl-3 my-2">
                          "{f.evidence_snippet}"
                        </blockquote>
                        {entry ? (
                          <div className="text-xs">
                            <span className="text-muted-foreground">SNOMED CT: </span>
                            <span>{entry.snomed_term}</span>
                            {entry.snomed_code ? (
                              <>
                                <span className="text-muted-foreground"> · </span>
                                <span className="font-mono">{entry.snomed_code}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-muted-foreground"> · </span>
                                <span className="font-medium text-amber-800">Code pending verification</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-amber-900">
                            No code assigned. This finding did not match the curated set and
                            requires clinician review before any coding decision.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {r.track_b_flags?.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-amber-700 mb-3">
                  HFpEF — consider assessment
                </h3>
                <div className="space-y-3">
                  {r.track_b_flags.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium">{f.pattern}</span>
                        <Badge className={`text-xs border ${confidenceClasses(f.confidence)}`}>
                          {f.confidence} confidence
                        </Badge>
                      </div>
                      <blockquote className="text-xs italic text-muted-foreground border-l-2 border-muted pl-3 my-2">
                        "{f.evidence_snippet}"
                      </blockquote>
                      <p className="text-xs text-amber-900">
                        <span className="font-medium">Rationale: </span>
                        {f.rationale}
                      </p>
                      <p className="text-xs text-amber-900 mt-1">
                        <span className="font-medium">Recommended: </span>
                        {f.recommended_action}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

      </CardContent>

      {canView && doc.base64 && (doc.kind === "pdf" || doc.kind === "image") && (
        <FindingsDocumentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          fileName={doc.name}
          base64={doc.base64}
          mediaType={doc.mediaType || (doc.kind === "pdf" ? "application/pdf" : "image/png")}
          kind={doc.kind}
        />
      )}
    </Card>
  );
}

function PatientField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
