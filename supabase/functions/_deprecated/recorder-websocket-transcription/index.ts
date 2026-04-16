import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log('[RecorderWS] WebSocket connection initiated');
  
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let audioChunks: Uint8Array[] = [];
  let chunkCounter = 0;

  socket.onopen = () => {
    console.log('[RecorderWS] WebSocket connection opened');
    socket.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      message: 'Ready to receive audio data'
    }));
  };

  socket.onmessage = async (event) => {
    try {
      if (event.data instanceof ArrayBuffer) {
        // Handle binary audio data
        const audioData = new Uint8Array(event.data);
        audioChunks.push(audioData);
        chunkCounter++;
        
        console.log(`[RecorderWS] Received audio chunk ${chunkCounter}, size: ${audioData.length} bytes`);
        
        // Process every few chunks to get incremental transcription
        if (chunkCounter % 3 === 0) {
          await processAudioChunks(audioChunks, socket);
          audioChunks = []; // Reset chunks after processing
        }
      } else {
        // Handle text messages (control commands)
        const message = JSON.parse(event.data);
        console.log('[RecorderWS] Received message:', message);
        
        if (message.type === 'stop' || message.type === 'flush') {
          // Process remaining chunks on stop/flush
          if (audioChunks.length > 0) {
            await processAudioChunks(audioChunks, socket);
            audioChunks = [];
          }
        }
      }
    } catch (error) {
      console.error('[RecorderWS] Error processing message:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  };

  socket.onclose = () => {
    console.log('[RecorderWS] WebSocket connection closed');
  };

  socket.onerror = (error) => {
    console.error('[RecorderWS] WebSocket error:', error);
  };

  return response;
});

async function processAudioChunks(chunks: Uint8Array[], socket: WebSocket) {
  if (chunks.length === 0) return;
  
  try {
    console.log(`[RecorderWS] Processing ${chunks.length} audio chunks`);
    
    // Combine all chunks into a single blob
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Create form data for OpenAI Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([combinedAudio], { type: 'audio/webm;codecs=opus' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    formData.append('language', 'en');
    
    console.log(`[RecorderWS] Sending ${combinedAudio.length} bytes to OpenAI Whisper`);
    
    // Send to OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[RecorderWS] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('[RecorderWS] Transcription result:', result);
    
    // Send transcription back to client
    if (result.text && result.text.trim()) {
      socket.send(JSON.stringify({
        type: 'transcription',
        text: result.text,
        timestamp: new Date().toISOString(),
        confidence: 1.0 // Whisper doesn't provide confidence scores
      }));
    }
    
  } catch (error) {
    console.error('[RecorderWS] Error processing audio chunks:', error);
    socket.send(JSON.stringify({
      type: 'error',
      message: `Transcription failed: ${error.message}`
    }));
  }
}