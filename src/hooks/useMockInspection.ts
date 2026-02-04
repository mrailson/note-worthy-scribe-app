import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type InspectionType = 'short' | 'mid' | 'long';

export interface InspectionSession {
  id: string;
  practice_id: string;
  user_id: string;
  status: 'draft' | 'in_progress' | 'completed';
  inspection_type: InspectionType;
  started_at: string | null;
  completed_at: string | null;
  report_generated_at: string | null;
  created_at: string;
}

export interface InspectionElement {
  id: string;
  session_id: string;
  domain: 'safe' | 'effective' | 'caring' | 'responsive' | 'well_led';
  element_key: string;
  element_name: string;
  evidence_guidance: string;
  status: 'not_assessed' | 'met' | 'partially_met' | 'not_met' | 'not_applicable';
  evidence_notes: string | null;
  improvement_comments: string | null;
  evidence_files: unknown;
  assessed_at: string | null;
}

export interface ElementTemplate {
  id: string;
  domain: string;
  element_key: string;
  element_name: string;
  evidence_guidance: string;
  priority: number;
  is_priority_domain: boolean;
}

export const useMockInspection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSession, setActiveSession] = useState<InspectionSession | null>(null);
  const [sessionElements, setSessionElements] = useState<InspectionElement[]>([]);
  const [templates, setTemplates] = useState<ElementTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('mock_inspection_element_templates')
      .select('*')
      .order('is_priority_domain', { ascending: false })
      .order('priority');

    if (!error && data) {
      setTemplates(data);
    }
  };

  const createSession = async (practiceId: string, inspectionType: InspectionType = 'long'): Promise<InspectionSession | null> => {
    if (!user) return null;
    
    setIsLoading(true);
    try {
      // Create the session with inspection type
      const { data: session, error: sessionError } = await supabase
        .from('mock_inspection_sessions')
        .insert({
          practice_id: practiceId,
          user_id: user.id,
          status: 'in_progress',
          inspection_type: inspectionType,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create elements from templates
      const elementsToInsert = templates.map(template => ({
        session_id: session.id,
        domain: template.domain,
        element_key: template.element_key,
        element_name: template.element_name,
        evidence_guidance: template.evidence_guidance,
        status: 'not_assessed',
        evidence_files: []
      }));

      const { data: elements, error: elementsError } = await supabase
        .from('mock_inspection_elements')
        .insert(elementsToInsert)
        .select();

      if (elementsError) throw elementsError;

      setActiveSession(session as InspectionSession);
      setSessionElements((elements || []) as InspectionElement[]);
      
      return session as InspectionSession;
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: "Failed to create inspection session",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeInspectionType = async (newType: InspectionType): Promise<boolean> => {
    if (!activeSession) return false;

    // Can only upgrade, not downgrade
    const typeOrder: InspectionType[] = ['short', 'mid', 'long'];
    const currentIndex = typeOrder.indexOf(activeSession.inspection_type);
    const newIndex = typeOrder.indexOf(newType);

    if (newIndex <= currentIndex) {
      toast({
        title: "Cannot downgrade inspection type",
        description: "You can only upgrade to a more comprehensive inspection.",
        variant: "destructive"
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('mock_inspection_sessions')
        .update({ inspection_type: newType })
        .eq('id', activeSession.id);

      if (error) throw error;

      setActiveSession(prev => prev ? { ...prev, inspection_type: newType } : null);
      
      toast({
        title: "Inspection upgraded",
        description: `Upgraded to ${newType === 'mid' ? 'Standard' : 'Full'} inspection. Additional items are now visible.`
      });

      return true;
    } catch (error) {
      console.error('Error upgrading inspection:', error);
      toast({
        title: "Failed to upgrade inspection",
        variant: "destructive"
      });
      return false;
    }
  };

  const loadSession = async (sessionId: string | null) => {
    if (!sessionId) {
      setActiveSession(null);
      setSessionElements([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('mock_inspection_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      const { data: elements, error: elementsError } = await supabase
        .from('mock_inspection_elements')
        .select('*')
        .eq('session_id', sessionId)
        .order('domain')
        .order('element_key');

      if (elementsError) throw elementsError;

      setActiveSession(session as InspectionSession);
      setSessionElements((elements || []) as InspectionElement[]);
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateElement = async (
    elementId: string, 
    updates: Partial<Pick<InspectionElement, 'status' | 'evidence_notes' | 'improvement_comments' | 'evidence_files'>>
  ) => {
    try {
      const dbUpdates: Record<string, unknown> = { ...updates };
      if (updates.status && updates.status !== 'not_assessed') {
        dbUpdates.assessed_at = new Date().toISOString();
      } else if (updates.status === 'not_assessed') {
        dbUpdates.assessed_at = null;
      }
      
      const { error } = await supabase
        .from('mock_inspection_elements')
        .update(dbUpdates)
        .eq('id', elementId);

      if (error) throw error;

      // Update local state
      setSessionElements(prev => 
        prev.map(el => el.id === elementId ? { ...el, ...updates } : el)
      );

      return true;
    } catch (error) {
      console.error('Error updating element:', error);
      toast({
        title: "Failed to save changes",
        variant: "destructive"
      });
      return false;
    }
  };

  const completeInspection = async () => {
    if (!activeSession) return false;

    try {
      const { error } = await supabase
        .from('mock_inspection_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', activeSession.id);

      if (error) throw error;

      setActiveSession(prev => prev ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : null);
      return true;
    } catch (error) {
      console.error('Error completing inspection:', error);
      toast({
        title: "Failed to complete inspection",
        variant: "destructive"
      });
      return false;
    }
  };

  // Calculate progress stats
  const getProgress = () => {
    const total = sessionElements.length;
    const assessed = sessionElements.filter(e => e.status !== 'not_assessed').length;
    const met = sessionElements.filter(e => e.status === 'met').length;
    const partiallyMet = sessionElements.filter(e => e.status === 'partially_met').length;
    const notMet = sessionElements.filter(e => e.status === 'not_met').length;
    const notApplicable = sessionElements.filter(e => e.status === 'not_applicable').length;

    return {
      total,
      assessed,
      met,
      partiallyMet,
      notMet,
      notApplicable,
      percentComplete: total > 0 ? Math.round((assessed / total) * 100) : 0
    };
  };

  // Get elements by domain
  const getElementsByDomain = (domain: string) => {
    return sessionElements
      .filter(e => e.domain === domain)
      .sort((a, b) => a.element_key.localeCompare(b.element_key));
  };

  return {
    activeSession,
    sessionElements,
    templates,
    isLoading,
    createSession,
    loadSession,
    updateElement,
    completeInspection,
    upgradeInspectionType,
    getProgress,
    getElementsByDomain
  };
};
