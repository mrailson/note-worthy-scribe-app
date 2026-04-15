import React from 'react';
import { AlertTriangle, Mic, Save, Trash2, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PersistedRecordingSession } from '@/utils/recordingSessionPersistence';
import { getApproxCapturedMinutes } from '@/utils/recordingSessionPersistence';

interface RecordingRecoveryBannerProps {
  session: PersistedRecordingSession;
  isStale: boolean;
  isDuplicateTab: boolean;
  onResume: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onDismiss?: () => void;
  isSaving?: boolean;
}

const DiscardConfirmation = ({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
    <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 500, flex: 1 }}>
      This cannot be undone. Are you sure?
    </span>
    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
      Cancel
    </Button>
    <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={onConfirm}>
      <Trash2 className="h-3 w-3" /> Yes, discard
    </Button>
  </div>
);

export const RecordingRecoveryBanner: React.FC<RecordingRecoveryBannerProps> = ({
  session,
  isStale,
  isDuplicateTab,
  onResume,
  onSave,
  onDiscard,
  onDismiss,
  isSaving = false,
}) => {
  const [confirmingDiscard, setConfirmingDiscard] = React.useState(false);

  const startedAt = new Date(session.startedAt);
  const capturedMinutes = getApproxCapturedMinutes(session);
  const timeStr = startedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = startedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const displayName = session.groupName || session.meetingTitle || 'Untitled Meeting';

  if (isStale) {
    return (
      <div className="mx-1 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 animate-fade-in relative">
        {onDismiss && (
          <button onClick={onDismiss} className="absolute top-2 right-2 p-1 rounded hover:bg-amber-500/10 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">
              Old recording session found
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              "{displayName}" from {dateStr} at {timeStr}. This session is over 24 hours old.
            </p>
            {confirmingDiscard ? (
              <DiscardConfirmation onCancel={() => setConfirmingDiscard(false)} onConfirm={onDiscard} />
            ) : (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingDiscard(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Discard
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isDuplicateTab) {
    return (
      <div className="mx-1 mb-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 animate-fade-in relative">
        {onDismiss && (
          <button onClick={onDismiss} className="absolute top-2 right-2 p-1 rounded hover:bg-blue-500/10 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">
              Recording active in another tab
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              "{displayName}" appears to be recording in another browser tab.
              Close this tab or wait for the other recording to finish.
            </p>
            {confirmingDiscard ? (
              <DiscardConfirmation onCancel={() => setConfirmingDiscard(false)} onConfirm={onDiscard} />
            ) : (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingDiscard(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Discard &amp; Start Fresh
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-1 mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 animate-fade-in relative">
      {onDismiss && (
        <button onClick={onDismiss} className="absolute top-2 right-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">
            ⚠️ Recording session interrupted
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            "{displayName}" · Started {timeStr} · {capturedMinutes > 0 ? `${capturedMinutes} min captured` : 'just started'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {session.attendees.length} attendee{session.attendees.length !== 1 ? 's' : ''} · {session.agendaItems.length} agenda item{session.agendaItems.length !== 1 ? 's' : ''}
          </p>

          {confirmingDiscard ? (
            <DiscardConfirmation onCancel={() => setConfirmingDiscard(false)} onConfirm={onDiscard} />
          ) : (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                onClick={onResume}
                className="h-8 text-xs gap-1.5"
              >
                <Mic className="h-3.5 w-3.5" />
                Resume Recording
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={onSave}
                disabled={isSaving}
                className="h-8 text-xs gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Saving…' : 'Save What We Have'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDiscard(true)}
                className="h-8 text-xs gap-1.5 text-muted-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Discard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
