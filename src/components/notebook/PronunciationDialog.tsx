import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Volume2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { PronunciationRule } from '@/utils/pronunciationLibrary';

interface PronunciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (rule: Omit<PronunciationRule, 'id' | 'createdAt'>) => void;
  selectedVoiceId: string;
}

export const PronunciationDialog = ({ 
  open, 
  onOpenChange, 
  onAdd,
  selectedVoiceId 
}: PronunciationDialogProps) => {
  const [original, setOriginal] = useState('');
  const [pronounceAs, setPronounceAs] = useState('');
  const [category, setCategory] = useState<PronunciationRule['category']>('other');
  const [caseInsensitive, setCaseInsensitive] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testAudio, setTestAudio] = useState<HTMLAudioElement | null>(null);

  const handleTestPronunciation = async () => {
    if (!pronounceAs.trim()) {
      toast.error('Enter a pronunciation to test');
      return;
    }

    // Stop any playing test audio
    if (testAudio) {
      testAudio.pause();
      testAudio.currentTime = 0;
    }

    setIsTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-document-audio-overview', {
        body: {
          text: pronounceAs,
          voiceId: selectedVoiceId,
          voiceProvider: 'elevenlabs',
          mode: 'audio-only',
          previewLength: 10 // Short test
        }
      });

      if (error) throw error;

      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        setTestAudio(audio);
        await audio.play();
        toast.success('Playing pronunciation test');
      } else {
        throw new Error('No audio returned');
      }
    } catch (error: any) {
      console.error('Test pronunciation error:', error);
      toast.error(error.message || 'Failed to test pronunciation');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!original.trim() || !pronounceAs.trim()) {
      toast.error('Both fields are required');
      return;
    }

    onAdd({
      original: original.trim(),
      pronounceAs: pronounceAs.trim(),
      category,
      caseInsensitive,
    });

    // Reset form
    setOriginal('');
    setPronounceAs('');
    setCategory('other');
    setCaseInsensitive(true);
    onOpenChange(false);
    toast.success('Pronunciation rule added');
  };

  const handleClose = () => {
    if (testAudio) {
      testAudio.pause();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Pronunciation Rule</DialogTitle>
          <DialogDescription>
            Define how a word or phrase should be pronounced in audio generation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="original">Original word/phrase</Label>
            <Input
              id="original"
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              placeholder="e.g. Toasta"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pronounceAs">Pronounce as (phonetically)</Label>
            <Input
              id="pronounceAs"
              value={pronounceAs}
              onChange={(e) => setPronounceAs(e.target.value)}
              placeholder="e.g. Toast-ah"
            />
            <p className="text-xs text-muted-foreground">
              Use hyphens to break syllables (e.g. "Toast-ah")
            </p>
          </div>

          <Button
            onClick={handleTestPronunciation}
            variant="outline"
            className="w-full"
            disabled={isTesting || !pronounceAs.trim()}
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Test...
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 mr-2" />
                Test Pronunciation
              </>
            )}
          </Button>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(val) => setCategory(val as PronunciationRule['category'])}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="place">Place</SelectItem>
                <SelectItem value="organisation">Organisation</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="acronym">Acronym</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="caseInsensitive"
              checked={caseInsensitive}
              onCheckedChange={(checked) => setCaseInsensitive(checked as boolean)}
            />
            <Label 
              htmlFor="caseInsensitive" 
              className="text-sm font-normal cursor-pointer"
            >
              Case insensitive (match "toasta", "TOASTA", etc.)
            </Label>
          </div>

          {original && pronounceAs && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Preview:</p>
              <p className="text-muted-foreground">
                "{original}" will become "{pronounceAs}"
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
