// Render Practice Letterhead — converts uploaded image into a PNG stored in
// the `practice-letterheads` bucket and persisted via practice_letterheads.
//
// Runtime: Supabase Edge Runtime (Deno). To stay reliable, this function
// AVOIDS heavyweight WASM PDF/canvas libraries (which repeatedly broke boot or
// runtime in this environment). Strategy:
//
//   - PNG  : verify signature + width via PNG header parse, store as-is.
//   - JPEG : decode → re-encode to PNG via jsr:@img/png + jsr:@img/jpeg
//            (pure-Deno, no native, no NPM WASM init quirks).
//   - PDF  : returns a clear 415 error asking user to upload a flattened PNG
//            (recommended workflow: "Print to PDF → export page as PNG").
//   - DOCX : returns a clear 415 error asking user to export the letterhead
//            as PNG and re-upload.
//
// Storage paths, RLS, table shape and call-site contract are unchanged.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_IMAGE_WIDTH_PX = 2480; // A4 @ 300 DPI

interface RenderResult {
  pngBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
}

// ---------------------------------------------------------------------------
// PNG header parsing (no external deps)
// ---------------------------------------------------------------------------
function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A, then IHDR chunk at byte 8.
  // IHDR layout: 4-byte length, "IHDR", 4-byte width, 4-byte height, ...
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

async function handlePngBytes(bytes: Uint8Array): Promise<RenderResult> {
  const dims = parsePngDimensions(bytes);
  if (!dims) {
    throw new Error("File is not a valid PNG (signature/IHDR check failed).");
  }
  if (dims.width < MIN_IMAGE_WIDTH_PX) {
    throw new Error(
      `PNG too narrow (${dims.width}px). Minimum width is ${MIN_IMAGE_WIDTH_PX}px (A4 @ 300 DPI). Please re-export at higher resolution.`,
    );
  }
  return { pngBytes: bytes, widthPx: dims.width, heightPx: dims.height };
}

// ---------------------------------------------------------------------------
// JPEG → PNG via pure-Deno jsr:@img modules (no WASM init dance, no NPM)
// ---------------------------------------------------------------------------
async function handleJpegBytes(bytes: Uint8Array): Promise<RenderResult> {
  let jpeg: any;
  let png: any;
  try {
    // @ts-ignore - jsr specifier
    jpeg = await import("jsr:@img/jpeg@0.1.4");
    // @ts-ignore - jsr specifier
    png = await import("jsr:@img/png@0.1.4");
  } catch (e: any) {
    throw new Error(
      `JPEG support unavailable in this runtime (${e?.message ?? "unknown error"}). Please re-export your letterhead as a PNG and try again.`,
    );
  }
  const decoded = await jpeg.decode(bytes); // { data: Uint8Array RGBA, width, height }
  if (decoded.width < MIN_IMAGE_WIDTH_PX) {
    throw new Error(
      `Image too narrow (${decoded.width}px). Minimum width is ${MIN_IMAGE_WIDTH_PX}px (A4 @ 300 DPI).`,
    );
  }
  const pngBytes: Uint8Array = await png.encode({
    data: decoded.data,
    width: decoded.width,
    height: decoded.height,
  });
  return { pngBytes, widthPx: decoded.width, heightPx: decoded.height };
}

// ---------------------------------------------------------------------------
// HTTP entry
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const practiceId = String(formData.get("practice_id") || "");
    const heightCm = Number(formData.get("height_cm") ?? 6);
    const topMarginCm = Number(formData.get("top_margin_cm") ?? 1);
    const alignment = String(formData.get("alignment") || "center") as
      | "left"
      | "center"
      | "right";
    const includeAllPages = String(formData.get("include_all_pages") || "false") === "true";

    if (!file || !practiceId) {
      return new Response(
        JSON.stringify({ error: "Missing file or practice_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!["left", "center", "right"].includes(alignment)) {
      return new Response(JSON.stringify({ error: "Invalid alignment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (heightCm < 3 || heightCm > 9 || topMarginCm < 0.5 || topMarginCm > 3) {
      return new Response(JSON.stringify({ error: "Invalid height_cm or top_margin_cm" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRole);
    const { data: canManage, error: permErr } = await admin.rpc(
      "can_manage_practice_letterhead",
      { _practice_id: practiceId },
    );
    if (permErr || !canManage) {
      return new Response(
        JSON.stringify({ error: "Forbidden — you cannot manage this practice's letterhead" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = (file.type || "application/octet-stream").toLowerCase();
    const lowerName = file.name.toLowerCase();

    let rendered: RenderResult;
    if (mime === "image/png" || lowerName.endsWith(".png")) {
      rendered = await handlePngBytes(bytes);
    } else if (mime === "image/jpeg" || /\.(jpg|jpeg)$/i.test(lowerName)) {
      rendered = await handleJpegBytes(bytes);
    } else if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
      return new Response(
        JSON.stringify({
          error:
            "PDF letterhead upload is temporarily unavailable. Please export your letterhead as a PNG (A4 @ 300 DPI, min 2480px wide) and upload that instead. In Word: File → Export → Create PDF/XPS, then open the PDF and use 'Save as Image (PNG)'.",
        }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      return new Response(
        JSON.stringify({
          error:
            "DOCX letterhead upload is temporarily unavailable. Please open your letterhead in Word, take a high-resolution screenshot of the header (or 'Save as PNG'), and upload the PNG (min 2480px wide).",
        }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${mime || file.name}. Please upload a PNG.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const originalPath = `${practiceId}/originals/${ts}-${safeName}`;
    const renderedPath = `${practiceId}/rendered/${ts}-letterhead.png`;

    const { error: upOrigErr } = await admin.storage
      .from("practice-letterheads")
      .upload(originalPath, bytes, { contentType: mime, upsert: false });
    if (upOrigErr) throw new Error(`Original upload failed: ${upOrigErr.message}`);

    const { error: upRendErr } = await admin.storage
      .from("practice-letterheads")
      .upload(renderedPath, rendered.pngBytes, {
        contentType: "image/png",
        upsert: false,
      });
    if (upRendErr) throw new Error(`Rendered upload failed: ${upRendErr.message}`);

    const { data: row, error: insErr } = await admin
      .from("practice_letterheads")
      .insert({
        practice_id: practiceId,
        original_filename: file.name,
        storage_path: originalPath,
        rendered_png_path: renderedPath,
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

    return new Response(
      JSON.stringify({
        id: row.id,
        rendered_png_path: renderedPath,
        original_path: originalPath,
        width_px: rendered.widthPx,
        height_px: rendered.heightPx,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("render-practice-letterhead error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Render failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
