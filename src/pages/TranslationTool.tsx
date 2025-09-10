import React from 'react';
import { Header } from '@/components/Header';
import { UnifiedDocumentEmailInterface } from '@/components/UnifiedDocumentEmailInterface';

const TranslationTool = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <UnifiedDocumentEmailInterface />
      </main>
    </div>
  );
};

export default TranslationTool;