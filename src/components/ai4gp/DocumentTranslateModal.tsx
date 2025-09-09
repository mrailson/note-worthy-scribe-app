import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Camera, FileText, Languages, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DocumentTranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat: (text: string) => void;
}

interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

const COMMON_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
];

export const DocumentTranslateModal: React.FC<DocumentTranslateModalProps> = ({
  isOpen,
  onClose,
  onInsertToChat,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [editableText, setEditableText] = useState('');
  const [copied, setCopied] = useState(false);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('Image size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setResult(null);
      setEditableText('');
    };
    reader.readAsDataURL(file);
  };

  const processDocument = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('image-ocr-translate', {
        body: {
          imageData: selectedImage,
          targetLanguage,
        },
      });

      if (error) {
        console.error('OCR processing error:', error);
        toast.error('Failed to process document');
        return;
      }

      setResult(data);
      setEditableText(data.originalText);
      
      if (data.originalText) {
        toast.success('Document processed successfully!');
      } else {
        toast.warning('No text found in the image');
      }
    } catch (error) {
      console.error('Error processing document:', error);
      toast.error('Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Text copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy text');
    }
  };

  const handleInsertTranslation = () => {
    if (result?.translatedText) {
      onInsertToChat(result.translatedText);
      toast.success('Translation inserted into chat');
      onClose();
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setResult(null);
    setEditableText('');
    setCopied(false);
  };

  const getLanguageName = (code: string) => {
    const lang = COMMON_LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code.toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Document Translation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Upload Section */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Upload Document Image
                  </h3>
                  {selectedImage && (
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      Reset
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="document-upload"
                    />
                    <label
                      htmlFor="document-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Camera className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">
                        Click to select document image
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        PNG, JPG up to 10MB
                      </span>
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Target Language
                      </label>
                      <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.flag} {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button
                      onClick={processDocument}
                      disabled={!selectedImage || isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Extract & Translate
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {selectedImage && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Selected Image:</p>
                    <img
                      src={selectedImage}
                      alt="Selected document"
                      className="max-w-full h-48 object-contain border rounded-lg"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          {result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Text */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      Original Text {result.detectedLanguage !== 'unknown' && (
                        <span className="text-xs text-muted-foreground">
                          ({getLanguageName(result.detectedLanguage)})
                        </span>
                      )}
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyText(result.originalText)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Textarea
                    value={editableText}
                    onChange={(e) => setEditableText(e.target.value)}
                    className="min-h-32 text-sm"
                    placeholder="Extracted text will appear here..."
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Confidence: {Math.round(result.confidence * 100)}%
                  </p>
                </CardContent>
              </Card>

              {/* Translated Text */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      Translation ({getLanguageName(targetLanguage)})
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyText(result.translatedText)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Textarea
                    value={result.translatedText}
                    readOnly
                    className="min-h-32 text-sm"
                    placeholder="Translation will appear here..."
                  />
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={handleInsertTranslation}
                      className="flex-1"
                    >
                      Insert into Chat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};