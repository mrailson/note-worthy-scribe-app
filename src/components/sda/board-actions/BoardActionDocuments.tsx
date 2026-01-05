import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, Loader2 } from "lucide-react";
import { useBoardActionDocuments } from "@/hooks/useBoardActionDocuments";
import type { BoardActionDocument } from "@/types/boardMembers";

interface BoardActionDocumentsProps {
  actionId?: string;
  pendingFiles?: File[];
  onRemovePendingFile?: (index: number) => void;
}

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType: string | null) => {
  return <FileText className="h-4 w-4 text-muted-foreground" />;
};

export const BoardActionDocuments = ({
  actionId,
  pendingFiles = [],
  onRemovePendingFile,
}: BoardActionDocumentsProps) => {
  const { documents, deleteDocument, getDocumentUrl } = useBoardActionDocuments(actionId);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (doc: BoardActionDocument) => {
    setDownloading(doc.id);
    try {
      const url = await getDocumentUrl(doc.file_path);
      if (url) {
        window.open(url, "_blank");
      }
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (doc: BoardActionDocument) => {
    if (confirm(`Delete "${doc.file_name}"?`)) {
      await deleteDocument.mutateAsync(doc);
    }
  };

  const allFiles = [
    ...pendingFiles.map((file, index) => ({
      id: `pending-${index}`,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      isPending: true,
      index,
    })),
    ...documents.map((doc) => ({ ...doc, isPending: false })),
  ];

  if (allFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {allFiles.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 p-2 rounded-md bg-muted/50 border"
        >
          {getFileIcon(file.mime_type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.file_size)}
              {file.isPending && " • Pending upload"}
            </p>
          </div>
          <div className="flex gap-1">
            {!file.isPending && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleDownload(file as BoardActionDocument)}
                disabled={downloading === file.id}
              >
                {downloading === file.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (file.isPending && onRemovePendingFile) {
                  onRemovePendingFile((file as any).index);
                } else {
                  handleDelete(file as BoardActionDocument);
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
