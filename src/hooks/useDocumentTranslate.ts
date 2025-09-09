import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

export const useDocumentTranslate = () => {
  const [isTranslating, setIsTranslating] = useState(false);

  const translateDocument = async (
    imageData: string,
    targetLanguage: string = 'en'
  ): Promise<TranslationResult | null> => {
    setIsTranslating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('image-ocr-translate', {
        body: {
          imageData,
          targetLanguage,
        },
      });

      if (error) {
        console.error('Document translation error:', error);
        toast.error('Failed to translate document');
        return null;
      }

      return data as TranslationResult;
    } catch (error) {
      console.error('Error translating document:', error);
      toast.error('Failed to translate document');
      return null;
    } finally {
      setIsTranslating(false);
    }
  };

  return {
    translateDocument,
    isTranslating,
  };
};