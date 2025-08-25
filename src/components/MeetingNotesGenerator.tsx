"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ViewKey =
  | "formal_minutes"
  | "action_notes"
  | "headline_summary"
  | "narrative_newsletter"
  | "decision_log"
  | "annotated_summary";

type IngestTab = "paste" | "audio" | "file";

// ✅ Styles can be returned as either a plain string OR an object with markdown/table_markdown
type StyleUnion = string | { markdown?: string; table_markdown?: string; title?: string; suggested_filename?: string };

// ✅ Match the *actual* API response where styles are strings, but stay backward-compatible
type ApiResponse = {
  meta?: any;
  cleaned_transcript?: string;
  styles: Record<ViewKey, StyleUnion>;
};

type Settings = {
  title?: string;
  date?: string;
  time?: string;
  venue?: string;
  chair?: string;
  minute_taker?: string;
  attendees?: string[];
  agenda?: string[];
  context_docs?: string[];
  objectives?: string[];
  locality?: string;
  pcn?: string;
  icb?: string;
  key_dates?: string[];
  preferences?: { include_headers?: boolean; show_empty_fields?: boolean };
  controls?: { detail_level?: number };
};

export default function MeetingNotesGenerator() {
  // Ingest
  const [ingestTab, setIngestTab] = useState<IngestTab>("paste");
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content/settings
  const [transcript, setTranscript] = useState("");
  const [settings, setSettings] = useState<Settings>({});
  const [detailLevel, setDetailLevel] = useState<number>(3);

  // Generation
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("formal_minutes");

  // Display
  const [renderMode, setRenderMode] = useState<"rendered" | "raw">("rendered");

  // ✅ Robustly read current tab content whether API returned a string or an object
  function getActiveMarkdown(): string {
    if (!result) return "";
    const block = result.styles?.[activeView];
    if (!block) return "";
    if (typeof block === "string") return block;
    return block.markdown || block.table_markdown || "";
  }

  async function generate() {
    if (!transcript.trim()) {
      toast.error('Please enter a transcript');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-meeting-notes-six-styles', {
        body: { 
          transcript,
          settings: { ...settings, controls: { detail_level: detailLevel } },
          detail_level: detailLevel, // some backends read it at top level
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data as ApiResponse);
      toast.success('Meeting notes generated successfully');
    } catch (e: any) {
      console.error('Generation error:', e);
      setError(e?.message || "Unexpected error");
      toast.error('Failed to generate meeting notes');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(kind: "audio" | "doc", f: File) {
    setIngestBusy(true);
    setIngestMsg(kind === "audio" ? "Transcribing audio…" : "Extracting text…");
    setError(null);
    
    try {
      const formData = new FormData();
      if (kind === "audio") {
        formData.append("audio", f);
      } else {
        formData.append("doc", f);
      }

      const { data, error: functionError } = await supabase.functions.invoke('upload-to-text', {
        body: formData
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const extractedText = (data?.text || '').trim();
      if (!extractedText) {
        throw new Error('No text returned from file.');
      }

      setTranscript(extractedText);
      setIngestMsg("Done. Transcript inserted.");
      toast.success(`${kind === "audio" ? 'Audio transcribed' : 'Text extracted'} successfully`);
    } catch (e: any) {
      console.error('Upload error:', e);
      setError(e?.message || "Upload failed");
      setIngestMsg(null);
      toast.error(`Failed to ${kind === "audio" ? 'transcribe audio' : 'extract text'}`);
    } finally {
      setIngestBusy(false);
    }
  }

  async function copy(text: string) {
    if (text) {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    }
  }

  const tabs: Array<[ViewKey, string]> = [
    ["formal_minutes", "Formal Minutes"],
    ["action_notes", "Action Notes"],
    ["headline_summary", "Headline Summary"],
    ["narrative_newsletter", "Newsletter"],
    ["decision_log", "Decision Log"],
    ["annotated_summary", "Annotated Summary"],
  ];

  const activeText = getActiveMarkdown();

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">NHS Meeting Notes Generator</h1>

      {/* Ingestion */}
      <div className="border rounded">
        <div className="flex gap-2 border-b p-2">
          {(["paste", "audio", "file"] as IngestTab[]).map((k) => (
            <button
              key={k}
              onClick={() => setIngestTab(k)}
              className={`px-3 py-1 rounded ${ingestTab === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {k === "paste" ? "Paste Text" : k === "audio" ? "Upload Audio (Whisper)" : "Upload Document"}
            </button>
          ))}
          <div className="flex-1" />
          {ingestBusy && <span className="text-sm italic text-muted-foreground">{ingestMsg}</span>}
        </div>
        <div className="p-3 space-y-2">
          {ingestTab === "paste" && (
            <textarea
              className="w-full border rounded p-3 min-h-[180px] bg-background text-foreground"
              placeholder="Paste or type your meeting transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          )}
          {ingestTab === "audio" && (
            <>
              <input
                ref={audioInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.webm,.ogg,audio/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload("audio", f);
                }}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">MP3, WAV, M4A, WebM, OGG supported.</p>
            </>
          )}
          {ingestTab === "file" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload("doc", f);
                }}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">DOCX, PDF, TXT supported.</p>
            </>
          )}
        </div>
      </div>

      {/* Settings */}
      <details className="border rounded">
        <summary className="p-3 cursor-pointer bg-muted/50 hover:bg-muted transition-colors">Meeting Settings (Optional)</summary>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {["title", "date", "time", "venue", "chair", "minute_taker", "locality", "pcn", "icb"].map((k) => (
            <input
              key={k}
              className="border rounded p-2 bg-background text-foreground"
              placeholder={k}
              value={(settings as any)[k] || ""}
              onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
            />
          ))}
          <input
            className="border rounded p-2 md:col-span-2 bg-background text-foreground"
            placeholder="agenda (comma separated)"
            onChange={(e) =>
              setSettings((s) => ({ ...s, agenda: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))
            }
          />
          <input
            className="border rounded p-2 md:col-span-2 bg-background text-foreground"
            placeholder="attendees (comma separated)"
            onChange={(e) =>
              setSettings((s) => ({ ...s, attendees: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))
            }
          />
          <input
            className="border rounded p-2 md:col-span-2 bg-background text-foreground"
            placeholder="key_dates (comma separated)"
            onChange={(e) =>
              setSettings((s) => ({ ...s, key_dates: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))
            }
          />
        </div>
      </details>

      {/* Detail slider */}
      <div className="border rounded p-3">
        <label className="block text-sm font-medium mb-1">Detail Level</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={detailLevel}
            onChange={(e) => setDetailLevel(parseInt(e.target.value))}
            className="w-72"
          />
          <span className="text-sm">
            {detailLevel === 1 && "Ultra-brief"}
            {detailLevel === 2 && "Brief"}
            {detailLevel === 3 && "Standard"}
            {detailLevel === 4 && "Detailed"}
            {detailLevel === 5 && "Very detailed"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Scales bullets/sections/actions/risks across all styles.</p>
      </div>

      {/* Generate */}
      <button
        onClick={generate}
        disabled={loading || !transcript.trim()}
        className="w-fit px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary-hover transition-colors"
      >
        {loading ? "Generating…" : "Generate Meeting Notes"}
      </button>

      {error && <div className="text-destructive bg-destructive/10 p-3 rounded border border-destructive/20">{error}</div>}

      {/* Output */}
      {result && (
        <div className="border rounded">
          <div className="flex flex-wrap gap-2 border-b p-2">
            {(
              [
                ["formal_minutes", "Formal Minutes"],
                ["action_notes", "Action Notes"],
                ["headline_summary", "Headline Summary"],
                ["narrative_newsletter", "Newsletter"],
                ["decision_log", "Decision Log"],
                ["annotated_summary", "Annotated Summary"],
              ] as Array<[ViewKey, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                className={`px-3 py-1 rounded ${activeView === key ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <div className="flex gap-2">
              <button
                onClick={() => setRenderMode(renderMode === "rendered" ? "raw" : "rendered")}
                className="px-3 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {renderMode === "rendered" ? "Show Raw" : "Show Rendered"}
              </button>
              <button 
                onClick={() => copy(activeText)} 
                className="px-3 py-1 rounded bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="p-4">
            {renderMode === "rendered" ? (
              <article className="prose prose-slate max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeText}</ReactMarkdown>
              </article>
            ) : (
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded overflow-x-auto">{activeText}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}