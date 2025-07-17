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

  const GOOGLE_CLOUD_API_KEY = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!GOOGLE_CLOUD_API_KEY) {
    return new Response("Google Cloud API key not configured", { status: 500 });
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

        // Process audio every 3 chunks (roughly 3 seconds) for better transcription accuracy
        if (audioBuffer.length >= 3 && !isProcessing) {
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

      // Convert to base64 for Google Cloud API
      const base64Audio = btoa(String.fromCharCode(...combinedAudio));

      // Call Google Cloud Speech-to-Text API
      const requestBody = {
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          model: 'latest_short',
          speechContexts: [{
            phrases: ['NHS', 'medical', 'patient', 'consultation', 'clinical', 'diagnosis', 'treatment', 'prescription']
          }]
        },
        audio: {
          content: base64Audio
        }
      };

      console.log("Sending request to Google Cloud with config:", requestBody.config);
      
      const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_CLOUD_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Cloud API error:", response.status, errorText);
        socket.send(JSON.stringify({
          type: 'error',
          message: `Google Cloud API error: ${response.status}`
        }));
        return;
      }

      const result = await response.json();
      console.log("Google Cloud response:", result);
      console.log("Number of results:", result.results?.length || 0);

      if (result.results && result.results.length > 0) {
        for (const resultItem of result.results) {
          if (resultItem.alternatives && resultItem.alternatives.length > 0) {
            const alternative = resultItem.alternatives[0];
            
            let speaker = 'Speaker 1';
            if (resultItem.speakerTag) {
              speaker = `Speaker ${resultItem.speakerTag}`;
            }

            socket.send(JSON.stringify({
              type: 'transcript',
              text: alternative.transcript,
              speaker: speaker,
              confidence: alternative.confidence || 0.8,
              timestamp: new Date().toISOString(),
              is_final: true,
              words: alternative.words || []
            }));
          }
        }
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