import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  PageOrientation,
  WidthType,
  BorderStyle,
  ShadingType,
} from "docx";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mic, Square, Upload, Copy, Download, Trash2, FileText } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BYTES = 25 * 1024 * 1024;

const DEFAULT_PROMPT =
  "British English NHS primary care meeting transcript. " +
  "Use UK spellings: judgement, organisation, recognise, programme, behaviour, neighbourhood. " +
  "Common terms: PCN, ICB, CQC, GP, ANP, ACP, ARRS, GMS, MoU, DPIA, neighbourhood, " +
  "workstream, safeguarding, dispensing, enhanced access, social prescribing.";

type ModelId = "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe" | "assemblyai";

const MODELS: { id: ModelId; label: string; pricePerMinute: number }[] = [
  { id: "whisper-1", label: "whisper-1", pricePerMinute: 0.006 },
  { id: "gpt-4o-transcribe", label: "gpt-4o-transcribe", pricePerMinute: 0.006 },
  { id: "gpt-4o-mini-transcribe", label: "gpt-4o-mini-transcribe", pricePerMinute: 0.003 },
  { id: "assemblyai", label: "assemblyai (best)", pricePerMinute: 0.0062 },
];

type ResultState = {
  status: "idle" | "running" | "done" | "error";
  text?: string;
  latencyMs?: number;
  error?: string;
};

type PilotRun = {
  id: string;
  user_id: string;
  created_at: string;
  label: string | null;
  audio_duration_seconds: number | null;
  audio_size_bytes: number | null;
  audio_mime_type: string | null;
  prompt_used: string | null;
  whisper1_text: string | null;
  whisper1_latency_ms: number | null;
  whisper1_cost_usd: number | null;
  whisper1_error: string | null;
  gpt4o_text: string | null;
  gpt4o_latency_ms: number | null;
  gpt4o_cost_usd: number | null;
  gpt4o_error: string | null;
  gpt4o_mini_text: string | null;
  gpt4o_mini_latency_ms: number | null;
  gpt4o_mini_cost_usd: number | null;
  gpt4o_mini_error: string | null;
  assemblyai_text: string | null;
  assemblyai_latency_ms: number | null;
  assemblyai_cost_usd: number | null;
  assemblyai_error: string | null;
  notes: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtSeconds(s: number | null | undefined): string {
  if (!s && s !== 0) return "—";
  const mins = Math.floor(s / 60);
  const secs = Math.round(s % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function getAudioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const d = audio.duration;
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(d) ? d : null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      audio.src = url;
    } catch {
      resolve(null);
    }
  });
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TranscriptionPilot() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Audio state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioName, setAudioName] = useState<string>("");
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");

  // Recorder state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Form state
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  // Results
  const [results, setResults] = useState<Record<ModelId, ResultState>>({
    "whisper-1": { status: "idle" },
    "gpt-4o-transcribe": { status: "idle" },
    "gpt-4o-mini-transcribe": { status: "idle" },
    "assemblyai": { status: "idle" },
  });
  const [running, setRunning] = useState(false);

  // Past runs
  const { data: pastRuns = [] } = useQuery<PilotRun[]>({
    queryKey: ["transcription-pilot-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transcription_pilot_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as PilotRun[];
    },
  });

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // Cleanup audio URL on change
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // ── Recorder ────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      recordedChunksRef.current = [];

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 64000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: mime || "audio/webm",
        });
        await loadBlob(blob, `recording-${Date.now()}.webm`);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start(1000);
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      toast({
        title: "Microphone error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
  }

  async function loadBlob(blob: Blob, name: string) {
    if (blob.size > MAX_BYTES) {
      toast({
        title: "Audio too large",
        description: `${fmtBytes(blob.size)} exceeds the 25MB OpenAI limit.`,
        variant: "destructive",
      });
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(blob);
    const dur = await getAudioDuration(blob);
    setAudioBlob(blob);
    setAudioName(name);
    setAudioDuration(dur);
    setAudioUrl(url);
    setResults({
      "whisper-1": { status: "idle" },
      "gpt-4o-transcribe": { status: "idle" },
      "gpt-4o-mini-transcribe": { status: "idle" },
      "assemblyai": { status: "idle" },
    });
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void loadBlob(file, file.name);
    e.target.value = "";
  }

  // ── Run all three models ───────────────────────────────────────────────
  async function runAll() {
    if (!audioBlob) return;
    if (audioBlob.size > MAX_BYTES) {
      toast({
        title: "Audio too large",
        description: `${fmtBytes(audioBlob.size)} exceeds 25MB.`,
        variant: "destructive",
      });
      return;
    }

    setRunning(true);
    setResults({
      "whisper-1": { status: "running" },
      "gpt-4o-transcribe": { status: "running" },
      "gpt-4o-mini-transcribe": { status: "running" },
      "assemblyai": { status: "running" },
    });

    const callOne = async (model: ModelId): Promise<ResultState> => {
      try {
        const fd = new FormData();
        fd.append("file", audioBlob, audioName || "audio.webm");
        fd.append("model", model);
        fd.append("language", "en");
        if (prompt.trim()) fd.append("prompt", prompt);

        const { data, error } = await supabase.functions.invoke("pilot-transcribe", {
          body: fd,
        });
        if (error) {
          return { status: "error", error: error.message };
        }
        if (!data?.success) {
          return {
            status: "error",
            error: data?.error || "Unknown error",
            latencyMs: data?.latencyMs,
          };
        }
        return {
          status: "done",
          text: String(data.text || ""),
          latencyMs: Number(data.latencyMs) || 0,
        };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    };

    const [w1, g4o, g4oMini, aai] = await Promise.all([
      callOne("whisper-1").then((r) => {
        setResults((prev) => ({ ...prev, "whisper-1": r }));
        return r;
      }),
      callOne("gpt-4o-transcribe").then((r) => {
        setResults((prev) => ({ ...prev, "gpt-4o-transcribe": r }));
        return r;
      }),
      callOne("gpt-4o-mini-transcribe").then((r) => {
        setResults((prev) => ({ ...prev, "gpt-4o-mini-transcribe": r }));
        return r;
      }),
      callOne("assemblyai").then((r) => {
        setResults((prev) => ({ ...prev, "assemblyai": r }));
        return r;
      }),
    ]);

    // Save to DB
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const dur = audioDuration ?? 0;
        const cost = (price: number) => (dur > 0 ? Number(((dur / 60) * price).toFixed(5)) : null);
        await supabase.from("transcription_pilot_runs").insert({
          user_id: user.id,
          label: label.trim() || null,
          audio_duration_seconds: audioDuration,
          audio_size_bytes: audioBlob.size,
          audio_mime_type: audioBlob.type || null,
          prompt_used: prompt,
          whisper1_text: w1.text || null,
          whisper1_latency_ms: w1.latencyMs ?? null,
          whisper1_cost_usd: cost(0.006),
          whisper1_error: w1.error || null,
          gpt4o_text: g4o.text || null,
          gpt4o_latency_ms: g4o.latencyMs ?? null,
          gpt4o_cost_usd: cost(0.006),
          gpt4o_error: g4o.error || null,
          gpt4o_mini_text: g4oMini.text || null,
          gpt4o_mini_latency_ms: g4oMini.latencyMs ?? null,
          gpt4o_mini_cost_usd: cost(0.003),
          gpt4o_mini_error: g4oMini.error || null,
          assemblyai_text: aai.text || null,
          assemblyai_latency_ms: aai.latencyMs ?? null,
          assemblyai_cost_usd: cost(0.0062),
          assemblyai_error: aai.error || null,
        } as any);
        queryClient.invalidateQueries({ queryKey: ["transcription-pilot-runs"] });
      }
    } catch (err) {
      console.error("Failed to save pilot run:", err);
    }

    setRunning(false);
    toast({ title: "Pilot run complete", description: "All four models finished." });
  }

  // ── Result-derived helpers ──────────────────────────────────────────────
  function estCost(model: ModelId): string {
    const dur = audioDuration ?? 0;
    if (dur <= 0) return "—";
    const m = MODELS.find((x) => x.id === model)!;
    return `~$${((dur / 60) * m.pricePerMinute).toFixed(4)}`;
  }

  // ── Word export ────────────────────────────────────────────────────────
  async function exportWord() {
    const cellWidth = 3600; // landscape ≈ 14400 content / 4 cols
    const headerCell = (text: string) =>
      new TableCell({
        width: { size: cellWidth, type: WidthType.DXA },
        shading: { fill: "1F4E79", type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 24 })],
          }),
        ],
      });

    const metricCell = (model: ModelId) => {
      const r = results[model];
      const lat = r.latencyMs ? `${r.latencyMs} ms` : "—";
      const wc = wordCount(r.text);
      return new TableCell({
        width: { size: cellWidth, type: WidthType.DXA },
        shading: { fill: "F2F2F2", type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({ children: [new TextRun({ text: `Latency: ${lat}`, size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: `Cost: ${estCost(model)}`, size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: `Words: ${wc}`, size: 20 })] }),
        ],
      });
    };

    const transcriptCell = (model: ModelId) => {
      const r = results[model];
      const text = r.error ? `ERROR: ${r.error}` : r.text || "(empty)";
      const paragraphs = text
        .split(/\n+/)
        .map((line) => new Paragraph({ children: [new TextRun({ text: line || " ", size: 20 })] }));
      return new TableCell({
        width: { size: cellWidth, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun(" ")] })],
      });
    };

    const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const borders = { top: border, bottom: border, left: border, right: border };

    const table = new Table({
      width: { size: cellWidth * 4, type: WidthType.DXA },
      columnWidths: [cellWidth, cellWidth, cellWidth, cellWidth],
      rows: [
        new TableRow({
          tableHeader: true,
          children: MODELS.map((m) => {
            const cell = headerCell(m.label);
            (cell as any).options = { ...(cell as any).options, borders };
            return cell;
          }),
        }),
        new TableRow({
          children: MODELS.map((m) => {
            const cell = metricCell(m.id);
            (cell as any).options = { ...(cell as any).options, borders };
            return cell;
          }),
        }),
        new TableRow({
          children: MODELS.map((m) => {
            const cell = transcriptCell(m.id);
            (cell as any).options = { ...(cell as any).options, borders };
            return cell;
          }),
        }),
      ],
    });

    const doc = new Document({
      styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 12240,
                height: 15840,
                orientation: PageOrientation.LANDSCAPE,
              },
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: "Transcription Model Pilot", bold: true, size: 32 })],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${label || "Untitled run"} · ${new Date().toLocaleString("en-GB")}`,
                  size: 20,
                  color: "666666",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Audio: ${audioName} · ${fmtBytes(audioBlob?.size || 0)} · ${fmtSeconds(audioDuration)}`,
                  size: 20,
                  color: "666666",
                }),
              ],
            }),
            new Paragraph({ children: [new TextRun(" ")] }),
            table,
          ],
        },
      ],
    });

    const buffer = await Packer.toBlob(doc);
    const url = URL.createObjectURL(buffer);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription-pilot-${Date.now()}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function deleteRun(id: string) {
    const { error } = await supabase.from("transcription_pilot_runs").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["transcription-pilot-runs"] });
    if (expandedRunId === id) setExpandedRunId(null);
  }

  const canRun = !!audioBlob && !running && (audioBlob?.size ?? 0) <= MAX_BYTES;
  const anyResults = Object.values(results).some((r) => r.status === "done" || r.status === "error");

  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold">Transcription Model Pilot</h1>
          <Link to="/admin" className="text-sm text-primary hover:underline">
            ← Back to Admin
          </Link>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Compare <strong>whisper-1</strong>, <strong>gpt-4o-transcribe</strong>,{" "}
          <strong>gpt-4o-mini-transcribe</strong> and <strong>assemblyai</strong> side-by-side
          on the same audio. Pure model output — no UK normaliser, no hallucination filtering.
        </p>
      </div>

      {/* Audio input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Provide audio</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="record">
            <TabsList>
              <TabsTrigger value="record">Record</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="space-y-3 pt-3">
              <div className="flex items-center gap-3">
                {!recording ? (
                  <Button onClick={startRecording} variant="default">
                    <Mic className="mr-2 h-4 w-4" /> Start recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive">
                    <Square className="mr-2 h-4 w-4" /> Stop ({fmtSeconds(recordSeconds)})
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  Mono 16 kHz, 64 kbps Opus.
                </span>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-3 pt-3">
              <Input
                type="file"
                accept=".webm,.mp4,.m4a,.mp3,.wav,.ogg,audio/*"
                onChange={onUpload}
              />
              <p className="text-xs text-muted-foreground">
                Max 25 MB (OpenAI limit). Supported: webm, mp4, m4a, mp3, wav, ogg.
              </p>
            </TabsContent>
          </Tabs>

          {audioBlob && (
            <div className="mt-4 p-3 rounded border bg-muted/30 space-y-2">
              <div className="text-sm">
                <strong>{audioName}</strong> · {fmtBytes(audioBlob.size)} ·{" "}
                {fmtSeconds(audioDuration)} · {audioBlob.type || "unknown type"}
              </div>
              {audioUrl && <audio src={audioUrl} controls className="w-full" />}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Optional settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="label">Label (saved with the run)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. PCN board meeting, 4 May"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="prompt">Prompt</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPrompt(DEFAULT_PROMPT)}>
                  Reset to default
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPrompt("")}>
                  Use empty prompt
                </Button>
              </div>
            </div>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Run */}
      <Card>
        <CardContent className="pt-6">
          <Button onClick={runAll} disabled={!canRun} size="lg" className="w-full">
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transcribing…
              </>
            ) : (
              "Transcribe with all four models"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {MODELS.map((m) => {
          const r = results[m.id];
          return (
            <Card key={m.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono">{m.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Latency: {r.latencyMs ? `${r.latencyMs} ms` : "—"}</div>
                  <div>Est. cost: {estCost(m.id)}</div>
                  <div>Words: {wordCount(r.text)}</div>
                </div>

                {r.status === "running" && (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}

                {r.status === "error" && (
                  <div className="rounded border border-destructive/40 bg-destructive/10 text-destructive p-3 text-xs">
                    {r.error}
                  </div>
                )}

                {r.status === "done" && (
                  <>
                    <div className="rounded border bg-muted/20 p-2 text-xs whitespace-pre-wrap max-h-96 overflow-auto flex-1">
                      {r.text || "(empty)"}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(r.text || "");
                          toast({ title: "Copied" });
                        }}
                      >
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadText(`${m.id}-${Date.now()}.txt`, r.text || "")}
                      >
                        <Download className="mr-1 h-3 w-3" /> .txt
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {anyResults && (
        <Button onClick={exportWord} variant="secondary" className="w-full">
          <FileText className="mr-2 h-4 w-4" /> Download all as Word (.docx)
        </Button>
      )}

      {/* Past runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Past runs</CardTitle>
        </CardHeader>
        <CardContent>
          {pastRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No previous runs.</p>
          ) : (
            <div className="space-y-2">
              {pastRuns.map((run) => {
                const open = expandedRunId === run.id;
                return (
                  <div key={run.id} className="border rounded">
                    <div className="flex items-center justify-between p-3 gap-2">
                      <button
                        className="flex-1 text-left"
                        onClick={() => setExpandedRunId(open ? null : run.id)}
                      >
                        <div className="text-sm font-medium">
                          {run.label || "(no label)"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(run.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {fmtSeconds(run.audio_duration_seconds)} ·{" "}
                          {fmtBytes(run.audio_size_bytes ?? 0)}
                        </div>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRun(run.id)}
                        aria-label="Delete run"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {open && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-3 border-t bg-muted/10">
                        {[
                          { label: "whisper-1", text: run.whisper1_text, lat: run.whisper1_latency_ms, err: run.whisper1_error },
                          { label: "gpt-4o-transcribe", text: run.gpt4o_text, lat: run.gpt4o_latency_ms, err: run.gpt4o_error },
                          { label: "gpt-4o-mini-transcribe", text: run.gpt4o_mini_text, lat: run.gpt4o_mini_latency_ms, err: run.gpt4o_mini_error },
                          { label: "assemblyai", text: run.assemblyai_text, lat: run.assemblyai_latency_ms, err: run.assemblyai_error },
                        ].map((col) => (
                          <div key={col.label} className="space-y-1">
                            <div className="text-xs font-mono font-semibold">{col.label}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {col.lat ? `${col.lat} ms` : "—"} · {wordCount(col.text)} words
                            </div>
                            {col.err ? (
                              <div className="text-xs text-destructive p-2 rounded border border-destructive/40 bg-destructive/10">
                                {col.err}
                              </div>
                            ) : (
                              <div className="text-xs whitespace-pre-wrap p-2 rounded border bg-background max-h-64 overflow-auto">
                                {col.text || "(empty)"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
