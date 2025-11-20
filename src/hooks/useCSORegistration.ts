import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CSORegistrationData {
  id: string;
  full_name: string;
  gmc_number: string;
  practice_name: string;
  practice_address: string;
  practice_postcode: string;
  email: string;
  phone: string | null;
  access_token: string;
  created_at: string;
}

export const useCSORegistration = () => {
  const [registration, setRegistration] = useState<CSORegistrationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getStoredToken = (): string | null => {
    return localStorage.getItem('cso_access_token');
  };

  const setStoredToken = (token: string): void => {
    localStorage.setItem('cso_access_token', token);
  };

  const clearStoredToken = (): void => {
    localStorage.removeItem('cso_access_token');
  };

  const fetchRegistration = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('cso_registrations')
        .select('*')
        .eq('access_token', token)
        .single();

      if (error) throw error;

      setRegistration(data);
      return data;
    } catch (error) {
      console.error('Error fetching registration:', error);
      clearStoredToken();
      setRegistration(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      fetchRegistration(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const register = async (data: {
    full_name: string;
    gmc_number: string;
    practice_name: string;
    practice_address: string;
    practice_postcode: string;
    email: string;
    phone?: string;
  }) => {
    try {
      const { data: newRegistration, error } = await supabase
        .from('cso_registrations')
        .insert([data])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          if (error.message.includes('gmc_number')) {
            throw new Error('This GMC number is already registered');
          } else if (error.message.includes('email')) {
            throw new Error('This email address is already registered');
          }
        }
        throw error;
      }

      setRegistration(newRegistration);
      setStoredToken(newRegistration.access_token);
      toast.success('Registration successful!');
      return newRegistration;
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed');
      throw error;
    }
  };

  const logout = () => {
    clearStoredToken();
    setRegistration(null);
    toast.info('Logged out successfully');
  };

  return {
    registration,
    isLoading,
    register,
    logout,
    getStoredToken,
    setStoredToken,
    fetchRegistration
  };
};
