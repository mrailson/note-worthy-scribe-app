// cleanBNFOutput.ts

export function cleanBNFOutput(output: string): string {
  // 1. Strip out incorrect traffic light tags (Green, Red, Double Red, Amber, emojis)
  let cleaned = output
    .replace(/\b(Green|Red|Double Red|Amber)\b/gi, "")
    .replace(/🟢|🔴|🟠/g, "")
    .replace(/\s{2,}/g, " ")   // collapse multiple spaces
    .trim();

  // 2. Add Northamptonshire ICB formulary link if model advises to "check local formulary"
  const LINK_LINE = `Northamptonshire ICB Medicines Optimisation: https://www.icnorthamptonshire.org.uk/pcp-medicines-optimisation`;

  const formularyVariants = [
    /check (with|the)\s+(your\s+)?local\s+fo?r?m(u|o)lary/i,
    /refer\s+to\s+(the\s+)?local\s+fo?r?m(u|o)lary/i,
    /consult\s+(the\s+)?local\s+fo?r?m(u|o)lary/i,
    /local\s+fo?r?m(u|o)lary\s+guidance/i
  ];

  const needsLink = formularyVariants.some(rx => rx.test(output));

  if (needsLink && !cleaned.includes(LINK_LINE)) {
    cleaned += `\n\n🔗 ${LINK_LINE}`;
  }

  return cleaned;
}