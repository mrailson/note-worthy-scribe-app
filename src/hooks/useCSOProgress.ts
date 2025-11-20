import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { csoTrainingModules } from '@/data/csoTrainingContent';

export interface ModuleProgress {
  id: string;
  module_id: string;
  completed: boolean;
  completed_at: string | null;
  time_spent_seconds: number;
}

export const useCSOProgress = (registrationId?: string) => {
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchProgress = async () => {
    if (!registrationId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cso_training_progress')
        .select('*')
        .eq('registration_id', registrationId);

      if (error) throw error;

      const progressMap: Record<string, ModuleProgress> = {};
      data?.forEach((item) => {
        progressMap[item.module_id] = item;
      });

      setProgress(progressMap);
    } catch (error) {
      console.error('Error fetching progress:', error);
      toast.error('Failed to load training progress');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [registrationId]);

  const updateProgress = async (moduleId: string, timeSpentSeconds: number) => {
    if (!registrationId) return;

    try {
      const { data, error } = await supabase
        .from('cso_training_progress')
        .upsert({
          registration_id: registrationId,
          module_id: moduleId,
          time_spent_seconds: timeSpentSeconds,
          completed: false
        }, {
          onConflict: 'registration_id,module_id'
        })
        .select()
        .single();

      if (error) throw error;

      setProgress(prev => ({
        ...prev,
        [moduleId]: data
      }));
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const completeModule = async (moduleId: string, totalTimeSpent: number) => {
    if (!registrationId) return;

    try {
      const { data, error } = await supabase
        .from('cso_training_progress')
        .upsert({
          registration_id: registrationId,
          module_id: moduleId,
          completed: true,
          completed_at: new Date().toISOString(),
          time_spent_seconds: totalTimeSpent
        }, {
          onConflict: 'registration_id,module_id'
        })
        .select()
        .single();

      if (error) throw error;

      setProgress(prev => ({
        ...prev,
        [moduleId]: data
      }));

      toast.success('Module completed!');
    } catch (error) {
      console.error('Error completing module:', error);
      toast.error('Failed to mark module as complete');
    }
  };

  const getCompletedModules = (): string[] => {
    return Object.values(progress)
      .filter(p => p.completed)
      .map(p => p.module_id);
  };

  const getCompletionPercentage = (): number => {
    const totalModules = csoTrainingModules.length;
    const completedCount = getCompletedModules().length;
    return totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  };

  const areAllModulesComplete = (): boolean => {
    return getCompletedModules().length === csoTrainingModules.length;
  };

  const getModuleStatus = (moduleId: string): 'not-started' | 'in-progress' | 'completed' => {
    const moduleProgress = progress[moduleId];
    if (!moduleProgress) return 'not-started';
    if (moduleProgress.completed) return 'completed';
    return 'in-progress';
  };

  return {
    progress,
    isLoading,
    updateProgress,
    completeModule,
    getCompletedModules,
    getCompletionPercentage,
    areAllModulesComplete,
    getModuleStatus,
    fetchProgress
  };
};
