import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Download } from 'lucide-react';
import { generateLeaveCalendarPdf, detectLeaveCalendarData } from '@/utils/leaveCalendarPdfGenerator';
import { showToast } from '@/utils/toastWrapper';

interface LeaveCalendarDownloadButtonProps {
  content: string;
  className?: string;
}

export const LeaveCalendarDownloadButton: React.FC<LeaveCalendarDownloadButtonProps> = ({
  content,
  className = ''
}) => {
  // Only show if content contains leave calendar data
  const hasLeaveData = detectLeaveCalendarData(content);
  
  if (!hasLeaveData) {
    return null;
  }
  
  const handleDownload = () => {
    try {
      generateLeaveCalendarPdf(content);
      showToast.success('Leave calendar PDF downloaded', { section: 'ai4gp' });
    } catch (error) {
      console.error('PDF generation error:', error);
      showToast.error('Failed to generate PDF. Please try again.', { section: 'ai4gp' });
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      className={`gap-2 ${className}`}
    >
      <Calendar className="h-4 w-4" />
      <span>Download as Calendar PDF</span>
      <Download className="h-3 w-3" />
    </Button>
  );
};
