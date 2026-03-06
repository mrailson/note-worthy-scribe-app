import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Image, Download, Eye, BookOpen, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import type { SavedQuickGuide, QuickGuideAudience } from './QuickGuideDialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const audienceLabels: Record<QuickGuideAudience, string> = {
  'all-staff': 'All Staff',
  'non-clinical': 'Non-Clinical',
  'clinical': 'Clinical',
  'patient': 'Patient',
};

interface SavedGuidesPopoverProps {
  guides: SavedQuickGuide[];
  policyTitle: string;
  onDelete?: (guideId: string) => void;
}

export const SavedGuidesPopover: React.FC<SavedGuidesPopoverProps> = ({
  guides,
  policyTitle,
  onDelete,
}) => {
  const [previewGuide, setPreviewGuide] = useState<{ guide: SavedQuickGuide; content: string | null; blobUrl: string | null } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  if (guides.length === 0) return null;

  const handlePreview = async (guide: SavedQuickGuide) => {
    setIsPopoverOpen(false);
    setLoadingId(guide.id);
    try {
      const { data, error } = await supabase.storage
        .from('quick-guides')
        .download(guide.storagePath);

      if (error) throw error;

      if (guide.type === 'word') {
        const text = await data.text();
        setPreviewGuide({ guide, content: text, blobUrl: null });
      } else {
        const blobUrl = URL.createObjectURL(data);
        setPreviewGuide({ guide, content: null, blobUrl });
      }
    } catch (err) {
      console.error('Failed to load guide:', err);
      toast.error('Failed to load quick guide');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDownload = async (guide: SavedQuickGuide) => {
    setLoadingId(guide.id);
    try {
      const { data, error } = await supabase.storage
        .from('quick-guides')
        .download(guide.storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = guide.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Quick guide downloaded');
    } catch (err) {
      console.error('Failed to download guide:', err);
      toast.error('Failed to download quick guide');
    } finally {
      setLoadingId(null);
    }
  };

  const closePreview = () => {
    if (previewGuide?.blobUrl) {
      URL.revokeObjectURL(previewGuide.blobUrl);
    }
    setPreviewGuide(null);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 relative" title="Saved Quick Guides">
            <BookOpen className="h-4 w-4" />
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">
              {guides.length}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="px-4 py-3 border-b">
            <h4 className="text-sm font-semibold">Saved Quick Guides</h4>
            <p className="text-xs text-muted-foreground">{guides.length} guide{guides.length !== 1 ? 's' : ''} saved</p>
          </div>
          <ScrollArea className="max-h-64">
            <div className="p-2 space-y-1">
              {guides.map((guide) => (
                <div
                  key={guide.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
                >
                  {guide.type === 'word' ? (
                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  ) : (
                    <Image className="h-4 w-4 text-green-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {guide.type === 'word' ? 'Word' : 'Infographic'} — {audienceLabels[guide.audience] || guide.audience}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(guide.generatedAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {loadingId === guide.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <button
                          onClick={() => handlePreview(guide)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownload(guide)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {onDelete && (
                          <button
                            onClick={() => onDelete(guide.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Preview Dialog */}
      {previewGuide && (
        <Dialog open={!!previewGuide} onOpenChange={(open) => { if (!open) closePreview(); }}>
          <DialogContent className={previewGuide.guide.type === 'infographic' ? 'sm:max-w-4xl max-h-[90vh]' : 'sm:max-w-3xl max-h-[90vh]'}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {previewGuide.guide.type === 'word' ? (
                  <FileText className="h-5 w-5 text-primary" />
                ) : (
                  <Image className="h-5 w-5 text-primary" />
                )}
                Quick Guide — {previewGuide.guide.type === 'word' ? 'Document' : 'Infographic'}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{audienceLabels[previewGuide.guide.audience]}</Badge>
                <span className="text-muted-foreground">•</span>
                <span>{policyTitle}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs">{format(parseISO(previewGuide.guide.generatedAt), 'dd/MM/yyyy HH:mm')}</span>
              </DialogDescription>
            </DialogHeader>

            {previewGuide.content ? (
              <ScrollArea className="max-h-[60vh]">
                <div className="flex justify-center px-2 py-4 bg-muted/30">
                  <div className="w-full max-w-[680px] bg-white dark:bg-slate-50 shadow-[0_2px_20px_rgba(0,0,0,0.08)] rounded-sm border border-border/40">
                    <div className="px-10 pt-8 pb-4 border-b border-blue-100">
                      <h1 className="text-[18px] font-bold text-[#005EB8] leading-tight mb-1">
                        Quick Guide: {policyTitle}
                      </h1>
                      <p className="text-[12px] text-[#6B7280]">
                        For {audienceLabels[previewGuide.guide.audience]}
                      </p>
                    </div>
                    <div className="px-10 py-6">
                      <div className="
                        prose prose-sm max-w-none
                        text-[#374151]
                        [&_h1]:text-[16px] [&_h1]:font-bold [&_h1]:text-[#2563EB] [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:uppercase [&_h1]:tracking-wide
                        [&_h2]:text-[14px] [&_h2]:font-bold [&_h2]:text-[#2563EB] [&_h2]:mt-4 [&_h2]:mb-2
                        [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-[#2563EB] [&_h3]:mt-3 [&_h3]:mb-1
                        [&_p]:text-[12px] [&_p]:leading-relaxed [&_p]:mb-2 [&_p]:text-[#374151]
                        [&_ul]:text-[12px] [&_ul]:pl-5 [&_ul]:mb-2 [&_ul]:space-y-0.5
                        [&_ol]:text-[12px] [&_ol]:pl-5 [&_ol]:mb-2 [&_ol]:space-y-0.5
                        [&_li]:text-[#374151] [&_li]:leading-relaxed
                        [&_strong]:text-[#1e3a5f]
                        [&_table]:text-[11px] [&_table]:w-full [&_table]:border-collapse
                        [&_th]:bg-[#2563EB] [&_th]:text-white [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold
                        [&_td]:border [&_td]:border-[#e5e7eb] [&_td]:px-2 [&_td]:py-1
                        [&_tr:nth-child(even)_td]:bg-[#f9fafb]
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewGuide.content}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="px-10 py-3 border-t border-[#e5e7eb] bg-[#f8fafc]">
                      <p className="text-[10px] text-[#94a3b8] italic">
                        For more details, see the Practice Policy on "{policyTitle}". Generated by NoteWell AI.
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : previewGuide.blobUrl ? (
              <div className="flex justify-center bg-muted/30 rounded-md overflow-hidden max-h-[60vh] p-4">
                <img
                  src={previewGuide.blobUrl}
                  alt="Quick Guide Infographic"
                  className="max-h-[55vh] object-contain rounded shadow-md"
                />
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => handleDownload(previewGuide.guide)}>
                <Download className="h-4 w-4 mr-1" />
                Download {previewGuide.guide.type === 'word' ? '.md' : '.png'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
