import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Languages, Plus, History } from 'lucide-react';
import { LiveTranslationSetupModal } from '@/components/admin-dictate/LiveTranslationSetupModal';
import { ReceptionTranslationView } from '@/components/admin-dictate/ReceptionTranslationView';
import { TranslationHistoryPanel } from '@/components/ai4gp/TranslationHistoryPanel';

interface DictationTranslationWrapperProps {
  onBack?: () => void;
}

export function DictationTranslationWrapper({ onBack }: DictationTranslationWrapperProps) {
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [translationSession, setTranslationSession] = useState<{
    id: string;
    token: string;
    language: string;
    isTrainingMode?: boolean;
    trainingScenario?: string;
  } | null>(null);

  const handleSessionCreated = (sessionId: string, sessionToken: string, patientLanguage: string, isTrainingMode?: boolean, trainingScenario?: string) => {
    setShowSetupModal(false);
    setTranslationSession({
      id: sessionId,
      token: sessionToken,
      language: patientLanguage,
      isTrainingMode,
      trainingScenario
    });
  };

  const handleCloseTranslation = () => {
    setTranslationSession(null);
  };

  const handleModalClose = () => {
    setShowSetupModal(false);
  };

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
            isTrainingMode={translationSession.isTrainingMode}
            trainingScenario={translationSession.trainingScenario}
          />
        </div>
      </div>
    );
  }

  // Show history panel
  if (showHistory) {
    return (
      <div className="min-h-[400px]">
        <TranslationHistoryPanel onBack={() => setShowHistory(false)} />
      </div>
    );
  }

  // Default state - show start session UI
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
