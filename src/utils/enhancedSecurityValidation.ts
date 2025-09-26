/**
 * Enhanced security validation with VPN-friendly rate limiting
 */

import { RateLimiter } from './securityValidation';

/**
 * Corporate VPN-friendly rate limiter with different limits for different scenarios
 */
class VpnFriendlyRateLimiter {
  private personalRateLimit: RateLimiter;
  private corporateRateLimit: RateLimiter;
  private emergencyRateLimit: RateLimiter;
  private knownVpnRanges: Set<string> = new Set();
  
  constructor() {
    // More lenient limits for corporate networks
    this.personalRateLimit = new RateLimiter(10, 300000); // 10 attempts per 5 minutes
    this.corporateRateLimit = new RateLimiter(15, 300000); // 15 attempts per 5 minutes for corporate
    this.emergencyRateLimit = new RateLimiter(50, 300000); // Emergency bypass with high limit
  }
  
  /**
   * Adds known corporate VPN IP ranges for special handling
   */
  addVpnRange(ipRange: string): void {
    this.knownVpnRanges.add(ipRange);
  }
  
  /**
   * Detects if request is likely from corporate VPN
   */
  private detectCorporateVpn(identifier: string, userAgent?: string): boolean {
    // Check if identifier matches known VPN patterns
    if (this.knownVpnRanges.has(identifier)) {
      return true;
    }
    
    // Check user agent for corporate indicators
    if (userAgent) {
      const corporateIndicators = [
        'corporate', 'enterprise', 'company', 'office',
        'Windows NT', 'domain', 'managed'
      ];
      
      const userAgentLower = userAgent.toLowerCase();
      return corporateIndicators.some(indicator => 
        userAgentLower.includes(indicator)
      );
    }
    
    return false;
  }
  
  /**
   * Checks if request is allowed with VPN-friendly rate limiting
   */
  isAllowed(identifier: string, userAgent?: string, isEmergency: boolean = false): {
    allowed: boolean;
    retryAfter?: number;
    message?: string;
  } {
    if (isEmergency) {
      const allowed = this.emergencyRateLimit.isAllowed(identifier);
      return {
        allowed,
        message: allowed ? undefined : 'Emergency rate limit exceeded. Please contact support.'
      };
    }
    
    const isCorporate = this.detectCorporateVpn(identifier, userAgent);
    const rateLimiter = isCorporate ? this.corporateRateLimit : this.personalRateLimit;
    
    const allowed = rateLimiter.isAllowed(identifier);
    
    if (!allowed) {
      const maxAttempts = isCorporate ? 15 : 10;
      const windowMinutes = 5;
      
      return {
        allowed: false,
        retryAfter: windowMinutes * 60, // seconds
        message: isCorporate 
          ? `Corporate network rate limit exceeded (${maxAttempts} attempts per ${windowMinutes} minutes). This limit is higher for corporate VPNs. Please wait before trying again.`
          : `Rate limit exceeded (${maxAttempts} attempts per ${windowMinutes} minutes). Please wait before trying again.`
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Resets rate limit for specific identifier (admin override)
   */
  reset(identifier: string): void {
    this.personalRateLimit.reset(identifier);
    this.corporateRateLimit.reset(identifier);
    this.emergencyRateLimit.reset(identifier);
  }
  
  /**
   * Gets current attempt count for identifier
   */
  getAttemptCount(identifier: string, userAgent?: string): number {
    const isCorporate = this.detectCorporateVpn(identifier, userAgent);
    const rateLimiter = isCorporate ? this.corporateRateLimit : this.personalRateLimit;
    
    // Access private attempts map (this is a simplified version)
    // In a real implementation, you'd expose this through the RateLimiter class
    return 0; // Placeholder - would need to modify RateLimiter class to expose this
  }
}

// Enhanced rate limiters with VPN support
export const vpnFriendlyAuthRateLimit = new VpnFriendlyRateLimiter();
export const vpnFriendlyApiRateLimit = new VpnFriendlyRateLimiter();

/**
 * Email-based rate limiting that's more VPN-friendly
 */
class EmailBasedRateLimiter {
  private emailAttempts: Map<string, number[]> = new Map();
  private readonly maxAttemptsPerEmail: number = 10; // More lenient per email
  private readonly windowMs: number = 300000; // 5 minutes
  
  isAllowed(email: string): boolean {
    const now = Date.now();
    const attempts = this.emailAttempts.get(email) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);
    
    if (validAttempts.length >= this.maxAttemptsPerEmail) {
      return false;
    }
    
    // Add current attempt
    validAttempts.push(now);
    this.emailAttempts.set(email, validAttempts);
    
    return true;
  }
  
  reset(email: string): void {
    this.emailAttempts.delete(email);
  }
  
  getAttemptCount(email: string): number {
    const now = Date.now();
    const attempts = this.emailAttempts.get(email) || [];
    return attempts.filter(timestamp => now - timestamp < this.windowMs).length;
  }
}

export const emailBasedRateLimit = new EmailBasedRateLimiter();

/**
 * Security validation that considers VPN context
 */
export function validateAuthAttempt(
  email: string, 
  ip?: string, 
  userAgent?: string
): {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  isVpnLikely: boolean;
} {
  // First check email-based rate limiting (more lenient)
  const emailAllowed = emailBasedRateLimit.isAllowed(email);
  
  // Then check IP-based rate limiting with VPN awareness
  const identifier = ip || email; // Fallback to email if no IP
  const ipCheck = vpnFriendlyAuthRateLimit.isAllowed(identifier, userAgent);
  
  // Detect VPN likelihood
  const isVpnLikely = userAgent ? 
    userAgent.toLowerCase().includes('corporate') || 
    userAgent.toLowerCase().includes('enterprise') : false;
  
  if (!emailAllowed) {
    return {
      allowed: false,
      reason: 'Too many failed attempts for this email address. Please wait 5 minutes.',
      retryAfter: 300,
      isVpnLikely
    };
  }
  
  if (!ipCheck.allowed) {
    return {
      allowed: false,
      reason: ipCheck.message,
      retryAfter: ipCheck.retryAfter,
      isVpnLikely
    };
  }
  
  return {
    allowed: true,
    isVpnLikely
  };
}

/**
 * Add known corporate VPN ranges for better detection
 */
export function addKnownVpnRanges(ranges: string[]): void {
  ranges.forEach(range => {
    vpnFriendlyAuthRateLimit.addVpnRange(range);
    vpnFriendlyApiRateLimit.addVpnRange(range);
  });
}

// Add some common corporate VPN indicators
addKnownVpnRanges([
  '10.0.0.0/8',    // Private network range often used by VPNs
  '172.16.0.0/12', // Private network range
  '192.168.0.0/16' // Private network range
]);