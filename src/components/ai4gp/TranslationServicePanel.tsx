import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Languages, Plus, History } from 'lucide-react';
import { LiveTranslationSetupModal } from '@/components/admin-dictate/LiveTranslationSetupModal';
import { ReceptionTranslationView } from '@/components/admin-dictate/ReceptionTranslationView';
import { TranslationHistoryPanel } from './TranslationHistoryPanel';

interface TranslationServicePanelProps {
  onClose: () => void;
}

export const TranslationServicePanel: React.FC<TranslationServicePanelProps> = ({ onClose }) => {
  const [showSetupModal, setShowSetupModal] = useState(true);
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
    onClose();
  };

  const handleNewSession = () => {
    setTranslationSession(null);
    setShowSetupModal(true);
  };

  const handleModalClose = () => {
    setShowSetupModal(false);
    if (!translationSession) {
      onClose();
    }
  };

  // If we have an active translation session, show the full view
  if (translationSession) {
    return (
      <ReceptionTranslationView
        sessionId={translationSession.id}
        sessionToken={translationSession.token}
        patientLanguage={translationSession.language}
        onClose={handleCloseTranslation}
        isTrainingMode={translationSession.isTrainingMode}
        trainingScenario={translationSession.trainingScenario}
        embedded={true}
      />
    );
  }

  // Show history panel
  if (showHistory) {
    return (
      <Card className="flex flex-col h-full border-0 shadow-none">
        <TranslationHistoryPanel onBack={() => setShowHistory(false)} />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full border-0 shadow-none">
      <CardHeader className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="w-5 h-5 text-violet-500" />
            <CardTitle className="text-lg">Translation Service</CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowHistory(true)}
              className="gap-2"
            >
              <History className="w-4 h-4" />
              History
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 flex items-center justify-center p-8">
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
    </Card>
  );
};
