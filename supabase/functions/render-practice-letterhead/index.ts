// Practice letterhead upload — stores the original PDF or DOCX as-is.
//
// Strategy: NO server-side rasterisation. We validate, upload the original
// file to Storage, insert the row in `practice_letterheads`, and return.
// Letter generation embeds the original file at generation time. The browser
// preview renders PDFs with PDF.js and shows a friendly placeholder for DOCX.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    // Auth-scoped client → permission RPC + RLS-protected reads.
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    console.log("[letterhead] caller uid:", userData?.user?.id ?? null);
    if (userErr || !userData.user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }
    const userId = userData.user.id;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const practiceId = String(formData.get("practice_id") || "");
    const heightCm = Number(formData.get("height_cm") ?? 6);
    const topMarginCm = Number(formData.get("top_margin_cm") ?? 1);
    const rawAlignment = String(formData.get("alignment") || "centre").toLowerCase();
    const alignment = (rawAlignment === "center" ? "centre" : rawAlignment) as
      | "left"
      | "centre"
      | "right";
    const includeAllPages =
      String(formData.get("include_all_pages") || "false") === "true";

    if (!file || !practiceId) {
      return jsonResponse({ error: "Missing file or practice_id" }, 400);
    }
    if (!["left", "centre", "right"].includes(alignment)) {
      return jsonResponse({ error: "Invalid alignment" }, 400);
    }
    if (heightCm < 3 || heightCm > 9 || topMarginCm < 0.5 || topMarginCm > 3) {
      return jsonResponse(
        { error: "Invalid height_cm or top_margin_cm" },
        400,
      );
    }

    const lowerName = file.name.toLowerCase();
    let mime = (file.type || "").toLowerCase();
    if (!mime) {
      if (lowerName.endsWith(".pdf")) mime = PDF_MIME;
      else if (lowerName.endsWith(".docx")) mime = DOCX_MIME;
    }
    const isPdf = mime === PDF_MIME || lowerName.endsWith(".pdf");
    const isDocx = mime === DOCX_MIME || lowerName.endsWith(".docx");
    if (!isPdf && !isDocx) {
      return jsonResponse(
        { error: `Unsupported file type. Please upload a PDF or DOCX.` },
        400,
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return jsonResponse(
        {
          error: `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
        },
        400,
      );
    }

    // Permission via the AUTH-scoped client so auth.uid() resolves.
    const { data: canManage, error: permErr } = await userClient.rpc(
      "can_manage_practice_letterhead",
      { _practice_id: practiceId },
    );
    if (permErr) {
      console.error("[letterhead] permission RPC error:", permErr);
      return jsonResponse(
        { error: `Permission check failed: ${permErr.message}` },
        500,
      );
    }
    if (!canManage) {
      return jsonResponse(
        {
          error:
            "You don't have permission to manage this practice's letterhead.",
        },
        403,
      );
    }

    // Service-role client for storage upload + DB insert.
    const admin = createClient(supabaseUrl, serviceRole);

    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = isPdf ? "pdf" : "docx";
    const originalPath = `${practiceId}/originals/${ts}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from("practice-letterheads")
      .upload(originalPath, bytes, {
        contentType: isPdf ? PDF_MIME : DOCX_MIME,
        upsert: false,
      });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    // Deactivate previous active letterhead(s) so only one is active per practice.
    await admin
      .from("practice_letterheads")
      .update({ active: false })
      .eq("practice_id", practiceId)
      .eq("active", true);

    const { data: row, error: insErr } = await admin
      .from("practice_letterheads")
      .insert({
        practice_id: practiceId,
        original_filename: file.name,
        original_mime_type: isPdf ? PDF_MIME : DOCX_MIME,
        storage_path: originalPath,
        // Reuse storage_path so existing letter-generation code that reads
        // rendered_png_path still gets a valid object reference. Letter code
        // should branch on original_mime_type to decide whether to embed the
        // PDF directly or raster the DOCX.
        rendered_png_path: originalPath,
        height_cm: heightCm,
        top_margin_cm: topMarginCm,
        alignment,
        include_all_pages: includeAllPages,
        uploaded_by: userId,
        active: true,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`DB insert failed: ${insErr.message}`);

    return jsonResponse({
      id: row.id,
      storage_path: originalPath,
      mime_type: isPdf ? PDF_MIME : DOCX_MIME,
      file_kind: ext,
    });
  } catch (err: any) {
    console.error("render-practice-letterhead error:", err);
    return jsonResponse({ error: err?.message || "Upload failed" }, 500);
  }
});
