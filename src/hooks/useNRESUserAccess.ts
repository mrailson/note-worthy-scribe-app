import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NRESUser } from "@/types/nresAccess";

export const useNRESUserAccess = () => {
  return useQuery({
    queryKey: ["nres-user-access"],
    queryFn: async (): Promise<NRESUser[]> => {
      // Get all users with NRES service activation
      const { data: activations, error: activationsError } = await supabase
        .from("user_service_activations")
        .select("user_id, activated_at")
        .eq("service", "nres");

      if (activationsError) {
        console.error("Error fetching NRES activations:", activationsError);
        throw activationsError;
      }

      if (!activations || activations.length === 0) {
        return [];
      }

      // Get unique user IDs
      const userIds = [...new Set(activations.map((a) => a.user_id))];

      // Fetch user profiles (profiles table uses user_id, not id)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      // Fetch user roles with practice info
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, practice_id, gp_practices(name)")
        .in("user_id", userIds);

      if (rolesError) {
        console.error("Error fetching user roles:", rolesError);
      }

      // Create lookup maps
      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );
      
      const practiceMap = new Map<string, string>();
      (userRoles || []).forEach((ur) => {
        if (ur.gp_practices && !practiceMap.has(ur.user_id)) {
          practiceMap.set(ur.user_id, (ur.gp_practices as { name: string }).name);
        }
      });

      // Get earliest activation per user (deduplicate)
      const userActivationMap = new Map<string, string>();
      activations.forEach((a) => {
        const existing = userActivationMap.get(a.user_id);
        if (!existing || new Date(a.activated_at) < new Date(existing)) {
          userActivationMap.set(a.user_id, a.activated_at);
        }
      });

      // Combine data
      const users: NRESUser[] = Array.from(userActivationMap.entries()).map(
        ([userId, activatedAt]) => {
          const profile = profileMap.get(userId);
          return {
            user_id: userId,
            full_name: profile?.full_name || null,
            email: profile?.email || null,
            practice_name: practiceMap.get(userId) || null,
            activated_at: activatedAt,
          };
        }
      );

      // Sort by practice name, then by name
      return users.sort((a, b) => {
        const practiceA = a.practice_name || "zzz";
        const practiceB = b.practice_name || "zzz";
        if (practiceA !== practiceB) {
          return practiceA.localeCompare(practiceB);
        }
        const nameA = a.full_name || a.email || "";
        const nameB = b.full_name || b.email || "";
        return nameA.localeCompare(nameB);
      });
    },
  });
};
