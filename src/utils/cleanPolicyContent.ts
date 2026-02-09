/**
 * Utility to clean AI-generated policy content before rendering or exporting.
 *
 * Removes two categories of unwanted content:
 * 1. Enhancement meta-commentary appended by the enhance-policy step
 *    (e.g. "CRITICAL COMPLIANCE ENHANCEMENTS MADE", "PRACTICE ACTIONS REQUIRED")
 * 2. Trailing italic disclaimers added by the AI
 */

/**
 * Strip AI enhancement artifacts from the end of policy content.
 *
 * The enhance-policy edge function sometimes appends meta-commentary that is
 * not actual policy content. This function truncates at the earliest known
 * marker and removes trailing disclaimers.
 */
export function cleanEnhancementArtifacts(content: string): string {
  if (!content) return content;

  let cleaned = content;

  // 1. Find the earliest occurrence of any truncation marker and cut there
  const markers: RegExp[] = [
    /^\*{0,2}END OF POLICY\*{0,2}\s*$/m,
    /^\*{0,2}Document End\*{0,2}\s*$/m,
    /^#{1,3}\s*CRITICAL COMPLIANCE ENHANCEMENTS/m,
    /^\*{0,2}CRITICAL COMPLIANCE ENHANCEMENTS/m,
    /^\*{0,2}PRACTICE ACTIONS REQUIRED/m,
  ];

  let earliestIndex = cleaned.length;

  for (const marker of markers) {
    const match = marker.exec(cleaned);
    if (match && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }

  if (earliestIndex < cleaned.length) {
    cleaned = cleaned.slice(0, earliestIndex);
  }

  // 2. Remove trailing italic disclaimer lines
  //    e.g. "*This policy has been enhanced to ensure full CQC regulatory compliance...*"
  cleaned = cleaned.replace(
    /^\*This policy has been (enhanced|developed)[^*]*\*\s*$/gm,
    ''
  );

  // 3. Trim trailing whitespace and horizontal rules
  cleaned = cleaned.replace(/[\s\-_*]+$/, '').trimEnd();

  return cleaned;
}

/**
 * Check whether the AI-generated content already contains a references section.
 * Used to avoid appending a duplicate hardcoded references section.
 */
export function contentHasReferencesSection(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('references and legislation') ||
    lower.includes('references & legislation') ||
    lower.includes('## references') ||
    lower.includes('# references')
  );
}
