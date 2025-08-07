import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!openAIApiKey) {
  console.error('OPENAI_API_KEY is not set');
}

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// Audio queue for managing sequential transcription
class AudioTranscriptionQueue {
  private queue: { audio: string; sessionId: string; chunkNumber: number }[] = [];
  private processing = false;

  async addToQueue(audio: string, sessionId: string, chunkNumber: number) {
    this.queue.push({ audio, sessionId, chunkNumber });
    if (!this.processing) {
      await this.processQueue();
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const { audio, sessionId, chunkNumber } = this.queue.shift()!;

    try {
      const transcription = await this.transcribeAudio(audio);
      
      // Store in database
      await supabase
        .from('meeting_transcription_chunks')
        .insert({
          session_id: sessionId,
          chunk_number: chunkNumber,
          transcription_text: transcription,
          confidence_score: 0.95,
          timestamp: new Date().toISOString()
        });

      console.log(`Transcribed chunk ${chunkNumber}:`, transcription.substring(0, 100));
    } catch (error) {
      console.error(`Error transcribing chunk ${chunkNumber}:`, error.message);
    }

    // Process next item
    this.processQueue();
  }

  private async transcribeAudio(audioBase64: string): Promise<string> {
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const formData = new FormData();
    const blob = new Blob([bytes], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('temperature', '0');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    return await response.text();
  }
}

const transcriptionQueue = new AudioTranscriptionQueue();

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  let sessionId: string | null = null;
  let chunkCounter = 0;

  socket.onopen = () => {
    console.log('WebSocket connection opened');
    socket.send(JSON.stringify({ type: 'connected', message: 'Real-time transcription ready' }));
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'start_session':
          sessionId = data.sessionId;
          chunkCounter = 0;
          console.log(`Started session: ${sessionId}`);
          socket.send(JSON.stringify({ 
            type: 'session_started', 
            sessionId,
            message: 'Session started successfully' 
          }));
          break;

        case 'audio_chunk':
          if (!sessionId) {
            socket.send(JSON.stringify({ 
              type: 'error', 
              message: 'Session not started' 
            }));
            return;
          }

          chunkCounter++;
          console.log(`Received audio chunk ${chunkCounter} for session ${sessionId}`);
          
          // Add to transcription queue
          await transcriptionQueue.addToQueue(data.audio, sessionId, chunkCounter);
          
          socket.send(JSON.stringify({ 
            type: 'chunk_received', 
            chunkNumber: chunkCounter,
            message: 'Audio chunk queued for transcription' 
          }));
          break;

        case 'end_session':
          console.log(`Ended session: ${sessionId}`);
          socket.send(JSON.stringify({ 
            type: 'session_ended', 
            sessionId,
            totalChunks: chunkCounter,
            message: 'Session ended successfully' 
          }));
          sessionId = null;
          chunkCounter = 0;
          break;

        default:
          socket.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unknown message type' 
          }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to process message' 
      }));
    }
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed');
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});