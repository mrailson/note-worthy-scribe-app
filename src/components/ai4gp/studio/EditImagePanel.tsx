import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Upload, 
  Sparkles, 
  X, 
  Download, 
  RefreshCw, 
  Check,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Mic,
  MicOff,
  FileImage,
  Replace,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeneratedImage } from '@/types/ai4gp';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import type { StockImage } from '@/hooks/useStockImages';

interface EditImagePanelProps {
  onQuickEdit: (imageContent: string, instructions: string, referenceImage?: string) => Promise<GeneratedImage | null>;
  onSaveToGallery: (result: GeneratedImage) => Promise<string | null>;
  onGallerySaved?: () => void;
  isGenerating: boolean;
  progress: number;
  initialImage?: { url: string; name: string } | null;
  // Admin stock replacement
  isAdmin?: boolean;
  stockImages?: StockImage[];
  onReplaceStockImage?: (image: StockImage, newImageDataUrl: string) => Promise<void>;
  isReplacing?: boolean;
}

export const EditImagePanel: React.FC<EditImagePanelProps> = ({
  onQuickEdit,
  onSaveToGallery,
  onGallerySaved,
  isGenerating,
  progress,
  initialImage,
  isAdmin,
  stockImages,
  onReplaceStockImage,
  isReplacing,
}) => {
  const [uploadedImage, setUploadedImage] = useState<{ content: string; name: string } | null>(null);
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editResult, setEditResult] = useState<GeneratedImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedImageId, setSavedImageId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const preVoiceTextRef = useRef<string>('');
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // Load initial image if provided
  useEffect(() => {
    if (initialImage && !uploadedImage) {
      setUploadedImage({
        content: initialImage.url,
        name: initialImage.name || 'Gallery Image',
      });
    }
  }, [initialImage]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please paste an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage({
        content: reader.result as string,
        name: file.name || 'Pasted Image',
      });
      setEditResult(null);
      setSavedImageId(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  // Handle Ctrl+V paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isGenerating) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            toast.success('Image pasted successfully');
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isGenerating, processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    disabled: isGenerating,
  });

  const handleApplyChanges = async () => {
    if (!uploadedImage || !editInstructions.trim()) return;
    
    const result = await onQuickEdit(uploadedImage.content, editInstructions, referencePreview || undefined);
    if (result) {
      setEditResult(result);
      setSavedImageId(null);
      // Auto-save to gallery in background
      onSaveToGallery(result).then(id => {
        if (id) {
          setSavedImageId(id);
          onGallerySaved?.();
        }
      }).catch(err => console.warn('Auto-save failed:', err));
    }
  };

  const handleVoiceInput = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-GB';
    recognitionRef.current = recognition;
    preVoiceTextRef.current = editInstructions;

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      if (transcript) {
        const base = preVoiceTextRef.current;
        setEditInstructions(base ? base + ' ' + transcript : transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error !== 'aborted') toast.error('Voice input error: ' + event.error);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
    toast.info('Listening... speak your edit instructions');
  }, [isListening, editInstructions]);

  const handleRefFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    setReferenceFile(file);
    const reader = new FileReader();
    reader.onload = () => setReferencePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearRefFile = () => {
    setReferenceFile(null);
    setReferencePreview(null);
    if (refFileInputRef.current) refFileInputRef.current.value = '';
  };

  const handleEditAgain = () => {
    if (editResult) {
      setUploadedImage({
        content: editResult.url,
        name: 'Edited Image',
      });
      setEditResult(null);
      setEditInstructions('');
      setSavedImageId(null);
    }
  };

  const handleDownload = () => {
    if (!editResult?.url) return;
    const link = document.createElement('a');
    link.href = editResult.url;
    link.download = `edited-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenFullSize = () => {
    if (editResult?.url) {
      window.open(editResult.url, '_blank');
    }
  };

  const handleSave = async () => {
    if (!editResult) return;
    setIsSaving(true);
    const imageId = await onSaveToGallery(editResult);
    setIsSaving(false);
    if (imageId) {
      setSavedImageId(imageId);
      onGallerySaved?.();
    }
  };

  const handleClear = () => {
    setUploadedImage(null);
    setEditInstructions('');
    setEditResult(null);
    setSavedImageId(null);
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      {!uploadedImage && !editResult && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium">
                {isDragActive ? 'Drop your image here' : 'Upload an image to edit'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag & drop, click to browse, or <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+V</kbd> to paste
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Image Preview */}
      {uploadedImage && !editResult && (
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {uploadedImage.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                disabled={isGenerating}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="relative rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center max-h-[300px]">
              <img
                src={uploadedImage.content}
                alt="Uploaded image"
                className="max-w-full max-h-[300px] object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Instructions */}
      {uploadedImage && !editResult && (
        <div className="space-y-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            What changes would you like?
          </label>
          <div className="relative">
            <Textarea
              value={editInstructions}
              onChange={(e) => setEditInstructions(e.target.value)}
              placeholder="e.g., Add our practice phone number in the bottom right, change the background to blue, make it landscape format..."
              className="min-h-[100px] resize-none pr-12"
              disabled={isGenerating}
            />
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'ghost'}
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={handleVoiceInput}
              disabled={isGenerating}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
          {isListening && (
            <p className="text-xs text-primary animate-pulse">🎤 Listening... speak your edit instructions</p>
          )}

          {/* Reference file upload */}
          <div className="flex items-center gap-2 mt-1">
            <input
              ref={refFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleRefFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refFileInputRef.current?.click()}
              disabled={isGenerating}
              className="text-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {referenceFile ? 'Change' : 'Attach Logo/Image'}
            </Button>
            {referenceFile && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileImage className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[120px]">{referenceFile.name}</span>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={clearRefFile} disabled={isGenerating}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {referencePreview && (
            <div className="mt-1 relative w-16 h-16 rounded border overflow-hidden bg-muted">
              <img src={referencePreview} alt="Reference" className="w-full h-full object-contain" />
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Optionally attach a logo or image to integrate into your edit</p>
        </div>
      )}

      {/* Generate Button / Progress */}
      {uploadedImage && !editResult && (
        <div className="space-y-3">
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Applying changes... {progress}%
              </p>
            </div>
          )}
          
          <Button
            onClick={handleApplyChanges}
            disabled={!editInstructions.trim() || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying Changes...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Apply Changes
              </>
            )}
          </Button>
        </div>
      )}

      {/* Result Display */}
      {editResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Edited Result
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
            >
              <Upload className="h-4 w-4 mr-2" />
              New Image
            </Button>
          </div>
          
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
                <img
                  src={editResult.url}
                  alt={editResult.alt || 'Edited image'}
                  className="max-w-full max-h-[400px] object-contain"
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex-1 min-w-[120px]"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-1 min-w-[120px] justify-center">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : savedImageId ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Auto-saved to Gallery</span>
                </>
              ) : (
                <span>Saving to Gallery...</span>
              )}
            </div>
            
            <Button
              variant="outline"
              onClick={handleOpenFullSize}
              className="flex-1 min-w-[120px]"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Full Size
            </Button>
            
            <Button
              onClick={handleEditAgain}
              className="flex-1 min-w-[120px]"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Edit Again
            </Button>
          </div>

          {/* Admin: Replace Stock Image */}
          {isAdmin && onReplaceStockImage && editResult && (
            <div className="space-y-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStockPicker(!showStockPicker)}
                className="w-full text-xs"
              >
                <Replace className="h-3.5 w-3.5 mr-1.5" />
                Replace a Stock Library Image with This
              </Button>

              {showStockPicker && stockImages && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30 max-h-[300px] flex flex-col">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={stockSearchQuery}
                      onChange={(e) => setStockSearchQuery(e.target.value)}
                      placeholder="Search stock images..."
                      className="w-full pl-8 pr-3 py-2 text-xs border rounded-md bg-background"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Select a stock image to replace with the edited result above
                  </p>
                  <div className="grid grid-cols-4 gap-2 overflow-y-auto flex-1 auto-rows-[80px]">
                    {stockImages
                      .filter(img => {
                        if (!stockSearchQuery.trim()) return true;
                        const q = stockSearchQuery.toLowerCase();
                        return img.title.toLowerCase().includes(q) ||
                          img.category.toLowerCase().includes(q) ||
                          img.tags?.some(t => t.toLowerCase().includes(q));
                      })
                      .slice(0, 40)
                      .map(img => (
                        <button
                          key={img.id}
                          onClick={async () => {
                            if (!editResult?.url) return;
                            try {
                              await onReplaceStockImage(img, editResult.url);
                              setShowStockPicker(false);
                              setStockSearchQuery('');
                            } catch {
                              // error handled by mutation
                            }
                          }}
                          disabled={isReplacing}
                          className="relative group rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all h-[80px] w-full"
                          title={`${img.title} (${img.category})`}
                        >
                          <img
                            src={img.image_url}
                            alt={img.title}
                            className="w-full h-full object-cover"
                          />
                          {isReplacing && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[8px] text-white truncate">{img.title}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
