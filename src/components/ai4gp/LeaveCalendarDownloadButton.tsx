import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Download } from 'lucide-react';
import { generateLeaveCalendarPdf, detectLeaveCalendarData } from '@/utils/leaveCalendarPdfGenerator';
import { toast } from 'sonner';

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
      toast.success('Leave calendar PDF downloaded');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Please try again.');
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
