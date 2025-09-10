import React from 'react';
import { Header } from '@/components/Header';
import { TranslationToolInterface } from '@/components/TranslationToolInterface';

const TranslationTool = () => {
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