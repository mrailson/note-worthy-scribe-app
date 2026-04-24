// NARP Identifiable CSV Export — Phase B
// ────────────────────────────────────────────────────────────────────────
// Permission-gated identifiable export for the NRES Population Risk module.
// Writes one row to narp_export_log per call. Decryption key (NARP_PII_KEY)
// is held server-side only.
//
// Request body:
//   {
//     practice_id: string (uuid),
//     practice_name: string,
//     reason_text: string (>= 10 chars),
//     consent_acknowledged: boolean (must be true),
//     fk_patient_link_ids?: string[]      // optional cohort filter
//     cohort_label?: string               // for audit log + filename
//   }
//
// Response:
//   { csv_base64, filename, sha256, row_count, export_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExportRequest {
  practice_id: string;
  practice_name?: string;
  reason_text: string;
  consent_acknowledged: boolean;
  fk_patient_link_ids?: string[];
  cohort_label?: string;
}

interface ExportRow {
  fk_patient_link_id: string;
  nhs_number: string | null;
  surname: string | null;
  forename: string | null;
  age: number | null;
  frailty_category: string | null;
  drug_count: number | null;
  inpatient_total_admissions: number | null;
  ae_attendances: number | null;
  rub: string | null;
  poa: number | null;
  polos: number | null;
  risk_tier: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Auth ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const jwt = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const PII_KEY = Deno.env.get("NARP_PII_KEY");

    if (!PII_KEY) {
      console.error("[narp-export-identifiable] NARP_PII_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server not configured for identifiable export" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // User-context client for permission checks (RLS + RPC SECURITY DEFINER)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // ── 2. Validate body ────────────────────────────────────────────────
    const body = (await req.json().catch(() => null)) as ExportRequest | null;
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: Record<string, string> = {};
    if (!body.practice_id || !UUID_RE.test(body.practice_id))
      errors.practice_id = "Valid practice_id (uuid) required";
    if (!body.reason_text || body.reason_text.trim().length < 10)
      errors.reason_text = "Reason must be at least 10 characters";
    if (body.consent_acknowledged !== true)
      errors.consent_acknowledged = "Consent acknowledgement is required";
    if (Object.keys(errors).length > 0) {
      return new Response(JSON.stringify({ error: errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Fetch + decrypt rows via permission-gated RPC ────────────────
    // The RPC enforces has_can_export_narp_identifiable(auth.uid(), practice_id).
    const { data: rows, error: rpcErr } = await userClient.rpc(
      "get_narp_export_rows",
      { _practice_id: body.practice_id, _key: PII_KEY },
    );

    if (rpcErr) {
      console.error("[narp-export-identifiable] RPC failed", rpcErr);
      const status = rpcErr.code === "42501" ? 403 : 500;
      return new Response(
        JSON.stringify({
          error: status === 403
            ? "You do not have permission to export identifiable data for this practice"
            : "Failed to fetch export rows",
          detail: rpcErr.message,
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let exportRows = (rows ?? []) as ExportRow[];

    // Optional cohort restriction
    if (body.fk_patient_link_ids && body.fk_patient_link_ids.length > 0) {
      const set = new Set(body.fk_patient_link_ids);
      exportRows = exportRows.filter((r) => set.has(r.fk_patient_link_id));
    }

    // ── 4. Build CSV ────────────────────────────────────────────────────
    const exportId = crypto.randomUUID();
    const headers = [
      "NHS_Number",
      "Surname",
      "Forename",
      "DOB",                    // blanked for v1 (not on snapshot)
      "Age",
      "Usual_GP",               // blanked — no join source
      "Frailty_eFI",
      "Drug_Count",
      "Inpatient_Admissions",
      "AE_Attendances",
      "RUB",
      "PoA_pct",
      "PoLoS_pct",
      "Risk_Tier",
      "FK_Patient_Link_ID",     // last so Excel doesn't auto-format
      "Export_ID",
    ];

    const lines: string[] = [headers.join(",")];
    for (const r of exportRows) {
      lines.push([
        csvEscape(r.nhs_number ?? ""),
        csvEscape(r.surname ?? ""),
        csvEscape(r.forename ?? ""),
        "",                                             // DOB
        csvEscape(r.age ?? ""),
        "",                                             // Usual_GP
        csvEscape(r.frailty_category ?? ""),
        csvEscape(r.drug_count ?? ""),
        csvEscape(r.inpatient_total_admissions ?? ""),
        csvEscape(r.ae_attendances ?? ""),
        csvEscape(r.rub ?? ""),
        csvEscape(r.poa ?? ""),
        csvEscape(r.polos ?? ""),
        csvEscape(r.risk_tier ?? ""),
        csvEscape(r.fk_patient_link_id),
        exportId,
      ].join(","));
    }

    const csv = lines.join("\r\n") + "\r\n";
    const csvBytes = new TextEncoder().encode(csv);
    const checksum = await sha256Hex(csvBytes);

    // ── 5. Filename ─────────────────────────────────────────────────────
    const safePractice = (body.practice_name ?? "practice")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "practice";
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `narp-${safePractice}-identifiable-${stamp}.csv`;

    // ── 6. Audit log (service-role insert; bypasses no-client-insert RLS)
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const requestIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      null;
    const userAgent = req.headers.get("user-agent") ?? null;

    const { error: logErr } = await adminClient.from("narp_export_log").insert({
      id: exportId,
      user_id: user.id,
      user_email: user.email,
      practice_id: body.practice_id,
      included_identifiers: true,
      row_count: exportRows.length,
      column_count: headers.length,
      reason_text: body.reason_text.trim().slice(0, 2000),
      consent_acknowledged: true,
      file_checksum: checksum,
      file_size_bytes: csvBytes.byteLength,
      filename,
      cohort_label: body.cohort_label?.slice(0, 200) ?? null,
      request_ip: requestIp,
      user_agent: userAgent?.slice(0, 500) ?? null,
    });

    if (logErr) {
      console.error("[narp-export-identifiable] audit insert failed", logErr);
      return new Response(
        JSON.stringify({ error: "Failed to write export audit row", detail: logErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 7. Return CSV bytes (base64) + checksum to client ───────────────
    return new Response(
      JSON.stringify({
        export_id: exportId,
        filename,
        sha256: checksum,
        row_count: exportRows.length,
        column_count: headers.length,
        file_size_bytes: csvBytes.byteLength,
        csv_base64: encodeBase64(csvBytes),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[narp-export-identifiable] unhandled", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
