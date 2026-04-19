/**
 * Practice Letterhead Helper
 *
 * Resolves the active letterhead for a given practice and returns a signed URL
 * to the rendered 300 DPI PNG together with the layout configuration.
 *
 * Used by:
 *   - letterFormatter.ts        (Word/PDF export)
 *   - formatLetterForEmail.ts   (email HTML)
 *
 * Falls back to `null` when no letterhead is configured — callers must keep the
 * existing Notewell-logo behaviour as a graceful default.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ActiveLetterhead {
  id: string;
  practice_id: string;
  rendered_png_path: string;
  signed_url: string;
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
    const { data: row, error } = await supabase
      .from('practice_letterheads')
      .select('id, practice_id, rendered_png_path, height_cm, top_margin_cm, alignment, include_all_pages')
      .eq('practice_id', practiceId)
      .eq('active', true)
      .maybeSingle();

    if (error || !row?.rendered_png_path) {
      CACHE.set(practiceId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('practice-letterheads')
      .createSignedUrl(row.rendered_png_path, 60 * 60); // 1 hour

    if (signErr || !signed?.signedUrl) {
      CACHE.set(practiceId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const value: ActiveLetterhead = {
      id: row.id,
      practice_id: row.practice_id,
      rendered_png_path: row.rendered_png_path,
      signed_url: signed.signedUrl,
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
