import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, GitBranch, Mail, FileCheck2, Sparkles, Wand2 } from 'lucide-react';
import RichTextEditor, { type EditorCommands } from '@/components/RichTextEditor';
import { cn } from '@/lib/utils';

export type LetterType = 'acknowledgement' | 'outcome';

interface Props {
  letterType: LetterType;
  onLetterTypeChange: (t: LetterType) => void;
  body: string;
  onBodyChange: (value: string) => void;
  saving: boolean;
  lastSavedAt: Date | null;
  onSaveDraft: () => void;
  onGenerateVersion: () => void;
  onEditorReady?: (cmds: EditorCommands) => void;
  onAiGenerate?: () => void;
  onAiRewriteSelection?: () => void;
  aiLoading?: boolean;
}

export const LetterEditor: React.FC<Props> = ({
  letterType,
  onLetterTypeChange,
  body,
  onBodyChange,
  saving,
  lastSavedAt,
  onSaveDraft,
  onGenerateVersion,
  onEditorReady,
  onAiGenerate,
  onAiRewriteSelection,
  aiLoading,
}) => {
  const text = useMemo(() => body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), [body]);
  const wordCount = text ? text.split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onLetterTypeChange('acknowledgement')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-md border-2 px-4 py-3 text-sm font-medium transition',
              letterType === 'acknowledgement'
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            <Mail className="h-4 w-4" />
            Acknowledgement
          </button>
          <button
            type="button"
            onClick={() => onLetterTypeChange('outcome')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-md border-2 px-4 py-3 text-sm font-medium transition',
              letterType === 'outcome'
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            <FileCheck2 className="h-4 w-4" />
            Outcome
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 pt-2">
        <div className="flex-1 min-h-[360px] border rounded-md overflow-hidden">
          <RichTextEditor
            content={body}
            onChange={onBodyChange}
            placeholder={`Draft your ${letterType} letter…`}
            onReady={onEditorReady}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline">{wordCount} words</Badge>
            <Badge variant="outline">{charCount} chars</Badge>
            <span className="hidden sm:inline">
              {saving ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </span>
              ) : lastSavedAt ? (
                <>Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
              ) : (
                'Not saved yet'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSaveDraft} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save draft
            </Button>
            <Button size="sm" onClick={onGenerateVersion} disabled={saving || !body.trim()}>
              <GitBranch className="h-3.5 w-3.5 mr-1" /> Generate version
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LetterEditor;
