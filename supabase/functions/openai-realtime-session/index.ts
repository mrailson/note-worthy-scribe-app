import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API key not configured' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    console.log('Creating WebSocket connection to OpenAI Realtime API...');
    
    // Upgrade the connection to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    // Connect to OpenAI Realtime API with auth in URL parameters
    const openAIWS = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01&authorization=Bearer%20${encodeURIComponent(openAIKey)}`);
    
    let sessionConfigured = false;
    
    openAIWS.onopen = () => {
      console.log('Connected to OpenAI Realtime API');
    };
    
    openAIWS.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('OpenAI message type:', data.type);
      
      // Configure session after connection is established
      if (data.type === 'session.created' && !sessionConfigured) {
        sessionConfigured = true;
        console.log('Session created, sending configuration...');
        
        const sessionConfig = {
          event_id: `event_${Date.now()}`,
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are a helpful assistant for meeting transcription. Transcribe the audio clearly and format it properly with speaker labels.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.3,
            max_response_output_tokens: 'inf'
          }
        };
        
        openAIWS.send(JSON.stringify(sessionConfig));
        console.log('Session configuration sent');
      }
      
      // Forward all messages to client
      socket.send(event.data);
    };
    
    openAIWS.onerror = (error) => {
      console.error('OpenAI WebSocket error:', error);
      socket.send(JSON.stringify({ 
        type: 'error', 
        error: 'OpenAI connection error' 
      }));
    };
    
    openAIWS.onclose = (event) => {
      console.log('OpenAI WebSocket closed:', event.code, event.reason);
      socket.close(event.code, event.reason);
    };
    
    // Handle messages from client
    socket.onopen = () => {
      console.log('Client WebSocket connected');
    };
    
    socket.onmessage = (event) => {
      console.log('Client message received, forwarding to OpenAI');
      // Forward client messages to OpenAI
      if (openAIWS.readyState === WebSocket.OPEN) {
        openAIWS.send(event.data);
      }
    };
    
    socket.onclose = () => {
      console.log('Client WebSocket disconnected');
      openAIWS.close();
    };
    
    socket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
      openAIWS.close();
    };
    
    return response;
    
  } catch (error) {
    console.error('Error in realtime session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});