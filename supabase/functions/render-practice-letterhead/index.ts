// Render Practice Letterhead — converts uploaded PDF / DOCX / image into a PNG
// stored in the `practice-letterheads` bucket and persisted via practice_letterheads.
//
// Runtime constraints: Supabase Edge Runtime (Deno) on linux-arm64.
// → We avoid native NAPI modules (no @napi-rs/canvas) and rely on pure-WASM /
//   pure-JS libs only: pdfjs-dist (SVG output) + ImageScript + mammoth.
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

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
// @ts-ignore - npm specifier resolved by Deno
import * as pdfjs from "npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs";
// @ts-ignore
import mammoth from "npm:mammoth@1.8.0";
// @ts-ignore
import { Image, decode as decodeImage } from "npm:imagescript@1.3.0";
// @ts-ignore
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";

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

let resvgReady: Promise<void> | null = null;
async function ensureResvg() {
  if (!resvgReady) {
    resvgReady = (async () => {
      const wasmUrl =
        "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
      const wasm = await fetch(wasmUrl).then((r) => r.arrayBuffer());
      await initWasm(wasm);
    })();
  }
  return resvgReady;
}

/**
 * Render a single-page PDF to PNG using pdfjs-dist's SVG backend (no native canvas).
 * The SVG is then rasterised via resvg-wasm (pure WASM).
 */
async function renderPdfToPng(bytes: Uint8Array): Promise<RenderResult> {
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
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = TARGET_WIDTH_PX / baseViewport.width;
  const viewport = page.getViewport({ scale });

  // pdfjs SVG backend
  const opList = await page.getOperatorList();
  // @ts-ignore - SVGGraphics is exposed in legacy build
  const SVGGraphics = (pdfjs as any).SVGGraphics;
  if (!SVGGraphics) {
    throw new Error("PDF rendering not supported in this runtime build.");
  }
  const svgGfx = new SVGGraphics(page.commonObjs, page.objs);
  const svgElement = await svgGfx.getSVG(opList, viewport);
  // svgElement is a fake DOM node from pdfjs — serialise to string
  const svgString = svgElement?.toString?.() || serialiseSvg(svgElement, viewport);

  await ensureResvg();
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: Math.ceil(viewport.width) },
    background: "#ffffff",
  });
  const pngData = resvg.render();
  const pngBytes = pngData.asPng();
  return {
    pngBytes,
    widthPx: pngData.width,
    heightPx: pngData.height,
  };
}

function serialiseSvg(node: any, viewport: { width: number; height: number }): string {
  // Fallback minimal SVG when pdfjs's fake DOM doesn't expose toString.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(viewport.width)}" height="${Math.ceil(viewport.height)}"><rect width="100%" height="100%" fill="white"/></svg>`;
}

/**
 * Render a DOCX letterhead by extracting text-only HTML and laying it out in an SVG,
 * then rasterising via resvg-wasm.
 */
async function renderDocxToPng(bytes: Uint8Array): Promise<RenderResult> {
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer });
  let html: string = result.value || "";

  const marker = /---\s*END\s+LETTERHEAD\s*---/i;
  if (marker.test(html)) {
    html = html.split(marker)[0];
  } else {
    const emptyParaIdx = html.search(/<p>\s*<\/p>/i);
    if (emptyParaIdx > 0) html = html.slice(0, emptyParaIdx);
  }

  const text = html
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const width = TARGET_WIDTH_PX;
  const fontSize = Math.round(TARGET_DPI / 6); // ~50px
  const lineHeight = Math.round(fontSize * 1.4);
  const padTop = Math.round(TARGET_DPI / 4);
  const height = Math.max(
    Math.round((7 / 2.54) * TARGET_DPI),
    padTop + lines.length * lineHeight + padTop,
  );

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const tspans = lines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${padTop + (i + 1) * lineHeight}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="#000000">${escapeXml(line)}</text>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/>${tspans}</svg>`;

  await ensureResvg();
  const resvg = new Resvg(svg, {
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

/**
 * Image input — decode with ImageScript, ensure white background and min width.
 */
async function renderImageToPng(bytes: Uint8Array, _mime: string): Promise<RenderResult> {
  const decoded: any = await decodeImage(bytes);
  if (decoded.width < MIN_IMAGE_WIDTH_PX) {
    throw new Error(
      `Image too narrow (${decoded.width}px). Minimum width is ${MIN_IMAGE_WIDTH_PX}px (A4 @ 300 DPI).`,
    );
  }
  // Composite onto white background to flatten any transparency.
  const bg = new Image(decoded.width, decoded.height).fill(0xffffffff);
  bg.composite(decoded, 0, 0);
  const pngBytes = await bg.encode();
  return {
    pngBytes: new Uint8Array(pngBytes),
    widthPx: bg.width,
    heightPx: bg.height,
  };
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
