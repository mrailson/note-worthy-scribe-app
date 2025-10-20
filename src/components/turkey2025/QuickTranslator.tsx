import { useState, useEffect } from 'react';
import { ArrowLeft, Mic, Volume2, Copy, Star, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTurkishTranslation } from '@/hooks/useTurkishTranslation';
import { useTurkishSpeech } from '@/hooks/useTurkishSpeech';
import { supabase } from '@/integrations/supabase/client';

interface QuickTranslatorProps {
  onBack: () => void;
}

const QuickTranslate = ({ onBack }: QuickTranslatorProps) => {
  const [sourceText, setSourceText] = useState('');
  const [targetLang, setTargetLang] = useState<'tr' | 'en'>('tr');
  const { toast } = useToast();
  const { translation, isTranslating, translate } = useTurkishTranslation();
  const { isListening, startListening, stopListening } = useTurkishSpeech({
    language: targetLang === 'tr' ? 'en' : 'tr',
    onResult: (text) => {
      setSourceText(text);
    }
  });

  const sourceLang = targetLang === 'tr' ? 'en' : 'tr';

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const v = synth.getVoices();
      if (v && v.length) setVoices(v);
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      if (synth.onvoiceschanged === loadVoices) synth.onvoiceschanged = null as any;
    };
  }, []);

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast({ title: 'Please enter text to translate', variant: 'destructive' });
      return;
    }
    await translate(sourceText, sourceLang, targetLang);
  };

  const toggleLanguage = () => {
    setTargetLang(targetLang === 'tr' ? 'en' : 'tr');
    setSourceText('');
  };

  const speakTranslation = async () => {
    const text = translation?.trim();
    if (!text) {
      toast({ title: 'No translation to play', variant: 'destructive' });
      return;
    }

    const langCode = targetLang === 'tr' ? 'tr-TR' : 'en-GB';

    // Try Web Speech API first
    const playWithWebSpeech = async (): Promise<boolean> => {
      if (!('speechSynthesis' in window)) return false;

      try {
        // iOS/Safari quirk: resume loop prevents auto-pause
        const resumeInterval = setInterval(() => {
          try { window.speechSynthesis.resume(); } catch {}
        }, 200);

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;

        try {
          const matchExact = voices.find(v => v.lang?.toLowerCase() === langCode.toLowerCase());
          const matchPrefix = voices.find(v => v.lang?.toLowerCase().startsWith(langCode.slice(0,2).toLowerCase()));
          const fallback = voices.find(v => (targetLang === 'en' ? v.lang?.startsWith('en') : v.lang?.startsWith('tr')));
          const selected = matchExact || matchPrefix || fallback;
          if (selected) utterance.voice = selected;
        } catch {}

        const result = await new Promise<boolean>((resolve) => {
          utterance.onend = () => { clearInterval(resumeInterval); resolve(true); };
          utterance.onerror = (e) => { 
            console.error('Speech synthesis error:', e);
            clearInterval(resumeInterval);
            resolve(false);
          };
          window.speechSynthesis.speak(utterance);
        });

        return result;
      } catch (e) {
        console.error('Web Speech playback error:', e);
        return false;
      }
    };

    const webOk = await playWithWebSpeech();
    if (webOk) {
      toast({ title: 'Playing translation' });
      return;
    }

    // Fallback to Edge TTS (server)
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, languageCode: langCode }
      });
      if (error) throw error;
      const base64: string | undefined = data?.audioContent;
      if (!base64) throw new Error('No audio returned');

      const audio = new Audio(`data:audio/mp3;base64,${base64}`);
      await audio.play();
      toast({ title: 'Playing translation' });
    } catch (err) {
      console.error('TTS fallback error:', err);
      toast({
        title: 'Speech playback failed',
        description: 'Please try again or check your device volume',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(translation);
    toast({ title: 'Copied to clipboard' });
  };

  const saveToFavorites = () => {
    const saved = JSON.parse(localStorage.getItem('turkeyFavorites') || '[]');
    saved.push({
      id: Date.now(),
      original: sourceText,
      translated: translation,
      type: 'text',
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('turkeyFavorites', JSON.stringify(saved));
    toast({ title: 'Saved to favorites' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe border-b">
        <Button variant="ghost" size="lg" onClick={onBack} className="touch-manipulation">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">Quick Translate</h1>
        <div className="w-12" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Language Toggle */}
        <div className="flex items-center justify-center gap-4">
          <span className="text-2xl font-bold">{sourceLang === 'en' ? '🇬🇧' : '🇹🇷'}</span>
          <Button variant="outline" size="icon" onClick={toggleLanguage} className="h-12 w-12 touch-manipulation">
            <ArrowLeftRight className="h-5 w-5" />
          </Button>
          <span className="text-2xl font-bold">{targetLang === 'en' ? '🇬🇧' : '🇹🇷'}</span>
        </div>

        {/* Input */}
        <Card className="p-4">
          <Textarea
            placeholder={`Type in ${sourceLang === 'en' ? 'English' : 'Turkish'}...`}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            className="min-h-[120px] text-lg resize-none border-0 focus-visible:ring-0"
          />
        </Card>

        {/* Translation Result */}
        {translation && (
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Translation:</h3>
              <p className="text-2xl font-medium leading-relaxed">{translation}</p>
            </div>

            <div className="flex gap-2">
              <Button onClick={speakTranslation} className="flex-1 h-12 touch-manipulation">
                <Volume2 className="h-5 w-5 mr-2" />
                Play
              </Button>
              <Button onClick={copyToClipboard} variant="outline" size="icon" className="h-12 w-12 touch-manipulation">
                <Copy className="h-5 w-5" />
              </Button>
              <Button onClick={saveToFavorites} variant="outline" size="icon" className="h-12 w-12 touch-manipulation">
                <Star className="h-5 w-5" />
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="p-4 pb-safe space-y-2 border-t bg-background">
        <div className="flex gap-2">
          <Button
            variant={isListening ? 'destructive' : 'outline'}
            size="lg"
            onClick={isListening ? stopListening : startListening}
            className="flex-1 h-12 text-base touch-manipulation"
          >
            <Mic className="h-4 w-4 mr-2" />
            {isListening ? 'Stop' : 'Voice'}
          </Button>
          <Button
            size="lg"
            onClick={handleTranslate}
            disabled={isTranslating || !sourceText.trim()}
            className="flex-1 h-12 text-base touch-manipulation"
          >
            {isTranslating ? 'Translating...' : 'Translate'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickTranslate;
