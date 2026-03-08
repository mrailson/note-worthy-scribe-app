import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Loader2, RefreshCw, PenLine, Save, Download, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { DocumentPreviewModal } from '@/components/shared/DocumentPreviewModal';
import { DocumentAIEditPanel } from '@/components/shared/DocumentAIEditPanel';
import { toast } from 'sonner';
import { FileProcessorManager } from '@/utils/fileProcessors/FileProcessorManager';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DocumentStudioState } from './DocumentStudioModal';

interface StepGenerateProps {
  state: DocumentStudioState;
  onUpdateState: (updates: Partial<DocumentStudioState>) => void;
  onEditAndRegenerate: () => void;
  onReset: () => void;
}

export const StepGenerate: React.FC<StepGenerateProps> = ({
  state,
  onUpdateState,
  onEditAndRegenerate,
  onReset,
}) => {
  const { practiceContext, practiceDetails } = usePracticeContext();
  const [showPreview, setShowPreview] = useState(false);
  const [showAIEdit, setShowAIEdit] = useState(false);
  const [progress, setProgress] = useState(0);

  const processUploadedFiles = async (): Promise<string[]> => {
    const contents: string[] = [];
    for (const file of state.uploadedFiles) {
      try {
        if (FileProcessorManager.isSupported(file.name)) {
          const processed = await FileProcessorManager.processFile(file);
          contents.push(`--- File: ${processed.name} ---\n${processed.content}`);
        }
      } catch (err) {
        console.warn(`Could not process file: ${file.name}`, err);
      }
    }
    return contents;
  };

  const handleGenerate = useCallback(async () => {
    onUpdateState({ isGenerating: true, generatedContent: null, generatedTitle: null });
    setProgress(0);
    
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 90));
    }, 500);

    try {
      // Process uploaded files
      const fileContents = await processUploadedFiles();

      // Build the request
      const body: Record<string, unknown> = {
        action: 'generate_document',
        documentType: state.selectedType?.type_key || 'custom',
        documentTypeName: state.selectedType?.display_name || 'Custom Document',
        systemPrompt: state.selectedType?.system_prompt_template || '',
        freeFormRequest: state.freeFormRequest,
        clarifyingAnswers: state.clarifyingAnswers,
        supportingText: state.supportingText,
        fileContents,
        harmTriageResult: state.harmTriageResult,
        practiceContext: {
          practiceName: practiceContext.practiceName || practiceDetails?.practice_name,
          practiceAddress: practiceContext.practiceAddress || practiceDetails?.address,
          practicePhone: practiceContext.practicePhone || practiceDetails?.phone,
          practiceEmail: practiceContext.practiceEmail || practiceDetails?.email,
          practiceWebsite: practiceContext.practiceWebsite || practiceDetails?.website,
          userName: practiceContext.userFullName,
          userRole: practiceContext.userRole,
          letterSignature: practiceContext.letterSignature,
          emailSignature: practiceContext.emailSignature,
        },
      };

      const { data, error } = await supabase.functions.invoke('generate-document-studio', {
        body,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Edge function call failed');
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      if (!data?.content) throw new Error('No content returned from AI');

      const docTitle = data.title || state.selectedType?.display_name || state.freeFormRequest || 'Document';

      onUpdateState({
        generatedContent: data.content,
        generatedTitle: docTitle,
        isGenerating: false,
      });
      
      toast.success('Document generated successfully');
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Generation error:', err);
      const message = err?.message || 'Unknown error';
      if (message.includes('Rate limit') || message.includes('429')) {
        toast.error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (message.includes('402') || message.includes('credits')) {
        toast.error('Usage limit reached. Please add credits to continue.');
      } else {
        toast.error(`Document generation failed: ${message}`);
      }
      onUpdateState({ isGenerating: false });
    }
  }, [state, onUpdateState, practiceContext, practiceDetails]);

  const handleRegenerate = useCallback(async () => {
    const newVersion = state.version + 1;
    const minor = newVersion > 1 ? newVersion - 1 : 0;
    onUpdateState({
      version: newVersion,
      versionLabel: `v1.${minor}`,
    });
    await handleGenerate();
  }, [state.version, onUpdateState, handleGenerate]);

  const handleSave = useCallback(async () => {
    if (!state.generatedContent) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to save documents');
        return;
      }

      const title = state.generatedTitle || state.selectedType?.display_name || state.freeFormRequest || 'Untitled Document';

      const { error } = await supabase
        .from('document_studio_documents' as any)
        .insert({
          user_id: user.id,
          document_type: state.selectedType?.type_key || 'custom',
          title,
          content: state.generatedContent,
          version: state.version,
          version_label: state.versionLabel,
          inputs_json: {
            freeFormRequest: state.freeFormRequest,
            supportingText: state.supportingText,
          },
          clarifying_answers_json: state.clarifyingAnswers,
          status: 'draft',
        });

      if (error) throw error;
      toast.success('Document saved to My Documents');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save document');
    }
  }, [state]);

  // Auto-generate on mount if no content yet
  useEffect(() => {
    if (!state.generatedContent && !state.isGenerating) {
      handleGenerate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open the preview modal as soon as content is ready
  useEffect(() => {
    if (state.generatedContent && !state.isGenerating) {
      setShowPreview(true);
    }
  }, [state.generatedContent, state.isGenerating]);

  // Loading state
  if (state.isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">
          Generating your {state.selectedType?.display_name || 'document'}...
        </p>
        <div className="w-64">
          <Progress value={progress} className="h-2" />
        </div>
        <p className="text-xs text-muted-foreground">This may take a moment</p>
      </div>
    );
  }

  // Result
  if (state.generatedContent) {
    return (
      <div className="space-y-4">
        {/* Document info bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">
              {state.generatedTitle || state.selectedType?.display_name || 'Document'}
            </span>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {state.versionLabel}
            </Badge>
          </div>
        </div>

        {/* Preview area - shows first ~500 chars */}
        <div
          className="bg-white dark:bg-card border rounded-xl p-6 max-h-[45vh] overflow-y-auto cursor-pointer hover:border-primary/50 transition-colors shadow-sm"
          onClick={() => setShowPreview(true)}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-primary [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-primary [&_h3]:mb-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-foreground [&_h4]:mb-1 [&_p]:text-foreground [&_p]:leading-relaxed [&_p]:mb-3 [&_strong]:text-foreground [&_li]:text-foreground [&_ul]:my-2 [&_ol]:my-2 [&_table]:w-full [&_th]:bg-primary/10 [&_th]:p-2 [&_th]:text-left [&_td]:p-2 [&_td]:border-b">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {state.generatedContent.slice(0, 3000)}
            </ReactMarkdown>
            {state.generatedContent.length > 3000 && (
              <p className="text-xs text-primary font-medium mt-3 border-t pt-2">Click to view full document...</p>
            )}
          </div>
        </div>

        {/* AI Edit Panel — inline on generate tab */}
        <div className="border rounded-xl overflow-hidden">
          <DocumentAIEditPanel
            content={state.generatedContent}
            title={state.generatedTitle || state.selectedType?.display_name || 'Document'}
            onContentUpdated={(newContent) => onUpdateState({ generatedContent: newContent })}
            isOpen={showAIEdit}
            onToggle={() => setShowAIEdit(v => !v)}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowPreview(true)}>
            <Download className="h-4 w-4 mr-2" />
            View & Download
          </Button>
          <Button variant="outline" onClick={handleRegenerate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          <Button variant="outline" onClick={onEditAndRegenerate}>
            <PenLine className="h-4 w-4 mr-2" />
            Edit & Regenerate
          </Button>
          <Button variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save to My Documents
          </Button>
        </div>


        {/* Document Preview Modal */}
        <DocumentPreviewModal
          content={state.generatedContent}
          title={state.generatedTitle || state.selectedType?.display_name || 'Document'}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onContentUpdated={(newContent) => onUpdateState({ generatedContent: newContent })}
        />
      </div>
    );
  }

  // Fallback — shouldn't normally show
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Button onClick={handleGenerate}>
        <Sparkles className="h-4 w-4 mr-2" />
        Generate Document
      </Button>
    </div>
  );
};
