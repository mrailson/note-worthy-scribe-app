export class TextProcessor {
  static async extractText(file: File): Promise<string> {
    try {
      const text = await file.text();
      
      if (text && text.trim().length > 0) {
        return `TEXT FILE CONTENT FROM: ${file.name}

${text.trim()}

[Plain text file]`;
      }
      
      throw new Error('No text content found in file');
    } catch (error) {
      console.error('Text processing error:', error);
      throw new Error(`Failed to process text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async extractEmailContent(file: File): Promise<string> {
    try {
      const text = await file.text();
      
      if (!text || text.trim().length === 0) {
        throw new Error('No email content found in file');
      }

      // Parse email headers and content
      const emailData = this.parseEmailContent(text);
      
      return `EMAIL MESSAGE FROM: ${file.name}

${emailData.formattedContent}

[Email file - ${file.name.split('.').pop()?.toUpperCase()} format]`;
    } catch (error) {
      console.error('Email processing error:', error);
      throw new Error(`Failed to process email file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async extractCalendarContent(file: File): Promise<string> {
    try {
      const text = await file.text();
      
      if (!text || text.trim().length === 0) {
        throw new Error('No calendar content found in file');
      }

      // Parse calendar content
      const calendarData = this.parseCalendarContent(text);
      
      return `CALENDAR EVENT FROM: ${file.name}

${calendarData.formattedContent}

[Calendar file - ${file.name.split('.').pop()?.toUpperCase()} format]`;
    } catch (error) {
      console.error('Calendar processing error:', error);
      throw new Error(`Failed to process calendar file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static parseEmailContent(content: string): { formattedContent: string } {
    const lines = content.split('\n');
    const headers: Record<string, string> = {};
    let bodyStartIndex = 0;
    let inHeaders = true;

    // Parse headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (inHeaders && line.trim() === '') {
        bodyStartIndex = i + 1;
        inHeaders = false;
        break;
      }
      
      if (inHeaders && line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const headerName = line.substring(0, colonIndex).trim();
        const headerValue = line.substring(colonIndex + 1).trim();
        headers[headerName.toLowerCase()] = headerValue;
      }
    }

    // Extract body
    const body = lines.slice(bodyStartIndex).join('\n').trim();

    // Format the email content
    let formattedContent = '';
    
    if (headers.from) formattedContent += `From: ${headers.from}\n`;
    if (headers.to) formattedContent += `To: ${headers.to}\n`;
    if (headers.cc) formattedContent += `CC: ${headers.cc}\n`;
    if (headers.bcc) formattedContent += `BCC: ${headers.bcc}\n`;
    if (headers.subject) formattedContent += `Subject: ${headers.subject}\n`;
    if (headers.date) formattedContent += `Date: ${headers.date}\n`;
    
    formattedContent += '\n--- EMAIL BODY ---\n';
    formattedContent += body;

    return { formattedContent };
  }

  private static parseCalendarContent(content: string): { formattedContent: string } {
    const lines = content.split('\n');
    const events: Array<Record<string, string>> = [];
    let currentEvent: Record<string, string> = {};
    let inEvent = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {};
      } else if (trimmedLine === 'END:VEVENT') {
        inEvent = false;
        if (Object.keys(currentEvent).length > 0) {
          events.push(currentEvent);
        }
      } else if (inEvent && trimmedLine.includes(':')) {
        const colonIndex = trimmedLine.indexOf(':');
        const prop = trimmedLine.substring(0, colonIndex);
        const value = trimmedLine.substring(colonIndex + 1);
        currentEvent[prop.toLowerCase()] = value;
      }
    }

    let formattedContent = '';

    if (events.length > 0) {
      events.forEach((event, index) => {
        if (index > 0) formattedContent += '\n---\n\n';
        
        if (event.summary) formattedContent += `Event: ${event.summary}\n`;
        if (event.dtstart) {
          const startDate = this.formatCalendarDate(event.dtstart);
          formattedContent += `Start: ${startDate}\n`;
        }
        if (event.dtend) {
          const endDate = this.formatCalendarDate(event.dtend);
          formattedContent += `End: ${endDate}\n`;
        }
        if (event.location) formattedContent += `Location: ${event.location}\n`;
        if (event.description) formattedContent += `Description: ${event.description}\n`;
        if (event.organizer) {
          const organizer = event.organizer.replace('MAILTO:', '');
          formattedContent += `Organizer: ${organizer}\n`;
        }
        
        // Parse attendees
        Object.keys(event).forEach(key => {
          if (key.startsWith('attendee')) {
            const attendee = event[key].replace('MAILTO:', '');
            formattedContent += `Attendee: ${attendee}\n`;
          }
        });

        // Check for Teams meeting info
        if (event.description && event.description.includes('teams.microsoft.com')) {
          formattedContent += `\n🎥 Teams Meeting Detected\n`;
        }
      });
    } else {
      // Fallback for non-standard calendar formats
      formattedContent = content;
    }

    return { formattedContent };
  }

  private static formatCalendarDate(dateString: string): string {
    // Handle different date formats in calendar files
    if (dateString.includes('T')) {
      // ISO format with time
      const date = new Date(dateString.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
      return date.toLocaleString();
    } else if (dateString.length === 8) {
      // YYYYMMDD format
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return new Date(`${year}-${month}-${day}`).toLocaleDateString();
    }
    
    return dateString;
  }
}