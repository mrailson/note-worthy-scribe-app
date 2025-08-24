/**
 * NHS-only URL validation and mapping system
 * Prevents invented URLs and ensures only approved NHS sources are used
 */

export const URL_WHITELIST_DOMAINS = [
  "https://www.nhs.uk",
  "https://www.england.nhs.uk",
  "https://www.nhs.uk/medicines",
  "https://www.nhs.uk/conditions", 
  "https://www.nhs.uk/live-well",
  "https://www.nhs.uk/mental-health",
  "https://www.nhs.uk/pregnancy",
  "https://www.nhs.uk/nhs-services",
  "https://www.nhs.uk/service-search",
  "https://www.nhs.uk/every-mind-matters",
  "https://www.nice.org.uk",
  "https://bnf.nice.org.uk",
  "https://bnfc.nice.org.uk",
  "https://www.gov.uk",
  "https://www.gov.uk/government/collections/drug-safety-update",
  "https://www.gov.uk/government/collections/immunisation-against-infectious-disease-the-green-book",
  "https://www.gov.uk/drug-device-alerts",
  "https://www.ukhsa.blog.gov.uk",
  "https://ukhsa.blog.gov.uk",
  "https://www.northamptonshire.gov.uk",
  "https://www.icnorthamptonshire.org.uk",
  "https://www.nhft.nhs.uk",
  "https://www.kgh.nhs.uk",
  "https://www.northamptongeneral.nhs.uk"
];

export const URL_MAP: Record<string, string> = {
  "fear of flying": "https://www.nhs.uk/mental-health/conditions/phobias/",
  "phobia": "https://www.nhs.uk/mental-health/conditions/phobias/",
  "generalised anxiety": "https://www.nhs.uk/mental-health/conditions/generalised-anxiety-disorder/",
  "panic attacks": "https://www.nhs.uk/mental-health/conditions/panic-disorder/",
  "depression": "https://www.nhs.uk/mental-health/conditions/clinical-depression/",
  "ocd": "https://www.nhs.uk/mental-health/conditions/obsessive-compulsive-disorder-ocd/",
  "ptsd": "https://www.nhs.uk/mental-health/conditions/post-traumatic-stress-disorder-ptsd/",
  "sleep problems": "https://www.nhs.uk/every-mind-matters/mental-health-issues/sleep/",
  "self-help anxiety": "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/",
  "talking therapies": "https://www.nhs.uk/nhs-services/mental-health-services/talking-therapies-cognitive-behavioural-therapy-cbt/",
  "medicines index": "https://www.nhs.uk/medicines/",
  "conditions index": "https://www.nhs.uk/conditions/",
  "child immunisations": "https://www.nhs.uk/conditions/vaccinations/nhs-vaccinations-and-when-to-have-them/",
  "adult immunisations": "https://www.nhs.uk/conditions/vaccinations/",
  "flu vaccine": "https://www.nhs.uk/conditions/vaccinations/flu-influenza-vaccine/",
  "travel vaccines": "https://www.nhs.uk/conditions/travel-vaccinations/",
  "stop smoking": "https://www.nhs.uk/better-health/quit-smoking/",
  "weight management": "https://www.nhs.uk/better-health/lose-weight/",
  "drinking advice": "https://www.nhs.uk/better-health/reduce-alcohol-intake/",
  "low back pain": "https://www.nhs.uk/conditions/back-pain/",
  "headache": "https://www.nhs.uk/conditions/headaches/",
  "migraine": "https://www.nhs.uk/conditions/migraine/",
  "hypertension": "https://www.nhs.uk/conditions/high-blood-pressure-hypertension/",
  "type 2 diabetes": "https://www.nhs.uk/conditions/type-2-diabetes/",
  "metformin": "https://www.nhs.uk/medicines/metformin/",
  "tirzepatide": "https://www.nhs.uk/medicines/tirzepatide/",
  "statins": "https://www.nhs.uk/conditions/high-cholesterol/statins/",
  "eczema": "https://www.nhs.uk/conditions/atopic-eczema/",
  "asthma": "https://www.nhs.uk/conditions/asthma/",
  "copd": "https://www.nhs.uk/conditions/chronic-obstructive-pulmonary-disease-copd/",
  "uti": "https://www.nhs.uk/conditions/urinary-tract-infections-utis/",
  "periods": "https://www.nhs.uk/conditions/periods/",
  "pregnancy": "https://www.nhs.uk/pregnancy/",
  "contraception": "https://www.nhs.uk/conditions/contraception/",
  "sexual health": "https://www.nhs.uk/live-well/sexual-health/",
  "mental health crisis": "https://www.nhs.uk/nhs-services/mental-health-services/urgent-mental-health-helplines/",
  "111": "https://111.nhs.uk/",
  "find a gp": "https://www.nhs.uk/service-search/find-a-gp"
};

const WHITELIST_HOSTNAMES = [
  "www.nhs.uk",
  "england.nhs.uk",
  "bnf.nice.org.uk",
  "bnfc.nice.org.uk", 
  "www.nice.org.uk",
  "www.gov.uk",
  "www.ukhsa.blog.gov.uk",
  "ukhsa.blog.gov.uk",
  "www.icnorthamptonshire.org.uk",
  "www.nhft.nhs.uk",
  "www.kgh.nhs.uk",
  "www.northamptongeneral.nhs.uk"
];

/**
 * Validates if a URL is from an approved NHS/UK health authority domain
 */
export async function validateUrl(href: string): Promise<{ ok: boolean; reason?: string; status?: number }> {
  try {
    const url = new URL(href);
    
    if (!WHITELIST_HOSTNAMES.includes(url.hostname)) {
      return { ok: false, reason: "not-whitelisted" };
    }

    // Optional: Check if URL actually exists (can be disabled for performance)
    // const res = await fetch(href, { method: "HEAD" });
    // return { ok: res.ok, status: res.status };
    
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid-url" };
  }
}

/**
 * Sanitizes HTML content by removing or replacing non-approved links
 */
export async function sanitizeLinks(html: string, topicFallback: string = "health information"): Promise<string> {
  const aTagRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  const replacements: Array<{ full: string; replacement: string }> = [];
  
  let match;
  while ((match = aTagRegex.exec(html)) !== null) {
    const [fullMatch, href, linkText] = match;
    
    const validation = await validateUrl(href);
    if (!validation.ok) {
      const fallback = `${linkText} (See NHS.uk – search: "${topicFallback}")`;
      replacements.push({ full: fullMatch, replacement: fallback });
    }
  }

  let sanitized = html;
  for (const { full, replacement } of replacements) {
    sanitized = sanitized.replace(full, replacement);
  }

  return sanitized;
}

/**
 * Gets the approved URL for a topic, or returns null if not mapped
 */
export function getTopicUrl(topic: string): string | null {
  const normalizedTopic = topic.toLowerCase().trim();
  return URL_MAP[normalizedTopic] || null;
}

/**
 * NHS-only linking policy for system prompts
 */
export const NHS_LINKING_POLICY = `
LINKING POLICY — NHS-ONLY, NO INVENTED URLS

You must NOT invent or guess URLs. Only include a hyperlink if it exactly matches one of the approved domains and paths in the URL_WHITELIST below, or if it is returned by the app's URL_MAP lookup. If no approved URL exists, write: "See NHS.uk (search term: '<topic>') or speak to your GP." and do not include a hyperlink.

Rules:
- Do not fabricate or "pretty guess" pages (e.g., /conditions/fear-of-flying). 
- Use the URL_MAP value if present for a topic; otherwise select the most relevant path from URL_WHITELIST.
- Never rewrite or alter domain names.
- If a suggested URL returns a non-200 status (checked by the app), remove it and fall back to plain text guidance.

When citing non-link references, prefer NHS.uk text. Only link when you can use an approved URL.

Approved domains: ${WHITELIST_HOSTNAMES.join(", ")}
`;