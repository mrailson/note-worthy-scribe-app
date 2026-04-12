import { useMemo } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useAuth } from '@/contexts/AuthContext';

export interface VoiceAgentContextData {
  displayName: string;
  email?: string;
  role?: string;
  practiceName?: string;
  practiceAddress?: string;
  practicePostcode?: string;
  practicePhone?: string;
  practiceOdsCode?: string;
}

/**
 * Builds a structured context block for ElevenLabs voice agents
 * from the logged-in user's profile and linked practice/organisation.
 */
export function useVoiceAgentContext() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { practiceContext } = usePracticeContext();

  const contextData: VoiceAgentContextData = useMemo(() => {
    const displayName =
      profile?.display_name ||
      profile?.full_name ||
      user?.email?.split('@')[0] ||
      'User';

    return {
      displayName,
      email: profile?.email || user?.email || undefined,
      role: profile?.role || profile?.title || practiceContext?.userRole || undefined,
      practiceName: practiceContext?.practiceName || undefined,
      practiceAddress: practiceContext?.practiceAddress || undefined,
      practicePostcode: practiceContext?.practicePostcode || undefined,
      practicePhone: practiceContext?.practicePhone || undefined,
      practiceOdsCode: practiceContext?.practiceOdsCode || undefined,
    };
  }, [profile, user, practiceContext]);

  /** Prompt fragment to inject into the agent's context */
  const contextPrompt = useMemo(() => {
    const d = contextData;
    const lines: string[] = [];

    const roleSuffix = d.role ? ` (${d.role})` : '';
    const fromSuffix = d.practiceName ? ` from ${d.practiceName}` : '';
    lines.push(`You are speaking with ${d.displayName}${roleSuffix}${fromSuffix}.`);

    if (d.email) {
      lines.push(`Their email is ${d.email}.`);
    }

    const details: string[] = [];
    if (d.practiceAddress) {
      const addr = d.practicePostcode
        ? `${d.practiceAddress}, ${d.practicePostcode}`
        : d.practiceAddress;
      details.push(`Address: ${addr}`);
    }
    if (d.practicePhone) details.push(`Phone: ${d.practicePhone}`);
    if (d.practiceOdsCode) details.push(`ODS Code: ${d.practiceOdsCode}`);

    if (details.length > 0) {
      lines.push('Practice details:');
      details.forEach((detail) => lines.push(`- ${detail}`));
    }

    return lines.join('\n');
  }, [contextData]);

  /** Dynamic variables map for ElevenLabs startSession */
  const dynamicVariables = useMemo(() => {
    const d = contextData;
    return {
      user_name: d.displayName,
      user_email: d.email || '',
      user_role: d.role || '',
      practice_name: d.practiceName || '',
      practice_address: d.practiceAddress || '',
      practice_postcode: d.practicePostcode || '',
      practice_phone: d.practicePhone || '',
      practice_ods_code: d.practiceOdsCode || '',
      dynamic_context: contextPrompt,
    };
  }, [contextData, contextPrompt]);

  return { contextData, contextPrompt, dynamicVariables };
}
