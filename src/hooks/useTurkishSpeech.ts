import { useState, useRef } from 'react';
import { BrowserSpeechRecognition } from '@/utils/BrowserSpeechRecognition';

interface UseTurkishSpeechProps {
  language: 'en' | 'tr';
  onResult: (text: string) => void;
}

export const useTurkishSpeech = ({ language, onResult }: UseTurkishSpeechProps) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const startListening = async () => {
    if (!recognitionRef.current) {
      recognitionRef.current = new BrowserSpeechRecognition(
        (transcript) => {
          if (transcript.isFinal && transcript.text.trim()) {
            onResult(transcript.text);
          }
        },
        (error) => {
          console.error('Speech error:', error);
          setIsListening(false);
        },
        (status) => {
          console.log('Speech status:', status);
        }
      );
    }

    const lang = language === 'en' ? 'en-GB' : 'tr-TR';
    await recognitionRef.current.setLanguage(lang);
    await recognitionRef.current.startRecognition();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stopRecognition();
    setIsListening(false);
  };

  return {
    isListening,
    startListening,
    stopListening
  };
};
