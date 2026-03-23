import React, { useEffect, useRef } from 'react';
import type { AgendaItem } from './MeetingSetupContext';

interface AgendaPreviewPanelProps {
  open: boolean;
  onClose: () => void;
  items: AgendaItem[];
}

export const AgendaPreviewPanel: React.FC<AgendaPreviewPanelProps> = ({
  open, onClose, items,
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
        maxHeight: 340,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px 8px',
        borderBottom: '1px solid hsl(var(--border) / 0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 15 }}>📋</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--foreground))' }}>
          Agenda
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))',
          marginLeft: 'auto',
        }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Items */}
      <div style={{ padding: '8px 12px 12px' }}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '7px 8px', borderRadius: 10,
              borderLeft: '3px solid #3B82F666',
              marginBottom: 4,
              background: '#3B82F608',
            }}
          >
            {/* Number badge */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#3B82F622', border: '1.5px solid #3B82F644',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#3B82F6',
              flexShrink: 0, marginTop: 1,
            }}>
              {idx + 1}
            </div>

            {/* Text */}
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: 'hsl(var(--foreground))',
              lineHeight: 1.4, flex: 1,
            }}>
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
