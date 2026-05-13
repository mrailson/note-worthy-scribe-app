import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true if the current user is allowed to access the Population Risk page.
 * PML practice users are explicitly blocked.
 */
export function usePopulationRiskAccess() {
  const { user } = useAuth();

  const { data: isBlocked, isLoading } = useQuery({
    queryKey: ["population-risk-block", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return true;

      const { data, error } = await supabase
        .from("user_roles")
        .select("practice_id, gp_practices(name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (error || !data) return false; // allow if we can't determine practice

      const practiceName = (data.gp_practices as { name: string } | null)?.name ?? "";
      return practiceName.toUpperCase().trim() === "PML";
    },
  });

  return {
    isBlocked: isBlocked ?? false,
    isLoading,
    canAccess: !isBlocked && !isLoading,
  };
}
