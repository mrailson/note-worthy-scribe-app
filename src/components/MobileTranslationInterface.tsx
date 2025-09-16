import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Volume2, ChevronDown, Languages } from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Translation {
  englishText: string;
  translatedText: string;
  targetLanguage: string;
}

const COMMON_PHRASES = [
  "Good morning. How can I help you today?",
  "What is your name?",
  "What is your date of birth?", 
  "Do you have your NHS number?",
  "Please take a seat and wait to be called",
  "The doctor will see you shortly",
  "Do you need an interpreter?",
  "Is this your first visit here?",
  "Have you registered with us before?",
  "Please fill out this form"
];

export const MobileTranslationInterface = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('fr');
  const [currentPhrase, setCurrentPhrase] = useState(COMMON_PHRASES[0]);
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const selectedLang = HEALTHCARE_LANGUAGES.find(lang => lang.code === selectedLanguage);

  const translateText = async (text: string, targetLang: string) => {
    if (!text.trim()) return;

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text-simple', {
        body: {
          text: text,
          toLang: targetLang,
          fromLang: 'en'
        }
      });

      if (error) {
        console.error('Translation error:', error);
        toast.error('Translation failed');
        return;
      }

      setTranslation({
        englishText: text,
        translatedText: data.translatedText,
        targetLanguage: targetLang
      });

    } catch (error) {
      console.error('Error translating:', error);
      toast.error('Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePhraseSelect = (phrase: string) => {
    setCurrentPhrase(phrase);
    if (selectedLanguage !== 'none') {
      translateText(phrase, selectedLanguage);
    }
  };

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    if (langCode !== 'none' && currentPhrase) {
      translateText(currentPhrase, langCode);
    }
  };

  const playTranslation = async () => {
    if (!translation?.translatedText || !selectedLang?.voice) return;

    setIsPlaying(true);
    try {
      const utterance = new SpeechSynthesisUtterance(translation.translatedText);
      utterance.lang = selectedLanguage;
      utterance.rate = 0.8;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Speech error:', error);
      setIsPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* Header */}
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Languages className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Quick Translate</h1>
          </div>
          <p className="text-sm text-muted-foreground">For staff use with patients</p>
        </div>

        {/* Language Selector */}
        <Card className="p-4 bg-white/80 backdrop-blur-sm">
          <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full h-12 text-base">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedLang?.flag || '🌐'}</span>
                <SelectValue placeholder="Select language" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {HEALTHCARE_LANGUAGES.filter(lang => lang.code !== 'none').map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{language.flag}</span>
                    <span>{language.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* English (GP) Section */}
        <Card className="overflow-hidden">
          <div className="bg-blue-600 text-white p-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🇬🇧</span>
              <span className="font-medium">English (Staff)</span>
            </div>
          </div>
          <div className="p-4 bg-white">
            <Textarea
              value={currentPhrase}
              onChange={(e) => setCurrentPhrase(e.target.value)}
              placeholder="Type your message here..."
              className="min-h-[80px] text-base resize-none border-0 p-0 focus:ring-0"
              onBlur={() => {
                if (selectedLanguage !== 'none' && currentPhrase) {
                  translateText(currentPhrase, selectedLanguage);
                }
              }}
            />
          </div>
        </Card>

        {/* Translated (Patient) Section */}
        {selectedLanguage !== 'none' && (
          <Card className="overflow-hidden">
            <div className="bg-teal-600 text-white p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedLang?.flag}</span>
                  <span className="font-medium">{selectedLang?.name} (Patient)</span>
                </div>
                {translation?.translatedText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={playTranslation}
                    disabled={isPlaying}
                    className="text-white hover:bg-white/20"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="p-4 bg-white min-h-[80px] flex items-center">
              {isTranslating ? (
                <div className="text-muted-foreground">Translating...</div>
              ) : translation?.translatedText ? (
                <p className="text-base leading-relaxed">{translation.translatedText}</p>
              ) : (
                <p className="text-muted-foreground">Translation will appear here</p>
              )}
            </div>
          </Card>
        )}

        {/* Common Phrases */}
        <Card className="p-4 bg-white/80 backdrop-blur-sm">
          <h3 className="font-medium mb-3 text-center">Common Phrases</h3>
          <div className="grid gap-2">
            {COMMON_PHRASES.slice(0, 6).map((phrase, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handlePhraseSelect(phrase)}
                className="text-left justify-start h-auto py-3 px-3 text-sm leading-tight"
              >
                {phrase}
              </Button>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
};