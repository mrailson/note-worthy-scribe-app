// NARP Population Risk – Ingestion endpoint
// POST /functions/v1/narp-ingest
// multipart/form-data: file, practice_id, export_date (YYYY-MM-DD)
//
// Auth: caller must be logged in AND have user_roles.narp_upload_access = true
// for the given practice. The function uses the service role internally to
// write encrypted PII (DB helper functions read NARP_PII_KEY from a session GUC).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const NARP_PII_KEY = Deno.env.get("NARP_PII_KEY") ?? "";

// ─── Helpers (parsing + tiering) ────────────────────────────────
type Frailty = "Fit" | "Mild" | "Moderate" | "Severe" | "Unknown";
type RiskTier = "Very High" | "High" | "Moderate" | "Rising" | "Low" | "Unknown";

const parsePct = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || s === "-" || s.toLowerCase().includes("unavailable")) return null;
  const cleaned = s.replace(/%/g, "").replace(/[(),]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.max(0, Math.min(100, n));
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

const frailtyFromCategory = (raw: unknown): Frailty => {
  const v = String(raw ?? "").toLowerCase();
  if (v.includes("severe")) return "Severe";
  if (v.includes("moderate")) return "Moderate";
  if (v.includes("mild")) return "Mild";
  if (v.includes("fit")) return "Fit";
  return "Unknown";
};

const tierFor = (poA: number | null): RiskTier => {
  if (poA === null || isNaN(poA)) return "Unknown";
  if (poA > 50) return "Very High";
  if (poA >= 20) return "High";
  if (poA >= 10) return "Moderate";
  if (poA >= 5) return "Rising";
  return "Low";
};

// Action-cohort definitions (mirror the PoC + spec)
const cohortKeysFor = (row: ParsedRow): string[] => {
  const out: string[] = [];
  const poA = row.poa ?? 0;
  const isElderly = (row.age ?? 0) >= 65;
  const isFrail =
    row.frailty_category === "Moderate" || row.frailty_category === "Severe";

  if (poA >= 20) out.push("mdt_intensive");
  if (isElderly && isFrail) out.push("ltc_anchor");
  if (row.drug_count >= 8) out.push("smr_eligible");
  if (poA >= 5 && poA < 20) out.push("rising_risk");
  if (row.ae_attendances >= 2 || row.inpatient_total_admissions >= 1)
    out.push("admission_avoidance");
  if (isElderly && row.ae_attendances >= 1) out.push("falls_risk");
  if (
    row.frailty_category === "Mild" ||
    row.frailty_category === "Moderate" ||
    row.frailty_category === "Severe"
  )
    out.push("frailty_review");

  return out;
};

interface ParsedRow {
  fk_patient_link_id: string;
  nhs_number_raw: string | null;
  forenames_raw: string | null;
  surname_raw: string | null;
  age: number | null;
  drug_count: number;
  frailty_category: Frailty;
  inpatient_total_admissions: number;
  ae_attendances: number;
  inpatient_elective: number;
  outpatient_first: number;
  outpatient_followup: number;
  rub: string | null;
  poa: number | null;
  polos: number | null;
  risk_tier: RiskTier;
}

function mapRow(r: Record<string, unknown>): ParsedRow | null {
  const fk = r["FK_Patient_Link_ID"] ?? r["FK Patient Link ID"];
  if (!fk) return null;

  const poa = parsePct(r["Probability of Emergency Admission"]);
  const polos = parsePct(r["Probability of Extended LoS"]);

  return {
    fk_patient_link_id: String(fk).trim(),
    nhs_number_raw: r["NHS Number"] ? String(r["NHS Number"]).trim() : null,
    forenames_raw: r["Forenames"] ? String(r["Forenames"]).trim() : null,
    surname_raw: r["Surname"] ? String(r["Surname"]).trim() : null,
    age: parseAge(r["Age"]),
    drug_count: parseInt0(r["Drug Count"]),
    frailty_category: frailtyFromCategory(r["Frailty (eFI) Category"]),
    inpatient_total_admissions: parseInt0(r["Inpatient - Total Admissions"]),
    ae_attendances: parseInt0(r["A&E Attendances"]),
    inpatient_elective: parseInt0(r["Inpatient - Elective Admissions"]),
    outpatient_first: parseInt0(r["Outpatient - First Appointments"]),
    outpatient_followup: parseInt0(r["Outpatient - Follow-Up Appointments"]),
    rub: r["RUB"] ? String(r["RUB"]).trim() : null,
    poa,
    polos,
    risk_tier: tierFor(poa),
  };
}

const REQUIRED_COLUMNS = [
  "FK_Patient_Link_ID",
  "Age",
  "Drug Count",
  "Frailty (eFI) Category",
  "Inpatient - Total Admissions",
  "A&E Attendances",
  "Probability of Emergency Admission",
];

function validateColumns(header: string[]): string[] {
  const present = new Set(header.map((h) => h.trim()));
  const missing: string[] = [];
  for (const col of REQUIRED_COLUMNS) {
    // Allow either FK_Patient_Link_ID or "FK Patient Link ID"
    if (col === "FK_Patient_Link_ID") {
      if (!present.has("FK_Patient_Link_ID") && !present.has("FK Patient Link ID"))
        missing.push(col);
      continue;
    }
    if (!present.has(col)) missing.push(col);
  }
  return missing;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest("SHA-256", copy.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Main handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return json({ error: "Method not allowed" }, 405);

  if (!NARP_PII_KEY)
    return json({ error: "NARP_PII_KEY is not configured on the server" }, 500);

  // 1. Authenticate caller
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer "))
    return json({ error: "Missing bearer token" }, 401);

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResp, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userResp?.user)
    return json({ error: "Invalid session" }, 401);
  const userId = userResp.user.id;

  // 2. Parse multipart body
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected multipart/form-data body" }, 400);
  }

  const file = form.get("file");
  const practiceIdRaw = form.get("practice_id");
  const exportDateRaw = form.get("export_date");

  if (!(file instanceof File))
    return json({ error: "Missing 'file'" }, 400);
  if (typeof practiceIdRaw !== "string" || !practiceIdRaw)
    return json({ error: "Missing 'practice_id'" }, 400);
  if (typeof exportDateRaw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(exportDateRaw))
    return json({ error: "Missing or malformed 'export_date' (expected YYYY-MM-DD)" }, 400);

  const practiceId = practiceIdRaw;
  const exportDate = exportDateRaw;

  // 3. Permission check via security-definer helper
  const { data: canUpload, error: permErr } = await callerClient.rpc(
    "has_narp_upload_access",
    { p_user: userId, p_practice: practiceId },
  );
  if (permErr) return json({ error: `Permission check failed: ${permErr.message}` }, 500);
  if (!canUpload)
    return json({ error: "You do not have NARP upload access for this practice" }, 403);

  // 4. Compute checksum
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const checksum = await sha256Hex(fileBytes);

  // Service-role client for all DB writes (RLS-bypassing)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Set the pepper for this DB session so PII helpers can use it
  try {
    await admin.rpc("set_config", {
      name: "app.narp_pii_key",
      value: NARP_PII_KEY,
      is_local: true,
    });
  } catch {
    // Non-fatal: downstream helpers also validate configuration.
  }

  // 5. Duplicate check
  const { data: dup, error: dupErr } = await admin
    .from("narp_exports")
    .select("id, status, patient_count")
    .eq("file_checksum", checksum)
    .maybeSingle();
  if (dupErr) return json({ error: dupErr.message }, 500);
  if (dup)
    return json(
      {
        duplicate: true,
        export_id: dup.id,
        status: dup.status,
        patient_count: dup.patient_count,
        message: "An identical file has already been uploaded.",
      },
      200,
    );

  // 6. Parse workbook
  let rows: ParsedRow[] = [];
  let header: string[] = [];
  try {
    const wb = XLSX.read(fileBytes, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error("Workbook contains no sheets");
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
    });
    if (raw.length === 0) throw new Error("File contains no data rows");
    header = Object.keys(raw[0]);
    const missing = validateColumns(header);
    if (missing.length)
      throw new Error(`Missing required columns: ${missing.join(", ")}`);

    rows = raw
      .map(mapRow)
      .filter((r): r is ParsedRow => r !== null);
    if (rows.length === 0) throw new Error("No valid patient rows extracted");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to parse file";
    return json({ error: `Parse failed: ${msg}` }, 400);
  }

  // 7. Insert export row (status = processing)
  const { data: exportRow, error: insErr } = await admin
    .from("narp_exports")
    .insert({
      practice_id: practiceId,
      export_date: exportDate,
      uploaded_by: userId,
      patient_count: 0,
      file_checksum: checksum,
      file_name: file.name,
      status: "processing",
    })
    .select("id")
    .single();
  if (insErr || !exportRow) {
    if (insErr?.code === "23505") {
      return json(
        {
          error:
            "An export already exists for this practice + export_date. Delete it first or use a different date.",
        },
        409,
      );
    }
    return json({ error: insErr?.message ?? "Failed to create export" }, 500);
  }
  const exportId = exportRow.id;

  // 8. Insert snapshots in batches
  try {
    const BATCH = 500;
    let insertedTotal = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { data: inserted, error: rpcErr } = await admin.rpc("narp_insert_snapshots", {
        p_export_id: exportId,
        p_practice_id: practiceId,
        p_export_date: exportDate,
        p_rows: slice,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      insertedTotal += Number(inserted ?? 0);
    }

    const { count: persistedCount, error: countErr } = await admin
      .from("narp_patient_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("export_id", exportId);
    if (countErr) throw new Error(countErr.message);
    if ((persistedCount ?? 0) !== rows.length || insertedTotal !== rows.length) {
      throw new Error(
        `Snapshot persistence mismatch: expected ${rows.length}, inserted ${insertedTotal}, persisted ${persistedCount ?? 0}`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Snapshot insert failed";
    await admin
      .from("narp_exports")
      .update({ status: "failed", error_message: msg })
      .eq("id", exportId);
    return json({ error: msg, export_id: exportId }, 500);
  }

  // 9. Compute & insert cohort memberships
  try {
    const { data: snaps, error: selErr } = await admin
      .from("narp_patient_snapshots")
      .select("id, fk_patient_link_id")
      .eq("export_id", exportId);
    if (selErr) throw new Error(selErr.message);
    const idByFk = new Map<string, number>();
    for (const s of snaps ?? []) idByFk.set(s.fk_patient_link_id, s.id);

    const cohortRows: Array<{
      export_id: string;
      patient_snapshot_id: number;
      practice_id: string;
      cohort_key: string;
    }> = [];
    for (const r of rows) {
      const sid = idByFk.get(r.fk_patient_link_id);
      if (!sid) continue;
      for (const key of cohortKeysFor(r)) {
        cohortRows.push({
          export_id: exportId,
          patient_snapshot_id: sid,
          practice_id: practiceId,
          cohort_key: key,
        });
      }
    }
    if (cohortRows.length) {
      const BATCH = 1000;
      for (let i = 0; i < cohortRows.length; i += BATCH) {
        const { error: cErr } = await admin
          .from("narp_cohort_membership")
          .insert(cohortRows.slice(i, i + BATCH));
        if (cErr) throw new Error(cErr.message);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cohort insert failed";
    await admin
      .from("narp_exports")
      .update({ status: "failed", error_message: msg })
      .eq("id", exportId);
    return json({ error: msg, export_id: exportId }, 500);
  }

  // 10. Mark ready
  await admin
    .from("narp_exports")
    .update({ status: "ready", patient_count: rows.length })
    .eq("id", exportId);

  return json(
    {
      success: true,
      export_id: exportId,
      practice_id: practiceId,
      export_date: exportDate,
      patient_count: rows.length,
      checksum,
    },
    200,
  );
});
