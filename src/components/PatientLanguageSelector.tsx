import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Globe } from 'lucide-react';

interface PatientLanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  className?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'english', name: 'English', flag: '🇬🇧' },
  { code: 'spanish', name: 'Spanish', flag: '🇪🇸' },
  { code: 'french', name: 'French', flag: '🇫🇷' },
  { code: 'german', name: 'German', flag: '🇩🇪' },
  { code: 'italian', name: 'Italian', flag: '🇮🇹' },
  { code: 'portuguese', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'polish', name: 'Polish', flag: '🇵🇱' },
  { code: 'arabic', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hindi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'chinese', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'russian', name: 'Russian', flag: '🇷🇺' },
  { code: 'ukrainian', name: 'Ukrainian', flag: '🇺🇦' },
  { code: 'turkish', name: 'Turkish', flag: '🇹🇷' },
  { code: 'dutch', name: 'Dutch', flag: '🇳🇱' },
  { code: 'swedish', name: 'Swedish', flag: '🇸🇪' },
  { code: 'norwegian', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'danish', name: 'Danish', flag: '🇩🇰' },
  { code: 'finnish', name: 'Finnish', flag: '🇫🇮' }
];

export const PatientLanguageSelector = ({
  selectedLanguage,
  onLanguageChange,
  className = ""
}: PatientLanguageSelectorProps) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium flex items-center gap-2">
        <Globe className="w-4 h-4" />
        Patient's Primary Language
      </Label>
      <Select value={selectedLanguage} onValueChange={onLanguageChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select patient's language for bilingual summary" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              <div className="flex items-center gap-2">
                <span>{language.flag}</span>
                <span>{language.name}</span>
                {language.code === 'english' && (
                  <span className="text-xs text-muted-foreground">(Default)</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedLanguage && selectedLanguage !== 'english' && (
        <p className="text-xs text-muted-foreground">
          Patient Copy will be generated in {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name} (Page 1) and English (Page 2)
        </p>
      )}
    </div>
  );
};