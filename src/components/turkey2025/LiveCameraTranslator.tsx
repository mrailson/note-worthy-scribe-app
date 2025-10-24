import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, X, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTranslate } from '@/hooks/useDocumentTranslate';

interface LiveCameraTranslatorProps {
  onBack: () => void;
}

const LiveCameraTranslator = ({ onBack }: LiveCameraTranslatorProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState<'en' | 'tr'>('en');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();
  const { translateDocument } = useDocumentTranslate();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        
        // Ensure video plays on iOS
        videoRef.current.play().catch(err => {
          console.error('Video play error:', err);
        });
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: 'Camera access denied',
        description: 'Please allow camera access to use this feature',
        variant: 'destructive'
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  const captureAndTranslate = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsTranslating(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsTranslating(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        const result = await translateDocument(imageData, targetLang);
        
        if (result) {
          setTranslation(result.translatedText);
          
          // Auto-speak translation
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(result.translatedText);
            utterance.lang = targetLang === 'en' ? 'en-GB' : 'tr-TR';
            window.speechSynthesis.speak(utterance);
          }
        }
        setIsTranslating(false);
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.8);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 pt-safe bg-background/95 backdrop-blur">
        <Button variant="ghost" size="lg" onClick={onBack} className="touch-manipulation">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold flex-1">Live Camera</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setTargetLang(prev => prev === 'en' ? 'tr' : 'en')}
          className="touch-manipulation"
        >
          <Languages className="h-4 w-4 mr-1" />
          {targetLang === 'en' ? '🇹🇷→🇬🇧' : '🇬🇧→🇹🇷'}
        </Button>
        <Button 
          variant="ghost" 
          size="lg" 
          onClick={stopCamera}
          disabled={!isStreaming}
          className="touch-manipulation"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        {!isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <Camera className="h-24 w-24 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Live Translation</h2>
            <p className="text-gray-400 text-center mb-8">
              Point your camera at Turkish text for instant English translation
            </p>
            <Button
              size="lg"
              onClick={startCamera}
              className="h-16 px-8 text-xl touch-manipulation"
            >
              <Camera className="h-6 w-6 mr-2" />
              Start Camera
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ backgroundColor: 'transparent' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Translation Overlay */}
            {translation && (
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <Card className="p-6 bg-background/95 backdrop-blur">
                  <p className="text-2xl font-medium leading-relaxed">{translation}</p>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {/* Capture Button */}
      {isStreaming && (
        <div className="p-6 pb-safe bg-background/95 backdrop-blur">
          <Button
            size="lg"
            onClick={captureAndTranslate}
            disabled={isTranslating}
            className="w-full h-16 text-xl touch-manipulation"
          >
            {isTranslating ? 'Translating...' : 'Translate Now'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default LiveCameraTranslator;
