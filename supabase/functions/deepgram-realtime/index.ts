import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  console.log('🔗 Deepgram WebSocket proxy - New connection request');
  console.log('Request method:', req.method);
  console.log('Upgrade header:', req.headers.get("upgrade"));

  if (req.headers.get("upgrade") !== "websocket") {
    console.error('❌ Not a WebSocket request');
    return new Response("Expected WebSocket upgrade", { status: 400 });
  }

  console.log("✅ Setting up WebSocket connection...");

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  socket.onopen = () => {
    console.log("✅ Client WebSocket connection established");
    initializeDeepgramConnection(socket);
  };

  socket.onclose = () => {
    console.log("Client WebSocket closed");
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
  };

  return response;
});

async function initializeDeepgramConnection(socket: WebSocket) {
  const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
  if (!deepgramApiKey) {
    console.error('❌ DEEPGRAM_API_KEY is not set');
    socket.send(JSON.stringify({ 
      type: 'error', 
      message: 'DEEPGRAM_API_KEY is not set' 
    }));
    return;
  }

  console.log('🔗 Connecting to Deepgram with API key present:', !!deepgramApiKey);

  try {
    console.log('📡 Attempting fetch to Deepgram...');
    
    const dgReq = await fetch(
      "https://api.deepgram.com/v1/listen?encoding=opus&sample_rate=48000&punctuate=true&diarize=true",
      {
        headers: { Authorization: `Token ${deepgramApiKey}` },
        method: "GET",
        upgrade: "websocket"
      }
    );

    console.log('📡 Fetch response status:', dgReq.status);
    console.log('📡 Has webSocket:', !!dgReq.webSocket);

    if (!dgReq.webSocket) {
      console.error("❌ Deepgram WS upgrade failed - no webSocket in response");
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to connect to Deepgram' 
      }));
      return;
    }

    const dgSocket = dgReq.webSocket;
    dgSocket.accept();

    console.log("✅ Connected to Deepgram WebSocket successfully");

    // Send confirmation to client
    socket.send(JSON.stringify({ 
      type: 'connection_established', 
      message: 'Connected to Deepgram' 
    }));

    // Forward data both ways
    socket.onmessage = (e) => {
      console.log("Received from client, forwarding to Deepgram");
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.send(e.data);
      }
    };
    
    dgSocket.onmessage = (e) => {
      console.log("Received from Deepgram, forwarding to client");
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(e.data);
      }
    };

    dgSocket.onclose = () => {
      console.log("Deepgram WebSocket closed"); 
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'connection_closed', 
          message: 'Deepgram connection closed' 
        }));
      }
    };

    dgSocket.onerror = (error) => {
      console.error("Deepgram WebSocket error:", error);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'error', 
          message: 'Deepgram connection error' 
        }));
      }
    };

  } catch (error) {
    console.error("❌ Error setting up Deepgram connection:", error);
    socket.send(JSON.stringify({ 
      type: 'error', 
      message: `Connection failed: ${error.message}` 
    }));
  }
}