import { useState } from 'react';
import { ArrowLeft, Mic, Volume2, Copy, Star, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTurkishTranslation } from '@/hooks/useTurkishTranslation';
import { useTurkishSpeech } from '@/hooks/useTurkishSpeech';

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

  const speakTranslation = () => {
    if ('speechSynthesis' in window && translation) {
      const utterance = new SpeechSynthesisUtterance(translation);
      utterance.lang = targetLang === 'tr' ? 'tr-TR' : 'en-GB';
      window.speechSynthesis.speak(utterance);
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
