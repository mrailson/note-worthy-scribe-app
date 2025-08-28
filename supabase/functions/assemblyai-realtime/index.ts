import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('AssemblyAI Realtime function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  if (req.headers.get("upgrade") === "websocket") {
    console.log('WebSocket upgrade requested for AssemblyAI');
    return handleWebSocketUpgrade(req);
  }

  return new Response('Expected WebSocket upgrade', { status: 400, headers: corsHeaders });
});

// WebSocket handler for real-time streaming
async function handleWebSocketUpgrade(req: Request): Promise<Response> {
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let assemblyAiWebSocket: WebSocket | null = null;
  let isConnected = false;
  
  socket.onopen = async () => {
    console.log('Client WebSocket connected to AssemblyAI proxy');
    
    try {
      const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
      if (!apiKey) {
        throw new Error('AssemblyAI API key not configured');
      }
      
      // Create session with AssemblyAI
      const sessionResponse = await fetch('https://api.assemblyai.com/v2/realtime/token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sample_rate: 16000,
          word_boost: ['medical', 'healthcare', 'diagnosis', 'treatment', 'patient'],
          format_text: true
        })
      });
      
      if (!sessionResponse.ok) {
        const error = await sessionResponse.text();
        throw new Error(`Failed to create AssemblyAI session: ${error}`);
      }
      
      const sessionData = await sessionResponse.json();
      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${sessionData.token}`;
      
      console.log('Connecting to AssemblyAI WebSocket...');
      
      // Connect to AssemblyAI WebSocket
      assemblyAiWebSocket = new WebSocket(wsUrl);
      
      assemblyAiWebSocket.onopen = () => {
        console.log('✅ Connected to AssemblyAI WebSocket');
        isConnected = true;
        socket.send(JSON.stringify({ type: 'session_begins' }));
      };
      
      assemblyAiWebSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📝 AssemblyAI message:', data);
          
          // Forward AssemblyAI messages to client
          socket.send(event.data);
        } catch (error) {
          console.error('Error processing AssemblyAI message:', error);
        }
      };
      
      assemblyAiWebSocket.onerror = (error) => {
        console.error('AssemblyAI WebSocket error:', error);
        socket.send(JSON.stringify({ 
          type: 'error', 
          error: 'AssemblyAI connection error' 
        }));
      };
      
      assemblyAiWebSocket.onclose = () => {
        console.log('AssemblyAI WebSocket closed');
        isConnected = false;
        socket.close();
      };
      
    } catch (error) {
      console.error('Error connecting to AssemblyAI:', error);
      socket.send(JSON.stringify({ 
        type: 'error', 
        error: `Failed to connect to AssemblyAI: ${error.message}` 
      }));
      socket.close();
    }
  };
  
  socket.onmessage = (event) => {
    try {
      if (!assemblyAiWebSocket || !isConnected) {
        console.warn('Cannot send audio: AssemblyAI not connected');
        return;
      }
      
      // Handle different message types
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        if (data.type === 'terminate') {
          // Send terminate message to AssemblyAI
          assemblyAiWebSocket.send(JSON.stringify({ terminate_session: true }));
          return;
        }
      } else {
        // Forward binary audio data to AssemblyAI
        // Convert ArrayBuffer to base64 for AssemblyAI
        const audioData = new Uint8Array(event.data);
        const base64Audio = btoa(String.fromCharCode(...audioData));
        
        assemblyAiWebSocket.send(JSON.stringify({
          audio_data: base64Audio
        }));
      }
    } catch (error) {
      console.error('Error forwarding client message to AssemblyAI:', error);
    }
  };
  
  socket.onclose = () => {
    console.log('Client WebSocket disconnected');
    if (assemblyAiWebSocket) {
      // Send terminate before closing
      try {
        assemblyAiWebSocket.send(JSON.stringify({ terminate_session: true }));
      } catch (e) {
        console.log('Could not send terminate message:', e);
      }
      assemblyAiWebSocket.close();
    }
  };
  
  socket.onerror = (error) => {
    console.error('Client WebSocket error:', error);
    if (assemblyAiWebSocket) {
      assemblyAiWebSocket.close();
    }
  };
  
  return response;
}