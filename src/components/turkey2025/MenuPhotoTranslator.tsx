import { useState, useRef } from 'react';
import { Camera, ArrowLeft, Volume2, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTranslate } from '@/hooks/useDocumentTranslate';

interface MenuPhotoTranslatorProps {
  onBack: () => void;
}

const MenuPhotoTranslator = ({ onBack }: MenuPhotoTranslatorProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string>('');
  const [originalText, setOriginalText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { translateDocument, isTranslating } = useDocumentTranslate();

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;
      setImage(imageData);
      
      const result = await translateDocument(imageData, 'en');
      
      if (result) {
        setOriginalText(result.originalText);
        setTranslation(result.translatedText);
      }
    };
    reader.readAsDataURL(file);
  };

  const speakTranslation = () => {
    if ('speechSynthesis' in window && translation) {
      const utterance = new SpeechSynthesisUtterance(translation);
      utterance.lang = 'en-GB';
      window.speechSynthesis.speak(utterance);
    }
  };

  const saveToFavorites = () => {
    const saved = JSON.parse(localStorage.getItem('turkeyFavorites') || '[]');
    saved.push({
      id: Date.now(),
      original: originalText,
      translated: translation,
      image,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('turkeyFavorites', JSON.stringify(saved));
    toast({ title: 'Saved to favorites' });
  };

  const clearImage = () => {
    setImage(null);
    setTranslation('');
    setOriginalText('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe border-b">
        <Button variant="ghost" size="lg" onClick={onBack} className="touch-manipulation">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">Menu Translator</h1>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!image ? (
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer hover:scale-105 active:scale-95 transition-transform touch-manipulation"
              aria-label="Take photo"
            >
              <Camera className="h-32 w-32 text-primary" />
            </button>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Take a Photo</h2>
              <p className="text-muted-foreground">Tap the camera icon or button below to capture a menu</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="relative">
              <img src={image} alt="Menu" className="w-full h-auto rounded-lg" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={clearImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>

            {translation && (
              <Card className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Translation:</h3>
                  <p className="text-2xl font-medium leading-relaxed">{translation}</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={speakTranslation} className="flex-1 h-12 text-base touch-manipulation">
                    <Volume2 className="h-5 w-5 mr-2" />
                    Play Audio
                  </Button>
                  <Button onClick={saveToFavorites} variant="outline" size="icon" className="h-12 w-12 touch-manipulation">
                    <Star className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Camera Button */}
      {!image && (
        <div className="p-4 pb-safe border-t bg-background">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="hidden"
          />
          <Button
            size="lg"
            className="w-full h-14 text-lg touch-manipulation"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTranslating}
          >
            <Camera className="h-5 w-5 mr-2" />
            {isTranslating ? 'Translating...' : 'Take Photo'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MenuPhotoTranslator;
