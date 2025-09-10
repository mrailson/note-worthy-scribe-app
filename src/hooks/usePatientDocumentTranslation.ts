import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TranslationContent {
  title: string;
  subtitle: string;
  sessionInfo: string;
  patientInfo: string;
  translationLogHeader: string;
  speakerLabels: {
    gp: string;
    patient: string;
  };
}

interface PracticeInfo {
  name: string;
  address: string;
  phone?: string;
}

interface TranslatedContent {
  title: string;
  subtitle: string;
  sessionInfo: string;
  patientInfo: string;
  translationLogHeader: string;
  speakerLabels: {
    gp: string;
    patient: string;
  };
  practiceInfo: {
    name: string;
    address: string;
    phone: string;
  };
  generalLabels: {
    reportGenerated: string;
    sessionDate: string;
    sessionStart: string;
    sessionEnd: string;
    duration: string;
    patientLanguage: string;
    totalTranslations: string;
    time: string;
    speaker: string;
    originalText: string;
    translation: string;
  };
}

export const usePatientDocumentTranslation = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const translatePatientDocument = async (
    targetLanguage: string,
    practiceInfo: PracticeInfo
  ): Promise<TranslatedContent | null> => {
    if (!targetLanguage || targetLanguage === 'en' || targetLanguage === 'English') {
      // Return English content if no translation needed
      return {
        title: "NHS Translation Service - Patient Copy",
        subtitle: "Summary of Translation Session for Your Records",
        sessionInfo: "Session Information",
        patientInfo: "Patient Information", 
        translationLogHeader: "Translation Record",
        speakerLabels: {
          gp: "GP",
          patient: "Patient"
        },
        practiceInfo: {
          name: practiceInfo.name,
          address: practiceInfo.address,
          phone: practiceInfo.phone || ''
        },
        generalLabels: {
          reportGenerated: "Report Generated",
          sessionDate: "Session Date",
          sessionStart: "Session Start",
          sessionEnd: "Session End", 
          duration: "Duration",
          patientLanguage: "Patient Language",
          totalTranslations: "Total Translations",
          time: "Time",
          speaker: "Speaker",
          originalText: "Original Text",
          translation: "Translation"
        }
      };
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const content: TranslationContent = {
        title: "NHS Translation Service - Patient Copy",
        subtitle: "Summary of Translation Session for Your Records",
        sessionInfo: "Session Information",
        patientInfo: "Patient Information",
        translationLogHeader: "Translation Record",
        speakerLabels: {
          gp: "GP", 
          patient: "Patient"
        }
      };

      const { data, error } = await supabase.functions.invoke('translate-patient-document', {
        body: {
          content,
          targetLanguage,
          practiceInfo
        }
      });

      if (error) {
        console.error('Translation error:', error);
        throw new Error(error.message || 'Failed to translate document');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Translation failed');
      }

      return data.translatedContent;
    } catch (error) {
      console.error('Error translating patient document:', error);
      setTranslationError(error instanceof Error ? error.message : 'Translation failed');
      return null;
    } finally {
      setIsTranslating(false);
    }
  };

  return {
    translatePatientDocument,
    isTranslating,
    translationError
  };
};