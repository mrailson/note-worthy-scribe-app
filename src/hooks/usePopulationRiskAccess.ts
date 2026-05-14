import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Bugbrooke Population Risk PoC allow-list.
 * Only these named users may access /nres/population-risk while the
 * proof-of-concept is live. Anyone else is redirected away.
 */
const POPULATION_RISK_ALLOWED_EMAILS = [
  "rachel.parry2@nhs.net",
  "lucy.hibberd@nhs.net",
  "malcolm.railson@nhs.net",
] as const;

export function usePopulationRiskAccess() {
  const { user } = useAuth();

  const { data: isBlocked, isLoading } = useQuery({
    queryKey: ["population-risk-allowlist", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return true;

      // Resolve the user's email from auth or profiles, then check the allow-list.
      const authEmail = (user.email ?? "").toLowerCase().trim();
      let email = authEmail;
      if (!email) {
        const { data } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", user.id)
          .maybeSingle();
        email = (data?.email ?? "").toLowerCase().trim();
      }

      const allowed = POPULATION_RISK_ALLOWED_EMAILS.some(
        (e) => e.toLowerCase() === email,
      );
      return !allowed;
    },
  });

  return {
    isBlocked: isBlocked ?? false,
    isLoading,
    canAccess: !isBlocked && !isLoading,
  };
}
