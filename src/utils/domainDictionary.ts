import { supabase } from "@/integrations/supabase/client";

export interface DictionaryEntry {
  id: string;
  wrong_term: string;
  correct_term: string;
  category: string;
  created_at: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let cachedEntries: DictionaryEntry[] | null = null;

/** Load all dictionary entries (cached after first call). */
export async function loadDictionary(forceReload = false): Promise<DictionaryEntry[]> {
  if (cachedEntries && !forceReload) return cachedEntries;

  const { data, error } = await supabase
    .from("domain_dictionary")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load domain dictionary:", error);
    return cachedEntries ?? [];
  }

  cachedEntries = (data as DictionaryEntry[]) ?? [];
  return cachedEntries;
}

/**
 * Apply all domain dictionary corrections to text.
 * Longest terms are applied first to avoid partial matches.
 * Replacements are case-insensitive with word boundaries.
 */
export function applyDictionaryCorrections(
  text: string,
  entries: DictionaryEntry[]
): string {
  if (!text || entries.length === 0) return text;

  let result = text;

  // Sort longest-first to prevent partial-match collisions
  const sorted = [...entries].sort(
    (a, b) => b.wrong_term.length - a.wrong_term.length
  );

  for (const entry of sorted) {
    const pattern = new RegExp(
      `\\b${escapeRegex(entry.wrong_term)}\\b`,
      "gi"
    );
    result = result.replace(pattern, entry.correct_term);
  }

  return result;
}

/** Convenience: load + apply in one call. */
export async function correctTranscript(text: string): Promise<string> {
  const entries = await loadDictionary();
  return applyDictionaryCorrections(text, entries);
}
