import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  echo_date: string | null;
  reporting_site: string | null;
  lvef: { value: string | null; category: string };
  track_a_findings: Array<{
    finding: string;
    severity: string | null;
    evidence_snippet: string;
    suggested_snomed: string;
    confidence: "high" | "medium" | "low";
  }>;
  track_b_flags: Array<{
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
  const [pasteText, setPasteText] = useState("");
  const [queue, setQueue] = useState<QueuedDoc[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isSystemAdmin) return <Navigate to="/" replace />;

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
        if (ext === "pdf") {
          const text = await extractPdfText(file);
          if (text && text.replace(/\s/g, "").length > 200) {
            setQueue((q) => [
              ...q,
              { id: uid(), name: file.name, kind: "pdf-text", text, status: "queued" },
            ]);
          } else {
            toast.info(`${file.name}: appears scanned — using vision model.`);
            const images = await pdfPagesToImages(file);
            setQueue((q) => [
              ...q,
              { id: uid(), name: file.name, kind: "image", images, status: "queued" },
            ]);
          }
        } else if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
          const dataUrl = await fileToDataUrl(file);
          setQueue((q) => [
            ...q,
            { id: uid(), name: file.name, kind: "image", images: [dataUrl], status: "queued" },
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
      let payload: { kind: "text" | "image"; content: string };
      if (doc.kind === "image") {
        if (!doc.images?.length) throw new Error("No image data");
        payload = { kind: "image", content: doc.images[0] };
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

  const stats = useMemo(() => {
    const analysed = queue.filter((d) => d.status === "done");
    let trackA = 0;
    let trackB = 0;
    let noFindings = 0;
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
    }
    return { analysed: analysed.length, trackA, trackB, noFindings };
  }, [queue]);

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
    <div className="min-h-screen bg-background p-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: white !important; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coded Findings Miner — Echo POC</h1>
          <p className="text-muted-foreground mt-1">
            Read &amp; report demonstration. Identifies echocardiogram findings that may be missing
            from a patient's coded record.
          </p>
        </div>

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
                Text PDFs are extracted locally with pdf.js. Scanned PDFs and images are read by
                the configured multimodal AI model.
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
                      {d.kind === "image" ? "image / scanned" : d.kind === "pdf-text" ? "PDF text" : "text"}
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
                    onToggleReviewed={(i) => toggleReviewed(d.id, i)}
                  />
                ))}
            </div>
          </>
        )}
      </div>
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
  onToggleReviewed,
}: {
  doc: QueuedDoc;
  onToggleReviewed: (idx: number) => void;
}) {
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
          <span className="text-xs text-muted-foreground ml-auto truncate max-w-[40%]">
            {doc.name}
          </span>
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
                    Demonstration: no codes are written
                  </span>
                </div>
                <div className="space-y-3">
                  {r.track_a_findings.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-md border-l-4 border-primary bg-primary/5 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium">{f.finding}</span>
                        {f.severity && (
                          <Badge variant="outline" className="text-xs">
                            {f.severity}
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
                      <div className="text-xs">
                        <span className="text-muted-foreground">Suggested SNOMED: </span>
                        <span className="font-mono">{f.suggested_snomed}</span>
                      </div>
                    </div>
                  ))}
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

        {r.uncertainty_notes && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            <span className="font-medium">Caveats: </span>
            {r.uncertainty_notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
