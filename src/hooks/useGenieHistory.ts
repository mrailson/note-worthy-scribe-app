import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export type ServiceType = 'gp-genie' | 'pm-genie' | 'patient-line';

export interface GenieMessage {
  user: string;
  agent: string;
  timestamp: string;
  userTimestamp?: string;
  agentTimestamp?: string;
}

export interface GenieSession {
  id: string;
  user_id: string;
  service_type: ServiceType;
  title: string;
  brief_overview: string;
  messages: GenieMessage[];
  start_time: string;
  end_time: string;
  duration_seconds: number;
  message_count: number;
  email_sent: boolean;
  created_at: string;
  updated_at: string;
}

export const useGenieHistory = () => {
  const [sessions, setSessions] = useState<GenieSession[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async (serviceType: ServiceType, searchQuery?: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Silently return if user is not authenticated
        setSessions([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('genie_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('service_type', serviceType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let filteredData = data || [];

      // Client-side search filtering
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredData = filteredData.filter(session => {
          const messages = session.messages as unknown as GenieMessage[];
          return session.title?.toLowerCase().includes(query) ||
            session.brief_overview?.toLowerCase().includes(query) ||
            messages?.some((msg: GenieMessage) => 
              msg.user?.toLowerCase().includes(query) || 
              msg.agent?.toLowerCase().includes(query)
            );
        });
      }

      setSessions(filteredData as unknown as GenieSession[]);
    } catch (error) {
      console.error('Load sessions error:', error);
      toast.error('Failed to load conversation history');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSession = useCallback(async (
    serviceType: ServiceType,
    messages: GenieMessage[],
    startTime: Date,
    endTime: Date,
    emailSent: boolean = false
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('User not authenticated, skipping session save');
        return null;
      }

      if (!messages || messages.length === 0) {
        console.warn('No messages to save');
        return null;
      }

      // Generate title: Service name + timestamp
      const serviceNames = {
        'gp-genie': 'GP Genie',
        'pm-genie': 'PM Genie',
        'patient-line': 'Oak Lane Patient Line'
      };
      const title = `${serviceNames[serviceType]} — ${format(startTime, 'HH:mm')} on ${format(startTime, 'dd/MM/yyyy')}`;

      // Generate brief overview from first question and last answer
      let briefOverview = '';
      if (messages.length > 0) {
        const firstUserMsg = messages[0]?.user || '';
        const lastAgentMsg = messages[messages.length - 1]?.agent || '';
        
        // Take first sentence of each
        const firstQuestion = firstUserMsg.split('.')[0] || firstUserMsg.substring(0, 100);
        const lastAnswer = lastAgentMsg.split('.')[0] || lastAgentMsg.substring(0, 100);
        
        briefOverview = `${firstQuestion}... ${lastAnswer}`;
        if (briefOverview.length > 250) {
          briefOverview = briefOverview.substring(0, 247) + '...';
        }
      }

      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      const sessionData = {
        user_id: user.id,
        service_type: serviceType,
        title,
        brief_overview: briefOverview,
        messages: messages as any,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_seconds: durationSeconds,
        message_count: messages.length,
        email_sent: emailSent
      };

      const { data, error } = await supabase
        .from('genie_sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Session saved successfully:', data.id);
      return data;
    } catch (error) {
      console.error('Save session error:', error);
      toast.error('Failed to save conversation history');
      return null;
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('genie_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Conversation deleted');
      return true;
    } catch (error) {
      console.error('Delete session error:', error);
      toast.error('Failed to delete conversation');
      return false;
    }
  }, []);

  return {
    sessions,
    loading,
    loadSessions,
    saveSession,
    deleteSession
  };
};
