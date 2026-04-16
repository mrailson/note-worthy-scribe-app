import { useState, useRef } from 'react';
import { Upload, RefreshCw, Trash2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useMeetingRecovery } from '@/hooks/useMeetingRecovery';

interface RecordingErrorCardProps {
  meetingId: string;
  meetingTitle: string;
  wordCount: number | null;
  durationMinutes: number | null;
  importSource: string | null;
  onReprocessComplete?: (meetingId: string) => void;
}

function getFailureReason(wordCount: number | null, importSource: string | null): string {
  if (wordCount === null || wordCount === 0) {
    if (importSource?.includes('offline')) return 'Upload incomplete — audio may not have fully synced before transcription started.';
    return 'Whisper returned <100 words — the audio may be too short, silent, or corrupted.';
  }
  return 'Transcription failed — the audio could not be processed successfully.';
}

function SpinnerDots() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-[3px]">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-blue-500"
          style={{ animation: `notewellPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes notewellPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </span>
  );
}

/* ── Delete Confirmation Modal (bottom-sheet) ── */
function DeleteConfirmationModal({
  meetingTitle,
  onConfirm,
  onCancel,
}: {
  meetingTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Bottom-sheet panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
        {/* Warning banner */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-t-2xl sm:rounded-t-2xl p-5 text-white">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg leading-tight">Permanently delete this meeting?</h3>
              <p className="text-red-100 text-sm mt-0.5">This action cannot be undone.</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Body text */}
          <p className="text-sm text-foreground leading-relaxed">
            You are about to delete "<strong>{meetingTitle}</strong>" from Notewell.
            All associated data will be removed from Supabase storage and the database.
          </p>

          {/* Consequences callout */}
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-2">
              What will be deleted
            </p>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1.5 list-disc pl-4">
              <li>The audio recording from cloud storage</li>
              <li>Any partial transcripts and processing artefacts</li>
              <li>All AI-generated summaries, action items and notes</li>
              <li>Sharing links and email distribution history</li>
              <li>The meeting record from your dashboard</li>
            </ul>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground leading-snug">
              I understand this is permanent and that the meeting cannot be recovered.
            </span>
          </label>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              disabled={!confirmed}
              onClick={onConfirm}
              className={`flex-1 text-white transition-colors ${
                confirmed
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
              }`}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Permanently
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Card ── */
export function RecordingErrorCard({
  meetingId,
  meetingTitle,
  wordCount,
  durationMinutes,
  importSource,
  onReprocessComplete,
}: RecordingErrorCardProps) {
  const { state, reuploadAudio, reprocessMeeting, deleteMeeting } = useMeetingRecovery(meetingId, onReprocessComplete);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const failureReason = getFailureReason(wordCount, importSource);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) reuploadAudio(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteConfirm = () => {
    setShowDeleteModal(false);
    deleteMeeting();
  };

  // Auto-collapse success after 3.5s is handled in the hook via onComplete

  const isIdle = state.phase === 'idle' || state.phase === 'failed';
  const isProcessing = state.phase === 'processing';
  const isSuccess = state.phase === 'success';

  return (
    <>
      <div
        className={`mt-2 rounded-lg border p-3 space-y-3 transition-colors duration-300 ${
          isSuccess
            ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/30'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
        }`}
      >
        {/* Status badge row */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={`text-[11px] font-medium ${
              isSuccess
                ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400'
                : isProcessing
                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400'
                : state.phase === 'failed'
                ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400'
                : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                isSuccess ? 'bg-green-500'
                : isProcessing ? 'bg-blue-500'
                : state.phase === 'failed' ? 'bg-red-500'
                : 'bg-amber-500'
              }`}
            />
            {isSuccess ? 'Success' : isProcessing ? 'Processing' : state.phase === 'failed' ? 'Failed' : 'Needs attention'}
            {isProcessing && <SpinnerDots />}
          </Badge>

          {importSource && (
            <span className="text-[10px] text-muted-foreground">
              Source: {importSource.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Success result */}
        {isSuccess && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 rounded-md px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-700 dark:text-green-400 font-medium">
              {state.resultMessage}
            </span>
          </div>
        )}

        {/* Processing state */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="h-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Processing… {Math.round(state.progress)}%
            </p>
          </div>
        )}

        {/* Error message */}
        {state.phase === 'failed' && state.errorMessage && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{state.errorMessage}</span>
          </div>
        )}

        {/* Idle / Failed — show failure reason + action buttons */}
        {isIdle && (
          <>
            {/* Failure reason callout */}
            <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
              <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-0.5">
                Reason
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                {failureReason}
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileSelected}
            />

            {/* Three stacked action buttons */}
            <div className="space-y-2">
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="w-full h-9 text-xs font-semibold gap-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white"
              >
                <Upload className="h-3.5 w-3.5" />
                Reupload Audio File
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); reprocessMeeting(); }}
                className="w-full h-9 text-xs font-semibold gap-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reprocess Existing Audio
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
                className="w-full h-9 text-xs font-semibold gap-2 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Meeting
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteConfirmationModal
          meetingTitle={meetingTitle}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}
