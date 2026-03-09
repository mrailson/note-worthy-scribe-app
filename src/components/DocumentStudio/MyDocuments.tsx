import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Calendar, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocumentPreviewModal } from '@/components/shared/DocumentPreviewModal';
import { useGammaPowerPoint } from '@/hooks/useGammaPowerPoint';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SavedDocument {
  id: string;
  title: string;
  document_type: string;
  content: string;
  version_label: string;
  status: string;
  created_at: string;
}

export const MyDocuments: React.FC = () => {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<SavedDocument | null>(null);
  const { generateWithGamma } = useGammaPowerPoint();

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase
        .from('document_studio_documents' as any)
        .select('id, title, document_type, content, version_label, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setDocuments((data as SavedDocument[]) || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase
        .from('document_studio_documents' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">No saved documents yet</p>
        <p className="text-xs text-muted-foreground mt-1">Generated documents will appear here when saved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map(doc => (
        <button
          key={doc.id}
          onClick={() => setPreviewDoc(doc)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border hover:border-primary/50 hover:bg-accent/30 transition-all text-left"
        >
          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">{doc.title}</span>
              <Badge variant="secondary" className="text-[10px] flex-shrink-0">{doc.version_label}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {format(new Date(doc.created_at), 'd MMMM yyyy, HH:mm')}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </button>
      ))}

      {previewDoc && (
        <DocumentPreviewModal
          content={previewDoc.content}
          title={previewDoc.title}
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          onExportPowerPoint={(content, title, slideCount) => {
            generateWithGamma(content, title, true, slideCount || 4).catch((err) => {
              console.error('PowerPoint generation failed:', err);
            });
          }}
        />
      )}
    </div>
  );
};
