import { serve } from "https://deno.land/std/http/server.ts";

serve((req) => {
  console.log("Echo proxy - Incoming request:", req.method, req.url);
  console.log("Upgrade header:", req.headers.get("upgrade"));

  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    console.log("✅ WebSocket upgrade successful (echo test)");

    socket.onopen = () => {
      console.log("Echo WebSocket opened");
    };

    socket.onmessage = (event) => {
      console.log("Received from browser:", event.data);
      socket.send(`Echo: ${event.data}`);
    };

    socket.onclose = () => {
      console.log("Echo WebSocket closed");
    };

    socket.onerror = (error) => {
      console.error("Echo WebSocket error:", error);
    };

    return response;
  }

  return new Response("Expected WebSocket upgrade", { status: 400 });
});