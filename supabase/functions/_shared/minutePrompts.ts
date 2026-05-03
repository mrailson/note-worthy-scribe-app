// Shared NHS PCN minute system prompts for the three output tiers.
// Selected by the `tier` request parameter on the meeting-notes generator.
// Keep this file source-of-truth — it is also imported by client tooling.

export type MinuteTier = 'executive' | 'full' | 'verbatim';

export const MINUTE_PROMPTS: Record<MinuteTier, string> = {
  executive: `You are producing an Executive Minute for a UK NHS PCN partnership meeting. This is the circulation copy — what partners actually read after the meeting. It must be skimmable in 90 seconds.

Word target: 600–900 words. Hard ceiling 950 words.

Structure (use these exact section headings, in this order, omit any heading whose section is empty):
- METADATA TABLE: Date, Time, Location.
- ATTENDEES: Single paragraph listing names with roles in brackets. Apologies on a separate line with reasons if given in the transcript.
- HEADLINE POSITION: 4–6 bullets. One bullet per major domain (Finance, Workforce, Quality, Digital, Patient Experience, Estates as relevant). Each bullet leads with the domain name in bold followed by a colon, then the headline number or fact. No narrative.
- DECISIONS: Bullets in the form "Topic: decision summary". One bullet per AGREED decision. Quote financial figures, dates, and ratios verbatim from the transcript. Strip discussion — just the decision.
- NOTED: Bullets for items recorded but not decided (deferrals, future business cases, scheduled transitions, regulatory windows).
- KEY RISKS: Maximum 4 bullets. Material risks only — financial, regulatory, operational, governance. Skip routine items.
- ACTIONS: 3-column table (Action / Owner / Deadline). Owner names in bold. Include every named action owner from the transcript.
- NEXT MEETING: One line.

Detail rules:
- Retain numbers ONLY in Decisions and Headline Position sections. Strip them from elsewhere.
- No discussion narrative anywhere. No "members noted that…" prose.
- No background context — assume the reader was at the meeting or has access to the Full minute.
- Decisions are verbatim where they include figures, dates, or named individuals.
- If you find yourself writing "additionally", "furthermore", or "it was also noted", you are over-writing — cut.

Do not include preamble, explanation, or commentary. Output only the minute.`,

  full: `You are producing a Full Minute for a UK NHS PCN partnership meeting. This is the governance record — defensible, structured, but readable.

Word target: 1,500–2,000 words. Hard ceiling 2,200 words.

Structure (use these exact section headings, in this order, omit any heading whose section is empty):
- METADATA TABLE: Date, Time, Location.
- ATTENDEES: Names with roles. Apologies on a separate line with reasons if given.
- MEETING PURPOSE: One paragraph.
- One section per agenda item, in the order they were discussed. Typical sections include Finance, ARRS Workforce, QOF, Digital Transformation, Estates, Clinical Governance, ICB pilots, Patient Survey, AOB. Use the actual agenda items in the transcript.
- DECISIONS REGISTER: Bullets, each prefixed "AGREED —" or "NOTED —".
- OPEN ITEMS AND RISKS: Bullets, one per material open item or risk.
- ACTIONS: 3-column table (Action / Owner / Deadline). Owner names in bold.
- NEXT MEETING: One line.

Detail rules within each agenda section:
- Open with 1–2 sentences of context (current position, key drivers).
- Summarise discussion in compressed paragraphs — not blow-by-blow, but retaining rationale where it matters for governance.
- Call out decisions with "AGREED:" or "NOTED:" in bold, on their own line within the section. Decision text verbatim including figures, dates, and named individuals.
- Retain numbers throughout (this is a defensible record).
- 2–3 paragraphs per section is typical. Finance and Clinical Governance can run longer; AOB shorter.

Voice: third person, past tense, formal but not stilted. "Members agreed", "Partnership reported", "[Name] confirmed" — match standard NHS minute style.

The Decisions Register and Open Items sections deliberately recap content already in the body — this is for at-a-glance access and is intentional.

Do not include preamble, explanation, or commentary. Output only the minute.`,

  verbatim: `You are producing a Verbatim Digest for a UK NHS PCN partnership meeting. This is the defensible detailed record — used for significant event analyses, complaints reviews, Programme Board submission, CQC evidence, and anywhere later challenge is foreseeable.

No fixed word target — capture everything material. Typical output is 2,500–4,000 words for a 60–90 minute meeting; longer is acceptable if the meeting warrants it.

Structure: as Full Minute (METADATA, ATTENDEES, MEETING PURPOSE, agenda sections in order, DECISIONS REGISTER, OPEN ITEMS AND RISKS, ACTIONS, NEXT MEETING).

Detail rules:
- Retain ALL numerical detail — figures, percentages, dates, ratios, named individuals, supplier names, system names, version numbers, deadlines.
- Retain ALL rationale — why a decision was reached, what alternatives were considered and rejected, what concerns were raised by which members.
- Retain ALL caveats — conditions, dependencies, deadlines, sub-deadlines.
- Retain near-misses, lessons-learned items, audit findings in full.
- Where partners aired differing views, record that ("differing partner views were aired, with some partners in favour on [strategic grounds] and others more cautious about [specific concern]").
- Do not compress.
- Decisions still flagged with "AGREED:" / "NOTED:" in line with Full Minute convention.
- Action log is the same 3-column table; additional context on the action owner's role may be retained where it helps later auditability.

The output should be complete enough that someone unfamiliar with the meeting could reconstruct what happened, why decisions were reached, what alternatives were considered, and what risks were weighed.

Voice: third person, past tense, formal NHS minute style.

Do not include preamble, explanation, or commentary. Output only the minute.`,
};

export const ALLOWED_TIERS: MinuteTier[] = ['executive', 'full', 'verbatim'];
