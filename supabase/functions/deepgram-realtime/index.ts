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

  try {
    // Use fetch API with upgrade to connect to Deepgram (correct way in Deno)
    const deepgramUrl = "https://api.deepgram.com/v1/listen?encoding=webm&sample_rate=48000&channels=1&model=nova-2&smart_format=true&interim_results=true&endpointing=true&utterance_end_ms=1000&vad_events=true&diarize=true&punctuate=true";
    
    console.log('🔗 Connecting to Deepgram URL:', deepgramUrl);
    
    const dgResponse = await fetch(deepgramUrl, {
      headers: { 
        Authorization: `Token ${deepgramApiKey}`,
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      },
      method: "GET"
    });

    if (!dgResponse.webSocket) {
      console.error('❌ Failed to upgrade to WebSocket with Deepgram');
      socket.close(1011, 'Failed to connect to Deepgram');
      return response;
    }

    const dgSocket = dgResponse.webSocket;
    dgSocket.accept();

    console.log("✅ Connected to Deepgram WebSocket");
    
    socket.send(JSON.stringify({ 
      type: 'connection_established',
      message: 'Connected to Deepgram' 
    }));

    // Forward messages from client to Deepgram
    socket.onmessage = (event) => {
      try {
        if (dgSocket.readyState === WebSocket.OPEN) {
          if (typeof event.data === 'string') {
            const message = JSON.parse(event.data);
            if (message.type === 'audio') {
              // Convert base64 to binary and send to Deepgram
              const binaryString = atob(message.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              dgSocket.send(bytes);
            } else if (message.type === 'finalize') {
              // Send finalize message to Deepgram
              dgSocket.send(JSON.stringify({ type: "Finalize" }));
            }
          } else {
            // Binary audio data - forward directly to Deepgram
            dgSocket.send(event.data);
          }
        }
      } catch (error) {
        console.error("Error processing client message:", error);
      }
    };

    // Forward messages from Deepgram to client
    dgSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Deepgram message:", data);
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      } catch (error) {
        console.error("Error parsing Deepgram message:", error);
      }
    };

    dgSocket.onerror = (error) => {
      console.error("❌ Deepgram WebSocket error:", error);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'error',
          message: 'Deepgram connection error' 
        }));
      }
    };

    dgSocket.onclose = (event) => {
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

    socket.onclose = () => {
      console.log("Client WebSocket closed");
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.close();
      }
    };

  } catch (error) {
    console.error("❌ Error setting up Deepgram connection:", error);
    socket.close(1011, `Connection failed: ${error.message}`);
  }

  return response;
});