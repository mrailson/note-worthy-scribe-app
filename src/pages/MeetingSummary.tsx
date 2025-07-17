import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  FileText, 
  CheckCircle, 
  Download, 
  Mail, 
  Edit3, 
  Play, 
  Save,
  FileDown,
  FilePlus2,
  Sparkles,
  Settings,
  ChevronDown,
  RotateCcw,
  Plus,
  X
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { MeetingSettings } from "@/components/MeetingSettings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import jsPDF from "jspdf";
import emailjs from '@emailjs/browser';

interface MeetingData {
  id?: string;
  title: string;
  duration: string;
  wordCount: number;
  transcript: string;
  speakerCount: number;
  startTime: string;
  practiceName?: string;
}

export default function MeetingSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Editable summary content
  const [summaryContent, setSummaryContent] = useState({
    attendees: "",
    agenda: "",
    keyPoints: "",
    decisions: "",
    actionItems: "",
    nextSteps: "",
    additionalNotes: ""
  });
  
  // Email settings
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [attendeeEmails, setAttendeeEmails] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false);
  const [aiGeneratedMinutes, setAiGeneratedMinutes] = useState<string | null>(null);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [editableContent, setEditableContent] = useState<string>("");
  const [countdown, setCountdown] = useState(0);
  const [expectedDuration, setExpectedDuration] = useState(0);
  
  // Detail level and meeting settings
  const [detailLevel, setDetailLevel] = useState<'shorter' | 'standard' | 'detailed' | 'super-detailed'>('standard');
  const [detailLevelValue, setDetailLevelValue] = useState([2]); // 0: shorter, 1: standard, 2: detailed, 3: super-detailed
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState({
    title: "",
    description: "",
    meetingType: "general",
    attendees: "",
    agenda: ""
  });

  // Email modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState(user?.email || "");
  const [additionalEmails, setAdditionalEmails] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [availableAttendees, setAvailableAttendees] = useState<any[]>([]);
  const [includeDocx, setIncludeDocx] = useState(true);
  const [includePdf, setIncludePdf] = useState(false);
  const [includeTranscriptInEmail, setIncludeTranscriptInEmail] = useState(false);

  // Fetch attendees on component mount
  useEffect(() => {
    if (user) {
      fetchAvailableAttendees();
      setUserEmail(user.email || ""); // Update user email when user loads
    }
  }, [user]);

  useEffect(() => {
    const data = location.state as MeetingData & { extractedSettings?: any };
    if (data && !isSaved && !isSaving && !meetingData?.id) {
      setMeetingData(data);
      
      // Initialize meeting settings
      setMeetingSettings({
        title: data.title,
        description: data.extractedSettings?.description || "",
        meetingType: data.extractedSettings?.meetingType || "general",
        attendees: data.extractedSettings?.attendees || "",
        agenda: data.extractedSettings?.agenda || ""
      });
      
      // Auto-populate summary content from imported data
      if (data.extractedSettings) {
        setSummaryContent(prev => ({
          ...prev,
          attendees: data.extractedSettings.attendees || prev.attendees,
          agenda: data.extractedSettings.agenda || prev.agenda,
        }));
      }
      
      saveMeetingToDatabase(data);
    } else if (!data) {
      navigate('/');
    }
  }, [location.state, navigate, isSaved, isSaving, meetingData?.id]);

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGeneratingMinutes && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGeneratingMinutes, countdown]);

  // Calculate expected duration based on word count
  const calculateExpectedDuration = (wordCount: number): number => {
    if (wordCount >= 15000) return 60; // 60 seconds for 15,000+ words
    if (wordCount >= 5000) return 45;  // 45 seconds for 5,000-9,999 words
    return 30; // 30 seconds for less than 5,000 words
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const saveMeetingToDatabase = async (data: MeetingData) => {
    if (isSaving || isSaved) return;
    
    setIsSaving(true);
    try {
      if (!user) throw new Error('User not authenticated');

      // Check if meeting already exists with same start time and user
      const { data: existingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', user.id)
        .eq('start_time', data.startTime)
        .eq('title', data.title)
        .single();

      if (existingMeeting) {
        console.log('Meeting already exists, skipping save');
        setMeetingData(prev => prev ? { ...prev, id: existingMeeting.id } : null);
        setIsSaved(true);
        return;
      }

      // Get default practice name
      let practiceName = "";
      try {
        const { data: practice } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .single();
        practiceName = practice?.practice_name || "";
      } catch (error) {
        // No default practice found
      }

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: data.title,
          user_id: user.id,
          start_time: data.startTime,
          end_time: new Date().toISOString(),
          duration_minutes: Math.floor(parseInt(data.duration.split(':')[0]) + parseInt(data.duration.split(':')[1]) / 60),
          status: 'completed',
          meeting_type: 'consultation'
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      if (data.transcript && meeting) {
        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meeting.id,
            content: data.transcript,
            speaker_name: 'Multiple Speakers',
            timestamp_seconds: 0,
            confidence_score: 0.8
          });

        if (transcriptError) throw transcriptError;
      }

      setMeetingData(prev => prev ? { ...prev, id: meeting.id, practiceName } : null);
      setIsSaved(true);
      
      toast.success("Meeting saved successfully");
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error("Failed to save meeting data");
    } finally {
      setIsSaving(false);
    }
  };

  const continueMeeting = () => {
    navigate('/', { state: { continueMeeting: true, meetingData } });
  };

  // Format content for email with proper HTML formatting
  const formatContentForEmail = (content: string): string => {
    if (!content) return '';
    
    let formatted = content;
    
    // First, replace emojis with text equivalents for email compatibility
    formatted = formatted
      .replace(/1️⃣/g, '1.')
      .replace(/2️⃣/g, '2.')
      .replace(/3️⃣/g, '3.')
      .replace(/4️⃣/g, '4.')
      .replace(/5️⃣/g, '5.')
      .replace(/6️⃣/g, '6.')
      .replace(/7️⃣/g, '7.')
      .replace(/8️⃣/g, '8.')
      .replace(/9️⃣/g, '9.');
    
    // Convert to HTML with proper styling
    formatted = formatted
      // Convert #### headers (level 4) to styled h4
      .replace(/^#### (.*$)/gm, '<h4 style="color: #0066cc; font-size: 16px; font-weight: bold; margin: 15px 0 8px 0; border-bottom: 1px solid #ccc; padding-bottom: 3px;">$1</h4>')
      // Convert ### headers to styled h3
      .replace(/^### (.*$)/gm, '<h3 style="color: #0066cc; font-size: 18px; font-weight: bold; margin: 20px 0 10px 0; border-bottom: 2px solid #0066cc; padding-bottom: 5px;">$1</h3>')
      // Convert ## headers to styled h2  
      .replace(/^## (.*$)/gm, '<h2 style="color: #0066cc; font-size: 20px; font-weight: bold; margin: 25px 0 15px 0;">$1</h2>')
      // Convert # headers to styled h1
      .replace(/^# (.*$)/gm, '<h1 style="color: #0066cc; font-size: 24px; font-weight: bold; margin: 30px 0 20px 0; text-align: center;">$1</h1>')
      // Convert **bold** to HTML bold
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>')
      // Convert *italic* to HTML italic
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');
    
    // Convert markdown tables to HTML tables with improved detection
    const tableRegex = /\|(.+?)\|\s*\n\s*\|[-\s\|:]+\|\s*\n((?:\s*\|.+?\|\s*(?:\n|$))+)/gm;
    formatted = formatted.replace(tableRegex, (match, header, rows) => {
      console.log('Found table:', { header, rows: rows.substring(0, 100) + '...' });
      
      // Process header
      const headerCells = header.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0)
        .map((cell, index) => {
          // Set dynamic widths: Action/Decision (50%), Responsible (25%), Deadline (25%)
          const width = index === 0 ? '50%' : '25%';
          return `<th style="background-color: #0066cc; color: white; padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #ddd; width: ${width};">${cell}</th>`;
        })
        .join('');
      
      // Process rows
      const rowsHtml = rows.trim().split('\n')
        .filter(row => row.trim().length > 0)
        .map(row => {
          const cells = row.split('|')
            .map(cell => cell.trim())
            .filter((cell, index, arr) => index > 0 && index < arr.length - 1) // Remove first and last empty elements
            .filter(cell => cell.length > 0) // Remove empty cells
            .map(cell => `<td style="padding: 10px 8px; border: 1px solid #ddd; line-height: 1.4; vertical-align: top; word-wrap: break-word;">${cell}</td>`)
            .join('');
          return cells ? `<tr>${cells}</tr>` : '';
        })
        .filter(row => row.length > 0)
        .join('');
      
      return `<div style="margin: 20px 0;"><table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; table-layout: fixed;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>`;
    });
    
    // If tables still aren't detected, try a more aggressive approach for action tables
    if (formatted.includes('| Action/Decision') || formatted.includes('|Action/Decision')) {
      console.log('Detected Action/Decision table, applying fallback conversion');
      
      // Find and convert action tables specifically
      const actionTableRegex = /(.*Action\/Decision.*\n[\s\S]*?)(?=\n\n|\n(?:[1-9]️⃣|#{1,4})|$)/g;
      formatted = formatted.replace(actionTableRegex, (match) => {
        if (match.includes('|') && match.includes('Action/Decision')) {
          // Split into lines and process as table
          const lines = match.split('\n').filter(line => line.trim().length > 0);
          const headerLine = lines.find(line => line.includes('Action/Decision'));
          const separatorIndex = lines.findIndex(line => /^\s*\|[-\s\|:]+\|\s*$/.test(line));
          
          if (headerLine && separatorIndex > -1) {
            const dataLines = lines.slice(separatorIndex + 1).filter(line => line.includes('|'));
            
            // Process header
            const headerCells = headerLine.split('|')
              .map(cell => cell.trim())
              .filter(cell => cell.length > 0)
              .map((cell, index) => {
                const width = index === 0 ? '50%' : '25%';
                return `<th style="background-color: #0066cc; color: white; padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #ddd; width: ${width};">${cell}</th>`;
              })
              .join('');
            
            // Process data rows
            const rowsHtml = dataLines
              .map(row => {
                const cells = row.split('|')
                  .map(cell => cell.trim())
                  .filter((cell, index, arr) => index > 0 && index < arr.length - 1)
                  .filter(cell => cell.length > 0)
                  .map(cell => `<td style="padding: 10px 8px; border: 1px solid #ddd; line-height: 1.4; vertical-align: top; word-wrap: break-word;">${cell}</td>`)
                  .join('');
                return cells ? `<tr>${cells}</tr>` : '';
              })
              .filter(row => row.length > 0)
              .join('');
            
            return `<div style="margin: 20px 0;"><table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; table-layout: fixed;">
              <thead><tr>${headerCells}</tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table></div>`;
          }
        }
        return match;
      });
    }
    
    // Handle bullet points properly - group them into proper HTML lists
    const lines = formatted.split('\n');
    let inList = false;
    let processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isBulletPoint = /^[•\-\*] /.test(line);
      
      if (isBulletPoint) {
        if (!inList) {
          processedLines.push('<ul style="margin: 10px 0; padding-left: 20px;">');
          inList = true;
        }
        processedLines.push(`<li style="margin: 5px 0; line-height: 1.4;">${line.replace(/^[•\-\*] /, '')}</li>`);
      } else {
        if (inList) {
          processedLines.push('</ul>');
          inList = false;
        }
        processedLines.push(line);
      }
    }
    
    if (inList) {
      processedLines.push('</ul>');
    }
    
    formatted = processedLines.join('\n');
    
    // Convert remaining line breaks
    formatted = formatted
      .replace(/\n\n/g, '</p><p style="margin: 10px 0; line-height: 1.6;">')
      .replace(/\n/g, '<br />');

    // Wrap in proper HTML structure with NHS styling
    const htmlFormatted = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; line-height: 1.6; color: #333;">
        <div style="background-color: #0066cc; color: white; padding: 20px; text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px;">NHS Meeting Minutes</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Generated by Notewell AI Meeting Service</p>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9; border-left: 4px solid #0066cc; margin-bottom: 20px;">
          <p style="margin: 0;"><strong>Meeting:</strong> ${meetingData?.title || 'General Meeting'}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB')}</p>
          <p style="margin: 5px 0;"><strong>Duration:</strong> ${meetingData?.duration || '00:00'}</p>
          ${meetingData?.practiceName ? `<p style="margin: 5px 0;"><strong>Practice:</strong> ${meetingData.practiceName}</p>` : ''}
        </div>
        
        <div style="padding: 0 20px;">
          <p style="margin: 10px 0; line-height: 1.6;">${formatted}</p>
        </div>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #f0f0f0; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 0;">This summary was generated by Notewell AI Meeting Notes Service</p>
          <p style="margin: 5px 0 0 0;">NHS Compliant • Secure • Confidential</p>
        </div>
      </div>
    `;

    return htmlFormatted;
  };

  const fetchAvailableAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setAvailableAttendees(data || []);
    } catch (error) {
      console.error('Error fetching attendees:', error);
    }
  };

  const handleEmailMeeting = async () => {
    if (!userEmail) {
      toast.error("User email not available");
      return;
    }

    setIsEmailLoading(true);
    try {
      // Get selected attendee emails
      const attendeeEmailList = selectedAttendees.map(attendeeId => {
        const attendee = availableAttendees.find(a => a.id === attendeeId);
        return attendee?.email;
      }).filter(email => email);

      // Add manually entered emails
      const manualEmails = additionalEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const allEmails = [...attendeeEmailList, ...manualEmails];
      const allEmailsString = [userEmail, ...allEmails].join(', ');

      // Prepare email content - prioritize AI-generated content
      let meetingNotes;
      
      if (aiGeneratedMinutes) {
        // Use AI-generated content and format it for email
        meetingNotes = formatContentForEmail(aiGeneratedMinutes);
        console.log('Using AI-generated minutes for email');
      } else {
        // Fall back to basic template
        const basicContent = generateNHSSummaryContent();
        meetingNotes = formatContentForEmail(basicContent);
        
        // If the content is mostly "Not specified", include the transcript
        if (basicContent.includes('Not specified') && meetingData?.transcript) {
          meetingNotes += `<hr><h3>Meeting Transcript</h3><div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #0066cc; white-space: pre-wrap; font-family: monospace; font-size: 12px;">${meetingData.transcript}</div>`;
        }
        console.log('Using basic template + transcript for email');
      }
      
      console.log('Meeting notes length:', meetingNotes.length);
      
      // EmailJS credentials
      const serviceId = 'notewell'; // Your service ID
      const templateId = 'template_n236grs'; // Your template ID  
      const publicKey = 'OknbPskm8GVoUZFiD'; // Your public key

      // Create attachments if needed - EmailJS requires specific format
      let wordAttachment = null;
      let transcriptAttachment = null;
      let pdfAttachment = null;

      if (includeDocx) {
        try {
          console.log('Creating DOCX attachment...');
          // Generate DOCX file as blob
          const docxBlob = await generateDocxBlob();
          
          // Ensure we have a valid blob before creating File
          if (docxBlob && docxBlob.size > 0) {
            const filename = `${meetingData?.title || 'meeting'}_minutes.docx`;
            
            // Create File object with proper error handling
            wordAttachment = new File([docxBlob], filename, {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            
            console.log('DOCX attachment created successfully:', {
              name: wordAttachment.name,
              size: wordAttachment.size,
              type: wordAttachment.type
            });
          } else {
            console.error('Invalid DOCX blob generated');
          }
        } catch (error) {
          console.error('Error creating DOCX attachment:', error);
          wordAttachment = null;
        }
      }

      if (includePdf) {
        try {
          console.log('Creating PDF attachment...');
          const pdfBlob = await generatePdfBlob();
          
          if (pdfBlob && pdfBlob.size > 0) {
            const filename = `${meetingData?.title || 'meeting'}_minutes.pdf`;
            
            pdfAttachment = new File([pdfBlob], filename, {
              type: 'application/pdf'
            });
            
            console.log('PDF attachment created successfully:', {
              name: pdfAttachment.name,
              size: pdfAttachment.size,
              type: pdfAttachment.type
            });
          } else {
            console.error('Invalid PDF blob generated');
          }
        } catch (error) {
          console.error('Error creating PDF attachment:', error);
          pdfAttachment = null;
        }
      }

      if (includeTranscriptInEmail && meetingData?.transcript) {
        try {
          console.log('Creating transcript attachment...');
          const transcriptContent = meetingData.transcript;
          
          if (transcriptContent && transcriptContent.length > 0) {
            const filename = `${meetingData?.title || 'meeting'}_transcript.txt`;
            
            transcriptAttachment = new File([transcriptContent], filename, {
              type: 'text/plain'
            });
            
            console.log('Transcript attachment created successfully:', {
              name: transcriptAttachment.name,
              size: transcriptAttachment.size,
              type: transcriptAttachment.type
            });
          } else {
            console.error('No transcript content available');
          }
        } catch (error) {
          console.error('Error creating transcript attachment:', error);
          transcriptAttachment = null;
        }
      }

      const templateParams = {
        // Main EmailJS template variables (matching your template)
        subject: `Meeting Notes: ${meetingData?.title || 'Meeting'}`,
        message: meetingNotes,
        to_email: userEmail,
        
        // Additional variables for reference
        to_name: userEmail.split('@')[0],
        from_name: 'NoteWell Meeting Service',
        reply_to: 'noreply@pcn-services.co.uk',
        
        // Meeting details
        meeting_title: meetingData?.title || 'Meeting',
        meeting_date: new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB'),
        duration: meetingData?.duration || '00:00',
        practice_name: meetingData?.practiceName || '',
        all_emails: allEmailsString,
        include_transcript: includeTranscriptInEmail ? 'Yes' : 'No',
        
        // Attachments - EmailJS expects File objects directly
        ...(wordAttachment && { word_attachment: wordAttachment }),
        ...(pdfAttachment && { pdf_attachment: pdfAttachment }),
        ...(transcriptAttachment && { transcript_attachment: transcriptAttachment })
      };

      console.log('Template params with attachments:', {
        subject: templateParams.subject,
        to_email: templateParams.to_email,
        word_attachment: wordAttachment ? `File: ${wordAttachment.name} (${wordAttachment.size} bytes)` : 'No DOCX',
        pdf_attachment: pdfAttachment ? `File: ${pdfAttachment.name} (${pdfAttachment.size} bytes)` : 'No PDF',
        transcript_attachment: transcriptAttachment ? `File: ${transcriptAttachment.name} (${transcriptAttachment.size} bytes)` : 'No transcript'
      });

      // Debug logging
      console.log('EmailJS Template Params:', {
        subject: templateParams.subject,
        message: templateParams.message?.substring(0, 100) + '...', // First 100 chars
        to_email: templateParams.to_email,
        messageLength: templateParams.message?.length
      });

      // Send email using EmailJS from browser
      console.log('Sending email via EmailJS...');
      const response = await emailjs.send(
        serviceId,
        templateId,
        templateParams,
        publicKey
      );

      console.log('EmailJS response:', response);

      if (response.status === 200) {
        toast.success("Email sent successfully via EmailJS");
        setIsEmailModalOpen(false);
        
        // Reset attachment states
        setIncludeDocx(true);
        setIncludePdf(false);
        setIncludeTranscriptInEmail(false);
        setSelectedAttendees([]);
        setAdditionalEmails("");
      } else {
        throw new Error(`EmailJS returned status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Failed to send email. Please check your EmailJS configuration.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Helper function to generate DOCX as blob
  const generateDocxBlob = async (): Promise<Blob> => {
    try {
      // Use AI-generated content if available, otherwise use basic content
      let content;
      if (aiGeneratedMinutes) {
        content = aiGeneratedMinutes;
      } else {
        content = generateNHSSummaryContent();
      }
      
      const documentChildren = [];
      
      // Split content into sections and process each
      const sections = content.split(/(?=\d+\.|\d+️⃣)/);
      
      for (const section of sections) {
        if (!section.trim()) continue;
        
        // Check if this section contains a table
        if (section.includes('| Action/Decision') || section.includes('|Action/Decision')) {
          // Process table section
          const lines = section.split('\n');
          let tableRows = [];
          let headerAdded = false;
          
          for (const line of lines) {
            // Add section header
            if (!headerAdded && (line.includes('Actions') || line.includes('Decisions'))) {
              documentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line.replace(/\d+️⃣\s*/, '').trim(),
                      bold: true,
                      size: 24
                    })
                  ],
                  spacing: { before: 300, after: 200 },
                  heading: HeadingLevel.HEADING_2
                })
              );
              headerAdded = true;
              continue;
            }
            
            // Process table rows
            if (line.includes('|') && !line.match(/^\s*\|[-\s\|:]+\|\s*$/)) {
              const cells = line.split('|')
                .map(cell => cell.trim())
                .filter((cell, index, arr) => index > 0 && index < arr.length - 1)
                .filter(cell => cell.length > 0);
              
              if (cells.length >= 3) {
                tableRows.push(cells);
              }
            }
          }
          
          // Create the table
          if (tableRows.length > 0) {
            const rows = tableRows.map((rowData, index) => {
              const cells = rowData.map((cellText, cellIndex) => {
                const width = cellIndex === 0 ? 50 : 25; // 50% for first column, 25% for others
                
                return new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cellText,
                          size: 20,
                          bold: index === 0 // Make header row bold
                        })
                      ]
                    })
                  ],
                  width: {
                    size: width,
                    type: WidthType.PERCENTAGE
                  }
                });
              });
              
              return new TableRow({
                children: cells
              });
            });

            documentChildren.push(
              new Table({
                rows: rows,
                width: {
                  size: 100,
                  type: WidthType.PERCENTAGE
                }
              })
            );
          }
        } else {
          // Process regular text section
          const lines = section.split('\n');
          
          for (const line of lines) {
            if (!line.trim()) {
              documentChildren.push(new Paragraph({ text: "" }));
              continue;
            }
            
            // Process different types of lines
            if (line.includes('AI Generated Meeting Minutes') || line.includes('NHS MEETING MINUTES')) {
              documentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line,
                      bold: true,
                      size: 32
                    })
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 400 }
                })
              );
            } else if (line.includes('###') || line.includes('ATTENDEES:') || line.includes('AGENDA:') || 
                      line.includes('KEY DISCUSSION POINTS:') || line.includes('DECISIONS MADE:') || 
                      line.includes('ACTION ITEMS:') || line.includes('NEXT STEPS:') || line.includes('ADDITIONAL NOTES:')) {
              documentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line.replace(/###\s*/, '').replace(/\d+️⃣\s*/, ''),
                      bold: true,
                      size: 24
                    })
                  ],
                  spacing: { before: 300, after: 200 },
                  heading: HeadingLevel.HEADING_2
                })
              );
            } else if (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)) {
              // Bullet points or numbered lists
              documentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line,
                      size: 22
                    })
                  ],
                  spacing: { after: 100 },
                  bullet: { level: 0 }
                })
              );
            } else {
              // Regular text
              documentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line,
                      size: 22
                    })
                  ],
                  spacing: { after: 100 }
                })
              );
            }
          }
        }
      }

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 }
            }
          },
          children: documentChildren
        }]
      });

      return await Packer.toBlob(doc);
    } catch (error) {
      console.error('Error generating DOCX blob:', error);
      throw error;
    }
  };

  // Helper function to generate PDF as blob
  const generatePdfBlob = async (): Promise<Blob> => {
    try {
      const content = generateNHSSummaryContent();
      
      // Clean content for PDF (remove HTML tags if any)
      let pdfContent;
      if (aiGeneratedMinutes) {
        pdfContent = content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')  // Replace HTML entities
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      } else {
        pdfContent = content;
      }

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      
      // Add content to PDF
      const lines = pdf.splitTextToSize(pdfContent, pageWidth - 2 * margin);
      let yPosition = margin;
      
      for (const line of lines) {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 6;
      }

      // Return as blob
      return pdf.output('blob');
    } catch (error) {
      console.error('Error generating PDF blob:', error);
      throw error;
    }
  };

  const generateNHSSummaryContent = () => {
    // Use AI-generated content if available, otherwise fall back to form content
    if (aiGeneratedMinutes) {
      return aiGeneratedMinutes;
    }

    // Fallback to form-based content if no AI content exists
    const date = new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB');
    const time = new Date(meetingData?.startTime || new Date()).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `NHS MEETING MINUTES

Meeting Title: ${meetingData?.title || 'General Meeting'}
Date: ${date}
Time: ${time}
Duration: ${meetingData?.duration || '00:00'}
${meetingData?.practiceName ? `Practice: ${meetingData.practiceName}` : ''}

ATTENDEES:
${summaryContent.attendees || 'Not specified'}

AGENDA:
${summaryContent.agenda || 'Not specified'}

KEY DISCUSSION POINTS:
${summaryContent.keyPoints || 'Not specified'}

DECISIONS MADE:
${summaryContent.decisions || 'Not specified'}

ACTION ITEMS:
${summaryContent.actionItems || 'Not specified'}

NEXT STEPS:
${summaryContent.nextSteps || 'Not specified'}

ADDITIONAL NOTES:
${summaryContent.additionalNotes || 'Not specified'}

---
Meeting recorded with Notewell AI Meeting Notes Service
Total words transcribed: ${meetingData?.wordCount || 0}
Speakers detected: ${meetingData?.speakerCount || 0}`;
  };

  const downloadDocx = async () => {
    try {
      // Get practice details for footer and logo
      const { data: practiceData, error: practiceError } = await supabase
        .from('practice_details')
        .select('logo_url, footer_text, show_page_numbers, practice_name, address')
        .eq('user_id', user?.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (practiceError) {
        console.warn('Error fetching practice details:', practiceError);
      }
      
      console.log('Practice data for DOCX:', practiceData);
      
      const content = generateNHSSummaryContent();
      
      // Parse the content to create properly formatted paragraphs
      const lines = content.split('\n');
      const documentChildren = [];
      let currentTableRows = [];
      let inTable = false;
      
      // Add logo if available
      if (practiceData?.logo_url) {
        try {
          const response = await fetch(practiceData.logo_url);
          const logoBlob = await response.blob();
          const logoArrayBuffer = await logoBlob.arrayBuffer();
          const logoImage = new Uint8Array(logoArrayBuffer);
          
          documentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "",
                  size: 24
                })
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 200 }
            })
          );
        } catch (error) {
          console.warn('Failed to load logo for DOCX:', error);
        }
      }
      
      // Process each line with proper formatting
      for (const line of lines) {
        if (!line.trim()) {
          documentChildren.push(new Paragraph({ text: "" }));
          continue;
        }
        
        // Check if this is a table row
        if (line.includes('|') && line.trim() !== '' && !line.includes('---')) {
          const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
          if (cells.length > 0) {
            inTable = true;
            const isHeaderRow = line.includes('Action/Decision') || line.includes('Responsible') || line.includes('Deadline');
            
            const tableRow = new TableRow({
              children: cells.map((cellText, index) => 
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ 
                      text: cellText, 
                      bold: isHeaderRow,
                      size: 22
                    })]
                  })],
                  width: { 
                    size: cells.length === 3 ? (index === 0 ? 50 : 25) : 100/cells.length, 
                    type: WidthType.PERCENTAGE 
                  }
                })
              )
            });
            
            currentTableRows.push(tableRow);
          }
        } else {
          // If we were in a table and now have a non-table line, create the table
          if (inTable && currentTableRows.length > 0) {
            const table = new Table({
              rows: currentTableRows,
              width: { size: 100, type: WidthType.PERCENTAGE }
            });
            documentChildren.push(table);
            currentTableRows = [];
            inTable = false;
          }
          
          // Skip empty lines and separator lines
          if (!line.trim() || line.includes('---')) {
            if (line.trim()) {
              documentChildren.push(new Paragraph({ text: "" }));
            }
            continue;
          }
          
          // Handle different types of lines with proper formatting
          if (line.startsWith('###')) {
            // Section headers with emojis (like ### 1️⃣ Attendees)
            const headerText = line.replace(/^###\s*/, '');
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: headerText, bold: true, size: 26, color: "1f4e79" })],
              spacing: { before: 300, after: 150 }
            }));
          } else if (line.startsWith('# ')) {
            // Main headers (like # 1. Ambient Voice Technology)
            const headerText = line.replace(/^#\s*/, '');
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: headerText, bold: true, size: 28, color: "1f4e79" })],
              spacing: { before: 400, after: 200 }
            }));
          } else if (line.includes('**') && line.includes(':**')) {
            // Lines with inline bold text (like **Others referenced:**)
            const parts = line.split(/(\*\*[^*]+\*\*)/);
            const children = parts.map(part => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return new TextRun({ 
                  text: part.replace(/^\*\*|\*\*$/g, ''), 
                  bold: true, 
                  size: 24, 
                  color: "2c5aa0" 
                });
              } else {
                return new TextRun({ text: part, size: 22 });
              }
            });
            documentChildren.push(new Paragraph({
              children: children,
              spacing: { before: 150, after: 100 }
            }));
          } else if (line.startsWith('**') && line.endsWith('**')) {
            // Bold text (like **Present:**)
            const boldText = line.replace(/^\*\*|\*\*$/g, '');
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: boldText, bold: true, size: 24, color: "2c5aa0" })],
              spacing: { before: 150, after: 100 }
            }));
          } else if (line.startsWith('NHS MEETING MINUTES') || line.includes('Meeting Title:')) {
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: line, bold: true, size: 28, color: "1f4e79" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }));
          } else if (line.match(/^[A-Z\s]+:$/) || line.includes('ATTENDEES:') || line.includes('AGENDA:')) {
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: line, bold: true, size: 24, color: "1f4e79" })],
              spacing: { before: 200, after: 100 }
            }));
          } else {
            documentChildren.push(new Paragraph({
              children: [new TextRun({ text: line, size: 22 })],
              spacing: { after: 100 }
            }));
          }
        }
      }
      
      // Add any remaining table at the end
      if (inTable && currentTableRows.length > 0) {
        const table = new Table({
          rows: currentTableRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        });
        documentChildren.push(table);
      }
      
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 }
            }
          },
          children: documentChildren
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${meetingData?.title || 'meeting'}_minutes.docx`);
      toast.success("DOCX file downloaded successfully");
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast.error("Failed to generate DOCX file");
    }
  };

  const downloadPDF = async () => {
    try {
      // Get practice details for footer and logo
      const { data: practiceData, error: practiceError } = await supabase
        .from('practice_details')
        .select('logo_url, footer_text, show_page_numbers, practice_name, address')
        .eq('user_id', user?.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (practiceError) {
        console.warn('Error fetching practice details:', practiceError);
      }
      
      console.log('Practice data for PDF:', practiceData);
      
      const content = generateNHSSummaryContent();
      
      // Clean content for PDF (remove HTML tags if any)
      let pdfContent;
      if (aiGeneratedMinutes) {
        pdfContent = content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')  // Replace HTML entities
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      } else {
        pdfContent = content;
      }

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      
      // Function to add logo to page
      const addLogoToPage = async () => {
        if (practiceData?.logo_url) {
          try {
            const response = await fetch(practiceData.logo_url);
            if (!response.ok) throw new Error('Failed to fetch logo');
            
            const logoBlob = await response.blob();
            const logoDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(logoBlob);
            });
            
            const logoWidth = 40;
            const logoHeight = 30;
            pdf.addImage(logoDataUrl, 'PNG', pageWidth - logoWidth - margin, margin, logoWidth, logoHeight);
            console.log('Logo added to PDF successfully');
          } catch (error) {
            console.warn('Failed to load logo for PDF:', error);
          }
        } else {
          console.log('No logo URL found for practice');
        }
      };

      // Function to add footer to current page
      const addFooter = () => {
        const footerY = pageHeight - 20;
        pdf.setFontSize(8);
        
        // Footer text
        if (practiceData?.footer_text) {
          const footerLines = practiceData.footer_text.split('\n');
          footerLines.forEach((line, index) => {
            pdf.text(line, pageWidth / 2, footerY - (footerLines.length - 1 - index) * 5, { align: 'center' });
          });
        }
        
        // Page numbers
        if (practiceData?.show_page_numbers !== false) {
          const pageCount = pdf.getNumberOfPages();
          pdf.text(`Page ${pageCount}`, pageWidth / 2, footerY + 10, { align: 'center' });
        }
      };

      // Add logo to first page
      await addLogoToPage();
      
      const lines = pdfContent.split('\n');
      let y = practiceData?.logo_url ? 60 : 30; // Start below logo if present
      
      // Process each line with formatting
      for (const line of lines) {
        if (y > pageHeight - 40) { // Leave space for footer
          addFooter();
          pdf.addPage();
          await addLogoToPage();
          y = 30;
        }
        
        if (!line.trim()) {
          y += 6;
          continue;
        }
        
        // Title formatting
        if (line.includes('AI Generated Meeting Minutes') || line.includes('NHS MEETING MINUTES')) {
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text(line, pageWidth / 2, y, { align: 'center' });
          y += 20;
        }
        // Section headers
        else if (line.includes('###') || line.includes('ATTENDEES:') || line.includes('AGENDA:') || 
                line.includes('KEY DISCUSSION POINTS:') || line.includes('DECISIONS MADE:') || 
                line.includes('ACTION ITEMS:') || line.includes('NEXT STEPS:') || line.includes('ADDITIONAL NOTES:')) {
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          const cleanLine = line.replace(/###\s*/, '');
          pdf.text(cleanLine, margin, y);
          y += 12;
        }
        // Regular content
        else {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          // Handle long lines by splitting them
          const splitLines = pdf.splitTextToSize(line, pageWidth - 2 * margin);
          for (const splitLine of splitLines) {
            if (y > pageHeight - 40) {
              addFooter();
              pdf.addPage();
              await addLogoToPage();
              y = 30;
            }
            pdf.text(splitLine, margin, y);
            y += 6;
          }
        }
      }
      
      // Add footer to last page
      addFooter();
      
      pdf.save(`${meetingData?.title || 'meeting'}_minutes.pdf`);
      toast.success("PDF file downloaded successfully");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF file");
    }
  };

  const downloadTranscript = () => {
    if (!meetingData?.transcript) {
      toast.error("No transcript available");
      return;
    }

    const date = new Date(meetingData.startTime).toLocaleDateString('en-GB');
    const time = new Date(meetingData.startTime).toLocaleTimeString('en-GB');
    
    const transcriptContent = `MEETING TRANSCRIPT

Meeting: ${meetingData.title}
Date: ${date}
Start Time: ${time}
Duration: ${meetingData.duration}
Total Words: ${meetingData.wordCount}
Speakers: ${meetingData.speakerCount}
${meetingData.practiceName ? `Practice: ${meetingData.practiceName}` : ''}

---

${meetingData.transcript}

---
Generated by Notewell AI Meeting Notes Service`;

    const blob = new Blob([transcriptContent], { type: 'text/plain' });
    saveAs(blob, `${meetingData.title}_transcript.txt`);
    toast.success("Transcript downloaded successfully");
  };

  const sendEmail = async () => {
    if (!user?.email) {
      toast.error("User email not available");
      return;
    }

    setIsEmailLoading(true);
    try {
      const attendeeEmailList = attendeeEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const response = await supabase.functions.invoke('send-meeting-summary', {
        body: {
          userEmail: user.email,
          attendeeEmails: attendeeEmailList,
          meetingTitle: meetingData?.title || 'Meeting',
          meetingDate: new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB'),
          duration: meetingData?.duration || '00:00',
          summary: generateNHSSummaryContent(),
          includeTranscript,
          transcript: includeTranscript ? meetingData?.transcript : undefined,
          practiceName: meetingData?.practiceName
        }
      });

      if (response.error) throw response.error;
      
      toast.success("Email sent successfully");
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Failed to send email");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const generateAIMeetingMinutes = async (customDetailLevel?: string) => {
    if (!meetingData?.transcript) {
      toast.error("No transcript available for AI generation");
      return;
    }

    // Use custom detail level if provided, otherwise use current setting
    const levelToUse = customDetailLevel || detailLevel;

    // Calculate and set expected duration based on word count
    const duration = calculateExpectedDuration(meetingData.wordCount);
    setExpectedDuration(duration);
    setCountdown(duration);

    setIsGeneratingMinutes(true);
    try {
      const meetingDate = new Date(meetingData.startTime).toLocaleDateString('en-GB');
      const meetingTime = new Date(meetingData.startTime).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const response = await supabase.functions.invoke('generate-meeting-minutes', {
        body: {
          transcript: meetingData.transcript,
          meetingTitle: meetingSettings.title || meetingData.title,
          meetingDate,
          meetingTime,
          detailLevel: levelToUse,
          meetingType: meetingSettings.meetingType,
          attendees: meetingSettings.attendees,
          agenda: meetingSettings.agenda,
          description: meetingSettings.description
        }
      });

      if (response.error) throw response.error;

      const { meetingMinutes } = response.data;
      
      // Store the full AI-generated document
      setAiGeneratedMinutes(meetingMinutes);

      toast.success("AI meeting minutes generated successfully!");
      
    } catch (error) {
      console.error('Error generating AI meeting minutes:', error);
      toast.error("Failed to generate AI meeting minutes");
    } finally {
      setIsGeneratingMinutes(false);
    }
  };

  const saveEditedContent = () => {
    setAiGeneratedMinutes(editableContent);
    setIsEditingDocument(false);
    toast.success("Changes saved successfully!");
  };

  const startEditing = () => {
    setEditableContent(aiGeneratedMinutes || "");
    setIsEditingDocument(true);
  };

  const cancelEditing = () => {
    setEditableContent("");
    setIsEditingDocument(false);
  };

  // Enhanced markdown-like rendering function
  const renderFormattedText = (text: string) => {
    if (!text) return text;
    
    let formatted = text;
    
    // Fix attendees section - convert bullet points to comma-separated names and remove "Other" sections
    formatted = formatted.replace(
      /(1️⃣ Attendees[\s\S]*?)(?=2️⃣|$)/i,
      (match) => {
        let attendeesSection = match;
        
        // Remove any "Other" related sections completely
        attendeesSection = attendeesSection.replace(/Other[^:]*:[\s\S]*?(?=\n\n|2️⃣|$)/gi, '');
        attendeesSection = attendeesSection.replace(/Other[^:]*[\s\S]*?(?=\n\n|2️⃣|$)/gi, '');
        
        // Remove bullet points and convert to comma-separated list
        attendeesSection = attendeesSection.replace(/^[•\-\*]\s*(.+)$/gm, '$1');
        
        // Split into lines and clean up
        const lines = attendeesSection.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.includes('1️⃣') && !line.toLowerCase().includes('other'))
          .filter(line => line.length > 2); // Remove very short lines
        
        if (lines.length > 0) {
          // Join names with commas and ensure proper formatting
          const cleanedNames = lines.join(', ').replace(/,\s*,/g, ',').replace(/,+/g, ',');
          attendeesSection = `1️⃣ Attendees\n${cleanedNames}\n\n`;
        }
        
        return attendeesSection;
      }
    );
    
    // Ensure proper spacing between emoji sections
    formatted = formatted.replace(/(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣)/g, '\n\n$1');
    
    // Convert #### headers (level 4)
    formatted = formatted.replace(/^#### (.*$)/gm, '<h4 class="text-base font-semibold mt-3 mb-2 text-gray-800">$1</h4>');
    
    // Convert ### headers (level 3)
    formatted = formatted.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-800">$1</h3>');
    
    // Convert ## headers (level 2)
    formatted = formatted.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3 text-gray-800">$1</h2>');
    
    // Convert # headers (level 1)
    formatted = formatted.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-gray-800">$1</h1>');
    
    
    // Improve table formatting with minimal top spacing
    formatted = formatted.replace(/\|(.+)\|/g, (match, content) => {
      const cells = content.split('|').map(cell => cell.trim());
      const cellsHtml = cells.map(cell => 
        `<td class="border border-gray-300 px-3 py-2 text-sm">${cell}</td>`
      ).join('');
      return `<tr>${cellsHtml}</tr>`;
    });
    
    // Wrap table rows in proper table structure with minimal spacing before tables
    formatted = formatted.replace(/(<tr>.*<\/tr>\s*)+/g, (match) => {
      return `<table class="w-full border-collapse border border-gray-300 mt-1 mb-4">${match}</table>`;
    });
    
    // Remove excessive spacing before tables specifically in section 4
    formatted = formatted.replace(/(4️⃣[^<]*)<div class="mb-3"><\/div>\s*<table/g, '$1<table');
    
    // Convert **bold** to HTML bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Convert *italic* to HTML italic
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');
    
    // Convert bullet points with better styling
    formatted = formatted.replace(/^[•\-\*] (.*$)/gm, '<div class="ml-6 mb-1 flex"><span class="mr-2">•</span><span>$1</span></div>');
    
    // Convert numbered lists
    formatted = formatted.replace(/^(\d+)\. (.*$)/gm, '<div class="ml-6 mb-1 flex"><span class="mr-2 font-medium">$1.</span><span>$2</span></div>');
    
    // Convert line breaks to proper spacing with reduced spacing before sections
    formatted = formatted.replace(/\n\n\n+/g, '\n\n'); // Remove excessive line breaks
    formatted = formatted.replace(/\n\n/g, '<div class="mb-3"></div>');
    formatted = formatted.replace(/\n/g, '<br />');
    
    // Clean up excessive spacing around emoji sections
    formatted = formatted.replace(/<div class="mb-3"><\/div>\s*(<div class="mb-3"><\/div>\s*)*(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣)/g, '<div class="mb-4"></div>$2');
    
    return formatted;
  };

  if (!meetingData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{meetingData.title}</h1>
              <p className="text-muted-foreground">NHS Meeting Summary & Minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaved && (
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}
            {/* Only show email button if meaningful content exists */}
            {aiGeneratedMinutes && aiGeneratedMinutes.trim().length > 0 ? (
              <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Meeting Notes
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Email Meeting Notes</DialogTitle>
                    <DialogDescription>
                      Send meeting notes and attachments to attendees and other recipients.
                    </DialogDescription>
                  </DialogHeader>
                <div className="space-y-4">
                  {/* User Email */}
                  <div>
                    <Label htmlFor="userEmail">Your Email</Label>
                    <Input
                      id="userEmail"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="your.email@example.com"
                    />
                  </div>

                  {/* Quick Select Attendees */}
                  {availableAttendees.length > 0 && (
                    <div>
                      <Label>Quick Select Attendees</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                        {availableAttendees.map((attendee) => (
                          <div key={attendee.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={attendee.id}
                              checked={selectedAttendees.includes(attendee.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedAttendees([...selectedAttendees, attendee.id]);
                                } else {
                                  setSelectedAttendees(selectedAttendees.filter(id => id !== attendee.id));
                                }
                              }}
                            />
                            <Label htmlFor={attendee.id} className="text-sm">
                              {attendee.name} {attendee.email && `(${attendee.email})`}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Emails */}
                  <div>
                    <Label htmlFor="additionalEmails">Additional Email Addresses</Label>
                    <Textarea
                      id="additionalEmails"
                      placeholder="email1@example.com, email2@example.com"
                      value={additionalEmails}
                      onChange={(e) => setAdditionalEmails(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* Format Options */}
                  <div className="space-y-3">
                    <Label>Include Attachments</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeDocx"
                          checked={includeDocx}
                          onCheckedChange={(checked) => setIncludeDocx(checked as boolean)}
                        />
                        <Label htmlFor="includeDocx" className="text-sm">
                          Meeting Notes (DOCX) - Auto-selected
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includePdf"
                          checked={includePdf}
                          onCheckedChange={(checked) => setIncludePdf(checked as boolean)}
                        />
                        <Label htmlFor="includePdf" className="text-sm">
                          PDF Version
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeTranscriptInEmail"
                          checked={includeTranscriptInEmail}
                          onCheckedChange={(checked) => setIncludeTranscriptInEmail(checked as boolean)}
                        />
                        <Label htmlFor="includeTranscriptInEmail" className="text-sm">
                          Full Transcript
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Send Button */}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEmailModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleEmailMeeting} disabled={isEmailLoading || !userEmail}>
                      <Mail className="h-4 w-4 mr-2" />
                      {isEmailLoading ? 'Sending...' : 'Send Email'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            ) : (
              <div className="text-sm text-muted-foreground italic">
                Generate meeting minutes with AI first to enable email sharing
              </div>
            )}

            <Button variant="outline" onClick={continueMeeting}>
              <Play className="h-4 w-4 mr-2" />
              Continue Meeting
            </Button>
          </div>
        </div>

        {/* Meeting Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.duration}</div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.wordCount}</div>
              <div className="text-sm text-muted-foreground">Words</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Button 
                onClick={() => generateAIMeetingMinutes()}
                className={`w-full h-full min-h-[100px] ${isGeneratingMinutes ? 'animate-pulse' : 'hover-scale'}`}
                disabled={isGeneratingMinutes || !meetingData.transcript}
              >
                <div className="flex flex-col items-center gap-2">
                  <Sparkles className={`h-8 w-8 ${isGeneratingMinutes ? 'animate-spin' : ''}`} />
                  <div className="text-sm font-medium">
                    {isGeneratingMinutes ? (
                      <span className="flex items-center gap-2">
                        Generating... 
                        {countdown > 0 && (
                          <span className="bg-white/20 px-2 py-1 rounded text-xs font-mono">
                            {formatTime(countdown)}
                          </span>
                        )}
                      </span>
                    ) : (
                      'Generate Meeting Minutes with AI'
                    )}
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Detail Level Controls and Meeting Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Detail Level Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Generation Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TooltipProvider>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Detail Level</Label>
                  <div className="space-y-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="px-3">
                          <Slider
                            value={detailLevelValue}
                            onValueChange={(value) => {
                              setDetailLevelValue(value);
                              const levels = ['shorter', 'standard', 'detailed', 'super-detailed'] as const;
                              setDetailLevel(levels[value[0]]);
                            }}
                            max={3}
                            min={0}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-2">
                            <span>Shorter</span>
                            <span>Standard</span>
                            <span>Detailed</span>
                            <span>Super</span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p><strong>Shorter:</strong> Concise key points only</p>
                          <p><strong>Standard:</strong> Balanced detail level (default)</p>
                          <p><strong>Detailed:</strong> Comprehensive coverage</p>
                          <p><strong>Super:</strong> Extensive analysis with full context</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </TooltipProvider>
              
              {aiGeneratedMinutes && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Regenerate with Different Detail Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateAIMeetingMinutes('shorter')}
                      disabled={isGeneratingMinutes}
                      className="text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Shorter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateAIMeetingMinutes('detailed')}
                      disabled={isGeneratingMinutes}
                      className="text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      More Detail
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Collapsible Meeting Settings */}
          <Card>
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Meeting Settings
                    </span>
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`}
                    />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <MeetingSettings
                    onSettingsChange={(settings) => setMeetingSettings(settings)}
                    initialSettings={{
                      title: meetingSettings.title,
                      description: meetingSettings.description,
                      meetingType: meetingSettings.meetingType
                    }}
                  />
                  {aiGeneratedMinutes && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        onClick={() => generateAIMeetingMinutes()}
                        disabled={isGeneratingMinutes}
                        className="w-full"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Regenerate with Updated Settings
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* AI Generated Meeting Minutes Document View */}
          {aiGeneratedMinutes ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FilePlus2 className="h-5 w-5" />
                      AI Generated Meeting Minutes
                    </span>
                    <div className="flex gap-2">
                      {!isEditingDocument ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={startEditing}
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Document
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setAiGeneratedMinutes(null)}
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Summary View
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={saveEditedContent}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={cancelEditing}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditingDocument ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <Textarea
                        value={editableContent}
                        onChange={(e) => setEditableContent(e.target.value)}
                        className="min-h-[600px] font-mono text-sm resize-none border-0 shadow-none focus:ring-0"
                        placeholder="Edit your meeting minutes here..."
                      />
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                        <p className="font-medium mb-1">💡 Quick Edit Tips:</p>
                        <ul className="space-y-1">
                          <li>• Use **text** for bold formatting</li>
                          <li>• Use emoji sections like 1️⃣, 2️⃣ for clear structure</li>
                          <li>• Use | table | format | for neat tables</li>
                          <li>• Keep attendee names comma-separated</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm max-h-[800px] overflow-y-auto">
                      <div className="prose max-w-none">
                        <div 
                          className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800"
                          dangerouslySetInnerHTML={{ __html: renderFormattedText(aiGeneratedMinutes) }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions Panel - Only shown in document view */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Download Options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Download Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button onClick={downloadDocx} className="w-full justify-start">
                      <FileDown className="h-4 w-4 mr-2" />
                      Download as DOCX
                    </Button>
                    <Button onClick={downloadPDF} className="w-full justify-start" variant="outline">
                      <FileDown className="h-4 w-4 mr-2" />
                      Download as PDF
                    </Button>
                    <Button onClick={downloadTranscript} className="w-full justify-start" variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Download Transcript (.txt)
                    </Button>
                  </CardContent>
                </Card>

                {/* Email Options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Email Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="attendeeEmails">Attendee Emails (comma separated)</Label>
                      <Textarea
                        id="attendeeEmails"
                        placeholder="email1@example.com, email2@example.com"
                        value={attendeeEmails}
                        onChange={(e) => setAttendeeEmails(e.target.value)}
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeTranscript"
                        checked={includeTranscript}
                        onCheckedChange={(checked) => setIncludeTranscript(checked as boolean)}
                      />
                      <Label htmlFor="includeTranscript" className="text-sm">
                        Include full transcript in email
                      </Label>
                    </div>

                    <Button 
                      onClick={sendEmail} 
                      className="w-full"
                      disabled={isEmailLoading}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {isEmailLoading ? 'Sending...' : 'Send Email'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            /* Initial Summary View - Only AI Assistant and Transcript */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Assistant */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => generateAIMeetingMinutes()}
                    className={`w-full ${isGeneratingMinutes ? 'animate-pulse' : 'hover-scale'}`}
                    disabled={isGeneratingMinutes || !meetingData.transcript}
                  >
                    <Sparkles className={`h-4 w-4 mr-2 ${isGeneratingMinutes ? 'animate-spin' : ''}`} />
                    {isGeneratingMinutes ? (
                      <span className="flex items-center gap-2">
                        Generating... 
                        {countdown > 0 && (
                          <span className="bg-white/20 px-2 py-1 rounded text-xs font-mono">
                            {formatTime(countdown)}
                          </span>
                        )}
                      </span>
                    ) : (
                      'Generate Meeting Minutes with AI'
                    )}
                  </Button>
                  
                  {isGeneratingMinutes && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-800">Processing transcript...</span>
                        <span className="text-xs text-blue-600">
                          {Math.round(((expectedDuration - countdown) / expectedDuration) * 100)}% complete
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${((expectedDuration - countdown) / expectedDuration) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-blue-600 mt-2">
                        Estimated time: {formatTime(expectedDuration)} ({meetingData.wordCount.toLocaleString()} words)
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Uses AI to automatically extract attendees, agenda, key points, decisions, and action items from the transcript.
                  </p>
                </CardContent>
              </Card>

              {/* Meeting Transcript */}
              <Card>
                <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Meeting Transcript
                        </span>
                        <ChevronDown 
                          className={`h-4 w-4 transition-transform ${isTranscriptOpen ? 'rotate-180' : ''}`}
                        />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {meetingData.transcript ? (
                        <div className="bg-accent/30 p-4 rounded-lg max-h-60 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm">
                            {meetingData.transcript}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No transcript available</p>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}