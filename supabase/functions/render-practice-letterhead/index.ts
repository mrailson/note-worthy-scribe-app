// Render Practice Letterhead — converts uploaded PDF / DOCX / image into a PNG
// stored in `practice-letterheads` and persisted via practice_letterheads.
//
// Runtime: Supabase Edge Runtime (Deno). Strategy chosen for reliability:
//   - PNG  : verified by header bytes, stored as-is (no decode needed).
//   - JPEG : decode + re-encode via jsr:@img/jpeg + jsr:@img/png (pure Deno).
//   - PDF  : text extracted via unpdf (Deno-native), rendered onto an A4 PNG
//            via SVG + @resvg/resvg-wasm. Single page only (typical letterhead).
//   - DOCX : text extracted via mammoth, rendered the same way.
//
// All heavy deps are dynamically imported inside the request handler so a
// single broken dep returns a clean 500 with a useful message rather than
// preventing the function from booting (which would surface as the unhelpful
// "Failed to send a request to the Edge Function").

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_IMAGE_WIDTH_PX = 2480; // A4 @ 300 DPI
const TARGET_DPI = 300;
const A4_WIDTH_INCHES = 8.27;
const TARGET_WIDTH_PX = Math.round(A4_WIDTH_INCHES * TARGET_DPI); // ~2481
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_DOCX_BYTES = 10 * 1024 * 1024; // 10MB

interface RenderResult {
  pngBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
}

// ---------------------------------------------------------------------------
// PNG header parsing (zero deps)
// ---------------------------------------------------------------------------
function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

async function handlePngBytes(bytes: Uint8Array): Promise<RenderResult> {
  const dims = parsePngDimensions(bytes);
  if (!dims) throw new Error("File is not a valid PNG (signature/IHDR check failed).");
  if (dims.width < MIN_IMAGE_WIDTH_PX) {
    throw new Error(
      `PNG too narrow (${dims.width}px). Minimum width is ${MIN_IMAGE_WIDTH_PX}px (A4 @ 300 DPI). Please re-export at higher resolution.`,
    );
  }
  return { pngBytes: bytes, widthPx: dims.width, heightPx: dims.height };
}

// ---------------------------------------------------------------------------
// JPEG → PNG via pure-Deno jsr:@img modules
// ---------------------------------------------------------------------------
async function handleJpegBytes(bytes: Uint8Array): Promise<RenderResult> {
  let jpeg: any, png: any;
  try {
    // @ts-ignore - jsr specifier
    jpeg = await import("jsr:@img/jpeg@0.1.4");
    // @ts-ignore - jsr specifier
    png = await import("jsr:@img/png@0.1.4");
  } catch (e: any) {
    throw new Error(
      `JPEG support unavailable in this runtime (${e?.message ?? "unknown error"}). Please re-export your letterhead as PNG and try again.`,
    );
  }
  const decoded = await jpeg.decode(bytes);
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
// resvg-wasm singleton (used to rasterise text-only SVG → PNG)
// ---------------------------------------------------------------------------
let resvgReady: Promise<any> | null = null;
async function loadResvg() {
  if (!resvgReady) {
    resvgReady = (async () => {
      // @ts-ignore - npm specifier
      const mod = await import("npm:@resvg/resvg-wasm@2.6.2");
      const wasmUrl = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
      const wasm = await fetch(wasmUrl).then((r) => r.arrayBuffer());
      await mod.initWasm(wasm);
      return mod;
    })();
  }
  return resvgReady;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Build a clean A4-width PNG from the supplied lines of text using SVG + resvg.
 * Used for both PDF and DOCX paths where we extract text only.
 */
async function renderLinesToPng(lines: string[]): Promise<RenderResult> {
  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("No text could be extracted from the document.");
  }
  // Cap so we don't render a 30-line essay as a "letterhead".
  const limited = cleaned.slice(0, 12);

  const width = TARGET_WIDTH_PX;
  const fontSize = Math.round(TARGET_DPI / 6); // ~50px ≈ 12pt @ 300 dpi
  const lineHeight = Math.round(fontSize * 1.4);
  const padTop = Math.round(TARGET_DPI / 4); // ~0.25in
  const padBottom = padTop;
  const minHeight = Math.round((6 / 2.54) * TARGET_DPI); // 6cm minimum
  const height = Math.max(minHeight, padTop + limited.length * lineHeight + padBottom);

  const tspans = limited
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${padTop + (i + 1) * lineHeight}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="#000000">${escapeXml(line)}</text>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/>${tspans}</svg>`;

  const resvgMod = await loadResvg();
  const resvg = new resvgMod.Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "#ffffff",
  });
  const pngData = resvg.render();
  return {
    pngBytes: pngData.asPng(),
    widthPx: pngData.width,
    heightPx: pngData.height,
  };
}

// ---------------------------------------------------------------------------
// PDF → PNG via unpdf (text extraction) + resvg
// ---------------------------------------------------------------------------
async function renderPdfToPng(bytes: Uint8Array): Promise<RenderResult> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF exceeds ${MAX_PDF_BYTES / 1024 / 1024}MB limit (${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB).`,
    );
  }
  let unpdf: any;
  try {
    // @ts-ignore - esm specifier (Deno-native, no Node bindings)
    unpdf = await import("https://esm.sh/unpdf@0.12.1");
  } catch (e: any) {
    throw new Error(
      `PDF support unavailable in this runtime (${e?.message ?? "unknown error"}). Please upload a PNG letterhead instead.`,
    );
  }
  const { text } = await unpdf.extractText(bytes, { mergePages: true });
  const lines = (typeof text === "string" ? text : Array.isArray(text) ? text.join("\n") : "")
    .split(/\r?\n+/);
  return renderLinesToPng(lines);
}

// ---------------------------------------------------------------------------
// DOCX → PNG via mammoth (text extraction) + resvg
// ---------------------------------------------------------------------------
async function renderDocxToPng(bytes: Uint8Array): Promise<RenderResult> {
  if (bytes.byteLength > MAX_DOCX_BYTES) {
    throw new Error(
      `DOCX exceeds ${MAX_DOCX_BYTES / 1024 / 1024}MB limit (${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB).`,
    );
  }
  let mammoth: any;
  try {
    // @ts-ignore - npm specifier
    const mod = await import("npm:mammoth@1.8.0");
    mammoth = mod.default ?? mod;
  } catch (e: any) {
    throw new Error(
      `DOCX support unavailable in this runtime (${e?.message ?? "unknown error"}). Please upload a PNG letterhead instead.`,
    );
  }
  const result = await mammoth.extractRawText({
    arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  const raw: string = result?.value || "";
  // Honour an optional "--- END LETTERHEAD ---" marker so users can include
  // body content in the same DOCX.
  const marker = /---\s*END\s+LETTERHEAD\s*---/i;
  const trimmed = marker.test(raw) ? raw.split(marker)[0] : raw;
  const lines = trimmed.split(/\r?\n+/);
  return renderLinesToPng(lines);
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
      rendered = await renderPdfToPng(bytes);
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      rendered = await renderDocxToPng(bytes);
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${mime || file.name}. Please upload PNG, JPG, PDF, or DOCX.` }),
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
