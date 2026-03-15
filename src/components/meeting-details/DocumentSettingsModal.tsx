import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Check, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useUserLogos, type LogoType } from '@/hooks/useUserLogos';
import { useUserDocumentSettings, type UserDocumentSettings } from '@/hooks/useUserDocumentSettings';
import { toast } from 'sonner';

const TYPE_BADGE: Record<string, { bg: string; fg: string }> = {
  practice:       { bg: '#E6F1FB', fg: '#0C447C' },
  pcn:            { bg: '#EAF3DE', fg: '#27500A' },
  neighbourhood:  { bg: '#FAEEDA', fg: '#633806' },
  organisation:   { bg: '#EEEDFE', fg: '#3C3489' },
};

const PILL_COLOURS: Record<string, { bg: string; fg: string }> = {
  logo:         { bg: '#E6F1FB', fg: '#0C447C' },
  footer:       { bg: '#EAF3DE', fg: '#27500A' },
  exec_summary: { bg: '#EEEDFE', fg: '#3C3489' },
  action_items: { bg: '#FAEEDA', fg: '#633806' },
  open_items:   { bg: '#fcebeb', fg: '#A32D2D' },
};

const TYPE_LABELS: Record<string, string> = {
  practice: 'Practice', pcn: 'PCN', neighbourhood: 'Neighbourhood', organisation: 'Organisation',
};

const SECTION_META: { key: keyof Pick<UserDocumentSettings, 'exec_summary_on' | 'action_items_on' | 'open_items_on'>; label: string; subtitle: string; pillKey: string }[] = [
  { key: 'exec_summary_on', label: 'Executive summary', subtitle: 'Key findings and context', pillKey: 'exec_summary' },
  { key: 'action_items_on', label: 'Action items', subtitle: 'Tasks with owners and due dates', pillKey: 'action_items' },
  { key: 'open_items_on', label: 'Open items', subtitle: 'Unresolved items requiring follow-up', pillKey: 'open_items' },
];

interface DocumentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: UserDocumentSettings) => void;
}

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}
function truncateName(name: string) {
  return name.split(/\s+/).slice(0, 2).join(' ');
}

const SpecToggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      width: 36, height: 20, borderRadius: 10, position: 'relative',
      background: checked ? '#003087' : '#9ca3af',
      border: 'none', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
    }}
  >
    <span style={{
      position: 'absolute', top: 3, left: checked ? 19 : 3,
      width: 14, height: 14, borderRadius: '50%', background: '#fff',
      transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,.15)',
    }} />
  </button>
);

export const DocumentSettingsModal: React.FC<DocumentSettingsModalProps> = ({ isOpen, onClose, onApply }) => {
  const { logos, activeLogo, setActiveLogo, addLogo } = useUserLogos();
  const { settings: savedSettings, saveSettings, loading: settingsLoading } = useUserDocumentSettings();

  const [localSettings, setLocalSettings] = useState<UserDocumentSettings>(savedSettings);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<LogoType>('practice');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync settings when loaded from DB
  useEffect(() => {
    if (!settingsLoading) setLocalSettings(savedSettings);
  }, [savedSettings, settingsLoading]);

  // KEY FIX: Radix Dialog continuously sets pointer-events:none on document.body.
  // Use a MutationObserver to persistently override it while our modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const force = () => {
      if (body.style.pointerEvents === 'none') {
        body.style.pointerEvents = 'auto';
      }
    };
    force();
    const observer = new MutationObserver(force);
    observer.observe(body, { attributes: true, attributeFilter: ['style'] });
    // Also use an interval as a fallback for inline style changes the observer may miss
    const interval = setInterval(force, 100);
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [isOpen, onClose]);

  const updateLocal = useCallback(<K extends keyof UserDocumentSettings>(key: K, value: UserDocumentSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleApply = useCallback(async () => {
    await saveSettings(localSettings);
    onApply(localSettings);
    onClose();
    toast.success('Document settings saved');
  }, [localSettings, saveSettings, onApply, onClose]);

  const handleSaveLogo = useCallback(async () => {
    if (!newName.trim()) { toast.error('Please enter a logo name'); return; }
    setIsSavingLogo(true);
    try {
      await addLogo({ name: newName.trim(), type: newType, file: newFile || undefined });
      setNewName(''); setNewType('practice'); setNewFile(null); setShowAddForm(false);
      toast.success('Logo added');
    } catch { toast.error('Failed to add logo'); }
    finally { setIsSavingLogo(false); }
  }, [newName, newType, newFile, addLogo]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && /\.(png|jpg|jpeg|svg|webp)$/i.test(f.name)) setNewFile(f);
  }, []);

  if (!isOpen) return null;

  const pills: { label: string; pillKey: string }[] = [];
  if (localSettings.logo_on) pills.push({ label: 'Logo', pillKey: 'logo' });
  if (localSettings.footer_on) pills.push({ label: 'Footer', pillKey: 'footer' });
  if (localSettings.exec_summary_on) pills.push({ label: 'Executive summary', pillKey: 'exec_summary' });
  if (localSettings.action_items_on) pills.push({ label: 'Action items', pillKey: 'action_items' });
  if (localSettings.open_items_on) pills.push({ label: 'Open items', pillKey: 'open_items' });

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483646, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 420,
        background: '#fff', borderRadius: 12, overflow: 'hidden',
        fontFamily: 'inherit', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{ background: '#003087', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#FFB81C', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>EXPORT STUDIO</p>
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 500, margin: '4px 0 0' }}>Document Settings</p>
            </div>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {/* DISPLAY */}
          <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>DISPLAY</p>

          {/* Logo section */}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 14 }}>Logo</span>
                {activeLogo && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{truncateName(activeLogo.name)}</p>}
              </div>
              <SpecToggle checked={localSettings.logo_on} onChange={v => updateLocal('logo_on', v)} />
            </div>

            {localSettings.logo_on && (
              <>
                {logos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                    {logos.map(logo => {
                      const sel = logo.is_active;
                      const b = TYPE_BADGE[logo.type] || TYPE_BADGE.practice;
                      return (
                        <button key={logo.id} type="button" onClick={() => setActiveLogo(logo.id)} style={{
                          position: 'relative', background: '#fff', borderRadius: 8,
                          border: sel ? '2px solid #003087' : '0.5px solid #e5e7eb',
                          padding: '10px 6px 8px', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        }}>
                          {sel && (
                            <span style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#003087', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={10} color="#fff" strokeWidth={3} />
                            </span>
                          )}
                          {logo.image_url ? (
                            <img src={logo.image_url} alt={logo.name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: b.bg, color: b.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
                              {getInitials(logo.name)}
                            </div>
                          )}
                          <span style={{ fontSize: 11, fontWeight: 500, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncateName(logo.name)}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: b.bg, color: b.fg }}>{TYPE_LABELS[logo.type]}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Position */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Position</span>
                  <select value={localSettings.logo_position} onChange={e => updateLocal('logo_position', e.target.value)} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                    <option value="left">Left</option>
                    <option value="centre">Centre</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                {/* Add logo */}
                {!showAddForm ? (
                  <button type="button" onClick={() => setShowAddForm(true)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1.5px dashed #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Plus size={14} /> Add logo
                  </button>
                ) : (
                  <div style={{ border: '0.5px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
                    <input autoFocus type="text" placeholder="Logo name" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #e5e7eb', marginBottom: 8, boxSizing: 'border-box', outline: 'none' }} />
                    <select value={newType} onChange={e => setNewType(e.target.value as LogoType)} style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #e5e7eb', marginBottom: 8, cursor: 'pointer' }}>
                      <option value="practice">Practice</option>
                      <option value="pcn">PCN</option>
                      <option value="neighbourhood">Neighbourhood</option>
                      <option value="organisation">Organisation</option>
                    </select>
                    <div onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={() => fileRef.current?.click()} style={{ border: '1.5px dashed #d1d5db', borderRadius: 8, padding: 10, textAlign: 'center', cursor: 'pointer', marginBottom: 8, fontSize: 11, color: '#9ca3af' }}>
                      <Upload size={16} style={{ margin: '0 auto 4px', display: 'block' }} />
                      {newFile ? newFile.name : 'Drop PNG, SVG or JPG here'}
                      <input ref={fileRef} type="file" accept=".png,.svg,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setNewFile(e.target.files[0]); }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => { setShowAddForm(false); setNewName(''); setNewFile(null); }} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '0.5px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                      <button type="button" onClick={handleSaveLogo} disabled={isSavingLogo} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#003087', color: '#fff', cursor: 'pointer', opacity: isSavingLogo ? 0.6 : 1 }}>
                        {isSavingLogo ? 'Saving\u2026' : 'Save logo'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14 }}>Footer</span>
            <SpecToggle checked={localSettings.footer_on} onChange={v => updateLocal('footer_on', v)} />
          </div>

          {/* SECTIONS */}
          <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>SECTIONS</p>

          <div style={{ background: '#f9fafb', borderRadius: 8, overflow: 'hidden' }}>
            {SECTION_META.map((sec, idx) => (
              <div key={sec.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: idx < SECTION_META.length - 1 ? '0.5px solid #e5e7eb' : 'none' }}>
                <div>
                  <p style={{ fontSize: 14, margin: 0 }}>{sec.label}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{sec.subtitle}</p>
                </div>
                <SpecToggle checked={localSettings[sec.key]} onChange={v => updateLocal(sec.key, v)} />
              </div>
            ))}
          </div>

          {/* Preview strip */}
          <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 6px' }}>Document will include:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {pills.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>No sections selected</span>}
              {pills.map(p => {
                const c = PILL_COLOURS[p.pillKey] || PILL_COLOURS.logo;
                return <span key={p.pillKey} style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.fg }}>{p.label}</span>;
              })}
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, padding: '9px 16px', borderRadius: 8, border: '0.5px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={handleApply} style={{ fontSize: 13, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#003087', color: '#fff', cursor: 'pointer' }}>Apply</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
