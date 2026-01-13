import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, Pencil, Trash2, RefreshCw, Quote, MessageSquare, Minus, Plus, Building2, ListChecks, Loader2, Check, X } from 'lucide-react';
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

export type AILineAction = 'regenerate' | 'check_tone' | 'reduce' | 'expand' | 'formalise';

interface InlineEditableLineProps {
  type: 'heading' | 'bullet' | 'numbered' | 'paragraph';
  content: string;
  htmlContent: string;
  level?: 1 | 2 | 3;
  index: number;
  sectionId: string;
  fontSize: number;
  onUpdate: (index: number, newContent: string) => void;
  onDelete: (index: number) => void;
  onAIAction: (index: number, action: AILineAction) => Promise<string>;
}

const InlineEditableLine: React.FC<InlineEditableLineProps> = ({
  type,
  content,
  htmlContent,
  level = 2,
  index,
  sectionId,
  fontSize,
  onUpdate,
  onDelete,
  onAIAction,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

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

  const handleRemoveQuotes = () => {
    const cleaned = content
      .replace(/[""]/g, '')
      .replace(/["']/g, '')
      .trim();
    onUpdate(index, cleaned);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleAIAction = async (action: AILineAction) => {
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
      case 'heading':
        if (level === 1) return 'text-xl font-bold text-primary';
        if (level === 2) return 'text-lg font-semibold text-primary';
        return 'text-base font-semibold text-foreground';
      case 'bullet':
      case 'numbered':
        return 'text-muted-foreground leading-relaxed';
      default:
        return 'text-muted-foreground leading-relaxed';
    }
  };

  if (isEditing) {
    return (
      <div className="relative group">
        <div className="flex items-start gap-2">
          <div className="w-5 flex-shrink-0" />
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] resize-none text-sm"
              style={{ fontSize: `${fontSize}px` }}
            />
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" onClick={handleSave} className="h-7 px-3">
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 px-3">
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
      className="relative group flex items-start gap-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Grip icon with dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted/50 transition-all cursor-pointer mt-0.5",
              isHovered || isLoading ? "opacity-40" : "opacity-0",
              "group-hover:opacity-40 hover:!opacity-100"
            )}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(index)} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAIAction('regenerate')} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loadingAction === 'regenerate' && "animate-spin")} />
            Regenerate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleRemoveQuotes}>
            <Quote className="h-4 w-4 mr-2" />
            Remove Quotes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAIAction('check_tone')} disabled={isLoading}>
            <MessageSquare className={cn("h-4 w-4 mr-2", loadingAction === 'check_tone' && "animate-spin")} />
            Check Tone
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAIAction('reduce')} disabled={isLoading}>
            <Minus className={cn("h-4 w-4 mr-2", loadingAction === 'reduce' && "animate-spin")} />
            Reduce Detail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAIAction('expand')} disabled={isLoading}>
            <Plus className={cn("h-4 w-4 mr-2", loadingAction === 'expand' && "animate-spin")} />
            Expand Detail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAIAction('formalise')} disabled={isLoading}>
            <Building2 className={cn("h-4 w-4 mr-2", loadingAction === 'formalise' && "animate-spin")} />
            Make Formal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(getLineStyles(), "relative")}
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
        {justSaved && (
          <span className="absolute -right-2 top-0 text-xs text-emerald-600 flex items-center gap-0.5">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
};

export default InlineEditableLine;
