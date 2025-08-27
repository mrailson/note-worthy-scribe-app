import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { 
  TranscribeStreamingClient, 
  StartStreamTranscriptionCommand,
  type TranscriptEvent,
  type Result
} from "npm:@aws-sdk/client-transcribe-streaming@3.876.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

type Session = {
  id: string;
  client: TranscribeStreamingClient;
  push: (chunk: Uint8Array) => void;
  end: () => void;
  startedAt: number;
  listeners: Set<ReadableStreamDefaultController>;
  closed: boolean;
};

const sessions = new Map<string, Session>();

function makeAudioStream() {
  let _ended = false;
  const queue: Uint8Array[] = [];
  let resolveRead: ((v: IteratorResult<any>) => void) | null = null;

  const iterator = {
    async next(): Promise<IteratorResult<any>> {
      if (_ended && queue.length === 0) return { done: true, value: undefined };
      if (queue.length > 0) {
        const chunk = queue.shift()!;
        return { done: false, value: { AudioEvent: { AudioChunk: chunk } } };
      }
      return await new Promise<IteratorResult<any>>(res => (resolveRead = res));
    },
    async return(): Promise<IteratorResult<any>> { 
      _ended = true; 
      return { done: true, value: undefined }; 
    },
    [Symbol.asyncIterator]() { return this; }
  } as AsyncIterableIterator<any>;

  return {
    iterator,
    push(b: Uint8Array) {
      if (_ended) return;
      if (resolveRead) { 
        const r = resolveRead; 
        resolveRead = null; 
        r({ done: false, value: { AudioEvent: { AudioChunk: b } } }); 
      } else {
        queue.push(b);
      }
    },
    end() { 
      _ended = true; 
      if (resolveRead) { 
        const r = resolveRead; 
        resolveRead = null; 
        r({ done: true, value: undefined }); 
      } 
    }
  };
}

function writeSSE(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const sessionId = url.searchParams.get('sessionId');

  console.log(`AWS Transcribe Proxy called with action: ${action}, sessionId: ${sessionId}`);

  try {
    if (req.method === "POST" && action === "start") {
      const id = crypto.randomUUID();
      const region = Deno.env.get('AWS_REGION') || "eu-west-2";
      const lang = Deno.env.get('TRANSCRIBE_LANGUAGE_CODE') || "en-GB";
      const rate = Number(Deno.env.get('TRANSCRIBE_SAMPLE_RATE') || 16000);

      console.log(`Starting transcription session ${id} with region: ${region}, language: ${lang}, sample rate: ${rate}`);

      const client = new TranscribeStreamingClient({ 
        region,
        credentials: {
          accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
        }
      });

      const { iterator, push, end } = makeAudioStream();

      const cmd = new StartStreamTranscriptionCommand({
        LanguageCode: lang as any,
        MediaEncoding: "pcm",
        MediaSampleRateHertz: rate,
        AudioStream: iterator,
        EnablePartialResultsStabilization: true,
        PartialResultsStability: "medium",
      });

      const session: Session = { 
        id, 
        client, 
        push, 
        end, 
        startedAt: Date.now(), 
        listeners: new Set(), 
        closed: false 
      };
      sessions.set(id, session);

      // Start the transcription stream
      (async () => {
        try {
          console.log(`Sending StartStreamTranscriptionCommand for session ${id}`);
          const resp = await client.send(cmd);
          console.log(`Transcription stream started for session ${id}`);
          
          for await (const ev of resp.TranscriptResultStream ?? []) {
            console.log(`Received event:`, ev);
            
            if ('TranscriptEvent' in ev && ev.TranscriptEvent) {
              const transcriptEvent = ev.TranscriptEvent as TranscriptEvent;
              const results = transcriptEvent.Transcript?.Results || [];
              
              for (const r of results) {
                const isPartial = r?.IsPartial || false;
                const alt = r?.Alternatives?.[0];
                const text = alt?.Transcript || "";
                if (!text) continue;
                
                console.log(`Transcription ${isPartial ? 'partial' : 'final'}: ${text}`);
                
                for (const controller of session.listeners) {
                  try {
                    writeSSE(controller, isPartial ? "partial" : "final", { text });
                  } catch (e) {
                    console.error('Error writing SSE:', e);
                  }
                }
              }
            }
          }
        } catch (e: any) {
          console.error(`Transcription error for session ${id}:`, e);
          for (const controller of session.listeners) {
            try {
              writeSSE(controller, "error", { message: e?.message || "stream error" });
            } catch {}
          }
        } finally {
          console.log(`Transcription stream ended for session ${id}`);
          for (const controller of session.listeners) {
            try {
              writeSSE(controller, "end", { ok: true });
              controller.close();
            } catch {}
          }
          session.closed = true;
          sessions.delete(id);
        }
      })();

      return new Response(JSON.stringify({ sessionId: id, region, lang, rate }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === "POST" && action === "push" && sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: "no such session" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const audioData = await req.arrayBuffer();
      if (audioData.byteLength > 0) {
        session.push(new Uint8Array(audioData));
        console.log(`Pushed ${audioData.byteLength} bytes to session ${sessionId}`);
      }
      
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (req.method === "GET" && action === "events" && sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: "no such session" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const stream = new ReadableStream({
        start(controller) {
          console.log(`SSE stream started for session ${sessionId}`);
          writeSSE(controller, "ready", { ok: true });
          session.listeners.add(controller);
        },
        cancel() {
          console.log(`SSE stream cancelled for session ${sessionId}`);
          session.listeners.delete(this);
        }
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    if (req.method === "POST" && action === "stop" && sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: "no such session" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`Stopping session ${sessionId}`);
      session.end();
      
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action or method" }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in AWS Transcribe Proxy:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);