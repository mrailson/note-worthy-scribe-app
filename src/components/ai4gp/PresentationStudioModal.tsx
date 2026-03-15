import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as mammoth from 'mammoth';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import PptxGenJS from 'pptxgenjs';

// PptxGenJS is now imported as an npm module — always ready
function usePptxGen() {
  return true;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const NHS = {
  blue: '#003087', blueLight: '#0055a5', warm: '#FFB81C',
  green: '#009639', darkGrey: '#425563', lightGrey: '#E8EDEE',
};
const SCHEMES: Record<string, { primary: string; accent: string; text: string; sub: string }> = {
  'NHS Blue':  { primary: '003087', accent: 'FFB81C', text: 'FFFFFF', sub: 'AEB7D0' },
  'NHS Green': { primary: '006747', accent: 'FFB81C', text: 'FFFFFF', sub: 'A8C8A0' },
  'Slate':     { primary: '2C3E50', accent: '3498DB', text: 'FFFFFF', sub: '95A5A6' },
};
const ICON_MAP: Record<string, string> = {
  update:'📋', data:'📊', people:'👥', action:'✅', risk:'⚠️',
  finance:'💷', digital:'💻', clinical:'🏥', governance:'⚖️',
  timeline:'📅', summary:'📌', default:'▸',
};
const ACCEPTED: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface SourceFile {
  type: 'pdf' | 'text';
  name: string;
  b64?: string;
  text?: string;
}

interface FormState {
  title: string;
  slides: number;
  audience: string;
  practice: string;
  scheme: string;
  imageMode: string;
  logo: boolean;
  imageSource: string;
}

interface ResultData {
  title: string;
  slideCount: number;
  scheme: string;
  fileName?: string;
  gammaUrl?: string;
  sourceLabel: string;
  note?: string;
}

// ─── File reading helpers ─────────────────────────────────────────────────────
function readAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsText(file);
  });
}
function readAsBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
async function extractTextFromFile(file: File): Promise<SourceFile> {
  const type = file.type;
  if (type === 'application/pdf') {
    const b64 = await readAsBase64(file);
    return { type: 'pdf', b64, name: file.name };
  }
  if (type.includes('wordprocessingml') || file.name.endsWith('.docx')) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return { type: 'text', text: result.value, name: file.name };
  }
  const text = await readAsText(file);
  return { type: 'text', text, name: file.name };
}

// ─── Claude API via Edge Function ─────────────────────────────────────────────
async function generateSlideContent(params: {
  title: string; brief: string; slides: number; audience: string;
  practice: string; scheme: string; sourceFiles: SourceFile[]; pasteText: string;
}) {
  const { data, error } = await supabase.functions.invoke('generate-presentation-slides', {
    body: params,
  });
  if (error) throw new Error(error.message || 'Failed to generate slides');
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── PptxGenJS builder ────────────────────────────────────────────────────────
async function buildPptx({ content, scheme, practice, imageMode, logo }: {
  content: any; scheme: string; practice: string; imageMode: string; logo: boolean;
}) {
  const col = SCHEMES[scheme] || SCHEMES['NHS Blue'];
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  // Title slide
  const ts = pptx.addSlide();
  ts.background = { color: col.primary };
  ts.addShape(pptx.ShapeType.rect, { x: 0, y: 4.8, w: '100%', h: 0.08, fill: { color: col.accent } });
  ts.addText(content.title || 'Presentation', { x: 0.6, y: 1.4, w: 8.8, h: 1.2, fontSize: 36, bold: true, color: col.text, fontFace: 'Calibri', align: 'left', wrap: true });
  ts.addText(content.subtitle || '', { x: 0.6, y: 2.7, w: 8.8, h: 0.7, fontSize: 18, color: col.sub, fontFace: 'Calibri' });
  ts.addText(practice || '', { x: 0.6, y: 5.0, w: 5, h: 0.4, fontSize: 12, color: col.sub, fontFace: 'Calibri', italic: true });
  ts.addText(new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), { x: 7, y: 5.0, w: 2.5, h: 0.4, fontSize: 12, color: col.sub, fontFace: 'Calibri', align: 'right' });
  if (logo) ts.addText('Notewell AI', { x: 0.6, y: 0.25, w: 3, h: 0.4, fontSize: 13, bold: true, color: col.accent, fontFace: 'Calibri' });

  // Content slides
  (content.slides || []).forEach((slide: any, idx: number) => {
    const s = pptx.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: col.primary } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.9, w: '100%', h: 0.05, fill: { color: col.accent } });
    s.addText(slide.title || `Slide ${idx + 1}`, { x: 0.35, y: 0.08, w: 8.5, h: 0.75, fontSize: 20, bold: true, color: 'FFFFFF', fontFace: 'Calibri', align: 'left', valign: 'middle' });
    s.addText(`${idx + 1}`, { x: 9.05, y: 0.18, w: 0.4, h: 0.4, fontSize: 11, color: col.accent, bold: true, fontFace: 'Calibri', align: 'center' });
    const bullets = (slide.bullets || []).map((b: string) => ({ text: b, options: { bullet: { type: 'bullet', indent: 15 }, fontSize: 16, color: '2C3E50', breakLine: true, paraSpaceAfter: 8 } }));
    if (bullets.length) s.addText(bullets, { x: 0.5, y: 1.1, w: imageMode === 'none' ? 9 : 6.2, h: 3.8, fontFace: 'Calibri', valign: 'top', wrap: true });
    if (imageMode !== 'none') {
      const icon = ICON_MAP[slide.icon] || ICON_MAP.default;
      s.addShape(pptx.ShapeType.rect, { x: 6.9, y: 1.1, w: 2.65, h: 3.8, fill: { color: col.primary + '12' }, line: { color: col.primary + '30', width: 1 } });
      s.addText(icon, { x: 6.9, y: 2.1, w: 2.65, h: 1.8, fontSize: 64, align: 'center', valign: 'middle' });
      s.addText(slide.icon || '', { x: 6.9, y: 3.9, w: 2.65, h: 0.4, fontSize: 10, color: col.primary, align: 'center', fontFace: 'Calibri', italic: true });
    }
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 4.95, w: '100%', h: 0.55, fill: { color: 'F4F6F8' } });
    s.addText(practice || 'NHS Primary Care', { x: 0.3, y: 5.0, w: 5, h: 0.4, fontSize: 9, color: '768692', fontFace: 'Calibri', italic: true });
    s.addText(`CONFIDENTIAL · ${new Date().toLocaleDateString('en-GB')}`, { x: 5.5, y: 5.0, w: 4, h: 0.4, fontSize: 9, color: '768692', fontFace: 'Calibri', align: 'right' });
    if (slide.notes) s.addNotes(slide.notes);
  });

  // End slide
  const es = pptx.addSlide();
  es.background = { color: col.primary };
  es.addShape(pptx.ShapeType.rect, { x: 0, y: 2.8, w: '100%', h: 0.08, fill: { color: col.accent } });
  es.addText('Thank You', { x: 0.6, y: 1.6, w: 9, h: 0.9, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Calibri' });
  es.addText('Questions & Discussion', { x: 0.6, y: 2.55, w: 9, h: 0.5, fontSize: 16, color: col.sub, fontFace: 'Calibri' });
  es.addText(practice || '', { x: 0.6, y: 5.0, w: 9, h: 0.4, fontSize: 11, color: col.sub, fontFace: 'Calibri', italic: true });
  return pptx.writeFile({ fileName: `${(content.title || 'Presentation').replace(/[^a-z0-9]/gi, '_')}.pptx` });
}

// ─── Gamma API (real) ─────────────────────────────────────────────────────────
async function callGamma({ title, slides, pasteText, sourceFiles, imageSource }: {
  title: string; slides: number; pasteText: string; sourceFiles: SourceFile[]; imageSource: string;
}): Promise<{ gammaUrl?: string; downloadUrl?: string; title: string; slideCount: number }> {
  // Build supporting content from source material
  const textParts: string[] = [];
  for (const f of sourceFiles) {
    if (f.text) textParts.push(`[${f.name}]\n${f.text.slice(0, 8000)}`);
  }
  if (pasteText.trim()) textParts.push(pasteText.slice(0, 8000));
  const supportingContent = textParts.join('\n\n');

  // Phase 1: start generation
  const { data: startData, error: startError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
    body: {
      topic: title,
      supportingContent,
      slideCount: Math.min(30, Math.max(4, slides)),
      presentationType: 'Professional Healthcare Presentation',
      audience: 'healthcare professionals',
      includeSpeakerNotes: true,
      useStockLibraryImages: false,
      imageSource,
    },
  });

  if (startError) throw new Error(startError.message || 'Gamma edge function error');

  // Direct result (legacy path)
  if (startData?.success && (startData?.downloadUrl || startData?.pptxBase64)) {
    return {
      gammaUrl: startData.gammaUrl,
      downloadUrl: startData.downloadUrl,
      title: startData.title || title,
      slideCount: slides,
    };
  }

  // Polling path
  if (!startData?.generationId) {
    throw new Error(startData?.error || 'Failed to start Gamma generation');
  }

  const generationId = startData.generationId;
  const maxPollDuration = slides > 10 ? 60_000 + slides * 10_000 : 180_000;
  let currentInterval = 10_000;
  const pollStart = Date.now();

  while (Date.now() - pollStart < maxPollDuration) {
    await new Promise(r => setTimeout(r, currentInterval * (0.9 + Math.random() * 0.2)));

    const { data: pollData, error: pollError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
      body: { action: 'poll', generationId },
    });

    if (pollError) {
      const msg = pollError.message || '';
      if (msg.includes('429') || msg.includes('ThrottlerException')) {
        currentInterval = Math.min(currentInterval * 2, 120_000);
        continue;
      }
      continue;
    }

    if (pollData?.status === 'completed') {
      // Auto-download if we got a URL
      if (pollData.downloadUrl) {
        const link = document.createElement('a');
        link.href = pollData.downloadUrl;
        link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.pptx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return {
        gammaUrl: pollData.gammaUrl,
        downloadUrl: pollData.downloadUrl,
        title: pollData.title || title,
        slideCount: slides,
      };
    }

    if (pollData?.status === 'failed') {
      throw new Error(pollData.error || 'Gamma generation failed');
    }
  }

  throw new Error(`Gamma generation timed out after ${Math.round(maxPollDuration / 1000)}s`);
}

// ─── Shared style primitives ──────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: 13, color: '#111827', background: '#f9fafb', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

const F: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
    {hint && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 5 }}>{hint}</div>}
    {children}
  </div>
);

const Chip: React.FC<{ icon: string; label: string; color: string }> = ({ icon, label, color }) => (
  <span style={{ fontSize: 11.5, color, display: 'flex', alignItems: 'center', gap: 5 }}><span>{icon}</span>{label}</span>
);

// ─── Engine Toggle ────────────────────────────────────────────────────────────
function EngineToggle({ engine, onChange }: { engine: string; onChange: (e: string) => void }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#0d1b2a 0%,#1a2940 100%)',
      borderRadius: 14, padding: '16px 18px', marginBottom: 18,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: '#7c8fa8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>Presentation Engine</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Switch to compare output · both generate real .pptx files</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 4 }}>
          <button onClick={() => onChange('gamma')} style={{
            padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: engine === 'gamma' ? '#7c3aed' : 'transparent',
            color: engine === 'gamma' ? '#fff' : 'rgba(255,255,255,0.4)',
            fontWeight: engine === 'gamma' ? 700 : 500, fontSize: 13, transition: 'all 0.2s',
            boxShadow: engine === 'gamma' ? '0 2px 12px rgba(124,58,237,0.4)' : 'none',
          }}>
            ⚡ Gamma {engine === 'gamma' && <span style={{ marginLeft: 5, fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: 4 }}>ON</span>}
          </button>
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
          <button onClick={() => onChange('pptxgenjs')} style={{
            padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: engine === 'pptxgenjs' ? NHS.blue : 'transparent',
            color: engine === 'pptxgenjs' ? '#fff' : 'rgba(255,255,255,0.4)',
            fontWeight: engine === 'pptxgenjs' ? 700 : 500, fontSize: 13, transition: 'all 0.2s',
            boxShadow: engine === 'pptxgenjs' ? '0 2px 12px rgba(0,48,135,0.5)' : 'none',
          }}>
            🏥 PptxGenJS {engine === 'pptxgenjs' && <span style={{ marginLeft: 5, fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: 4 }}>ON</span>}
          </button>
        </div>
      </div>
      <div style={{
        padding: '9px 12px', borderRadius: 8, display: 'flex', gap: 14, flexWrap: 'wrap',
        background: engine === 'gamma' ? 'rgba(124,58,237,0.13)' : 'rgba(0,48,135,0.25)',
        border: `1px solid ${engine === 'gamma' ? 'rgba(124,58,237,0.3)' : 'rgba(0,80,200,0.3)'}`,
      }}>
        {engine === 'gamma'
          ? <><Chip icon="⚡" label="Gamma AI layout" color="#a78bfa" /><Chip icon="🖼️" label="AI images (may hallucinate)" color="#fbbf24" /><Chip icon="💳" label="Uses Gamma credits" color="#f87171" /><Chip icon="🔗" label="Opens in Gamma.app" color="#a78bfa" /></>
          : <><Chip icon="🏥" label="NHS-branded templates" color="#93c5fd" /><Chip icon="🎨" label="Full design control" color="#6ee7b7" /><Chip icon="✅" label="Icons only — no AI images" color="#6ee7b7" /><Chip icon="💰" label="No credit cost" color="#6ee7b7" /></>
        }
      </div>
    </div>
  );
}

// ─── Source Material Panel ────────────────────────────────────────────────────
function SourceMaterialPanel({ sourceFiles, setSourceFiles, pasteText, setPasteText }: {
  sourceFiles: SourceFile[]; setSourceFiles: React.Dispatch<React.SetStateAction<SourceFile[]>>;
  pasteText: string; setPasteText: (v: string) => void;
}) {
  const [mode, setMode] = useState<'brief' | 'source'>('brief');
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    setProcessing(true); setFileError(null);
    const incoming = Array.from(fileList);
    const supported = incoming.filter(f => Object.keys(ACCEPTED).includes(f.type) || f.name.endsWith('.docx') || f.name.endsWith('.md'));
    const unsupported = incoming.filter(f => !supported.includes(f));
    if (unsupported.length) setFileError(`Unsupported: ${unsupported.map(f => f.name).join(', ')} — use PDF, Word, or TXT`);
    try {
      const extracted = await Promise.all(supported.map(f => extractTextFromFile(f)));
      setSourceFiles(prev => {
        const names = prev.map(f => f.name);
        return [...prev, ...extracted.filter(f => !names.includes(f.name))];
      });
    } catch (e: any) { setFileError('Failed to read file: ' + e.message); }
    setProcessing(false);
  }, [setSourceFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const removeFile = (name: string) => setSourceFiles(prev => prev.filter(f => f.name !== name));
  const totalChars = sourceFiles.reduce((a, f) => (f.text?.length || 0) + a, 0) + pasteText.length;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#f3f4f6', borderRadius: 8, padding: 3, marginBottom: 12, width: 'fit-content' }}>
        {([['brief', '✏️ Brief only'], ['source', '📄 From source material']] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m as 'brief' | 'source')} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
            background: mode === m ? 'white' : 'transparent',
            color: mode === m ? '#111827' : '#6b7280',
            fontWeight: mode === m ? 600 : 400,
            boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}>{label}</button>
        ))}
      </div>

      {mode === 'brief' && (
        <F label="Brief / Topic" hint="Describe what the presentation should cover">
          <textarea style={{ ...inputSt, minHeight: 68, resize: 'vertical' } as React.CSSProperties}
            value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder="e.g. Update on NRES Same Day Access programme — governance, staffing, timeline and April go-live readiness." />
        </F>
      )}

      {mode === 'source' && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#003087' : '#d1d5db'}`,
              borderRadius: 10, padding: '20px 16px', textAlign: 'center',
              background: dragOver ? 'rgba(0,48,135,0.04)' : '#fafafa',
              cursor: 'pointer', transition: 'all 0.2s', marginBottom: 10,
            }}
          >
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.md"
              style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
            <div style={{ fontSize: 24, marginBottom: 6 }}>{processing ? '⏳' : '📂'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 3 }}>
              {processing ? 'Reading files…' : dragOver ? 'Drop to add' : 'Drop files here or click to browse'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>PDF · Word (.docx) · Plain text (.txt, .md)</div>
          </div>

          {sourceFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {sourceFiles.map(f => (
                <div key={f.name} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: f.type === 'pdf' ? 'rgba(239,68,68,0.08)' : 'rgba(0,48,135,0.07)',
                  border: `1px solid ${f.type === 'pdf' ? 'rgba(239,68,68,0.2)' : 'rgba(0,48,135,0.15)'}`,
                  borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#374151',
                }}>
                  <span>{f.type === 'pdf' ? '📕' : '📄'}</span>
                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  {f.text && <span style={{ fontSize: 10, color: '#9ca3af' }}>{(f.text.length / 1000).toFixed(1)}k chars</span>}
                  <button onClick={() => removeFile(f.name)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9ca3af', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2,
                  }}>×</button>
                </div>
              ))}
            </div>
          )}

          {fileError && (
            <div style={{ fontSize: 11, color: '#b91c1c', background: '#fef2f2', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
              ⚠️ {fileError}
            </div>
          )}

          <F label="Or paste text directly" hint="Meeting notes, report text, emails — anything you want Claude to summarise into slides">
            <textarea style={{ ...inputSt, minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 } as React.CSSProperties}
              value={pasteText} onChange={e => setPasteText(e.target.value)}
              placeholder="Paste report text, minutes, briefing notes here…" />
          </F>

          {(sourceFiles.length > 0 || pasteText.trim()) && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '8px 12px', fontSize: 11, color: '#166534',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>✅</span>
              <span>
                <strong>{sourceFiles.length} file{sourceFiles.length !== 1 ? 's' : ''}</strong>
                {pasteText.trim() ? ' + pasted text' : ''}
                {' · '}{(totalChars / 1000).toFixed(1)}k characters · Claude will extract key points for slides
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
            color: i < current ? NHS.green : i === current ? NHS.blue : '#9ca3af',
            fontWeight: i === current ? 700 : 400,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: '50%', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
              background: i < current ? NHS.green : i === current ? NHS.blue : '#e5e7eb',
              color: i <= current ? 'white' : '#9ca3af',
            }}>{i < current ? '✓' : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: `linear-gradient(90deg,${NHS.green},${NHS.blue})`,
          width: `${(current / Math.max(steps.length - 1, 1)) * 100}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({ result, engine }: { result: ResultData | null; engine: string }) {
  if (!result) return null;
  const isGamma = engine === 'gamma';
  return (
    <div style={{
      background: isGamma ? 'rgba(124,58,237,0.05)' : 'rgba(0,48,135,0.05)',
      border: `1.5px solid ${isGamma ? 'rgba(124,58,237,0.25)' : 'rgba(0,48,135,0.25)'}`,
      borderRadius: 10, padding: 14, marginTop: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ background: isGamma ? '#7c3aed' : NHS.blue, color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '2px 8px' }}>
          {isGamma ? '⚡ GAMMA' : '🏥 PPTXGENJS'}
        </span>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{result.title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>{result.slideCount} slides · {result.scheme}</span>
      </div>
      {result.sourceLabel && (
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>📄</span> Generated from: {result.sourceLabel}
        </div>
      )}
      {isGamma && result.gammaUrl
        ? <a href={result.gammaUrl} target="_blank" rel="noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: '#7c3aed', color: 'white', borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>🔗 Open in Gamma.app</a>
        : !isGamma && <div style={{ fontSize: 12, color: NHS.green, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✅ Downloading as <strong>{result.fileName}</strong>
          </div>
      }
      {result.note && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>{result.note}</div>}
    </div>
  );
}

function ComparisonBadge({ results }: { results: { gamma: ResultData | null; pptxgenjs: ResultData | null } }) {
  if (!results.gamma || !results.pptxgenjs) return null;
  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8,
      padding: '10px 14px', marginTop: 10, fontSize: 12, color: '#92400e',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>⚖️</span>
      <span><strong>Both engines run!</strong> Compare your downloads — then decide which stays. Gamma: <em>{results.gamma.title}</em> · PptxGenJS: <em>{results.pptxgenjs.fileName}</em></span>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
interface PresentationStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenStockLibrary?: () => void;
}

export const PresentationStudioModal: React.FC<PresentationStudioModalProps> = ({
  open,
  onOpenChange,
}) => {
  const pptxReady = usePptxGen();
  const [engine, setEngine] = useState('pptxgenjs');
  const [form, setForm] = useState<FormState>({
    title: '', slides: 6, audience: 'PCN Board',
    practice: 'Brackley & Towcester PCN', scheme: 'NHS Blue',
    imageMode: 'icons', logo: true, imageSource: 'noImages',
  });
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ gamma: ResultData | null; pptxgenjs: ResultData | null }>({ gamma: null, pptxgenjs: null });
  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const STEPS_PPTX = ['Reading source', 'Building slides', 'Branding', 'Saving'];
  const STEPS_GAMMA = ['Preparing', 'Generating', 'Finalising'];

  const sourceLabel = () => {
    const parts: string[] = [];
    if (sourceFiles.length) parts.push(`${sourceFiles.length} file${sourceFiles.length !== 1 ? 's' : ''}`);
    if (pasteText.trim()) parts.push('pasted text');
    return parts.length ? parts.join(' + ') : 'brief';
  };

  const handleGenerate = async () => {
    if (!form.title.trim()) return;
    setStatus('generating'); setStep(0); setError(null);
    try {
      if (engine === 'pptxgenjs') {
        setStep(1);
        const content = await generateSlideContent({ ...form, sourceFiles, pasteText, brief: pasteText });
        setStep(2);
        await new Promise(r => setTimeout(r, 200));
        setStep(3);
        await buildPptx({ content, ...form });
        const fn = `${(content.title || form.title).replace(/[^a-z0-9]/gi, '_')}.pptx`;
        setResults(r => ({
          ...r, pptxgenjs: {
            title: content.title || form.title, slideCount: (content.slides || []).length + 2,
            scheme: form.scheme, fileName: fn, sourceLabel: sourceLabel(),
            note: `NHS brand colours (${form.scheme}). Speaker notes, slide numbers & CONFIDENTIAL footer included.`,
          }
        }));
      } else {
        setStep(1);
        const res = await callGamma({ ...form, pasteText, sourceFiles });
        setStep(2);
        setResults(r => ({
          ...r, gamma: {
            title: res.title || form.title, slideCount: res.slideCount || form.slides, scheme: form.scheme,
            gammaUrl: res.gammaUrl, sourceLabel: sourceLabel(),
            note: res.downloadUrl
              ? `Downloaded via Gamma. ${res.gammaUrl ? 'Also available at Gamma.app.' : ''}`
              : res.gammaUrl
                ? 'Open in Gamma.app to view and download.'
                : 'Generation complete.',
          }
        }));
      }
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Generation failed.'); setStatus('error');
    }
  };

  const steps = engine === 'pptxgenjs' ? STEPS_PPTX : STEPS_GAMMA;
  const canGenerate = form.title.trim() && status !== 'generating';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] p-0 gap-0 overflow-hidden" style={{ maxHeight: '93vh' }}>
        {/* ── Header ── */}
        <div style={{
          background: `linear-gradient(135deg,${NHS.blue} 0%,#0055a5 100%)`,
          padding: '16px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ color: NHS.warm, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
              Notewell AI · Presentation Studio
            </div>
            <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Create Presentation</div>
          </div>
          <button onClick={() => onOpenChange(false)} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', maxHeight: 'calc(93vh - 70px)' }}>
          <EngineToggle engine={engine} onChange={setEngine} />

          <F label="Presentation Title *">
            <input style={inputSt} value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. NRES Programme — April 2026 Board Update" />
          </F>

          <SourceMaterialPanel
            sourceFiles={sourceFiles} setSourceFiles={setSourceFiles}
            pasteText={pasteText} setPasteText={setPasteText}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <F label="Slide Count">
              <select style={{ ...inputSt, cursor: 'pointer' }} value={form.slides} onChange={e => set('slides', Number(e.target.value))}>
                {[4, 5, 6, 7, 8, 10, 12].map(n => <option key={n} value={n}>{n} slides</option>)}
              </select>
            </F>
            <F label="Audience">
              <select style={{ ...inputSt, cursor: 'pointer' }} value={form.audience} onChange={e => set('audience', e.target.value)}>
                {['PCN Board', 'ICB / Senior Leadership', 'Clinical Staff', 'Admin Team', 'Patient Group', 'External Stakeholders'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </F>
          </div>

          <F label="Practice / PCN Name">
            <input style={inputSt} value={form.practice} onChange={e => set('practice', e.target.value)} placeholder="e.g. Brackley & Towcester PCN" />
          </F>

          {engine === 'pptxgenjs' && (
            <div style={{
              background: 'rgba(0,48,135,0.04)', border: '1px solid rgba(0,48,135,0.15)',
              borderRadius: 10, padding: 14, marginBottom: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: NHS.blue, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎨 Design Controls <span style={{ fontWeight: 400, color: '#6b7280' }}>— PptxGenJS only</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Colour Scheme">
                  <select style={{ ...inputSt, cursor: 'pointer' }} value={form.scheme} onChange={e => set('scheme', e.target.value)}>
                    {Object.keys(SCHEMES).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </F>
                <F label="Image Mode">
                  <select style={{ ...inputSt, cursor: 'pointer' }} value={form.imageMode} onChange={e => set('imageMode', e.target.value)}>
                    <option value="icons">Icons (recommended)</option>
                    <option value="none">Text only</option>
                  </select>
                </F>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Preview:</span>
                {Object.entries(SCHEMES[form.scheme] || SCHEMES['NHS Blue']).map(([k, v]) => (
                  <span key={k} title={`${k}: #${v}`} style={{
                    width: 20, height: 20, borderRadius: 4, border: '1px solid #e5e7eb',
                    background: `#${v}`, display: 'inline-block',
                  }} />
                ))}
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>Speaker notes · slide numbers · CONFIDENTIAL footer</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                <input type="checkbox" checked={form.logo} onChange={e => set('logo', e.target.checked)} style={{ accentColor: NHS.blue }} />
                Include "Notewell AI" in slide header
              </label>
            </div>
          )}

          {engine === 'gamma' && (
            <div style={{
              background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 10, padding: 14, marginBottom: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 10 }}>⚡ Gamma Image Controls</div>
              <F label="Image Source" hint="'No images' prevents AI hallucinations and spelling errors in photos">
                <select style={{ ...inputSt, cursor: 'pointer' }} value={form.imageSource} onChange={e => set('imageSource', e.target.value)}>
                  <option value="noImages">No images (safest)</option>
                  <option value="pictographic">Pictographic / icons</option>
                  <option value="webFreeToUse">Web images — free to use</option>
                  <option value="aiGenerated">AI generated (⚠️ may hallucinate)</option>
                </select>
              </F>
            </div>
          )}

          {status === 'generating' && (
            <div style={{ marginBottom: 14 }}>
              <ProgressBar steps={steps} current={step} />
              <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                {engine === 'pptxgenjs'
                  ? ['Sending source material to Claude API…', 'Structuring NHS slides from content…', 'Applying colour scheme and layout…', 'Writing your .pptx file…'][step] || 'Working…'
                  : ['Preparing Gamma request…', 'Gamma is generating…', 'Finalising…'][step] || 'Working…'
                }
              </div>
            </div>
          )}

          {status === 'error' && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12, color: '#991b1b' }}>
              ⚠️ {error}
            </div>
          )}

          <button onClick={handleGenerate} disabled={!canGenerate} style={{
            width: '100%', padding: '13px 20px', borderRadius: 10, border: 'none',
            background: !canGenerate ? '#9ca3af' : engine === 'pptxgenjs'
              ? `linear-gradient(135deg,${NHS.blue},#0055a5)`
              : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
            color: 'white', fontSize: 15, fontWeight: 700,
            cursor: canGenerate ? 'pointer' : 'not-allowed',
            letterSpacing: 0.3, transition: 'all 0.2s',
            boxShadow: canGenerate ? '0 4px 14px rgba(0,0,0,0.2)' : 'none',
          }}>
            {status === 'generating'
              ? `${engine === 'pptxgenjs' ? '🏥' : '⚡'} Generating…`
              : engine === 'pptxgenjs'
                ? `🏥 Generate NHS Presentation (.pptx)${sourceFiles.length || pasteText.trim() ? ' from source' : ''}`
                : `⚡ Generate with Gamma${sourceFiles.length || pasteText.trim() ? ' from source' : ''}`
            }
          </button>

          <ResultCard result={results[engine as keyof typeof results]} engine={engine} />
          <ComparisonBadge results={results} />

          {(results.gamma || results.pptxgenjs) && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {results.gamma && <span style={{ fontSize: 11, color: '#7c3aed', background: 'rgba(124,58,237,0.07)', padding: '3px 8px', borderRadius: 5 }}>⚡ Gamma: {results.gamma.title}</span>}
              {results.pptxgenjs && <span style={{ fontSize: 11, color: NHS.blue, background: 'rgba(0,48,135,0.07)', padding: '3px 8px', borderRadius: 5 }}>🏥 PptxGenJS: {results.pptxgenjs.fileName}</span>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
