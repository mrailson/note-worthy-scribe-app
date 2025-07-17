import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
  if (!ASSEMBLYAI_API_KEY) {
    return new Response("AssemblyAI API key not configured", { status: 500 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  let assemblySocket: WebSocket | null = null;

  socket.onopen = () => {
    console.log("Client WebSocket connected");
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received message:", message.type);

      if (message.type === 'start_transcription') {
        // Connect to AssemblyAI real-time WebSocket with minimal configuration
        const ws_url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${ASSEMBLYAI_API_KEY}`;
        console.log("Connecting to AssemblyAI WebSocket");

        // Connect to AssemblyAI WebSocket
        assemblySocket = new WebSocket(ws_url);

        assemblySocket.onopen = () => {
          console.log("Connected to AssemblyAI - waiting for SessionBegins");
        };

        assemblySocket.onmessage = (assemblyEvent) => {
          try {
            const data = JSON.parse(assemblyEvent.data);
            console.log("AssemblyAI message:", data.message_type, data);

            if (data.message_type === 'SessionBegins') {
              console.log("AssemblyAI session began - session_id:", data.session_id);
              socket.send(JSON.stringify({ 
                type: 'session_started',
                message: 'Real-time transcription started',
                session_id: data.session_id
              }));
            } else if (data.message_type === 'FinalTranscript' && data.text && data.text.trim()) {
              socket.send(JSON.stringify({
                type: 'transcript',
                text: data.text,
                speaker: data.speaker || 'Speaker 1',
                confidence: data.confidence || 0.5,
                words: data.words || [],
                timestamp: new Date().toISOString(),
                is_final: true
              }));
            } else if (data.message_type === 'PartialTranscript' && data.text && data.text.trim()) {
              socket.send(JSON.stringify({
                type: 'partial_transcript',
                text: data.text,
                speaker: data.speaker || 'Speaker 1',
                confidence: data.confidence || 0.5,
                timestamp: new Date().toISOString(),
                is_final: false
              }));
            } else if (data.message_type === 'SessionTerminated') {
              console.log("AssemblyAI session terminated");
            } else {
              console.log("Other AssemblyAI message:", data.message_type);
            }
          } catch (error) {
            console.error("Error parsing AssemblyAI message:", error, assemblyEvent.data);
          }
        };

        assemblySocket.onerror = (error) => {
          console.error("AssemblyAI WebSocket error:", error);
          socket.send(JSON.stringify({
            type: 'error',
            message: 'AssemblyAI connection error'
          }));
        };

        assemblySocket.onclose = (event) => {
          console.log("AssemblyAI WebSocket closed:", event.code, event.reason);
          socket.send(JSON.stringify({
            type: 'session_ended',
            message: `Session closed: ${event.code} ${event.reason || 'Unknown'}`
          }));
        };

      } else if (message.type === 'audio_data' && assemblySocket) {
        // Forward audio data to AssemblyAI
        if (assemblySocket.readyState === WebSocket.OPEN) {
          assemblySocket.send(JSON.stringify({
            audio_data: message.audio_data
          }));
        }
      } else if (message.type === 'stop_transcription' && assemblySocket) {
        // Terminate the session
        assemblySocket.send(JSON.stringify({ terminate_session: true }));
        assemblySocket.close();
        assemblySocket = null;
      }
    } catch (error) {
      console.error("Error processing message:", error);
      socket.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  };

  socket.onclose = () => {
    console.log("Client WebSocket disconnected");
    if (assemblySocket) {
      assemblySocket.close();
    }
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
    if (assemblySocket) {
      assemblySocket.close();
    }
  };

  return response;
});