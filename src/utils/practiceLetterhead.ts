/**
 * Practice Letterhead Helper
 *
 * Resolves the active letterhead for a given practice and returns a signed URL
 * to the original uploaded file (PDF/DOCX) together with the layout
 * configuration. The original file is preferred over the legacy
 * `rendered_png_path` so the on-screen preview, email and Word export all
 * reflect the file the user actually uploaded.
 *
 * Used by:
 *   - letterFormatter.ts        (Word/PDF export)
 *   - formatLetterForEmail.ts   (email HTML)
 *   - FormattedLetterContent    (preview)
 *
 * Falls back to `null` when no letterhead is configured — callers must keep the
 * existing Notewell-logo behaviour as a graceful default.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ActiveLetterhead {
  id: string;
  practice_id: string;
  /** Original uploaded file (PDF/DOCX) — preferred source for rendering. */
  storage_path: string;
  /** MIME type of the original file, when known. */
  original_mime_type: string | null;
  /** Original filename — used for mime fallback by extension. */
  original_filename: string | null;
  /** Optional pre-rendered PNG path (legacy / fallback). */
  rendered_png_path: string | null;
  /** Signed URL to the file we want callers to render (original if possible). */
  signed_url: string;
  /** True when the signed URL points at a pre-rendered PNG, not the original. */
  signed_url_is_png: boolean;
  height_cm: number;
  top_margin_cm: number;
  alignment: 'left' | 'center' | 'right';
  include_all_pages: boolean;
}

const CACHE = new Map<string, { value: ActiveLetterhead | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Resolve the active letterhead for a practice.
 * Returns `null` when no active letterhead exists or the user lacks access.
 */
export async function getActiveLetterhead(
  practiceId: string | null | undefined,
): Promise<ActiveLetterhead | null> {
  if (!practiceId) return null;

  const cached = CACHE.get(practiceId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    // Order by uploaded_at DESC so the newest active row wins if duplicates exist.
    const { data: rows, error } = await supabase
      .from('practice_letterheads')
      .select(
        'id, practice_id, storage_path, rendered_png_path, original_mime_type, original_filename, height_cm, top_margin_cm, alignment, include_all_pages',
      )
      .eq('practice_id', practiceId)
      .eq('active', true)
      .order('uploaded_at', { ascending: false })
      .limit(1);

    const row = rows && rows.length > 0 ? rows[0] : null;

    if (error || !row) {
      CACHE.set(practiceId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    // Prefer the ORIGINAL uploaded file. Only fall back to the rendered PNG
    // when no original is available (legacy rows).
    const useOriginal = !!row.storage_path;
    const path = useOriginal ? row.storage_path : row.rendered_png_path;
    if (!path) {
      CACHE.set(practiceId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('practice-letterheads')
      .createSignedUrl(path, 60 * 60); // 1 hour

    if (signErr || !signed?.signedUrl) {
      CACHE.set(practiceId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const value: ActiveLetterhead = {
      id: row.id,
      practice_id: row.practice_id,
      storage_path: row.storage_path,
      original_mime_type: row.original_mime_type ?? null,
      original_filename: row.original_filename ?? null,
      rendered_png_path: row.rendered_png_path ?? null,
      signed_url: signed.signedUrl,
      signed_url_is_png: !useOriginal,
      height_cm: Number(row.height_cm),
      top_margin_cm: Number(row.top_margin_cm),
      alignment: (row.alignment as ActiveLetterhead['alignment']) ?? 'center',
      include_all_pages: !!row.include_all_pages,
    };

    CACHE.set(practiceId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (err) {
    console.error('[practiceLetterhead] resolve failed:', err);
    return null;
  }
}

/**
 * Resolve the practice_id for a given complaint id.
 * Convenience for letter-generation call sites that have the complaint context.
 */
export async function getPracticeIdForComplaint(complaintId: string | null | undefined): Promise<string | null> {
  if (!complaintId) return null;
  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('practice_id')
      .eq('id', complaintId)
      .maybeSingle();
    if (error || !data?.practice_id) return null;
    return data.practice_id as string;
  } catch (err) {
    console.error('[practiceLetterhead] complaint→practice lookup failed:', err);
    return null;
  }
}

/** Convert centimetres to EMU for docx ImageRun (1cm = 360000 EMU). */
export const cmToEmu = (cm: number): number => Math.round(cm * 360000);

/** Convert centimetres to pixels at 96dpi for HTML/email previews. */
export const cmToPxScreen = (cm: number): number => Math.round(cm * 37.795);
