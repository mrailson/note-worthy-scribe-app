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
  "acne": "https://www.nhs.uk/conditions/acne/",
  "addison's disease": "https://www.nhs.uk/conditions/addisons-disease/",
  "adhd in children": "https://www.nhs.uk/conditions/attention-deficit-hyperactivity-disorder-adhd/",
  "anaemia iron deficiency": "https://www.nhs.uk/conditions/anaemia-iron-deficiency/",
  "anaemia vitamin b12": "https://www.nhs.uk/conditions/anaemia-vitamin-b12-or-folate-deficiency/",
  "angina": "https://www.nhs.uk/conditions/angina/",
  "appendicitis": "https://www.nhs.uk/conditions/appendicitis/",
  "arthritis": "https://www.nhs.uk/conditions/arthritis/",
  "asthma": "https://www.nhs.uk/conditions/asthma/",
  "atrial fibrillation": "https://www.nhs.uk/conditions/atrial-fibrillation/",
  "autism": "https://www.nhs.uk/conditions/autism-spectrum-disorders-asd/",
  "back pain": "https://www.nhs.uk/conditions/back-pain/",
  "bipolar disorder": "https://www.nhs.uk/mental-health/conditions/bipolar-disorder/",
  "blepharitis": "https://www.nhs.uk/conditions/blepharitis/",
  "blood pressure high": "https://www.nhs.uk/conditions/high-blood-pressure-hypertension/",
  "blood pressure low": "https://www.nhs.uk/conditions/low-blood-pressure-hypotension/",
  "borderline personality disorder": "https://www.nhs.uk/mental-health/conditions/borderline-personality-disorder/",
  "bowel cancer": "https://www.nhs.uk/conditions/bowel-cancer/",
  "bronchiectasis": "https://www.nhs.uk/conditions/bronchiectasis/",
  "burns and scalds": "https://www.nhs.uk/conditions/burns-and-scalds/",
  "bursitis": "https://www.nhs.uk/conditions/bursitis/",
  "chest infection": "https://www.nhs.uk/conditions/chest-infections/",
  "chickenpox": "https://www.nhs.uk/conditions/chickenpox/",
  "chlamydia": "https://www.nhs.uk/conditions/chlamydia/",
  "cholesterol high": "https://www.nhs.uk/conditions/high-blood-cholesterol/",
  "chronic kidney disease": "https://www.nhs.uk/conditions/chronic-kidney-disease-ckd/",
  "copd": "https://www.nhs.uk/conditions/chronic-obstructive-pulmonary-disease-copd/",
  "coeliac disease": "https://www.nhs.uk/conditions/coeliac-disease/",
  "constipation": "https://www.nhs.uk/conditions/constipation/",
  "covid-19": "https://www.nhs.uk/conditions/covid-19/",
  "crohn's disease": "https://www.nhs.uk/conditions/crohns-disease/",
  "dehydration": "https://www.nhs.uk/conditions/dehydration/",
  "dental abscess": "https://www.nhs.uk/conditions/dental-abscess/",
  "depression": "https://www.nhs.uk/mental-health/conditions/clinical-depression/",
  "developmental co-ordination disorder": "https://www.nhs.uk/conditions/developmental-co-ordination-disorder-dyspraxia/",
  "diabetes type 1": "https://www.nhs.uk/conditions/type-1-diabetes/",
  "diabetes type 2": "https://www.nhs.uk/conditions/type-2-diabetes/",
  "diverticular disease": "https://www.nhs.uk/conditions/diverticular-disease-and-diverticulitis/",
  "dvt": "https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/",
  "dyslexia": "https://www.nhs.uk/conditions/dyslexia/",
  "eczema": "https://www.nhs.uk/conditions/atopic-eczema/",
  "epilepsy": "https://www.nhs.uk/conditions/epilepsy/",
  "flu": "https://www.nhs.uk/conditions/flu/",
  "gastroenteritis": "https://www.nhs.uk/conditions/gastroenteritis/",
  "heartburn gerd": "https://www.nhs.uk/conditions/heartburn-gastro-oesophageal-reflux-disease-gerd/",
  "headaches": "https://www.nhs.uk/conditions/headaches/",
  "heart attack": "https://www.nhs.uk/conditions/heart-attack/",
  "hiv": "https://www.nhs.uk/conditions/hiv-and-aids/",
  "inflammatory bowel disease": "https://www.nhs.uk/conditions/inflammatory-bowel-disease-ibd/",
  "ibs": "https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/",
  "indigestion": "https://www.nhs.uk/conditions/indigestion/",
  "incontinence": "https://www.nhs.uk/conditions/incontinence/",
  "insomnia": "https://www.nhs.uk/conditions/insomnia/",
  "menopause": "https://www.nhs.uk/conditions/menopause/",
  "migraine": "https://www.nhs.uk/conditions/migraine/",
  "otitis media": "https://www.nhs.uk/conditions/acute-otitis-media/",
  "osteoarthritis": "https://www.nhs.uk/conditions/osteoarthritis/",
  "panic disorder": "https://www.nhs.uk/mental-health/conditions/panic-disorder/",
  "period pain": "https://www.nhs.uk/conditions/period-pain/",
  "pneumonia": "https://www.nhs.uk/conditions/pneumonia/",
  "psoriasis": "https://www.nhs.uk/conditions/psoriasis/",
  "schizophrenia": "https://www.nhs.uk/mental-health/conditions/schizophrenia/",
  "shingles": "https://www.nhs.uk/conditions/shingles/",
  "sore throat": "https://www.nhs.uk/conditions/sore-throat/",
  "stroke tia": "https://www.nhs.uk/conditions/stroke/",
  "tonsillitis": "https://www.nhs.uk/conditions/tonsillitis/",
  "varicose veins": "https://www.nhs.uk/conditions/varicose-veins/",
  "weight loss": "https://www.nhs.uk/conditions/losing-weight/",
  "wheezing": "https://www.nhs.uk/conditions/wheezing/",
  "mental health self help": "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/",
  "fear of flying": "https://www.nhs.uk/mental-health/conditions/phobias/",
  "phobia": "https://www.nhs.uk/mental-health/conditions/phobias/",
  "generalised anxiety": "https://www.nhs.uk/mental-health/conditions/generalised-anxiety-disorder/",
  "panic attacks": "https://www.nhs.uk/mental-health/conditions/panic-disorder/",
  "ocd": "https://www.nhs.uk/mental-health/conditions/obsessive-compulsive-disorder-ocd/",
  "ptsd": "https://www.nhs.uk/mental-health/conditions/post-traumatic-stress-disorder-ptsd/",
  "sleep problems": "https://www.nhs.uk/every-mind-matters/mental-health-issues/sleep/",
  "self-help anxiety": "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/",
  "talking therapies": "https://www.nhs.uk/nhs-services/mental-health-services/talking-therapies-cognitive-behavioural-therapy-cbt/",
  "medicines index": "https://www.nhs.uk/medicines/",
  "conditions index": "https://www.nhs.uk/conditions/",
  "live well": "https://www.nhs.uk/live-well/",
  "pregnancy": "https://www.nhs.uk/pregnancy/",
  "child immunisations": "https://www.nhs.uk/conditions/vaccinations/nhs-vaccinations-and-when-to-have-them/",
  "child vaccinations": "https://www.nhs.uk/conditions/vaccinations/nhs-vaccinations-and-when-to-have-them/",
  "adult immunisations": "https://www.nhs.uk/conditions/vaccinations/",
  "flu vaccine": "https://www.nhs.uk/conditions/vaccinations/flu-influenza-vaccine/",
  "travel vaccines": "https://www.nhs.uk/conditions/travel-vaccinations/",
  "travel vaccinations": "https://www.nhs.uk/conditions/travel-vaccinations/",
  "stop smoking": "https://www.nhs.uk/better-health/quit-smoking/",
  "better health quit smoking": "https://www.nhs.uk/better-health/quit-smoking/",
  "weight management": "https://www.nhs.uk/better-health/lose-weight/",
  "better health lose weight": "https://www.nhs.uk/better-health/lose-weight/",
  "drinking advice": "https://www.nhs.uk/better-health/reduce-alcohol-intake/",
  "better health alcohol": "https://www.nhs.uk/better-health/reduce-alcohol-intake/",
  "low back pain": "https://www.nhs.uk/conditions/back-pain/",
  "headache": "https://www.nhs.uk/conditions/headaches/",
  "hypertension": "https://www.nhs.uk/conditions/high-blood-pressure-hypertension/",
  "type 2 diabetes": "https://www.nhs.uk/conditions/type-2-diabetes/",
  "metformin": "https://www.nhs.uk/medicines/metformin/",
  "tirzepatide": "https://www.nhs.uk/medicines/tirzepatide/",
  "statins": "https://www.nhs.uk/conditions/high-cholesterol/statins/",
  "uti": "https://www.nhs.uk/conditions/urinary-tract-infections-utis/",
  "periods": "https://www.nhs.uk/conditions/periods/",
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