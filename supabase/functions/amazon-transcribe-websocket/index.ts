import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AWS SigV4 signing utilities
async function sha256(message: string): Promise<ArrayBuffer> {
  const msgBuffer = new TextEncoder().encode(message);
  return await crypto.subtle.digest('SHA-256', msgBuffer);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sign(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const kDate = await sign(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await sign(kDate, regionName);
  const kService = await sign(kRegion, serviceName);
  const kSigning = await sign(kService, 'aws4_request');
  return kSigning;
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders
    });
  }

  console.log("WebSocket upgrade request received");

  try {
    // Get AWS credentials
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      console.log("AWS credentials not found");
      return new Response("AWS credentials not configured", { 
        status: 500,
        headers: corsHeaders
      });
    }

    // Configuration
    const region = 'us-east-1';
    const languageCode = 'en-US';
    const sampleRate = 16000;
    const host = `transcribestreaming.${region}.amazonaws.com:8443`;
    
    // Create timestamp
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substr(0, 8);

    // Create canonical request
    const method = 'GET';
    const canonicalUri = '/stream-transcription-websocket';
    const canonicalQuerystring = [
      'X-Amz-Algorithm=AWS4-HMAC-SHA256',
      `X-Amz-Credential=${encodeURIComponent(accessKeyId)}%2F${dateStamp}%2F${region}%2Ftranscribe%2Faws4_request`,
      `X-Amz-Date=${amzDate}`,
      'X-Amz-Expires=300',
      'X-Amz-SignedHeaders=host',
      `language-code=${languageCode}`,
      'media-encoding=pcm',
      `sample-rate=${sampleRate}`
    ].join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = await toHex(await sha256(''));
    
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/transcribe/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      await toHex(await sha256(canonicalRequest))
    ].join('\n');

    // Calculate signature
    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, 'transcribe');
    const signature = await toHex(await sign(signingKey, stringToSign));

    // Build final URL
    const finalUrl = `wss://${host}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;
    
    console.log("Connecting to Amazon Transcribe:", finalUrl);

    // Upgrade client connection
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    // Connect to Amazon Transcribe
    let amazonSocket: WebSocket | null = null;
    
    clientSocket.onopen = () => {
      console.log("Client connected to proxy");
      
      // Now connect to Amazon Transcribe
      amazonSocket = new WebSocket(finalUrl);
      
      amazonSocket.onopen = () => {
        console.log("Connected to Amazon Transcribe");
        clientSocket.send(JSON.stringify({
          type: 'connection_status',
          status: 'connected',
          message: 'Connected to Amazon Transcribe'
        }));
      };
      
      amazonSocket.onmessage = (event) => {
        console.log("Received from Amazon:", event.data);
        // Forward transcription results to client
        clientSocket.send(event.data);
      };
      
      amazonSocket.onerror = (error) => {
        console.error("Amazon Transcribe error:", error);
        clientSocket.send(JSON.stringify({
          type: 'error',
          message: 'Amazon Transcribe connection error'
        }));
      };
      
      amazonSocket.onclose = (event) => {
        console.log("Amazon Transcribe disconnected:", event.code, event.reason);
        clientSocket.send(JSON.stringify({
          type: 'connection_status',
          status: 'disconnected',
          message: 'Amazon Transcribe disconnected'
        }));
      };
    };
    
    clientSocket.onmessage = (event) => {
      // Forward audio data to Amazon Transcribe
      if (amazonSocket && amazonSocket.readyState === WebSocket.OPEN) {
        amazonSocket.send(event.data);
      }
    };
    
    clientSocket.onclose = () => {
      console.log("Client disconnected");
      if (amazonSocket) {
        amazonSocket.close();
      }
    };
    
    clientSocket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
      if (amazonSocket) {
        amazonSocket.close();
      }
    };

    return response;
    
  } catch (error) {
    console.error("Error setting up WebSocket proxy:", error);
    return new Response(`WebSocket setup error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders
    });
  }
});