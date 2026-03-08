import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AssemblyAISpeechToText } from '@/components/AssemblyAISpeechToText';
import { Brain, Loader2, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const QUICK_PICKS = [
  { id: 'longer', label: 'Make it longer', icon: '📏' },
  { id: 'shorter', label: 'Make it shorter', icon: '✂️' },
  { id: 'detail', label: 'Add more detail', icon: '🔍' },
  { id: 'remove-names', label: 'Remove all names', icon: '🔒' },
  { id: 'simplify', label: 'Simplify the language', icon: '💬' },
  { id: 'formal', label: 'Make it more formal', icon: '👔' },
  { id: 'empathetic', label: 'Make it more empathetic', icon: '💛' },
  { id: 'bullets', label: 'Add bullet points', icon: '📋' },
  { id: 'jargon', label: 'Remove jargon', icon: '🚫' },
  { id: 'summarise', label: 'Summarise key points', icon: '📝' },
];

interface DocumentAIEditPanelProps {
  content: string;
  title: string;
  onContentUpdated: (newContent: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const DocumentAIEditPanel: React.FC<DocumentAIEditPanelProps> = ({
  content,
  title,
  onContentUpdated,
  isOpen,
  onToggle,
}) => {
  const [instruction, setInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllPicks, setShowAllPicks] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleQuickPick = (label: string) => {
    setInstruction(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}. ${label}` : label;
    });
    textareaRef.current?.focus();
  };

  const handleVoiceTranscription = (text: string) => {
    setInstruction(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${text}` : text;
    });
  };

  const handleSubmit = async () => {
    if (!instruction.trim()) {
      toast.error('Please enter an instruction or select a quick pick option');
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-document-studio', {
        body: {
          action: 'refine_document',
          currentContent: content,
          documentTitle: title,
          instruction: instruction.trim(),
        },
      });

      if (error) throw new Error(error.message || 'Refinement failed');
      if (data?.error) throw new Error(data.error);
      if (!data?.content) throw new Error('No content returned');

      onContentUpdated(data.content);
      setInstruction('');
      toast.success('Document updated');
    } catch (err: any) {
      console.error('AI Edit error:', err);
      const msg = err?.message || 'Unknown error';
      if (msg.includes('429') || msg.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (msg.includes('402') || msg.includes('credits')) {
        toast.error('Usage limit reached. Please add credits to continue.');
      } else {
        toast.error(`Edit failed: ${msg}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const visiblePicks = showAllPicks ? QUICK_PICKS : QUICK_PICKS.slice(0, 6);

  return (
    <div className="border-t bg-muted/20">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors border-b border-dashed border-primary/20"
      >
        <Brain className="h-4 w-4" />
        ✨ AI Edit & Regenerate
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {isOpen && (
        <div className="px-4 sm:px-6 pb-4 space-y-3">
          {/* Quick Pick chips */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Quick adjustments</p>
            <div className="flex flex-wrap gap-1.5">
              {visiblePicks.map((pick) => (
                <button
                  key={pick.id}
                  onClick={() => handleQuickPick(pick.label)}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>{pick.icon}</span>
                  {pick.label}
                </button>
              ))}
            </div>
            {QUICK_PICKS.length > 6 && (
              <button
                onClick={() => setShowAllPicks(!showAllPicks)}
                className="text-xs text-primary hover:underline mt-1.5"
              >
                {showAllPicks ? 'Show fewer' : `+${QUICK_PICKS.length - 6} more`}
              </button>
            )}
          </div>

          {/* Instruction input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Type your edit instruction, e.g. 'Make it shorter and remove patient names'..."
                className="min-h-[60px] max-h-[120px] text-sm resize-none pr-10"
                disabled={isProcessing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>
          </div>

          {/* Voice + Submit row */}
          <div className="flex items-center gap-2">
            <AssemblyAISpeechToText
              onTranscription={handleVoiceTranscription}
              size="sm"
              inputRef={textareaRef}
            />
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !instruction.trim()}
              size="sm"
              className="ml-auto gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              {isProcessing ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
