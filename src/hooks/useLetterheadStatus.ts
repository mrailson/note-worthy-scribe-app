import { useCallback, useEffect, useState } from 'react';
import { getActiveLetterhead, type ActiveLetterhead } from '@/utils/practiceLetterhead';

export type LetterheadStatus = 'loading' | 'active' | 'missing' | 'error';

export interface UseLetterheadStatusResult {
  status: LetterheadStatus;
  letterhead: ActiveLetterhead | null;
  refetch: () => Promise<void>;
}

/**
 * Resolves the active letterhead for a practice and exposes a UI-friendly
 * status flag. Used by Letter Lab so the preview can warn the user when
 * the letterhead is missing — the legacy generator silently used the
 * Notewell default, which masked configuration gaps.
 */
export function useLetterheadStatus(
  practiceId: string | null | undefined,
): UseLetterheadStatusResult {
  const [status, setStatus] = useState<LetterheadStatus>('loading');
  const [letterhead, setLetterhead] = useState<ActiveLetterhead | null>(null);

  const load = useCallback(async () => {
    if (!practiceId) {
      setStatus('missing');
      setLetterhead(null);
      return;
    }
    setStatus('loading');
    try {
      const result = await getActiveLetterhead(practiceId);
      if (result) {
        setLetterhead(result);
        setStatus('active');
      } else {
        setLetterhead(null);
        setStatus('missing');
      }
    } catch (err) {
      console.error('[useLetterheadStatus] failed:', err);
      setLetterhead(null);
      setStatus('error');
    }
  }, [practiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { status, letterhead, refetch: load };
}
