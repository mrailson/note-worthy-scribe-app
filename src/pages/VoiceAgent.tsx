import React from 'react';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/contexts/AuthContext';
import { SimpleLoginForm } from '@/components/SimpleLoginForm';
import { Header } from '@/components/Header';
import { GeminiLiveVoiceAgent } from '@/components/gemini/GeminiLiveVoiceAgent';

const VoiceAgent = () => {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <SimpleLoginForm />;
  }

  return (
    <>
      <SEO title="Voice Agent | Notewell AI" description="Gemini Live voice agent for real-time AI conversation" />
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6 max-w-3xl">
          <GeminiLiveVoiceAgent />
        </main>
      </div>
    </>
  );
};

export default VoiceAgent;
