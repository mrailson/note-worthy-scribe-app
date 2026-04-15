import { useState, useEffect } from 'react';
import { RotateCcw, Eye } from 'lucide-react';

export type TestRole = 'admin' | 'practice' | 'mgmt_lead' | 'pml_director' | 'pml_finance';

export interface TestModeState {
  enabled: boolean;
  role: TestRole;
  selectedPractice?: string;
}

const ROLE_OPTIONS: { value: TestRole; label: string; shortLabel: string; color: string }[] = [
  { value: 'admin',        label: 'Admin',        shortLabel: 'Admin',    color: '#374151' },
  { value: 'practice',     label: 'Practice',     shortLabel: 'Practice', color: '#0369a1' },
  { value: 'mgmt_lead',    label: 'Mgmt Lead',    shortLabel: 'Mgmt',     color: '#7c3aed' },
  { value: 'pml_director', label: 'PML Director', shortLabel: 'Director', color: '#059669' },
  { value: 'pml_finance',  label: 'PML Finance',  shortLabel: 'Finance',  color: '#d97706' },
];

interface TestModeBarProps {
  state: TestModeState;
  onChange: (state: TestModeState) => void;
  practiceKeys: string[];
  practiceNames: Record<string, string>;
}

export function TestModeBar({ state, onChange, practiceKeys, practiceNames }: TestModeBarProps) {
  const isOverriding = state.enabled && state.role !== 'admin';
  const activeRole = ROLE_OPTIONS.find(r => r.value === state.role);
  const [showPractice, setShowPractice] = useState(state.role === 'practice' && state.enabled);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setShowPractice(state.role === 'practice' && state.enabled);
  }, [state.role, state.enabled]);

  const handleRoleChange = (role: TestRole) => {
    onChange({
      enabled: true,
      role,
      selectedPractice: role === 'practice'
        ? (state.selectedPractice || practiceKeys[0])
        : undefined,
    });
    // Auto-collapse after selecting a non-practice role (practice stays open for selector)
    if (role !== 'practice') {
      setExpanded(false);
    }
  };

  const handleReset = () => {
    onChange({ enabled: true, role: 'admin' });
    setExpanded(false);
  };

  // Collapsed state — just show Eye icon (+ active role badge if overriding)
  if (!expanded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setExpanded(true)}
          title="Preview as different role"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8,
            border: isOverriding ? `1px solid ${activeRole?.color}40` : '1px solid #d1d5db',
            background: isOverriding ? `${activeRole?.color}08` : '#fafafa',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <Eye style={{ width: 14, height: 14, color: isOverriding ? activeRole?.color : '#9ca3af' }} />
          {isOverriding ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: activeRole?.color }}>
              {activeRole?.shortLabel}
              {state.role === 'practice' && state.selectedPractice && (
                <span style={{ fontWeight: 400, opacity: 0.75 }}>
                  {' · '}{practiceNames[state.selectedPractice]?.split(' ')[0] || ''}
                </span>
              )}
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af' }}>Preview</span>
          )}
        </button>
        {isOverriding && (
          <button
            onClick={handleReset}
            title="Back to Admin view"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid #d1d5db', background: '#fff',
              color: '#6b7280', fontSize: 10, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <RotateCcw style={{ width: 10, height: 10 }} />
            Reset
          </button>
        )}
      </div>
    );
  }

  // Expanded state — full bar
  return (
    <div style={{
      fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
      borderRadius: 10,
      border: isOverriding ? `1px solid ${activeRole?.color}40` : '1px solid #e5e7eb',
      background: isOverriding ? `${activeRole?.color}08` : '#fafafa',
      overflow: 'hidden',
      transition: 'border-color 0.2s, background 0.2s',
      marginBottom: 8,
    }}>
      {/* Main bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', flexWrap: 'wrap' as const }}>
        {/* Label — clickable to collapse */}
        <button
          onClick={() => setExpanded(false)}
          title="Collapse preview bar"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <Eye style={{ width: 13, height: 13, color: isOverriding ? activeRole?.color : '#9ca3af' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: isOverriding ? activeRole?.color : '#9ca3af', letterSpacing: '0.01em' }}>
            Preview as:
          </span>
        </button>

        {/* Role pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, flex: 1 }}>
          {ROLE_OPTIONS.map(opt => {
            const active = state.role === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleRoleChange(opt.value)}
                style={{
                  padding: '4px 11px',
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  border: `1px solid ${active ? opt.color : '#d1d5db'}`,
                  background: active ? `${opt.color}12` : '#fff',
                  color: active ? opt.color : '#6b7280',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap' as const,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {opt.shortLabel}
                {active && opt.value !== 'admin' && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: opt.color, flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Active indicator + reset */}
        {isOverriding && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: activeRole?.color,
              padding: '3px 10px', borderRadius: 100,
              background: `${activeRole?.color}12`,
              border: `1px solid ${activeRole?.color}40`,
              whiteSpace: 'nowrap' as const,
            }}>
              Viewing as {activeRole?.label}
              {state.role === 'practice' && state.selectedPractice && (
                <span style={{ fontWeight: 400, opacity: 0.75 }}>
                  {' · '}{practiceNames[state.selectedPractice] || state.selectedPractice}
                </span>
              )}
            </span>
            <button
              onClick={handleReset}
              title="Back to Admin view"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                border: '1px solid #d1d5db', background: '#fff',
                color: '#6b7280', fontSize: 11, fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap' as const,
              }}
            >
              <RotateCcw style={{ width: 11, height: 11 }} />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Practice selector — slides open when Practice selected */}
      <div style={{
        maxHeight: showPractice ? 52 : 0,
        opacity: showPractice ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.25s ease, opacity 0.2s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 14px 10px',
          borderTop: `1px solid ${activeRole?.color}20`,
        }}>
          <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' as const }}>Practice:</span>
          <select
            value={state.selectedPractice || ''}
            onChange={e => onChange({ ...state, selectedPractice: e.target.value })}
            style={{
              padding: '5px 10px', borderRadius: 8,
              border: '1px solid #d1d5db', background: '#fff',
              fontSize: 12, color: '#374151',
              cursor: 'pointer', outline: 'none',
              maxWidth: 280, flex: 1,
            }}
          >
            {practiceKeys.map(k => (
              <option key={k} value={k}>{practiceNames[k]}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
