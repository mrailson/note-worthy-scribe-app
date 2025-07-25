import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  console.log("Incoming request:", req.method, req.url);
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  const upgradeHeader = req.headers.get("upgrade");
  console.log("Upgrade header value:", upgradeHeader);

  if (upgradeHeader !== "websocket") {
    console.error("Missing or invalid WebSocket upgrade header, got:", upgradeHeader);
    return new Response("Expected WebSocket upgrade", { status: 400 });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    console.log("✅ WebSocket upgrade successful for browser");

    // Connect to Deepgram
    const deepgramUrl =
      "https://api.deepgram.com/v1/listen?encoding=opus&sample_rate=48000&punctuate=true&diarize=true";

    console.log("Connecting to Deepgram WebSocket:", deepgramUrl);

    const dgReq = await fetch(deepgramUrl, {
      headers: {
        Authorization: `Token ${Deno.env.get("DEEPGRAM_API_KEY")}`,
      },
      method: "GET",
      upgrade: "websocket",
    });

    if (!dgReq.webSocket) {
      console.error("❌ Deepgram refused WS upgrade");
      socket.close();
      return new Response("Failed to connect to Deepgram", { status: 502 });
    }

    const dgSocket = dgReq.webSocket;
    dgSocket.accept();
    console.log("✅ Connected to Deepgram");

    // Forward data from browser to Deepgram
    socket.onmessage = (e) => {
      dgSocket.send(e.data);
    };

    // Forward data from Deepgram to browser
    dgSocket.onmessage = (e) => {
      socket.send(e.data);
    };

    // Close handling
    socket.onclose = () => {
      console.log("Browser WebSocket closed, closing Deepgram");
      dgSocket.close();
    };

    dgSocket.onclose = () => {
      console.log("Deepgram WebSocket closed, closing browser socket");
      socket.close();
    };

    dgSocket.onerror = (err) => {
      console.error("Deepgram WebSocket error:", err);
      socket.close();
    };

    socket.onerror = (err) => {
      console.error("Browser WebSocket error:", err);
      dgSocket.close();
    };

    return response;
  } catch (error) {
    console.error("❌ Error during WebSocket upgrade:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});