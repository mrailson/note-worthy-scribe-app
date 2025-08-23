import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PolicyStatus } from '@/components/PolicyBadge';

interface PolicyHit {
  name: string;
  status_enum: PolicyStatus;
  status_raw: string;
  bnf_chapter?: string;
  last_modified?: string;
  detail_url?: string;
  notes?: string;
  prior_approval_url?: string;
}

interface TrafficLightResponse {
  hits: PolicyHit[];
  query_time?: number;
  service_status?: 'ok' | 'degraded' | 'error';
}

// In-memory fallback for smoke tests
const FALLBACK_MEDICINES: Record<string, PolicyHit> = {
  'acarizax': {
    name: 'Acarizax for Allergic Asthma',
    status_enum: 'DOUBLE_RED',
    status_raw: 'double red',
    bnf_chapter: '03 – Respiratory system',
    last_modified: '2025-06-25',
    detail_url: 'https://trafficlightdrugs.example.com/testid=937',
    notes: 'Hospital-only sublingual immunotherapy. Requires specialist allergy clinic initiation and monitoring.',
    prior_approval_url: 'https://blueteq.example.com/acarizax'
  },
  'adalimumab': {
    name: 'Adalimumab (Humira)',
    status_enum: 'SPECIALIST_INITIATED',
    status_raw: 'specialist initiated',
    bnf_chapter: '10 – Musculoskeletal and joint diseases',
    last_modified: '2025-05-15',
    detail_url: 'https://trafficlightdrugs.example.com/testid=124',
    notes: 'Continue in primary care once initiated by rheumatology. Monitor for infections and malignancy.'
  },
  'apixaban': {
    name: 'Apixaban (Eliquis)',
    status_enum: 'SPECIALIST_RECOMMENDED',
    status_raw: 'specialist recommended',
    bnf_chapter: '02 – Cardiovascular system',
    last_modified: '2025-07-10',
    detail_url: 'https://trafficlightdrugs.example.com/testid=287',
    notes: 'Preferred DOAC for AF. Follow local anticoagulation guidelines for monitoring.'
  },
  'lenalidomide': {
    name: 'Lenalidomide (Revlimid)',
    status_enum: 'RED',
    status_raw: 'red',
    bnf_chapter: '08 – Malignant disease and immunosuppression',
    last_modified: '2025-04-20',
    detail_url: 'https://trafficlightdrugs.example.com/testid=445',
    notes: 'Haematology-only prescribing due to pregnancy prevention programme requirements.',
    prior_approval_url: 'https://blueteq.example.com/lenalidomide'
  },
  'metformin': {
    name: 'Metformin',
    status_enum: 'SPECIALIST_RECOMMENDED',
    status_raw: 'specialist recommended',
    bnf_chapter: '06 – Endocrine system',
    last_modified: '2025-08-01',
    detail_url: 'https://trafficlightdrugs.example.com/testid=012',
    notes: 'First-line treatment for type 2 diabetes. Check eGFR before prescribing.'
  }
};

export const useTrafficLightResolver = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to normalize medicine names for lookup
  const normalizeMedicineName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };

  // Function to extract potential medicine names from text
  const extractMedicineNames = useCallback((text: string): string[] => {
    // Simple medicine detection - look for capitalized words that might be medicines
    const words = text.split(/\s+/);
    const potentialMedicines: string[] = [];
    
    // Common medicine name patterns
    const medicinePatterns = [
      /^[A-Z][a-z]+mab$/, // Monoclonal antibodies
      /^[A-Z][a-z]*pril$/, // ACE inhibitors
      /^[A-Z][a-z]*sartan$/, // ARBs
      /^[A-Z][a-z]*olol$/, // Beta blockers
      /^[A-Z][a-z]*pine$/, // Calcium channel blockers
      /^[A-Z][a-z]*statin$/, // Statins
      /^[A-Z][a-z]*mycin$/, // Antibiotics
      /^[A-Z][a-z]*cillin$/, // Penicillins
    ];
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      
      // Check if it matches medicine patterns
      if (medicinePatterns.some(pattern => pattern.test(cleanWord))) {
        potentialMedicines.push(cleanWord);
      }
      
      // Check if it's a known medicine in our fallback
      const normalized = normalizeMedicineName(cleanWord);
      if (FALLBACK_MEDICINES[normalized]) {
        potentialMedicines.push(cleanWord);
      }
      
      // Check for common medicine keywords in context
      if (cleanWord.length > 4 && /^[A-Z][a-z]/.test(cleanWord)) {
        const lowerText = text.toLowerCase();
        const medicineTriggers = [
          'prescrib', 'start', 'initiat', 'dose', 'mg', 'tablet', 
          'capsule', 'injection', 'medication', 'drug', 'treatment'
        ];
        
        if (medicineTriggers.some(trigger => 
          lowerText.includes(trigger) && 
          lowerText.includes(cleanWord.toLowerCase())
        )) {
          potentialMedicines.push(cleanWord);
        }
      }
    });
    
    return [...new Set(potentialMedicines)]; // Remove duplicates
  }, []);

  // Main resolver function
  const resolveMedicines = useCallback(async (query: string): Promise<TrafficLightResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Extract potential medicine names from the query
      const medicineNames = extractMedicineNames(query);
      
      if (medicineNames.length === 0) {
        return {
          hits: [],
          query_time: 0,
          service_status: 'ok'
        };
      }

      // Query the database for matching medicines
      const { data: medicines, error: fetchError } = await supabase
        .from('traffic_light_medicines')
        .select('*')
        .or(
          medicineNames.map(name => 
            `name.ilike.%${name}%`
          ).join(',')
        );

      if (fetchError) {
        console.error('Database query failed:', fetchError);
        // Fall back to mock data on error
        const hits: PolicyHit[] = [];
        medicineNames.forEach(medicine => {
          const normalized = normalizeMedicineName(medicine);
          const fallbackHit = FALLBACK_MEDICINES[normalized];
          if (fallbackHit) {
            hits.push(fallbackHit);
          }
        });
        
        return {
          hits,
          query_time: 0.3,
          service_status: 'degraded'
        };
      }

      // Transform database results to PolicyHit format
      const hits: PolicyHit[] = (medicines || []).map(medicine => ({
        name: medicine.name,
        status_enum: medicine.status_enum as PolicyStatus,
        status_raw: medicine.status_raw || medicine.status_enum.toLowerCase(),
        bnf_chapter: medicine.bnf_chapter || 'Unknown',
        last_modified: medicine.updated_at || medicine.created_at,
        detail_url: medicine.detail_url || 'https://www.icnorthamptonshire.org.uk/trafficlightdrugs',
        notes: medicine.notes,
        prior_approval_url: medicine.prior_approval_url
      }));

      return {
        hits,
        query_time: 0.2,
        service_status: 'ok'
      };
      
    } catch (err) {
      console.error('Traffic light resolver error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      return {
        hits: [],
        service_status: 'error'
      };
    } finally {
      setIsLoading(false);
    }
  }, [extractMedicineNames]);

  // Single medicine lookup
  const lookupMedicine = useCallback(async (medicineName: string): Promise<PolicyHit | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Query database for exact or partial matches
      const { data: medicines, error: fetchError } = await supabase
        .from('traffic_light_medicines')
        .select('*')
        .or(`name.ilike.%${medicineName}%,name.ilike.${medicineName}`)
        .order('name')
        .limit(1);

      if (fetchError) {
        console.error('Medicine lookup failed:', fetchError);
        // Fall back to mock data
        const normalized = normalizeMedicineName(medicineName);
        return FALLBACK_MEDICINES[normalized] || null;
      }

      if (medicines && medicines.length > 0) {
        const medicine = medicines[0];
        return {
          name: medicine.name,
          status_enum: medicine.status_enum as PolicyStatus,
          status_raw: medicine.status_raw || medicine.status_enum.toLowerCase(),
          bnf_chapter: medicine.bnf_chapter || 'Unknown',
          last_modified: medicine.updated_at || medicine.created_at,
          detail_url: medicine.detail_url || 'https://www.icnorthamptonshire.org.uk/trafficlightdrugs',
          notes: medicine.notes,
          prior_approval_url: medicine.prior_approval_url
        };
      }

      return null;
      
    } catch (err) {
      console.error('Medicine lookup error:', err);
      setError('Failed to lookup medicine');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Batch lookup for multiple medicines
  const batchLookup = useCallback(async (medicineNames: string[]): Promise<PolicyHit[]> => {
    const query = medicineNames.join(' ');
    const result = await resolveMedicines(query);
    return result.hits;
  }, [resolveMedicines]);

  return {
    resolveMedicines,
    lookupMedicine,
    batchLookup,
    extractMedicineNames,
    isLoading,
    error,
    // Expose fallback data for testing
    fallbackMedicines: Object.keys(FALLBACK_MEDICINES)
  };
};