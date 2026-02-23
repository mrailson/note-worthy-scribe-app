import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RoomRow {
  session: string;
  theParks: number;
  springfield: number;
  brackley: number;
  brook: number;
  bugbrooke: number;
  denton: number;
  towcester: number;
}

export interface EstatesConfig {
  roomData: RoomRow[];
  f2fSplitPct: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

const DEFAULT_ROOM_DATA: RoomRow[] = [
  { session: "Monday AM", theParks: 1, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 1 },
  { session: "Monday PM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 3 },
  { session: "Tuesday AM", theParks: 5, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 0 },
  { session: "Tuesday PM", theParks: 6, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 2 },
  { session: "Wednesday AM", theParks: 0, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 1 },
  { session: "Wednesday PM", theParks: 0, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 4 },
  { session: "Thursday AM", theParks: 4, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 0 },
  { session: "Thursday PM", theParks: 4, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 1, towcester: 0 },
  { session: "Friday AM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 2 },
  { session: "Friday PM", theParks: 3, springfield: 1, brackley: 2, brook: 1, bugbrooke: 1, denton: 0, towcester: 4 },
];

const DEFAULT_F2F_SPLIT = 50;

export const PRACTICE_KEYS = ['theParks', 'brackley', 'springfield', 'towcester', 'bugbrooke', 'brook', 'denton'] as const;
export type PracticeKey = typeof PRACTICE_KEYS[number];

export function useEstatesConfig() {
  const { user } = useAuth();
  const [roomData, setRoomData] = useState<RoomRow[]>(DEFAULT_ROOM_DATA);
  const [f2fSplitPct, setF2fSplitPct] = useState(DEFAULT_F2F_SPLIT);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('nres_estates_config' as any)
        .select('*')
        .eq('id', 'default')
        .single();

      if (error) {
        console.error('Error fetching estates config:', error);
        return;
      }

      if (data) {
        const row = data as any;
        if (row.room_data && Array.isArray(row.room_data)) {
          setRoomData(row.room_data as RoomRow[]);
        }
        if (typeof row.f2f_split_pct === 'number') {
          setF2fSplitPct(row.f2f_split_pct);
        }
        setUpdatedAt(row.updated_at);
        setUpdatedBy(row.updated_by);
      }
    } catch (err) {
      console.error('Error fetching estates config:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(async (newRoomData: RoomRow[], newF2fSplitPct: number) => {
    if (!user) {
      toast.error('You must be logged in to update configuration.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('nres_estates_config' as any)
        .upsert({
          id: 'default',
          room_data: newRoomData,
          f2f_split_pct: newF2fSplitPct,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        } as any);

      if (error) {
        console.error('Error updating estates config:', error);
        toast.error('Failed to save changes. You may not have admin permissions.');
        return false;
      }

      setRoomData(newRoomData);
      setF2fSplitPct(newF2fSplitPct);
      setUpdatedAt(new Date().toISOString());
      setUpdatedBy(user.id);
      toast.success('Estates configuration saved successfully.');
      return true;
    } catch (err) {
      console.error('Error updating estates config:', err);
      toast.error('Failed to save changes.');
      return false;
    }
  }, [user]);

  return {
    roomData,
    f2fSplitPct,
    updatedAt,
    updatedBy,
    isLoading,
    updateConfig,
    DEFAULT_ROOM_DATA,
    DEFAULT_F2F_SPLIT,
  };
}
