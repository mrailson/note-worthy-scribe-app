import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Languages, QrCode, Loader2, GraduationCap, ChevronRight, ChevronLeft, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { Switch } from '@/components/ui/switch';
import { TRAINING_SCENARIOS } from '@/constants/trainingScenarios';
import { LanguageSelectorV2 } from '@/components/translation/LanguageSelectorV2';
import { TRANSLATION_LANGUAGES } from '@/constants/translationLanguages';

const CATEGORIES = ['All', 'Routine Reception', 'Urgent Triage', 'Admin & Paperwork', 'Ageing Well'];

interface LiveTranslationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (sessionId: string, sessionToken: string, patientLanguage: string, isTrainingMode?: boolean, trainingScenario?: string) => void;
  onShowHistory?: () => void;
}

export const LiveTranslationSetupModal: React.FC<LiveTranslationSetupModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated,
  onShowHistory
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('appointment_booking');
  const [step, setStep] = useState<1 | 2>(1);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) setStep(1);
  }, [isOpen]);

  // Reset step when training mode toggled off
  useEffect(() => {
    if (!isTrainingMode) setStep(1);
  }, [isTrainingMode]);

  const selectedLang = TRANSLATION_LANGUAGES.find(l => l.id === selectedLanguage);

  const filteredScenarios = useMemo(() => {
    if (categoryFilter === 'All') return TRAINING_SCENARIOS;
    return TRAINING_SCENARIOS.filter(s => s.category === categoryFilter);
  }, [categoryFilter]);

  const handleStartSession = async () => {
    if (!selectedLanguage) {
      showToast.error('Please select a language');
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast.error('You must be logged in');
        return;
      }

      if (isTrainingMode) {
        const fakeToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        
        const { data: trainingData, error: trainingError } = await supabase
          .from('reception_translation_sessions')
          .insert({
            user_id: user.id,
            patient_language: selectedLanguage,
            session_token: fakeToken,
            expires_at: expiresAt,
            is_training: true,
            training_scenario: selectedScenario || null
          })
          .select()
          .single();

        if (trainingError) {
          console.error('Error saving training session:', trainingError);
        }

        const sessionId = trainingData?.id || `training-${crypto.randomUUID()}`;
        onSessionCreated(sessionId, fakeToken, selectedLanguage, true, selectedScenario);
        return;
      }

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('reception_translation_sessions')
        .insert({
          user_id: user.id,
          patient_language: selectedLanguage,
          session_token: sessionToken,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      onSessionCreated(data.id, sessionToken, selectedLanguage);
    } catch (err) {
      console.error('Error creating session:', err);
      showToast.error('Failed to create translation session');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="transition-all duration-300 max-h-[85vh] flex flex-col sm:max-w-2xl">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="animate-in fade-in-0 duration-200 flex flex-col min-h-0 flex-1">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                Start Live Translation
              </DialogTitle>
              <DialogDescription>
                Create a translation session for a patient. They'll scan a QR code to connect.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-6 py-4 px-1 sm:px-2">
                <div className="space-y-2">
                  <Label>Patient's Language</Label>
                  <LanguageSelectorV2
                    value={selectedLanguage}
                    onChange={setSelectedLanguage}
                  />
                </div>

                {selectedLang && (
                  <div className="rounded-lg bg-muted p-4 text-sm">
                    <p className="text-muted-foreground">
                      You'll speak English, the patient will see translations in{' '}
                      <strong>{selectedLang.name}</strong>. The patient can respond in their language
                      and you'll see it translated to English.
                    </p>
                  </div>
                )}

                {/* Training Mode Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">Training Mode</p>
                      <p className="text-xs text-muted-foreground">AI plays the patient role for practice</p>
                    </div>
                  </div>
                  <Switch checked={isTrainingMode} onCheckedChange={setIsTrainingMode} />
                </div>

                {!isTrainingMode && (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
                    <QrCode className="h-10 w-10 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      A QR code will be generated for the patient to scan with their phone.
                      No app or login required.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center flex-shrink-0 border-t px-4 sm:px-6 py-4 bg-background">
              {onShowHistory ? (
                <Button variant="ghost" size="sm" onClick={onShowHistory} className="text-xs text-muted-foreground gap-1 px-2">
                  <History className="h-3 w-3" />
                  View History
                </Button>
              ) : <div />}
              <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={isCreating}>
                Cancel
              </Button>
              {isTrainingMode ? (
                <Button onClick={() => setStep(2)} disabled={!selectedLanguage}>
                  Next: Choose Scenario
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleStartSession} disabled={!selectedLanguage || isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Start Session
                    </>
                  )}
                </Button>
              )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Scenario Picker */}
        {step === 2 && (
          <div className="animate-in fade-in-0 slide-in-from-right-4 duration-200 flex flex-col min-h-0 flex-1">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1 -ml-2">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-amber-500" />
                Choose a Training Scenario
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                <span>The AI patient will play this role during your practice session</span>
                {selectedLang && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted px-2 py-0.5 rounded-full">
                    {selectedLang.native} · {selectedLang.name}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-8 sm:px-10 py-4">
              {/* Category filter pills */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      categoryFilter === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Scenario grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
                {filteredScenarios.map(scenario => (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      selectedScenario === scenario.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: scenario.categoryColour,
                          background: `${scenario.categoryColour}10`,
                          border: `1px solid ${scenario.categoryColour}25`,
                        }}
                      >
                        {scenario.categoryIcon} {scenario.category}
                      </span>
                      <span className={`text-[0.6rem] font-semibold px-2 py-0.5 rounded-full ${
                        scenario.difficulty === 'Easy' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                        scenario.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      }`}>
                        {scenario.difficulty}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">{scenario.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{scenario.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between flex-shrink-0 border-t px-8 sm:px-10 py-4 bg-background">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleStartSession} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Start Training
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
