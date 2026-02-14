import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Languages, QrCode, Loader2, Check, MessageSquareText, GraduationCap, ChevronsUpDown, Search } from 'lucide-react';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';
import { Switch } from '@/components/ui/switch';

const TRAINING_SCENARIOS = [
  { value: 'new_patient_registration', label: 'New patient registration' },
  { value: 'prescription_collection', label: 'Prescription collection' },
  { value: 'appointment_booking', label: 'Appointment booking' },
  { value: 'general_enquiry', label: 'General enquiry' },
];

interface LiveTranslationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (sessionId: string, sessionToken: string, patientLanguage: string, isTrainingMode?: boolean, trainingScenario?: string) => void;
}

export const LiveTranslationSetupModal: React.FC<LiveTranslationSetupModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [trainingScenario, setTrainingScenario] = useState<string>('appointment_booking');
  const [langSearch, setLangSearch] = useState('');
  const [langOpen, setLangOpen] = useState(false);

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

      // For training mode, create a fake session (no DB record needed)
      if (isTrainingMode) {
        const fakeSessionId = `training-${crypto.randomUUID()}`;
        const fakeToken = crypto.randomUUID();
        onSessionCreated(fakeSessionId, fakeToken, selectedLanguage, true, trainingScenario);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            Start Live Translation
          </DialogTitle>
          <DialogDescription>
            Create a translation session for a patient. They'll scan a QR code to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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

          {isTrainingMode && (
            <div className="space-y-2">
              <Label>Training Scenario</Label>
              <Select value={trainingScenario} onValueChange={setTrainingScenario}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select scenario..." />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_SCENARIOS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleStartSession} disabled={!selectedLanguage || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : isTrainingMode ? (
              <>
                <GraduationCap className="mr-2 h-4 w-4" />
                Start Training
              </>
            ) : (
              <>
                <QrCode className="mr-2 h-4 w-4" />
                Start Session
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
