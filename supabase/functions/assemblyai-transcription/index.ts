import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return new Response("OpenAI API key not configured", { status: 500 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  let isRecording = false;
  let audioBuffer: Uint8Array[] = [];
  let isProcessing = false; // Prevent concurrent processing

  socket.onopen = () => {
    console.log("Client WebSocket connected");
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received message:", message.type);

      if (message.type === 'start_transcription') {
        isRecording = true;
        audioBuffer = [];
        
        socket.send(JSON.stringify({ 
          type: 'session_started',
          message: 'Real-time transcription started'
        }));

      } else if (message.type === 'audio_data' && isRecording) {
        // Store audio data for batched processing
        const audioData = Uint8Array.from(atob(message.audio_data), c => c.charCodeAt(0));
        audioBuffer.push(audioData);
        console.log(`Received audio chunk, buffer size: ${audioBuffer.length}`);

        // Process audio every 2 chunks (roughly 6 seconds) for better accuracy
        if (audioBuffer.length >= 2 && !isProcessing) {
          console.log("Processing audio batch...");
          processAudioBatch(); // Don't await to prevent blocking
        }

      } else if (message.type === 'stop_transcription') {
        isRecording = false;
        // Process any remaining audio
        if (audioBuffer.length > 0 && !isProcessing) {
          processAudioBatch(); // Don't await to prevent blocking
        }
        socket.send(JSON.stringify({
          type: 'session_ended',
          message: 'Transcription session ended'
        }));
      }
    } catch (error) {
      console.error("Error processing message:", error);
      socket.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  };

  async function processAudioBatch() {
    if (audioBuffer.length === 0 || isProcessing) return;
    
    isProcessing = true;
    console.log("Starting audio processing...");

    try {
      // Combine audio chunks
      const totalLength = audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedAudio = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of audioBuffer) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert to base64 for OpenAI Whisper API
      const base64Audio = btoa(String.fromCharCode(...combinedAudio));

      // Prepare form data for Whisper API
      const formData = new FormData();
      const blob = new Blob([combinedAudio], { type: 'audio/webm' });
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      formData.append('response_format', 'verbose_json');

      console.log("Sending request to OpenAI Whisper API");
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI Whisper API error:", response.status, errorText);
        socket.send(JSON.stringify({
          type: 'error',
          message: `Whisper API error: ${response.status}`
        }));
        return;
      }

      const result = await response.json();
      console.log("OpenAI Whisper response:", result);

      if (result.text && result.text.trim()) {
        // Whisper returns a single text result
        socket.send(JSON.stringify({
          type: 'transcript',
          text: result.text.trim(),
          speaker: 'Speaker 1',
          confidence: 0.95, // Whisper doesn't provide confidence, use high default
          timestamp: new Date().toISOString(),
          is_final: true,
          words: result.words || []
        }));
        
        console.log("Transcription sent:", result.text.trim());
      } else {
        console.log("No transcription text received from Whisper");
      }

      // Clear the buffer after processing
      audioBuffer = [];
      console.log("Audio batch processed successfully, buffer cleared");

    } catch (error) {
      console.error("Error processing audio:", error);
      // Clear buffer on error to prevent stuck state
      audioBuffer = [];
      socket.send(JSON.stringify({
        type: 'error',
        message: `Processing error: ${error.message}`
      }));
    } finally {
      isProcessing = false;
      console.log("Processing complete, ready for next batch");
    }
  }

  socket.onclose = () => {
    console.log("Client WebSocket disconnected");
    isRecording = false;
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
    isRecording = false;
  };

  return response;
});