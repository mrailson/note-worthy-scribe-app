// Utility to extract attendees from meeting content in multiple common formats
export const extractAttendees = (content: string): string => {
  const cleanupItems = (items: string[]) => {
    const cleaned = items
      .map((l) => l.trim())
      .filter((l) => l && !/^---.*---$/i.test(l) && !/^[-_]{2,}$/i.test(l))
      .map((l) => l.replace(/^[-•*]\s*/, '')) // bullets
      .map((l) => l.replace(/^\d+[)\.]\s*/, '')) // numbered
      .map((l) => l.replace(/\b(Unverified|Unconfirmed)\b/gi, '').replace(/\(\s*Unverified\s*\)/gi, '').trim())
      .filter((l) => l.length > 0);

    // de-duplicate while preserving order
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const it of cleaned) {
      const key = it.toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(it); }
    }
    return unique;
  };

  // 1) Single-line label (e.g., "Attendees: A, B; C")
  const singleLine = content.match(/^\s*(Attendee(?:s|\(s\))?|Attendees|Participants|Present|In attendance|Attendance)\s*:\s*(.+)$/im);
  if (singleLine) {
    const raw = singleLine[2];
    const items = raw.split(/\s*(?:,|;|•| and )\s*/i).filter(Boolean);
    return cleanupItems(items).join(', ');
  }

  // 2) Section header then list
  const headerRegex = /^\s*(ATTENDEE LIST|Attendee(?:s|\(s\))?|Attendees?|Participants|Attendance|In attendance|Present)\s*(?:List)?\s*:??\s*$/im;
  const headerMatch = headerRegex.exec(content);
  if (headerMatch) {
    const start = headerMatch.index + headerMatch[0].length;
    const tail = content.slice(start);
    // Stop at next heading, markdown header, or divider/image marker
    const boundaryRegex = /^(?:\s*(?:#|##)\s+.+|[A-Z][A-Z\s&\/-]{2,}:?\s*$|---.*---\s*$)/m;
    const boundary = boundaryRegex.exec(tail);
    const section = boundary ? tail.slice(0, boundary.index) : tail;

    const lines = section.split(/\r?\n/);
    const items = cleanupItems(lines);
    if (items.length) return items.join(', ');
  }

  return '';
};