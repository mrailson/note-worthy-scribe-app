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
  X 
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

export type ClinicalAIAction = 'regenerate' | 'clarify' | 'reduce' | 'expand' | 'clinical';

interface ClinicalInlineEditableLineProps {
  type: 'heading' | 'bullet' | 'paragraph' | 'label' | 'empty';
  content: string;
  htmlContent: string;
  index: number;
  sectionKey: string;
  onUpdate: (index: number, newContent: string) => void;
  onDelete: (index: number) => void;
  onAIAction: (index: number, action: ClinicalAIAction) => Promise<string>;
  disabled?: boolean;
  labelPrefix?: string;
}

const ClinicalInlineEditableLine: React.FC<ClinicalInlineEditableLineProps> = ({
  type,
  content,
  htmlContent,
  index,
  sectionKey,
  onUpdate,
  onDelete,
  onAIAction,
  disabled = false,
  labelPrefix,
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
      textareaRef.current.select();
      setTimeout(adjustTextareaHeight, 0);
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(content);
  }, [content]);

  const handleSave = () => {
    if (editValue.trim() !== content) {
      onUpdate(index, editValue.trim());
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleAIAction = async (action: ClinicalAIAction) => {
    setIsLoading(true);
    setLoadingAction(action);
    try {
      const result = await onAIAction(index, action);
      if (result && result !== content) {
        setEditValue(result);
        onUpdate(index, result);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const getLineStyles = () => {
    switch (type) {
      case 'label':
        return 'text-sm leading-relaxed';
      case 'bullet':
        return 'text-sm leading-relaxed';
      case 'paragraph':
      default:
        return 'text-sm leading-relaxed';
    }
  };

  // Skip empty lines
  if (type === 'empty') {
    return <div className="h-2" />;
  }

  if (isEditing) {
    return (
      <div className="relative group py-0.5">
        <div className="flex items-start gap-2">
          <div className="w-4 flex-shrink-0" />
          <div className="flex-1">
            {labelPrefix && (
              <span className="text-sm font-medium text-foreground mr-1">
                {labelPrefix}:
              </span>
            )}
            <Textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              className="min-h-[32px] resize-none text-sm overflow-hidden py-1 px-2"
              disabled={disabled}
            />
            <div className="flex items-center gap-2 mt-1.5">
              <Button size="sm" onClick={handleSave} className="h-6 px-2 text-xs" disabled={disabled}>
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-6 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative group flex items-start gap-0.5 py-0.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sleek grip icon with dropdown - almost hidden until needed */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-all cursor-pointer mt-0.5",
              "hover:bg-muted/60",
              isHovered || isLoading ? "opacity-30" : "opacity-0",
              "group-hover:opacity-30 hover:!opacity-100 focus:!opacity-100"
            )}
            disabled={isLoading || disabled}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(index)} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAIAction('regenerate')} disabled={isLoading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'regenerate' && "animate-spin")} />
            Regenerate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAIAction('clarify')} disabled={isLoading}>
            <Lightbulb className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'clarify' && "animate-spin")} />
            Clarify
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAIAction('reduce')} disabled={isLoading}>
            <Minus className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'reduce' && "animate-spin")} />
            Reduce Detail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAIAction('expand')} disabled={isLoading}>
            <Plus className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'expand' && "animate-spin")} />
            Expand Detail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAIAction('clinical')} disabled={isLoading}>
            <Stethoscope className={cn("h-3.5 w-3.5 mr-2", loadingAction === 'clinical' && "animate-spin")} />
            Make Clinical
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Content */}
      <div className="flex-1 min-w-0 relative">
        <div
          className={cn(getLineStyles(), "text-foreground")}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
        {justSaved && (
          <span className="absolute -right-1 top-0 text-xs text-emerald-600 flex items-center gap-0.5 animate-in fade-in duration-200">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
};

export default ClinicalInlineEditableLine;
