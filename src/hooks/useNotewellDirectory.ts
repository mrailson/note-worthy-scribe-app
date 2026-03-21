import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NotewellUser {
  user_id: string;
  full_name: string;
  email: string;
  role: string | null;
  title: string | null;
  practice_name: string;
  organisation_type: string;
  practice_role: string | null;
}

interface PracticeGroup {
  practice_name: string;
  organisation_type: string;
  users: NotewellUser[];
}

/** Organisation types to include in the Notewell directory */
const INCLUDED_ORG_TYPES = ['Practice', 'Management', 'ICB'];

/** Practice names for NRES practices (partial match) */
const NRES_PRACTICE_NAMES = [
  'Parks', 'Brackley', 'Springfield', 'Towcester',
  'Bugbrooke', 'Brook Health', 'Denton Village',
];

export function useNotewellDirectory(options?: { includeAll?: boolean }) {
  const includeAll = options?.includeAll ?? false;
  const { user } = useAuth();
  const [practiceGroups, setPracticeGroups] = useState<PracticeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchDirectory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch user_roles with practice info
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, practice_id, practice_role, role')
        .not('practice_id', 'is', null);

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) { setPracticeGroups([]); return; }

      // Get unique practice IDs
      const practiceIds = [...new Set(roles.map(r => r.practice_id).filter(Boolean))] as string[];

      // Fetch practices (filter by org type)
      const { data: practices, error: practicesError } = await supabase
        .from('gp_practices')
        .select('id, name, organisation_type')
        .in('id', practiceIds);

      if (practicesError) throw practicesError;

      // Filter to NRES practices + Management (PML) + ICB
      const filteredPractices = (practices || []).filter(p => {
        const orgType = p.organisation_type || '';
        // Include Management and ICB orgs
        if (orgType === 'Management' || orgType === 'ICB') return true;
        // Include NRES practices only (not all Practice orgs)
        if (orgType === 'Practice') {
          return NRES_PRACTICE_NAMES.some(name =>
            p.name.toLowerCase().includes(name.toLowerCase())
          );
        }
        return false;
      });

      const filteredPracticeIds = new Set(filteredPractices.map(p => p.id));

      // Filter roles to only those in filtered practices
      const filteredRoles = roles.filter(r => r.practice_id && filteredPracticeIds.has(r.practice_id));
      const userIds = [...new Set(filteredRoles.map(r => r.user_id))];

      if (userIds.length === 0) { setPracticeGroups([]); return; }

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role, title')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const practiceMap = new Map(filteredPractices.map(p => [p.id, p]));

      // Build grouped data
      const groupMap = new Map<string, PracticeGroup>();

      for (const role of filteredRoles) {
        const practice = practiceMap.get(role.practice_id!);
        const profile = profileMap.get(role.user_id);
        if (!practice || !profile) continue;

        const key = practice.id;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            practice_name: practice.name,
            organisation_type: practice.organisation_type,
            users: [],
          });
        }

        // Avoid duplicates
        const group = groupMap.get(key)!;
        if (!group.users.some(u => u.user_id === role.user_id)) {
          group.users.push({
            user_id: role.user_id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role,
            title: profile.title,
            practice_name: practice.name,
            organisation_type: practice.organisation_type,
            practice_role: role.practice_role,
          });
        }
      }

      // Sort: NRES practices first, then Management, then ICB
      const sortOrder = (orgType: string) => {
        if (orgType === 'Practice') return 0;
        if (orgType === 'Management') return 1;
        if (orgType === 'ICB') return 2;
        return 3;
      };

      const groups = Array.from(groupMap.values())
        .sort((a, b) => {
          const orderDiff = sortOrder(a.organisation_type) - sortOrder(b.organisation_type);
          if (orderDiff !== 0) return orderDiff;
          return a.practice_name.localeCompare(b.practice_name);
        });

      // Sort users within each group
      groups.forEach(g => g.users.sort((a, b) => a.full_name.localeCompare(b.full_name)));

      setPracticeGroups(groups);
      setLoaded(true);
    } catch (err) {
      console.error('Failed to fetch Notewell directory:', err);
    } finally {
      setLoading(false);
    }
  };

  return { practiceGroups, loading, loaded, fetchDirectory };
}
