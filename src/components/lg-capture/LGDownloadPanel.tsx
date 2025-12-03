import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, FileJson, FileSpreadsheet } from 'lucide-react';
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
      // Use Supabase download method directly
      const path = url.replace('lg/', '');
      const { data, error } = await supabase.storage
        .from('lg')
        .download(path);

      if (error) throw error;
      if (!data) throw new Error('No data received');
      
      // Create download link from blob
      const blobUrl = URL.createObjectURL(data);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup after a delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
      
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

  // Format date as DD_MMM_YYYY (e.g., 15_Mar_1952)
  const formatDateForFilename = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Unknown';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Unknown';
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleDateString('en-GB', { month: 'short' });
      const year = date.getFullYear();
      return `${day}_${month}_${year}`;
    } catch {
      return 'Unknown';
    }
  };

  const nhsNumber = (patient.ai_extracted_nhs || patient.nhs_number || patient.id).replace(/\s/g, '');
  const dob = patient.ai_extracted_dob || patient.dob;
  const scanDate = patient.processing_completed_at || patient.created_at;
  
  const dobFormatted = formatDateForFilename(dob);
  const scanDateFormatted = formatDateForFilename(scanDate);
  
  // Naming convention: NHS Number_DOB(DD_MMM_YYYY)_ScanDate___Type
  const baseFilename = `${nhsNumber}_${dobFormatted}_${scanDateFormatted}`;

  const files = [
    {
      label: 'Lloyd George PDF',
      description: 'Searchable PDF with all pages',
      url: patient.pdf_url,
      filename: `${baseFilename}___Lloyd George Scan.pdf`,
      icon: FileText,
    },
    {
      label: 'Clinical Summary',
      description: 'Structured JSON summary',
      url: patient.summary_json_url,
      filename: `${baseFilename}___Clinical Summary.json`,
      icon: FileJson,
    },
    {
      label: 'SNOMED Codes (JSON)',
      description: 'Clinical codes for import',
      url: patient.snomed_json_url,
      filename: `${baseFilename}___SNOMED Codes.json`,
      icon: FileJson,
    },
    {
      label: 'SNOMED Codes (CSV)',
      description: 'Spreadsheet format',
      url: patient.snomed_csv_url,
      filename: `${baseFilename}___SNOMED Codes.csv`,
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
                <Download className="h-4 w-4 ml-2 opacity-50" />
              )}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
