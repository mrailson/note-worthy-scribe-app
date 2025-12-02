/**
 * ULID Generator
 * Generates Universally Unique Lexicographically Sortable Identifiers
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number, len: number): string {
  let str = '';
  for (let i = len; i > 0; i--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING[mod] + str;
    now = Math.floor(now / ENCODING_LEN);
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = '';
  const randomBytes = new Uint8Array(len);
  crypto.getRandomValues(randomBytes);
  
  for (let i = 0; i < len; i++) {
    str += ENCODING[randomBytes[i] % ENCODING_LEN];
  }
  return str;
}

export function generateULID(): string {
  const time = Date.now();
  return encodeTime(time, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

export function extractTimestamp(ulid: string): Date {
  if (ulid.length !== 26) {
    throw new Error('Invalid ULID');
  }
  
  const timeStr = ulid.slice(0, TIME_LEN);
  let time = 0;
  
  for (let i = 0; i < timeStr.length; i++) {
    time = time * ENCODING_LEN + ENCODING.indexOf(timeStr[i]);
  }
  
  return new Date(time);
}
