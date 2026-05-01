import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Download, X, Loader2, FileQuestion } from 'lucide-react';
import type { ClaimEvidenceFile } from '@/hooks/useNRESClaimEvidence';

type Kind = 'image' | 'pdf' | 'office' | 'other';

function classify(file: ClaimEvidenceFile): Kind {
  const name = (file.file_name || '').toLowerCase();
  const mime = (file.file_type || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop()! : '';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'].includes(ext)) return 'office';
  return 'other';
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  open: boolean;
  files: ClaimEvidenceFile[];
  initialIndex: number;
  getDownloadUrl: (path: string) => Promise<string | null>;
  onClose: () => void;
}

export function EvidenceViewerModal({ open, files, initialIndex, getDownloadUrl, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [, force] = useState(0);

  // Reset index whenever modal re-opens
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const total = files.length;
  const current = files[index];
  const cachedUrl = current ? cacheRef.current.get(current.id) : undefined;

  const ensureUrl = useCallback(async (file: ClaimEvidenceFile, silent = false) => {
    if (!file) return null;
    if (cacheRef.current.has(file.id)) return cacheRef.current.get(file.id)!;
    if (!silent) setLoading(true);
    const url = await getDownloadUrl(file.file_path);
    if (url) {
      cacheRef.current.set(file.id, url);
      force(n => n + 1);
    }
    if (!silent) setLoading(false);
    return url;
  }, [getDownloadUrl]);

  // Fetch current + prefetch neighbours
  useEffect(() => {
    if (!open || !current) return;
    ensureUrl(current);
    if (files[index + 1]) ensureUrl(files[index + 1], true);
    if (files[index - 1]) ensureUrl(files[index - 1], true);
  }, [open, index, current, ensureUrl, files]);

  const goPrev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex(i => Math.min(total - 1, i + 1)), [total]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, goPrev, goNext]);

  const handleDownload = async () => {
    if (!current) return;
    const url = await ensureUrl(current);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!current) return null;

  const kind = classify(current);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-6xl w-[92vw] h-[88vh] p-0 flex flex-col gap-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm truncate" title={current.file_name}>{current.file_name}</span>
              <Badge variant="outline" className="text-[10px] uppercase shrink-0">{kind === 'office' ? (current.file_name.split('.').pop() || 'doc') : kind}</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {index + 1} of {total}
              {current.file_size ? ` · ${formatSize(current.file_size)}` : ''}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 mr-8">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download
          </Button>
        </div>

        {/* Viewer body */}
        <div className="relative flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
          {/* Prev / Next overlay buttons */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                disabled={isFirst}
                aria-label="Previous file"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-md border flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={isLast}
                aria-label="Next file"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-md border flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {loading && !cachedUrl && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-6 h-6 animate-spin" />
              Loading preview…
            </div>
          )}

          {cachedUrl && kind === 'image' && (
            <img
              src={cachedUrl}
              alt={current.file_name}
              className="max-w-full max-h-full object-contain"
            />
          )}

          {cachedUrl && kind === 'pdf' && (
            <iframe
              key={current.id}
              src={cachedUrl}
              title={current.file_name}
              className="w-full h-full bg-white"
            />
          )}

          {cachedUrl && kind === 'office' && (
            <iframe
              key={current.id}
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(cachedUrl)}`}
              title={current.file_name}
              className="w-full h-full bg-white"
            />
          )}

          {cachedUrl && kind === 'other' && (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <FileQuestion className="w-10 h-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No inline preview available</p>
                <p className="text-xs text-muted-foreground mt-1">This file type can't be previewed in the browser.</p>
              </div>
              <Button size="sm" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download to view
              </Button>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {total > 1 && (
          <div className="border-t bg-slate-50 dark:bg-slate-900/50 px-3 py-2 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {files.map((f, i) => {
                const active = i === index;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    title={f.file_name}
                    className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] border transition-colors max-w-[180px] truncate ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
                        : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-muted-foreground'
                    }`}
                  >
                    {i + 1}. {f.file_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
