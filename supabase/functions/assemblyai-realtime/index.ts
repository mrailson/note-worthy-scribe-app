import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  console.log('🚀 AssemblyAI WebSocket proxy request received');
  
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
    
    let assemblySocket: WebSocket | null = null;

    socket.onopen = () => {
      console.log('✅ Client WebSocket opened');
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 Received message from client:', message.type || 'audio data');
        
        // Handle session start message to create AssemblyAI connection
        if (message.type === 'session.start') {
          const AAI_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
          if (!AAI_KEY) {
            socket.send(JSON.stringify({ 
              type: 'error', 
              error: 'Missing ASSEMBLYAI_API_KEY' 
            }));
            return;
          }

          console.log('🔗 Creating AssemblyAI WebSocket connection...');
          const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=${message.sample_rate || 16000}&format_turns=${message.format_turns || true}`;
          
          // Get token from AssemblyAI
          const tokenResponse = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=300', {
            method: 'GET',
            headers: { Authorization: AAI_KEY }
          });
          
          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Token request failed:', errorText);
            socket.send(JSON.stringify({ 
              type: 'error', 
              error: `Token request failed: ${errorText}` 
            }));
            return;
          }
          
          const tokenData = await tokenResponse.json();
          const tokenWsUrl = `${wsUrl}&token=${encodeURIComponent(tokenData.token)}`;
          
          assemblySocket = new WebSocket(tokenWsUrl);
          
          assemblySocket.onopen = () => {
            console.log('✅ AssemblyAI WebSocket connected');
            socket.send(JSON.stringify({ 
              type: 'session_begins',
              session_id: Date.now().toString()
            }));
          };
          
          assemblySocket.onmessage = (assemblyEvent) => {
            console.log('📝 Forwarding message from AssemblyAI to client');
            socket.send(assemblyEvent.data);
          };
          
          assemblySocket.onerror = (error) => {
            console.error('❌ AssemblyAI WebSocket error:', error);
            socket.send(JSON.stringify({ 
              type: 'error', 
              error: 'AssemblyAI connection error' 
            }));
          };
          
          assemblySocket.onclose = () => {
            console.log('🔌 AssemblyAI WebSocket closed');
            socket.send(JSON.stringify({ type: 'session_terminated' }));
          };
          
        } else if (assemblySocket && assemblySocket.readyState === WebSocket.OPEN) {
          // Forward other messages to AssemblyAI
          assemblySocket.send(event.data);
        }
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
        if (typeof event.data === 'string') {
          // Handle JSON messages
          socket.send(JSON.stringify({ 
            type: 'error', 
            error: 'Failed to process message' 
          }));
        }
        // Binary data (audio) - just forward if AssemblyAI socket is ready
        if (assemblySocket && assemblySocket.readyState === WebSocket.OPEN) {
          assemblySocket.send(event.data);
        }
      }
    };

    socket.onclose = () => {
      console.log('🔌 Client WebSocket closed');
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