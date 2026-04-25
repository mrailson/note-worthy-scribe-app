import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * NRES / NMoC Data Sharing Agreement — identifiable-data access hook.
 *
 * Resolves the current user's NARP identifiable-data permissions and emits
 * one page-load audit row each time identifiers are actually rendered for
 * the supplied practice.
 *
 * Permission model (per-practice, stored on user_roles):
 *   can_view_narp_identifiable    → see NHS no, name, DOB inline
 *   can_export_narp_identifiable  → see "Export with identifiers" button
 *                                   (superset; export implies view)
 *
 * Returns:
 *   canView          — user holds view rights for THIS practice (inline render)
 *   canExport        — user holds export rights for THIS practice
 *   hasViewElsewhere — user holds view rights for SOME practice but not this one
 *                      (the rare cross-practice "reveal + reason" exception path)
 *   isLoading        — initial query in flight
 */
export interface NarpIdentifiableAccess {
  canView: boolean;
  canExport: boolean;
  hasViewElsewhere: boolean;
  isLoading: boolean;
}

interface UseNarpIdentifiableAccessOptions {
  /** UUID of the gp_practices row currently being viewed. Null when no practice is selected (e.g. "All Practices"). */
  practiceId: string | null | undefined;
  /** Number of identifiable patients rendered on the page. Triggers an audit row when > 0 and canView is true. */
  patientCountRendered?: number;
  /** Route key for the audit log (e.g. "/nres/population-risk"). */
  route?: string;
  /** Set to false on screens that just need permission resolution without auditing (modals etc.). */
  enableAudit?: boolean;
}

interface RoleRow {
  practice_id: string | null;
  can_view_narp_identifiable: boolean | null;
  can_export_narp_identifiable: boolean | null;
}

export function useNarpIdentifiableAccess(
  options: UseNarpIdentifiableAccessOptions,
): NarpIdentifiableAccess {
  const { practiceId, patientCountRendered = 0, route, enableAudit = true } = options;

  // Pull every NARP-identifiable grant for the current user in one query.
  // Per-practice scoping is then evaluated client-side against `practiceId`.
  const { data: roles, isLoading } = useQuery({
    queryKey: ["narp-identifiable-roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("practice_id, can_view_narp_identifiable, can_export_narp_identifiable")
        .eq("user_id", auth.user.id);
      if (error) {
        console.error("[useNarpIdentifiableAccess] role lookup failed", error);
        return [];
      }
      return (data ?? []) as RoleRow[];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  const access = useMemo<Omit<NarpIdentifiableAccess, "isLoading">>(() => {
    const grants = roles ?? [];
    const grantsForThisPractice = practiceId
      ? grants.filter((r) => r.practice_id === practiceId || r.practice_id === null)
      : grants.filter((r) => r.practice_id === null);
    const canView = grantsForThisPractice.some((r) => r.can_view_narp_identifiable === true);
    const canExport = grantsForThisPractice.some((r) => r.can_export_narp_identifiable === true);
    const hasViewElsewhere =
      !canView && grants.some((r) => r.can_view_narp_identifiable === true);
    return { canView, canExport, hasViewElsewhere };
  }, [roles, practiceId]);

  // Page-load audit: write ONE row per (practice, route, count) bucket per
  // page life. We dedupe inside this hook so a parent re-render with the
  // same inputs doesn't spam the log table.
  const lastLoggedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!enableAudit) return;
    if (!access.canView) return;
    if (!practiceId) return;
    if (patientCountRendered <= 0) return;
    const key = `${practiceId}|${route ?? ""}|${patientCountRendered}`;
    if (lastLoggedKey.current === key) return;
    lastLoggedKey.current = key;
    void supabase
      .rpc("log_narp_pii_page_access", {
        _practice_id: practiceId,
        _route: route ?? (typeof window !== "undefined" ? window.location.pathname : "unknown"),
        _patient_count_rendered: patientCountRendered,
      })
      .then(({ error }) => {
        if (error) {
          // Audit is best-effort. Surface in console only.
          console.warn("[useNarpIdentifiableAccess] audit row failed", error);
        }
      });
  }, [access.canView, practiceId, route, patientCountRendered, enableAudit]);

  return { ...access, isLoading };
}
