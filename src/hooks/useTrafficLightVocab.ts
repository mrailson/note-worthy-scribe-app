import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TLVocabItem {
  id: number;
  name: string;
  status_enum: string;
  bnf_chapter?: string;
  detail_url: string;
  status_raw?: string;
  notes?: string;
  prior_approval_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface TLVocabResponse {
  version: string;
  items: TLVocabItem[];
}

const CACHE_KEY = 'tl_vocab_cache';
const VERSION_KEY = 'tl_vocab_version';

// Fallback data for offline/error states
const FALLBACK_VOCAB: TLVocabResponse = {
  version: "2025-08-23",
  items: [
    {
      id: 1,
      name: "Atomoxetine (adult)",
      status_enum: "SPECIALIST_INITIATED",
      bnf_chapter: "04 - Central nervous system",
      detail_url: "https://www.icnorthamptonshire.org.uk/trafficlightdrugs"
    },
    {
      id: 2,
      name: "Atorvastatin (Lipitor) Chewable",
      status_enum: "DOUBLE_RED",
      bnf_chapter: "02 - Cardiovascular system",
      detail_url: "https://www.icnorthamptonshire.org.uk/trafficlightdrugs"
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

  const setCachedData = (data: TLVocabResponse) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(VERSION_KEY, data.version);
    } catch (err) {
      console.warn('Failed to cache vocabulary data:', err);
    }
  };

  const fetchVocabulary = async () => {
    try {
      setError(null);
      
      // Fetch data from Supabase
      // NOTE: Supabase/PostgREST commonly enforces a max rows limit (often 1,000) per request.
      // We page through results to ensure we load the full ICB dataset (e.g. entries in later
      // alphabet such as Tirzepatide / Mounjaro).
      const pageSize = 1000;
      let from = 0;
      let medicines: any[] = [];

      while (true) {
        const to = from + pageSize - 1;
        const { data: page, error: fetchError } = await supabase
          .from('traffic_light_medicines')
          .select('*')
          .order('name')
          .range(from, to);

        if (fetchError) {
          throw fetchError;
        }

        if (page && page.length > 0) {
          medicines = medicines.concat(page);
        }

        if (!page || page.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      if (medicines && medicines.length > 0) {
        // Transform database records to match TLVocabItem interface
        const transformedItems: TLVocabItem[] = medicines.map((medicine, index) => ({
          id: index + 1, // Generate sequential ID for compatibility
          name: medicine.name,
          status_enum: medicine.status_enum,
          bnf_chapter: medicine.bnf_chapter,
          detail_url: medicine.detail_url || "https://www.icnorthamptonshire.org.uk/trafficlightdrugs",
          status_raw: medicine.status_raw,
          notes: medicine.notes,
          prior_approval_url: medicine.prior_approval_url,
          created_at: medicine.created_at,
          updated_at: medicine.updated_at
        }));

        const response: TLVocabResponse = {
          version: new Date().toISOString().split('T')[0], // Today's date as version
          items: transformedItems
        };

        setVocab(response.items);
        setVersion(response.version);
        setCachedData(response);
        setIsOffline(false);
        
        console.log(`Loaded ${transformedItems.length} traffic light medicines from database`);
      }
      
    } catch (err) {
      console.error('Failed to fetch vocabulary from database:', err);
      
      // Try to use cached data
      const cached = getCachedData();
      if (cached) {
        setVocab(cached.items);
        setVersion(cached.version);
        setIsOffline(true);
        setError('Using cached data - database temporarily unavailable');
      } else {
        setVocab(FALLBACK_VOCAB.items);
        setVersion(FALLBACK_VOCAB.version);
        setError('Failed to load vocabulary - using limited fallback data');
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