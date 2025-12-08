import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BPReading {
  id: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  date?: string;
  time?: string;
  sourceText?: string;
  included: boolean;
}

interface BPAverages {
  systolic: number;
  diastolic: number;
  pulse?: number;
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
  pulseMin?: number;
  pulseMax?: number;
}

interface NHSCategory {
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  description: string;
}

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
          included: true
        }));
        
        setReadings(prev => [...prev, ...newReadings]);
        toast.success(`Found ${newReadings.length} BP reading(s)`);
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
      // Convert file to base64
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
          included: true
        }));
        
        setReadings(prev => [...prev, ...newReadings]);
        toast.success(`Found ${newReadings.length} BP reading(s) from image`);
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

  const getNHSCategory = useCallback((): NHSCategory | null => {
    const averages = getAverages();
    if (!averages) return null;

    const { systolic, diastolic } = averages;

    if (systolic >= 140 || diastolic >= 90) {
      return {
        label: 'Stage 2 Hypertension',
        color: 'red',
        description: 'High blood pressure - medical attention recommended'
      };
    }
    if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) {
      return {
        label: 'Stage 1 Hypertension',
        color: 'orange',
        description: 'Elevated blood pressure - lifestyle changes recommended'
      };
    }
    if (systolic >= 120 && systolic < 130 && diastolic < 80) {
      return {
        label: 'Elevated',
        color: 'yellow',
        description: 'Elevated blood pressure - monitor regularly'
      };
    }
    return {
      label: 'Normal',
      color: 'green',
      description: 'Blood pressure within normal range'
    };
  }, [getAverages]);

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
    getNHSCategory
  };
};
