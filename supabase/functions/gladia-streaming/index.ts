import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  console.log('🚀 Gladia streaming proxy request received');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Not a WebSocket upgrade request');
    return new Response("Expected WebSocket connection", {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    console.log('🔌 Upgrading to WebSocket...');
    const { socket, response } = Deno.upgradeWebSocket(req);

    let gladiaSocket: WebSocket | null = null;

    socket.onopen = () => {
      console.log('✅ Client WebSocket opened');
    };

    socket.onmessage = async (event) => {
      try {
        // Forward binary audio data directly to Gladia
        if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
          if (gladiaSocket && gladiaSocket.readyState === WebSocket.OPEN) {
            // Gladia v2 expects base64 audio in JSON
            const bytes = event.data instanceof Uint8Array ? event.data : new Uint8Array(event.data);
            // Convert to base64
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            gladiaSocket.send(JSON.stringify({
              type: 'audio_chunk',
              data: { chunk: base64 },
            }));
          }
          return;
        }

        const message = JSON.parse(event.data);
        console.log('📨 Received message from client:', message.type || 'unknown');

        if (message.type === 'session.start') {
          const GLADIA_KEY = Deno.env.get("GLADIA_API_KEY");
          if (!GLADIA_KEY) {
            socket.send(JSON.stringify({
              type: 'error',
              error: 'Missing GLADIA_API_KEY',
            }));
            return;
          }

          console.log('🔗 Initialising Gladia v2 live session...');

          // Step 1: POST to get a session WebSocket URL
          const initResp = await fetch('https://api.gladia.io/v2/live', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-gladia-key': GLADIA_KEY,
            },
            body: JSON.stringify({
              encoding: 'wav/pcm',
              sample_rate: 16000,
              bit_depth: 16,
              channels: 1,
              language_config: {
                languages: ['en'],
                code_switching: false,
              },
              realtime_processing: {
                words_accurate_timestamps: true,
              },
            }),
          });

          if (!initResp.ok) {
            const errText = await initResp.text();
            console.error('❌ Gladia init failed:', initResp.status, errText);
            socket.send(JSON.stringify({
              type: 'error',
              error: `Gladia init failed (${initResp.status}): ${errText}`,
            }));
            return;
          }

          const initData = await initResp.json();
          const gladiaWsUrl = initData.url;
          console.log('✅ Gladia session URL obtained:', gladiaWsUrl?.substring(0, 60) + '...');

          if (!gladiaWsUrl) {
            socket.send(JSON.stringify({
              type: 'error',
              error: 'No WebSocket URL returned from Gladia',
            }));
            return;
          }

          // Step 2: Connect to the Gladia WebSocket
          gladiaSocket = new WebSocket(gladiaWsUrl);

          gladiaSocket.onopen = () => {
            console.log('✅ Gladia WebSocket connected');
            socket.send(JSON.stringify({
              type: 'session.started',
              session_id: initData.id || Date.now().toString(),
            }));
          };

          gladiaSocket.onmessage = (gladiaEvent) => {
            try {
              const data = JSON.parse(gladiaEvent.data);
              console.log('📝 Gladia event:', data.type);

              // Map Gladia v2 events to our unified format
              if (data.type === 'transcript') {
                // Gladia sends transcript events with data.data containing the transcript info
                const transcriptData = data.data || data;
                socket.send(JSON.stringify({
                  type: 'transcript',
                  text: transcriptData.utterance?.text || transcriptData.transcript || '',
                  is_final: transcriptData.is_final ?? (data.type === 'transcript' && !transcriptData.type?.includes('partial')),
                  confidence: transcriptData.confidence ?? 0.9,
                  time_begin: transcriptData.time_begin,
                  time_end: transcriptData.time_end,
                  speaker: transcriptData.speaker,
                }));
              } else if (data.type === 'ready') {
                socket.send(JSON.stringify({ type: 'ready' }));
              } else if (data.type === 'error') {
                socket.send(JSON.stringify({
                  type: 'error',
                  error: data.data?.message || data.message || 'Gladia error',
                }));
              } else {
                // Forward any other events as-is
                socket.send(gladiaEvent.data);
              }
            } catch {
              // Non-JSON or unexpected — forward raw
              socket.send(gladiaEvent.data);
            }
          };

          gladiaSocket.onerror = (error) => {
            console.error('❌ Gladia WebSocket error:', error);
            socket.send(JSON.stringify({
              type: 'error',
              error: 'Gladia connection error',
            }));
          };

          gladiaSocket.onclose = (closeEvent) => {
            console.log('🔌 Gladia WebSocket closed:', closeEvent.code, closeEvent.reason);
            socket.send(JSON.stringify({
              type: 'session_terminated',
              code: closeEvent.code,
              reason: closeEvent.reason,
            }));
          };

        } else if (message.type === 'session.end' || message.type === 'terminate') {
          console.log('🔌 Received terminate signal');
          if (gladiaSocket && gladiaSocket.readyState === WebSocket.OPEN) {
            // Send stop_recording to Gladia
            gladiaSocket.send(JSON.stringify({ type: 'stop_recording' }));
            gladiaSocket.close();
          }
          socket.close();
        }

      } catch (error) {
        console.error('❌ Error processing message:', error);
        socket.send(JSON.stringify({
          type: 'error',
          error: 'Failed to process message',
        }));
      }
    };

    socket.onclose = () => {
      console.log('🔌 Client WebSocket closed');
      if (gladiaSocket) {
        try {
          gladiaSocket.send(JSON.stringify({ type: 'stop_recording' }));
        } catch { /* ignore */ }
        gladiaSocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
      if (gladiaSocket) {
        gladiaSocket.close();
      }
    };

    return response;

  } catch (error) {
    console.error('❌ WebSocket upgrade failed:', error);
    return new Response(`WebSocket upgrade failed: ${error.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
