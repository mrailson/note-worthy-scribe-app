import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  console.log('🔗 Deepgram WebSocket proxy - New connection request');
  console.log('Request details:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.error('❌ Not a WebSocket request, upgrade header:', upgradeHeader);
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log("✅ Setting up WebSocket connection to Deepgram...");

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
  if (!deepgramApiKey) {
    console.error('❌ DEEPGRAM_API_KEY is not set');
    socket.close(1011, 'DEEPGRAM_API_KEY is not set');
    return response;
  }

  console.log('🔗 Connecting to Deepgram with API key present:', !!deepgramApiKey);

  // Connect to Deepgram WebSocket with proper encoding parameters
  const deepgramWs = new WebSocket(
    `wss://api.deepgram.com/v1/listen?encoding=webm&sample_rate=48000&channels=1&model=nova-2&smart_format=true&interim_results=true&endpointing=true&utterance_end_ms=1000&vad_events=true&diarize=true&punctuate=true`,
    [],
    {
      headers: {
        Authorization: `Token ${deepgramApiKey}`
      }
    }
  );

  let isConnected = false;

  deepgramWs.onopen = () => {
    console.log("✅ Connected to Deepgram WebSocket");
    isConnected = true;
    socket.send(JSON.stringify({ 
      type: 'connection_established',
      message: 'Connected to Deepgram' 
    }));
  };

  deepgramWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Deepgram message:", data);
      
      // Forward Deepgram response to client
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      }
    } catch (error) {
      console.error("Error parsing Deepgram message:", error);
    }
  };

  deepgramWs.onerror = (error) => {
    console.error("❌ Deepgram WebSocket error:", error);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ 
        type: 'error',
        message: 'Deepgram connection error' 
      }));
    }
  };

  deepgramWs.onclose = (event) => {
    console.log("🔌 Deepgram WebSocket closed:", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ 
        type: 'connection_closed',
        message: 'Deepgram connection closed' 
      }));
      socket.close();
    }
  };

  // Handle client messages (audio data)
  socket.onmessage = (event) => {
    if (deepgramWs.readyState === WebSocket.OPEN) {
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'audio') {
            // Convert base64 to binary and send to Deepgram
            const binaryString = atob(message.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            deepgramWs.send(bytes);
          } else if (message.type === 'finalize') {
            // Send finalize message to Deepgram
            deepgramWs.send(JSON.stringify({ type: "Finalize" }));
          }
        } catch (error) {
          console.error("Error parsing client message:", error);
        }
      } else {
        // Binary audio data - forward directly to Deepgram
        deepgramWs.send(event.data);
      }
    }
  };

  socket.onclose = () => {
    console.log("Client WebSocket closed");
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  };

  return response;
});