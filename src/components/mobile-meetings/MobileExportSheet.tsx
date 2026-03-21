import React from 'react';
import { FileText, Share2, Download, List, MessageSquare, Clock } from 'lucide-react';
import './mobile-meetings.css';

interface MobileExportSheetProps {
  open: boolean;
  onClose: () => void;
  wordCount?: number;
  onExportNotes?: () => void;
  onExportTranscript?: () => void;
  onExportQuality?: () => void;
  onShare?: () => void;
}

export const MobileExportSheet: React.FC<MobileExportSheetProps> = ({
  open,
  onClose,
  wordCount = 0,
  onExportNotes,
  onExportTranscript,
  onExportQuality,
  onShare,
}) => {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Meeting notes', text: 'Shared from Notewell AI' });
      } catch { /* user cancelled */ }
    }
    onShare?.();
  };

  return (
    <>
      <div className={`nw-mh-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`nw-mh-sheet ${open ? 'open' : ''}`}>
        <div className="nw-mh-sheet-handle" />
        <div className="nw-mh-sheet-title">Export meeting</div>

        <button className="nw-mh-sheet-option" onClick={onExportNotes}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'var(--nw-blue-light)' }}>
            <FileText size={20} color="var(--nw-blue)" />
          </div>
          <div>
            <div>Meeting notes (.docx)</div>
            <div className="nw-mh-sheet-option-detail">Formatted governance document with action log</div>
          </div>
        </button>

        <button className="nw-mh-sheet-option" onClick={onExportTranscript}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'var(--nw-green-light)' }}>
            <List size={20} color="var(--nw-green)" />
          </div>
          <div>
            <div>Full transcript (.docx)</div>
            <div className="nw-mh-sheet-option-detail">
              Best of All merged transcript{wordCount > 0 ? ` — ${wordCount.toLocaleString()} words` : ''}
            </div>
          </div>
        </button>

        <button className="nw-mh-sheet-option" onClick={onExportQuality}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'var(--nw-amber-light)' }}>
            <Clock size={20} color="var(--nw-amber)" />
          </div>
          <div>
            <div>Quality summary (.docx)</div>
            <div className="nw-mh-sheet-option-detail">Engine comparison, chunk data, and confidence scores</div>
          </div>
        </button>

        <button className="nw-mh-sheet-option" onClick={handleShare}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'var(--nw-surface2)' }}>
            <Share2 size={20} color="var(--nw-text2)" />
          </div>
          <div>
            <div>Share via…</div>
            <div className="nw-mh-sheet-option-detail">Email, Teams, Slack, or copy link</div>
          </div>
        </button>
      </div>
    </>
  );
};
