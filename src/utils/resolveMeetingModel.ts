/**
 * resolveMeetingModel — single source of truth for picking the LLM
 * sent to the auto-generate-meeting-notes edge function.
 *
 * SONNET-ONLY POLICY (May 2026):
 * The Meeting Recorder pipeline is locked to Claude Sonnet 4.6 across
 * every service (titles, overviews, notes, QC, Q&A, coach, consolidation,
 * hallucination repair, live notes, transcript cleaning). All other model
 * options were removed after IHO model comparison showed Sonnet 4.6 was
 * the only configuration producing governance-grade output without
 * fabricating attendees, owners, or deadlines.
 *
 * This helper now always returns `undefined`, which causes the edge
 * function to use its server-side default (`MEETING_PRIMARY_MODEL`,
 * which is Sonnet 4.6). Any legacy localStorage preferences are
 * migrated away on first read.
 */

const LS_KEY = 'meeting-regenerate-llm';
const LS_LAST_CHANGED_KEY = 'meeting-regenerate-llm-last-changed';

export type RegenerateModel = 'default' | 'claude-sonnet-4-6';

let migrationChecked = false;

function ensureMigration(): void {
  if (migrationChecked) return;
  migrationChecked = true;

  try {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return;

    // Anything that isn't 'default' or 'claude-sonnet-4-6' gets reset.
    if (stored !== 'default' && stored !== 'claude-sonnet-4-6') {
      localStorage.setItem(LS_KEY, 'default');
      localStorage.setItem(LS_LAST_CHANGED_KEY, String(Date.now()));
      // eslint-disable-next-line no-console
      console.info(`[resolveMeetingModel] Migrated obsolete '${stored}' → 'default' (Sonnet-only policy)`);
    }
  } catch {
    // localStorage can throw in private/SSR contexts — ignore.
  }
}

/**
 * Always returns `undefined` so the edge function falls back to the
 * Sonnet-only server default. Kept as a function for call-site compatibility.
 */
export function resolveMeetingModel(
  _explicit?: RegenerateModel | string
): string | undefined {
  ensureMigration();
  return undefined;
}

/**
 * Convenience for `supabase.functions.invoke` body construction.
 * Now always returns an empty object — kept for call-site compatibility.
 */
export function modelOverrideField(
  _explicit?: RegenerateModel | string
): { modelOverride?: string } {
  ensureMigration();
  return {};
}
