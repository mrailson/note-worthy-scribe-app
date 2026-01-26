import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Languages,
  AlertTriangle,
  Check,
  Copy,
  Printer,
  FileDown,
  Camera,
  QrCode,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { FileProcessorManager } from '@/utils/fileProcessors/FileProcessorManager';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface UploadedDocument {
  id: string;
  file: File;
  thumbnail?: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  extractedText?: string;
  result?: {
    originalText: string;
    translatedText: string;
    detectedLanguage: string;
    clinicalVerification?: {
      hasIssues: boolean;
      issues: Array<{
        severity: string;
        type: string;
        message: string;
        originalValue: string;
        suggestedCorrection?: string;
      }>;
      overallSafety: string;
    };
  };
  errorMessage?: string;
}

interface DocumentTranslationPanelProps {
  sessionId: string;
  sessionToken: string;
  patientLanguage: string;
  onShowQRCode: () => void;
}

export function DocumentTranslationPanel({
  sessionId,
  sessionToken,
  patientLanguage,
  onShowQRCode
}: DocumentTranslationPanelProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const languageInfo = HEALTHCARE_LANGUAGES.find(l => l.code === patientLanguage);

  // Generate thumbnail for image files
  const generateThumbnail = async (file: File): Promise<string | undefined> => {
    if (!file.type.startsWith('image/')) return undefined;
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxSize = 150;
          
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newDocuments: UploadedDocument[] = [];
    
    for (const file of Array.from(files)) {
      // Check if file type is supported
      if (!FileProcessorManager.isSupported(file.name)) {
        showToast.error(`Unsupported file type: ${file.name}`);
        continue;
      }

      const thumbnail = await generateThumbnail(file);
      
      newDocuments.push({
        id: crypto.randomUUID(),
        file,
        thumbnail,
        status: 'pending'
      });
    }

    setDocuments(prev => [...prev, ...newDocuments]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Remove document from queue
  const removeDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  }, []);

  // Extract text from document using FileProcessorManager
  const extractTextFromDocument = async (doc: UploadedDocument): Promise<string> => {
    try {
      const processed = await FileProcessorManager.processFile(doc.file);
      return processed.content;
    } catch (error) {
      console.error('Text extraction error:', error);
      throw error;
    }
  };

  // Translate extracted text
  const translateDocument = async (text: string, sourceLanguage?: string) => {
    const { data, error } = await supabase.functions.invoke('image-ocr-translate', {
      body: {
        imageData: null, // We're passing text directly
        extractedText: text,
        sourceLanguage: sourceLanguage || patientLanguage,
        targetLanguage: 'en'
      }
    });

    if (error) throw error;
    return data;
  };

  // Process all pending documents
  const processAllDocuments = async () => {
    const pendingDocs = documents.filter(d => d.status === 'pending');
    if (pendingDocs.length === 0) {
      showToast.info('No pending documents to process');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    let processed = 0;

    for (const doc of pendingDocs) {
      // Update status to processing
      setDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: 'processing' as const } : d
      ));

      try {
        // Step 1: Extract text
        const extractedText = await extractTextFromDocument(doc);
        
        // Step 2: Translate to English
        const { data, error } = await supabase.functions.invoke('batch-translate-documents', {
          body: {
            text: extractedText,
            sourceLanguage: patientLanguage,
            targetLanguage: 'en',
            sessionId
          }
        });

        if (error) throw error;

        // Update with results
        setDocuments(prev => prev.map(d => 
          d.id === doc.id ? {
            ...d,
            status: 'complete' as const,
            extractedText,
            result: data
          } : d
        ));

        // Expand results automatically
        setExpandedResults(prev => ({ ...prev, [doc.id]: true }));

      } catch (error: any) {
        console.error('Document processing error:', error);
        setDocuments(prev => prev.map(d => 
          d.id === doc.id ? {
            ...d,
            status: 'error' as const,
            errorMessage: error.message || 'Processing failed'
          } : d
        ));
      }

      processed++;
      setProcessingProgress((processed / pendingDocs.length) * 100);
    }

    setIsProcessing(false);
    showToast.success(`Processed ${processed} document(s)`);
  };

  // Retry failed document
  const retryDocument = async (docId: string) => {
    setDocuments(prev => prev.map(d => 
      d.id === docId ? { ...d, status: 'pending' as const, errorMessage: undefined } : d
    ));
  };

  // Copy translation to clipboard
  const copyTranslation = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast.success('Copied to clipboard');
  };

  // Print translation
  const printTranslation = (doc: UploadedDocument) => {
    if (!doc.result) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast.error('Unable to open print window');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Document Translation - ${doc.file.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .section { margin: 20px 0; }
            .label { font-weight: bold; color: #555; margin-bottom: 5px; }
            .content { background: #f5f5f5; padding: 15px; border-radius: 8px; white-space: pre-wrap; }
            .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .meta { font-size: 12px; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Document Translation</h1>
          <p><strong>File:</strong> ${doc.file.name}</p>
          <p><strong>Original Language:</strong> ${languageInfo?.name || doc.result.detectedLanguage}</p>
          
          <div class="section">
            <div class="label">Original Text (${languageInfo?.flag || ''} ${doc.result.detectedLanguage}):</div>
            <div class="content">${doc.result.originalText}</div>
          </div>
          
          <div class="section">
            <div class="label">English Translation:</div>
            <div class="content">${doc.result.translatedText}</div>
          </div>
          
          ${doc.result.clinicalVerification?.hasIssues ? `
            <div class="warning">
              <strong>⚠️ Clinical Verification Warnings:</strong>
              <ul>
                ${doc.result.clinicalVerification.issues.map(issue => 
                  `<li>${issue.message}${issue.suggestedCorrection ? ` (Suggested: ${issue.suggestedCorrection})` : ''}</li>`
                ).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div class="meta">
            <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <ImageIcon className="h-5 w-5" />;
    }
    return <FileText className="h-5 w-5" />;
  };

  const pendingCount = documents.filter(d => d.status === 'pending').length;
  const completedCount = documents.filter(d => d.status === 'complete').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Document Translation</h2>
          <Badge variant="outline">
            {languageInfo?.flag} {languageInfo?.name} → 🇬🇧 English
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onShowQRCode}
          >
            <QrCode className="h-4 w-4 mr-2" />
            QR Code Capture
          </Button>
          <Button
            onClick={processAllDocuments}
            disabled={isProcessing || pendingCount === 0}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Languages className="h-4 w-4 mr-2" />
                Translate All ({pendingCount})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Processing progress */}
      {isProcessing && (
        <div className="mb-4">
          <Progress value={processingProgress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-1">
            Processing documents... {Math.round(processingProgress)}%
          </p>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 mb-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Drop documents here or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports: Images (JPG, PNG), PDFs, Word documents (.docx)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Document queue and results */}
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No documents uploaded</p>
              <p className="text-sm mt-1">
                Upload foreign language documents to translate them to English
              </p>
            </div>
          ) : (
            documents.map(doc => (
              <Card key={doc.id} className={
                doc.status === 'error' ? 'border-destructive' :
                doc.status === 'complete' ? 'border-green-500' : ''
              }>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail or icon */}
                    <div className="shrink-0">
                      {doc.thumbnail ? (
                        <img
                          src={doc.thumbnail}
                          alt={doc.file.name}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          {getFileIcon(doc.file.name)}
                        </div>
                      )}
                    </div>

                    {/* Document info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{doc.file.name}</p>
                        <div className="flex items-center gap-2">
                          {doc.status === 'pending' && (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                          {doc.status === 'processing' && (
                            <Badge variant="default" className="animate-pulse">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing
                            </Badge>
                          )}
                          {doc.status === 'complete' && (
                            <Badge variant="default" className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Complete
                            </Badge>
                          )}
                          {doc.status === 'error' && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {(doc.file.size / 1024).toFixed(1)} KB
                      </p>

                      {/* Error message */}
                      {doc.status === 'error' && doc.errorMessage && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded-lg text-sm text-destructive flex items-center justify-between">
                          <span>{doc.errorMessage}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryDocument(doc.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Retry
                          </Button>
                        </div>
                      )}

                      {/* Translation results */}
                      {doc.status === 'complete' && doc.result && (
                        <Collapsible
                          open={expandedResults[doc.id]}
                          onOpenChange={(open) => setExpandedResults(prev => ({ ...prev, [doc.id]: open }))}
                          className="mt-3"
                        >
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-between">
                              <span>View Translation</span>
                              {expandedResults[doc.id] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-3">
                            {/* Clinical warnings */}
                            {doc.result.clinicalVerification?.hasIssues && (
                              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  Clinical Verification Warnings
                                </div>
                                <ul className="text-sm space-y-1">
                                  {doc.result.clinicalVerification.issues.map((issue, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className={
                                        issue.severity === 'critical' ? 'text-red-600' :
                                        issue.severity === 'high' ? 'text-orange-600' : 'text-amber-600'
                                      }>•</span>
                                      <span>
                                        {issue.message}
                                        {issue.suggestedCorrection && (
                                          <span className="text-green-600 font-medium">
                                            {' '}→ Suggested: {issue.suggestedCorrection}
                                          </span>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Original text */}
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                                {languageInfo?.flag} Original ({doc.result.detectedLanguage})
                              </div>
                              <div className="p-3 bg-muted rounded-lg text-sm max-h-40 overflow-y-auto">
                                {doc.result.originalText}
                              </div>
                            </div>

                            {/* Translated text */}
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                                🇬🇧 English Translation
                              </div>
                              <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-sm max-h-40 overflow-y-auto">
                                {doc.result.translatedText}
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyTranslation(doc.result!.translatedText)}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copy
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => printTranslation(doc)}
                              >
                                <Printer className="h-4 w-4 mr-1" />
                                Print
                              </Button>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Summary footer */}
      {documents.length > 0 && (
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <span>{documents.length} document(s) total</span>
          <span>
            {completedCount} translated, {pendingCount} pending
          </span>
        </div>
      )}
    </div>
  );
}
