import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function safeSend(ws: WebSocket, data: string | ArrayBuffer | Uint8Array) {
  try {
    // @ts-ignore - readyState exists in the edge runtime
    if (ws.readyState !== WebSocket.OPEN) return;
    // @ts-ignore
    ws.send(data);
  } catch (err) {
    console.error('❌ WebSocket send failed:', err);
  }
}

Deno.serve(async (req: Request) => {
  console.log('🚀 AssemblyAI WebSocket proxy request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let assemblySocket: WebSocket | null = null;
    let clientClosed = false;

    // Keyterms received from client before session init
    let pendingKeyterms: string[] = [];
    let sessionInitialised = false;

    // Audio frame stats (avoid chatty logs)
    let audioFrames = 0;
    let audioBytes = 0;
    let lastAudioLogAt = Date.now();

    socket.onopen = () => {
      console.log('✅ Client WebSocket opened');
      // Wait briefly for a possible configure message before starting session
      setTimeout(() => {
        if (!sessionInitialised && !clientClosed) {
          initAssemblyAIConnection();
        }
      }, 200);
    };

    async function initAssemblyAIConnection() {
      if (sessionInitialised) return;
      sessionInitialised = true;

      try {
        const AAI_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
        if (!AAI_KEY) {
          safeSend(socket, JSON.stringify({ type: 'error', error: 'Missing ASSEMBLYAI_API_KEY' }));
          return;
        }

        console.log('🔗 Creating AssemblyAI v3 WebSocket connection...');

        // Get token (9-minute expiry)
        const tokenResponse = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=540', {
          method: 'GET',
          headers: { Authorization: AAI_KEY }
        });
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('❌ Token request failed:', errorText);
          safeSend(socket, JSON.stringify({ type: 'error', error: `Token request failed: ${errorText}` }));
          return;
        }
        
        const tokenData = await tokenResponse.json();

        // Build v3 WebSocket URL with parameters
        let wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&format_turns=true&token=${encodeURIComponent(tokenData.token)}`;

        // Add keyterms if provided by client
        if (pendingKeyterms.length > 0) {
          const keytermsParam = pendingKeyterms.join(',');
          wsUrl += `&keyterms=${encodeURIComponent(keytermsParam)}`;
          console.log(`🔑 Including ${pendingKeyterms.length} keyterms in AssemblyAI connection`);
        }
        
        if (clientClosed) {
          console.log('⚠️ Client already closed; aborting AssemblyAI connection init');
          return;
        }

        assemblySocket = new WebSocket(wsUrl);
        
        assemblySocket.onopen = () => {
          console.log('✅ AssemblyAI WebSocket connected');
          safeSend(socket, JSON.stringify({ 
            type: 'session_begins',
            session_id: Date.now().toString()
          }));
        };
        
        let assemblyMsgCount = 0;
        assemblySocket.onmessage = (assemblyEvent) => {
          assemblyMsgCount++;
          try {
            if (typeof assemblyEvent.data === 'string') {
              // Check for error messages before the connection closes
              const parsed = JSON.parse(assemblyEvent.data);
              if (parsed.error || parsed.type === 'error') {
                console.error(`❗ AssemblyAI error message #${assemblyMsgCount}:`, assemblyEvent.data);
              }
            }
          } catch { /* ignore non-JSON */ }
          if (assemblyMsgCount <= 5 || assemblyMsgCount % 20 === 0) {
            try {
              const preview = typeof assemblyEvent.data === 'string' 
                ? assemblyEvent.data.substring(0, 200) 
                : `[binary ${(assemblyEvent.data as ArrayBuffer).byteLength}B]`;
              console.log(`📝 AssemblyAI msg #${assemblyMsgCount}: ${preview}`);
            } catch { /* ignore */ }
          }
          safeSend(socket, assemblyEvent.data);
        };
        
        assemblySocket.onerror = (error) => {
          console.error('❌ AssemblyAI WebSocket error:', error);
          safeSend(socket, JSON.stringify({ type: 'error', error: 'AssemblyAI connection error' }));
        };
        
        assemblySocket.onclose = (closeEvent) => {
          console.log('🔌 AssemblyAI WebSocket closed:', closeEvent.code, closeEvent.reason);

          const reason = (closeEvent.reason || '').trim();
          const isClean = closeEvent.code === 1000;

          if (!isClean) {
            safeSend(socket, JSON.stringify({
              type: 'error',
              error: reason
                ? `AssemblyAI closed (${closeEvent.code}): ${reason}`
                : `AssemblyAI closed (${closeEvent.code}).`
            }));
            return;
          }

          safeSend(socket, JSON.stringify({
            type: 'session_terminated',
            code: closeEvent.code,
            reason: closeEvent.reason
          }));
        };
      } catch (error) {
        console.error('❌ Failed to initialize AssemblyAI connection:', error);
        safeSend(socket, JSON.stringify({ type: 'error', error: 'Failed to initialize AssemblyAI connection' }));
      }
    }

    socket.onmessage = async (event) => {
      try {
        // Handle binary data (raw PCM16 audio)
        if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
          const bytes = event.data instanceof ArrayBuffer ? event.data.byteLength : event.data.byteLength;
          audioFrames += 1;
          audioBytes += bytes;

          // First-frame diagnostic
          if (audioFrames === 1) {
            console.log(`🔍 First audio frame to AssemblyAI: ${bytes} bytes, type: ${event.data.constructor.name}`);
          }

          const now = Date.now();
          if (now - lastAudioLogAt >= 5000) {
            console.log(`📡 Audio streaming: ${audioFrames} frame(s), ${(audioBytes / 1024).toFixed(1)} KB in last 5s`);
            audioFrames = 0;
            audioBytes = 0;
            lastAudioLogAt = now;
          }

          if (assemblySocket) {
            try {
              // @ts-ignore
              if (assemblySocket.readyState === WebSocket.OPEN) {
                // @ts-ignore
                assemblySocket.send(event.data);
              }
            } catch (err) {
              console.error('❌ Failed to forward audio to AssemblyAI:', err);
            }
          }
          return;
        }
        
        // Handle text/JSON messages
        const message = JSON.parse(event.data);
        
        // Configure message — receive keyterms before session init
        if (message.type === 'configure') {
          if (Array.isArray(message.keyterms)) {
            pendingKeyterms = message.keyterms
              .filter((t: unknown) => typeof t === 'string' && t.length > 0 && t.length <= 50)
              .slice(0, 100);
            console.log(`🔑 Received ${pendingKeyterms.length} keyterms from client`);
          }
          // If session hasn't started yet, init now with keyterms
          if (!sessionInitialised) {
            initAssemblyAIConnection();
          }
          return;
        }
        
        if (message.type === 'terminate') {
          console.log('🔌 Received terminate signal');
          if (assemblySocket) {
            assemblySocket.close();
          }
          socket.close();
        }
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
        safeSend(socket, JSON.stringify({ type: 'error', error: 'Failed to process message' }));
      }
    };

    socket.onclose = () => {
      console.log('🔌 Client WebSocket closed');
      clientClosed = true;
      if (assemblySocket) {
        assemblySocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
      if (assemblySocket) {
        assemblySocket.close();
      }
    };

    return response;
    
  } catch (error) {
    console.error('❌ WebSocket upgrade failed:', error);
    return new Response(`WebSocket upgrade failed: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
