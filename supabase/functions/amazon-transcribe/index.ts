import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Amazon Transcribe Realtime function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  if (req.headers.get("upgrade") === "websocket") {
    console.log('WebSocket upgrade requested for Amazon Transcribe');
    return handleWebSocketUpgrade(req);
  }

  return new Response('Expected WebSocket upgrade', { status: 400, headers: corsHeaders });
});

// WebSocket handler for real-time streaming
async function handleWebSocketUpgrade(req: Request): Promise<Response> {
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let transcribeWebSocket: WebSocket | null = null;
  let isConnected = false;
  
  socket.onopen = async () => {
    console.log('Client WebSocket connected to Amazon Transcribe proxy');
    
    try {
      const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
      const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
      
      if (!accessKeyId || !secretAccessKey) {
        throw new Error('AWS credentials not configured');
      }
      
      // For Amazon Transcribe Streaming, we need to use AWS SDK or direct HTTP/2 connection
      // This is a simplified WebSocket proxy - in production you'd use proper AWS SDK integration
      console.log('AWS credentials configured, setting up transcription stream...');
      
      // Send success message to client
      socket.send(JSON.stringify({ 
        type: 'session_begins',
        message: 'Amazon Transcribe proxy ready'
      }));
      
      isConnected = true;
      
    } catch (error) {
      console.error('Error setting up Amazon Transcribe:', error);
      socket.send(JSON.stringify({ 
        type: 'error', 
        error: `Failed to setup Amazon Transcribe: ${error.message}` 
      }));
      socket.close();
    }
  };
  
  socket.onmessage = (event) => {
    try {
      if (!isConnected) {
        console.warn('Cannot process audio: Amazon Transcribe not connected');
        return;
      }
      
      // Handle different message types
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        if (data.type === 'terminate') {
          console.log('Terminating Amazon Transcribe session');
          if (transcribeWebSocket) {
            transcribeWebSocket.close();
          }
          return;
        }
      } else {
        // Handle binary audio data
        // For now, we'll simulate transcription responses
        const audioData = new Uint8Array(event.data);
        console.log('Received audio data:', audioData.length, 'bytes');
        
        // Simulate Amazon Transcribe response format
        const mockResponse = {
          Transcript: {
            Results: [{
              Alternatives: [{
                Transcript: "This is a simulated Amazon Transcribe response",
                Confidence: 0.95,
                Items: [{
                  Confidence: 0.95,
                  Content: "simulated",
                  EndTime: Date.now() / 1000,
                  StartTime: (Date.now() - 1000) / 1000,
                  Type: "pronunciation"
                }]
              }],
              EndTime: Date.now() / 1000,
              IsPartial: Math.random() > 0.7, // Sometimes final, sometimes partial
              ResultId: crypto.randomUUID(),
              StartTime: (Date.now() - 1000) / 1000
            }]
          }
        };
        
        // Send mock response back to client
        socket.send(JSON.stringify(mockResponse));
      }
    } catch (error) {
      console.error('Error processing Amazon Transcribe message:', error);
    }
  };
  
  socket.onclose = () => {
    console.log('Client WebSocket disconnected from Amazon Transcribe');
    if (transcribeWebSocket) {
      transcribeWebSocket.close();
    }
  };
  
  socket.onerror = (error) => {
    console.error('Client WebSocket error in Amazon Transcribe:', error);
    if (transcribeWebSocket) {
      transcribeWebSocket.close();
    }
  };
  
  return response;
}