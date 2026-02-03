import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTrafficLightVocab, TLVocabItem } from '@/hooks/useTrafficLightVocab';
import Fuse from 'fuse.js';

interface BNFTypeaheadSearchProps {
  onDrugSelect: (drugName: string, trafficLightItem?: TLVocabItem) => void;
}

const getStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
  
  if (statusLower.includes('green') || statusLower === 'green') {
    return { label: 'GREEN', className: 'bg-green-100 text-green-800 border-green-200' };
  }
  if (statusLower.includes('double') || statusLower === 'double_red') {
    return { label: 'DOUBLE RED', className: 'bg-red-200 text-red-900 border-red-300' };
  }
  if (statusLower.includes('red') || statusLower === 'red') {
    return { label: 'RED', className: 'bg-red-100 text-red-800 border-red-200' };
  }
  if (statusLower.includes('amber') || statusLower === 'amber') {
    return { label: 'AMBER', className: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  if (statusLower.includes('specialist') || statusLower === 'specialist_initiated') {
    return { label: 'SPECIALIST', className: 'bg-purple-100 text-purple-800 border-purple-200' };
  }
  if (statusLower.includes('hospital') || statusLower === 'hospital_only') {
    return { label: 'HOSPITAL', className: 'bg-slate-100 text-slate-800 border-slate-200' };
  }
  
  return { label: status?.toUpperCase() || 'UNKNOWN', className: 'bg-muted text-muted-foreground border-border' };
};

export const BNFTypeaheadSearch: React.FC<BNFTypeaheadSearchProps> = ({ onDrugSelect }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const { vocab, isLoading } = useTrafficLightVocab();
  
  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(vocab, {
      keys: ['name'],
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 2,
      includeScore: true,
    });
  }, [vocab]);
  
  // Search results with debounce effect
  const results = useMemo(() => {
    if (query.length < 2) return [];
    
    const searchResults = fuse.search(query);
    
    // Sort by score and prefix match boost
    return searchResults
      .map(result => ({
        ...result,
        prefixMatch: result.item.name.toLowerCase().startsWith(query.toLowerCase()),
      }))
      .sort((a, b) => {
        // Boost prefix matches
        if (a.prefixMatch && !b.prefixMatch) return -1;
        if (!a.prefixMatch && b.prefixMatch) return 1;
        // Then by score
        return (a.score || 0) - (b.score || 0);
      })
      .slice(0, 15)
      .map(r => r.item);
  }, [query, fuse]);
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };
  
  const handleSelect = (item: TLVocabItem) => {
    onDrugSelect(item.name, item);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(0);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        listRef.current && 
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);
  
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search 500+ drugs..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>
      
      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div
          ref={listRef}
          className={cn(
            "absolute top-full left-0 right-0 mt-1 z-50",
            "bg-popover border rounded-lg shadow-lg",
            "max-h-[300px] overflow-y-auto"
          )}
        >
          {results.map((item, index) => {
            const badge = getStatusBadge(item.status_enum);
            
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2",
                  "text-left text-sm",
                  "hover:bg-accent transition-colors",
                  index === selectedIndex && "bg-accent"
                )}
              >
                <span className="font-medium text-foreground truncate flex-1 mr-2">
                  {item.name}
                </span>
                <Badge 
                  variant="outline" 
                  className={cn("text-xs shrink-0", badge.className)}
                >
                  {badge.label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
      
      {/* No results message */}
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-1 z-50",
          "bg-popover border rounded-lg shadow-lg",
          "px-3 py-4 text-center text-sm text-muted-foreground"
        )}>
          No drugs found matching "{query}"
        </div>
      )}
    </div>
  );
};
