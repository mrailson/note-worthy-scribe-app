import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import Fuse from 'fuse.js';
import { PolicyBadge, type PolicyStatus } from './PolicyBadge';
import { FormularyBadge, type FormularyStatus } from './FormularyBadge';
import { PolicyModal } from './PolicyModal';
import { useTrafficLightVocab, type TLVocabItem } from '@/hooks/useTrafficLightVocab';
import { supabase } from '@/integrations/supabase/client';

interface TrafficLightSearchProps {
  onInsertIntoChat?: (message: string) => void;
  className?: string;
  onRegisterSetDrugName?: (setDrugNameFn: (drugName: string) => void) => void;
}

const TrafficLightSearch: React.FC<TrafficLightSearchProps> = ({ 
  onInsertIntoChat,
  className = "",
  onRegisterSetDrugName
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [policyData, setPolicyData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formularyCache, setFormularyCache] = useState<Record<string, FormularyStatus>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  
  const { vocab, isLoading, error, isOffline } = useTrafficLightVocab();

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

  // Function to set drug name externally
  const setDrugName = (drugName: string) => {
    setQuery(drugName);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Register setDrugName function with parent
  useEffect(() => {
    if (onRegisterSetDrugName) {
      onRegisterSetDrugName(setDrugName);
    }
  }, [onRegisterSetDrugName]);

  const handleSelectItem = async (item: TLVocabItem) => {
    try {
      const { data, error } = await supabase.functions.invoke('comprehensive-drug-lookup', {
        body: { name: item.name }
      });
      
      if (error) throw error;
      
      // Transform the data to match the PolicyModal interface
      const transformedData = {
        drug: {
          name: item.name,
          searched_term: item.name
        },
        traffic_light: data?.traffic_light ? {
          status: data.traffic_light.status_enum,
          detail_url: data.traffic_light.detail_url,
          last_modified: data.traffic_light.last_modified,
          bnf_chapter: data.traffic_light.bnf_chapter,
          notes: data.traffic_light.notes
        } : null,
        prior_approval: data?.prior_approval?.length > 0 ? {
          status: data.prior_approval[0].pa_status_enum,
          criteria: data.prior_approval[0].criteria_excerpt,
          source_url: data.prior_approval[0].source_url,
          last_updated: data.prior_approval[0].last_updated
        } : null,
        formulary: data?.formulary?.length > 0 ? {
          bnf_chapter: data.formulary[0]?.bnf_chapter_name,
          section: data.formulary[0]?.section,
          preferred: data.formulary
            .filter((item: any) => item.preference_rank)
            .map((item: any) => ({
              item_name: item.item_name,
              rank: item.preference_rank,
              notes: item.notes,
              otc: item.otc
            }))
            .sort((a: any, b: any) => a.rank - b.rank),
          page_url: data.formulary[0]?.page_url || "https://www.icnorthamptonshire.org.uk/mo-formulary",
          last_published: data.formulary[0]?.last_published,
          found_exact_match: data.formulary.some((item: any) => 
            item.item_name.toLowerCase().includes(item.name?.toLowerCase() || '')
          )
        } : null
      };
      
      setPolicyData(transformedData);
      setIsModalOpen(true);
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

  // Fetch formulary status for search results
  const fetchFormularyStatus = async (drugName: string): Promise<FormularyStatus> => {
    try {
      const { data, error } = await supabase.functions.invoke('comprehensive-drug-lookup', {
        body: { name: drugName }
      });
      
      if (error || !data?.formulary?.length) return 'none';
      
      const formularyItems = data.formulary;
      
      // Check if any item has OTC status
      const hasOTC = formularyItems.some((item: any) => item.otc === true);
      if (hasOTC) return 'otc';
      
      // Check if any item is preferred (rank 1 or 2)
      const hasPreferred = formularyItems.some((item: any) => 
        item.preference_rank && [1, 2].includes(item.preference_rank)
      );
      if (hasPreferred) return 'preferred';
      
      // If listed but not preferred
      if (formularyItems.length > 0) return 'listed';
      
      return 'none';
    } catch (err) {
      console.error('Failed to fetch formulary status:', err);
      return 'none';
    }
  };

  // Update formulary cache when search results change
  useEffect(() => {
    if (searchResults.length === 0) return;

    const updateFormularyCache = async () => {
      const newCache = { ...formularyCache };
      const promises = searchResults
        .filter(item => !newCache[item.name])
        .map(async (item) => {
          const status = await fetchFormularyStatus(item.name);
          newCache[item.name] = status;
        });
      
      if (promises.length > 0) {
        await Promise.all(promises);
        setFormularyCache(newCache);
      }
    };

    const debounceTimer = setTimeout(() => {
      updateFormularyCache();
    }, 300); // Debounce to avoid too many requests

    return () => clearTimeout(debounceTimer);
  }, [searchResults]);

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
                  {formularyCache[item.name] && formularyCache[item.name] !== 'none' && (
                    <FormularyBadge 
                      status={formularyCache[item.name]}
                      className="flex-shrink-0"
                    />
                  )}
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

      <PolicyModal
        policyData={policyData}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setPolicyData(null);
        }}
        onInsertIntoChat={onInsertIntoChat}
      />
    </>
  );
};

export default TrafficLightSearch;