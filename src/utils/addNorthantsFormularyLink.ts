// addNorthantsFormularyLink.ts
export function addNorthantsFormularyLink(output: string): string {
  const LINK_LINE = `Northamptonshire ICB Medicines Optimisation: https://www.icnorthamptonshire.org.uk/pcp-medicines-optimisation`;
  
  // Already present?
  if (output.includes(LINK_LINE)) return output;

  // Phrases to look for (case-insensitive)
  const formularyVariants = [
    /check (with|the)\s+(your\s+)?local\s+fo?r?m(u|o)lary/i,
    /refer\s+to\s+(the\s+)?local\s+fo?r?m(u|o)lary/i,
    /consult\s+(the\s+)?local\s+fo?r?m(u|o)lary/i,
    /local\s+fo?r?m(u|o)lary\s+guidance/i,
    /local\s+fo?r?m(u|o)lary/i
  ];

  const found = formularyVariants.some(rx => rx.test(output));

  if (!found) return output;

  // Add a neat Resources line. If output looks like markdown, use a list; else plain text.
  const isMarkdown = /(^|\n)#{1,6}\s|\* |\d+\.\s|```/.test(output);
  const addition = isMarkdown
    ? `\n\n**Resources**\n- ${LINK_LINE}\n`
    : `\n\nResources: ${LINK_LINE}\n`;

  return output.trimEnd() + addition;
}