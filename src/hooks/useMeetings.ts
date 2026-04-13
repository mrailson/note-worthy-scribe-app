import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Meeting {
  id: string;
  neighbourhood: string;
  practice_key: string;
  meeting_type: string;
  title: string | null;
  meeting_date: string;
  start_time: string | null;
  duration_hours: number;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_by: string;
  created_at: string;
}

export interface MeetingAttendance {
  id: string;
  meeting_id: string;
  staff_id: string;
  attended: boolean;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

export function useMeetings(neighbourhoodName: string, practiceKey: string | null, month: string) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<MeetingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    if (!user?.id) return;
    if (!force && hasFetchedRef.current) return;

    try {
      setLoading(true);

      // Parse month to get date range
      const monthStart = `${month}-01`;
      const startDate = new Date(monthStart);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      const monthEnd = endDate.toISOString().split('T')[0];

      let meetingsQuery = (supabase as any)
        .from('neighbourhood_meetings')
        .select('*')
        .eq('neighbourhood', neighbourhoodName)
        .gte('meeting_date', monthStart)
        .lte('meeting_date', monthEnd)
        .order('meeting_date', { ascending: true });

      if (practiceKey && practiceKey !== 'all') {
        meetingsQuery = meetingsQuery.eq('practice_key', practiceKey);
      }

      const { data: meetingsData, error: meetingsError } = await meetingsQuery;
      if (meetingsError) throw meetingsError;

      const mtgs = (meetingsData || []) as Meeting[];
      setMeetings(mtgs);

      // Fetch attendance for these meetings
      if (mtgs.length > 0) {
        const meetingIds = mtgs.map(m => m.id);
        const { data: attData, error: attError } = await (supabase as any)
          .from('meeting_attendance')
          .select('*')
          .in('meeting_id', meetingIds);
        if (attError) throw attError;
        setAttendance((attData || []) as MeetingAttendance[]);
      } else {
        setAttendance([]);
      }

      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Error fetching meetings:', err);
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [user?.id, neighbourhoodName, practiceKey, month]);

  useEffect(() => {
    hasFetchedRef.current = false;
    if (user?.id) fetchData();
  }, [user?.id, neighbourhoodName, practiceKey, month, fetchData]);

  const addMeeting = useCallback(async (meeting: {
    practice_key: string;
    meeting_type: string;
    title?: string;
    meeting_date: string;
    start_time?: string;
    duration_hours: number;
    is_recurring?: boolean;
    recurrence_rule?: string;
  }) => {
    if (!user?.id) return null;
    try {
      const { data, error } = await (supabase as any)
        .from('neighbourhood_meetings')
        .insert({
          ...meeting,
          neighbourhood: neighbourhoodName,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      setMeetings(prev => [...prev, data as Meeting].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)));
      toast.success('Meeting added');
      return data;
    } catch (err) {
      console.error('Error adding meeting:', err);
      toast.error('Failed to add meeting');
      return null;
    }
  }, [user?.id, neighbourhoodName]);

  const toggleAttendance = useCallback(async (meetingId: string, staffId: string) => {
    if (!user?.id) return;
    try {
      const existing = attendance.find(a => a.meeting_id === meetingId && a.staff_id === staffId);
      if (existing) {
        const newAttended = !existing.attended;
        const { error } = await (supabase as any)
          .from('meeting_attendance')
          .update({ attended: newAttended, recorded_by: user.id, recorded_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, attended: newAttended } : a));
      } else {
        const { data, error } = await (supabase as any)
          .from('meeting_attendance')
          .insert({ meeting_id: meetingId, staff_id: staffId, attended: true, recorded_by: user.id })
          .select()
          .single();
        if (error) throw error;
        setAttendance(prev => [...prev, data as MeetingAttendance]);
      }
    } catch (err) {
      console.error('Error toggling attendance:', err);
      toast.error('Failed to update attendance');
    }
  }, [user?.id, attendance]);

  const markAllPresent = useCallback(async (meetingId: string, staffIds: string[]) => {
    if (!user?.id) return;
    try {
      for (const staffId of staffIds) {
        const existing = attendance.find(a => a.meeting_id === meetingId && a.staff_id === staffId);
        if (existing) {
          if (!existing.attended) {
            await (supabase as any)
              .from('meeting_attendance')
              .update({ attended: true, recorded_by: user.id, recorded_at: new Date().toISOString() })
              .eq('id', existing.id);
          }
        } else {
          await (supabase as any)
            .from('meeting_attendance')
            .insert({ meeting_id: meetingId, staff_id: staffId, attended: true, recorded_by: user.id });
        }
      }
      // Refetch to get consistent state
      await fetchData(true);
      toast.success('All marked as present');
    } catch (err) {
      console.error('Error marking all present:', err);
      toast.error('Failed to mark all present');
    }
  }, [user?.id, attendance, fetchData]);

  const deleteMeeting = useCallback(async (meetingId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await (supabase as any)
        .from('neighbourhood_meetings')
        .delete()
        .eq('id', meetingId);
      if (error) throw error;
      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      setAttendance(prev => prev.filter(a => a.meeting_id !== meetingId));
      toast.success('Meeting deleted');
    } catch (err) {
      console.error('Error deleting meeting:', err);
      toast.error('Failed to delete meeting');
    }
  }, [user?.id]);

  return { meetings, attendance, loading, addMeeting, toggleAttendance, markAllPresent, deleteMeeting, refetch: () => fetchData(true) };
}
