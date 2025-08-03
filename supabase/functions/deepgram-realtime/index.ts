import { serve } from "https://deno.land/std/http/server.ts";

// Track active connections for monitoring
const activeConnections = new Map<string, {
  id: string;
  browserSocket: WebSocket;
  deepgramSocket: WebSocket;
  startTime: Date;
  lastActivity: Date;
}>();

// Connection timeout (15 minutes of inactivity)
const CONNECTION_TIMEOUT = 15 * 60 * 1000;

// Cleanup inactive connections
const cleanupConnections = () => {
  const now = new Date();
  for (const [id, connection] of activeConnections.entries()) {
    if (now.getTime() - connection.lastActivity.getTime() > CONNECTION_TIMEOUT) {
      console.log(`🧹 Cleaning up inactive connection: ${id}`);
      try {
        connection.browserSocket.close();
        connection.deepgramSocket.close();
      } catch (error) {
        console.error(`Error closing connection ${id}:`, error);
      }
      activeConnections.delete(id);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupConnections, 5 * 60 * 1000);

serve(async (req) => {
  const connectionId = crypto.randomUUID();
  const startTime = new Date();
  
  console.log(`🔄 [${connectionId}] Incoming request:`, req.method, req.url);
  console.log(`🔄 [${connectionId}] Active connections before: ${activeConnections.size}`);

  const upgradeHeader = req.headers.get("upgrade");
  console.log(`🔄 [${connectionId}] Upgrade header value:`, upgradeHeader);

  if (upgradeHeader !== "websocket") {
    console.error(`❌ [${connectionId}] Missing or invalid WebSocket upgrade header, got:`, upgradeHeader);
    return new Response("Expected WebSocket upgrade", { status: 400 });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    console.log(`✅ [${connectionId}] WebSocket upgrade successful for browser`);

    // Connect to Deepgram
    const deepgramUrl =
      "https://api.deepgram.com/v1/listen?encoding=opus&sample_rate=48000&punctuate=true&diarize=true&smart_format=true";

    console.log(`🔄 [${connectionId}] Connecting to Deepgram WebSocket:`, deepgramUrl);

    const dgReq = await fetch(deepgramUrl, {
      headers: {
        Authorization: `Token ${Deno.env.get("DEEPGRAM_API_KEY")}`,
      },
      method: "GET",
      upgrade: "websocket",
    });

    if (!dgReq.webSocket) {
      console.error(`❌ [${connectionId}] Deepgram refused WS upgrade`);
      socket.close();
      return new Response("Failed to connect to Deepgram", { status: 502 });
    }

    const dgSocket = dgReq.webSocket;
    dgSocket.accept();
    console.log(`✅ [${connectionId}] Connected to Deepgram`);

    // Track this connection
    const connection = {
      id: connectionId,
      browserSocket: socket,
      deepgramSocket: dgSocket,
      startTime,
      lastActivity: new Date()
    };
    activeConnections.set(connectionId, connection);
    
    console.log(`📊 [${connectionId}] Active connections after: ${activeConnections.size}`);

    // Forward data from browser to Deepgram
    socket.onmessage = (e) => {
      connection.lastActivity = new Date();
      try {
        if (dgSocket.readyState === WebSocket.OPEN) {
          dgSocket.send(e.data);
        } else {
          console.warn(`🚨 [${connectionId}] Tried to send to closed Deepgram socket`);
        }
      } catch (error) {
        console.error(`❌ [${connectionId}] Error forwarding to Deepgram:`, error);
      }
    };

    // Forward data from Deepgram to browser
    dgSocket.onmessage = (e) => {
      connection.lastActivity = new Date();
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(e.data);
        } else {
          console.warn(`🚨 [${connectionId}] Tried to send to closed browser socket`);
        }
      } catch (error) {
        console.error(`❌ [${connectionId}] Error forwarding to browser:`, error);
      }
    };

    // Enhanced close handling
    const cleanup = () => {
      console.log(`🧹 [${connectionId}] Cleaning up connection`);
      activeConnections.delete(connectionId);
      console.log(`📊 [${connectionId}] Active connections after cleanup: ${activeConnections.size}`);
    };

    socket.onclose = () => {
      console.log(`🔌 [${connectionId}] Browser WebSocket closed, closing Deepgram`);
      try {
        if (dgSocket.readyState === WebSocket.OPEN) {
          dgSocket.close();
        }
      } catch (error) {
        console.error(`❌ [${connectionId}] Error closing Deepgram socket:`, error);
      }
      cleanup();
    };

    dgSocket.onclose = () => {
      console.log(`🔌 [${connectionId}] Deepgram WebSocket closed, closing browser socket`);
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      } catch (error) {
        console.error(`❌ [${connectionId}] Error closing browser socket:`, error);
      }
      cleanup();
    };

    dgSocket.onerror = (err) => {
      console.error(`❌ [${connectionId}] Deepgram WebSocket error:`, err);
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      } catch (error) {
        console.error(`❌ [${connectionId}] Error closing browser socket after DG error:`, error);
      }
      cleanup();
    };

    socket.onerror = (err) => {
      console.error(`❌ [${connectionId}] Browser WebSocket error:`, err);
      try {
        if (dgSocket.readyState === WebSocket.OPEN) {
          dgSocket.close();
        }
      } catch (error) {
        console.error(`❌ [${connectionId}] Error closing Deepgram socket after browser error:`, error);
      }
      cleanup();
    };

    return response;
  } catch (error) {
    console.error(`❌ [${connectionId}] Error during WebSocket upgrade:`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
});