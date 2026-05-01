import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Download, Loader2, FileQuestion, Mail, Printer } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
  /** Optional context label e.g. "April 2026 — NRES Management" used in email subject/body */
  claimLabel?: string;
}

export function EvidenceViewerModal({ open, files, initialIndex, getDownloadUrl, onClose, claimLabel }: Props) {
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

  // ---- Email ----
  const [emailing, setEmailing] = useState(false);
  const sendEmail = async (scope: 'current' | 'all') => {
    const targets = scope === 'all' ? files : [current];
    if (targets.length === 0) return;
    setEmailing(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-evidence-email', {
        body: {
          filePaths: targets.map(f => f.file_path),
          fileNames: targets.map(f => f.file_name),
          claimLabel,
          subject: scope === 'all'
            ? `All supporting evidence${claimLabel ? ` — ${claimLabel}` : ''}`
            : `Evidence: ${current.file_name}${claimLabel ? ` — ${claimLabel}` : ''}`,
        },
      });
      if (error) throw error;
      toast.success(`Email sent to ${(data as any)?.recipient || 'you'} (${targets.length} file${targets.length === 1 ? '' : 's'})`);
    } catch (e: any) {
      console.error('email failed', e);
      toast.error(e?.message || 'Could not send email');
    } finally {
      setEmailing(false);
    }
  };

  // ---- Print (merged PDF) ----
  const [printing, setPrinting] = useState(false);
  const buildMergedPdf = async (targets: ClaimEvidenceFile[]): Promise<Uint8Array> => {
    const merged = await PDFDocument.create();
    const helv = await merged.embedFont(StandardFonts.Helvetica);
    const helvBold = await merged.embedFont(StandardFonts.HelveticaBold);

    for (let i = 0; i < targets.length; i++) {
      const f = targets[i];
      const url = await ensureUrl(f, true);
      if (!url) continue;
      const resp = await fetch(url);
      const buf = new Uint8Array(await resp.arrayBuffer());
      const k = classify(f);

      // Cover/separator page
      const cover = merged.addPage([595.28, 841.89]); // A4
      cover.drawText(`Evidence ${i + 1} of ${targets.length}`, { x: 50, y: 780, size: 11, font: helv, color: rgb(0.4, 0.45, 0.55) });
      cover.drawText(f.file_name, { x: 50, y: 750, size: 16, font: helvBold, color: rgb(0.06, 0.09, 0.16) });
      if (claimLabel) cover.drawText(claimLabel, { x: 50, y: 728, size: 10, font: helv, color: rgb(0.4, 0.45, 0.55) });

      try {
        if (k === 'pdf') {
          const src = await PDFDocument.load(buf, { ignoreEncryption: true });
          const copied = await merged.copyPages(src, src.getPageIndices());
          copied.forEach(p => merged.addPage(p));
        } else if (k === 'image') {
          const ext = (f.file_name.split('.').pop() || '').toLowerCase();
          let img;
          if (ext === 'png') img = await merged.embedPng(buf);
          else img = await merged.embedJpg(buf); // jpg/jpeg/webp may fail; caught below
          const page = merged.addPage([595.28, 841.89]);
          const maxW = 495, maxH = 720;
          const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * ratio, h = img.height * ratio;
          page.drawImage(img, { x: (595.28 - w) / 2, y: (841.89 - h) / 2 - 20, width: w, height: h });
        } else {
          cover.drawText('(Inline preview not available — see attachment in original format)', { x: 50, y: 700, size: 10, font: helv, color: rgb(0.6, 0.2, 0.2) });
        }
      } catch (e) {
        console.warn('failed to embed', f.file_name, e);
        cover.drawText('(Could not embed this file in the print bundle)', { x: 50, y: 700, size: 10, font: helv, color: rgb(0.6, 0.2, 0.2) });
      }
    }
    return await merged.save();
  };

  const printScope = async (scope: 'current' | 'all') => {
    const targets = scope === 'all' ? files : [current];
    if (targets.length === 0) return;
    setPrinting(true);
    try {
      const bytes = await buildMergedPdf(targets);
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      // Use a hidden iframe to avoid popup/blob blockers
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      let printed = false;
      const triggerPrint = () => {
        if (printed) return;
        printed = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn('iframe print failed, falling back to download', err);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `evidence-${Date.now()}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          toast.message('Print blocked by browser — downloaded the PDF instead');
        }
      };

      iframe.onload = () => setTimeout(triggerPrint, 300);
      // Safety net if onload doesn't fire
      setTimeout(triggerPrint, 2500);

      // Cleanup later
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        iframe.remove();
      }, 120_000);
    } catch (e: any) {
      console.error('print failed', e);
      toast.error(e?.message || 'Could not prepare print bundle');
    } finally {
      setPrinting(false);
    }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={emailing} className="h-8">
                {emailing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1.5" />}
                Email
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[60]">
              <DropdownMenuItem onClick={() => sendEmail('current')}>Email this document to me</DropdownMenuItem>
              <DropdownMenuItem onClick={() => sendEmail('all')} disabled={files.length < 2}>
                Email all supporting documents to me{files.length > 1 ? ` (${files.length})` : ''}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={printing} className="h-8">
                {printing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1.5" />}
                Print
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[60]">
              <DropdownMenuItem onClick={() => printScope('current')}>Print this evidence</DropdownMenuItem>
              <DropdownMenuItem onClick={() => printScope('all')} disabled={files.length < 2}>
                Print all evidence for this claim{files.length > 1 ? ` (${files.length})` : ''}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
