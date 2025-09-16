import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { TranslationToolInterface } from '@/components/TranslationToolInterface';
import { useIsMobile } from '@/hooks/use-mobile';

const TranslationTool = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Force redirect to mobile version on any mobile device
    const checkMobile = () => {
      const isMobileScreen = window.innerWidth < 768;
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobileScreen || isMobileUserAgent) {
        navigate('/mobile-translate', { replace: true });
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, [navigate]);

  // Don't render anything while checking mobile status to avoid flash
  if (isMobile || window.innerWidth < 768) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <TranslationToolInterface />
      </main>
    </div>
  );
};

export default TranslationTool;