import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VideoRequest {
  imageBase64: string;
  mimeType: string;
  orientation: 'portrait' | 'landscape';
  durationSeconds?: number;
}

interface VeoOperation {
  name: string;
  done?: boolean;
  error?: { message: string };
  response?: {
    generatedSamples?: Array<{
      video?: {
        uri?: string;
        bytesBase64Encoded?: string;
      };
    }>;
  };
}

// Generate a pure white PNG image of specified dimensions
function createWhiteImage(width: number, height: number): string {
  // Create a minimal PNG with white pixels
  // This is a simplified approach - we create a base64 PNG
  
  // PNG signature
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  
  // IHDR chunk (image header)
  const ihdrData = new Uint8Array(13);
  const view = new DataView(ihdrData.buffer);
  view.setUint32(0, width);    // width
  view.setUint32(4, height);   // height
  ihdrData[8] = 8;             // bit depth
  ihdrData[9] = 2;             // color type (RGB)
  ihdrData[10] = 0;            // compression
  ihdrData[11] = 0;            // filter
  ihdrData[12] = 0;            // interlace
  
  const ihdr = createChunk('IHDR', ihdrData);
  
  // IDAT chunk (compressed image data)
  // For a white image, we need to create scanlines of white pixels
  // Each scanline starts with a filter byte (0) followed by RGB values (255, 255, 255)
  const rawData = new Uint8Array((1 + width * 3) * height);
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 3);
    rawData[offset] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      rawData[offset + 1 + x * 3] = 255; // R
      rawData[offset + 1 + x * 3 + 1] = 255; // G
      rawData[offset + 1 + x * 3 + 2] = 255; // B
    }
  }
  
  // Use deflate compression (simplified - just store blocks)
  const compressed = deflateRaw(rawData);
  const idat = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = createChunk('IEND', new Uint8Array(0));
  
  // Combine all chunks
  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdr, offset); offset += ihdr.length;
  png.set(idat, offset); offset += idat.length;
  png.set(iend, offset);
  
  // Convert to base64
  let binary = '';
  for (let i = 0; i < png.length; i++) {
    binary += String.fromCharCode(png[i]);
  }
  return btoa(binary);
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);
  
  // Length
  view.setUint32(0, data.length);
  
  // Type
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  
  // Data
  chunk.set(data, 8);
  
  // CRC32
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(new TextEncoder().encode(type), 0);
  crcData.set(data, 4);
  const crc = crc32(crcData);
  view.setUint32(8 + data.length, crc);
  
  return chunk;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table = getCrc32Table();
  
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crc32Table: Uint32Array | null = null;
function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;
  
  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c;
  }
  return crc32Table;
}

// Simple deflate compression using stored blocks (no compression, but valid deflate)
function deflateRaw(data: Uint8Array): Uint8Array {
  const maxBlockSize = 65535;
  const numBlocks = Math.ceil(data.length / maxBlockSize);
  const result = new Uint8Array(data.length + numBlocks * 5 + 6); // 2 for zlib header, 4 for adler32
  let offset = 0;
  
  // Zlib header (compression method = 8, window size = 7)
  result[offset++] = 0x78;
  result[offset++] = 0x01;
  
  for (let i = 0; i < numBlocks; i++) {
    const start = i * maxBlockSize;
    const end = Math.min(start + maxBlockSize, data.length);
    const blockData = data.slice(start, end);
    const isLast = i === numBlocks - 1;
    
    // Block header
    result[offset++] = isLast ? 0x01 : 0x00; // BFINAL + BTYPE (stored)
    result[offset++] = blockData.length & 0xFF;
    result[offset++] = (blockData.length >> 8) & 0xFF;
    result[offset++] = (~blockData.length) & 0xFF;
    result[offset++] = ((~blockData.length) >> 8) & 0xFF;
    
    result.set(blockData, offset);
    offset += blockData.length;
  }
  
  // Adler-32 checksum
  const adler = adler32(data);
  result[offset++] = (adler >> 24) & 0xFF;
  result[offset++] = (adler >> 16) & 0xFF;
  result[offset++] = (adler >> 8) & 0xFF;
  result[offset++] = adler & 0xFF;
  
  return result.slice(0, offset);
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

async function pollOperation(operationName: string, apiKey: string, maxWaitMs: number = 180000): Promise<VeoOperation> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds
  
  while (Date.now() - startTime < maxWaitMs) {
    console.log(`Polling operation: ${operationName}`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Poll error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to poll operation: ${response.status}`);
    }
    
    const operation: VeoOperation = await response.json();
    console.log(`Operation status: done=${operation.done}`);
    
    if (operation.done) {
      return operation;
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Video generation timed out after 3 minutes');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Get API key
    const apiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      console.error('No Google API key configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Google API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body: VideoRequest = await req.json();
    const { imageBase64, mimeType = 'image/png', orientation, durationSeconds = 6 } = body;
    
    console.log(`Processing video generation request - orientation: ${orientation}, duration: ${durationSeconds}s`);
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Determine dimensions based on orientation
    const width = orientation === 'landscape' ? 1280 : 720;
    const height = orientation === 'landscape' ? 720 : 1280;
    const aspectRatio = orientation === 'landscape' ? '16:9' : '9:16';
    
    console.log(`Creating white first frame: ${width}x${height}`);
    
    // Create white first frame
    const whiteImageBase64 = createWhiteImage(width, height);
    
    // Prepare the Veo API request
    const veoRequest = {
      instances: [
        {
          prompt: "Smooth, gradual reveal animation. The image fades in seamlessly from pure white, with visual elements appearing naturally and progressively until the complete infographic is fully visible. Professional, elegant transition with consistent pacing throughout.",
          image: {
            bytesBase64Encoded: whiteImageBase64,
            mimeType: 'image/png',
          },
          referenceImages: [
            {
              referenceId: 1,
              referenceType: "REFERENCE_TYPE_LAST_FRAME",
              image: {
                bytesBase64Encoded: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      parameters: {
        aspectRatio: aspectRatio,
        durationSeconds: durationSeconds,
        personGeneration: "dont_allow",
        numberOfVideos: 1,
      },
    };
    
    console.log('Calling Veo API for video generation...');
    
    // Call Veo API
    const veoResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(veoRequest),
      }
    );
    
    if (!veoResponse.ok) {
      const errorText = await veoResponse.text();
      console.error(`Veo API error: ${veoResponse.status} - ${errorText}`);
      
      // Parse error for more details
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.error?.message || errorText;
        return new Response(
          JSON.stringify({ success: false, error: `Video generation failed: ${errorMessage}` }),
          { status: veoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: `Video generation failed: ${errorText}` }),
          { status: veoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    const operationData = await veoResponse.json();
    console.log('Operation started:', operationData.name);
    
    if (!operationData.name) {
      console.error('No operation name returned:', operationData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to start video generation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Poll for completion
    const completedOperation = await pollOperation(operationData.name, apiKey);
    
    if (completedOperation.error) {
      console.error('Operation failed:', completedOperation.error);
      return new Response(
        JSON.stringify({ success: false, error: completedOperation.error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract video from response
    const generatedSamples = completedOperation.response?.generatedSamples;
    if (!generatedSamples || generatedSamples.length === 0) {
      console.error('No video generated:', completedOperation);
      return new Response(
        JSON.stringify({ success: false, error: 'No video was generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const video = generatedSamples[0].video;
    if (!video) {
      console.error('No video in sample:', generatedSamples[0]);
      return new Response(
        JSON.stringify({ success: false, error: 'Video not found in response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Video generation complete!');
    
    // Return the video URL or base64
    if (video.uri) {
      return new Response(
        JSON.stringify({ success: true, videoUrl: video.uri }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (video.bytesBase64Encoded) {
      const videoDataUrl = `data:video/mp4;base64,${video.bytesBase64Encoded}`;
      return new Response(
        JSON.stringify({ success: true, videoUrl: videoDataUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, error: 'No video data in response' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in infographic-to-video:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
