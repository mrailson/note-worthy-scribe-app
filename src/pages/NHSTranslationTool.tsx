import React from 'react';
import { Header } from '@/components/Header';
import { NHSTranslationInterface } from '@/components/NHSTranslationInterface';

const NHSTranslationTool = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <NHSTranslationInterface />
      </main>
    </div>
  );
};

export default NHSTranslationTool;