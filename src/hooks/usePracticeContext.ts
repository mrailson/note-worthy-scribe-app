import { usePracticeContextFromProvider } from '@/contexts/PracticeContext';

/**
 * Hook to access practice context data.
 * Uses shared context provider to avoid duplicate data fetching across components.
 */
export const usePracticeContext = () => {
  return usePracticeContextFromProvider();
};
