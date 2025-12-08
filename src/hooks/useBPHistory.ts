import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BPReading, BPAverages, NHSCategory } from './useBPCalculator';

export interface BPSession {
  id: string;
  created_at: string;
  mode: 'standard' | 'sit-stand';
  readings_count: number;
  included_count: number;
  excluded_count: number;
  avg_systolic: number | null;
  avg_diastolic: number | null;
  avg_pulse: number | null;
  systolic_min: number | null;
  systolic_max: number | null;
  diastolic_min: number | null;
  diastolic_max: number | null;
  nice_systolic: number | null;
  nice_diastolic: number | null;
  nice_category: string | null;
  nhs_category: string | null;
  sit_stand_averages: any | null;
  readings: BPReading[];
  trends: any | null;
  data_quality: any | null;
  date_range: any | null;
  qof_relevance: any | null;
  source_text: string | null;
  source_files_count: number;
}

export const useBPHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<BPSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bp_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const mappedSessions: BPSession[] = (data || []).map(s => ({
        id: s.id,
        created_at: s.created_at,
        mode: (s.mode as 'standard' | 'sit-stand') || 'standard',
        readings_count: s.readings_count || 0,
        included_count: s.included_count || 0,
        excluded_count: s.excluded_count || 0,
        avg_systolic: s.avg_systolic,
        avg_diastolic: s.avg_diastolic,
        avg_pulse: s.avg_pulse,
        systolic_min: s.systolic_min,
        systolic_max: s.systolic_max,
        diastolic_min: s.diastolic_min,
        diastolic_max: s.diastolic_max,
        nice_systolic: s.nice_systolic,
        nice_diastolic: s.nice_diastolic,
        nice_category: s.nice_category,
        nhs_category: s.nhs_category,
        sit_stand_averages: s.sit_stand_averages,
        readings: (Array.isArray(s.readings) ? s.readings : []) as unknown as BPReading[],
        trends: s.trends,
        data_quality: s.data_quality,
        date_range: s.date_range,
        qof_relevance: s.qof_relevance,
        source_text: s.source_text,
        source_files_count: s.source_files_count || 0
      }));
      
      setSessions(mappedSessions);
    } catch (error) {
      console.error('Error fetching BP sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const saveSession = async (sessionData: {
    mode: 'standard' | 'sit-stand';
    readings: BPReading[];
    averages: BPAverages | null;
    niceAverage: { systolic: number; diastolic: number } | null;
    niceCategory: NHSCategory | null;
    nhsCategory: NHSCategory | null;
    sitStandAverages: any | null;
    trends: any | null;
    dataQuality: any | null;
    dateRange: any | null;
    qofRelevance: any | null;
    sourceText: string;
    sourceFilesCount: number;
  }) => {
    if (!user) {
      return null;
    }

    const includedCount = sessionData.readings.filter(r => r.included).length;
    const excludedCount = sessionData.readings.filter(r => !r.included).length;

    try {
      const insertData = {
        user_id: user.id,
        mode: sessionData.mode,
        readings_count: sessionData.readings.length,
        included_count: includedCount,
        excluded_count: excludedCount,
        avg_systolic: sessionData.averages?.systolic || null,
        avg_diastolic: sessionData.averages?.diastolic || null,
        avg_pulse: sessionData.averages?.pulse || null,
        systolic_min: sessionData.averages?.systolicMin || null,
        systolic_max: sessionData.averages?.systolicMax || null,
        diastolic_min: sessionData.averages?.diastolicMin || null,
        diastolic_max: sessionData.averages?.diastolicMax || null,
        nice_systolic: sessionData.niceAverage?.systolic || null,
        nice_diastolic: sessionData.niceAverage?.diastolic || null,
        nice_category: sessionData.niceCategory?.label || null,
        nhs_category: sessionData.nhsCategory?.label || null,
        sit_stand_averages: sessionData.mode === 'sit-stand' ? sessionData.sitStandAverages : null,
        readings: sessionData.readings as unknown as Record<string, unknown>[],
        trends: sessionData.trends,
        data_quality: sessionData.dataQuality,
        date_range: sessionData.dateRange,
        qof_relevance: sessionData.qofRelevance,
        source_text: sessionData.sourceText?.substring(0, 1000) || null,
        source_files_count: sessionData.sourceFilesCount
      };

      const { data, error } = await supabase
        .from('bp_sessions')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;

      await fetchSessions();
      return data;
    } catch (error) {
      console.error('Error saving BP session:', error);
      return null;
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('bp_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Error deleting BP session:', error);
    }
  };

  return {
    sessions,
    isLoading,
    saveSession,
    deleteSession,
    refreshSessions: fetchSessions
  };
};
