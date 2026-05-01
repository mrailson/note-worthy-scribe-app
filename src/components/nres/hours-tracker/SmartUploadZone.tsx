import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Image, FileText, Loader2, X, CheckCircle2, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Module-level active zone tracker — only one zone responds to Ctrl+V
let activeZoneId: string | null = null;
let idCounter = 0;

interface SmartUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  uploading: boolean;
  accept?: string;
  multiple?: boolean;
  compact?: boolean;
}

export function SmartUploadZone({ onFilesSelected, uploading, accept, multiple = true, compact = false }: SmartUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const instanceId = useRef(`suz-${++idCounter}`);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pastedThumbnailUrl, setPastedThumbnailUrl] = useState<string | null>(null);
  const [pasteFlash, setPasteFlash] = useState(false);

  const activate = useCallback(() => {
    activeZoneId = instanceId.current;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (multiple && !compact) {
        setPendingFiles(prev => [...prev, ...files]);
      } else {
        onFilesSelected(multiple ? files : [files[0]]);
      }
    }
  }, [multiple, compact, onFilesSelected]);

  // Clipboard paste handler — scoped to active zone only
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeZoneId !== instanceId.current) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            const ext = file.type.split('/')[1] || 'png';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const renamedFile = new File([file], `pasted-screenshot-${timestamp}.${ext}`, { type: file.type });
            files.push(renamedFile);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        if (compact) {
          const firstFile = files[0];
          onFilesSelected(multiple ? files : [firstFile]);
          // Show thumbnail for images
          if (firstFile.type.startsWith('image/')) {
            const url = URL.createObjectURL(firstFile);
            setPastedThumbnailUrl(url);
            setPasteFlash(true);
            setTimeout(() => {
              setPasteFlash(false);
              setPastedThumbnailUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
            }, 4000);
          } else {
            setPasteFlash(true);
            setTimeout(() => setPasteFlash(false), 4000);
          }
        } else if (multiple) {
          setPendingFiles(prev => [...prev, ...files]);
        } else {
          onFilesSelected([files[0]]);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [multiple, compact, onFilesSelected]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (multiple && !compact) {
        setPendingFiles(prev => [...prev, ...files]);
      } else {
        onFilesSelected(multiple ? files : [files[0]]);
      }
    }
    e.target.value = '';
  };

  const removePending = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAll = () => {
    if (pendingFiles.length > 0) {
      onFilesSelected(pendingFiles);
      setPendingFiles([]);
    }
  };

  // Read clipboard via Async Clipboard API — works without prior Ctrl+V
  const handlePasteButton = useCallback(async () => {
    activate();
    try {
      if (!navigator.clipboard?.read) {
        toast.info('Press Ctrl+V to paste your screenshot');
        return;
      }
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/') || type === 'application/pdf') {
            const blob = await item.getType(type);
            const ext = type.split('/')[1] || 'png';
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            files.push(new File([blob], `pasted-${ts}.${ext}`, { type }));
            break;
          }
        }
      }
      if (files.length === 0) {
        toast.info('No image found in clipboard. Copy a screenshot first, then click Paste.');
        return;
      }
      if (compact) {
        onFilesSelected(multiple ? files : [files[0]]);
        const first = files[0];
        if (first.type.startsWith('image/')) {
          const url = URL.createObjectURL(first);
          setPastedThumbnailUrl(url);
        }
        setPasteFlash(true);
        setTimeout(() => {
          setPasteFlash(false);
          setPastedThumbnailUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        }, 4000);
      } else if (multiple) {
        setPendingFiles(prev => [...prev, ...files]);
      } else {
        onFilesSelected([files[0]]);
      }
    } catch (err) {
      console.error('Clipboard read failed', err);
      toast.error('Could not read clipboard. Try Ctrl+V instead.');
    }
  }, [activate, compact, multiple, onFilesSelected]);

  if (compact) {
    return (
      <div
        className="flex items-center gap-2"
        onClick={activate}
        onMouseEnter={activate}
        onFocus={activate}
        tabIndex={0}
        role="button"
      >
        <input ref={fileInputRef} type="file" className="hidden" accept={accept} multiple={multiple} onChange={handleFileChange} />
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
          Upload
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={uploading} onClick={handlePasteButton} title="Paste image from clipboard">
          <Clipboard className="w-3 h-3 mr-1" />
          Paste
        </Button>
        {pasteFlash ? (
          <span className="text-[10px] text-green-600 font-medium flex items-center gap-1 animate-in fade-in">
            {pastedThumbnailUrl && (
              <img src={pastedThumbnailUrl} alt="Pasted preview" className="w-8 h-8 rounded border border-border object-cover" />
            )}
            <CheckCircle2 className="w-3 h-3" /> Screenshot pasted!
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">or Ctrl+V</span>
        )}
      </div>
    );
  }

  return (
    <div ref={dropZoneRef} onClick={activate} onFocus={activate}>
      <input ref={fileInputRef} type="file" className="hidden" accept={accept || '.pdf,.doc,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.gif'} multiple={multiple} onChange={handleFileChange} />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <div className="flex flex-col items-center gap-1.5">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-muted-foreground" />
          )}
          <p className="text-xs text-muted-foreground">
            Click to browse, drag &amp; drop files, or <strong>Ctrl+V</strong> to paste screenshots
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            PDF, PNG, JPG, DOCX, XLSX — multiple files accepted
          </p>
        </div>
      </div>

      {pendingFiles.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} ready to upload:
          </p>
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/50">
              <div className="flex items-center gap-1.5 min-w-0">
                {f.type.startsWith('image/') ? <Image className="w-3 h-3 text-muted-foreground shrink-0" /> : <FileText className="w-3 h-3 text-muted-foreground shrink-0" />}
                <span className="truncate">{f.name}</span>
                <span className="text-muted-foreground shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removePending(i); }} className="text-muted-foreground hover:text-destructive ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <Button size="sm" className="w-full text-xs gap-1" disabled={uploading} onClick={uploadAll}>
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}
