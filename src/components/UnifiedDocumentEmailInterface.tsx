import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Mail, FileText, RotateCcw, AlertTriangle } from 'lucide-react';
import { DocumentEmailTabs } from './document-email/DocumentEmailTabs';
import { TextEmailTab } from './document-email/TextEmailTab';
import { DocumentsImagesTab } from './document-email/DocumentsImagesTab';
import { VoiceConversationTab } from './document-email/VoiceConversationTab'; 
import { DocumentEmailHistoryTab } from './document-email/DocumentEmailHistoryTab';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

export const UnifiedDocumentEmailInterface = () => {
  const [activeSubTab, setActiveSubTab] = useState('text-email');
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();

  // Reset confirmation timeout
  useEffect(() => {
    if (resetConfirmation) {
      resetTimeoutRef.current = setTimeout(() => {
        setResetConfirmation(false);
      }, 3000); // Reset confirmation after 3 seconds
    }

    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, [resetConfirmation]);

  const handleReset = () => {
    if (!resetConfirmation) {
      // First press - show confirmation
      setResetConfirmation(true);
      toast.info('Press Reset again to confirm clearing all translation data');
    } else {
      // Second press - execute reset
      setResetTrigger(prev => prev + 1);
      setResetConfirmation(false);
      setActiveSubTab('text-email'); // Reset to first tab
      toast.success('Translation service cleared - ready for new translation');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <FileText className="w-5 h-5" />
                <Mail className="w-4 h-4" />
              </div>
              Document & Email Translation Service
            </CardTitle>
            
            <Button
              variant={resetConfirmation ? "destructive" : "outline"}
              size="sm"
              onClick={handleReset}
              className={`flex items-center gap-2 transition-all ${
                resetConfirmation 
                  ? 'animate-pulse bg-destructive hover:bg-destructive/90' 
                  : 'hover:bg-muted'
              }`}
            >
              {resetConfirmation ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Confirm Reset
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Reset All
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <DocumentEmailTabs 
              activeSubTab={activeSubTab}
              onSubTabChange={setActiveSubTab}
              isMobile={isMobile}
            />

            <TabsContent value="text-email" className="space-y-4 mt-6">
              <TextEmailTab resetTrigger={resetTrigger} />
            </TabsContent>

            <TabsContent value="documents-images" className="space-y-4 mt-6">
              <DocumentsImagesTab resetTrigger={resetTrigger} />
            </TabsContent>

            <TabsContent value="voice-conversation" className="space-y-4 mt-6">
              <VoiceConversationTab resetTrigger={resetTrigger} />
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-6">
              <DocumentEmailHistoryTab resetTrigger={resetTrigger} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};