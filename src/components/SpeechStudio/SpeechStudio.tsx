import React, { useState } from 'react';
import { SpeechStudioMain } from './SpeechStudioMain';
import { SpeechHistory } from './SpeechHistory';
import { SpeechTemplates } from './SpeechTemplates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Volume2, History, FileText } from 'lucide-react';

export const SpeechStudio = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [inputText, setInputText] = useState('');

  const handleTemplateSelect = (content: string) => {
    setInputText(content);
    setActiveTab('generate');
  };

  const handleGenerated = () => {
    // Optionally switch to history tab after generation
    // setActiveTab('history');
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-6">
          <SpeechStudioMain onGenerated={handleGenerated} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SpeechHistory />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <SpeechTemplates onTemplateSelect={handleTemplateSelect} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
