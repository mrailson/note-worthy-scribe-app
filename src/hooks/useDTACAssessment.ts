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
          companyInfo: {
            a1_companyName: 'Notewell Health Technologies Ltd',
            a2_productName: 'Notewell AI Meeting Service and Complaints Manager',
            a3_productType: 'SaaS - AI-powered administrative and compliance management system',
            a4_contactName: '',
            a5_contactEmail: '',
            a6_contactPhone: '',
            a7_companyRegistrationNumber: '',
            a8_registeredAddress: '',
            a9_websiteUrl: '',
            a10_yearsTrading: '',
          },
          valueProposition: {
            b1_targetUsers: 'GP practices, healthcare administrators, clinical staff, practice managers, complaints handlers',
            b2_problemSolved: 'Healthcare professionals spend excessive time on administrative tasks including meeting documentation and complaint handling, reducing time available for patient care. Manual note-taking is error-prone and complaints management lacks structured workflow.',
            b3_benefits: 'Reduces administrative burden by up to 70%, improves accuracy of clinical documentation through AI transcription, ensures compliance with NHS standards, streamlines complaints management with automated workflows and tracking, improves complaint resolution times',
            b4_evidenceBase: 'Built on proven AI transcription technology with healthcare-specific optimisations. Incorporates NHS complaints handling regulations and CQC compliance requirements.',
          },
          clinicalSafety: {
            c1_1_csoName: '',
            c1_1_csoQualifications: '',
            c1_1_csoContact: '',
            c1_2_dcb0129Compliant: false,
            c1_2_dcb0129Evidence: 'Clinical safety management process in development',
            c1_3_mhraRegistered: false,
            c1_3_mhraDetails: 'Not classified as a medical device - administrative and documentation tool',
            c1_4_hazardLog: true,
            c1_4_hazardLogSummary: 'Hazard log maintained with ongoing risk assessment for data accuracy, availability, and confidentiality',
          },
          dataProtection: {
            c2_1_icoRegistered: false,
            c2_1_icoNumber: '',
            c2_2_dpoName: '',
            c2_2_dpoContact: '',
            c2_3_dsptStatus: 'In Progress',
            c2_3_dsptEvidence: 'DSPT submission in progress',
            c2_3_2_dpiaCompleted: true,
            c2_3_2_dpiaDate: new Date().toISOString().split('T')[0],
            c2_3_2_dpiaSummary: 'DPIA completed covering AI transcription processing, storage of meeting data, complaints handling with patient identifiable information',
            c2_4_dataMinimisation: 'System designed with data minimisation principles - only collects necessary data, automatic redaction options available, configurable retention periods',
            c2_5_dataLocation: 'United Kingdom',
            c2_5_dataLocationDetails: 'All data stored in UK-based secure cloud infrastructure (AWS London region). No data transferred outside UK. Data encrypted in transit (TLS 1.3) and at rest (AES-256)',
          },
          technicalSecurity: {
            c3_1_cyberEssentials: false,
            c3_1_cyberEssentialsPlus: false,
            c3_1_certificateNumber: '',
            c3_2_penetrationTesting: false,
            c3_2_testingFrequency: 'Annual penetration testing planned',
            c3_2_lastTestDate: '',
            c3_3_vulnerabilityManagement: 'Regular security assessments and patch management procedures. Automated vulnerability scanning. Security updates applied within 48 hours for critical vulnerabilities',
            c3_4_incidentResponse: 'Documented incident response plan with defined escalation paths. 24/7 security monitoring. Incident response team with defined roles and responsibilities. Regular incident response drills conducted',
          },
          interoperability: {
            c4_1_standardsCompliance: ['HL7 FHIR'],
            c4_1_standardsDetails: 'FHIR API support planned for integration with GP systems. Currently supports standard data formats (PDF, DOCX, CSV)',
            c4_2_apiAvailable: true,
            c4_2_apiDocumentation: 'RESTful API with comprehensive documentation. Supports meeting data export, complaints data access, and workflow integration',
            c4_3_integrationSupport: 'Standard integration support provided. Custom integrations available on request. Technical documentation and developer support available',
          },
          usabilityAccessibility: {
            d1_1_userTesting: true,
            d1_1_userTestingDetails: 'Ongoing user testing with healthcare professionals and administrators. Iterative design process with user feedback incorporation',
            d1_2_accessibilityStandard: 'WCAG 2.1',
            d1_2_wcagLevel: 'AA',
            d1_3_accessibilityTesting: 'Accessibility testing conducted with keyboard navigation, screen reader compatibility, colour contrast verification',
            d1_4_userSupport: '9-5 support Monday-Friday. Email and phone support available. Online knowledge base and video tutorials. Average response time: 4 hours',
            d1_5_trainingProvided: true,
            d1_5_trainingDetails: 'Comprehensive onboarding with live training sessions, video tutorials, user guides, context-sensitive help, and ongoing support',
          },
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
