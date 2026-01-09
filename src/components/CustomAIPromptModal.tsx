import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SpeechToText } from '@/components/SpeechToText';
import { showToast } from '@/utils/toastWrapper';

interface CustomAIPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (prompt: string) => void;
  currentText: string;
}

export const CustomAIPromptModal: React.FC<CustomAIPromptModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  currentText
}) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const quickPrompts = [
    "Make it more professional and formal",
    "Simplify for patient understanding", 
    "Add more clinical detail",
    "Convert to bullet points",
    "Make it more concise",
    "Add safety warnings",
    "Format for email",
    "Convert to plain English",
    "Add NHS governance language",
    "Replace [this] with [that]"
  ];

  const handleSubmit = () => {
    if (customPrompt.trim()) {
      onSubmit(customPrompt);
      setCustomPrompt('');
      onOpenChange(false);
    }
  };

  const handleQuickPromptClick = (prompt: string) => {
    setCustomPrompt(prompt);
  };

  const handleSpeechInput = (text: string) => {
    setCustomPrompt(prev => prev ? `${prev} ${text}` : text);
    showToast.success("Speech added to prompt", { section: 'ai4gp' });
  };

  const textPreview = currentText.length > 150 
    ? currentText.substring(0, 150) + '...' 
    : currentText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Custom AI Enhancement
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current Text Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current Content:</Label>
            <div className="p-3 bg-muted rounded-md border text-sm max-h-32 overflow-y-auto">
              {textPreview}
            </div>
          </div>

          <Separator />

          {/* Quick Prompts */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Prompts (click to use):</Label>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt, index) => (
                <Badge 
                  key={index}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => handleQuickPromptClick(prompt)}
                >
                  {prompt}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom Prompt Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="custom-prompt" className="text-sm font-medium">
                Custom Enhancement Request:
              </Label>
              <SpeechToText 
                onTranscription={handleSpeechInput}
                size="sm"
                className="h-8"
                inputRef={textareaRef}
              />
            </div>
            <Textarea
              ref={textareaRef}
              id="custom-prompt"
              placeholder="Describe exactly how you want the content enhanced, modified, or transformed... (or use the mic button to speak)"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="min-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Tip: Be specific about what changes you want. Use the mic button to speak or type your request. Use Ctrl+Enter to submit.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!customPrompt.trim()}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Enhance Content
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};