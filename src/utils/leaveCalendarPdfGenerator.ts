import { jsPDF } from 'jspdf';

interface LeaveEntry {
  date: string;
  endDate?: string;
  duration: 'All day' | 'Morning' | 'Afternoon' | 'PM';
  type: string;
  year: number;
  month: string;
}

interface ParsedLeaveData {
  name: string;
  entries: LeaveEntry[];
  years: number[];
}

/**
 * Detects if content contains leave/holiday calendar data
 */
export function detectLeaveCalendarData(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  // Must have leave-related keywords
  const hasLeaveKeywords = 
    lowerContent.includes('holiday') ||
    lowerContent.includes('leave') ||
    lowerContent.includes('annual leave') ||
    lowerContent.includes('day off');
  
  // Must have date patterns
  const datePatterns = [
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
    /\b(mon|tue|wed|thu|fri|sat|sun)\s+\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
    /\ball\s+day\b/i,
    /\bmorning\b/i,
    /\bafternoon\b/i,
  ];
  
  const hasDatePatterns = datePatterns.filter(p => p.test(content)).length >= 2;
  
  // Must have multiple entries (at least 3 bullet points or date lines)
  const bulletCount = (content.match(/^[•\-\*]\s/gm) || []).length;
  const hasMultipleEntries = bulletCount >= 3;
  
  return hasLeaveKeywords && hasDatePatterns && hasMultipleEntries;
}

/**
 * Parses leave calendar content into structured data
 */
export function parseLeaveCalendarContent(content: string): ParsedLeaveData {
  const lines = content.split('\n');
  const entries: LeaveEntry[] = [];
  let currentYear = new Date().getFullYear();
  let currentMonth = '';
  let name = 'Staff Member';
  
  // Try to extract name from title
  const nameMatch = content.match(/leave\s+calendar\s+for\s+([^\n]+)/i) ||
                    content.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)(?:'s)?\s+leave/i);
  if (nameMatch) {
    name = nameMatch[1].trim();
  }
  
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                  'july', 'august', 'september', 'october', 'november', 'december'];
  const monthAbbrev = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for year
    const yearMatch = trimmedLine.match(/^(20\d{2})$/);
    if (yearMatch) {
      currentYear = parseInt(yearMatch[1]);
      continue;
    }
    
    // Check for month header
    const monthHeaderMatch = trimmedLine.match(/^[•\-\*]?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*$/i);
    if (monthHeaderMatch) {
      currentMonth = monthHeaderMatch[1].toLowerCase();
      continue;
    }
    
    // Parse date entries
    // Pattern: "Fri 27 Jan: All day (Holiday)" or "Tue 28 Feb - Fri 03 Mar: All day (Holiday)"
    const rangeMatch = trimmedLine.match(/[•\-\*]?\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{4}))?\s*[-–]\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{4}))?[:\s]+(.+)/i);
    
    if (rangeMatch) {
      const startDay = rangeMatch[1];
      const startMonth = rangeMatch[2].toLowerCase();
      const startYear = rangeMatch[3] ? parseInt(rangeMatch[3]) : currentYear;
      const endDay = rangeMatch[4];
      const endMonth = rangeMatch[5].toLowerCase();
      const endYear = rangeMatch[6] ? parseInt(rangeMatch[6]) : currentYear;
      const details = rangeMatch[7];
      
      const duration = details.toLowerCase().includes('morning') ? 'Morning' :
                      details.toLowerCase().includes('afternoon') || details.toLowerCase().includes('pm') ? 'Afternoon' :
                      'All day';
      
      entries.push({
        date: `${startDay} ${startMonth.charAt(0).toUpperCase() + startMonth.slice(1)}`,
        endDate: `${endDay} ${endMonth.charAt(0).toUpperCase() + endMonth.slice(1)}${endYear !== startYear ? ' ' + endYear : ''}`,
        duration,
        type: 'Holiday',
        year: startYear,
        month: startMonth
      });
      continue;
    }
    
    // Single date pattern: "Fri 27 Jan: All day (Holiday)"
    const singleMatch = trimmedLine.match(/[•\-\*]?\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{4}))?[:\s]+(.+)/i);
    
    if (singleMatch) {
      const day = singleMatch[1];
      const month = singleMatch[2].toLowerCase();
      const year = singleMatch[3] ? parseInt(singleMatch[3]) : currentYear;
      const details = singleMatch[4];
      
      const duration = details.toLowerCase().includes('morning') ? 'Morning' :
                      details.toLowerCase().includes('afternoon') || details.toLowerCase().includes('pm') ? 'Afternoon' :
                      'All day';
      
      entries.push({
        date: `${day} ${month.charAt(0).toUpperCase() + month.slice(1)}`,
        duration,
        type: 'Holiday',
        year,
        month
      });
    }
  }
  
  const years = [...new Set(entries.map(e => e.year))].sort();
  
  return { name, entries, years };
}

/**
 * Generates a PDF calendar from leave data
 */
export function generateLeaveCalendarPdf(content: string): void {
  const data = parseLeaveCalendarContent(content);
  
  if (data.entries.length === 0) {
    throw new Error('No leave entries found in content');
  }
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;
  
  // NHS Blue colour
  const nhsBlue = { r: 0, g: 94, b: 184 };
  
  // Header
  doc.setFillColor(nhsBlue.r, nhsBlue.g, nhsBlue.b);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Leave Calendar`, margin, 15);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(data.name, margin, 25);
  
  doc.setFontSize(10);
  const yearRange = data.years.length > 1 
    ? `${data.years[0]} - ${data.years[data.years.length - 1]}`
    : `${data.years[0]}`;
  doc.text(yearRange, pageWidth - margin - doc.getTextWidth(yearRange), 25);
  
  yPos = 45;
  
  // Group entries by year and month
  const entriesByYear = new Map<number, Map<string, LeaveEntry[]>>();
  
  for (const entry of data.entries) {
    if (!entriesByYear.has(entry.year)) {
      entriesByYear.set(entry.year, new Map());
    }
    const yearMap = entriesByYear.get(entry.year)!;
    if (!yearMap.has(entry.month)) {
      yearMap.set(entry.month, []);
    }
    yearMap.get(entry.month)!.push(entry);
  }
  
  const monthOrder = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthNames: Record<string, string> = {
    jan: 'January', feb: 'February', mar: 'March', apr: 'April',
    may: 'May', jun: 'June', jul: 'July', aug: 'August',
    sep: 'September', oct: 'October', nov: 'November', dec: 'December'
  };
  
  doc.setTextColor(0, 0, 0);
  
  for (const year of data.years) {
    // Year header
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFillColor(nhsBlue.r, nhsBlue.g, nhsBlue.b);
    doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(String(year), margin + 3, yPos + 1);
    yPos += 10;
    
    const yearEntries = entriesByYear.get(year);
    if (!yearEntries) continue;
    
    // Sort months
    const sortedMonths = [...yearEntries.keys()].sort((a, b) => 
      monthOrder.indexOf(a) - monthOrder.indexOf(b)
    );
    
    for (const month of sortedMonths) {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }
      
      // Month header
      doc.setTextColor(nhsBlue.r, nhsBlue.g, nhsBlue.b);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(monthNames[month] || month, margin, yPos);
      yPos += 6;
      
      const monthEntries = yearEntries.get(month)!;
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      for (const entry of monthEntries) {
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = margin;
        }
        
        // Duration colour coding
        if (entry.duration === 'All day') {
          doc.setFillColor(0, 94, 184); // NHS Blue
        } else if (entry.duration === 'Morning') {
          doc.setFillColor(255, 206, 86); // Yellow
        } else {
          doc.setFillColor(255, 159, 64); // Orange
        }
        
        doc.circle(margin + 2, yPos - 1.5, 2, 'F');
        
        const dateText = entry.endDate 
          ? `${entry.date} - ${entry.endDate}`
          : entry.date;
        
        doc.text(`${dateText}: ${entry.duration}`, margin + 8, yPos);
        yPos += 5;
      }
      
      yPos += 3;
    }
    
    yPos += 5;
  }
  
  // Footer
  const footerY = pageHeight - 10;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')}`, margin, footerY);
  doc.text('AI 4 GP Service', pageWidth - margin - doc.getTextWidth('AI 4 GP Service'), footerY);
  
  // Save
  const fileName = `Leave_Calendar_${data.name.replace(/\s+/g, '_')}_${data.years.join('-')}.pdf`;
  doc.save(fileName);
}
