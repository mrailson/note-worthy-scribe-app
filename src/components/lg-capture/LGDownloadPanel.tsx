import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Download, FileText, FileJson, FileSpreadsheet, ExternalLink, ChevronDown, FileWarning, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';
import { toast } from 'sonner';
import { useIsIPhone } from '@/hooks/use-mobile';
import { LGPdfThumbnailPreview } from './LGPdfThumbnailPreview';

interface LGDownloadPanelProps {
  patient: LGPatient;
}

export function LGDownloadPanel({ patient }: LGDownloadPanelProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const isIPhone = useIsIPhone();
  
  // Parse pdf_part_urls if it exists
  const pdfPartUrls: string[] = Array.isArray(patient.pdf_part_urls) 
    ? patient.pdf_part_urls 
    : [];

  const openFileForViewing = async (url: string | null, filename: string) => {
    if (!url) {
      toast.error('File not available');
      return;
    }

    setDownloading(filename);
    
    try {
      const path = url.replace('lg/', '');
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('lg')
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (signedUrlError) throw signedUrlError;
      if (!signedUrlData?.signedUrl) throw new Error('No signed URL received');
      
      // iOS Safari blocks window.open after async - use anchor click instead
      if (isIPhone) {
        const link = document.createElement('a');
        link.href = signedUrlData.signedUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(signedUrlData.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Open file error:', err);
      toast.error('Failed to open file');
    } finally {
      setDownloading(null);
    }
  };

  const downloadFile = async (url: string | null, filename: string) => {
    if (!url) {
      toast.error('File not available');
      return;
    }

    setDownloading(filename);
    
    try {
      const path = url.replace('lg/', '');
      const { data, error } = await supabase.storage
        .from('lg')
        .download(path);

      if (error) throw error;
      if (!data) throw new Error('No data received');
      
      const blobUrl = URL.createObjectURL(data);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  const handleFileAction = (url: string | null, filename: string) => {
    if (isIPhone) {
      openFileForViewing(url, filename);
    } else {
      downloadFile(url, filename);
    }
  };

  if (patient.job_status !== 'succeeded') {
    return null;
  }

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
  
  const baseFilename = `${nhsNumber}_${dobFormatted}_${scanDateFormatted}`;

  const [otherFilesOpen, setOtherFilesOpen] = useState(false);

  // Format patient name for display
  const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown';
  const formattedNhs = nhsNumber.length === 10 
    ? `${nhsNumber.slice(0, 3)} ${nhsNumber.slice(3, 6)} ${nhsNumber.slice(6)}`
    : nhsNumber;
  const formattedDob = dob ? new Date(dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : 'Unknown';
  const fileSizeMb = patient.pdf_final_size_mb;
  const pageCount = patient.images_count || 0;

  const primaryFile = {
    label: 'Lloyd George PDF',
    description: `Searchable PDF${pageCount > 0 ? ` • ${pageCount} pages` : ''}${fileSizeMb ? ` • ${fileSizeMb.toFixed(2)} MB` : ''}`,
    patientDetails: `${patientName} | NHS: ${formattedNhs} | DOB: ${formattedDob}`,
    url: patient.pdf_url,
    filename: `${baseFilename}___Lloyd George Scan.pdf`,
    icon: FileText,
  };

  const otherFiles = [
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

  const renderFileButton = (file: typeof primaryFile | typeof otherFiles[0], isPrimary = false) => {
    const Icon = file.icon;
    const isDownloading = downloading === file.filename;
    const patientDetails = 'patientDetails' in file ? file.patientDetails : null;
    
    return (
      <Button
        key={file.label}
        variant={isPrimary ? "default" : "outline"}
        className={`w-full justify-start h-auto py-3 ${isPrimary ? 'bg-primary hover:bg-primary/90' : ''}`}
        onClick={() => handleFileAction(file.url, file.filename)}
        disabled={!file.url || isDownloading}
      >
        <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
        <div className="text-left flex-1">
          <div className="font-medium">{file.label}</div>
          <div className={`text-xs ${isPrimary ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{file.description}</div>
          {isPrimary && patientDetails && (
            <div className={`text-xs mt-1 ${isPrimary ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{patientDetails}</div>
          )}
        </div>
        {isDownloading ? (
          <span className="text-xs">{isIPhone ? 'Opening...' : 'Downloading...'}</span>
        ) : (
          isIPhone ? (
            <ExternalLink className="h-4 w-4 ml-2 opacity-50" />
          ) : (
            <Download className="h-4 w-4 ml-2 opacity-50" />
          )
        )}
      </Button>
    );
  };

  // Render split PDF download buttons
  const renderSplitPdfButtons = () => {
    if (!patient.pdf_split || pdfPartUrls.length === 0) {
      return renderFileButton(primaryFile, true);
    }
    
    return (
      <div className="space-y-2">
        <div className="text-sm text-amber-600 flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-md border border-amber-200">
          <FileWarning className="h-4 w-4 flex-shrink-0" />
          <span>PDF split into {pdfPartUrls.length} parts for SystmOne compatibility (max 5MB each)</span>
        </div>
        {pdfPartUrls.map((url, index) => {
          const partFilename = `${baseFilename}___Lloyd George Scan_Part${index + 1}.pdf`;
          const isDownloadingPart = downloading === partFilename;
          
          return (
            <Button
              key={index}
              variant={index === 0 ? "default" : "outline"}
              className={`w-full justify-start h-auto py-3 ${index === 0 ? 'bg-primary hover:bg-primary/90' : ''}`}
              onClick={() => handleFileAction(url, partFilename)}
              disabled={!url || isDownloadingPart}
            >
              <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="font-medium">Part {index + 1} of {pdfPartUrls.length}</div>
                <div className={`text-xs ${index === 0 ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {index === 0 ? 'Front matter + first scanned pages' : 'Continued scanned pages'}
                </div>
              </div>
              {isDownloadingPart ? (
                <span className="text-xs">{isIPhone ? 'Opening...' : 'Downloading...'}</span>
              ) : (
                isIPhone ? (
                  <ExternalLink className="h-4 w-4 ml-2 opacity-50" />
                ) : (
                  <Download className="h-4 w-4 ml-2 opacity-50" />
                )
              )}
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isIPhone ? <ExternalLink className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          {isIPhone ? 'View Files' : 'Download Files'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary file(s) - Lloyd George PDF (may be split) */}
        <div className="flex gap-2">
          <div className="flex-1">
            {renderSplitPdfButtons()}
          </div>
          {/* Preview toggle button - only for non-split PDFs */}
          {!patient.pdf_split && patient.pdf_url && (
            <Button
              variant="outline"
              size="icon"
              className="h-auto self-start"
              onClick={() => setShowPreview(!showPreview)}
              title={showPreview ? 'Hide preview' : 'Quick preview'}
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* PDF Thumbnail Preview */}
        {showPreview && patient.pdf_url && !patient.pdf_split && (
          <LGPdfThumbnailPreview 
            pdfUrl={patient.pdf_url} 
            totalPages={patient.images_count || 0} 
          />
        )}
        
        {/* Other files - collapsible */}
        <Collapsible open={otherFilesOpen} onOpenChange={setOtherFilesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-10 text-muted-foreground hover:text-foreground">
              <span className="text-sm">Other files ({otherFiles.length})</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${otherFilesOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {otherFiles.map((file) => renderFileButton(file))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
