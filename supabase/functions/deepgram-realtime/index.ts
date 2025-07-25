import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  console.log('🔗 Deepgram WebSocket proxy - New connection request');
  
  if (req.headers.get("upgrade") !== "websocket") {
    console.error('❌ Not a WebSocket request');
    return new Response("Expected WebSocket upgrade", { status: 400 });
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
    const dgReq = await fetch(
      "https://api.deepgram.com/v1/listen?encoding=opus&sample_rate=48000&punctuate=true&diarize=true",
      {
        headers: { Authorization: `Token ${deepgramApiKey}` },
        method: "GET",
        upgrade: "websocket"
      }
    );

    if (!dgReq.webSocket) {
      console.error("❌ Deepgram WS upgrade failed");
      socket.close(1011, 'Failed to connect to Deepgram');
      return new Response("Failed to connect to Deepgram", { status: 502 });
    }

    const dgSocket = dgReq.webSocket;
    dgSocket.accept();

    console.log("✅ Connected to Deepgram WebSocket");

    // Forward messages from client to Deepgram
    socket.onmessage = (e) => {
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.send(e.data);
      }
    };

    // Forward messages from Deepgram to client
    dgSocket.onmessage = (e) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(e.data);
      }
    };

    // Handle connection closures
    socket.onclose = () => {
      console.log("Client WebSocket closed");
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.close();
      }
    };

    dgSocket.onclose = () => {
      console.log("Deepgram WebSocket closed");
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };

    // Handle errors
    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
    };

    dgSocket.onerror = (error) => {
      console.error("Deepgram WebSocket error:", error);
    };

    return response;

  } catch (error) {
    console.error("❌ Error setting up Deepgram connection:", error);
    socket.close(1011, `Connection failed: ${error.message}`);
    return response;
  }
});