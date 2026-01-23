import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  console.log('🚀 Google Cloud Speech streaming proxy request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Not a WebSocket upgrade request');
    return new Response("Expected WebSocket connection", { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔌 Upgrading to WebSocket...');
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let audioBuffer: Uint8Array[] = [];
    let isSessionActive = false;
    let processingInterval: number | null = null;

    socket.onopen = () => {
      console.log('✅ Client WebSocket opened');
    };

    socket.onmessage = async (event) => {
      try {
        // Handle binary data (audio)
        if (event.data instanceof ArrayBuffer) {
          if (isSessionActive) {
            audioBuffer.push(new Uint8Array(event.data));
          }
          return;
        }
        
        // Handle text/JSON messages
        const message = JSON.parse(event.data);
        console.log('📨 Received message from client:', message.type || 'unknown');
        
        if (message.type === 'session.start') {
          const GOOGLE_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");
          if (!GOOGLE_API_KEY) {
            socket.send(JSON.stringify({ 
              type: 'error', 
              error: 'Missing GOOGLE_CLOUD_API_KEY' 
            }));
            return;
          }

          isSessionActive = true;
          audioBuffer = [];
          
          console.log('✅ Google Cloud Speech session started');
          socket.send(JSON.stringify({ 
            type: 'session_begins',
            session_id: Date.now().toString()
          }));
          
          // Process audio chunks every 3 seconds
          processingInterval = setInterval(async () => {
            if (audioBuffer.length === 0) return;
            
            const chunks = audioBuffer.splice(0, audioBuffer.length);
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              combined.set(chunk, offset);
              offset += chunk.length;
            }
            
            try {
              // Convert to base64
              let binary = '';
              for (let i = 0; i < combined.length; i++) {
                binary += String.fromCharCode(combined[i]);
              }
              const base64Audio = btoa(binary);
              
              // Call Google Cloud Speech-to-Text REST API
              const response = await fetch(
                `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    config: {
                      encoding: 'LINEAR16',
                      sampleRateHertz: 24000,
                      languageCode: 'en-GB',
                      enableAutomaticPunctuation: true,
                      model: 'latest_long',
                      useEnhanced: true,
                    },
                    audio: {
                      content: base64Audio
                    }
                  })
                }
              );
              
              const result = await response.json();
              
              if (result.results && result.results.length > 0) {
                for (const res of result.results) {
                  if (res.alternatives && res.alternatives.length > 0) {
                    const transcript = res.alternatives[0].transcript;
                    const confidence = res.alternatives[0].confidence || 0.9;
                    
                    if (transcript?.trim()) {
                      console.log('📝 Google transcription:', transcript.substring(0, 50));
                      socket.send(JSON.stringify({
                        type: 'transcription',
                        transcript: transcript,
                        is_final: true,
                        confidence: confidence
                      }));
                    }
                  }
                }
              }
            } catch (err) {
              console.error('❌ Google API error:', err);
            }
          }, 3000);
          
        } else if (message.type === 'terminate') {
          console.log('🔌 Received terminate signal');
          isSessionActive = false;
          if (processingInterval) {
            clearInterval(processingInterval);
            processingInterval = null;
          }
          socket.close();
        }
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
        socket.send(JSON.stringify({ 
          type: 'error', 
          error: 'Failed to process message' 
        }));
      }
    };

    socket.onclose = () => {
      console.log('🔌 Client WebSocket closed');
      isSessionActive = false;
      if (processingInterval) {
        clearInterval(processingInterval);
      }
    };

    socket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
      isSessionActive = false;
      if (processingInterval) {
        clearInterval(processingInterval);
      }
    };

    return response;
    
  } catch (error) {
    console.error('❌ WebSocket upgrade failed:', error);
    return new Response(`WebSocket upgrade failed: ${(error as Error).message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
