import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type SystemRole = 'super_admin' | 'management_lead' | 'pml_director' | 'pml_finance';

export interface SystemRoleEntry {
  id: string;
  user_email: string;
  user_name: string;
  role: SystemRole;
  organisation: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function formatRoleLabel(role: SystemRole): string {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'management_lead': return 'Management Lead';
    case 'pml_director': return 'PML Finance Director';
    case 'pml_finance': return 'PML Finance';
    default: return role;
  }
}

export function useNRESSystemRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<SystemRoleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const myRoles = roles.filter(r => r.user_email === user?.email?.toLowerCase() && r.is_active);
  const isSuperAdmin = myRoles.some(r => r.role === 'super_admin');
  const isManagementLead = myRoles.some(r => r.role === 'management_lead');
  const isPMLDirector = myRoles.some(r => r.role === 'pml_director');
  const isPMLFinance = myRoles.some(r => r.role === 'pml_finance');
  const isAnyAdmin = isSuperAdmin || isManagementLead;
  const isAnyPML = isPMLDirector || isPMLFinance;

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nres_system_roles')
        .select('*')
        .order('role')
        .order('user_name');
      if (error) throw error;
      setRoles((data || []) as SystemRoleEntry[]);
    } catch (error) {
      console.error('Error fetching system roles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const addRole = async (email: string, name: string, role: SystemRole, organisation?: string) => {
    try {
      const { data, error } = await supabase
        .from('nres_system_roles')
        .insert({ user_email: email.toLowerCase().trim(), user_name: name.trim(), role, organisation: organisation?.trim() || null })
        .select()
        .single();
      if (error) throw error;
      setRoles(prev => [...prev, data as SystemRoleEntry]);
      toast.success(`Added ${name} as ${formatRoleLabel(role)}`);
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error(`${name} already has the ${formatRoleLabel(role)} role`);
      } else {
        toast.error('Failed to add role');
      }
    }
  };

  const removeRole = async (id: string) => {
    try {
      const entry = roles.find(r => r.id === id);
      const { error } = await supabase.from('nres_system_roles').delete().eq('id', id);
      if (error) throw error;
      setRoles(prev => prev.filter(r => r.id !== id));
      if (entry) toast.success(`Removed ${entry.user_name} from ${formatRoleLabel(entry.role)}`);
    } catch (error) {
      toast.error('Failed to remove role');
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const { data, error } = await supabase
        .from('nres_system_roles')
        .update({ is_active: active })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setRoles(prev => prev.map(r => r.id === id ? (data as SystemRoleEntry) : r));
      toast.success(active ? 'Role activated' : 'Role deactivated');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  return {
    roles, loading,
    isSuperAdmin, isManagementLead, isPMLDirector, isPMLFinance, isAnyAdmin, isAnyPML,
    myRoles,
    addRole, removeRole, toggleActive,
    refetch: fetchRoles,
  };
}
