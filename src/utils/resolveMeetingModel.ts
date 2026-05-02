/**
 * resolveMeetingModel — single source of truth for picking the LLM
 * sent to the auto-generate-meeting-notes edge function.
 *
 * Returns:
 *   undefined → caller MUST NOT include modelOverride in the request body.
 *               Server then picks its current default (Gemini 3.1 Pro,
 *               with auto-fallback chain Flash → 2.5 Pro → GPT-5).
 *   string    → explicit edge-function model identifier.
 *
 * Use modelOverrideField() in the body to spread {modelOverride} only when defined.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Migration / normalisation table (legacy localStorage values):
 *
 *   ''                            → undefined (server default)
 *   null / undefined              → undefined (server default)
 *   'default'                     → undefined (server default)
 *   'gemini-3-flash'              → 'gemini-3-flash'  (kept; valid first-class option)
 *   'sonnet-4.6'    (UI alias)    → 'claude-sonnet-4-6'
 *   'claude-sonnet-4-6'           → 'claude-sonnet-4-6' (kept ONLY if user
 *                                    explicitly chose within last 30 days;
 *                                    otherwise auto-migrated to 'default'
 *                                    by ensureMigration() — see note below)
 *   'claude-haiku-4-5-20251001'   → undefined (option removed in Apr 2026)
 *   'gemini-3.1-pro' / 'gemini-3.1-pro-preview'
 *                                 → both accepted by edge function (line ~1864
 *                                    of auto-generate-meeting-notes/index.ts).
 *                                    Canonical logged identifier is
 *                                    'gemini-3.1-pro'. No normalisation needed.
 *
 * Stale-Sonnet auto-migration (Apr 2026):
 *   Before the Pro deploy, every empty/missing localStorage entry was
 *   silently rewritten to 'claude-sonnet-4-6' by 8 client call sites.
 *   The result: thousands of users have a "stale" Sonnet preference they
 *   never actually chose. ensureMigration() runs once per page load and
 *   resets that to 'default' WHEN the lastChanged timestamp is missing or
 *   older than 30 days. Users who deliberately picked Sonnet within the
 *   last 30 days are left alone.
 *
 * The localStorage key 'meeting-regenerate-llm' MUST only be READ here.
 * Settings.tsx is the only allowed WRITER (handleRegenerateLlmChange).
 * ─────────────────────────────────────────────────────────────────────────
 */

const LS_KEY = 'meeting-regenerate-llm';
const LS_LAST_CHANGED_KEY = 'meeting-regenerate-llm-last-changed';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type RegenerateModel =
  | 'default'
  | 'gemini-3-flash'
  | 'sonnet-4.6'
  | 'claude-sonnet-4-6'
  | 'gemini-2.5-flash'
  | 'gemini-3.1-pro'
  | 'gemini-3.1-pro-preview';

let migrationChecked = false;

/**
 * Run legacy-value migration once per page load. Idempotent across calls.
 * Cheap: short-circuits after the first invocation via module-level flag.
 */
function ensureMigration(): void {
  if (migrationChecked) return;
  migrationChecked = true;

  try {
    if (typeof localStorage === 'undefined') return;

    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return;

    // 'claude-haiku-4-5-20251001' is removed entirely — always reset.
    if (stored === 'claude-haiku-4-5-20251001') {
      localStorage.setItem(LS_KEY, 'default');
      localStorage.setItem(LS_LAST_CHANGED_KEY, String(Date.now()));
      // eslint-disable-next-line no-console
      console.info(`[resolveMeetingModel] Migrated stale '${stored}' → 'default'`);
      return;
    }

    // Stale Sonnet: only reset if user has not deliberately chosen recently.
    if (stored === 'claude-sonnet-4-6') {
      const lastChanged = parseInt(localStorage.getItem(LS_LAST_CHANGED_KEY) || '0', 10);
      const isStale = !lastChanged || (Date.now() - lastChanged) > THIRTY_DAYS_MS;
      if (isStale) {
        localStorage.setItem(LS_KEY, 'default');
        localStorage.setItem(LS_LAST_CHANGED_KEY, String(Date.now()));
        // eslint-disable-next-line no-console
        console.info(`[resolveMeetingModel] Migrated stale '${stored}' → 'default'`);
      }
    }
  } catch {
    // localStorage can throw in private/SSR contexts — ignore.
  }
}

/**
 * @param explicit  Optional override from a UI menu (e.g. the regenerate dropdown).
 *                  When provided, takes precedence over the saved Settings preference.
 *                  When omitted, falls back to localStorage 'meeting-regenerate-llm'.
 */
export function resolveMeetingModel(
  explicit?: RegenerateModel | string
): string | undefined {
  ensureMigration();

  const raw = (explicit ?? readStoredPreference() ?? '').trim();

  if (!raw || raw === 'default') return undefined;
  if (raw === 'sonnet-4.6') return 'claude-sonnet-4-6';
  if (raw === 'claude-haiku-4-5-20251001') return undefined; // removed option
  return raw;
}

/**
 * Convenience for `supabase.functions.invoke` body construction.
 * Spreads `{ modelOverride }` ONLY when the helper returns a defined value,
 * so a clean undefined is never serialised as `{ modelOverride: undefined }`.
 *
 *   body: { meetingId, ...modelOverrideField() }
 *   body: { meetingId, ...modelOverrideField(menuChoice) }
 */
export function modelOverrideField(
  explicit?: RegenerateModel | string
): { modelOverride?: string } {
  const m = resolveMeetingModel(explicit);
  return m ? { modelOverride: m } : {};
}

function readStoredPreference(): string | null {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(LS_KEY)
      : null;
  } catch {
    return null;
  }
}
