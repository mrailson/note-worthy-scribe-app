import { useState, useCallback } from 'react';
import { validateInputSecurity, validateFileUpload, validateEmailSecurity, apiRateLimiter } from '@/utils/securityValidation';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for security validation and monitoring
 */
export function useSecurityValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  const validateInput = useCallback((input: string, context: string = 'general') => {
    const result = validateInputSecurity(input);
    
    if (!result.isValid) {
      console.warn(`Security validation failed for ${context}:`, result.threats);
      
      // Log security event to backend
      // This would typically call an API endpoint to log the security event
      
      toast({
        title: "Security Warning",
        description: "Input contains potentially harmful content and has been blocked.",
        variant: "destructive"
      });
      
      return false;
    }
    
    return true;
  }, [toast]);

  const validateFile = useCallback((file: File) => {
    const result = validateFileUpload(file);
    
    if (!result.isValid) {
      toast({
        title: "File Upload Error",
        description: result.errors.join(', '),
        variant: "destructive"
      });
      
      return { isValid: false, sanitizedName: result.sanitizedName };
    }
    
    return { isValid: true, sanitizedName: result.sanitizedName };
  }, [toast]);

  const validateEmail = useCallback((email: string) => {
    const result = validateEmailSecurity(email);
    
    if (!result.isValid) {
      toast({
        title: "Email Validation Error",
        description: result.errors.join(', '),
        variant: "destructive"
      });
      
      return false;
    }
    
    return true;
  }, [toast]);

  const checkRateLimit = useCallback((identifier: string, userAgent?: string) => {
    // Use enhanced VPN-friendly rate limiting
    import('@/utils/enhancedSecurityValidation').then(({ vpnFriendlyApiRateLimit }) => {
      const result = vpnFriendlyApiRateLimit.isAllowed(identifier, userAgent);
      
      if (!result.allowed) {
        toast({
          title: "Rate Limit Exceeded",
          description: result.message || "Too many requests. Please wait before trying again.",
          variant: "destructive"
        });
        return false;
      }
      return true;
    }).catch(() => {
      // Fallback to original rate limiter
      const allowed = apiRateLimiter.isAllowed(identifier);
      
      if (!allowed) {
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many requests. Please wait before trying again.",
          variant: "destructive"
        });
      }
      
      return allowed;
    });
    
    // Return true by default, actual check happens asynchronously
    return true;
  }, [toast]);

  const sanitizeInput = useCallback((input: string) => {
    const result = validateInputSecurity(input);
    return result.sanitized;
  }, []);

  return {
    isValidating,
    validateInput,
    validateFile,
    validateEmail,
    checkRateLimit,
    sanitizeInput
  };
}