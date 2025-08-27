import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AWS SigV4 signing utilities
function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.sign('HMAC', 
    crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), 
    encoder.encode(data)
  );
}

function sha256(data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(data));
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = hmacSha256(encoder.encode('AWS4' + key), dateStamp);
  const kRegion = kDate.then(k => hmacSha256(k, regionName));
  const kService = kRegion.then(k => hmacSha256(k, serviceName));
  return kService.then(k => hmacSha256(k, 'aws4_request'));
}

function createAuthorizationHeader(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string,
  host: string,
  method: string,
  uri: string,
  queryString: string,
  headers: Record<string, string>,
  payload: string
): Promise<string> {
  const t = new Date();
  const amzDate = t.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  // Create canonical headers
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key]}`)
    .join('\n') + '\n';

  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');

  // Create canonical request
  const canonicalRequest = [
    method,
    uri,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payload
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest).then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''))
  ].join('\n');

  // Calculate signature
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacSha256(signingKey, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Create authorization header
  return `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    const { action, region = 'us-east-1', languageCode = 'en-US', sampleRate = 16000 } = await req.json();

    if (action === 'get_websocket_url') {
      // Generate WebSocket URL with proper AWS SigV4 signing
      const host = `transcribestreaming.${region}.amazonaws.com`;
      const uri = '/stream-transcription';
      const service = 'transcribe';
      const method = 'GET';
      
      const t = new Date();
      const amzDate = t.toISOString().replace(/[:\-]|\.\d{3}/g, '');
      
      const headers = {
        'host': host,
        'x-amz-date': amzDate,
        'x-amz-target': 'com.amazonaws.transcribe.Transcribe.StartStreamTranscription',
        'x-amz-transcribe-language-code': languageCode,
        'x-amz-transcribe-sample-rate': sampleRate.toString(),
        'x-amz-transcribe-media-encoding': 'pcm'
      };

      const authorization = await createAuthorizationHeader(
        accessKeyId,
        secretAccessKey,
        region,
        service,
        host,
        method,
        uri,
        '',
        headers,
        'UNSIGNED-PAYLOAD'
      );

      const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${accessKeyId}/${amzDate.substr(0, 8)}/${region}/${service}/aws4_request`,
        'X-Amz-Date': amzDate,
        'X-Amz-SignedHeaders': Object.keys(headers).sort().map(k => k.toLowerCase()).join(';'),
        'language-code': languageCode,
        'sample-rate': sampleRate.toString(),
        'media-encoding': 'pcm'
      });

      const wsUrl = `wss://${host}${uri}?${queryParams.toString()}`;

      return new Response(JSON.stringify({ 
        websocketUrl: wsUrl,
        headers: headers,
        authorization: authorization
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle WebSocket upgrade for proxy mode
    if (req.headers.get('upgrade') === 'websocket') {
      const { socket, response } = Deno.upgradeWebSocket(req);

      socket.onopen = () => {
        console.log('Amazon Transcribe WebSocket connection opened');
      };

      socket.onmessage = async (event) => {
        try {
          // Forward audio data to Amazon Transcribe
          const data = JSON.parse(event.data);
          
          if (data.type === 'audio') {
            // Process audio chunk and send to Amazon Transcribe
            // This would require implementing the actual AWS streaming protocol
            console.log('Received audio chunk:', data.audio.length);
          }
        } catch (error) {
          console.error('Error processing message:', error);
          socket.send(JSON.stringify({ error: 'Processing error' }));
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed');
      };

      return response;
    }

    return new Response(JSON.stringify({ 
      status: 'ready',
      service: 'Amazon Transcribe'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in Amazon Transcribe function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});