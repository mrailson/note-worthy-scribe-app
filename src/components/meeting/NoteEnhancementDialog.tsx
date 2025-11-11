import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2 } from 'lucide-react';
import { SpeechToText } from '@/components/SpeechToText';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

interface NoteEnhancementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalContent: string;
  onEnhanced: (enhancedContent: string) => void;
  meetingId?: string;
}

export function NoteEnhancementDialog({
  open,
  onOpenChange,
  originalContent,
  onEnhanced,
  meetingId
}: NoteEnhancementDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useTranscript, setUseTranscript] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTranscription = (text: string) => {
    setPrompt(prev => prev + (prev ? ' ' : '') + text);
  };

  const handleEnhance = async () => {
    if (!prompt.trim()) {
      showToast.error('Please enter a prompt or use voice input');
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent,
          enhancementType: 'custom',
          specificRequest: prompt,
          useTranscript,
          meetingId
        }
      });

      if (error) throw error;

      if (data?.enhancedContent) {
        onEnhanced(data.enhancedContent);
        showToast.success('Notes enhanced successfully!', { section: 'meeting_manager' });
        setPrompt('');
        onOpenChange(false);
      } else {
        throw new Error('No enhanced content received');
      }
    } catch (error) {
      console.error('Error enhancing notes:', error);
      showToast.error('Failed to enhance notes. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] z-[150]" style={{ zIndex: 150 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Enhance Meeting Notes
          </DialogTitle>
          <DialogDescription>
            Describe the changes you want to make to the notes, or use voice input.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="prompt" className="text-sm font-medium">
                Enhancement Request
              </label>
              <SpeechToText
                onTranscription={handleTranscription}
                inputRef={textareaRef}
                size="sm"
              />
            </div>
            <Textarea
              ref={textareaRef}
              id="prompt"
              placeholder="E.g., 'Add more detail to the action items' or 'Make it more formal and professional'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px]"
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              Examples: "Add time estimates to action items", "Include specific quotes", "Make it more concise"
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="use-transcript"
              checked={useTranscript}
              onCheckedChange={(checked) => setUseTranscript(checked as boolean)}
              disabled={isProcessing}
            />
            <Label
              htmlFor="use-transcript"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Use Meeting Transcript
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEnhance}
            disabled={isProcessing || !prompt.trim()}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enhancing...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Enhance Notes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
