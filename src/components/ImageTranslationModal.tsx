import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Image as ImageIcon, 
  Upload, 
  Languages, 
  Loader2, 
  FileText,
  Copy,
  X,
  Maximize2,
  Expand
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MedicalTranslationInfo } from './MedicalTranslationInfo';
import { MedicalTranslationAuditViewer } from './MedicalTranslationAuditViewer';
import { TranslationVerificationDetails } from './TranslationVerificationDetails';

interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

interface ImageTranslationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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

export const ImageTranslationModal: React.FC<ImageTranslationModalProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFullScreenText, setShowFullScreenText] = useState(false);
  const [showFullScreenOriginal, setShowFullScreenOriginal] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('Image size must be less than 10MB');
      return;
    }

    setSelectedImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    // Reset previous results
    setResult(null);
  };

  const processDocument = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
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
          toast.error('Failed to process document');
          return;
        }

        setResult(data as TranslationResult);
        toast.success('Document processed successfully');
      };

      reader.readAsDataURL(selectedImage);
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

  const resetForm = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setResult(null);
    setTargetLanguage('en');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] overflow-y-auto flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Document Image Translation - Full View
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
          
          {/* Medical Translation Features Info */}
          <div className="flex justify-center gap-2 pt-2">
            <MedicalTranslationInfo />
            <MedicalTranslationAuditViewer />
          </div>
        </DialogHeader>

        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* Top Section - Upload Controls and Image Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-b pb-6">
            {/* Left - Upload Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Upload Document Image</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                  className="flex items-center gap-2"
                >
                  Reset
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Select Image
                  </Button>
                  
                  {selectedImage && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {selectedImage.name}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium min-w-fit">Target Language:</label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
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
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Languages className="w-4 h-4 mr-2" />
                  )}
                  Extract & Translate Text
                </Button>
              </div>
            </div>

            {/* Right - Image Preview */}
            {imagePreview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Selected Image Preview</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullScreenImage(true)}
                    className="flex items-center gap-1 h-6"
                    title="View full screen image"
                  >
                    <Expand className="w-3 h-3" />
                    Enlarge
                  </Button>
                </div>
                <div className="border rounded-lg p-4 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                     onClick={() => setShowFullScreenImage(true)}>
                  <img
                    src={imagePreview}
                    alt="Selected document"
                    className="max-w-full h-64 object-contain mx-auto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Results Section - Much Larger */}
          {result && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
              <div className="space-y-4">
                <Alert className="h-full flex flex-col">
                  <Languages className="w-4 h-4" />
                  <AlertDescription className="flex-1 flex flex-col">
                    <div className="space-y-3 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <span><strong>Detected Language:</strong> {result.detectedLanguage}</span>
                        <Badge variant="outline">Confidence: {Math.round(result.confidence * 100)}%</Badge>
                      </div>
                      
                      <div className="space-y-2 flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Original Text:</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowFullScreenOriginal(true)}
                              className="flex items-center gap-1 h-6"
                              title="Enlarge text for easier viewing"
                            >
                              <Expand className="w-3 h-3" />
                              Enlarge
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyText(result.originalText)}
                              className="flex items-center gap-1 h-6"
                            >
                              <Copy className="w-3 h-3" />
                              {copied ? 'Copied!' : 'Copy'}
                            </Button>
                          </div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-sm flex-1 overflow-y-auto min-h-[300px]">
                          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                            {result.originalText}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>

              <div className="space-y-4">
                <Alert className="border-primary/20 bg-primary/5 h-full flex flex-col">
                  <Languages className="w-4 h-4 text-primary" />
                  <AlertDescription className="flex-1 flex flex-col">
                    <div className="space-y-3 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Translated Text ({languages.find(l => l.code === targetLanguage)?.name}):</span>
                         <div className="flex items-center gap-1">
                           <TranslationVerificationDetails
                             originalText={result.originalText}
                             translatedText={result.translatedText}
                             sourceLanguage={result.detectedLanguage}
                             targetLanguage={languages.find(l => l.code === targetLanguage)?.name || targetLanguage}
                           />
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => setShowFullScreenText(true)}
                             className="flex items-center gap-1 h-6"
                             title="Enlarge text for easier viewing"
                           >
                             <Expand className="w-3 h-3" />
                             Enlarge
                           </Button>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleCopyText(result.translatedText)}
                             className="flex items-center gap-1 h-6"
                           >
                             <Copy className="w-3 h-3" />
                             {copied ? 'Copied!' : 'Copy'}
                           </Button>
                         </div>
                      </div>
                      <div className="p-4 bg-background border rounded-lg text-sm flex-1 overflow-y-auto min-h-[300px]">
                        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                          {result.translatedText}
                        </pre>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Full Screen Image Modal */}
      <Dialog open={showFullScreenImage} onOpenChange={setShowFullScreenImage}>
        <DialogContent className="max-w-full max-h-full w-screen h-screen m-0 rounded-none flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Document Image - Full Screen View
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullScreenImage(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
            <div className="h-full flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Selected document - full view"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Original Text Modal */}
      <Dialog open={showFullScreenOriginal} onOpenChange={setShowFullScreenOriginal}>
        <DialogContent className="max-w-full max-h-full w-screen h-screen m-0 rounded-none flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Original Text - Full Screen View ({result?.detectedLanguage || ''})
              </div>
              <div className="flex items-center gap-2">
                {result && (
                  <TranslationVerificationDetails
                    originalText={result.originalText}
                    translatedText={result.translatedText}
                    sourceLanguage={result.detectedLanguage}
                    targetLanguage={languages.find(l => l.code === targetLanguage)?.name || targetLanguage}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => result && handleCopyText(result.originalText)}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullScreenOriginal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
            <div className="max-w-4xl mx-auto">
              <div className="bg-background border rounded-lg p-8 shadow-sm">
                <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-foreground">
                  {result?.originalText || ''}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Translated Text Modal */}
      <Dialog open={showFullScreenText} onOpenChange={setShowFullScreenText}>
        <DialogContent className="max-w-full max-h-full w-screen h-screen m-0 rounded-none flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Translated Text - Full Screen View ({languages.find(l => l.code === targetLanguage)?.name})
              </div>
              <div className="flex items-center gap-2">
                {result && (
                  <TranslationVerificationDetails
                    originalText={result.originalText}
                    translatedText={result.translatedText}
                    sourceLanguage={result.detectedLanguage}
                    targetLanguage={languages.find(l => l.code === targetLanguage)?.name || targetLanguage}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => result && handleCopyText(result.translatedText)}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullScreenText(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 bg-primary/5">
            <div className="max-w-4xl mx-auto">
              <div className="bg-background border rounded-lg p-8 shadow-sm">
                <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-foreground">
                  {result?.translatedText || ''}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};