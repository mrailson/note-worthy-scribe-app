import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useTurkishTranslation = () => {
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();

  const translate = async (text: string, sourceLanguage: string, targetLanguage: string) => {
    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text-simple', {
        body: { 
          text, 
          sourceLanguage: sourceLanguage === 'en' ? 'en' : 'tr',
          targetLanguage: targetLanguage === 'en' ? 'en' : 'tr'
        }
      });

      if (error) throw error;

      const translated = data.translatedText || '';
      setTranslation(translated);
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: 'Translation failed',
        description: 'Please try again',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsTranslating(false);
    }
  };

  return {
    translation,
    isTranslating,
    translate
  };
};
