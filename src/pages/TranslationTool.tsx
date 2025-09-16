import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { TranslationToolInterface } from '@/components/TranslationToolInterface';
import { useIsMobile } from '@/hooks/use-mobile';

const TranslationTool = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      navigate('/mobile-translate', { replace: true });
    }
  }, [isMobile, navigate]);

  // Don't render anything while checking mobile status to avoid flash
  if (isMobile) {
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