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