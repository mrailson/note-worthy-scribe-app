import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReferralDestination } from '@/types/referral';
import { useAuth } from '@/contexts/AuthContext';

export const useReferralDestinations = () => {
  const { user } = useAuth();
  const [destinations, setDestinations] = useState<ReferralDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDestinations = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('referral_destinations')
        .select('*')
        .eq('is_active', true)
        .order('hospital_name', { ascending: true });

      if (error) throw error;
      setDestinations(data || []);
    } catch (error) {
      console.error('Error fetching referral destinations:', error);
      toast.error('Failed to load referral destinations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, [user]);

  const addDestination = async (destination: Omit<ReferralDestination, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => {
    if (!user) return null;

    try {
      // Get user's practice_id from practice_details
      const { data: practiceData } = await supabase
        .from('practice_details')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const { data, error } = await supabase
        .from('referral_destinations')
        .insert({
          hospital_name: destination.hospital_name,
          department: destination.department,
          contact_name: destination.contact_name || null,
          email: destination.email || null,
          phone: destination.phone || null,
          fax: destination.fax || null,
          address: destination.address || null,
          notes: destination.notes || null,
          specialty_keywords: destination.specialty_keywords || null,
          practice_id: practiceData?.id || null,
          created_by: user.id,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      
      setDestinations(prev => [...prev, data]);
      toast.success('Referral destination added');
      return data;
    } catch (error) {
      console.error('Error adding referral destination:', error);
      toast.error('Failed to add referral destination');
      return null;
    }
  };

  const updateDestination = async (id: string, updates: Partial<ReferralDestination>) => {
    try {
      const { data, error } = await supabase
        .from('referral_destinations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setDestinations(prev => prev.map(d => d.id === id ? data : d));
      toast.success('Referral destination updated');
      return data;
    } catch (error) {
      console.error('Error updating referral destination:', error);
      toast.error('Failed to update referral destination');
      return null;
    }
  };

  const deleteDestination = async (id: string) => {
    try {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('referral_destinations')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      setDestinations(prev => prev.filter(d => d.id !== id));
      toast.success('Referral destination removed');
      return true;
    } catch (error) {
      console.error('Error deleting referral destination:', error);
      toast.error('Failed to remove referral destination');
      return false;
    }
  };

  const findMatchingDestinations = (specialty: string): ReferralDestination[] => {
    if (!specialty) return [];
    
    const searchTerm = specialty.toLowerCase();
    return destinations.filter(dest => {
      // Check department name
      if (dest.department.toLowerCase().includes(searchTerm)) return true;
      
      // Check specialty keywords
      if (dest.specialty_keywords?.some(kw => kw.toLowerCase().includes(searchTerm))) return true;
      
      // Check hospital name
      if (dest.hospital_name.toLowerCase().includes(searchTerm)) return true;
      
      return false;
    });
  };

  return {
    destinations,
    isLoading,
    addDestination,
    updateDestination,
    deleteDestination,
    findMatchingDestinations,
    refetch: fetchDestinations
  };
};
