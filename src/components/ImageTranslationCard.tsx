import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Image as ImageIcon, 
  Upload, 
  Languages, 
  Loader2, 
  FileText,
  Copy,
  RotateCcw,
  Maximize2,
  ChevronDown
} from 'lucide-react';
import { ImageTranslationModal } from '@/components/ImageTranslationModal';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

interface ImageTranslationCardProps {
  resetTrigger?: number;
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese (Mandarin)' },
  { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polish' },
];

export const ImageTranslationCard = ({ resetTrigger }: ImageTranslationCardProps) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast.error('Please select a valid image file', { section: 'translation' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      showToast.error('Image size must be less than 10MB', { section: 'translation' });
      return;
    }

    setSelectedImage(file);
  };

  const processDocument = async () => {
    if (!selectedImage) {
      showToast.error('Please select an image first', { section: 'translation' });
      return;
    }

    setIsProcessing(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        const { data, error } = await supabase.functions.invoke('image-ocr-translate', {
          body: {
            imageData: base64,
            targetLanguage: targetLanguage,
          },
        });

        if (error) {
          console.error('Document translation error:', error);
          showToast.error('Failed to process document', { section: 'translation' });
          return;
        }

        setResult(data as TranslationResult);
        showToast.success('Document processed successfully', { section: 'translation' });
      };

      reader.readAsDataURL(selectedImage);
    } catch (error) {
      console.error('Error processing document:', error);
      showToast.error('Failed to process document', { section: 'translation' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast.success('Text copied to clipboard', { section: 'translation' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast.error('Failed to copy text', { section: 'translation' });
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setResult(null);
    setTargetLanguage('en');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast.success('Image translation cleared', { section: 'translation' });
  };

  // Handle external reset trigger
  React.useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      resetForm();
    }
  }, [resetTrigger]);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between w-full cursor-pointer">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Document Image Translation
              </CardTitle>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="text-center py-8">
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Advanced OCR and translation for document images with clinical verification
                  </p>
                </div>
                <Button 
                  onClick={() => setShowModal(true)}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Maximize2 className="w-5 h-5" />
                  Click Here to start the Document Image Translation service
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      
      <ImageTranslationModal
        isOpen={showModal}
        onOpenChange={setShowModal}
      />
    </Card>
  );
};