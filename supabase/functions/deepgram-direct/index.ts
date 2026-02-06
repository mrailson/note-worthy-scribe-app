import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade, connection',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!deepgramApiKey) {
      console.error('❌ DEEPGRAM_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'Deepgram API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For WebSocket upgrade requests
    if (req.headers.get('upgrade') === 'websocket') {
      console.log('🔌 WebSocket upgrade requested');
      
      const { socket, response } = Deno.upgradeWebSocket(req);
      
      // Connect to Deepgram
      // Update Deepgram URL to expect WebM format instead of raw opus
      const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&language=en-GB&punctuate=true&interim_results=true&smart_format=true&vad_events=true&endpointing=300&encoding=webm&keywords=NHS:2,clinical:2,prescription:2,medication:2,patient:2,treatment:2,diagnosis:2,referral:2`;
      
      let deepgramSocket: WebSocket;
      
      socket.onopen = () => {
        console.log('🎙️ Client WebSocket connected');
        
        // Connect to Deepgram
        deepgramSocket = new WebSocket(deepgramUrl, ['token', deepgramApiKey]);
        
        deepgramSocket.onopen = () => {
          console.log('✅ Connected to Deepgram');
        };
        
        deepgramSocket.onmessage = (event) => {
          console.log('📥 Received from Deepgram:', event.data);
          // Forward Deepgram response to client
          socket.send(event.data);
        };
        
        deepgramSocket.onerror = (error) => {
          console.error('❌ Deepgram error:', error);
          socket.send(JSON.stringify({ error: 'Deepgram connection error' }));
        };
        
        deepgramSocket.onclose = () => {
          console.log('🔌 Deepgram connection closed');
          socket.close();
        };
      };
      
      socket.onmessage = (event) => {
        console.log('📤 Forwarding audio data to Deepgram, size:', event.data?.size || event.data?.byteLength || 'unknown');
        // Forward client audio data to Deepgram
        if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
          deepgramSocket.send(event.data);
        } else {
          console.warn('⚠️ Deepgram socket not ready, state:', deepgramSocket?.readyState);
        }
      };
      
      socket.onclose = () => {
        console.log('🔌 Client WebSocket closed');
        if (deepgramSocket) {
          deepgramSocket.close();
        }
      };
      
      return response;
    }

    // For regular HTTP requests, return WebSocket URL
    return new Response(JSON.stringify({
      websocketUrl: `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/deepgram-direct`,
      status: 'ready'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in deepgram-direct function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});