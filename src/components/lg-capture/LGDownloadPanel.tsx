import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, FileJson, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';
import { toast } from 'sonner';

interface LGDownloadPanelProps {
  patient: LGPatient;
}

export function LGDownloadPanel({ patient }: LGDownloadPanelProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadFile = async (url: string | null, filename: string) => {
    if (!url) {
      toast.error('File not available');
      return;
    }

    setDownloading(filename);
    
    try {
      // Get signed URL for private bucket
      const { data, error } = await supabase.storage
        .from('lg')
        .createSignedUrl(url.replace('lg/', ''), 3600);

      if (error) throw error;

      // Trigger download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  if (patient.job_status !== 'succeeded') {
    return null;
  }

  const files = [
    {
      label: 'Lloyd George PDF',
      description: 'Searchable PDF with all pages',
      url: patient.pdf_url,
      filename: `${patient.nhs_number.replace(/\s/g, '')}_lloyd-george.pdf`,
      icon: FileText,
    },
    {
      label: 'Clinical Summary',
      description: 'Structured JSON summary',
      url: patient.summary_json_url,
      filename: `${patient.nhs_number.replace(/\s/g, '')}_summary.json`,
      icon: FileJson,
    },
    {
      label: 'SNOMED Codes (JSON)',
      description: 'Clinical codes for import',
      url: patient.snomed_json_url,
      filename: `${patient.nhs_number.replace(/\s/g, '')}_snomed.json`,
      icon: FileJson,
    },
    {
      label: 'SNOMED Codes (CSV)',
      description: 'Spreadsheet format',
      url: patient.snomed_csv_url,
      filename: `${patient.nhs_number.replace(/\s/g, '')}_snomed.csv`,
      icon: FileSpreadsheet,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Download Files
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {files.map((file) => {
          const Icon = file.icon;
          const isDownloading = downloading === file.filename;
          
          return (
            <Button
              key={file.label}
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={() => downloadFile(file.url, file.filename)}
              disabled={!file.url || isDownloading}
            >
              <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="font-medium">{file.label}</div>
                <div className="text-xs text-muted-foreground">{file.description}</div>
              </div>
              {isDownloading ? (
                <span className="text-xs">Downloading...</span>
              ) : (
                <ExternalLink className="h-4 w-4 ml-2 opacity-50" />
              )}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
