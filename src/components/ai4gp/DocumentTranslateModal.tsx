import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, FileText, Languages, Copy, Check, ChevronDown, ChevronUp, Maximize, X, Printer, Mail, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

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
  { code: 'auto', name: 'Auto-detect', flag: '🔍' },
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
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [editableText, setEditableText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isTranslationExpanded, setIsTranslationExpanded] = useState(true);
  const [showFullTranslation, setShowFullTranslation] = useState(false);
  const [aiFormattedHtml, setAiFormattedHtml] = useState<string | null>(null);
  const [isImprovingLayout, setIsImprovingLayout] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [isPatientEmail, setIsPatientEmail] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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
          sourceLanguage: sourceLanguage === 'auto' ? null : sourceLanguage,
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

  const improveLayoutWithAI = async () => {
    if (!result?.translatedText) return;

    setIsImprovingLayout(true);
    try {
      const { data, error } = await supabase.functions.invoke('improve-translation-layout', {
        body: { translatedText: result.translatedText },
      });

      if (error) {
        console.error('AI layout improvement error:', error);
        toast.error('Failed to improve layout with AI');
        return;
      }

      setAiFormattedHtml(data.formattedHtml);
      toast.success('Layout improved with AI!');
    } catch (error) {
      console.error('Layout improvement error:', error);
      toast.error('Failed to improve layout');
    } finally {
      setIsImprovingLayout(false);
    }
  };

  const handlePrint = () => {
    const content = aiFormattedHtml || result?.translatedText || '';
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Translation - ${getLanguageName(targetLanguage)}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
              h1, h2, h3 { color: #2563eb; }
              .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
              .content { max-width: 800px; margin: 0 auto; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="content">
              <div class="header">
                <h1>Document Translation</h1>
                <p><strong>Target Language:</strong> ${getLanguageName(targetLanguage)}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <div class="translation">
                ${aiFormattedHtml ? content : content.replace(/\n/g, '<br>')}
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadWord = async () => {
    if (!result?.translatedText) return;

    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "Document Translation",
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Target Language: ${getLanguageName(targetLanguage)}`,
                  bold: true,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated: ${new Date().toLocaleString()}`,
                  bold: true,
                }),
              ],
            }),
            new Paragraph({ text: "" }), // Empty line
            ...result.translatedText.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun({ text: line || " " })],
              })
            ),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translation-${targetLanguage}-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Word document downloaded!');
    } catch (error) {
      console.error('Word download error:', error);
      toast.error('Failed to download Word document');
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !result?.translatedText) return;

    setIsSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('send-translation-email', {
        body: {
          to: emailAddress,
          subject: `Document Translation - ${getLanguageName(targetLanguage)}`,
          translatedText: aiFormattedHtml || result.translatedText,
          originalText: isPatientEmail ? undefined : result.originalText,
          isPatientEmail,
        },
      });

      if (error) {
        console.error('Email sending error:', error);
        toast.error('Failed to send email');
        return;
      }

      toast.success(`Email sent successfully to ${emailAddress}`);
      setShowEmailDialog(false);
      setEmailAddress('');
    } catch (error) {
      console.error('Email error:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <>
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
                        Source Language
                      </label>
                      <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
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
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Target Language
                      </label>
                      <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_LANGUAGES.filter(lang => lang.code !== 'auto').map((lang) => (
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

              {/* Translated Text - Expandable */}
              <Card>
                <Collapsible open={isTranslationExpanded} onOpenChange={setIsTranslationExpanded}>
                  <CollapsibleTrigger asChild>
                    <div className="p-4 cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">
                            Translation ({getLanguageName(targetLanguage)})
                          </h3>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFullTranslation(true);
                            }}
                          >
                            <Maximize className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(result.translatedText);
                            }}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          {isTranslationExpanded ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />
                          }
                        </div>
                      </div>
                      {!isTranslationExpanded && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {result.translatedText.slice(0, 150)}...
                        </p>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4">
                      <div className="bg-gray-50 border rounded-lg p-4 max-h-60 overflow-y-auto">
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                            {result.translatedText}
                          </p>
                        </div>
                      </div>
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
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Full Translation Modal */}
    <Dialog open={showFullTranslation} onOpenChange={setShowFullTranslation}>
      <DialogContent className="max-w-4xl w-[90vw] h-[90vh] max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Translation ({result ? getLanguageName(targetLanguage) : ''})
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={improveLayoutWithAI}
                disabled={isImprovingLayout}
                title="Improve formatting with AI"
              >
                {isImprovingLayout ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePrint}
                title="Print document"
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEmailDialog(true)}
                title="Email document"
              >
                <Mail className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownloadWord}
                title="Download as Word document"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => result && handleCopyText(aiFormattedHtml || result.translatedText)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFullTranslation(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 p-6 overflow-hidden">
          <div className="h-full bg-white border rounded-lg p-6 overflow-y-auto">
            <div className="prose prose-lg max-w-none">
              {aiFormattedHtml ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: aiFormattedHtml }}
                  className="leading-relaxed"
                />
              ) : (
                <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-900">
                  {result?.translatedText || ''}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6 pt-2 border-t bg-gray-50">
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowFullTranslation(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                handleInsertTranslation();
                setShowFullTranslation(false);
              }}
            >
              Insert into Chat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Email Dialog */}
    <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Translation
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="Enter email address"
              className="mt-1"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="patientEmail"
              checked={isPatientEmail}
              onChange={(e) => setIsPatientEmail(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="patientEmail" className="text-sm">
              Patient-friendly email (hide original text)
            </Label>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={!emailAddress || isSendingEmail}
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default DocumentTranslateModal;