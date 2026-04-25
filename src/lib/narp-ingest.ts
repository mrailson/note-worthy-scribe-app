import { supabase } from "@/integrations/supabase/client";

export interface NarpIngestResult {
  success?: boolean;
  duplicate?: boolean;
  export_id: string;
  status?: string;
  patient_count?: number;
  message?: string;
}

interface IngestNarpExportArgs {
  file: File;
  practiceId: string;
  exportDate: string;
  parsedRows?: Record<string, unknown>[];
}

export const ingestNarpExport = async ({
  file,
  practiceId,
  exportDate,
  parsedRows,
}: IngestNarpExportArgs): Promise<NarpIngestResult> => {
  const form = new FormData();
  form.append("file", file);
  form.append("practice_id", practiceId);
  form.append("export_date", exportDate);
  if (parsedRows?.length) {
    form.append("rows_json", JSON.stringify(parsedRows));
  }

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("You are not signed in");

  const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/narp-ingest`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body?.error ?? `Upload failed (${res.status})`);
  }

  return body as NarpIngestResult;
};