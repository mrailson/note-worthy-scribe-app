import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Search, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEVENLABS_LANGUAGES, getSortedLanguages } from '@/constants/elevenLabsLanguages';

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  disabled
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const sortedLanguages = useMemo(() => getSortedLanguages(), []);
  
  const filteredLanguages = useMemo(() => {
    if (!search) return sortedLanguages.filter(l => l.code !== 'en'); // Exclude English
    const searchLower = search.toLowerCase();
    return sortedLanguages.filter(l => 
      l.code !== 'en' && (
        l.name.toLowerCase().includes(searchLower) ||
        l.nativeName?.toLowerCase().includes(searchLower) ||
        l.code.toLowerCase().includes(searchLower)
      )
    );
  }, [search, sortedLanguages]);

  const selectedLanguage = ELEVENLABS_LANGUAGES.find(l => l.code === value);

  // Group languages by priority for better UX
  const priorityGroups = useMemo(() => {
    const groups: { label: string; languages: typeof filteredLanguages }[] = [
      { label: 'Common in UK Healthcare', languages: filteredLanguages.filter(l => l.priority <= 3) },
      { label: 'European Languages', languages: filteredLanguages.filter(l => l.priority === 4 || l.priority === 5 || l.priority === 6 || l.priority === 7) },
      { label: 'Asian & African Languages', languages: filteredLanguages.filter(l => l.priority > 7) },
    ];
    return groups.filter(g => g.languages.length > 0);
  }, [filteredLanguages]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto py-3"
          disabled={disabled}
        >
          {selectedLanguage ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedLanguage.flag}</span>
              <div className="text-left">
                <div className="font-medium">{selectedLanguage.name}</div>
                {selectedLanguage.nativeName && (
                  <div className="text-xs text-muted-foreground">{selectedLanguage.nativeName}</div>
                )}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Select patient's language...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search languages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {priorityGroups.map((group, groupIndex) => (
              <div key={group.label}>
                {groupIndex > 0 && <div className="my-2 border-t" />}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </div>
                {group.languages.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => {
                      onChange(language.code);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      value === language.code && "bg-accent"
                    )}
                  >
                    <span className="text-xl">{language.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{language.name}</div>
                      {language.nativeName && (
                        <div className="text-xs text-muted-foreground truncate">
                          {language.nativeName}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Volume2 className="h-3 w-3 mr-1" />
                        Voice
                      </Badge>
                      {value === language.code && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
            {filteredLanguages.length === 0 && (
              <div className="py-6 text-center text-muted-foreground">
                No languages found matching "{search}"
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
