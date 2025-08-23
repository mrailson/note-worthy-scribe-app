import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TLVocabItem {
  id: number;
  name: string;
  status_enum: string;
  bnf_chapter?: string;
  detail_url: string;
}

interface TLVocabResponse {
  version: string;
  items: TLVocabItem[];
}

const CACHE_KEY = 'tl_vocab_cache';
const ETAG_KEY = 'tl_vocab_etag';

// Fallback data for offline/error states
const FALLBACK_VOCAB: TLVocabResponse = {
  version: "2025-08-23",
  items: [
    {
      id: 937,
      name: "Acarizax for Allergic Asthma",
      status_enum: "DOUBLE_RED",
      bnf_chapter: "03 – Respiratory system",
      detail_url: "https://example.com/trafficlightdrugs/?testid=937"
    },
    {
      id: 812,
      name: "Acarizax",
      status_enum: "SPECIALIST_INITIATED",
      bnf_chapter: "03 – Respiratory system",
      detail_url: "https://example.com/trafficlightdrugs/?testid=812"
    },
    {
      id: 100,
      name: "Adalimumab",
      status_enum: "RED",
      bnf_chapter: "10 – Musculoskeletal and joint diseases",
      detail_url: "https://example.com/trafficlightdrugs/?testid=100"
    },
    {
      id: 200,
      name: "Metformin",
      status_enum: "SPECIALIST_RECOMMENDED",
      bnf_chapter: "06 – Endocrine system",
      detail_url: "https://example.com/trafficlightdrugs/?testid=200"
    },
    {
      id: 300,
      name: "Paracetamol",
      status_enum: "GREY",
      bnf_chapter: "04 – Central nervous system",
      detail_url: "https://example.com/trafficlightdrugs/?testid=300"
    }
  ]
};

export const useTrafficLightVocab = () => {
  const [vocab, setVocab] = useState<TLVocabItem[]>(FALLBACK_VOCAB.items);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [version, setVersion] = useState<string>(FALLBACK_VOCAB.version);

  const getCachedData = (): TLVocabResponse | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const setCachedData = (data: TLVocabResponse, etag?: string) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      if (etag) {
        localStorage.setItem(ETAG_KEY, etag);
      }
    } catch (err) {
      console.warn('Failed to cache vocabulary data:', err);
    }
  };

  const fetchVocabulary = async () => {
    try {
      setError(null);
      
      // For now, simulate API call - replace with actual endpoint when available
      const cachedEtag = localStorage.getItem(ETAG_KEY);
      
      // Simulate API response
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockResponse: TLVocabResponse = {
        version: "2025-08-23",
        items: [
          ...FALLBACK_VOCAB.items,
          {
            id: 400,
            name: "Omeprazole",
            status_enum: "SPECIALIST_RECOMMENDED",
            bnf_chapter: "01 – Gastro-intestinal system",
            detail_url: "https://example.com/trafficlightdrugs/?testid=400"
          },
          {
            id: 500,
            name: "Warfarin",
            status_enum: "RED",
            bnf_chapter: "02 – Cardiovascular system",
            detail_url: "https://example.com/trafficlightdrugs/?testid=500"
          }
        ]
      };

      setVocab(mockResponse.items);
      setVersion(mockResponse.version);
      setCachedData(mockResponse);
      setIsOffline(false);
      
    } catch (err) {
      console.error('Failed to fetch vocabulary:', err);
      
      // Try to use cached data
      const cached = getCachedData();
      if (cached) {
        setVocab(cached.items);
        setVersion(cached.version);
        setIsOffline(true);
        setError('Policy index offline—verify on ICB site');
      } else {
        setVocab(FALLBACK_VOCAB.items);
        setVersion(FALLBACK_VOCAB.version);
        setError('Failed to load vocabulary');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshVocabulary = () => {
    setIsLoading(true);
    fetchVocabulary();
  };

  useEffect(() => {
    // Load cached data immediately for instant startup
    const cached = getCachedData();
    if (cached) {
      setVocab(cached.items);
      setVersion(cached.version);
      setIsLoading(false);
    }

    // Then fetch fresh data in background
    fetchVocabulary();
  }, []);

  return {
    vocab,
    isLoading,
    error,
    isOffline,
    version,
    refreshVocabulary
  };
};