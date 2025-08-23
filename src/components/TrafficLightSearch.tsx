import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import Fuse from 'fuse.js';
import { PolicyBadge, type PolicyStatus } from './PolicyBadge';
import { EvidenceDrawer } from './EvidenceDrawer';
import { useTrafficLightVocab, type TLVocabItem } from '@/hooks/useTrafficLightVocab';
import { useTrafficLightResolver } from '@/hooks/useTrafficLightResolver';

interface TrafficLightSearchProps {
  onInsertIntoChat?: (message: string) => void;
  className?: string;
}

const TrafficLightSearch: React.FC<TrafficLightSearchProps> = ({ 
  onInsertIntoChat,
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedItem, setSelectedItem] = useState<(TLVocabItem & { policyDetails?: any }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  
  const { vocab, isLoading, error, isOffline } = useTrafficLightVocab();
  const { lookupMedicine } = useTrafficLightResolver();

  // Configure fuzzy search
  const fuse = useMemo(() => {
    const options = {
      keys: [
        { name: 'name', weight: 0.8 },
        { name: 'bnf_chapter', weight: 0.2 }
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      findAllMatches: true,
      minMatchCharLength: 1
    };
    return new Fuse(vocab, options);
  }, [vocab]);

  // Perform search with prefix boost
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    
    const fuseResults = fuse.search(query.trim());
    
    // Boost exact prefix matches
    const results = fuseResults.map(result => ({
      ...result.item,
      score: result.score || 0,
      isPrefix: result.item.name.toLowerCase().startsWith(query.toLowerCase())
    }));

    // Sort: exact prefix matches first, then by score
    results.sort((a, b) => {
      if (a.isPrefix && !b.isPrefix) return -1;
      if (!a.isPrefix && b.isPrefix) return 1;
      return a.score - b.score;
    });

    return results.slice(0, 10);
  }, [query, fuse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || searchResults.length === 0) {
      if (e.key === 'ArrowDown' && query.trim()) {
        setIsOpen(true);
        setSelectedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          const item = searchResults[selectedIndex];
          if (e.ctrlKey || e.metaKey) {
            handleInsertIntoChat(item);
          } else {
            handleSelectItem(item);
          }
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectItem = async (item: TLVocabItem) => {
    try {
      const policyHit = await lookupMedicine(item.name);
      if (policyHit) {
        setSelectedItem({
          ...item,
          policyDetails: policyHit
        });
      }
      setIsOpen(false);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Failed to lookup medicine details:', err);
    }
  };

  const handleInsertIntoChat = (item: TLVocabItem) => {
    if (onInsertIntoChat) {
      const message = `Local policy check: **${item.name}** — **${getStatusLabel(item.status_enum)}** (updated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}).`;
      onInsertIntoChat(message);
    }
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'DOUBLE_RED': return 'DOUBLE RED';
      case 'RED': return 'RED';
      case 'SPECIALIST_INITIATED': return 'Specialist-Initiated';
      case 'SPECIALIST_RECOMMENDED': return 'Specialist-Recommended';
      case 'GREY':
      case 'UNKNOWN':
      default: return 'Unknown';
    }
  };

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 dark:bg-yellow-800 font-medium">
          {part}
        </span>
      ) : part
    );
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <>
      <div className={`relative w-full max-w-xl ${className}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => query.trim() && setIsOpen(true)}
            onBlur={() => {
              // Delay closing to allow clicks on dropdown items
              setTimeout(() => setIsOpen(false), 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search local Traffic-Light drugs…"
            aria-label="Search local Traffic-Light drugs"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-owns={isOpen ? "tl-search-results" : undefined}
            className="w-full pl-10 pr-4 py-2 text-sm border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        {isOpen && query.trim() && (
          <ul
            ref={dropdownRef}
            id="tl-search-results"
            role="listbox"
            className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto"
          >
            {searchResults.length > 0 ? (
              searchResults.map((item, index) => (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={selectedIndex === index}
                  tabIndex={-1}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                    ${selectedIndex === index ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}
                    ${index === 0 ? 'rounded-t-lg' : ''}
                    ${index === searchResults.length - 1 ? 'rounded-b-lg' : ''}
                  `}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    if (e.ctrlKey || e.metaKey) {
                      handleInsertIntoChat(item);
                    } else {
                      handleSelectItem(item);
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <PolicyBadge 
                    status={item.status_enum as PolicyStatus}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {highlightMatch(item.name, query)}
                    </div>
                    {item.bnf_chapter && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.bnf_chapter}
                      </div>
                    )}
                  </div>
                </li>
              ))
            ) : (
              <li className="px-3 py-2.5 text-sm text-muted-foreground">
                No matches found
              </li>
            )}
          </ul>
        )}

        {error && isOffline && (
          <div className="absolute top-full mt-1 w-full">
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-xs">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>

      {selectedItem?.policyDetails && (
        <EvidenceDrawer
          policyHit={selectedItem.policyDetails}
          nationalRefs={[
            "BNF Guidance - British National Formulary guidance",
            "NICE Pathways - NICE clinical pathways"
          ]}
          changeLog={[
            {
              date: "2025-08-23",
              change: "Status updated",
              reason: "Medicines Optimisation Team review"
            }
          ]}
          isOpen={true}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
};

export default TrafficLightSearch;