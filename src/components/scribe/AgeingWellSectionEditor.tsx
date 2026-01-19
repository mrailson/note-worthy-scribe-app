import React, { useState, useRef, useEffect } from 'react';
import { 
  GripVertical, 
  Pencil, 
  Trash2, 
  RefreshCw, 
  Lightbulb, 
  Minus, 
  Plus, 
  Stethoscope, 
  Loader2, 
  Check, 
  X,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type ClinicalAIAction = 'regenerate' | 'clarify' | 'reduce' | 'expand' | 'clinical';

interface AgeingWellSectionEditorProps {
  sectionKey: string;
  sectionTitle: string;
  content: string;
  colorClass: string;
  borderClass: string;
  description: string;
  editable: boolean;
  onUpdate: (newContent: string) => void;
  onDelete: () => void;
  onAIAction: (action: ClinicalAIAction) => Promise<string>;
  onCopy: () => void;
  isCopied: boolean;
  disabled?: boolean;
}

const AgeingWellSectionEditor: React.FC<AgeingWellSectionEditorProps> = ({
  sectionKey,
  sectionTitle,
  content,
  colorClass,
  borderClass,
  description,
  editable,
  onUpdate,
  onDelete,
  onAIAction,
  onCopy,
  isCopied,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(adjustTextareaHeight, 0);
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(content);
  }, [content]);

  const handleSave = () => {
    if (editValue.trim() !== content) {
      onUpdate(editValue.trim());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
    // Ctrl/Cmd + Enter to save
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleAIAction = async (action: ClinicalAIAction) => {
    setIsLoading(true);
    setLoadingAction(action);
    try {
      const result = await onAIAction(action);
      if (result && result !== content) {
        setEditValue(result);
        onUpdate(result);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } catch (error) {
      console.error('AI action failed:', error);
      toast.error('AI action failed. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleDelete = () => {
    onDelete();
    toast.success(`${sectionTitle} section cleared`);
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all relative group",
        borderClass
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2 py-1 rounded text-xs font-semibold",
            colorClass
          )}>
            {sectionTitle}
          </span>
          {justSaved && (
            <span className="text-xs text-emerald-600 flex items-center gap-0.5 animate-in fade-in duration-200">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-7 px-2"
              >
                <X className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                className="h-7 px-2 text-green-600"
              >
                <Check className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              {/* Six-dots dropdown menu */}
              {editable && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-all cursor-pointer",
                        "hover:bg-muted/60",
                        isHovered || isLoading ? "opacity-40" : "opacity-0",
                        "group-hover:opacity-40 hover:!opacity-100 focus:!opacity-100"
                      )}
                      disabled={isLoading || disabled}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Clear Section
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleAIAction('regenerate')} disabled={isLoading || !content}>
                      <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'regenerate' && "animate-spin")} />
                      Regenerate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAIAction('clarify')} disabled={isLoading || !content}>
                      <Lightbulb className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'clarify' && "animate-spin")} />
                      Clarify
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleAIAction('reduce')} disabled={isLoading || !content}>
                      <Minus className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'reduce' && "animate-spin")} />
                      Reduce Detail
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAIAction('expand')} disabled={isLoading || !content}>
                      <Plus className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'expand' && "animate-spin")} />
                      Expand Detail
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAIAction('clinical')} disabled={isLoading || !content}>
                      <Stethoscope className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'clinical' && "animate-spin")} />
                      Make Clinical
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Copy button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                className="h-7 px-2"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      
      {isEditing ? (
        <div>
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            className="min-h-[100px] text-sm resize-none"
            placeholder={description}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Press Ctrl+Enter to save, Escape to cancel
          </p>
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
          {content ? content.replace(/\*\*/g, '').replace(/\*/g, '') : (
            <span className="text-muted-foreground italic">
              {description}
            </span>
          )}
        </p>
      )}
    </div>
  );
};

export default AgeingWellSectionEditor;
