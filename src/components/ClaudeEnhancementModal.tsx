import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Wand2, 
  FileText, 
  Quote, 
  Edit3, 
  MoreHorizontal,
  ArrowRight,
  Loader2,
  Mic,
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SpeechToText } from "@/components/SpeechToText";
import { useDropzone } from 'react-dropzone';

interface ClaudeEnhancementModalProps {
  originalContent: string;
  onEnhancedContent: (content: string) => void;
  children: React.ReactNode;
}

interface UploadedFile {
  name: string;
  content: string;
  type: string;
}

export function ClaudeEnhancementModal({ 
  originalContent, 
  onEnhancedContent, 
  children 
}: ClaudeEnhancementModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [enhancementType, setEnhancementType] = useState<string>("");
  const [customRequest, setCustomRequest] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enhancementOptions = [
    {
      value: 'make_detailed',
      label: 'Make More Detailed',
      description: 'Expand on key points and add comprehensive explanations',
      icon: FileText
    },
    {
      value: 'add_quotes',
      label: 'Add Direct Quotes',
      description: 'Include realistic direct quotes to enhance authenticity',
      icon: Quote
    },
    {
      value: 'improve_clarity',
      label: 'Improve Clarity & Style',
      description: 'Make the content clearer and more professional',
      icon: Edit3
    },
    {
      value: 'add_structure',
      label: 'Enhance Structure',
      description: 'Improve organization with better headings and sections',
      icon: MoreHorizontal
    },
    {
      value: 'replace_content',
      label: 'Replace Specific Content',
      description: 'Make targeted replacements or modifications',
      icon: Wand2
    },
    {
      value: 'custom',
      label: 'Custom Enhancement',
      description: 'Provide your own specific enhancement instructions',
      icon: Sparkles
    }
  ];

  // Handle file upload
  const handleFileUpload = async (files: File[]) => {
    const newFiles: UploadedFile[] = [];
    
    for (const file of files) {
      if (file.type.includes('text') || file.name.endsWith('.txt')) {
        try {
          const content = await file.text();
          newFiles.push({
            name: file.name,
            content,
            type: file.type
          });
        } catch (error) {
          toast.error(`Failed to read ${file.name}`);
        }
      } else {
        toast.error(`Unsupported file type: ${file.name}`);
      }
    }
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    if (newFiles.length > 0) {
      const contextFromFiles = newFiles.map(f => `From ${f.name}: ${f.content}`).join('\n\n');
      setAdditionalContext(prev => prev ? `${prev}\n\n${contextFromFiles}` : contextFromFiles);
      toast.success(`Added ${newFiles.length} file(s) to context`);
    }
  };

  // Handle speech input for instructions
  const handleSpeechInput = (text: string) => {
    setCustomRequest(prev => prev ? `${prev} ${text}` : text);
    toast.success("Speech added to instructions");
  };

  // Handle speech input for context
  const handleContextSpeechInput = (text: string) => {
    setAdditionalContext(prev => prev ? `${prev} ${text}` : text);
    toast.success("Speech added to context");
  };

  // Dropzone for file upload
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/json': ['.json']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    noClick: true
  });

  const handleEnhancement = async () => {
    if (!enhancementType) {
      toast.error("Please select an enhancement type");
      return;
    }

    if ((enhancementType === 'replace_content' || enhancementType === 'custom') && !customRequest.trim()) {
      toast.error("Please provide specific instructions for this enhancement type");
      return;
    }

    if (!originalContent.trim()) {
      toast.error("No content to enhance");
      return;
    }

    setIsEnhancing(true);

    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent,
          enhancementType,
          specificRequest: customRequest,
          context: additionalContext
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Update the enhanced content
      onEnhancedContent(data.enhancedContent);

      // Show success message
      const selectedOption = enhancementOptions.find(opt => opt.value === enhancementType);
      toast.success(`Enhancement complete: ${selectedOption?.label}`);

      // Reset form and close modal
      setEnhancementType("");
      setCustomRequest("");
      setAdditionalContext("");
      setUploadedFiles([]);
      setIsOpen(false);
      
    } catch (error) {
      console.error('Error enhancing meeting minutes:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enhance meeting minutes');
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Meeting Minutes Enhancer
            <Badge variant="secondary">AI Powered</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Use AI to enhance your Claude meeting minutes with various improvements like adding detail, quotes, better structure, or custom modifications.
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enhancement-type">Enhancement Type</Label>
              <Select value={enhancementType} onValueChange={setEnhancementType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose how to enhance your minutes..." />
                </SelectTrigger>
                <SelectContent>
                  {enhancementOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-start gap-2">
                          <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {(enhancementType === 'replace_content' || enhancementType === 'custom') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom-request">Specific Instructions</Label>
                  <SpeechToText 
                    onTranscription={handleSpeechInput}
                    size="sm"
                    className="h-8"
                  />
                </div>
                <Textarea
                  id="custom-request"
                  value={customRequest}
                  onChange={(e) => setCustomRequest(e.target.value)}
                  placeholder={
                    enhancementType === 'replace_content'
                      ? "e.g., Replace 'John' with 'Dr. Smith' throughout the document"
                      : "Describe exactly how you want the minutes enhanced..."
                  }
                  className="min-h-[80px]"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="additional-context">Additional Context (Optional)</Label>
                <div className="flex gap-2">
                  <SpeechToText 
                    onTranscription={handleContextSpeechInput}
                    size="sm"
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8"
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div {...getRootProps()} className={`relative ${isDragActive ? 'border-primary bg-primary/5' : ''}`}>
                <Input
                  id="additional-context"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Any additional context to help with the enhancement..."
                  className={isDragActive ? 'border-primary' : ''}
                />
                <input
                  {...getInputProps()}
                  ref={fileInputRef}
                  className="hidden"
                />
                {isDragActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded">
                    <span className="text-sm font-medium text-primary">Drop files here</span>
                  </div>
                )}
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground mb-1">Uploaded files:</div>
                  <div className="flex flex-wrap gap-1">
                    {uploadedFiles.map((file, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleEnhancement}
                disabled={!enhancementType || isEnhancing}
                className="flex-1"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enhance Meeting Minutes
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                disabled={isEnhancing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}