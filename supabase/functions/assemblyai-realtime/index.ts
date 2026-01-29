import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  console.log('🚀 AssemblyAI WebSocket proxy request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Not a WebSocket upgrade request');
    return new Response("Expected WebSocket connection", { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔌 Upgrading to WebSocket...');
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let assemblySocket: WebSocket | null = null;

    socket.onopen = () => {
      console.log('✅ Client WebSocket opened');
      
      // Auto-start AssemblyAI session when client connects
      initAssemblyAIConnection();
    };

    async function initAssemblyAIConnection() {
      try {
        const AAI_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
        if (!AAI_KEY) {
          socket.send(JSON.stringify({ 
            type: 'error', 
            error: 'Missing ASSEMBLYAI_API_KEY' 
          }));
          return;
        }

        console.log('🔗 Creating AssemblyAI WebSocket connection with OTEWELL verbatim settings...');

        // OTEWELL NHS Core Terms - reduced set to stay within URL limits
        // Prioritising governance, clinical safety and high-value medical terms
        const medicalKeyterms = [
          // OTEWELL Primary Care & Governance (critical)
          "Ageing Well", "Frailty", "LD", "Learning Disability",
          "QOF", "DES", "EMIS", "SystmOne", "PCN", "CQC",
          "safeguarding", "DNACPR", "ReSPECT", "ACP",
          // Vitals
          "BP", "systolic", "diastolic", "SpO2", "BMI", "eGFR", "HbA1c",
          // High-frequency medications
          "metformin", "ramipril", "amlodipine", "omeprazole",
          "atorvastatin", "bisoprolol", "sertraline", "gabapentin",
          "apixaban", "warfarin", "salbutamol", "Fostair",
          // Common conditions
          "hypertension", "diabetes", "COPD", "asthma", "CKD",
          "atrial fibrillation", "dementia", "depression"
        ];

        // AssemblyAI Streaming v3 with OTEWELL verbatim settings
        const keytermsParam = encodeURIComponent(JSON.stringify(medicalKeyterms));
        const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&format_turns=true&speech_model=universal-streaming-english&language_code=en&punctuate=false&format_text=false&word_confidence=true&keyterms_prompt=${keytermsParam}`;
        
        // Get token from AssemblyAI (9 minutes expiry)
        const tokenResponse = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=540', {
          method: 'GET',
          headers: { Authorization: AAI_KEY }
        });
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('❌ Token request failed:', errorText);
          socket.send(JSON.stringify({ 
            type: 'error', 
            error: `Token request failed: ${errorText}` 
          }));
          return;
        }
        
        const tokenData = await tokenResponse.json();
        const tokenWsUrl = `${wsUrl}&token=${encodeURIComponent(tokenData.token)}`;
        
        assemblySocket = new WebSocket(tokenWsUrl);
        
        assemblySocket.onopen = () => {
          console.log('✅ AssemblyAI WebSocket connected');
          socket.send(JSON.stringify({ 
            type: 'session_begins',
            session_id: Date.now().toString()
          }));
        };
        
        assemblySocket.onmessage = (assemblyEvent) => {
          console.log('📝 Forwarding message from AssemblyAI to client');
          socket.send(assemblyEvent.data);
        };
        
        assemblySocket.onerror = (error) => {
          console.error('❌ AssemblyAI WebSocket error:', error);
          socket.send(JSON.stringify({ 
            type: 'error', 
            error: 'AssemblyAI connection error' 
          }));
        };
        
        assemblySocket.onclose = (closeEvent) => {
          console.log('🔌 AssemblyAI WebSocket closed:', closeEvent.code, closeEvent.reason);

          // Surface close reasons to the client so the UI can show actionable errors.
          // When connection params are invalid, AssemblyAI closes quickly with a validation message.
          const reason = (closeEvent.reason || '').trim();
          const isClean = closeEvent.code === 1000;

          if (!isClean) {
            socket.send(JSON.stringify({
              type: 'error',
              error: reason
                ? `AssemblyAI closed (${closeEvent.code}): ${reason}`
                : `AssemblyAI closed (${closeEvent.code}).`
            }));
            return;
          }

          socket.send(JSON.stringify({
            type: 'session_terminated',
            code: closeEvent.code,
            reason: closeEvent.reason
          }));
        };
      } catch (error) {
        console.error('❌ Failed to initialize AssemblyAI connection:', error);
        socket.send(JSON.stringify({ 
          type: 'error', 
          error: 'Failed to initialize AssemblyAI connection' 
        }));
      }
    }

    socket.onmessage = async (event) => {
      try {
        // Handle binary data (audio)
        if (event.data instanceof ArrayBuffer) {
          console.log('📡 Received binary audio data, size:', event.data.byteLength);
          if (assemblySocket && assemblySocket.readyState === WebSocket.OPEN) {
            assemblySocket.send(event.data);
          }
          return;
        }
        
        // Handle text/JSON messages (mostly for terminate)
        const message = JSON.parse(event.data);
        console.log('📨 Received message from client:', message.type || 'unknown');
        
        if (message.type === 'terminate') {
          console.log('🔌 Received terminate signal');
          if (assemblySocket) {
            assemblySocket.close();
          }
          socket.close();
        }
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
        socket.send(JSON.stringify({ 
          type: 'error', 
          error: 'Failed to process message' 
        }));
      }
    };

    socket.onclose = () => {
      console.log('🔌 Client WebSocket closed');
      if (assemblySocket) {
        assemblySocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
      if (assemblySocket) {
        assemblySocket.close();
      }
    };

    return response;
    
  } catch (error) {
    console.error('❌ WebSocket upgrade failed:', error);
    return new Response(`WebSocket upgrade failed: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});