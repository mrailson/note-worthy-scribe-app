import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
        if (event.data instanceof ArrayBuffer) {
          console.log('📡 Received binary audio data, size:', event.data.byteLength);
          if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
            deepgramSocket.send(event.data);
          }
          return;
        }
        
        // Handle text/JSON messages
        const message = JSON.parse(event.data);
        console.log('📨 Received message from client:', message.type || 'unknown');
        
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
            model: 'nova-2',
            language: 'en-GB',
            smart_format: 'true',
            interim_results: 'true',
            endpointing: '300',
            vad_events: 'true',
            punctuate: 'true',
            profanity_filter: 'false',
            encoding: 'linear16',
            sample_rate: '24000',
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