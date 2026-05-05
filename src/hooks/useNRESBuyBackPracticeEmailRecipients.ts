import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BuyBackEmailRecipient {
  id: string;
  practice_key: string;
  contact_name: string;
  email: string;
  receive_invoice: boolean;
  receive_payment_confirmation: boolean;
  receive_approval: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = 'nres_buyback_practice_email_recipients' as const;

export function useNRESBuyBackPracticeEmailRecipients(practiceKey: string | null | undefined) {
  const [recipients, setRecipients] = useState<BuyBackEmailRecipient[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!practiceKey) { setRecipients([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('practice_key', practiceKey)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setRecipients((data || []) as BuyBackEmailRecipient[]);
    } catch (e: any) {
      console.error('[buyback recipients] load failed', e);
      toast.error('Failed to load notification recipients');
    } finally {
      setLoading(false);
    }
  }, [practiceKey]);

  useEffect(() => { load(); }, [load]);

  const addRecipient = useCallback(async (input: {
    contact_name: string;
    email: string;
    receive_invoice?: boolean;
    receive_payment_confirmation?: boolean;
    receive_approval?: boolean;
  }) => {
    if (!practiceKey) return;
    const email = input.email.trim().toLowerCase();
    const name = input.contact_name.trim();
    if (!name || !email) {
      toast.error('Name and email are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Invalid email address');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        practice_key: practiceKey,
        contact_name: name,
        email,
        receive_invoice: input.receive_invoice ?? true,
        receive_payment_confirmation: input.receive_payment_confirmation ?? true,
        receive_approval: input.receive_approval ?? true,
        created_by: user?.id ?? null,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') toast.error('That email is already on the list');
      else toast.error(`Failed to add: ${error.message}`);
      return;
    }
    setRecipients(prev => [...prev, data as BuyBackEmailRecipient]);
    toast.success('Recipient added');
  }, [practiceKey]);

  const updateRecipient = useCallback(async (id: string, patch: Partial<BuyBackEmailRecipient>) => {
    // Optimistic
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
    if (error) {
      toast.error(`Update failed: ${error.message}`);
      load();
    }
  }, [load]);

  const removeRecipient = useCallback(async (id: string) => {
    const prev = recipients;
    setRecipients(p => p.filter(r => r.id !== id));
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      setRecipients(prev);
    } else {
      toast.success('Recipient removed');
    }
  }, [recipients]);

  return { recipients, loading, addRecipient, updateRecipient, removeRecipient, reload: load };
}

/**
 * Helper for email-send call sites: returns the comma-joinable list of
 * extra recipient emails for a given practice + email type.
 *
 * type:
 *   'invoice'   → recipients with receive_invoice = true
 *   'payment'   → recipients with receive_payment_confirmation = true
 *   'approval'  → recipients with receive_approval = true
 */
export async function getBuybackPracticeRecipients(
  practiceKey: string,
  type: 'invoice' | 'payment' | 'approval',
): Promise<string[]> {
  if (!practiceKey) return [];
  const col = type === 'invoice'
    ? 'receive_invoice'
    : type === 'payment'
      ? 'receive_payment_confirmation'
      : 'receive_approval';
  const { data, error } = await supabase
    .from(TABLE)
    .select('email')
    .eq('practice_key', practiceKey)
    .eq('is_active', true)
    .eq(col, true);
  if (error) {
    console.warn('[buyback recipients] fetch failed', error);
    return [];
  }
  return (data || []).map((r: any) => String(r.email).toLowerCase()).filter(Boolean);
}
