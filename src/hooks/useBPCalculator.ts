import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  BPAverages,
  NHSCategory,
  NICEHomeBPAverage,
  BPTrends,
  DataQuality,
  DateRange,
  QOFRelevance,
  TimeOfDayAverages,
  calculateNICEHomeBPAverage,
  getNICEHomeBPCategory,
  calculateTrends,
  calculateDataQuality,
  getDateRange,
  getQOFRelevance,
  calculateTimeOfDayAverages
} from '@/utils/bpCalculations';

export interface BPReading {
  id: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  date?: string;
  time?: string;
  sourceText?: string;
  included: boolean;
  excludeReason?: string;
}

export type { BPAverages, NHSCategory, NICEHomeBPAverage, BPTrends, DataQuality, DateRange, QOFRelevance, TimeOfDayAverages };

export const useBPCalculator = () => {
  const [readings, setReadings] = useState<BPReading[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseTextInput = useCallback(async (text: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-bp-readings', {
        body: { text, mode: 'text' }
      });

      if (error) throw error;

      if (data.readings && data.readings.length > 0) {
        const newReadings: BPReading[] = data.readings.map((r: any, index: number) => ({
          id: `reading-${Date.now()}-${index}`,
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse,
          date: r.date,
          time: r.time,
          sourceText: r.sourceText,
          included: !r.excluded,
          excludeReason: r.excludeReason
        }));
        
        const validCount = newReadings.filter(r => r.included).length;
        const excludedCount = newReadings.filter(r => !r.included).length;
        setReadings(prev => [...prev, ...newReadings]);
        
        if (excludedCount > 0) {
          toast.success(`Found ${validCount} valid reading(s), ${excludedCount} excluded`);
        } else {
          toast.success(`Found ${newReadings.length} BP reading(s)`);
        }
      } else {
        toast.warning('No BP readings found in the text');
      }
    } catch (error) {
      console.error('Error parsing text:', error);
      toast.error('Failed to parse BP readings from text');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const parseImageInput = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isWord = fileName.endsWith('.docx') || fileName.endsWith('.doc');
      const isText = fileName.endsWith('.txt');
      
      // For Excel, Word, and text files - extract text client-side first
      if (isExcel || isWord || isText) {
        const { FileProcessorManager } = await import('@/utils/fileProcessors/FileProcessorManager');
        const processed = await FileProcessorManager.processFile(file);
        
        // Send extracted text to the API in text mode
        const { data, error } = await supabase.functions.invoke('parse-bp-readings', {
          body: { text: processed.content, mode: 'text' }
        });
        
        if (error) throw error;
        
        if (data.readings && data.readings.length > 0) {
          const newReadings: BPReading[] = data.readings.map((r: any, index: number) => ({
            id: `reading-${Date.now()}-${index}`,
            systolic: r.systolic,
            diastolic: r.diastolic,
            pulse: r.pulse,
            date: r.date,
            time: r.time,
            sourceText: r.sourceText,
            included: !r.excluded,
            excludeReason: r.excludeReason
          }));
          
          const validCount = newReadings.filter(r => r.included).length;
          const excludedCount = newReadings.filter(r => !r.included).length;
          setReadings(prev => [...prev, ...newReadings]);
          
          if (excludedCount > 0) {
            toast.success(`Found ${validCount} valid reading(s), ${excludedCount} excluded`);
          } else {
            toast.success(`Found ${newReadings.length} BP reading(s) from file`);
          }
        } else {
          toast.warning('No BP readings found in the file');
        }
        return;
      }
      
      // For images and PDFs - send to vision API
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('parse-bp-readings', {
        body: { 
          imageData: base64,
          fileName: file.name,
          mode: 'image'
        }
      });

      if (error) throw error;

      if (data.readings && data.readings.length > 0) {
        const newReadings: BPReading[] = data.readings.map((r: any, index: number) => ({
          id: `reading-${Date.now()}-${index}`,
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse,
          date: r.date,
          time: r.time,
          sourceText: r.sourceText,
          included: !r.excluded,
          excludeReason: r.excludeReason
        }));
        
        const validCount = newReadings.filter(r => r.included).length;
        const excludedCount = newReadings.filter(r => !r.included).length;
        setReadings(prev => [...prev, ...newReadings]);
        
        if (excludedCount > 0) {
          toast.success(`Found ${validCount} valid reading(s), ${excludedCount} excluded`);
        } else {
          toast.success(`Found ${newReadings.length} BP reading(s) from image`);
        }
      } else {
        toast.warning('No BP readings found in the image');
      }
    } catch (error) {
      console.error('Error parsing image:', error);
      toast.error('Failed to parse BP readings from image');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const toggleReading = useCallback((id: string) => {
    setReadings(prev => prev.map(r => 
      r.id === id ? { ...r, included: !r.included } : r
    ));
  }, []);

  const updateReading = useCallback((id: string, updates: Partial<BPReading>) => {
    setReadings(prev => prev.map(r => 
      r.id === id ? { ...r, ...updates } : r
    ));
  }, []);

  const deleteReading = useCallback((id: string) => {
    setReadings(prev => prev.filter(r => r.id !== id));
  }, []);

  const getAverages = useCallback((): BPAverages | null => {
    const includedReadings = readings.filter(r => r.included);
    if (includedReadings.length === 0) return null;

    const systolicValues = includedReadings.map(r => r.systolic);
    const diastolicValues = includedReadings.map(r => r.diastolic);
    const pulseValues = includedReadings.filter(r => r.pulse).map(r => r.pulse!);

    const avgSystolic = Math.round(systolicValues.reduce((a, b) => a + b, 0) / systolicValues.length);
    const avgDiastolic = Math.round(diastolicValues.reduce((a, b) => a + b, 0) / diastolicValues.length);
    const avgPulse = pulseValues.length > 0 
      ? Math.round(pulseValues.reduce((a, b) => a + b, 0) / pulseValues.length)
      : undefined;

    return {
      systolic: avgSystolic,
      diastolic: avgDiastolic,
      pulse: avgPulse,
      systolicMin: Math.min(...systolicValues),
      systolicMax: Math.max(...systolicValues),
      diastolicMin: Math.min(...diastolicValues),
      diastolicMax: Math.max(...diastolicValues),
      pulseMin: pulseValues.length > 0 ? Math.min(...pulseValues) : undefined,
      pulseMax: pulseValues.length > 0 ? Math.max(...pulseValues) : undefined
    };
  }, [readings]);

  // Get NICE Home BP Category based on NICE NG136 thresholds
  const getNICECategory = useCallback((): NHSCategory | null => {
    const niceAvg = calculateNICEHomeBPAverage(readings);
    if (!niceAvg.isValid || niceAvg.systolic === null || niceAvg.diastolic === null) {
      // Fall back to raw averages if NICE average not available
      const averages = getAverages();
      if (!averages) return null;
      return getNICEHomeBPCategory(averages.systolic, averages.diastolic);
    }
    return getNICEHomeBPCategory(niceAvg.systolic, niceAvg.diastolic);
  }, [readings, getAverages]);

  // Legacy method for backwards compatibility - uses raw averages
  const getNHSCategory = useCallback((): NHSCategory | null => {
    const averages = getAverages();
    if (!averages) return null;
    return getNICEHomeBPCategory(averages.systolic, averages.diastolic);
  }, [getAverages]);

  // Get NICE Home BP Average
  const getNICEHomeBPAverageData = useCallback((): NICEHomeBPAverage => {
    return calculateNICEHomeBPAverage(readings);
  }, [readings]);

  // Get trends data
  const getTrends = useCallback((): BPTrends => {
    return calculateTrends(readings);
  }, [readings]);

  // Get data quality score
  const getDataQualityScore = useCallback((): DataQuality => {
    return calculateDataQuality(readings);
  }, [readings]);

  // Get date range
  const getDateRangeData = useCallback((): DateRange => {
    return getDateRange(readings);
  }, [readings]);

  // Get QOF relevance
  const getQOFRelevanceData = useCallback((): QOFRelevance => {
    const niceAvg = calculateNICEHomeBPAverage(readings);
    return getQOFRelevance(readings, niceAvg);
  }, [readings]);

  // Get AM/PM averages
  const getTimeOfDayAverages = useCallback((): TimeOfDayAverages => {
    return calculateTimeOfDayAverages(readings);
  }, [readings]);

  return {
    readings,
    setReadings,
    isProcessing,
    parseTextInput,
    parseImageInput,
    toggleReading,
    updateReading,
    deleteReading,
    getAverages,
    getNHSCategory,
    getNICECategory,
    getNICEHomeBPAverage: getNICEHomeBPAverageData,
    getTrends,
    getDataQualityScore,
    getDateRange: getDateRangeData,
    getQOFRelevance: getQOFRelevanceData,
    getTimeOfDayAverages
  };
};
