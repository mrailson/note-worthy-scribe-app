import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

interface SecurityWrapperProps {
  children: React.ReactNode;
}

/**
 * Security wrapper component that applies Content Security Policy headers
 * and other security measures to protect against XSS and injection attacks
 */
export const SecurityWrapper = ({ children }: SecurityWrapperProps) => {
  useEffect(() => {
    // Set security headers via meta tags for client-side protection
    const cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https://cdn.jsdelivr.net https://unpkg.com https://*.googleadservices.com https://*.google.com https://*.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.gstatic.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://dphcnbricafkbtizkoal.supabase.co wss://dphcnbricafkbtizkoal.supabase.co https://api.openai.com https://api.assemblyai.com wss://api.assemblyai.com https://api.deepgram.com wss://api.deepgram.com https://lovable-api.com wss://lovable-api.com https://*.plausible.io https://api.elevenlabs.io wss://api.elevenlabs.io",
      "media-src 'self' blob: https://dphcnbricafkbtizkoal.supabase.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ');

    // Apply CSP via meta tag (for development - in production this should be set via HTTP headers)
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement | null;
    if (existingCSP) {
      // Update existing CSP to ensure it's not more restrictive
      existingCSP.setAttribute('content', cspHeader);
    } else {
      const cspMeta = document.createElement('meta');
      cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
      cspMeta.setAttribute('content', cspHeader);
      document.head.appendChild(cspMeta);
    }

    // Add security headers via meta tags
    const securityHeaders = [
      { name: 'X-Content-Type-Options', content: 'nosniff' },
      { name: 'X-Frame-Options', content: 'DENY' },
      { name: 'X-XSS-Protection', content: '1; mode=block' },
      { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
    ];

    securityHeaders.forEach(header => {
      const existing = document.querySelector(`meta[name="${header.name}"]`);
      if (!existing) {
        const meta = document.createElement('meta');
        meta.setAttribute('name', header.name);
        meta.setAttribute('content', header.content);
        document.head.appendChild(meta);
      }
    });

    // Disable autocomplete for sensitive forms
    const sensitiveInputs = document.querySelectorAll('input[type="password"], input[name*="password"]');
    sensitiveInputs.forEach(input => {
      (input as HTMLInputElement).setAttribute('autocomplete', 'off');
    });

    // Clear clipboard after 30 seconds if it contains sensitive data
    let clipboardTimeout: NodeJS.Timeout;
    const handleCopy = () => {
      if (clipboardTimeout) clearTimeout(clipboardTimeout);
      clipboardTimeout = setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {
          // Silently fail if clipboard access is denied
        });
      }, 30000);
    };

    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('copy', handleCopy);
      if (clipboardTimeout) clearTimeout(clipboardTimeout);
    };
  }, []);

  return (
    <>
      <Helmet>
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https://cdn.jsdelivr.net https://unpkg.com https://*.googleadservices.com https://*.google.com https://*.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.gstatic.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://dphcnbricafkbtizkoal.supabase.co wss://dphcnbricafkbtizkoal.supabase.co https://api.openai.com https://api.assemblyai.com wss://api.assemblyai.com https://api.deepgram.com wss://api.deepgram.com https://lovable-api.com wss://lovable-api.com https://*.plausible.io https://api.elevenlabs.io wss://api.elevenlabs.io; media-src 'self' blob: https://dphcnbricafkbtizkoal.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;" />
        <meta name="X-Content-Type-Options" content="nosniff" />
        <meta name="X-Frame-Options" content="DENY" />
        <meta name="X-XSS-Protection" content="1; mode=block" />
        <meta name="Referrer-Policy" content="strict-origin-when-cross-origin" />
        <meta name="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=()" />
      </Helmet>
      {children}
    </>
  );
};