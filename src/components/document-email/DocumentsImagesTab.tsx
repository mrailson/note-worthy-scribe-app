import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Upload, 
  Image, 
  Camera, 
  Languages, 
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useDocumentTranslate } from '@/hooks/useDocumentTranslate';
import { toast } from 'sonner';

interface DocumentTranslation {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

interface DocumentsImagesTabProps {
  resetTrigger: number;
}

export const DocumentsImagesTab = ({ resetTrigger }: DocumentsImagesTabProps) => {
  const [documentContent, setDocumentContent] = useState('');
  const [translation, setTranslation] = useState<DocumentTranslation | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [dragActive, setDragActive] = useState(false);
  const { translateDocument, isTranslating } = useDocumentTranslate();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;
      const imageData = base64Data.split(',')[1]; // Remove data:image/...;base64, prefix

      try {
        const result = await translateDocument(imageData, targetLanguage);
        if (result) {
          setTranslation({
            originalText: result.originalText,
            translatedText: result.translatedText,
            detectedLanguage: result.detectedLanguage,
            confidence: result.confidence
          });
          toast.success('Document translated successfully');
        }
      } catch (error) {
        console.error('Translation error:', error);
        toast.error('Failed to translate document');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileUpload(imageFile);
    } else {
      toast.error('Please upload an image file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const translateTextContent = async () => {
    if (!documentContent.trim()) {
      toast.error('Please enter some text to translate');
      return;
    }

    // For text content, we'll use a simple translation approach
    // This would typically call a text translation service
    toast.info('Text translation functionality would be implemented here');
  };

  const resetForm = () => {
    setDocumentContent('');
    setTranslation(null);
    setTargetLanguage('en');
    setDragActive(false);
    toast.success('Document translation cleared');
  };

  // Handle external reset trigger
  useEffect(() => {
    if (resetTrigger > 0) {
      resetForm();
    }
  }, [resetTrigger]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Document & Image Translation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Area */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Upload Document Image</label>
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Image className="w-8 h-8" />
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium">Drop image files here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports JPG, PNG, GIF - Photos or scans of documents
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isTranslating}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            </div>
          </div>

          {/* Text Input Area */}
          <div className="space-y-4">
            <label className="text-sm font-medium">Or Enter Text Content</label>
            <Textarea
              placeholder="Paste or type document text here..."
              value={documentContent}
              onChange={(e) => setDocumentContent(e.target.value)}
              rows={6}
              className="resize-vertical"
            />
            
            <Button 
              onClick={translateTextContent} 
              disabled={isTranslating}
              className="w-full"
              variant="outline"
            >
              {isTranslating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Languages className="w-4 h-4 mr-2" />
              )}
              Translate Text
            </Button>
          </div>

          {/* Translation Results */}
          {translation && (
            <Alert>
              <Languages className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {translation.detectedLanguage}
                    </Badge>
                    <Badge variant="outline">
                      Confidence: {translation.confidence}%
                    </Badge>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Original Text:</p>
                      <div className="p-3 bg-muted rounded text-sm">
                        {translation.originalText}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">English Translation:</p>
                      <div className="p-3 bg-primary/5 rounded text-sm">
                        {translation.translatedText}
                      </div>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Processing Status */}
          {isTranslating && (
            <Alert>
              <Loader2 className="w-4 h-4 animate-spin" />
              <AlertDescription>
                Processing document and extracting text for translation...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};