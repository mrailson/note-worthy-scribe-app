// Render Practice Letterhead — converts uploaded PDF / DOCX / image into a 300 DPI PNG
// stored in the `practice-letterheads` bucket and persisted via practice_letterheads.
//
// Input (multipart/form-data):
//   - file: File (PDF max 5MB single page, DOCX, or PNG/JPG min width 2480px)
//   - practice_id: string (uuid)
//   - height_cm?: number (default 6)
//   - top_margin_cm?: number (default 1)
//   - alignment?: 'left' | 'center' | 'right' (default 'center')
//   - include_all_pages?: 'true' | 'false' (default 'false')
//
// Returns: { id, rendered_png_path, original_path, width_px, height_px }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
// @ts-ignore - npm specifier resolved by Deno
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs";
// @ts-ignore
import mammoth from "https://esm.sh/mammoth@1.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_IMAGE_WIDTH_PX = 2480; // A4 @ 300 DPI
const TARGET_DPI = 300;
const A4_WIDTH_INCHES = 8.27;
const TARGET_WIDTH_PX = Math.round(A4_WIDTH_INCHES * TARGET_DPI); // ~2481

interface RenderResult {
  pngBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
}

async function renderPdfToPng(bytes: Uint8Array): Promise<RenderResult> {
  // Disable worker — run inline in the function runtime.
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;

  if (doc.numPages !== 1) {
    throw new Error(
      `PDF must be a single page (received ${doc.numPages}). Please trim to one page and re-upload.`,
    );
  }

  const page = await doc.getPage(1);
  // Compute scale so the rendered page is ~A4 width at 300 DPI.
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = TARGET_WIDTH_PX / baseViewport.width;
  const viewport = page.getViewport({ scale });

  // Use OffscreenCanvas (available in Deno Deploy via the canvas polyfill).
  // Fallback: use skia-canvas style createCanvas via npm.
  // @ts-ignore
  const { createCanvas } = await import("https://esm.sh/@napi-rs/canvas@0.1.53");
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  // Fill white background (PDFs may be transparent).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx as any, viewport }).promise;

  const pngBuffer = await canvas.encode("png");
  return {
    pngBytes: new Uint8Array(pngBuffer),
    widthPx: canvas.width,
    heightPx: canvas.height,
  };
}

async function renderDocxToPng(bytes: Uint8Array): Promise<RenderResult> {
  // Convert DOCX → HTML, slice header region, then rasterise via canvas.
  // We extract raw HTML and strip everything below an "---END LETTERHEAD---" marker
  // or the first empty paragraph.
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer });
  let html: string = result.value || "";

  const marker = /---\s*END\s+LETTERHEAD\s*---/i;
  if (marker.test(html)) {
    html = html.split(marker)[0];
  } else {
    // Take content up to first empty paragraph followed by body text.
    const emptyParaIdx = html.search(/<p>\s*<\/p>/i);
    if (emptyParaIdx > 0) html = html.slice(0, emptyParaIdx);
  }

  // Render the HTML to PNG using @napi-rs/canvas — we draw text approximations.
  // Since full HTML→canvas rasterisation isn't trivial server-side, we wrap it
  // and let the user visually verify in preview. Practitioners will overwhelmingly
  // use the PDF or image path; DOCX is a fallback.
  // @ts-ignore
  const { createCanvas, GlobalFonts } = await import("https://esm.sh/@napi-rs/canvas@0.1.53");
  const width = TARGET_WIDTH_PX;
  const height = Math.round(7 / 2.54 * TARGET_DPI); // 7cm tall canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.font = `${Math.round(TARGET_DPI / 6)}px sans-serif`;

  // Strip HTML tags and split into lines.
  const text = html
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  const lines = text.split(/\n+/).filter((l) => l.trim());
  const lineHeight = Math.round(TARGET_DPI / 4);
  let y = lineHeight;
  for (const line of lines) {
    if (y > height - lineHeight) break;
    ctx.fillText(line.trim(), width / 2 - ctx.measureText(line.trim()).width / 2, y);
    y += lineHeight;
  }

  const pngBuffer = await canvas.encode("png");
  return { pngBytes: new Uint8Array(pngBuffer), widthPx: width, heightPx: height };
}

async function renderImageToPng(bytes: Uint8Array, mime: string): Promise<RenderResult> {
  // @ts-ignore
  const { loadImage, createCanvas } = await import("https://esm.sh/@napi-rs/canvas@0.1.53");
  const img = await loadImage(bytes);
  if (img.width < MIN_IMAGE_WIDTH_PX) {
    throw new Error(
      `Image too narrow (${img.width}px). Minimum width is ${MIN_IMAGE_WIDTH_PX}px (A4 @ 300 DPI).`,
    );
  }
  // Re-encode as PNG to normalise.
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const pngBuffer = await canvas.encode("png");
  return { pngBytes: new Uint8Array(pngBuffer), widthPx: img.width, heightPx: img.height };
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT and resolve user.
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

    // Permission check via RPC helper.
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
    const mime = file.type || "application/octet-stream";
    const lowerName = file.name.toLowerCase();

    let rendered: RenderResult;
    if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
      if (bytes.byteLength > MAX_PDF_BYTES) {
        return new Response(
          JSON.stringify({ error: `PDF exceeds 5MB limit (${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB)` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      rendered = await renderPdfToPng(bytes);
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      rendered = await renderDocxToPng(bytes);
    } else if (mime.startsWith("image/") || /\.(png|jpg|jpeg)$/i.test(lowerName)) {
      rendered = await renderImageToPng(bytes, mime);
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${mime || file.name}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Store original + rendered PNG.
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

    // Insert row — trigger will deactivate previous active letterhead for this practice.
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
