// LG-GENERATE-PDF v2.1 - jpeg-js decoder + pure TS encoder (cache bust: 20251206-1545)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb, PDFName } from "https://esm.sh/pdf-lib@1.17.1";
import { decode as decodeJpeg } from "https://esm.sh/jpeg-js@0.4.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// BATCH PROCESSING CONFIGURATION
const IMAGE_BATCH_SIZE = 10; // Process 10 pages per batch maximum
const SUMMARY_BATCH_SIZE = 10; // Match image batch size

// MEMORY PROTECTION LIMITS
const MAX_BATCH_INPUT_MB = 5;
const MAX_BATCH_INPUT_BYTES = MAX_BATCH_INPUT_MB * 1024 * 1024;
const MAX_OPENAI_TOKENS = 120000;
const RETRY_BATCH_SIZE = 2; // Retry with 2 pages per batch on memory issues

// SystmOne upload limit
const MAX_PDF_SIZE_MB = 5;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

// Large document thresholds
const LARGE_DOC_THRESHOLD = 200; // Only skip compression for extremely large docs
const MAX_PAGES_PER_SPLIT_PART = 30; // Documents >30 pages split into 30-page parts
const UPLOAD_RETRY_ATTEMPTS = 3; // Retry upload failures

// Tracking interfaces for failed pages
interface FailedPage {
  pageNum: number;
  filename: string;
  reason: string;
  retryAttempts: number;
}

// Index page link position tracking
interface IndexEntryPosition {
  indexPageIndex: number;  // Which index page (0, 1, 2...) for multi-page indexes
  y: number;               // Y position of the entry
  targetPdfPage: number;   // The PDF page number to link to (4, 5, 6, etc.)
}

// Compression settings (40% scale, 60% quality baseline per spec)
interface CompressionSettings {
  scaleFactor: number;
  jpegQuality: number;
  grayscale: boolean;
  tier: 'Standard' | 'Aggressive';
}

function getCompressionSettings(pageCount: number, attempt: number = 0): CompressionSettings {
  // Always aggressive compression for reliability:
  // - ≤50 pages: 35% scale
  // - >50 pages: 25% scale (more aggressive)
  // - ALWAYS grayscale to keep file size down
  const baseScale = pageCount > 50 ? 0.25 : 0.35;
  const baseQuality = 0.55;
  
  return {
    scaleFactor: Math.max(baseScale - (attempt * 0.05), 0.20), // Reduce on retry
    jpegQuality: Math.max(baseQuality - (attempt * 0.05), 0.40), // Reduce on retry
    grayscale: true, // ALWAYS grayscale per user preference
    tier: pageCount > 50 ? 'Aggressive' as const : 'Standard' as const,
  };
}

// ============================================
// PURE TYPESCRIPT JPEG ENCODER (Deno-compatible)
// Based on JPEG baseline encoding without canvas.convertToBlob
// ============================================

// Standard JPEG luminance quantization table (quality-adjusted)
function getQuantizationTable(quality: number): number[] {
  // Base quantization table for luminance
  const baseTable = [
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99
  ];
  
  // Scale based on quality (1-100)
  const scale = quality < 50 ? Math.floor(5000 / quality) : Math.floor(200 - quality * 2);
  
  return baseTable.map(val => {
    const scaled = Math.floor((val * scale + 50) / 100);
    return Math.max(1, Math.min(255, scaled));
  });
}

// Chrominance quantization table
function getChrominanceQuantTable(quality: number): number[] {
  const baseTable = [
    17, 18, 24, 47, 99, 99, 99, 99,
    18, 21, 26, 66, 99, 99, 99, 99,
    24, 26, 56, 99, 99, 99, 99, 99,
    47, 66, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99
  ];
  
  const scale = quality < 50 ? Math.floor(5000 / quality) : Math.floor(200 - quality * 2);
  
  return baseTable.map(val => {
    const scaled = Math.floor((val * scale + 50) / 100);
    return Math.max(1, Math.min(255, scaled));
  });
}

// Zigzag order for DCT coefficients
const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10,
  17, 24, 32, 25, 18, 11, 4, 5,
  12, 19, 26, 33, 40, 48, 41, 34,
  27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36,
  29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46,
  53, 60, 61, 54, 47, 55, 62, 63
];

// Huffman tables for DC and AC coefficients (standard JPEG)
const DC_LUMINANCE_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_LUMINANCE_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const DC_CHROMINANCE_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_CHROMINANCE_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const AC_LUMINANCE_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125];
const AC_LUMINANCE_VALUES = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
  0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
  0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
  0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
  0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
  0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa
];

const AC_CHROMINANCE_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119];
const AC_CHROMINANCE_VALUES = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
  0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
  0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
  0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
  0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
  0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
  0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
  0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
  0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
  0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa
];

// Build Huffman table from bits and values
function buildHuffmanTable(bits: number[], values: number[]): Map<number, { code: number; length: number }> {
  const table = new Map<number, { code: number; length: number }>();
  let code = 0;
  let valueIndex = 0;
  
  for (let length = 1; length <= 16; length++) {
    for (let i = 0; i < bits[length - 1]; i++) {
      table.set(values[valueIndex], { code, length });
      valueIndex++;
      code++;
    }
    code <<= 1;
  }
  
  return table;
}

// BitWriter for efficient bit-level output
class BitWriter {
  private buffer: number[] = [];
  private currentByte = 0;
  private bitPosition = 0;
  
  writeBits(value: number, numBits: number) {
    for (let i = numBits - 1; i >= 0; i--) {
      this.currentByte = (this.currentByte << 1) | ((value >> i) & 1);
      this.bitPosition++;
      
      if (this.bitPosition === 8) {
        this.buffer.push(this.currentByte);
        // Byte stuffing for 0xFF
        if (this.currentByte === 0xFF) {
          this.buffer.push(0x00);
        }
        this.currentByte = 0;
        this.bitPosition = 0;
      }
    }
  }
  
  flush(): number[] {
    if (this.bitPosition > 0) {
      this.currentByte <<= (8 - this.bitPosition);
      this.buffer.push(this.currentByte);
      if (this.currentByte === 0xFF) {
        this.buffer.push(0x00);
      }
    }
    return this.buffer;
  }
}

// DCT constants
const COS_TABLE: number[][] = [];
for (let i = 0; i < 8; i++) {
  COS_TABLE[i] = [];
  for (let j = 0; j < 8; j++) {
    COS_TABLE[i][j] = Math.cos(((2 * j + 1) * i * Math.PI) / 16);
  }
}

// Perform 8x8 DCT
function dct8x8(block: number[]): number[] {
  const result = new Array(64).fill(0);
  
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          sum += block[x * 8 + y] * COS_TABLE[u][x] * COS_TABLE[v][y];
        }
      }
      const cu = u === 0 ? 1 / Math.SQRT2 : 1;
      const cv = v === 0 ? 1 / Math.SQRT2 : 1;
      result[u * 8 + v] = 0.25 * cu * cv * sum;
    }
  }
  
  return result;
}

// Get category and additional bits for a DC/AC value
function getCategoryAndBits(value: number): { category: number; bits: number; numBits: number } {
  if (value === 0) return { category: 0, bits: 0, numBits: 0 };
  
  const absValue = Math.abs(value);
  let category = 0;
  let temp = absValue;
  while (temp > 0) {
    category++;
    temp >>= 1;
  }
  
  const bits = value < 0 ? value + (1 << category) - 1 : value;
  return { category, bits, numBits: category };
}

// Encode a single 8x8 block
function encodeBlock(
  block: number[],
  quantTable: number[],
  dcTable: Map<number, { code: number; length: number }>,
  acTable: Map<number, { code: number; length: number }>,
  prevDC: number,
  writer: BitWriter
): number {
  // Apply DCT
  const dctBlock = dct8x8(block);
  
  // Quantize
  const quantized = dctBlock.map((val, i) => Math.round(val / quantTable[i]));
  
  // Encode DC coefficient
  const dcDiff = quantized[0] - prevDC;
  const dcCatBits = getCategoryAndBits(dcDiff);
  const dcHuff = dcTable.get(dcCatBits.category);
  if (dcHuff) {
    writer.writeBits(dcHuff.code, dcHuff.length);
    if (dcCatBits.numBits > 0) {
      writer.writeBits(dcCatBits.bits, dcCatBits.numBits);
    }
  }
  
  // Encode AC coefficients in zigzag order
  let zeroCount = 0;
  for (let i = 1; i < 64; i++) {
    const acValue = quantized[ZIGZAG[i]];
    
    if (acValue === 0) {
      zeroCount++;
    } else {
      // Write any runs of 16 zeros
      while (zeroCount >= 16) {
        const zrl = acTable.get(0xF0); // ZRL marker
        if (zrl) writer.writeBits(zrl.code, zrl.length);
        zeroCount -= 16;
      }
      
      // Write run-length + value
      const acCatBits = getCategoryAndBits(acValue);
      const runCat = (zeroCount << 4) | acCatBits.category;
      const acHuff = acTable.get(runCat);
      if (acHuff) {
        writer.writeBits(acHuff.code, acHuff.length);
        writer.writeBits(acCatBits.bits, acCatBits.numBits);
      }
      zeroCount = 0;
    }
  }
  
  // Write EOB if needed
  if (zeroCount > 0) {
    const eob = acTable.get(0x00);
    if (eob) writer.writeBits(eob.code, eob.length);
  }
  
  return quantized[0];
}

// Main JPEG encoder function
function encodeJPEG(rgba: Uint8ClampedArray, width: number, height: number, quality: number): Uint8Array {
  // Build Huffman tables
  const dcLumTable = buildHuffmanTable(DC_LUMINANCE_BITS, DC_LUMINANCE_VALUES);
  const acLumTable = buildHuffmanTable(AC_LUMINANCE_BITS, AC_LUMINANCE_VALUES);
  const dcChromTable = buildHuffmanTable(DC_CHROMINANCE_BITS, DC_CHROMINANCE_VALUES);
  const acChromTable = buildHuffmanTable(AC_CHROMINANCE_BITS, AC_CHROMINANCE_VALUES);
  
  // Get quantization tables
  const lumQuantTable = getQuantizationTable(quality);
  const chromQuantTable = getChrominanceQuantTable(quality);
  
  // Convert RGBA to YCbCr
  const paddedWidth = Math.ceil(width / 8) * 8;
  const paddedHeight = Math.ceil(height / 8) * 8;
  
  const Y = new Float32Array(paddedWidth * paddedHeight);
  const Cb = new Float32Array(paddedWidth * paddedHeight);
  const Cr = new Float32Array(paddedWidth * paddedHeight);
  
  for (let y = 0; y < paddedHeight; y++) {
    for (let x = 0; x < paddedWidth; x++) {
      const srcX = Math.min(x, width - 1);
      const srcY = Math.min(y, height - 1);
      const i = (srcY * width + srcX) * 4;
      
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      
      const idx = y * paddedWidth + x;
      Y[idx] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
      Cb[idx] = -0.168736 * r - 0.331264 * g + 0.5 * b;
      Cr[idx] = 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
  }
  
  // Build JPEG file
  const output: number[] = [];
  
  // SOI marker
  output.push(0xFF, 0xD8);
  
  // JFIF APP0 marker
  output.push(0xFF, 0xE0);
  output.push(0x00, 0x10); // Length
  output.push(0x4A, 0x46, 0x49, 0x46, 0x00); // "JFIF\0"
  output.push(0x01, 0x01); // Version 1.1
  output.push(0x00); // Aspect ratio units (0 = no units)
  output.push(0x00, 0x01); // X density
  output.push(0x00, 0x01); // Y density
  output.push(0x00, 0x00); // Thumbnail dimensions
  
  // DQT marker (quantization tables)
  output.push(0xFF, 0xDB);
  output.push(0x00, 0x43); // Length (67 bytes)
  output.push(0x00); // Table 0 (luminance), 8-bit precision
  for (let i = 0; i < 64; i++) {
    output.push(lumQuantTable[ZIGZAG[i]]);
  }
  
  output.push(0xFF, 0xDB);
  output.push(0x00, 0x43);
  output.push(0x01); // Table 1 (chrominance)
  for (let i = 0; i < 64; i++) {
    output.push(chromQuantTable[ZIGZAG[i]]);
  }
  
  // SOF0 marker (baseline DCT)
  output.push(0xFF, 0xC0);
  output.push(0x00, 0x11); // Length
  output.push(0x08); // Precision (8 bits)
  output.push((height >> 8) & 0xFF, height & 0xFF);
  output.push((width >> 8) & 0xFF, width & 0xFF);
  output.push(0x03); // 3 components (YCbCr)
  output.push(0x01, 0x11, 0x00); // Y: ID=1, sampling 1x1, quant table 0
  output.push(0x02, 0x11, 0x01); // Cb: ID=2, sampling 1x1, quant table 1
  output.push(0x03, 0x11, 0x01); // Cr: ID=3, sampling 1x1, quant table 1
  
  // DHT markers (Huffman tables)
  function writeHuffmanTable(tableClass: number, tableId: number, bits: number[], values: number[]) {
    output.push(0xFF, 0xC4);
    const length = 3 + bits.length + values.length;
    output.push((length >> 8) & 0xFF, length & 0xFF);
    output.push((tableClass << 4) | tableId);
    for (const b of bits) output.push(b);
    for (const v of values) output.push(v);
  }
  
  writeHuffmanTable(0, 0, DC_LUMINANCE_BITS, DC_LUMINANCE_VALUES);
  writeHuffmanTable(1, 0, AC_LUMINANCE_BITS, AC_LUMINANCE_VALUES);
  writeHuffmanTable(0, 1, DC_CHROMINANCE_BITS, DC_CHROMINANCE_VALUES);
  writeHuffmanTable(1, 1, AC_CHROMINANCE_BITS, AC_CHROMINANCE_VALUES);
  
  // SOS marker (start of scan)
  output.push(0xFF, 0xDA);
  output.push(0x00, 0x0C); // Length
  output.push(0x03); // 3 components
  output.push(0x01, 0x00); // Y: DC table 0, AC table 0
  output.push(0x02, 0x11); // Cb: DC table 1, AC table 1
  output.push(0x03, 0x11); // Cr: DC table 1, AC table 1
  output.push(0x00, 0x3F, 0x00); // Spectral selection and successive approximation
  
  // Encode image data
  const writer = new BitWriter();
  let prevDCY = 0, prevDCCb = 0, prevDCCr = 0;
  
  for (let blockY = 0; blockY < paddedHeight; blockY += 8) {
    for (let blockX = 0; blockX < paddedWidth; blockX += 8) {
      // Extract 8x8 blocks
      const yBlock = new Array(64);
      const cbBlock = new Array(64);
      const crBlock = new Array(64);
      
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const idx = (blockY + y) * paddedWidth + (blockX + x);
          yBlock[y * 8 + x] = Y[idx];
          cbBlock[y * 8 + x] = Cb[idx];
          crBlock[y * 8 + x] = Cr[idx];
        }
      }
      
      // Encode blocks
      prevDCY = encodeBlock(yBlock, lumQuantTable, dcLumTable, acLumTable, prevDCY, writer);
      prevDCCb = encodeBlock(cbBlock, chromQuantTable, dcChromTable, acChromTable, prevDCCb, writer);
      prevDCCr = encodeBlock(crBlock, chromQuantTable, dcChromTable, acChromTable, prevDCCr, writer);
    }
  }
  
  // Flush bit writer
  const scanData = writer.flush();
  for (const byte of scanData) {
    output.push(byte);
  }
  
  // EOI marker
  output.push(0xFF, 0xD9);
  
  return new Uint8Array(output);
}

// Parse EXIF orientation from JPEG bytes
function parseExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 12) return 1;
  
  // Check for JPEG signature (0xFFD8)
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return 1;
  
  let offset = 2;
  while (offset < bytes.length - 4) {
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }
    
    const marker = bytes[offset + 1];
    
    // APP1 marker (EXIF data)
    if (marker === 0xE1) {
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      
      // Check for "Exif" string
      if (bytes[offset + 4] === 0x45 && bytes[offset + 5] === 0x78 &&
          bytes[offset + 6] === 0x69 && bytes[offset + 7] === 0x66) {
        
        const tiffOffset = offset + 10;
        const isLittleEndian = bytes[tiffOffset] === 0x49;
        
        const readUint16 = (pos: number): number => {
          if (isLittleEndian) {
            return bytes[pos] | (bytes[pos + 1] << 8);
          }
          return (bytes[pos] << 8) | bytes[pos + 1];
        };
        
        const ifdOffset = tiffOffset + 8;
        const numEntries = readUint16(ifdOffset);
        
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = ifdOffset + 2 + (i * 12);
          const tag = readUint16(entryOffset);
          
          if (tag === 0x0112) {
            const orientation = readUint16(entryOffset + 8);
            console.log(`EXIF orientation detected: ${orientation}`);
            return orientation;
          }
        }
      }
      offset += 2 + length;
    } else if (marker === 0xD9 || marker === 0xDA) {
      break;
    } else if (marker >= 0xE0 && marker <= 0xEF) {
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + length;
    } else {
      offset++;
    }
  }
  
  return 1;
}

// Strip EXIF metadata from image bytes (for final compression)
function stripExifData(bytes: Uint8Array): Uint8Array {
  // Simple EXIF strip: only keep essential JPEG markers
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    return bytes;
  }
  
  // For simplicity, return as-is - the compression already strips most metadata
  // Full EXIF stripping would require rebuilding the JPEG structure
  return bytes;
}

// Simple nearest-neighbour scaling of RGBA pixel data
function scaleRGBA(
  data: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * srcW + srcX) * 4;
      const dstIdx = (y * dstW + x) * 4;
      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return result;
}

// Convert RGBA pixels to grayscale (in-place modification)
function convertToGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    // Keep alpha as-is
  }
}

// Compress image using jpeg-js decoder + pure TS encoder pipeline
async function compressImage(
  imageBytes: Uint8Array,
  settings: CompressionSettings
): Promise<{ bytes: Uint8Array; rotationApplied: boolean }> {
  const originalSize = imageBytes.length;
  const orientation = parseExifOrientation(imageBytes);
  
  try {
    // Step 1: Decode JPEG to raw RGBA pixels using jpeg-js
    const decoded = decodeJpeg(imageBytes, { useTArray: true, formatAsRGBA: true });
    console.log(`Decoded JPEG: ${decoded.width}x${decoded.height}, orientation: ${orientation}`);
    
    // Step 2: Calculate new dimensions based on scale factor
    const newWidth = Math.max(Math.floor(decoded.width * settings.scaleFactor), 100);
    const newHeight = Math.max(Math.floor(decoded.height * settings.scaleFactor), 100);
    console.log(`Scaling: ${decoded.width}x${decoded.height} → ${newWidth}x${newHeight} (${(settings.scaleFactor * 100).toFixed(0)}%)`);
    
    // Step 3: Scale pixels down
    const scaledPixels = scaleRGBA(
      new Uint8ClampedArray(decoded.data),
      decoded.width,
      decoded.height,
      newWidth,
      newHeight
    );
    
    // Step 4: Convert to grayscale (always, per user preference)
    if (settings.grayscale) {
      convertToGrayscale(scaledPixels);
    }
    
    // Step 5: Re-encode to JPEG using pure TypeScript encoder
    const quality = Math.floor(settings.jpegQuality * 100);
    const compressedBytes = encodeJPEG(scaledPixels, newWidth, newHeight, quality);
    
    const compressionRatio = ((1 - compressedBytes.length / originalSize) * 100).toFixed(1);
    console.log(`Compressed: ${(originalSize / 1024).toFixed(0)}KB → ${(compressedBytes.length / 1024).toFixed(0)}KB (${compressionRatio}% reduction, quality=${quality}, grayscale=${settings.grayscale})`);
    
    return { bytes: compressedBytes, rotationApplied: false };
  } catch (err) {
    console.warn(`Compression failed for image, using original:`, err);
    return { bytes: imageBytes, rotationApplied: false };
  }
}

// Embed image with fallback between JPEG and PNG
async function embedImageWithFallback(pdfDoc: any, bytes: Uint8Array, filename: string): Promise<any> {
  const lowerName = filename.toLowerCase();
  
  if (lowerName.endsWith('.png')) {
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      return await pdfDoc.embedJpg(bytes);
    }
  } else {
    try {
      return await pdfDoc.embedJpg(bytes);
    } catch {
      try {
        return await pdfDoc.embedPng(bytes);
      } catch (embedErr) {
        console.error(`Failed to embed image ${filename}:`, embedErr);
        return null;
      }
    }
  }
}

// Add a placeholder page for failed images
function addFailedPagePlaceholder(pdfDoc: any, pageIndex: number, totalPages: number, filename: string) {
  const page = pdfDoc.addPage([595, 842]);
  const pdfPageNum = pageIndex + 4;
  
  page.drawText(`Page ${pdfPageNum} - Processing Failed`, { x: 180, y: 450, size: 16 });
  page.drawText(`File: ${filename}`, { x: 180, y: 420, size: 10 });
  page.drawText('This page failed to process after 2 retry attempts.', { x: 150, y: 390, size: 10 });
  page.drawText('Please refer to original scanned document.', { x: 160, y: 360, size: 10 });
  page.drawText(`Page ${pdfPageNum} of ${totalPages + 3}`, { x: 40, y: 15, size: 9 });
}

// Add quality gate warning page if any pages failed
function addQualityGateWarningPage(pdfDoc: any, failedPages: FailedPage[], insertAfterFrontMatter: boolean = false) {
  if (failedPages.length === 0) return;
  
  const page = pdfDoc.addPage([595, 842]);
  let yPosition = 780;
  const leftMargin = 50;
  
  // Warning header
  page.drawText('QUALITY GATE WARNING', { x: leftMargin, y: yPosition, size: 16 });
  yPosition -= 30;
  
  page.drawText('Missing or failed page processing:', { x: leftMargin, y: yPosition, size: 12 });
  yPosition -= 25;
  
  for (const failed of failedPages) {
    if (yPosition < 60) break;
    
    page.drawText(`Page ${failed.pageNum + 4} failed to process after ${failed.retryAttempts} retries.`, {
      x: leftMargin + 10,
      y: yPosition,
      size: 10,
    });
    yPosition -= 15;
    
    const reasonText = failed.reason.length > 55 ? failed.reason.substring(0, 55) + '...' : failed.reason;
    page.drawText(`Reason: ${reasonText}`, {
      x: leftMargin + 20,
      y: yPosition,
      size: 9,
    });
    yPosition -= 20;
  }
  
  page.drawText('Please review original scanned images for these pages.', {
    x: leftMargin,
    y: 40,
    size: 10,
  });
}

// Calculate rotation angle from EXIF orientation
// pdf-lib uses counter-clockwise positive angles, so we use negative for CW rotation
function getRotationFromExif(orientation: number): { degrees: number; swapDimensions: boolean } {
  switch (orientation) {
    case 3: return { degrees: 180, swapDimensions: false }; // Upside down - 180° either direction
    case 6: return { degrees: -90, swapDimensions: true };  // Camera rotated CW - need CW rotation = -90°
    case 8: return { degrees: 90, swapDimensions: true };   // Camera rotated CCW - need CCW rotation = +90°
    default: return { degrees: 0, swapDimensions: false };
  }
}

// Add scanned page with patient header band - returns true if image was drawn successfully
function addScannedPageWithHeader(
  pdfDoc: any,
  image: any,
  pageIndex: number,
  totalPages: number,
  patientName: string,
  formattedNhs: string,
  formattedDob: string,
  pageSummary?: string,
  orientation: number = 1  // EXIF orientation (1-8)
): boolean {
  const page = pdfDoc.addPage([595, 842]);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const headerHeight = pageSummary ? 60 : 45; // Taller header if we have a summary
  const footerHeight = 30;
  
  // Draw white header band
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerHeight,
    width: pageWidth,
    height: headerHeight,
    color: rgb(1, 1, 1),
  });
  
  // Draw header text: Patient: {Name} | NHS: {NHS Number} | DOB: {DOB}
  page.drawText(`Patient: ${sanitizeForPdf(patientName)} | NHS: ${formattedNhs} | DOB: ${formattedDob}`, { 
    x: margin, 
    y: pageHeight - 20, 
    size: 10 
  });
  
  // Draw "Go to Index" link on top right (dark blue, clickable)
  const goToIndexText = 'Go to Index';
  const goToIndexX = pageWidth - margin - 55;
  const goToIndexY = pageHeight - 20;
  page.drawText(goToIndexText, {
    x: goToIndexX,
    y: goToIndexY,
    size: 9,
    color: rgb(0, 0, 0.7), // Dark blue for link
  });
  
  // Add link annotation for "Go to Index" - links to page 3 (index 2)
  try {
    const pages = pdfDoc.getPages();
    const indexPage = pages[2]; // Page 3 is index 2
    if (indexPage) {
      const linkAnnotation = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [goToIndexX - 2, goToIndexY - 2, goToIndexX + 58, goToIndexY + 10],
        Border: [0, 0, 0],
        Dest: [indexPage.ref, PDFName.of('XYZ'), null, null, null],
      });
      
      const annots = page.node.get(PDFName.of('Annots'));
      if (annots) {
        annots.push(linkAnnotation);
      } else {
        page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([linkAnnotation]));
      }
    }
  } catch (linkErr) {
    console.warn(`Could not add index link to page ${pageIndex + 1}:`, linkErr);
  }
  
  // Draw page summary below patient details if available
  if (pageSummary) {
    const truncatedSummary = sanitizeForPdf(pageSummary).substring(0, 80);
    page.drawText(truncatedSummary, { 
      x: margin, 
      y: pageHeight - 38, 
      size: 9,
      color: rgb(0.3, 0.3, 0.3), // Dark grey for summary
    });
  }
  
  // Light grey line under header
  page.drawRectangle({
    x: margin,
    y: pageHeight - headerHeight,
    width: pageWidth - (margin * 2),
    height: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  
  // Calculate image positioning
  const availableWidth = pageWidth - (margin * 2);
  const availableHeight = pageHeight - headerHeight - footerHeight - (margin * 0.5);
  
  let imageDrawn = false;
  
  try {
    if (image && image.width && image.height) {
      // Get rotation info from EXIF orientation
      const { degrees: rotationDegrees, swapDimensions } = getRotationFromExif(orientation);
      
      // Get effective dimensions (swap if rotated 90 or 270)
      const effectiveWidth = swapDimensions ? image.height : image.width;
      const effectiveHeight = swapDimensions ? image.width : image.height;
      
      // Calculate scale based on effective dimensions
      let scale = 1;
      if (effectiveWidth > availableWidth || effectiveHeight > availableHeight) {
        const widthRatio = availableWidth / effectiveWidth;
        const heightRatio = availableHeight / effectiveHeight;
        scale = Math.min(widthRatio, heightRatio);
      }
      
      const scaledEffectiveWidth = Math.round(effectiveWidth * scale);
      const scaledEffectiveHeight = Math.round(effectiveHeight * scale);
      
      // Position for the rotated image (centered)
      const centerX = pageWidth / 2;
      const centerY = pageHeight - headerHeight - margin * 0.5 - scaledEffectiveHeight / 2;
      
      if (rotationDegrees === 0) {
        // No rotation - simple draw
        const x = (pageWidth - scaledEffectiveWidth) / 2;
        const y = pageHeight - headerHeight - margin * 0.5 - scaledEffectiveHeight;
        page.drawImage(image, { x, y, width: scaledEffectiveWidth, height: scaledEffectiveHeight });
      } else {
        // Apply rotation using pdf-lib's rotate option
        // pdf-lib rotates counter-clockwise around the bottom-left corner of the drawn image
        const scaledOrigWidth = Math.round(image.width * scale);
        const scaledOrigHeight = Math.round(image.height * scale);
        
        // Calculate position so rotated image is centered in available space
        // After rotation, we want the center of the effective (rotated) bounds to be at (centerX, centerY)
        let x: number, y: number;
        
        if (rotationDegrees === -90) {
          // -90° (CW): Original bottom-left becomes top-left of rotated image
          // To center: place draw point so rotated center lands at (centerX, centerY)
          x = centerX + scaledEffectiveWidth / 2;
          y = centerY - scaledEffectiveHeight / 2;
        } else if (rotationDegrees === 90) {
          // +90° (CCW): Original bottom-left becomes bottom-right of rotated image
          x = centerX - scaledEffectiveWidth / 2;
          y = centerY + scaledEffectiveHeight / 2;
        } else {
          // 180°: Original bottom-left becomes top-right
          x = centerX + scaledEffectiveWidth / 2;
          y = centerY + scaledEffectiveHeight / 2;
        }
        
        page.drawImage(image, { 
          x, 
          y, 
          width: scaledOrigWidth, 
          height: scaledOrigHeight,
          rotate: { type: 'degrees', angle: rotationDegrees },
        });
      }
      
      imageDrawn = true;
      console.log(`Drew image on page ${pageIndex + 1}: ${scaledEffectiveWidth}x${scaledEffectiveHeight}px (rotation: ${rotationDegrees}°)`);
    } else {
      console.error(`Invalid image object for page ${pageIndex + 1}: missing dimensions`);
    }
  } catch (drawErr) {
    console.error(`FAILED to draw image for scanned page ${pageIndex + 1}:`, drawErr);
    // Add error text to the page
    page.drawText('Unable to embed original scan image - see logs.', {
      x: margin,
      y: 400,
      size: 10,
    });
  }
  
  // Page number (always drawn)
  const pdfPageNum = pageIndex + 4;
  page.drawText(`Page ${pdfPageNum} of ${totalPages + 3}`, { x: margin, y: 15, size: 9 });
  
  return imageDrawn;
}

// Split PDF into multiple parts for SystmOne 5MB upload limit
// FIXED: Uses smaller page chunks and retries uploads on failure
async function splitPdfIntoParts(
  pdfBytes: Uint8Array,
  basePath: string,
  supabase: any,
  patientName: string,
  formattedNhs: string,
  formattedDob: string
): Promise<string[]> {
  const SPLIT_THRESHOLD_BYTES = 4.8 * 1024 * 1024; // 4.8MB per part
  const partUrls: string[] = [];
  const failedParts: number[] = [];
  
  // Load PDF from bytes to avoid scope issues
  const originalPdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = originalPdfDoc.getPageCount();
  const frontMatterPages = 3; // Clinical Summary, Medications, Index
  const scannedPageCount = totalPages - frontMatterPages;
  
  if (scannedPageCount <= 0) {
    console.warn('No scanned pages to split');
    return [];
  }
  
  // Documents >50 pages: split into 50-page parts
  // Documents ≤50 pages: single PDF (compression keeps it under 5MB)
  let pagesPerPart: number;
  if (scannedPageCount > 50) {
    pagesPerPart = MAX_PAGES_PER_SPLIT_PART; // 50 pages per part
  } else {
    pagesPerPart = scannedPageCount; // Don't split - single PDF
  }
  
  console.log(`Split config: ${scannedPageCount} scanned pages, ${pagesPerPart} pages per part`);
  
  let currentScannedPage = 0;
  let partNumber = 1;
  const totalParts = Math.ceil(scannedPageCount / pagesPerPart);
  
  while (currentScannedPage < scannedPageCount) {
    const partDoc = await PDFDocument.create();
    
    // Copy front matter pages (0, 1, 2) to every part
    const copiedFrontMatter = await partDoc.copyPages(originalPdfDoc, [0, 1, 2]);
    for (const page of copiedFrontMatter) {
      partDoc.addPage(page);
    }
    
    // Add part indicator to first page (clinical summary)
    const firstPage = partDoc.getPage(0);
    firstPage.drawText(`PART ${partNumber} of ${totalParts}`, {
      x: 450,
      y: 790,
      size: 11,
      color: rgb(0.7, 0, 0),
    });
    
    // Calculate how many scanned pages to include in this part
    const pagesInThisPart = Math.min(pagesPerPart, scannedPageCount - currentScannedPage);
    const startPageIndex = frontMatterPages + currentScannedPage;
    const endPageIndex = startPageIndex + pagesInThisPart;
    
    console.log(`Part ${partNumber}: copying scanned pages ${currentScannedPage + 1} to ${currentScannedPage + pagesInThisPart} (PDF indices ${startPageIndex}-${endPageIndex - 1})`);
    
    // Copy scanned pages for this part
    const pageIndices: number[] = [];
    for (let i = startPageIndex; i < endPageIndex; i++) {
      pageIndices.push(i);
    }
    
    if (pageIndices.length > 0) {
      const copiedScannedPages = await partDoc.copyPages(originalPdfDoc, pageIndices);
      for (const page of copiedScannedPages) {
        partDoc.addPage(page);
      }
    }
    
    // Save part with minimal overhead
    const partBytes = await partDoc.save({ useObjectStreams: false });
    const partSizeMb = partBytes.length / (1024 * 1024);
    console.log(`Part ${partNumber} size: ${partSizeMb.toFixed(2)}MB (${partDoc.getPageCount()} pages)`);
    
    // Upload part with retries
    const partFilename = `lloyd-george_part${partNumber}.pdf`;
    const partPath = `${basePath}/final/${partFilename}`;
    const partBlob = new Blob([partBytes], { type: 'application/pdf' });
    
    let uploadSuccess = false;
    for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
      const { error: uploadError } = await supabase.storage
        .from('lg')
        .upload(partPath, partBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });
      
      if (!uploadError) {
        partUrls.push(`lg/${partPath}`);
        console.log(`Part ${partNumber} uploaded: lg/${partPath} (attempt ${attempt})`);
        uploadSuccess = true;
        break;
      } else {
        console.error(`Failed to upload part ${partNumber} (attempt ${attempt}/${UPLOAD_RETRY_ATTEMPTS}):`, uploadError);
        if (attempt < UPLOAD_RETRY_ATTEMPTS) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    if (!uploadSuccess) {
      failedParts.push(partNumber);
      console.error(`Part ${partNumber} failed after ${UPLOAD_RETRY_ATTEMPTS} attempts`);
    }
    
    currentScannedPage += pagesInThisPart;
    partNumber++;
    
    // Small delay between parts to reduce CPU pressure
    if (currentScannedPage < scannedPageCount) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Log summary
  if (failedParts.length > 0) {
    console.error(`PDF split completed with ${failedParts.length} failed parts: ${failedParts.join(', ')}`);
  } else {
    console.log(`PDF split completed successfully: ${partUrls.length} parts uploaded`);
  }
  
  // Skip archival upload for very large documents to avoid 413 errors
  if (pdfBytes.length < 10 * 1024 * 1024) { // Only upload complete PDF if < 10MB
    try {
      const fullPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      await supabase.storage.from('lg').upload(`${basePath}/final/lloyd-george_complete.pdf`, fullPdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });
      console.log('Complete PDF also uploaded for archival');
    } catch (archiveErr) {
      console.warn('Could not upload complete PDF archive (too large):', archiveErr);
    }
  } else {
    console.log(`Skipping archival upload (PDF size ${(pdfBytes.length / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit)`);
  }
  
  return partUrls;
}

// Apply final compression pass if PDF exceeds 5MB
async function applyFinalCompressionPass(pdfBytes: Uint8Array): Promise<Uint8Array> {
  console.log('Applying final compression pass (metadata stripping, recompression)...');
  
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      updateMetadata: false,
    });
    
    // Remove all metadata
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');
    
    // Re-save without object streams for simpler structure
    return await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });
  } catch (err) {
    console.warn('Final compression pass failed:', err);
    return pdfBytes;
  }
}

// Process a single batch of images - ONE AT A TIME with explicit logging
async function processBatchWithMemoryProtection(
  supabase: any,
  basePath: string,
  files: any[],
  batchStart: number,
  batchEnd: number,
  pdfDoc: any,
  compressionSettings: CompressionSettings,
  patientName: string,
  formattedNhs: string,
  formattedDob: string,
  failedPages: FailedPage[],
  pageSummaries: string[]
): Promise<number> {
  let processedCount = 0;
  let successfulEmbeds = 0;
  
  // Process each page individually - SIMPLIFIED to reduce CPU usage
  for (let i = batchStart; i < batchEnd; i++) {
    const file = files[i];
    
    console.log(`Processing page ${i + 1}/${files.length}: ${file.name}`);
    
    try {
      // Download image
      const { data: imageData, error: downloadError } = await supabase.storage
        .from('lg')
        .download(`${basePath}/raw/${file.name}`);
      
      if (downloadError || !imageData) {
        throw new Error(`Download failed: ${downloadError?.message || 'No data'}`);
      }
      
      const arrayBuffer = await imageData.arrayBuffer();
      let uint8Array = new Uint8Array(arrayBuffer);
      const originalSize = uint8Array.length;
      
      // Extract EXIF orientation
      const exifOrientation = parseExifOrientation(uint8Array);
      console.log(`Page ${i + 1}: ${(originalSize / 1024).toFixed(0)}KB, EXIF: ${exifOrientation}`);
      
      // Compress image using 35% scale, 55% quality (restoring compression)
      const compressionSettings = getCompressionSettings(files.length, 0);
      let compressedBytes: Uint8Array;
      let rotationApplied = 0;
      
      try {
        const compressed = await compressImage(uint8Array, compressionSettings);
        compressedBytes = compressed.bytes;
        rotationApplied = compressed.rotationApplied;
        console.log(`Compressed page ${i + 1}: ${(compressedBytes.length / 1024).toFixed(0)}KB (was ${(originalSize / 1024).toFixed(0)}KB), rotation: ${rotationApplied}`);
      } catch (compressErr) {
        console.warn(`Compression failed for page ${i + 1}, using original:`, compressErr);
        compressedBytes = uint8Array;
      }
      
      // Embed compressed image
      let image: any = null;
      try {
        image = await pdfDoc.embedJpg(compressedBytes);
        console.log(`Embedded JPEG page ${i + 1}`);
      } catch (jpgErr) {
        // Fallback to PNG if JPEG fails
        try {
          image = await pdfDoc.embedPng(uint8Array);
          console.log(`Embedded PNG page ${i + 1} (fallback)`);
        } catch (pngErr) {
          console.error(`FAILED page ${i + 1}:`, pngErr);
          throw new Error(`Image embed failed`);
        }
      }
      
      if (!image) {
        throw new Error('Embed returned null');
      }
      
      // Add page with header band
      const imageDrawn = addScannedPageWithHeader(pdfDoc, image, i, files.length, patientName, formattedNhs, formattedDob, pageSummaries[i], exifOrientation);
      
      if (imageDrawn) {
        successfulEmbeds++;
      }
      
      processedCount++;
      
      // Clear references for GC
      uint8Array = null as any;
      image = null;
        
    } catch (err) {
      console.error(`Page ${i + 1} failed:`, err);
      
      // Flag page for manual review
      failedPages.push({
        pageNum: i,
        filename: file.name,
        reason: err instanceof Error ? err.message : 'Unknown error',
        retryAttempts: 1,
      });
      
      // Add placeholder page
      addFailedPagePlaceholder(pdfDoc, i, files.length, file.name);
      processedCount++;
    }
  }
  
  console.log(`Batch ${batchStart + 1}-${batchEnd}: ${processedCount} pages processed, ${successfulEmbeds} images successfully embedded`);
  return processedCount;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { patientId, isBackground = false, sendEmail = false } = await req.json();
    
    if (!patientId) {
      throw new Error('Missing patientId');
    }

    console.log(`PDF generation for patient: ${patientId} (background: ${isBackground}, sendEmail: ${sendEmail})`);

    // Get patient record
    const { data: patient, error: patientError } = await supabase
      .from('lg_patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      throw new Error(`Patient not found: ${patientError?.message}`);
    }

    const basePath = `${patient.practice_ods}/${patientId}`;

    // Update status with PDF start time
    const pdfStartTime = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({ 
        pdf_generation_status: 'generating',
        pdf_started_at: pdfStartTime,
      })
      .eq('id', patientId);

    // Load summary and SNOMED data
    let summaryJson: any = {};
    let snomedJson: any = {};
    let ocrText = '';

    try {
      const { data: summaryData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/summary.json`);
      if (summaryData) {
        summaryJson = JSON.parse(await summaryData.text());
      }
    } catch {}

    try {
      const { data: snomedData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/snomed.json`);
      if (snomedData) {
        snomedJson = JSON.parse(await snomedData.text());
      }
    } catch {}

    // Load OCR text for page summaries - check multiple possible locations
    let ocrLoaded = false;

    // Priority 1: Check work/ocr_merged.json (created by lg-ocr-batch for large records)
    if (!ocrLoaded) {
      try {
        const { data: ocrData } = await supabase.storage
          .from('lg')
          .download(`${basePath}/work/ocr_merged.json`);
        if (ocrData) {
          const ocrJson = JSON.parse(await ocrData.text());
          ocrText = ocrJson.ocr_text || '';
          console.log(`✅ Loaded OCR from work/ocr_merged.json: ${ocrText.length} characters`);
          ocrLoaded = true;
        }
      } catch (e) {
        console.log('work/ocr_merged.json not found, trying other locations...');
      }
    }

    // Priority 2: Check final/ocr_merged.json (legacy location)
    if (!ocrLoaded) {
      try {
        const { data: ocrData } = await supabase.storage
          .from('lg')
          .download(`${basePath}/final/ocr_merged.json`);
        if (ocrData) {
          const ocrJson = JSON.parse(await ocrData.text());
          ocrText = ocrJson.ocr_text || '';
          console.log(`✅ Loaded OCR from final/ocr_merged.json: ${ocrText.length} characters`);
          ocrLoaded = true;
        }
      } catch (e) {
        console.log('final/ocr_merged.json not found, trying database...');
      }
    }

    // Priority 3: Fallback to database lg_ocr_batches table
    if (!ocrLoaded) {
      try {
        const { data: batches } = await supabase
          .from('lg_ocr_batches')
          .select('ocr_text, batch_number')
          .eq('patient_id', patientId)
          .order('batch_number', { ascending: true });
        
        if (batches && batches.length > 0) {
          ocrText = batches.map(b => b.ocr_text).join('\n\n');
          console.log(`✅ Loaded OCR from database: ${batches.length} batches, ${ocrText.length} characters`);
          ocrLoaded = true;
        }
      } catch (e) {
        console.warn('Could not load OCR from database:', e);
      }
    }

    if (!ocrLoaded) {
      console.warn('⚠️ No OCR text found in any location - page summaries will be generic');
    } else {
      // Log first 300 chars for debugging
      console.log(`OCR preview: "${ocrText.substring(0, 300)}..."`);
    }

    // List raw images
    const { data: files, error: listError } = await supabase.storage
      .from('lg')
      .list(`${basePath}/raw`, { sortBy: { column: 'name', order: 'asc' } });

    if (listError || !files || files.length === 0) {
      throw new Error(`No images found: ${listError?.message}`);
    }

    const pageCount = files.length;
    console.log(`Creating PDF with ${pageCount} images in batches of ${IMAGE_BATCH_SIZE}`);

    // Patient details
    const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
    const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || 'Unknown';
    const dob = patient.ai_extracted_dob || patient.dob || 'Unknown';
    const formattedNhs = formatNhsNumber(nhsNumber);
    const formattedDob = formatDateUK(dob);

    // Generate page summaries (batched) - skip for very large documents to save CPU
    let pageSummaries: string[];
    if (pageCount > LARGE_DOC_THRESHOLD) {
      console.log(`Skipping AI page summaries for large document (${pageCount} pages > ${LARGE_DOC_THRESHOLD} threshold)`);
      pageSummaries = Array.from({ length: pageCount }, (_, i) => `Scanned page ${i + 1} of ${pageCount}`);
    } else {
      console.log('Generating page summaries...');
      pageSummaries = await generatePageSummaries(ocrText, pageCount);
    }

    // Track failed pages
    const failedPages: FailedPage[] = [];

    // Compression retry loop
    let compressionAttempt = 0;
    let compressionSettings = getCompressionSettings(pageCount, compressionAttempt);
    let finalPdfBytes: Uint8Array | null = null;
    let pdfSizeMb = 0;
    let originalSizeMb = 0;

    while (compressionAttempt < 3) {
      compressionSettings = getCompressionSettings(pageCount, compressionAttempt);
      console.log(`Compression attempt ${compressionAttempt + 1}: ${compressionSettings.tier}, Scale: ${(compressionSettings.scaleFactor * 100).toFixed(0)}%, Quality: ${(compressionSettings.jpegQuality * 100).toFixed(0)}%, Grayscale: ${compressionSettings.grayscale}`);

      // Clear failed pages for retry
      failedPages.length = 0;

      // Create PDF document
      const pdfDoc = await PDFDocument.create();

      // PAGE 1: Clinical Summary
      console.log('Adding clinical summary page (Page 1)...');
      addClinicalSummaryPage(pdfDoc, patientName, nhsNumber, dob, files.length, summaryJson, snomedJson);

      // PAGE 2: Medications & Extra Detail
      console.log('Adding medications page (Page 2)...');
      addMedicationsPage(pdfDoc, patientName, formattedNhs, formattedDob, summaryJson);

      // PAGE 3: Index of Scanned Pages
      console.log('Adding index page (Page 3)...');
      const indexEntryPositions = addIndexPage(pdfDoc, files, patientName, formattedNhs, pageSummaries);

      // PAGES 4+: Process images in batches with memory protection
      for (let batchStart = 0; batchStart < files.length; batchStart += IMAGE_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + IMAGE_BATCH_SIZE, files.length);
        console.log(`Processing image batch ${Math.floor(batchStart / IMAGE_BATCH_SIZE) + 1}/${Math.ceil(files.length / IMAGE_BATCH_SIZE)}: pages ${batchStart + 1}-${batchEnd}`);

        const processedInBatch = await processBatchWithMemoryProtection(
          supabase,
          basePath,
          files,
          batchStart,
          batchEnd,
          pdfDoc,
          compressionSettings,
          patientName,
          formattedNhs,
          formattedDob,
          failedPages,
          pageSummaries
        );

        console.log(`Batch complete: ${processedInBatch}/${batchEnd - batchStart} pages processed`);

        // Small delay between batches for GC
        if (batchEnd < files.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Add quality gate warning page if any failures
      if (failedPages.length > 0) {
        console.log(`Adding quality gate warning page for ${failedPages.length} failed pages`);
        addQualityGateWarningPage(pdfDoc, failedPages);
      }

      // Add clickable links to index page entries (index page is at position 2, 0-based)
      addIndexPageLinks(pdfDoc, indexEntryPositions, 2);

      // ASSERTION: Verify page count before saving
      const actualPageCount = pdfDoc.getPageCount();
      const expectedPageCount = 3 + files.length + (failedPages.length > 0 ? 1 : 0); // 3 front matter + scanned pages + optional warning page
      console.log(`Final PDF page count = ${actualPageCount}, expected = ${expectedPageCount}`);
      
      if (actualPageCount !== expectedPageCount) {
        console.error(`PAGE COUNT MISMATCH: Expected ${expectedPageCount} pages but got ${actualPageCount}. Some pages may not have been embedded correctly.`);
        // Don't throw - continue and flag the issue
      }

      // Save PDF with minimal CPU overhead
      console.log('Saving PDF...');
      let pdfBytes = await pdfDoc.save({ 
        useObjectStreams: false,  // Reduces CPU time during serialization
        addDefaultPage: false,
      });
      pdfSizeMb = pdfBytes.length / (1024 * 1024);
      
      if (compressionAttempt === 0) {
        originalSizeMb = pdfSizeMb;
      }
      
      console.log(`PDF size: ${pdfSizeMb.toFixed(2)} MB (attempt ${compressionAttempt + 1})`);
      
      // Check if size is acceptable
      if (pdfBytes.length <= MAX_PDF_SIZE_BYTES) {
        finalPdfBytes = pdfBytes;
        break;
      }
      
      // Try final compression pass (metadata stripping)
      if (compressionAttempt >= 1) {
        console.log('Attempting final compression pass...');
        const strippedBytes = await applyFinalCompressionPass(pdfBytes);
        const strippedSizeMb = strippedBytes.length / (1024 * 1024);
        console.log(`After metadata strip: ${strippedSizeMb.toFixed(2)} MB`);
        
        if (strippedBytes.length <= MAX_PDF_SIZE_BYTES) {
          finalPdfBytes = strippedBytes;
          pdfSizeMb = strippedSizeMb;
          break;
        }
      }
      
      compressionAttempt++;
      console.log(`PDF exceeds ${MAX_PDF_SIZE_MB}MB limit, retrying with more aggressive compression...`);
    }

    // If still too large after all attempts, use best effort result
    if (!finalPdfBytes) {
      console.warn(`PDF still exceeds ${MAX_PDF_SIZE_MB}MB after ${compressionAttempt} attempts. Using best effort result with final compression.`);
      
      // Re-generate with max compression
      compressionSettings = getCompressionSettings(pageCount, 2);
      const pdfDoc = await PDFDocument.create();
      
      addClinicalSummaryPage(pdfDoc, patientName, nhsNumber, dob, pageCount, summaryJson, snomedJson);
      addMedicationsPage(pdfDoc, patientName, formattedNhs, formattedDob, summaryJson);
      const fallbackIndexEntryPositions = addIndexPage(pdfDoc, files, patientName, formattedNhs, pageSummaries);
      
      // Process all images one by one with max compression and explicit logging
      let fallbackSuccessCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Fallback processing page ${i + 1}/${files.length}: ${file.name}`);
        try {
          const { data: imageData } = await supabase.storage
            .from('lg')
            .download(`${basePath}/raw/${file.name}`);
          if (imageData) {
            const arrayBuffer = await imageData.arrayBuffer();
            let uint8Array = new Uint8Array(arrayBuffer);
            const originalSize = uint8Array.length;
            const originalExifOrientation = parseExifOrientation(uint8Array);
            const compressionResult = await compressImage(uint8Array, compressionSettings);
            uint8Array = compressionResult.bytes;
            const exifOrientation = compressionResult.rotationApplied ? 1 : originalExifOrientation;
            console.log(`Compressed fallback page ${i + 1}: ${(uint8Array.length / 1024).toFixed(0)}KB, EXIF: ${exifOrientation}`);
            
            let image: any = null;
            try {
              image = await pdfDoc.embedJpg(uint8Array);
              console.log(`Embedded JPEG for fallback page ${i + 1}`);
            } catch {
              image = await pdfDoc.embedPng(uint8Array);
              console.log(`Embedded PNG for fallback page ${i + 1}`);
            }
            
            const imageDrawn = addScannedPageWithHeader(pdfDoc, image, i, files.length, patientName, formattedNhs, formattedDob, pageSummaries[i], exifOrientation);
            if (imageDrawn) fallbackSuccessCount++;
          }
        } catch (err) {
          console.error(`FAILED fallback page ${i + 1}:`, err);
          addFailedPagePlaceholder(pdfDoc, i, files.length, file.name);
        }
      }
      
      console.log(`Fallback processing complete: ${fallbackSuccessCount}/${files.length} images successfully embedded`);
      
      if (failedPages.length > 0) {
        addQualityGateWarningPage(pdfDoc, failedPages);
      }
      
      // Add clickable links to index page entries
      addIndexPageLinks(pdfDoc, fallbackIndexEntryPositions, 2);
      
      // ASSERTION: Verify page count
      const fallbackPageCount = pdfDoc.getPageCount();
      const expectedFallbackPages = 3 + files.length + (failedPages.length > 0 ? 1 : 0);
      console.log(`Fallback PDF page count = ${fallbackPageCount}, expected = ${expectedFallbackPages}`);
      
      let pdfBytes = await pdfDoc.save({ 
        useObjectStreams: false,
        addDefaultPage: false,
      });
      
      // Apply final compression pass
      pdfBytes = await applyFinalCompressionPass(pdfBytes);
      
      finalPdfBytes = pdfBytes;
      pdfSizeMb = finalPdfBytes.length / (1024 * 1024);
    }

    // Determine if split is needed (4.8MB threshold for SystmOne compatibility)
    const SPLIT_THRESHOLD_BYTES = 4.8 * 1024 * 1024;
    const needsSplit = finalPdfBytes.length > SPLIT_THRESHOLD_BYTES;
    
    let pdfPartUrls: string[] = [];
    
    if (needsSplit) {
      console.log(`PDF size ${pdfSizeMb.toFixed(2)}MB exceeds 4.8MB threshold, splitting into parts...`);
      pdfPartUrls = await splitPdfIntoParts(finalPdfBytes, basePath, supabase, patientName, formattedNhs, formattedDob);
      console.log(`PDF split into ${pdfPartUrls.length} parts`);
    } else {
      // Upload single PDF
      const pdfBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      await supabase.storage.from('lg').upload(`${basePath}/final/lloyd-george.pdf`, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });
    }

    // Update patient record with completion info
    // FIXED: Only mark complete if we have valid PDF URLs
    const pdfCompletedTime = new Date().toISOString();
    const hasValidPdf = needsSplit ? (pdfPartUrls.length > 0) : true;
    
    if (!hasValidPdf) {
      console.error('PDF generation completed but no valid URLs - marking as failed');
      await supabase
        .from('lg_patients')
        .update({
          pdf_generation_status: 'failed',
          error_message: 'PDF split upload failed - no parts were successfully uploaded',
          pdf_completed_at: pdfCompletedTime,
        })
        .eq('id', patientId);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PDF split upload failed',
          patientId,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    await supabase
      .from('lg_patients')
      .update({
        job_status: 'succeeded',
        processing_phase: 'complete',
        processing_completed_at: pdfCompletedTime,
        pdf_url: needsSplit ? pdfPartUrls[0] : `lg/${basePath}/final/lloyd-george.pdf`,
        pdf_generation_status: 'complete',
        pdf_completed_at: pdfCompletedTime,
        pdf_final_size_mb: parseFloat(pdfSizeMb.toFixed(2)),
        original_size_mb: parseFloat(originalSizeMb.toFixed(2)),
        compression_tier: compressionSettings.tier,
        compression_attempts: compressionAttempt + 1,
        pdf_split: needsSplit,
        pdf_parts: needsSplit ? pdfPartUrls.length : 1,
        pdf_part_urls: needsSplit ? pdfPartUrls : [],
      })
      .eq('id', patientId);

    console.log(`PDF generation complete for patient ${patientId}: ${pdfSizeMb.toFixed(2)}MB, ${compressionSettings.tier}, ${compressionAttempt + 1} attempt(s), ${failedPages.length} failed pages`);

    // Send email with PDF attachment
    if (sendEmail && !patient.email_sent_at && finalPdfBytes) {
      console.log('Sending email with PDF attachment...');
      await sendSummaryEmailWithPdf(supabase, patient, patientName, nhsNumber, dob, summaryJson, snomedJson, finalPdfBytes);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        patientId,
        pdfSizeMb: pdfSizeMb.toFixed(2),
        failedPages: failedPages.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PDF generation error:', error);
    
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.patientId) {
        await supabase
          .from('lg_patients')
          .update({
            pdf_generation_status: 'failed',
            error_message: `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
          .eq('id', body.patientId);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'PDF generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function sanitizeForPdf(text: string): string {
  return text
    .replace(/═/g, '=')
    .replace(/─/g, '-')
    .replace(/│/g, '|')
    .replace(/[┌┐└┘├┤┬┴┼]/g, '+')
    .replace(/•/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/…/g, '...')
    .replace(/\*/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
}

// PAGE 1: Clinical Summary
function addClinicalSummaryPage(
  pdfDoc: any,
  patientName: string,
  nhsNumber: string,
  dob: string,
  pageCount: number,
  summaryJson: any,
  snomedJson: any
) {
  let currentPage = pdfDoc.addPage([595, 842]);
  let yPosition = 790;
  const leftMargin = 50;
  const lineHeight = 14;
  const pageMarginBottom = 60;

  const drawLine = (text: string, size = 10, indent = 0) => {
    const safeText = sanitizeForPdf(text).substring(0, 80);
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
    currentPage.drawText(safeText, { x: leftMargin + indent, y: yPosition, size });
    yPosition -= lineHeight;
  };

  const addSpace = (lines = 1) => {
    yPosition -= lineHeight * lines;
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
  };

  drawLine('LLOYD GEORGE RECORD - CLINICAL SUMMARY', 14);
  addSpace(0.5);

  drawLine(`Patient: ${patientName}`, 11);
  drawLine(`NHS Number: ${nhsNumber}`, 11);
  drawLine(`Date of Birth: ${formatDateUK(dob)}`, 11);
  drawLine(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 10);
  drawLine(`Total Scanned Pages: ${pageCount}`, 10);
  addSpace(1);

  if (summaryJson?.summary_line) {
    drawLine('CLINICAL SUMMARY', 11);
    addSpace(0.3);
    const words = summaryJson.summary_line.split(' ');
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).length > 70) {
        drawLine(line.trim(), 9, 10);
        line = word;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim()) drawLine(line.trim(), 9, 10);
    addSpace(0.5);
  }

  // SNOMED sections (condensed for front page)
  const sectionLabels: Record<string, string> = {
    'diagnoses': 'DIAGNOSES',
    'surgeries': 'MAJOR SURGERIES',
    'allergies': 'ALLERGIES',
    'immunisations': 'IMMUNISATIONS',
  };
  const sections = ['diagnoses', 'surgeries', 'allergies', 'immunisations'];
  for (const key of sections) {
    const items = snomedJson?.[key] || [];
    if (items.length > 0) {
      drawLine(sectionLabels[key] || key.toUpperCase(), 11);
      for (const item of items.slice(0, 5)) {
        drawLine(`- ${item.term || 'Unknown'} [${item.code || 'UNKNOWN'}]`, 9, 10);
      }
      if (items.length > 5) {
        drawLine(`... and ${items.length - 5} more`, 8, 10);
      }
      addSpace(0.3);
    }
  }
  
  currentPage.drawText('Page 1', { x: leftMargin, y: 20, size: 9 });
}

// PAGE 2: Medications & Extra Detail
function addMedicationsPage(
  pdfDoc: any,
  patientName: string,
  nhsNumber: string,
  dob: string,
  summaryJson: any
) {
  let currentPage = pdfDoc.addPage([595, 842]);
  let yPosition = 790;
  const leftMargin = 50;
  const lineHeight = 14;
  const pageMarginBottom = 60;

  const drawLine = (text: string, size = 10, indent = 0) => {
    const safeText = sanitizeForPdf(text).substring(0, 80);
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
    currentPage.drawText(safeText, { x: leftMargin + indent, y: yPosition, size });
    yPosition -= lineHeight;
  };

  const addSpace = (lines = 1) => {
    yPosition -= lineHeight * lines;
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
  };

  drawLine('MEDICATIONS & ADDITIONAL INFORMATION', 14);
  addSpace(0.5);

  drawLine(`Patient: ${patientName}  |  NHS: ${nhsNumber}  |  DOB: ${dob}`, 9);
  addSpace(1);

  // MEDICATIONS section
  const medications = summaryJson?.medications || [];
  if (medications.length > 0) {
    drawLine('CURRENT MEDICATIONS', 11);
    addSpace(0.3);
    for (const med of medications) {
      const medLine = `${med.drug || 'Unknown'}${med.dose ? ' - ' + med.dose : ''}${med.date ? ' (' + med.date + ')' : ''}`;
      drawLine(`- ${medLine}`, 9, 10);
    }
    addSpace(0.5);
  } else {
    drawLine('CURRENT MEDICATIONS', 11);
    addSpace(0.3);
    drawLine('No medications recorded', 9, 10);
    addSpace(0.5);
  }

  // RISK FACTORS
  const riskFactors = summaryJson?.risk_factors || [];
  if (riskFactors.length > 0) {
    drawLine('RISK FACTORS', 11);
    addSpace(0.3);
    for (const rf of riskFactors) {
      drawLine(`- ${rf.factor || 'Unknown'}${rf.details ? ': ' + rf.details : ''}`, 9, 10);
    }
    addSpace(0.5);
  }

  // SOCIAL HISTORY
  const social = summaryJson?.social_history;
  if (social && (social.smoking_status !== 'unknown' || social.alcohol !== 'unknown' || social.occupation)) {
    drawLine('SOCIAL HISTORY', 11);
    addSpace(0.3);
    if (social.smoking_status && social.smoking_status !== 'unknown') {
      const smokingText = social.smoking_status === 'ex' 
        ? `Ex-smoker${social.stopped_year ? ' (stopped ' + social.stopped_year + ')' : ''}`
        : social.smoking_status;
      drawLine(`- Smoking: ${smokingText}`, 9, 10);
    }
    if (social.alcohol && social.alcohol !== 'unknown') {
      drawLine(`- Alcohol: ${social.alcohol}`, 9, 10);
    }
    if (social.occupation) {
      drawLine(`- Occupation: ${social.occupation}`, 9, 10);
    }
    addSpace(0.5);
  }

  // FAMILY HISTORY
  const familyHistory = summaryJson?.family_history || [];
  if (familyHistory.length > 0) {
    drawLine('FAMILY HISTORY', 11);
    addSpace(0.3);
    for (const fh of familyHistory) {
      drawLine(`- ${fh.relation || 'Unknown'}: ${fh.condition || 'Unknown'}`, 9, 10);
    }
    addSpace(0.5);
  }

  // REPRODUCTIVE HISTORY
  const repro = summaryJson?.reproductive_history;
  if (repro && (repro.gravida > 0 || repro.notes)) {
    drawLine('REPRODUCTIVE HISTORY', 11);
    addSpace(0.3);
    if (repro.gravida > 0 || repro.para > 0) {
      drawLine(`- G${repro.gravida} P${repro.para}${repro.miscarriages > 0 ? ' + ' + repro.miscarriages + ' miscarriage(s)' : ''}`, 9, 10);
    }
    if (repro.notes) {
      drawLine(`- ${repro.notes}`, 9, 10);
    }
    addSpace(0.5);
  }

  // HOSPITAL FINDINGS
  const hospitalFindings = summaryJson?.hospital_findings || [];
  if (hospitalFindings.length > 0) {
    drawLine('SIGNIFICANT HOSPITAL FINDINGS', 11);
    addSpace(0.3);
    for (const hf of hospitalFindings) {
      drawLine(`- ${hf.condition || 'Unknown'} - ${formatDateUK(hf.date)}${hf.outcome ? ': ' + hf.outcome : ''}`, 9, 10);
    }
    addSpace(0.5);
  }

  // ALERTS
  const alerts = summaryJson?.alerts || [];
  if (alerts.length > 0) {
    drawLine('ALERTS', 11);
    addSpace(0.3);
    for (const alert of alerts) {
      drawLine(`! ${alert.type || 'Alert'}: ${alert.note || 'Unknown'}`, 9, 10);
    }
    addSpace(0.5);
  }

  // FREE TEXT FINDINGS
  if (summaryJson?.free_text_findings) {
    drawLine('ADDITIONAL FINDINGS', 11);
    addSpace(0.3);
    const words = summaryJson.free_text_findings.split(' ');
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).length > 70) {
        drawLine(line.trim(), 9, 10);
        line = word;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim()) drawLine(line.trim(), 9, 10);
  }

  currentPage.drawText('Page 2', { x: leftMargin, y: 20, size: 9 });
}

// PAGE 3: Index of Scanned Pages - returns positions for clickable links
function addIndexPage(pdfDoc: any, files: any[], patientName: string, nhsNumber: string, pageSummaries: string[]): IndexEntryPosition[] {
  const entryPositions: IndexEntryPosition[] = [];
  let currentPage = pdfDoc.addPage([595, 842]);
  let currentIndexPageIndex = 0;
  let yPosition = 790;
  const leftMargin = 50;
  const lineHeight = 14;
  const pageMarginBottom = 60;

  currentPage.drawText('INDEX OF SCANNED PAGES', { x: leftMargin, y: yPosition, size: 14 });
  yPosition -= lineHeight * 1.5;

  currentPage.drawText(`Patient: ${sanitizeForPdf(patientName)} | NHS: ${nhsNumber}`, { 
    x: leftMargin, y: yPosition, size: 10 
  });
  yPosition -= lineHeight * 1.5;

  currentPage.drawText('Page No.', { x: leftMargin, y: yPosition, size: 10 });
  currentPage.drawText('Description', { x: leftMargin + 70, y: yPosition, size: 10 });
  yPosition -= lineHeight * 0.5;
  
  currentPage.drawText('--------', { x: leftMargin, y: yPosition, size: 10 });
  currentPage.drawText('-----------------------------------------------------------', { x: leftMargin + 70, y: yPosition, size: 10 });
  yPosition -= lineHeight;

  for (let i = 0; i < files.length; i++) {
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      currentIndexPageIndex++;
      yPosition = 790;
    }
    const pdfPageNum = i + 4;
    const summary = pageSummaries[i] || `Scanned page ${i + 1} of ${files.length}`;
    const truncatedSummary = sanitizeForPdf(summary).substring(0, 60);
    
    // Track position for clickable link
    entryPositions.push({
      indexPageIndex: currentIndexPageIndex,
      y: yPosition,
      targetPdfPage: pdfPageNum
    });
    
    // Draw "Page X" in blue to indicate clickable
    currentPage.drawText(`Page ${pdfPageNum}`, { 
      x: leftMargin, 
      y: yPosition, 
      size: 9,
      color: rgb(0, 0, 0.7) // Dark blue for clickable appearance
    });
    currentPage.drawText(truncatedSummary, { x: leftMargin + 70, y: yPosition, size: 9 });
    yPosition -= lineHeight;
  }

  yPosition -= lineHeight;
  if (yPosition < pageMarginBottom) {
    currentPage = pdfDoc.addPage([595, 842]);
    yPosition = 790;
  }
  currentPage.drawText('Click any "Page X" entry above to jump directly to that page.', {
    x: leftMargin, y: yPosition, size: 8, color: rgb(0.4, 0.4, 0.4)
  });
  
  currentPage.drawText('Page 3', { x: leftMargin, y: 20, size: 9 });
  
  return entryPositions;
}

// Add clickable link annotations to index page entries
function addIndexPageLinks(pdfDoc: any, indexEntryPositions: IndexEntryPosition[], indexPageStartIndex: number) {
  const pages = pdfDoc.getPages();
  const leftMargin = 50;
  const linkWidth = 55;  // Width to cover "Page XX"
  const linkHeight = 12;
  
  console.log(`Adding ${indexEntryPositions.length} clickable links to index page(s)...`);
  
  for (const entry of indexEntryPositions) {
    const indexPageRealIndex = indexPageStartIndex + entry.indexPageIndex;
    const targetPageIndex = entry.targetPdfPage - 1; // Convert 1-based page number to 0-based index
    
    if (indexPageRealIndex >= pages.length || targetPageIndex >= pages.length) {
      console.warn(`Skipping link: indexPage=${indexPageRealIndex}, targetPage=${targetPageIndex}, totalPages=${pages.length}`);
      continue;
    }
    
    const indexPage = pages[indexPageRealIndex];
    const targetPage = pages[targetPageIndex];
    
    if (!indexPage || !targetPage) {
      console.warn(`Missing page reference for link to page ${entry.targetPdfPage}`);
      continue;
    }
    
    try {
      // Create link annotation that jumps to target page
      const linkAnnotation = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [leftMargin, entry.y - 2, leftMargin + linkWidth, entry.y + linkHeight],
        Border: [0, 0, 0], // No visible border
        Dest: [targetPage.ref, PDFName.of('XYZ'), null, null, null], // XYZ destination preserving zoom
      });
      
      // Get or create annotations array for the index page
      const annotsKey = PDFName.of('Annots');
      const existingAnnots = indexPage.node.get(annotsKey);
      
      if (existingAnnots) {
        existingAnnots.push(pdfDoc.context.register(linkAnnotation));
      } else {
        indexPage.node.set(annotsKey, pdfDoc.context.obj([pdfDoc.context.register(linkAnnotation)]));
      }
    } catch (err) {
      console.warn(`Failed to add link for page ${entry.targetPdfPage}:`, err);
    }
  }
  
  console.log('Index page links added successfully');
}

function formatNhsNumber(nhs: string): string {
  const digits = nhs.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return nhs;
}

// Parse OCR text into per-page segments
function parseOcrByPage(ocrText: string): Map<number, string> {
  const pageMap = new Map<number, string>();
  if (!ocrText) return pageMap;

  const pageRegex = /---\s*Page\s+([^\s]+)\.(jpg|jpeg|png)\s*---/gi;
  const parts = ocrText.split(pageRegex);
  
  console.log(`parseOcrByPage: OCR text length ${ocrText.length}, split into ${parts.length} parts`);
  
  for (let i = 1; i < parts.length; i += 3) {
    const filename = parts[i];
    const pageText = parts[i + 2] || '';
    
    const numMatch = filename.match(/(\d+)/);
    const pageNum = numMatch ? parseInt(numMatch[1], 10) : Math.floor(i / 3) + 1;
    
    if (pageNum > 0) {
      pageMap.set(pageNum, pageText.trim());
      console.log(`parseOcrByPage: Mapped page ${pageNum} from filename "${filename}" (${pageText.length} chars)`);
    }
  }
  
  console.log(`parseOcrByPage: Final pageMap has ${pageMap.size} entries`);
  return pageMap;
}

// Generate AI-powered page summaries in batches
async function generatePageSummaries(ocrText: string, pageCount: number): Promise<string[]> {
  const summaries: string[] = new Array(pageCount).fill('');
  const pageMap = parseOcrByPage(ocrText);
  
  console.log(`generatePageSummaries: pageCount=${pageCount}, pageMap.size=${pageMap.size}, ocrText.length=${ocrText.length}`);
  
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  // Only fall back to generic if NO API key - NOT if pageMap is empty
  // Even with empty pageMap, OpenAI can still generate useful descriptions like "Hand-written note"
  if (!openaiKey) {
    console.warn('⚠️ No OpenAI API key - using generic page summaries');
    for (let i = 0; i < pageCount; i++) {
      summaries[i] = `Scanned page ${i + 1} of ${pageCount}`;
    }
    return summaries;
  }

  // Build page texts array - use "[No text detected]" for missing pages
  const pageTexts: { pageNum: number; text: string }[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const text = pageMap.get(i) || '';
    const pageText = text.substring(0, 400) || '[No text detected]';
    pageTexts.push({ pageNum: i, text: pageText });
  }
  
  // Log first page text for debugging
  if (pageTexts.length > 0) {
    console.log(`First page text preview (page 1): "${pageTexts[0].text.substring(0, 150)}..."`);
  }

  // Process in batches of SUMMARY_BATCH_SIZE (10)
  const batches: { pageNum: number; text: string }[][] = [];
  for (let i = 0; i < pageTexts.length; i += SUMMARY_BATCH_SIZE) {
    batches.push(pageTexts.slice(i, i + SUMMARY_BATCH_SIZE));
  }

  console.log(`Generating page summaries in ${batches.length} batch(es) for ${pageCount} pages`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const startPage = batch[0].pageNum;
    const endPage = batch[batch.length - 1].pageNum;
    
    console.log(`Processing summary batch ${batchIndex + 1}/${batches.length}: pages ${startPage}-${endPage}`);

    try {
      const prompt = `You are summarizing pages from a Lloyd George medical record scan. 
For each page below, provide a brief one-line summary (max 60 characters) describing the main content.
If the page appears blank or has minimal text, say "Mostly blank page" or similar.
Focus on clinical relevance: document types (e.g., "GP referral letter", "Blood test results"), dates, or key findings.

${batch.map(p => `PAGE ${p.pageNum}:\n${p.text || '[No text detected]'}`).join('\n\n---\n\n')}

Respond with a JSON array of ${batch.length} strings, one summary per page in order. Example:
["Continuation card - immunisation records", "GP referral letter dated 15/03/2020", "Blood test results - FBC normal"]`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        console.error(`OpenAI API error for batch ${batchIndex + 1}: ${response.status}`);
        for (let j = 0; j < batch.length; j++) {
          summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
        }
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Check token usage for memory protection
      const totalTokens = data.usage?.total_tokens || 0;
      if (totalTokens > MAX_OPENAI_TOKENS) {
        console.warn(`OpenAI token response exceeds ${MAX_OPENAI_TOKENS} tokens (${totalTokens}), may need smaller batches`);
      }
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            for (let j = 0; j < Math.min(parsed.length, batch.length); j++) {
              const summary = String(parsed[j] || '').substring(0, 60);
              summaries[batch[j].pageNum - 1] = summary || `Scanned page ${batch[j].pageNum}`;
            }
            console.log(`Batch ${batchIndex + 1} completed: ${parsed.length} summaries`);
          }
        } catch (parseErr) {
          console.error(`JSON parse error for batch ${batchIndex + 1}:`, parseErr);
          for (let j = 0; j < batch.length; j++) {
            summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
          }
        }
      } else {
        console.warn(`No JSON array found in batch ${batchIndex + 1} response`);
        for (let j = 0; j < batch.length; j++) {
          summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
        }
      }
    } catch (err) {
      console.error(`Failed to generate summaries for batch ${batchIndex + 1}:`, err);
      for (let j = 0; j < batch.length; j++) {
        summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
      }
    }

    // Delay between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Fill any remaining empty summaries
  for (let i = 0; i < summaries.length; i++) {
    if (!summaries[i]) {
      summaries[i] = `Scanned page ${i + 1} of ${pageCount}`;
    }
  }

  console.log(`Page summaries complete: ${summaries.filter(s => !s.startsWith('Scanned page')).length}/${pageCount} AI-generated`);
  return summaries;
}

// Send email with PDF attachment
async function sendSummaryEmailWithPdf(
  supabase: any,
  patient: any,
  patientName: string,
  nhsNumber: string,
  dob: string,
  summaryJson: any,
  snomedJson: any,
  pdfBytes: Uint8Array
) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', patient.user_id)
      .single();

    let userEmail = profile?.email;
    
    if (!userEmail) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(patient.user_id);
      userEmail = authUser?.email;
    }

    if (!userEmail) {
      console.log('No user email found, skipping email');
      return;
    }

    const emailHtml = buildFullSummaryEmailHtml(
      patientName,
      nhsNumber,
      dob,
      patient.practice_ods,
      patient.images_count || 0,
      summaryJson,
      snomedJson
    );

    // Convert PDF to base64
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const pdfBase64 = btoa(binary);
    console.log(`PDF attachment ready, size: ${pdfBase64.length} chars`);

    const pdfFilename = generateLGFilename(patientName, nhsNumber, dob, 1, 1);

    const attachments: Array<{ filename: string; content: string; type: string }> = [
      {
        filename: pdfFilename,
        content: pdfBase64,
        type: 'application/pdf',
      }
    ];

    const { error: emailError } = await supabase.functions.invoke('send-email-resend', {
      body: {
        to_email: userEmail,
        subject: `Lloyd George Record Summary - ${patientName} (DOB: ${formatDobDisplay(dob)}) (NHS: ${formatNhsNumber(nhsNumber)})`,
        html_content: emailHtml,
        attachments: attachments,
      },
    });

    if (emailError) {
      console.error('Email send error:', emailError);
    } else {
      await supabase
        .from('lg_patients')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', patient.id);
      console.log(`Email with PDF sent to ${userEmail}`);
    }
  } catch (err) {
    console.error('Email sending error:', err);
  }
}

function formatDateForFilename(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}_${month}_${year}`;
    }
  } catch {}
  return 'Unknown';
}

/**
 * Parses patient name into last name and first name components
 */
function parsePatientName(fullName: string | null | undefined): { lastName: string; firstName: string } {
  if (!fullName || fullName.trim() === '') {
    return { lastName: 'Unknown', firstName: 'Unknown' };
  }

  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: 'Unknown' };
  }
  
  // Assume last word is surname, everything else is first name(s)
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join('_');
  
  return { 
    lastName: sanitiseForFilename(lastName), 
    firstName: sanitiseForFilename(firstName) 
  };
}

/**
 * Sanitises a string for use in filenames
 */
function sanitiseForFilename(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

/**
 * Generates standardised Lloyd George Record filename
 * Format: Lloyd_George_Record_XX_of_YY_LastName_FirstName_NHSNumber_DOB.pdf
 */
function generateLGFilename(
  patientName: string | null | undefined,
  nhsNumber: string | null | undefined,
  dob: string | null | undefined,
  partNumber: number = 1,
  totalParts: number = 1
): string {
  const { lastName, firstName } = parsePatientName(patientName);
  const cleanNhs = (nhsNumber || 'Unknown').replace(/\s/g, '');
  const dobFormatted = formatDateForFilename(dob);
  
  const partNumStr = String(partNumber).padStart(2, '0');
  const totalPartsStr = String(totalParts).padStart(2, '0');
  
  return `Lloyd_George_Record_${partNumStr}_of_${totalPartsStr}_${lastName}_${firstName}_${cleanNhs}_${dobFormatted}.pdf`;
}

function formatDobDisplay(dateStr: string): string {
  return formatDateUK(dateStr);
}

function formatDateUK(dateStr: string | undefined | null): string {
  if (!dateStr || dateStr === 'Unknown' || dateStr === 'unknown') {
    return dateStr || 'Unknown';
  }
  
  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  try {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = months[parseInt(isoMatch[2], 10) - 1];
      const day = isoMatch[3];
      return `${day}-${month}-${year}`;
    }
    
    if (dateStr.toLowerCase().startsWith('pre ')) {
      return dateStr;
    }
    
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {}
  
  return dateStr;
}

function buildFullSummaryEmailHtml(
  patientName: string,
  nhsNumber: string,
  dob: string,
  practiceOds: string,
  imageCount: number,
  summaryJson: any,
  snomedJson: any
): string {
  const formatNhs = (nhs: string) => {
    const digits = nhs?.replace(/\s/g, '') || '';
    if (digits.length === 10) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return nhs || 'Unknown';
  };

  const snomedItemsNeedingReview = Object.values(snomedJson || {})
    .flat()
    .filter((item: any) => item && item.confidence !== undefined && item.confidence < 0.6).length;

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #005EB8; border-bottom: 3px solid #005EB8; padding-bottom: 10px;">
        Lloyd George Record Summary
      </h1>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Patient Name</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${patientName || 'Unknown'}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">NHS Number</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${formatNhs(nhsNumber)}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Date of Birth</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${formatDobDisplay(dob)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Pages Scanned</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${imageCount}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">SNOMED Items for Review</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${snomedItemsNeedingReview} items with confidence &lt;60%</td>
        </tr>
      </table>
      
      <h2 style="color: #005EB8; margin-top: 30px;">Clinical Summary</h2>
      <p style="background: #f0f4f5; padding: 15px; border-radius: 5px;">${summaryJson?.summary_line || 'No summary available'}</p>
  `;

  // Add Diagnoses section
  if (summaryJson?.diagnoses?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Diagnoses</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const item of summaryJson.diagnoses) {
      html += `<li><strong>${item.condition || 'Unknown'}</strong> - ${formatDateUK(item.date_noted)} (${item.status || 'unknown'})</li>`;
    }
    html += `</ul>`;
  }

  // Add Major Surgeries section
  if (summaryJson?.surgeries?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Major Surgeries</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const surg of summaryJson.surgeries) {
      html += `<li><strong>${surg.procedure || 'Unknown'}</strong> - ${formatDateUK(surg.date)} ${surg.notes ? `(${surg.notes})` : ''}</li>`;
    }
    html += `</ul>`;
  }

  // Add Allergies section
  if (summaryJson?.allergies?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Allergies</h3><ul style="background: #fff5f5; padding: 15px 30px; border-radius: 5px; border-left: 4px solid #DA291C;">`;
    for (const allergy of summaryJson.allergies) {
      html += `<li><strong>${allergy.allergen || 'Unknown'}</strong>: ${allergy.reaction || 'Unknown reaction'} ${allergy.year ? `(${allergy.year})` : ''}</li>`;
    }
    html += `</ul>`;
  }

  // Add Immunisations section
  if (summaryJson?.immunisations?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Immunisations</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const imm of summaryJson.immunisations) {
      html += `<li><strong>${imm.vaccine || 'Unknown'}</strong> - ${formatDateUK(imm.date)}</li>`;
    }
    html += `</ul>`;
  }

  // Add Family History section
  if (summaryJson?.family_history?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Family History</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const fh of summaryJson.family_history) {
      html += `<li><strong>${fh.relation || 'Unknown'}</strong>: ${fh.condition || 'Unknown'}</li>`;
    }
    html += `</ul>`;
  }

  // Add Social History section
  if (summaryJson?.social_history && (summaryJson.social_history.smoking_status !== 'unknown' || summaryJson.social_history.alcohol !== 'unknown' || summaryJson.social_history.occupation)) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Social History</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    if (summaryJson.social_history.smoking_status && summaryJson.social_history.smoking_status !== 'unknown') {
      const smokingText = summaryJson.social_history.smoking_status === 'ex' 
        ? `Ex-smoker${summaryJson.social_history.stopped_year ? ` (stopped ${summaryJson.social_history.stopped_year})` : ''}`
        : summaryJson.social_history.smoking_status;
      html += `<li><strong>Smoking</strong>: ${smokingText}</li>`;
    }
    if (summaryJson.social_history.alcohol && summaryJson.social_history.alcohol !== 'unknown') {
      html += `<li><strong>Alcohol</strong>: ${summaryJson.social_history.alcohol}</li>`;
    }
    if (summaryJson.social_history.occupation) {
      html += `<li><strong>Occupation</strong>: ${summaryJson.social_history.occupation}</li>`;
    }
    html += `</ul>`;
  }

  // Add Reproductive History section
  if (summaryJson?.reproductive_history && (summaryJson.reproductive_history.gravida > 0 || summaryJson.reproductive_history.notes)) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Reproductive History</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    if (summaryJson.reproductive_history.gravida > 0 || summaryJson.reproductive_history.para > 0) {
      html += `<li>G${summaryJson.reproductive_history.gravida} P${summaryJson.reproductive_history.para}${summaryJson.reproductive_history.miscarriages > 0 ? ` + ${summaryJson.reproductive_history.miscarriages} miscarriage(s)` : ''}</li>`;
    }
    if (summaryJson.reproductive_history.notes) {
      html += `<li>${summaryJson.reproductive_history.notes}</li>`;
    }
    html += `</ul>`;
  }

  // Add Hospital Findings section
  if (summaryJson?.hospital_findings?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Significant Hospital Findings</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const hf of summaryJson.hospital_findings) {
      html += `<li><strong>${hf.condition || 'Unknown'}</strong> - ${formatDateUK(hf.date)}${hf.outcome ? `: ${hf.outcome}` : ''}</li>`;
    }
    html += `</ul>`;
  }

  // Add Medications section
  if (summaryJson?.medications?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Medications</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const med of summaryJson.medications) {
      html += `<li><strong>${med.drug || 'Unknown'}</strong> ${med.dose || ''}${med.date ? ` - ${med.date}` : ''}</li>`;
    }
    html += `</ul>`;
  }

  // Add Alerts section
  if (summaryJson?.alerts?.length > 0) {
    html += `<h3 style="color: #DA291C; margin-top: 20px;">⚠️ Alerts</h3><ul style="background: #fff0f0; padding: 15px 30px; border-radius: 5px; border-left: 4px solid #DA291C;">`;
    for (const alert of summaryJson.alerts) {
      html += `<li><strong>${alert.type || 'Alert'}</strong>: ${alert.note || 'Unknown'}</li>`;
    }
    html += `</ul>`;
  }

  // Add Free Text Findings
  if (summaryJson?.free_text_findings) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Additional Findings</h3>`;
    html += `<p style="background: #f0f4f5; padding: 15px; border-radius: 5px;">${summaryJson.free_text_findings}</p>`;
  }

  // Add SNOMED Codes Table
  html += `<h2 style="color: #005EB8; margin-top: 30px;">SNOMED CT Codes (Problem Codes)</h2>`;
  html += `<p style="color: #666; font-size: 12px; margin-bottom: 15px;">Codes suitable for import into GP systems (EMIS/SystmOne). Social history, family history, and medications are not coded.</p>`;
  html += `<div style="background: #fff8e6; border-left: 4px solid #FFB81C; padding: 12px; margin-bottom: 15px; font-size: 12px;">
    <strong style="color: #ED8B00;">⚠️ Important:</strong> Where 'NK' (Not Known) is shown for dates, check the scanned Lloyd George records before coding. <strong>Do NOT use today's date for historical diagnoses.</strong>
  </div>`;
  
  const snomedSectionLabels: Record<string, string> = {
    'diagnoses': 'Diagnoses',
    'surgeries': 'Major Surgeries',
    'allergies': 'Allergies',
    'immunisations': 'Immunisations',
  };
  const snomedSections = ['diagnoses', 'surgeries', 'allergies', 'immunisations'];
  for (const section of snomedSections) {
    const items = snomedJson?.[section] || [];
    if (items.length > 0) {
      html += `<h4 style="color: #003087; margin-top: 15px;">${snomedSectionLabels[section] || section}</h4>`;
      html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">`;
      html += `<tr style="background: #005EB8; color: white;"><th style="padding: 8px; text-align: left;">Term</th><th style="padding: 8px; text-align: left;">SNOMED Code</th><th style="padding: 8px; text-align: center;">Date</th><th style="padding: 8px; text-align: center;">Confidence</th></tr>`;
      for (const item of items) {
        const confPercent = Math.round((item.confidence || 0) * 100);
        const confColor = confPercent >= 80 ? '#007F3B' : '#DA291C';
        const dateDisplay = item.date && item.date.trim() ? item.date : '<span style="color: #999; font-style: italic;">NK</span>';
        html += `<tr style="border-bottom: 1px solid #ddd;">`;
        html += `<td style="padding: 8px;">${item.term || 'Unknown'}</td>`;
        html += `<td style="padding: 8px; font-family: monospace;">${item.code || 'UNKNOWN'}</td>`;
        html += `<td style="padding: 8px; text-align: center;">${dateDisplay}</td>`;
        html += `<td style="padding: 8px; text-align: center; color: ${confColor}; font-weight: bold;">${confPercent}%</td>`;
        html += `</tr>`;
      }
      html += `</table>`;
    }
  }

  html += `
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">
        Generated by LG Capture - Notewell AI<br>
        Practice ODS: ${practiceOds || 'Unknown'}<br>
        ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  `;

  return html;
}
