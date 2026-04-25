import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Upload, Loader2, AlertTriangle, Database, FileCheck2 } from "lucide-react";
import { ingestNarpExport } from "@/lib/narp-ingest";

const BUGBROOKE_PRACTICE_ID = "85cd140c-2980-40df-8e19-0ffc8a9346d5";
const BUGBROOKE_NAME = "Bugbrooke Medical Practice";

interface NarpExportRow {
  id: string;
  practice_id: string;
  export_date: string;
  uploaded_at: string;
  uploaded_by: string | null;
  patient_count: number;
  status: "processing" | "ready" | "failed";
  error_message: string | null;
  file_name: string | null;
}

interface Props {
  practiceId?: string;
  practiceName?: string;
  /** Called when an upload completes successfully (so the dashboard can re-load). */
  onIngestComplete?: (exportId: string) => void;
  refreshSignal?: number;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${d
    .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export const NarpUploadsPanel = ({
  practiceId = BUGBROOKE_PRACTICE_ID,
  practiceName = BUGBROOKE_NAME,
  onIngestComplete,
  refreshSignal = 0,
}: Props) => {
  const [exports, setExports] = useState<NarpExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exportDate, setExportDate] = useState(today());
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  const loadExports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("narp_exports")
      .select("id, practice_id, export_date, uploaded_at, uploaded_by, patient_count, status, error_message, file_name")
      .eq("practice_id", practiceId)
      .order("export_date", { ascending: false })
      .limit(24);
    if (error) {
      toast.error(`Could not load uploads: ${error.message}`);
      setExports([]);
    } else {
      setExports((data ?? []) as NarpExportRow[]);
    }
    setLoading(false);
  }, [practiceId]);

  useEffect(() => { loadExports(); }, [loadExports, refreshSignal]);

  const onUpload = useCallback(async () => {
    if (!pickedFile) {
      toast.error("Choose a NARP file first");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exportDate)) {
      toast.error("Choose a valid export date");
      return;
    }

    setUploading(true);
    const t = toast.loading(`Uploading ${pickedFile.name}…`);
    try {
      const body = await ingestNarpExport({ file: pickedFile, practiceId, exportDate });

      toast.dismiss(t);
      if (body.duplicate) {
        toast.warning("This file has already been uploaded — using the existing export.");
      } else {
        toast.success(
          `Ingested ${body.patient_count?.toLocaleString("en-GB") ?? "?"} patients from ${pickedFile.name}`,
        );
      }
      setPickedFile(null);
      await loadExports();
      onIngestComplete?.(body.export_id);
    } catch (e) {
      toast.dismiss(t);
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }, [pickedFile, exportDate, practiceId, loadExports, onIngestComplete]);

  const latest = exports[0];
  const isStale = latest && daysSince(latest.export_date) > 35;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[#005EB8]" />
          <h3 className="font-semibold text-sm">NARP exports — {practiceName}</h3>
        </div>
        {latest && (
          <span className="text-xs text-muted-foreground">
            Data as at <span className="font-medium">{fmtDate(latest.export_date)}</span>
          </span>
        )}
      </div>

      {isStale && latest && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Latest NARP export is {daysSince(latest.export_date)} days old. NARP is monthly —
            upload a fresh export.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload row */}
      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">Export date (data as at)</label>
          <input
            type="date"
            value={exportDate}
            onChange={(e) => setExportDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            max={today()}
            disabled={uploading}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <label className="text-[11px] text-muted-foreground">NARP file (.xlsx or .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:text-xs"
            disabled={uploading}
          />
        </div>
        <Button onClick={onUpload} disabled={!pickedFile || uploading} size="sm" className="bg-[#005EB8] hover:bg-[#004A94]">
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          {uploading ? "Uploading…" : "Upload NARP export"}
        </Button>
      </div>

      {/* Recent exports list */}
      <div className="border-t pt-3">
        <div className="text-[11px] text-muted-foreground mb-2">Recent uploads</div>
        {loading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : exports.length === 0 ? (
          <div className="text-xs text-muted-foreground">No NARP exports uploaded yet.</div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-2 py-1.5 font-medium">Data as at</th>
                  <th className="px-2 py-1.5 font-medium">Patients</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">File</th>
                  <th className="px-2 py-1.5 font-medium">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-2 py-1.5 font-medium">{fmtDate(e.export_date)}</td>
                    <td className="px-2 py-1.5">{e.patient_count?.toLocaleString("en-GB") ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      {e.status === "ready" ? (
                        <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
                          <FileCheck2 className="h-3 w-3" />Ready
                        </Badge>
                      ) : e.status === "processing" ? (
                        <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">
                          <Loader2 className="h-3 w-3 animate-spin" />Processing
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-red-300 bg-red-50 text-red-700" title={e.error_message ?? ""}>
                          <AlertTriangle className="h-3 w-3" />Failed
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]" title={e.file_name ?? ""}>
                      {e.file_name ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{fmtDateTime(e.uploaded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
