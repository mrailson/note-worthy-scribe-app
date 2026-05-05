import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Download, Loader2, FileQuestion, Paperclip, Upload, Trash2, Image as ImageIcon, Clipboard } from 'lucide-react';
import { useNRESTimeEntryAttachments, type TimeEntryAttachment } from '@/hooks/useNRESTimeEntryAttachments';
import { toast } from 'sonner';

type Kind = 'image' | 'pdf' | 'office' | 'other';

function classify(file: TimeEntryAttachment): Kind {
  const name = (file.file_name || '').toLowerCase();
  const mime = (file.file_type || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop()! : '';
  if (mime.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['doc','docx','xls','xlsx','csv','ppt','pptx'].includes(ext)) return 'office';
  return 'other';
}

function formatSize(b: number | null): string {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  open: boolean;
  entryId: string | null;
  entryLabel?: string;
  onClose: () => void;
}

export function TimeEntryAttachmentsModal({ open, entryId, entryLabel, onClose }: Props) {
  const { files, loading, uploading, uploadFile, deleteFile, getSignedUrl } = useNRESTimeEntryAttachments(entryId || undefined);
  const [index, setIndex] = useState(0);
  const [urlCache, setUrlCache] = useState<Map<string, string>>(new Map());
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setIndex(0); }, [open, entryId]);

  const current = files[index];
  const total = files.length;

  const ensureUrl = useCallback(async (f: TimeEntryAttachment) => {
    if (urlCache.has(f.id)) return urlCache.get(f.id)!;
    setPreviewLoading(true);
    const url = await getSignedUrl(f.file_path);
    setPreviewLoading(false);
    if (url) {
      setUrlCache(prev => { const m = new Map(prev); m.set(f.id, url); return m; });
    }
    return url;
  }, [urlCache, getSignedUrl]);

  useEffect(() => {
    if (open && current) ensureUrl(current);
  }, [open, current, ensureUrl]);

  // Paste handler (Ctrl+V) when modal is open
  useEffect(() => {
    if (!open || !entryId) return;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const fileList: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) {
            // Give pasted screenshots a friendly name
            const ext = (f.type.split('/')[1] || 'png');
            const named = f.name && f.name !== 'image.png'
              ? f
              : new File([f], `screenshot-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`, { type: f.type });
            fileList.push(named);
          }
        }
      }
      if (fileList.length > 0) {
        e.preventDefault();
        for (const f of fileList) {
          const r = await uploadFile(f);
          if (r) toast.success(`Pasted ${r.file_name}`);
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, entryId, uploadFile]);

  const handleFiles = async (selected: FileList | File[]) => {
    const arr = Array.from(selected);
    for (const f of arr) {
      const r = await uploadFile(f);
      if (r) toast.success(`Uploaded ${r.file_name}`);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handleDownload = async () => {
    if (!current) return;
    const url = await ensureUrl(current);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const goPrev = () => setIndex(i => Math.max(0, i - 1));
  const goNext = () => setIndex(i => Math.min(total - 1, i + 1));

  if (!entryId) return null;

  const cachedUrl = current ? urlCache.get(current.id) : undefined;
  const kind = current ? classify(current) : 'other';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[94vw] h-[88vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-2.5 border-b bg-slate-50 shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-emerald-600" />
            Attachments {entryLabel ? <span className="text-sm font-normal text-slate-500">— {entryLabel}</span> : null}
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0">
          <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
            Upload files
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clipboard className="w-3 h-3" /> Tip: Ctrl+V to paste a screenshot
          </span>
          <div className="ml-auto text-xs text-slate-500">{total} {total === 1 ? 'file' : 'files'}</div>
        </div>

        {/* Body: viewer + thumbs/dropzone */}
        <div className="flex-1 min-h-0 flex">
          {/* Viewer */}
          <div
            ref={dropZoneRef}
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            className="relative flex-1 min-w-0 bg-slate-100 flex items-center justify-center"
          >
            {total === 0 && (
              <div className="text-center px-6">
                <ImageIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">No attachments yet</p>
                <p className="text-xs text-slate-500 mt-1">Drag & drop files here, click <strong>Upload files</strong>, or paste a screenshot with Ctrl+V.</p>
              </div>
            )}

            {total > 0 && (
              <>
                <button type="button" onClick={goPrev} disabled={index === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 shadow-md border flex items-center justify-center disabled:opacity-30">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button type="button" onClick={goNext} disabled={index === total - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 shadow-md border flex items-center justify-center disabled:opacity-30">
                  <ChevronRight className="w-5 h-5" />
                </button>

                {(loading || previewLoading) && !cachedUrl && (
                  <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
                    <Loader2 className="w-6 h-6 animate-spin" /> Loading…
                  </div>
                )}

                {cachedUrl && kind === 'image' && (
                  <img src={cachedUrl} alt={current!.file_name} className="max-w-full max-h-full object-contain" />
                )}
                {cachedUrl && kind === 'pdf' && (
                  <iframe key={current!.id} src={cachedUrl} title={current!.file_name} className="w-full h-full bg-white" />
                )}
                {cachedUrl && kind === 'office' && (
                  <iframe key={current!.id} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(cachedUrl)}`} className="w-full h-full bg-white" />
                )}
                {cachedUrl && kind === 'other' && (
                  <div className="flex flex-col items-center gap-3 text-center px-6">
                    <FileQuestion className="w-10 h-10 text-slate-400" />
                    <p className="text-sm font-medium">No inline preview available</p>
                    <Button size="sm" onClick={handleDownload}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right rail - file list */}
          <div className="w-64 border-l bg-white overflow-y-auto shrink-0">
            <ul className="divide-y">
              {files.map((f, i) => {
                const active = i === index;
                return (
                  <li key={f.id} className={`p-2 flex items-center gap-2 cursor-pointer ${active ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    onClick={() => setIndex(i)}>
                    <Badge variant="outline" className="text-[9px] uppercase shrink-0">
                      {classify(f)}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" title={f.file_name}>{f.file_name}</div>
                      <div className="text-[10px] text-slate-500">{formatSize(f.file_size)}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }}
                      className="text-slate-400 hover:text-red-600 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Footer */}
        {current && (
          <div className="px-4 py-2 border-t bg-slate-50 flex items-center gap-3 shrink-0">
            <div className="text-xs text-slate-600 flex-1 min-w-0 truncate">
              <span className="font-medium">{current.file_name}</span>
              <span className="text-slate-400"> · {index + 1} of {total}{current.file_size ? ` · ${formatSize(current.file_size)}` : ''}</span>
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
