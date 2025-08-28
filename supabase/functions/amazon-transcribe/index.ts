import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Amazon Transcribe function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  if (req.headers.get("upgrade") === "websocket") {
    console.log('WebSocket upgrade requested for Amazon Transcribe');
    return handleWebSocketUpgrade(req);
  }

  try {
    // Get AWS credentials from environment
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');

    console.log('Checking AWS credentials...');
    if (!accessKeyId || !secretAccessKey) {
      console.error('Missing AWS credentials:', { 
        hasAccessKeyId: !!accessKeyId, 
        hasSecretAccessKey: !!secretAccessKey 
      });
      return new Response(
        JSON.stringify({ 
          error: 'AWS credentials not configured',
          details: 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set'
        }), 
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    const { action, region = 'us-east-1', languageCode = 'en-US', sampleRate = 16000 } = await req.json();
    console.log('Request parameters:', { action, region, languageCode, sampleRate });

    if (action === 'check_credentials') {
      console.log('Credentials check - AWS credentials are available');
      return new Response(
        JSON.stringify({ available: true }), 
        { 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    if (action === 'get_websocket_url') {
      console.log('Generating WebSocket URL for Amazon Transcribe...');
      
      // Generate the WebSocket URL with AWS SigV4 signing
      const host = `transcribestreaming.${region}.amazonaws.com:8443`;
      const endpoint = `wss://${host}/stream-transcription-websocket`;
      
      // Create the canonical request for AWS SigV4 signing
      const algorithm = 'AWS4-HMAC-SHA256';
      const service = 'transcribe';
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
      const dateStamp = amzDate.substr(0, 8);
      
      console.log('Signing parameters:', { host, region, amzDate, dateStamp });

      // Query parameters for transcribe streaming
      const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': algorithm,
        'X-Amz-Credential': `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': '300',
        'X-Amz-SignedHeaders': 'host',
        'language-code': languageCode,
        'media-encoding': 'pcm',
        'sample-rate': sampleRate.toString()
      });

      console.log('Query parameters created:', Object.fromEntries(queryParams));

      // Create canonical request
      const canonicalUri = '/stream-transcription-websocket';
      const canonicalQuerystring = queryParams.toString();
      const canonicalHeaders = `host:${host}\n`;
      const signedHeaders = 'host';
      const payloadHash = 'UNSIGNED-PAYLOAD';
      
      const canonicalRequest = [
        'GET',
        canonicalUri,
        canonicalQuerystring,
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join('\n');

      console.log('Canonical request created');

      // Create string to sign
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        await sha256(canonicalRequest)
      ].join('\n');

      console.log('String to sign created');

      // Calculate signature
      const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
      const kRegion = await hmacSha256(kDate, region);
      const kService = await hmacSha256(kRegion, service);
      const kSigning = await hmacSha256(kService, 'aws4_request');
      const signature = await hmacSha256(kSigning, stringToSign);

      console.log('Signature calculated successfully');

      // Add signature to query parameters
      queryParams.set('X-Amz-Signature', signature);

      // Construct final WebSocket URL
      const websocketUrl = `${endpoint}?${queryParams.toString()}`;
      
      console.log('WebSocket URL generated successfully, length:', websocketUrl.length);

      return new Response(
        JSON.stringify({ 
          websocketUrl,
          region,
          languageCode,
          sampleRate
        }), 
        { 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.error('Invalid action provided:', action);
    return new Response(
      JSON.stringify({ error: 'Invalid action' }), 
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error) {
    console.error('Error in Amazon Transcribe function:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        type: error.name
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});

// WebSocket handler for real-time streaming
async function handleWebSocketUpgrade(req: Request): Promise<Response> {
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let awsWebSocket: WebSocket | null = null;
  
  socket.onopen = async () => {
    console.log('Client WebSocket connected to Amazon Transcribe proxy');
    
    try {
      // Generate signed WebSocket URL for AWS Transcribe
      const signedUrl = await buildSignedTranscribeUrl();
      console.log('Connecting to AWS Transcribe with signed URL...');
      
      // Connect to AWS Transcribe
      awsWebSocket = new WebSocket(signedUrl);
      
      awsWebSocket.onopen = () => {
        console.log('✅ Connected to AWS Transcribe WebSocket');
      };
      
      awsWebSocket.onmessage = (event) => {
        try {
          // Forward AWS messages to client
          socket.send(event.data);
        } catch (error) {
          console.error('Error forwarding AWS message to client:', error);
        }
      };
      
      awsWebSocket.onerror = (error) => {
        console.error('AWS WebSocket error:', error);
        socket.send(JSON.stringify({ error: 'AWS connection error' }));
      };
      
      awsWebSocket.onclose = () => {
        console.log('AWS WebSocket closed');
        socket.close();
      };
      
    } catch (error) {
      console.error('Error connecting to AWS Transcribe:', error);
      socket.send(JSON.stringify({ error: 'Failed to connect to AWS Transcribe' }));
      socket.close();
    }
  };
  
  socket.onmessage = (event) => {
    try {
      // Forward client audio data to AWS
      if (awsWebSocket && awsWebSocket.readyState === WebSocket.OPEN) {
        awsWebSocket.send(event.data);
      }
    } catch (error) {
      console.error('Error forwarding client message to AWS:', error);
    }
  };
  
  socket.onclose = () => {
    console.log('Client WebSocket disconnected');
    if (awsWebSocket) {
      awsWebSocket.close();
    }
  };
  
  socket.onerror = (error) => {
    console.error('Client WebSocket error:', error);
    if (awsWebSocket) {
      awsWebSocket.close();
    }
  };
  
  return response;
}

// Build signed WebSocket URL for AWS Transcribe
async function buildSignedTranscribeUrl(): Promise<string> {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const region = Deno.env.get('AWS_REGION') || 'us-east-1';
  const languageCode = Deno.env.get('TRANSCRIBE_LANG_CODE') || 'en-US';
  const sampleRate = Deno.env.get('TRANSCRIBE_SAMPLE_RATE') || '16000';
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured');
  }
  
  const service = 'transcribe';
  const host = `transcribestreaming.${region}.amazonaws.com:8443`;
  const endpoint = `wss://${host}/stream-transcription-websocket`;
  
  // Create timestamp
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);
  
  // Query parameters for transcribe streaming
  const params = new URLSearchParams({
    'language-code': languageCode,
    'media-encoding': 'pcm',
    'sample-rate': sampleRate,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256'
  });
  
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  params.set('X-Amz-Credential', `${accessKeyId}/${credentialScope}`);
  params.set('X-Amz-Date', amzDate);
  params.set('X-Amz-Expires', '300');
  params.set('X-Amz-SignedHeaders', 'host');
  
  // Create canonical request
  const canonicalUri = '/stream-transcription-websocket';
  const canonicalQuerystring = params.toString();
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = await sha256('');
  
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');
  
  // Calculate signature
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);
  
  // Add signature to query parameters
  params.set('X-Amz-Signature', signature);
  
  // Construct final WebSocket URL
  return `${endpoint}?${params.toString()}`;
}

// Helper function to calculate SHA-256 hash
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function for HMAC-SHA256
async function hmacSha256(key: string | Uint8Array, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}