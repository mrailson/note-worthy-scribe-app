/**
 * Security validation utilities for input sanitization and validation
 */

// Regular expressions for detecting potentially malicious input
const SQL_INJECTION_PATTERNS = [
  /(\b(select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
  /(union\s+select)/gi,
  /('|")(.*?)\1\s*(or|and)/gi,
  /(\bor\b|\band\b)\s*['"]?(\d+|true|false)['"]?\s*[=<>]/gi
];

const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on(load|error|click|focus|blur|change|submit|reset|select|resize|scroll)=/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /data:text\/html/gi,
  /vbscript:/gi
];

const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$(){}[\]\\]/g,
  /\.\.\//g,
  /(nc|netcat|wget|curl|bash|sh|cmd|powershell)/gi
];

/**
 * Validates input for potential security threats
 */
export function validateInputSecurity(input: string): {
  isValid: boolean;
  threats: string[];
  sanitized: string;
} {
  const threats: string[] = [];
  let sanitized = input;

  // Check for SQL injection
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('SQL injection detected');
      break;
    }
  }

  // Check for XSS
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('Cross-site scripting (XSS) detected');
      sanitized = sanitized.replace(pattern, '');
    }
  }

  // Check for command injection
  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('Command injection detected');
      break;
    }
  }

  // Check input length
  if (input.length > 10000) {
    threats.push('Input exceeds maximum allowed length');
  }

  // Basic HTML entity encoding for output safety
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return {
    isValid: threats.length === 0,
    threats,
    sanitized
  };
}

/**
 * Sanitizes file upload names and validates file types
 */
export function validateFileUpload(file: File): {
  isValid: boolean;
  errors: string[];
  sanitizedName: string;
} {
  const errors: string[] = [];
  let sanitizedName = file.name;

  // Allowed file types for different contexts
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml', 'image/tiff'];
  const allowedDocumentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm'];

  const allAllowedTypes = [...allowedImageTypes, ...allowedDocumentTypes, ...allowedAudioTypes];

  // Check file type
  if (!allAllowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }

  // Check file size (50MB max)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push('File size exceeds 50MB limit');
  }

  // Sanitize filename
  sanitizedName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .substring(0, 255); // Limit length

  // Check for dangerous file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.vbs', '.ps1'];
  for (const ext of dangerousExtensions) {
    if (sanitizedName.toLowerCase().endsWith(ext)) {
      errors.push(`File extension ${ext} is not allowed`);
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedName
  };
}

/**
 * Rate limiting utility for API calls
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 10, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }

    // Add current attempt
    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);
    
    return true;
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

export const apiRateLimiter = new RateLimiter(30, 60000); // 30 requests per minute
export const authRateLimiter = new RateLimiter(5, 300000); // 5 attempts per 5 minutes

/**
 * Validates email addresses for security
 */
export function validateEmailSecurity(email: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  // Check for potentially malicious patterns
  if (email.includes('..') || email.includes('--')) {
    errors.push('Email contains suspicious patterns');
  }

  // Length validation
  if (email.length > 254) {
    errors.push('Email address too long');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Content Security Policy headers for enhanced protection
 */
export const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' https://embed.app.guidde.com https://*.guidde.com",
    "child-src 'self' https://embed.app.guidde.com https://*.guidde.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};