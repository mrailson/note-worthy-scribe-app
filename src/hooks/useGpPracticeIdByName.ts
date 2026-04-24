import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a normalised practice name (upper-cased, single-spaced) to its
 * `gp_practices.id` UUID. Used to bridge the NARP file's PracticeName
 * string to the per-practice permission system.
 *
 * Returns `null` when the practice can't be matched (e.g. user picked
 * "All Practices" or the name in the NARP file isn't in gp_practices).
 */
export function useGpPracticeIdByName(normalisedName: string | null | undefined) {
  return useQuery({
    queryKey: ["gp-practice-id-by-name", normalisedName ?? null],
    enabled: !!normalisedName && normalisedName !== "All Practices",
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      if (!normalisedName || normalisedName === "All Practices") return null;
      const { data, error } = await supabase
        .from("gp_practices")
        .select("id, name")
        .ilike("name", normalisedName);
      if (error) {
        console.error("[useGpPracticeIdByName] lookup failed", error);
        return null;
      }
      // Tolerant match: ilike is case-insensitive but our normalisation
      // collapses whitespace too. Fall back to a normalised compare.
      const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
      const match = (data ?? []).find((p) => norm(p.name) === normalisedName);
      return match?.id ?? null;
    },
  });
}
