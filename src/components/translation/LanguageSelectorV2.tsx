import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TRANSLATION_LANGUAGES,
  QUICK_PICK_IDS,
  REGION_COLOURS,
  REGION_ORDER,
  type TranslationLanguage,
} from '@/constants/translationLanguages';

interface LanguageSelectorV2Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const LanguageCard: React.FC<{
  lang: TranslationLanguage;
  selected: boolean;
  onClick: () => void;
  size?: 'normal' | 'small';
}> = ({ lang, selected, onClick, size = 'normal' }) => {
  const regionStyle = REGION_COLOURS[lang.region];
  const isSmall = size === 'small';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Select ${lang.name}`}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-200 cursor-pointer text-center group',
        'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSmall ? 'p-3 min-h-[80px]' : 'p-4 min-h-[100px]',
        selected ? 'shadow-md' : 'border-border bg-card hover:bg-accent/30'
      )}
      style={selected ? {
        borderColor: regionStyle?.accent,
        backgroundColor: regionStyle?.bg,
      } : undefined}
    >
      {selected && (
        <div
          className="absolute top-1.5 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
          style={{ backgroundColor: regionStyle?.accent }}
        >
          <Check className="h-3 w-3" />
        </div>
      )}
      <span
        className={cn(
          'font-bold leading-tight',
          isSmall ? 'text-lg' : 'text-xl'
        )}
        style={{
          direction: lang.rtl ? 'rtl' : 'ltr',
          fontFamily: "'Noto Sans', sans-serif",
          color: selected ? regionStyle?.accent : undefined,
        }}
      >
        {lang.native}
      </span>
      <span
        className={cn(
          'leading-tight mt-0.5',
          isSmall ? 'text-sm' : 'text-base'
        )}
        style={{
          direction: lang.rtl ? 'rtl' : 'ltr',
          color: selected ? regionStyle?.accent : undefined,
          opacity: 0.6,
        }}
      >
        {lang.hello}
      </span>
      <span className="text-[11px] text-muted-foreground mt-1 tracking-wide">
        {lang.name}
      </span>
    </button>
  );
};

const RegionPill: React.FC<{
  region: string;
  active: boolean;
  onClick: () => void;
}> = ({ region, active, onClick }) => {
  const style = REGION_COLOURS[region];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
        active
          ? 'text-white'
          : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
      )}
      style={active ? { backgroundColor: style?.accent } : undefined}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: active ? '#fff' : style?.dot }}
      />
      {region}
    </button>
  );
};

export const LanguageSelectorV2: React.FC<LanguageSelectorV2Props> = ({
  value,
  onChange,
  disabled,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  const quickPickLangs = useMemo(
    () => QUICK_PICK_IDS.map(id => TRANSLATION_LANGUAGES.find(l => l.id === id)).filter(Boolean) as TranslationLanguage[],
    []
  );

  const otherLangs = useMemo(
    () => TRANSLATION_LANGUAGES.filter(l => !QUICK_PICK_IDS.includes(l.id)),
    []
  );

  const selectedLang = TRANSLATION_LANGUAGES.find(l => l.id === value);

  const isSearching = search.length > 0;

  // When searching, search ALL 53 languages in a flat list
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = search.toLowerCase();
    return TRANSLATION_LANGUAGES.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.hello.toLowerCase().includes(q)
    );
  }, [search, isSearching]);

  // For the expanded view without search, group remaining languages by region
  const groupedOther = useMemo(() => {
    if (isSearching) return [];
    const filtered = activeRegion
      ? otherLangs.filter(l => l.region === activeRegion)
      : otherLangs;
    return REGION_ORDER.reduce<{ region: string; langs: TranslationLanguage[] }[]>((acc, region) => {
      const langs = filtered.filter(l => l.region === region);
      if (langs.length > 0) acc.push({ region, langs });
      return acc;
    }, []);
  }, [otherLangs, activeRegion, isSearching]);

  const handleSelect = (id: string) => {
    if (!disabled) {
      onChange(id);
    }
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="space-y-3">
      {/* Noto Sans font for non-Latin scripts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Selection confirmation strip */}
      {selectedLang && (
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium"
          style={{
            backgroundColor: REGION_COLOURS[selectedLang.region]?.bg,
            color: REGION_COLOURS[selectedLang.region]?.accent,
            border: `1.5px solid ${REGION_COLOURS[selectedLang.region]?.accent}40`,
          }}
        >
          <span style={{ direction: selectedLang.rtl ? 'rtl' : 'ltr', fontFamily: "'Noto Sans', sans-serif" }}>
            {selectedLang.native} · {selectedLang.name} selected
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 rounded-full p-0.5 hover:bg-black/10 transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tier 1: Quick Pick Grid */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Most requested
        </p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
        >
          {quickPickLangs.map(lang => (
            <LanguageCard
              key={lang.id}
              lang={lang}
              selected={value === lang.id}
              onClick={() => handleSelect(lang.id)}
            />
          ))}
        </div>
      </div>

      {/* Divider with expand button */}
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" />
        <button
          type="button"
          onClick={() => {
            setShowAll(!showAll);
            if (!showAll) {
              setSearch('');
              setActiveRegion(null);
            }
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          {showAll ? (
            <>Hide other languages <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>My language isn't here — show all 53 <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </button>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Tier 2: All languages expanded */}
      {showAll && (
        <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search all 53 languages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Region filter pills (hidden when searching) */}
          {!isSearching && (
            <div className="flex flex-wrap gap-1.5">
              {REGION_ORDER.map(region => (
                <RegionPill
                  key={region}
                  region={region}
                  active={activeRegion === region}
                  onClick={() => setActiveRegion(activeRegion === region ? null : region)}
                />
              ))}
            </div>
          )}

          {/* Language grid */}
          <ScrollArea className="max-h-[350px]">
            {isSearching ? (
              // Flat search results — all 53 languages
              <div>
                {searchResults.length > 0 ? (
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
                  >
                    {searchResults.map(lang => (
                      <LanguageCard
                        key={lang.id}
                        lang={lang}
                        selected={value === lang.id}
                        onClick={() => handleSelect(lang.id)}
                        size="small"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No languages found matching "{search}"
                  </div>
                )}
              </div>
            ) : (
              // Grouped by region
              <div className="space-y-4">
                {groupedOther.map(({ region, langs }) => (
                  <div key={region}>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: REGION_COLOURS[region]?.dot }}
                      />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {region}
                      </span>
                    </div>
                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
                    >
                      {langs.map(lang => (
                        <LanguageCard
                          key={lang.id}
                          lang={lang}
                          selected={value === lang.id}
                          onClick={() => handleSelect(lang.id)}
                          size="small"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
