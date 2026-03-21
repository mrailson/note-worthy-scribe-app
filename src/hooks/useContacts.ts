import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Contact } from '@/types/contactTypes';
import { showToast } from '@/utils/toastWrapper';

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      setContacts((data as any[]) || []);
    } catch (err: any) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const createContact = async (contact: Omit<Contact, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('contacts' as any)
        .insert({ ...contact, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      setContacts(prev => [...prev, data as any].sort((a, b) => a.name.localeCompare(b.name)));
      showToast.success('Contact added');
      return data as any as Contact;
    } catch (err: any) {
      showToast.error(`Failed to add contact: ${err.message}`);
      return null;
    }
  };

  const updateContact = async (id: number, updates: Partial<Contact>) => {
    try {
      const { error } = await supabase
        .from('contacts' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      showToast.success('Contact updated');
    } catch (err: any) {
      showToast.error(`Failed to update contact: ${err.message}`);
    }
  };

  const deleteContact = async (id: number) => {
    try {
      const { error } = await supabase
        .from('contacts' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      setContacts(prev => prev.filter(c => c.id !== id));
      showToast.success('Contact deleted');
    } catch (err: any) {
      showToast.error(`Failed to delete contact: ${err.message}`);
    }
  };

  const organisations = [...new Set(contacts.map(c => c.org).filter(Boolean))];

  return { contacts, loading, fetchContacts, createContact, updateContact, deleteContact, organisations };
}
