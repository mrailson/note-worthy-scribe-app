import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Printer, FileText, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface GPDetails {
  name: string;
  title: string;
  email?: string;
}

interface PracticeDetails {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

interface PatientLetterViewProps {
  transcript: string;
  consultationType?: string;
  soapNote?: {
    S: string;
    O: string;
    A: string;
    P: string;
  };
  letterContent?: string;
  onLetterGenerated?: (letter: string) => void;
}

export const PatientLetterView = ({
  transcript,
  consultationType = 'f2f',
  soapNote,
  letterContent: initialLetterContent,
  onLetterGenerated
}: PatientLetterViewProps) => {
  const [letterContent, setLetterContent] = useState(initialLetterContent || '');
  const [isLoading, setIsLoading] = useState(false);
  const [gpDetails, setGpDetails] = useState<GPDetails | null>(null);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails | null>(null);

  // Fetch GP and practice details
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('PatientLetterView: No user found');
          return;
        }

        console.log('PatientLetterView: Fetching details for user:', user.id);

        // Fetch GP profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, title, email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('PatientLetterView: Error fetching profile:', profileError);
        }

        if (profile) {
          console.log('PatientLetterView: Profile found:', profile);
          setGpDetails({
            name: profile.full_name || 'Your GP',
            title: profile.title || 'General Practitioner',
            email: profile.email
          });
        }

        // Fetch practice details
        const { data: practice, error: practiceError } = await supabase
          .from('practice_details')
          .select('practice_name, address, phone, email, practice_logo_url, logo_url')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (practiceError) {
          console.error('PatientLetterView: Error fetching practice:', practiceError);
        }

        if (practice) {
          console.log('PatientLetterView: Practice found:', practice);
          const logoUrl = practice.practice_logo_url || practice.logo_url || null;
          setPracticeDetails({
            name: practice.practice_name || 'GP Surgery',
            address: practice.address || '',
            phone: practice.phone || '',
            email: practice.email || '',
            logoUrl: logoUrl
          });
        } else {
          console.log('PatientLetterView: No practice details found for user');
        }
      } catch (error) {
        console.error('PatientLetterView: Error fetching details:', error);
      }
    };

    fetchDetails();
  }, []);

  // Auto-generate letter when component mounts and transcript is available
  useEffect(() => {
    if (transcript && !letterContent && !isLoading) {
      generateLetter();
    }
  }, [transcript]);

  const generateLetter = async () => {
    if (!transcript) {
      toast.error('No transcript available');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-patient-email', {
        body: { 
          transcript,
          consultationType
        }
      });

      if (error) throw error;

      if (data?.emailContent) {
        // Extract just the body content (between salutation and closing)
        const content = data.emailContent;
        setLetterContent(content);
        onLetterGenerated?.(content);
        toast.success('Patient letter generated');
      }
    } catch (error) {
      console.error('Error generating patient letter:', error);
      toast.error('Failed to generate patient letter');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    const plainText = getPlainTextLetter();
    navigator.clipboard.writeText(plainText);
    toast.success('Letter copied to clipboard');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Patient Consultation Summary</title>
          <style>
            body {
              font-family: Georgia, 'Times New Roman', serif;
              line-height: 1.6;
              max-width: 700px;
              margin: 40px auto;
              padding: 20px;
              color: #333;
            }
            .letterhead {
              text-align: center;
              border-bottom: 2px solid #005eb8;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .practice-name {
              font-size: 24px;
              font-weight: bold;
              color: #005eb8;
              margin-bottom: 8px;
            }
            .practice-details {
              font-size: 12px;
              color: #666;
            }
            .date {
              text-align: right;
              margin-bottom: 30px;
              color: #666;
            }
            .content {
              white-space: pre-wrap;
              font-size: 14px;
            }
            .signature {
              margin-top: 40px;
            }
            .gp-name {
              font-weight: bold;
            }
            .footer {
              margin-top: 60px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 11px;
              color: #888;
              text-align: center;
            }
            @media print {
              body { margin: 0; padding: 20px; }
            }
          </style>
        </head>
        <body>
          ${getFormattedLetterHTML()}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadWord = async () => {
    try {
      const { generateWordDocument } = await import('@/utils/documentGenerators');
      await generateWordDocument(getPlainTextLetter(), 'Patient Consultation Summary');
      toast.success('Word document downloaded');
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error('Failed to download Word document');
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent('Your Consultation Summary');
    const body = encodeURIComponent(getPlainTextLetter());
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const getPlainTextLetter = () => {
    const currentDate = format(new Date(), 'd MMMM yyyy');
    const practiceName = practiceDetails?.name || 'GP Surgery';
    const practiceAddr = practiceDetails?.address || '';
    const practicePhone = practiceDetails?.phone || '';
    const practiceEmail = practiceDetails?.email || '';
    const gpName = gpDetails?.name || 'Your GP';
    const gpTitle = gpDetails?.title || 'General Practitioner';

    return `${practiceName}
${practiceAddr}
${practicePhone ? `Tel: ${practicePhone}` : ''}
${practiceEmail ? `Email: ${practiceEmail}` : ''}

${currentDate}

Dear Patient,

${letterContent}

Kind regards,

${gpName}
${gpTitle}

---
This letter is a summary of your consultation. If you have any questions or concerns, please contact the surgery.`;
  };

  const getFormattedLetterHTML = () => {
    const currentDate = format(new Date(), 'd MMMM yyyy');
    const practiceName = practiceDetails?.name || 'GP Surgery';
    const practiceAddr = practiceDetails?.address || '';
    const practicePhone = practiceDetails?.phone || '';
    const practiceEmail = practiceDetails?.email || '';
    const gpName = gpDetails?.name || 'Your GP';
    const gpTitle = gpDetails?.title || 'General Practitioner';

    return `
      <div class="letterhead">
        <div class="practice-name">${practiceName}</div>
        <div class="practice-details">
          ${practiceAddr}<br/>
          ${practicePhone ? `Tel: ${practicePhone}` : ''} ${practiceEmail ? `| ${practiceEmail}` : ''}
        </div>
      </div>
      <div class="date">${currentDate}</div>
      <div class="content">Dear Patient,

${letterContent}</div>
      <div class="signature">
        Kind regards,<br/><br/>
        <span class="gp-name">${gpName}</span><br/>
        ${gpTitle}
      </div>
      <div class="footer">
        This letter is a summary of your consultation. If you have any questions or concerns, please contact the surgery.
      </div>
    `;
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p className="font-medium">Generating patient letter...</p>
            <p className="text-sm">Creating a clear summary for your patient</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!letterContent) {
    return (
      <Card className="border-2 border-dashed border-muted-foreground/30">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium mb-4">No patient letter generated yet</p>
            <Button onClick={generateLetter} disabled={!transcript}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Patient Letter
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentDate = format(new Date(), 'd MMMM yyyy');

  return (
    <div className="space-y-4">
      {/* Letter Preview */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-blue-50/50 to-white dark:from-slate-900/50 dark:to-slate-950 overflow-hidden">
        <ScrollArea className="h-[500px]">
          <div className="p-8">
            {/* Letterhead */}
            <div className="text-center border-b-2 border-primary pb-4 mb-6">
              {practiceDetails?.logoUrl && (
                <img 
                  src={practiceDetails.logoUrl} 
                  alt={`${practiceDetails.name} logo`} 
                  loading="lazy"
                  onError={(e) => {
                    // Hide broken logos rather than leaving a broken image icon
                    e.currentTarget.style.display = 'none';
                  }}
                  className="h-12 mx-auto mb-2 object-contain"
                />
              )}
              <h2 className="text-xl font-bold text-primary">
                {practiceDetails?.name || 'GP Surgery'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {practiceDetails?.address}
                {practiceDetails?.phone && <><br/>Tel: {practiceDetails.phone}</>}
                {practiceDetails?.email && <> | {practiceDetails.email}</>}
              </p>
            </div>

            {/* Date */}
            <p className="text-right text-sm text-muted-foreground mb-6">
              {currentDate}
            </p>

            {/* Letter Body */}
            <div className="font-serif space-y-4">
              <p className="font-medium">Dear Patient,</p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {letterContent}
              </div>
              
              {/* Signature */}
              <div className="mt-8 space-y-1">
                <p>Kind regards,</p>
                <p className="font-bold mt-4">{gpDetails?.name || 'Your GP'}</p>
                <p className="text-sm text-muted-foreground">{gpDetails?.title || 'General Practitioner'}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-dashed text-xs text-muted-foreground text-center">
              This letter is a summary of your consultation. If you have any questions or concerns, please contact the surgery.
            </div>
          </div>
        </ScrollArea>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleEmail} className="flex-1 min-w-[120px]">
          <Mail className="h-4 w-4 mr-2" />
          Email
        </Button>
        <Button variant="outline" onClick={handlePrint} className="flex-1 min-w-[120px]">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button variant="outline" onClick={handleDownloadWord} className="flex-1 min-w-[120px]">
          <FileText className="h-4 w-4 mr-2" />
          Word
        </Button>
        <Button variant="ghost" onClick={copyToClipboard}>
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </Button>
        <Button variant="ghost" onClick={generateLetter} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate
        </Button>
      </div>
    </div>
  );
};
