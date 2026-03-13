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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Languages, QrCode, Loader2, Check, MessageSquareText, GraduationCap, ChevronsUpDown, Search, ChevronRight, ChevronLeft, History } from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { Switch } from '@/components/ui/switch';
import { TRAINING_SCENARIOS } from '@/constants/trainingScenarios';

const CATEGORIES = ['All', 'Routine Reception', 'Urgent Triage', 'Admin & Paperwork'];

interface LiveTranslationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (sessionId: string, sessionToken: string, patientLanguage: string, isTrainingMode?: boolean, trainingScenario?: string) => void;
  onShowHistory?: () => void;
}

export const LiveTranslationSetupModal: React.FC<LiveTranslationSetupModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('appointment_booking');
  const [langSearch, setLangSearch] = useState('');
  const [langOpen, setLangOpen] = useState(false);
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

  // Filter out 'none' and English, sort alphabetically
  const availableLanguages = useMemo(() => HEALTHCARE_LANGUAGES
    .filter(lang => lang.code !== 'none' && lang.code !== 'en')
    .sort((a, b) => a.name.localeCompare(b.name)), []);

  const filteredLanguages = useMemo(() => {
    if (!langSearch) return availableLanguages;
    const s = langSearch.toLowerCase();
    return availableLanguages.filter(lang =>
      lang.name.toLowerCase().includes(s) || lang.code.toLowerCase().includes(s)
    );
  }, [langSearch, availableLanguages]);

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

      // For training mode, save to DB with is_training flag then use fake token
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

      // Generate unique session token
      const sessionToken = crypto.randomUUID();

      // Create session in database with 1 hour expiry
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

  const selectedLang = availableLanguages.find(l => l.code === selectedLanguage);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`transition-all duration-300 max-h-[85vh] flex flex-col ${step === 2 ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
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
              <div className="space-y-6 py-4 px-8 sm:px-10">
                <div className="space-y-2">
                  <Label htmlFor="language">Patient's Language</Label>
                  
                  {/* Voice Quality Legend */}
                  <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-muted-foreground">Premium voice (natural, realistic)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-muted-foreground">Standard voice (clear, functional)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Text only (no audio playback)</span>
                    </div>
                  </div>
                  
                  <Popover open={langOpen} onOpenChange={setLangOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={langOpen}
                        className="w-full justify-between"
                      >
                        {selectedLang ? (
                          <span className="flex items-center gap-2">
                            <span>{selectedLang.flag}</span>
                            <span>{selectedLang.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Search or select language...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 z-[200] bg-popover" align="start">
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search language or code..."
                            value={langSearch}
                            onChange={(e) => setLangSearch(e.target.value)}
                            className="pl-8 h-9"
                            autoFocus
                          />
                        </div>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-1">
                          {filteredLanguages.map((lang) => (
                            <button
                              key={lang.code}
                              onClick={() => {
                                setSelectedLanguage(lang.code);
                                setLangOpen(false);
                                setLangSearch('');
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              <span>{lang.flag}</span>
                              <span className="flex-1">{lang.name}</span>
                              {lang.hasElevenLabsVoice && (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                              {lang.hasGoogleTTSVoice && !lang.hasElevenLabsVoice && (
                                <Check className="h-4 w-4 text-amber-500" />
                              )}
                              {selectedLanguage === lang.code && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </button>
                          ))}
                          {filteredLanguages.length === 0 && (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              No languages found
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
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

            <div className="flex justify-end gap-3 flex-shrink-0 border-t px-8 sm:px-10 py-4 bg-background">
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
                    {selectedLang.flag} {selectedLang.name}
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
