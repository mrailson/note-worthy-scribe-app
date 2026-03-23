import React, { useEffect, useRef } from 'react';
import type { MeetingAttendee } from '@/types/contactTypes';

interface AttendeePreviewPanelProps {
  open: boolean;
  onClose: () => void;
  attendees: MeetingAttendee[];
}

const STATUS_SECTIONS: {
  key: MeetingAttendee['status'];
  label: string;
  color: string;
  dotColor: string;
}[] = [
  { key: 'present', label: 'Present', color: '#10B981', dotColor: '#10B981' },
  { key: 'apologies', label: 'Apologies', color: '#F59E0B', dotColor: '#F59E0B' },
  { key: 'absent', label: 'Absent', color: '#94A3B8', dotColor: '#94A3B8' },
];

export const AttendeePreviewPanel: React.FC<AttendeePreviewPanelProps> = ({
  open, onClose, attendees,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        left: '50%',
        transform: open
          ? 'translateX(-50%) translateY(0) scale(1)'
          : 'translateX(-50%) translateY(-6px) scale(0.98)',
        width: 340,
        background: 'hsl(var(--background) / 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid hsl(var(--border) / 0.25)',
        borderRadius: 16,
        boxShadow: '0 20px 50px hsl(var(--foreground) / 0.08), inset 0 0 0 1px hsl(var(--background) / 0.5)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        zIndex: 60,
        maxHeight: 360,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px 8px',
        borderBottom: '1px solid hsl(var(--border) / 0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 15 }}>👥</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--foreground))' }}>
          Attendees
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))',
          marginLeft: 'auto',
        }}>
          {attendees.length} total
        </span>
      </div>

      {/* Sections */}
      <div style={{ padding: '8px 12px 12px' }}>
        {STATUS_SECTIONS.map(({ key, label, color }) => {
          const group = attendees.filter(a => a.status === key);
          if (group.length === 0) return null;
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 6, paddingLeft: 2,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: color, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color,
                }}>
                  {label} ({group.length})
                </span>
              </div>

              {/* Attendee rows */}
              {group.map(a => (
                <div
                  key={String(a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', borderRadius: 10,
                    borderLeft: `3px solid ${color}66`,
                    marginBottom: 3,
                    background: `${color}08`,
                  }}
                >
                  {/* Initials avatar */}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: `${color}22`, border: `1.5px solid ${color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color,
                    flexShrink: 0,
                  }}>
                    {a.initials}
                  </div>

                  {/* Name + role */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: 'hsl(var(--foreground))',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {a.name}
                    </div>
                    {(a.role || a.org) && (
                      <div style={{
                        fontSize: 10, color: 'hsl(var(--muted-foreground))',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {[a.role, a.org].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
