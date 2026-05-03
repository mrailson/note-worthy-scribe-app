// jsr type import removed (causes deploy timeouts)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  console.log('🚀 Deepgram streaming proxy request received');
  
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

  // ---- AUTH GUARD (token via query param for WebSocket) ----
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const vr = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
    });
    if (!vr.ok) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders });
    }
  } catch (_e) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  // ---- /AUTH GUARD ----

  try {
    console.log('🔌 Upgrading to WebSocket...');
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let deepgramSocket: WebSocket | null = null;

    socket.onopen = () => {
      console.log('✅ Client WebSocket opened');
    };

    socket.onmessage = async (event) => {
      try {
        // Handle binary data (audio)
        // In Deno, binary WebSocket messages can arrive as Uint8Array.
        if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
          if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
            const payload = event.data instanceof Uint8Array ? event.data : new Uint8Array(event.data);
            deepgramSocket.send(payload);
          }
          return;
        }
        
        // Handle text/JSON messages
        const message = JSON.parse(event.data);
        console.log('📨 Received message from client:', message.type || 'unknown');

        // Handle keepalive ping/pong
        if (message.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          return;
        }
        
        // Handle session start message to create Deepgram connection
        if (message.type === 'session.start') {
          const DEEPGRAM_KEY = Deno.env.get("DEEPGRAM_API_KEY");
          if (!DEEPGRAM_KEY) {
            socket.send(JSON.stringify({ 
              type: 'error', 
              error: 'Missing DEEPGRAM_API_KEY' 
            }));
            return;
          }

          console.log('🔗 Creating Deepgram WebSocket connection...');
          const deepgramUrl = `wss://api.deepgram.com/v1/listen?` + new URLSearchParams({
            model: 'nova-3',
            language: 'en-GB',
            smart_format: 'true',
            interim_results: 'true',
            endpointing: '300',
            vad_events: 'true',
            punctuate: 'true',
            profanity_filter: 'false',
            diarize: 'true',
            encoding: 'linear16',
            // Must match the client-side PCM stream sample rate (see src/lib/audio/pcm16.ts)
            sample_rate: '16000',
            channels: '1'
          }).toString();
          
          deepgramSocket = new WebSocket(deepgramUrl, ['token', DEEPGRAM_KEY]);
          
          deepgramSocket.onopen = () => {
            console.log('✅ Deepgram WebSocket connected');
            socket.send(JSON.stringify({ 
              type: 'session_begins',
              session_id: Date.now().toString()
            }));
          };
          
          deepgramSocket.onmessage = (deepgramEvent) => {
            console.log('📝 Forwarding message from Deepgram to client');
            socket.send(deepgramEvent.data);
          };
          
          deepgramSocket.onerror = (error) => {
            console.error('❌ Deepgram WebSocket error:', error);
            socket.send(JSON.stringify({ 
              type: 'error', 
              error: 'Deepgram connection error' 
            }));
          };
          
          deepgramSocket.onclose = (closeEvent) => {
            console.log('🔌 Deepgram WebSocket closed:', closeEvent.code, closeEvent.reason);
            socket.send(JSON.stringify({ 
              type: 'session_terminated',
              code: closeEvent.code,
              reason: closeEvent.reason
            }));
          };
          
        } else if (message.type === 'terminate') {
          console.log('🔌 Received terminate signal');
          if (deepgramSocket) {
            deepgramSocket.close();
          }
          socket.close();
        }
        
      } catch (error) {
        console.error('❌ Error processing JSON message:', error);
        socket.send(JSON.stringify({ 
          type: 'error', 
          error: 'Failed to process message' 
        }));
      }
    };

    socket.onclose = () => {
      console.log('🔌 Client WebSocket closed');
      if (deepgramSocket) {
        deepgramSocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
      if (deepgramSocket) {
        deepgramSocket.close();
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