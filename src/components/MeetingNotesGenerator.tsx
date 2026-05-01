"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ExampleMeetingFlyout from './ExampleMeetingFlyout';

type ViewKey =
  | "formal_minutes"
  | "action_notes"
  | "headline_summary"
  | "narrative_newsletter"
  | "decision_log"
  | "annotated_summary";

type IngestTab = "paste" | "audio" | "file";
type StyleUnion = string | { markdown?: string; table_markdown?: string; title?: string; suggested_filename?: string };

// === Single-run response (tolerates strings OR objects)
type ApiResponse = {
  meta?: any;
  cleaned_transcript?: string;
  styles: Record<ViewKey, StyleUnion>;
};

// === Compare response
type CompareResponse = {
  comparisons: Record<
    string, // "1".."5"
    Record<ViewKey, StyleUnion>
  >;
};

type Settings = {
  title?: string;
  date?: string; // YYYY-MM-DD
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

  // Generation (single-run)
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("formal_minutes");

  // Display mode
  const [renderMode, setRenderMode] = useState<"rendered" | "raw">("rendered");

  // Collapsible ingest section
  const [isIngestCollapsed, setIsIngestCollapsed] = useState(false);

  // === Edit state (single-run)
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [overrides, setOverrides] = useState<Partial<Record<ViewKey, string>>>({});

  // === Compare state
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareLevels, setCompareLevels] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [compareActiveLevel, setCompareActiveLevel] = useState<"1" | "2" | "3" | "4" | "5">("3");
  const [compareActiveView, setCompareActiveView] = useState<ViewKey>("formal_minutes");
  const [compareRenderMode, setCompareRenderMode] = useState<"rendered" | "raw">("rendered");

  // === Edit state (compare)
  const [compareIsEditing, setCompareIsEditing] = useState(false);
  const [compareEditText, setCompareEditText] = useState("");
  // overrides per level: { "3": {formal_minutes: "..."} }
  const [compareOverrides, setCompareOverrides] =
    useState<Record<string, Partial<Record<ViewKey, string>>>>({});

  // Helpers
  function readBlock(block: StyleUnion | undefined): string {
    if (!block) return "";
    if (typeof block === "string") return block;
    return block.markdown || block.table_markdown || "";
  }

  function getActiveMarkdown(): string {
    if (!result) return "";
    return readBlock(result.styles?.[activeView]);
  }

  const tabs: Array<[ViewKey, string]> = [
    ["formal_minutes", "Formal Minutes"],
    ["action_notes", "Action Notes"],
    ["headline_summary", "Headline Summary"],
    ["narrative_newsletter", "Newsletter"],
    ["decision_log", "Decision Log"],
    ["annotated_summary", "Annotated Summary"],
  ];

  // Suggested filename builder
  function suggestFilename(view: ViewKey, level?: string) {
    const base = settings?.title || "Meeting Notes";
    const date = settings?.date ? `-${settings.date}` : "";
    const viewPart = `-${view.replace(/_/g, "-")}`;
    const lvl = level ? `-L${level}` : "";
    return `${base}${date}${viewPart}${lvl}`.toLowerCase().replace(/[^a-z0-9\-]+/g, "-");
  }

  // Actions
  async function generate() {
    if (!transcript.trim()) {
      toast.error("Please enter a transcript");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setOverrides({});
    setIsEditing(false);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-meeting-notes-six-styles', {
        body: { 
          transcript,
          settings: { ...settings, controls: { detail_level: detailLevel } },
          detail_level: detailLevel,
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data as ApiResponse);
    } catch (e: any) {
      console.error('Generation error:', e);
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function runCompare() {
    if (!transcript.trim()) {
      toast.error("Please enter a transcript");
      return;
    }

    setCompareBusy(true);
    setError(null);
    setCompareResult(null);
    setCompareOverrides({});
    setCompareIsEditing(false);
    
    try {
      const levels = Object.entries(compareLevels)
        .filter(([, v]) => v)
        .map(([k]) => Number(k))
        .sort((a, b) => a - b);

      if (!levels.length) {
        toast.error("Select at least one level");
        return;
      }

      const { data, error: functionError } = await supabase.functions.invoke('generate-meeting-notes-compare', {
        body: { transcript, settings, levels }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.comparisons) {
        throw new Error('No comparison data returned');
      }

      setCompareActiveLevel(String(levels[0]) as any);
      setCompareResult(data as CompareResponse);
      toast.success("Comparison generated successfully");
    } catch (e: any) {
      console.error('Compare error:', e);
      setError(e?.message || "Unexpected error");
      toast.error("Failed to generate comparison");
    } finally {
      setCompareBusy(false);
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
      toast.success("Copied to clipboard");
    }
  }

  async function downloadDocx(markdown: string, filename: string, meetingId?: string) {
    try {
      const { data, error: functionError } = await supabase.functions.invoke('export-docx', {
        body: {
          markdown,
          filename,
          // When meetingId is supplied the edge function routes through the
          // NHS-styled docx generator and stamps the model in the footer.
          ...(meetingId ? { meetingId } : {}),
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      // Since our edge function returns text for now, create a blob and download
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      toast.success("Document downloaded successfully");
    } catch (e: any) {
      console.error('Download error:', e);
      setError(`Export failed: ${e?.message}`);
      toast.error("Failed to download document");
    }
  }

  // === Single-run effective text (respect overrides)
  const baseActive = getActiveMarkdown();
  const activeText = overrides[activeView] ?? baseActive;

  // === Compare effective text (respect overrides at that level)
  const compStyles = compareResult?.comparisons?.[compareActiveLevel] || undefined;
  const compBaseText = compStyles ? readBlock(compStyles[compareActiveView]) : "";
  const thisLevelOverrides = compareOverrides[compareActiveLevel] || {};
  const compActiveText = thisLevelOverrides[compareActiveView] ?? compBaseText;

  // Debug useEffect for compareResult
  useEffect(() => {
    console.log('compareResult changed:', { 
      compareResult,
      availableLevels: compareResult ? Object.keys(compareResult.comparisons || {}) : [],
      compareActiveLevel,
      compareActiveView,
      compActiveText: compActiveText.substring(0, 100) + '...'
    });
  }, [compareResult, compareActiveLevel, compareActiveView]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">NHS Meeting Notes Generator</h1>
        <ExampleMeetingFlyout buttonClassName="px-3 py-2 rounded text-primary hover:bg-primary/10 border border-primary/20 hover:border-primary/40 transition-colors text-sm" />
      </div>

      {/* Ingest */}
      <div className="border rounded">
        <div className="flex gap-2 border-b p-2">
          <button
            onClick={() => setIsIngestCollapsed(!isIngestCollapsed)}
            className="px-3 py-1 rounded bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2"
          >
            <span className={`transform transition-transform ${isIngestCollapsed ? 'rotate-90' : 'rotate-0'}`}>
              ▶
            </span>
            Input
          </button>
          {!isIngestCollapsed && (
            <>
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
            </>
          )}
        </div>
        {!isIngestCollapsed && (
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
        )}
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
        <p className="text-xs text-muted-foreground mt-1">Affects the single-run "Generate Meeting Notes".</p>
      </div>

      {/* Generate */}
      <button
        onClick={generate}
        disabled={loading || !transcript.trim()}
        className="w-fit px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        {loading ? "Generating…" : "Generate Meeting Notes"}
      </button>

      {error && <div className="text-destructive bg-destructive/10 p-3 rounded border border-destructive/20">{error}</div>}

      {/* Single-run output */}
      {result && (
        <div className="border rounded">
          <div className="flex flex-wrap gap-2 border-b p-2">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setActiveView(key);
                  setIsEditing(false);
                }}
                className={`px-3 py-1 rounded ${activeView === key ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <div className="flex gap-2">
              {!isEditing && (
                <button
                  onClick={() => {
                    setEditText(activeText);
                    setIsEditing(true);
                  }}
                  className="px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  Edit
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={() => {
                      setOverrides((o) => ({ ...o, [activeView]: editText }));
                      setIsEditing(false);
                      toast.success("Changes saved");
                    }}
                    className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)} 
                    className="px-3 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const copy = { ...overrides };
                      delete copy[activeView];
                      setOverrides(copy);
                      setIsEditing(false);
                      setEditText("");
                      toast.success("Edits reset");
                    }}
                    className="px-3 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    title="Remove edits for this tab"
                  >
                    Reset
                  </button>
                </>
              )}
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
              <button
                onClick={() => downloadDocx(activeText, suggestFilename(activeView))}
                className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Download
              </button>
            </div>
          </div>

          <div className="p-4">
            {isEditing ? (
              <textarea
                className="w-full border rounded p-3 min-h-[320px] font-mono text-sm bg-background text-foreground"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Edit the markdown content here..."
              />
            ) : renderMode === "rendered" ? (
              <article className="prose prose-slate max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeText}</ReactMarkdown>
              </article>
            ) : (
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded overflow-x-auto">{activeText}</pre>
            )}
          </div>
        </div>
      )}

      {/* === Compare panel === */}
      <div className="border rounded p-3 space-y-3">
        <h2 className="text-lg font-semibold">Compare Detail Levels</h2>
        <div className="flex flex-wrap items-center gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!compareLevels[n]}
                onChange={(e) => setCompareLevels((s) => ({ ...s, [n]: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm">Level {n}</span>
            </label>
          ))}
          <button
            onClick={runCompare}
            disabled={compareBusy || !transcript.trim()}
            className="ml-auto px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {compareBusy ? "Comparing…" : "Run Comparison"}
          </button>
        </div>

        {compareResult && (
          <div className="border rounded">
            {/* Level tabs */}
            <div className="flex flex-wrap gap-2 border-b p-2">
              {([1, 2, 3, 4, 5] as const)
                .filter((n) => compareResult.comparisons[String(n)])
                .map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setCompareActiveLevel(String(n) as any);
                      setCompareIsEditing(false);
                    }}
                    className={`px-3 py-1 rounded ${compareActiveLevel === String(n) ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    Level {n}
                  </button>
                ))}
              <div className="flex-1" />
              <div className="flex gap-2">
                {!compareIsEditing && (
                  <button
                    onClick={() => {
                      setCompareEditText(compActiveText);
                      setCompareIsEditing(true);
                    }}
                    className="px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    Edit
                  </button>
                )}
                {compareIsEditing && (
                  <>
                    <button
                      onClick={() => {
                        setCompareOverrides((o) => ({
                          ...o,
                          [compareActiveLevel]: {
                            ...(o[compareActiveLevel] || {}),
                            [compareActiveView]: compareEditText,
                          },
                        }));
                        setCompareIsEditing(false);
                        toast.success("Changes saved");
                      }}
                      className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setCompareIsEditing(false)} 
                      className="px-3 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setCompareOverrides((o) => {
                          const copy = { ...(o || {}) };
                          const levelMap = { ...(copy[compareActiveLevel] || {}) };
                          delete levelMap[compareActiveView];
                          copy[compareActiveLevel] = levelMap;
                          return copy;
                        });
                        setCompareIsEditing(false);
                        setCompareEditText("");
                        toast.success("Edits reset");
                      }}
                      className="px-3 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      title="Remove edits for this level & tab"
                    >
                      Reset
                    </button>
                  </>
                )}
                <button
                  onClick={() =>
                    setCompareRenderMode(compareRenderMode === "rendered" ? "raw" : "rendered")
                  }
                  className="px-3 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  {compareRenderMode === "rendered" ? "Show Raw" : "Show Rendered"}
                </button>
                <button 
                  onClick={() => copy(compActiveText)} 
                  className="px-3 py-1 rounded bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() =>
                    downloadDocx(compActiveText, suggestFilename(compareActiveView, compareActiveLevel))
                  }
                  className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Download
                </button>
              </div>
            </div>

            {/* Style tabs */}
            <div className="flex flex-wrap gap-2 border-b p-2">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setCompareActiveView(key);
                    setCompareIsEditing(false);
                  }}
                  className={`px-3 py-1 rounded ${compareActiveView === key ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-4">
              {compareIsEditing ? (
                <textarea
                  className="w-full border rounded p-3 min-h-[320px] font-mono text-sm bg-background text-foreground"
                  value={compareEditText}
                  onChange={(e) => setCompareEditText(e.target.value)}
                  placeholder="Edit the markdown content here..."
                />
              ) : compareRenderMode === "rendered" ? (
                <article className="prose prose-slate max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{compActiveText}</ReactMarkdown>
                </article>
              ) : (
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded overflow-x-auto">{compActiveText}</pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}