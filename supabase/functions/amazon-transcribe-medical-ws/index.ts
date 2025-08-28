import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// AWS SDK imports for Transcribe Medical
const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
const AWS_REGION = 'us-east-1';

interface TranscriptionSession {
  sessionId: string;
  clientSocket: WebSocket;
  awsSocket: WebSocket | null;
  isActive: boolean;
  startTime: Date;
  totalAudioProcessed: number;
  speakerLabels: Map<string, string>;
  confidenceScores: number[];
}

const sessions = new Map<string, TranscriptionSession>();

// Medical vocabulary and confidence scoring
const MEDICAL_CONFIDENCE_THRESHOLD = 0.85;
const CLINICAL_SPECIALTIES = [
  'PRIMARYCARE', 'CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY', 
  'RADIOLOGY', 'PATHOLOGY', 'UROLOGY'
];

// AWS Signature V4 utilities
async function sha256(message: string): Promise<ArrayBuffer> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return hashBuffer;
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
  const kDate = await sign(new TextEncoder().encode(`AWS4${key}`), dateStamp);
  const kRegion = await sign(kDate, regionName);
  const kService = await sign(kRegion, serviceName);
  const kSigning = await sign(kService, 'aws4_request');
  return kSigning;
}

async function createSignedUrl(): Promise<string> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not configured');
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);
  
  const host = `transcribestreaming.${AWS_REGION}.amazonaws.com:8443`;
  const endpoint = `wss://${host}/medical-stream-transcription-websocket`;
  
  // Medical transcription parameters
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${AWS_ACCESS_KEY_ID}/${dateStamp}/${AWS_REGION}/transcribe/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': '300',
    'X-Amz-SignedHeaders': 'host',
    'language-code': 'en-US',
    'media-encoding': 'pcm',
    'sample-rate': '16000',
    'specialty': 'PRIMARYCARE',
    'type': 'CONVERSATION',
    'show-speaker-label': 'true',
    'enable-channel-identification': 'true',
    'number-of-channels': '2'
  });

  const canonicalRequest = [
    'GET',
    '/medical-stream-transcription-websocket',
    params.toString(),
    `host:${host}`,
    '',
    'host',
    await toHex(await sha256(''))
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${AWS_REGION}/transcribe/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await toHex(await sha256(canonicalRequest))
  ].join('\n');

  const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, 'transcribe');
  const signature = toHex(await sign(signingKey, stringToSign));
  
  params.set('X-Amz-Signature', signature);
  
  return `${endpoint}?${params.toString()}`;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function processTranscriptionResult(result: any, session: TranscriptionSession): any {
  try {
    // Extract confidence scores for clinical accuracy
    if (result.Transcript?.Results) {
      for (const transcriptResult of result.Transcript.Results) {
        if (transcriptResult.Alternatives) {
          for (const alternative of transcriptResult.Alternatives) {
            if (alternative.Items) {
              for (const item of alternative.Items) {
                if (item.Confidence !== undefined) {
                  session.confidenceScores.push(parseFloat(item.Confidence));
                }
              }
            }
          }
        }
        
        // Process speaker labels for clinical context
        if (transcriptResult.ChannelLabel && transcriptResult.Alternatives?.[0]?.Transcript) {
          const speakerId = transcriptResult.ChannelLabel;
          const transcript = transcriptResult.Alternatives[0].Transcript;
          
          // Assign clinical roles based on content analysis
          if (!session.speakerLabels.has(speakerId)) {
            const isLikelyClinic = /\b(doctor|physician|nurse|clinician|prescription|diagnosis|treatment)\b/i.test(transcript);
            session.speakerLabels.set(speakerId, isLikelyClinic ? 'Clinician' : 'Patient');
          }
        }
      }
    }

    // Calculate average confidence for this result
    const recentConfidence = session.confidenceScores.slice(-10);
    const avgConfidence = recentConfidence.length > 0 
      ? recentConfidence.reduce((a, b) => a + b, 0) / recentConfidence.length 
      : 1.0;

    // Add clinical metadata to the result
    return {
      ...result,
      clinicalMetadata: {
        averageConfidence: avgConfidence,
        meetsMedicalThreshold: avgConfidence >= MEDICAL_CONFIDENCE_THRESHOLD,
        speakerLabels: Object.fromEntries(session.speakerLabels),
        totalAudioProcessed: session.totalAudioProcessed,
        sessionDuration: Date.now() - session.startTime.getTime()
      }
    };
  } catch (error) {
    console.error('Error processing transcription result:', error);
    return result;
  }
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log('Amazon Transcribe Medical WebSocket connection requested');

  const { socket, response } = Deno.upgradeWebSocket(req);
  const sessionId = generateSessionId();

  // Initialize session
  const session: TranscriptionSession = {
    sessionId,
    clientSocket: socket,
    awsSocket: null,
    isActive: false,
    startTime: new Date(),
    totalAudioProcessed: 0,
    speakerLabels: new Map(),
    confidenceScores: []
  };

  sessions.set(sessionId, session);
  console.log(`Medical transcription session created: ${sessionId}`);

  socket.onopen = async () => {
    console.log(`Client connected to medical transcription session: ${sessionId}`);
    
    try {
      // Create connection to AWS Transcribe Medical
      const signedUrl = await createSignedUrl();
      console.log('Connecting to AWS Transcribe Medical...');
      
      const awsSocket = new WebSocket(signedUrl);
      session.awsSocket = awsSocket;

      awsSocket.onopen = () => {
        console.log(`Connected to AWS Transcribe Medical for session: ${sessionId}`);
        session.isActive = true;
        
        // Send confirmation to client
        socket.send(JSON.stringify({
          type: 'session_started',
          sessionId: sessionId,
          service: 'amazon_transcribe_medical',
          features: {
            speakerIdentification: true,
            medicalVocabulary: true,
            confidenceScoring: true,
            clinicalSpecialty: 'PRIMARYCARE'
          }
        }));
      };

      awsSocket.onmessage = (event) => {
        try {
          console.log('Received message from AWS Transcribe Medical');
          const data = JSON.parse(event.data);
          
          // Process and enhance the transcription result
          const enhancedResult = processTranscriptionResult(data, session);
          
          // Forward to client with clinical enhancements
          socket.send(JSON.stringify({
            type: 'transcription_result',
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            ...enhancedResult
          }));
          
        } catch (error) {
          console.error('Error processing AWS message:', error);
          socket.send(JSON.stringify({
            type: 'error',
            sessionId: sessionId,
            error: 'Failed to process transcription result'
          }));
        }
      };

      awsSocket.onerror = (error) => {
        console.error(`AWS WebSocket error for session ${sessionId}:`, error);
        socket.send(JSON.stringify({
          type: 'error',
          sessionId: sessionId,
          error: 'AWS Transcribe Medical connection error'
        }));
      };

      awsSocket.onclose = (event) => {
        console.log(`AWS WebSocket closed for session ${sessionId}:`, event.code, event.reason);
        session.isActive = false;
        socket.send(JSON.stringify({
          type: 'session_ended',
          sessionId: sessionId,
          reason: 'AWS connection closed',
          finalStats: {
            totalAudioProcessed: session.totalAudioProcessed,
            averageConfidence: session.confidenceScores.length > 0 
              ? session.confidenceScores.reduce((a, b) => a + b, 0) / session.confidenceScores.length 
              : 0,
            sessionDuration: Date.now() - session.startTime.getTime(),
            speakerCount: session.speakerLabels.size
          }
        }));
      };

    } catch (error) {
      console.error('Error creating AWS connection:', error);
      socket.send(JSON.stringify({
        type: 'error',
        sessionId: sessionId,
        error: `Failed to connect to AWS Transcribe Medical: ${error.message}`
      }));
    }
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log(`Received message from client: ${message.type}`);

      if (message.type === 'audio_data' && session.awsSocket && session.isActive) {
        // Forward audio data to AWS
        session.totalAudioProcessed += message.audioData?.length || 0;
        
        const awsMessage = {
          MessageType: 'AudioEvent',
          AudioChunk: message.audioData
        };
        
        session.awsSocket.send(JSON.stringify(awsMessage));
        
      } else if (message.type === 'configure_session') {
        // Handle session configuration (specialty, etc.)
        console.log('Session configuration:', message.config);
        
      } else if (message.type === 'end_session') {
        // Clean session end
        if (session.awsSocket) {
          session.awsSocket.close(1000, 'Session ended by client');
        }
      }
      
    } catch (error) {
      console.error('Error processing client message:', error);
      socket.send(JSON.stringify({
        type: 'error',
        sessionId: sessionId,
        error: 'Failed to process message'
      }));
    }
  };

  socket.onclose = () => {
    console.log(`Client disconnected from session: ${sessionId}`);
    
    // Clean up AWS connection
    if (session.awsSocket) {
      session.awsSocket.close(1000, 'Client disconnected');
    }
    
    // Remove session
    sessions.delete(sessionId);
    console.log(`Session ${sessionId} cleaned up. Active sessions: ${sessions.size}`);
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error);
  };

  return response;
});