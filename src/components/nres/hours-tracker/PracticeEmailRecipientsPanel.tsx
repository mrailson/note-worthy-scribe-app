import React, { useState } from 'react';
import { Plus, Trash2, Mail, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useNRESBuyBackPracticeEmailRecipients,
  type BuyBackEmailRecipient,
} from '@/hooks/useNRESBuyBackPracticeEmailRecipients';

interface Props {
  practiceKey: string;
  practiceName: string;
  /** Whether the current user can edit (add/remove/toggle). View-only otherwise. */
  canEdit: boolean;
}

const TOGGLE_TYPES: Array<{
  key: 'receive_invoice' | 'receive_payment_confirmation' | 'receive_approval';
  label: string;
  hint: string;
}> = [
  { key: 'receive_invoice', label: 'Invoice', hint: 'Copy of invoices for this practice' },
  { key: 'receive_payment_confirmation', label: 'Payment', hint: 'Confirmation when PML pays' },
  { key: 'receive_approval', label: 'Approval', hint: 'When SNO Approver signs off' },
];

export function PracticeEmailRecipientsPanel({ practiceKey, practiceName, canEdit }: Props) {
  const { recipients, loading, addRecipient, updateRecipient, removeRecipient } =
    useNRESBuyBackPracticeEmailRecipients(practiceKey);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showForm, setShowForm] = useState(false);

  const submit = async () => {
    await addRecipient({ contact_name: name, email });
    setName(''); setEmail(''); setShowForm(false);
  };

  return (
    <div style={{
      margin: '8px 12px 12px', borderRadius: 10, border: '1px solid #e5e7eb',
      background: '#ffffff', overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: '#f9fafb', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Mail size={14} style={{ color: '#005eb8' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          Notification recipients
        </span>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          · {recipients.length} contact{recipients.length === 1 ? '' : 's'} for {practiceName}
        </span>
      </button>

      {open && (
        <div style={{ padding: '10px 14px 14px' }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 10px' }}>
            People listed here receive copies of practice notifications. Toggle each
            email type on or off per contact.
          </p>

          {recipients.length === 0 && !loading && (
            <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>
              No recipients yet. {canEdit && 'Add one below.'}
            </div>
          )}

          {recipients.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={th}>Name</th>
                    <th style={th}>Email</th>
                    {TOGGLE_TYPES.map(t => (
                      <th key={t.key} style={{ ...th, textAlign: 'center' }} title={t.hint}>
                        {t.label}
                      </th>
                    ))}
                    <th style={{ ...th, textAlign: 'center' }} title="Master on/off">Active</th>
                    {canEdit && <th style={{ ...th, width: 32 }} />}
                  </tr>
                </thead>
                <tbody>
                  {recipients.map(r => (
                    <RecipientRow
                      key={r.id}
                      r={r}
                      canEdit={canEdit}
                      onUpdate={updateRecipient}
                      onRemove={removeRecipient}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canEdit && (
            <div style={{ marginTop: 10 }}>
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 6, border: '1px dashed #93c5fd',
                    background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={12} /> Add contact
                </button>
              ) : (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                  padding: '8px 10px', borderRadius: 7, background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                }}>
                  <input
                    type="text"
                    placeholder="Contact name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ ...inputStyle, minWidth: 200 }}
                  />
                  <button
                    onClick={submit}
                    disabled={!name.trim() || !email.trim()}
                    style={{
                      padding: '5px 12px', borderRadius: 6, border: 'none',
                      background: '#005eb8', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', opacity: (!name.trim() || !email.trim()) ? 0.5 : 1,
                    }}
                  >Add</button>
                  <button
                    onClick={() => { setShowForm(false); setName(''); setEmail(''); }}
                    style={{
                      padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                      background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer',
                    }}
                  >Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecipientRow({
  r, canEdit, onUpdate, onRemove,
}: {
  r: BuyBackEmailRecipient;
  canEdit: boolean;
  onUpdate: (id: string, patch: Partial<BuyBackEmailRecipient>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const dim = !r.is_active;
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6', opacity: dim ? 0.55 : 1 }}>
      <td style={td}>{r.contact_name}</td>
      <td style={{ ...td, color: '#374151' }}>{r.email}</td>
      {TOGGLE_TYPES.map(t => (
        <td key={t.key} style={{ ...td, textAlign: 'center' }}>
          <Toggle
            checked={!!r[t.key]}
            disabled={!canEdit}
            onChange={v => onUpdate(r.id, { [t.key]: v } as any)}
          />
        </td>
      ))}
      <td style={{ ...td, textAlign: 'center' }}>
        <Toggle
          checked={r.is_active}
          disabled={!canEdit}
          onChange={v => onUpdate(r.id, { is_active: v })}
        />
      </td>
      {canEdit && (
        <td style={{ ...td, textAlign: 'center' }}>
          <button
            onClick={() => onRemove(r.id)}
            title="Remove contact"
            style={{
              padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
              color: '#9ca3af', cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            <Trash2 size={13} />
          </button>
        </td>
      )}
    </tr>
  );
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 32, height: 18, borderRadius: 999, border: 'none',
        background: checked ? '#10b981' : '#d1d5db',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        transition: 'left 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontSize: 10,
  fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: 0.3,
};
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12, color: '#111827' };
const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 12, outline: 'none', background: '#fff',
};
