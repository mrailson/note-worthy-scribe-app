import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { DTACAssessment } from '@/types/dtac';

export const useDTACAssessment = () => {
  const [assessment, setAssessment] = useState<Partial<DTACAssessment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const { toast } = useToast();

  // Load existing assessment or create new one
  useEffect(() => {
    loadAssessment();
  }, []);

  const loadAssessment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to load existing draft assessment
      const { data, error } = await supabase
        .from('dtac_assessments')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading assessment:', error);
        return;
      }

      if (data) {
        // Load existing assessment
        setAssessmentId(data.id);
        setAssessment({
          id: data.id,
          status: data.status as 'draft' | 'in_review' | 'submitted' | 'approved',
          version: data.version || '1.0',
          created_at: data.created_at,
          updated_at: data.updated_at,
          companyInfo: data.company_info as any,
          valueProposition: data.value_proposition as any,
          clinicalSafety: data.clinical_safety as any,
          dataProtection: data.data_protection as any,
          technicalSecurity: data.technical_security as any,
          interoperability: data.interoperability as any,
          usabilityAccessibility: data.usability_accessibility as any,
        });
      } else {
        // Create new assessment
        const { data: newAssessment, error: createError } = await supabase
          .from('dtac_assessments')
          .insert({
            user_id: user.id,
            status: 'draft',
            version: '1.0',
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating assessment:', createError);
          toast({
            title: "Error",
            description: "Failed to create new assessment",
            variant: "destructive",
          });
          return;
        }

        setAssessmentId(newAssessment.id);
        setAssessment({
          id: newAssessment.id,
          status: 'draft',
          version: '1.0',
          created_at: newAssessment.created_at,
          updated_at: newAssessment.updated_at,
          companyInfo: {} as any,
          valueProposition: {} as any,
          clinicalSafety: {} as any,
          dataProtection: {} as any,
          technicalSecurity: {} as any,
          interoperability: {} as any,
          usabilityAccessibility: {} as any,
        });
      }
    } catch (error) {
      console.error('Error in loadAssessment:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAssessment = useCallback(async (updatedAssessment: Partial<DTACAssessment>) => {
    if (!assessmentId) return;

    try {
      const { error } = await supabase
        .from('dtac_assessments')
        .update({
          company_info: updatedAssessment.companyInfo || {},
          value_proposition: updatedAssessment.valueProposition || {},
          clinical_safety: updatedAssessment.clinicalSafety || {},
          data_protection: updatedAssessment.dataProtection || {},
          technical_security: updatedAssessment.technicalSecurity || {},
          interoperability: updatedAssessment.interoperability || {},
          usability_accessibility: updatedAssessment.usabilityAccessibility || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId);

      if (error) {
        console.error('Error saving assessment:', error);
        toast({
          title: "Error",
          description: "Failed to save changes",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error in saveAssessment:', error);
    }
  }, [assessmentId, toast]);

  // Debounced auto-save
  useEffect(() => {
    if (!assessment || !assessmentId) return;

    const timeoutId = setTimeout(() => {
      saveAssessment(assessment);
    }, 1000); // Save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [assessment, assessmentId, saveAssessment]);

  return {
    assessment,
    setAssessment,
    loading,
    saveAssessment,
  };
};
