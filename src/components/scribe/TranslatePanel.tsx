import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Languages, Plus, History } from 'lucide-react';
import { LiveTranslationSetupModal } from '@/components/admin-dictate/LiveTranslationSetupModal';
import { ReceptionTranslationView } from '@/components/admin-dictate/ReceptionTranslationView';
import { TranslationHistoryPanel } from '@/components/ai4gp/TranslationHistoryPanel';

interface TranslatePanelProps {
  autoOpenSetup?: boolean;
}

export function TranslatePanel({ autoOpenSetup = true }: TranslatePanelProps) {
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [translationSession, setTranslationSession] = useState<{
    id: string;
    token: string;
    language: string;
  } | null>(null);

  // Auto-open setup modal on first mount if no active session
  useEffect(() => {
    if (autoOpenSetup && !hasAutoOpened && !translationSession) {
      setShowSetupModal(true);
      setHasAutoOpened(true);
    }
  }, [autoOpenSetup, hasAutoOpened, translationSession]);

  const handleSessionCreated = (sessionId: string, sessionToken: string, patientLanguage: string) => {
    setShowSetupModal(false);
    setTranslationSession({
      id: sessionId,
      token: sessionToken,
      language: patientLanguage
    });
  };

  const handleCloseTranslation = () => {
    setTranslationSession(null);
    setHasAutoOpened(false); // Reset so next visit will auto-open again
  };

  const handleModalClose = () => {
    setShowSetupModal(false);
  };

  // Show history panel
  if (showHistory) {
    return (
      <TranslationHistoryPanel onBack={() => setShowHistory(false)} />
    );
  }

  // If we have an active translation session, show the full view
  if (translationSession) {
    return (
      <div className="min-h-[600px] -mx-6 -mb-4 overflow-x-auto">
        <div className="min-w-[900px]">
          <ReceptionTranslationView
            sessionId={translationSession.id}
            sessionToken={translationSession.token}
            patientLanguage={translationSession.language}
            onClose={handleCloseTranslation}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[400px] flex flex-col">
      <div className="flex items-center justify-end gap-2 mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowHistory(true)}
          className="gap-2"
        >
          <History className="w-4 h-4" />
          History
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Languages className="w-16 h-16 text-violet-500/30 mx-auto" />
          <div>
            <h3 className="text-lg font-medium">Start a Translation Session</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new session to communicate with patients in their language
            </p>
          </div>
          <Button onClick={() => setShowSetupModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Translation Session
          </Button>
        </div>
      </div>

      <LiveTranslationSetupModal
        isOpen={showSetupModal}
        onClose={handleModalClose}
        onSessionCreated={handleSessionCreated}
      />
    </div>
  );
}
