import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    // Connect to Deepgram WebSocket using fetch upgrade
    const dgReq = await fetch(
      "https://api.deepgram.com/v1/listen?encoding=opus&sample_rate=48000&punctuate=true&diarize=true",
      {
        headers: { Authorization: `Token ${Deno.env.get("DEEPGRAM_API_KEY")}` },
        method: "GET",
        upgrade: "websocket"
      }
    );

    if (!dgReq.webSocket) {
      console.error("Deepgram WS upgrade failed");
      socket.close();
      return new Response("Failed to connect to Deepgram", { status: 502 });
    }

    const dgSocket = dgReq.webSocket;
    dgSocket.accept();

    console.log("✅ Connected to Deepgram WebSocket");

    // Forward data both ways
    socket.onmessage = (e) => dgSocket.send(e.data);
    dgSocket.onmessage = (e) => socket.send(e.data);

    socket.onclose = () => {
      console.log("Client WebSocket closed");
      dgSocket.close();
    };
    dgSocket.onclose = () => {
      console.log("Deepgram WebSocket closed"); 
      socket.close();
    };

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
    };

    dgSocket.onerror = (error) => {
      console.error("Deepgram WebSocket error:", error);
    };

    return response;
  }

  return new Response("Expected WebSocket upgrade", { status: 400 });
});