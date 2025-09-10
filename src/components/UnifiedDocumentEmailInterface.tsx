import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Mail, FileText } from 'lucide-react';
import { DocumentEmailTabs } from './document-email/DocumentEmailTabs';
import { TextEmailTab } from './document-email/TextEmailTab';
import { DocumentsImagesTab } from './document-email/DocumentsImagesTab';
import { VoiceConversationTab } from './document-email/VoiceConversationTab'; 
import { DocumentEmailHistoryTab } from './document-email/DocumentEmailHistoryTab';
import { useIsMobile } from '@/hooks/use-mobile';

export const UnifiedDocumentEmailInterface = () => {
  const [activeSubTab, setActiveSubTab] = useState('text-email');
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <FileText className="w-5 h-5" />
              <Mail className="w-4 h-4" />
            </div>
            Document & Email Translation Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <DocumentEmailTabs 
              activeSubTab={activeSubTab}
              onSubTabChange={setActiveSubTab}
              isMobile={isMobile}
            />

            <TabsContent value="text-email" className="space-y-4 mt-6">
              <TextEmailTab />
            </TabsContent>

            <TabsContent value="documents-images" className="space-y-4 mt-6">
              <DocumentsImagesTab />
            </TabsContent>

            <TabsContent value="voice-conversation" className="space-y-4 mt-6">
              <VoiceConversationTab />
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-6">
              <DocumentEmailHistoryTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};