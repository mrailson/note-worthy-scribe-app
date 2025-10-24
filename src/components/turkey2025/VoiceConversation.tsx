import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Mic, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTurkishSpeech } from '@/hooks/useTurkishSpeech';
import { useTurkishTranslation } from '@/hooks/useTurkishTranslation';

interface Message {
  id: string;
  text: string;
  translated: string;
  language: 'en' | 'tr';
  timestamp: Date;
}

interface VoiceConversationProps {
  onBack: () => void;
}

const VoiceConversation = ({ onBack }: VoiceConversationProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentLang, setCurrentLang] = useState<'en' | 'tr'>('en');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { translate } = useTurkishTranslation();
  const { isListening, startListening, stopListening } = useTurkishSpeech({
    language: currentLang,
    onResult: async (text) => {
      // Translate to other language
      const targetLang = currentLang === 'en' ? 'tr' : 'en';
      const result = await translate(text, currentLang, targetLang);
      
      if (result) {
        const newMessage: Message = {
          id: Date.now().toString(),
          text,
          translated: result,
          language: currentLang,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        // Auto-play translated text
        const utterance = new SpeechSynthesisUtterance(result);
        utterance.lang = targetLang === 'tr' ? 'tr-TR' : 'en-GB';
        window.speechSynthesis.speak(utterance);
      }
      
      // Switch language for next input
      setCurrentLang(targetLang);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe border-b">
        <Button variant="ghost" size="lg" onClick={onBack} className="touch-manipulation">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">Voice Chat</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setCurrentLang(prev => prev === 'en' ? 'tr' : 'en')}
          className="touch-manipulation"
        >
          <Languages className="h-4 w-4 mr-1" />
          {currentLang === 'en' ? '🇬🇧→🇹🇷' : '🇹🇷→🇬🇧'}
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Mic className="h-24 w-24 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Start Speaking</h2>
            <p className="text-muted-foreground text-lg">Tap the microphone to begin your conversation</p>
            <p className="text-sm text-muted-foreground mt-4">Currently: {currentLang === 'en' ? '🇬🇧 English' : '🇹🇷 Turkish'}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <Card className={`p-4 ${msg.language === 'en' ? 'bg-primary text-primary-foreground ml-8' : 'bg-secondary mr-8'}`}>
                  <p className="text-lg font-medium mb-1">{msg.text}</p>
                  <p className="text-sm opacity-75">{msg.language === 'en' ? '🇬🇧' : '🇹🇷'}</p>
                </Card>
                <Card className={`p-4 ${msg.language === 'en' ? 'bg-secondary mr-8' : 'bg-primary text-primary-foreground ml-8'}`}>
                  <p className="text-lg font-medium mb-1">{msg.translated}</p>
                  <p className="text-sm opacity-75">{msg.language === 'en' ? '🇹🇷' : '🇬🇧'}</p>
                </Card>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Mic Button */}
      <div className="p-4 pb-safe flex flex-col items-center gap-3 border-t bg-background">
        <p className="text-sm text-muted-foreground">
          Speaking: {currentLang === 'en' ? '🇬🇧 English' : '🇹🇷 Turkish'}
        </p>
        <Button
          size="lg"
          variant={isListening ? 'destructive' : 'default'}
          onClick={toggleListening}
          className={`h-16 w-16 rounded-full touch-manipulation ${isListening ? 'animate-pulse' : ''}`}
        >
          <Mic className="h-8 w-8" />
        </Button>
      </div>
    </div>
  );
};

export default VoiceConversation;
