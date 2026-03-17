import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Plus, Check, Upload, Trash2, Monitor, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useUserLogos, type LogoType } from '@/hooks/useUserLogos';
import { useDocumentPreviewPrefs, type LogoPosition } from '@/hooks/useDocumentPreviewPrefs';
import { useAskAIExportDefaults, type ImageMode, type TextDensity } from '@/hooks/useAskAIExportDefaults';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TYPE_BADGE: Record<string, { bg: string; fg: string }> = {
  practice:       { bg: '#E6F1FB', fg: '#0C447C' },
  pcn:            { bg: '#EAF3DE', fg: '#27500A' },
  neighbourhood:  { bg: '#FAEEDA', fg: '#633806' },
  organisation:   { bg: '#EEEDFE', fg: '#3C3489' },
};

const TYPE_LABELS: Record<string, string> = {
  practice: 'Practice', pcn: 'PCN', neighbourhood: 'Neighbourhood', organisation: 'Organisation',
};

const INFOGRAPHIC_STYLES = [
  { key: 'practice-professional', label: 'Professional' },
  { key: 'clinical-governance', label: 'Governance' },
  { key: 'patient-safety', label: 'Patient Safety' },
  { key: 'team-engagement', label: 'Staff / Team' },
  { key: 'qof-targets', label: 'QOF & Targets' },
  { key: 'board-pack', label: 'Board Pack' },
  { key: 'icb-submission', label: 'ICB Submission' },
  { key: 'neighbourhood', label: 'Neighbourhood' },
];

const IMAGE_MODE_OPTIONS: { value: ImageMode; label: string; desc: string }[] = [
  { value: 'noImages', label: 'None', desc: 'Text-only slides' },
  { value: 'pictographic', label: 'Icons', desc: 'Simple icon graphics' },
  { value: 'webFreeToUseCommercially', label: 'Web Photos', desc: 'Stock photography' },
  { value: 'aiGenerated', label: 'Illustrations', desc: 'AI-generated visuals' },
];

const TEXT_DENSITY_OPTIONS: { value: TextDensity; label: string }[] = [
  { value: 'brief', label: 'Brief' },
  { value: 'medium', label: 'Medium' },
  { value: 'detailed', label: 'Detailed' },
];

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

interface AskAIDocumentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AskAIDocumentSettingsModal: React.FC<AskAIDocumentSettingsModalProps> = ({ isOpen, onClose }) => {
  const { logos, activeLogo, setActiveLogo, addLogo, deleteLogo } = useUserLogos();
  const { prefs, updatePref } = useDocumentPreviewPrefs();
  const { defaults, updateDefault } = useAskAIExportDefaults();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<LogoType>('practice');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedThumb, setExpandedThumb] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleDeleteLogo = useCallback(async (logoId: string) => {
    try {
      await deleteLogo(logoId);
      setConfirmDeleteId(null);
      toast.success('Logo removed');
    } catch { toast.error('Failed to remove logo'); }
  }, [deleteLogo]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && /\.(png|jpg|jpeg|svg|webp)$/i.test(f.name)) setNewFile(f);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[420px] p-0 overflow-hidden border-none bg-transparent shadow-none [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Document Settings</DialogTitle>
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
                <p style={{ color: '#FFB81C', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>ASK AI</p>
                <p style={{ color: '#fff', fontSize: 15, fontWeight: 500, margin: '4px 0 0' }}>Document Settings</p>
              </div>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

            {/* ── DISPLAY ── */}
            <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>DISPLAY</p>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 14 }}>Logo</span>
                  {activeLogo && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{truncateName(activeLogo.name)}</p>}
                </div>
                <SpecToggle checked={prefs.showLogo} onChange={v => updatePref('showLogo', v)} />
              </div>

              {prefs.showLogo && (
                <>
                  {logos.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                      {logos.map(logo => {
                        const sel = logo.is_active;
                        const b = TYPE_BADGE[logo.type] || TYPE_BADGE.practice;
                        const isDeleting = confirmDeleteId === logo.id;
                        return (
                          <div key={logo.id} style={{ position: 'relative' }}>
                            <button type="button" onClick={() => setActiveLogo(logo.id)} style={{
                              position: 'relative', background: '#fff', borderRadius: 8, width: '100%',
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
                            {!logo.is_practice_logo && (isDeleting ? (
                              <div style={{
                                position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', borderRadius: 8,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, zIndex: 5,
                                border: '1px solid #fca5a5',
                              }}>
                                <p style={{ fontSize: 10, color: '#dc2626', fontWeight: 500, textAlign: 'center', margin: 0, lineHeight: 1.3 }}>Remove?</p>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button type="button" onClick={() => setConfirmDeleteId(null)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '0.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#374151' }}>No</button>
                                  <button type="button" onClick={() => handleDeleteLogo(logo.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}>Yes</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(logo.id); }}
                                style={{
                                  position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: '50%',
                                  background: '#fff', border: '0.5px solid #e5e7eb', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  opacity: 0.6, transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                                title="Remove logo"
                              >
                                <Trash2 size={10} color="#dc2626" />
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Position */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>Position</span>
                    <select value={prefs.logoPosition} onChange={e => updatePref('logoPosition', e.target.value as LogoPosition)} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
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
                          {isSavingLogo ? 'Saving…' : 'Save logo'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Footer toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #e5e7eb' }}>
                <div>
                  <span style={{ fontSize: 14 }}>Footer</span>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Practice name and classification</p>
                </div>
                <SpecToggle checked={prefs.showFooter} onChange={v => updatePref('showFooter', v)} />
              </div>

              {/* PDF Download toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #e5e7eb' }}>
                <div>
                  <span style={{ fontSize: 14 }}>PDF Download</span>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Show PDF export option</p>
                </div>
                <SpecToggle checked={prefs.showPdfDownload} onChange={v => updatePref('showPdfDownload', v)} />
              </div>
            </div>

            {/* ── INFOGRAPHIC DEFAULTS ── */}
            <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>INFOGRAPHIC DEFAULTS</p>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              {/* Style gallery */}
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Select a style — click to preview</p>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {INFOGRAPHIC_STYLES.map(({ key, label }) => {
                  const thumb = `/images/infographic-thumbnails/${key}.png`;
                  const selected = defaults.defaultInfographicStyle === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        updateDefault('defaultInfographicStyle', key);
                        setExpandedThumb(expandedThumb === key ? null : key);
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        flexShrink: 0, borderRadius: 6, padding: 4, transition: 'all 0.15s',
                        border: selected ? '2px solid #003087' : '2px solid transparent',
                        background: selected ? 'rgba(0,48,135,0.05)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <img
                        src={thumb}
                        alt={label}
                        style={{ borderRadius: 4, width: 68, height: 48, objectFit: 'cover', objectPosition: 'top' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span style={{
                        fontSize: 9, lineHeight: 1.2, textAlign: 'center', maxWidth: 68,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: selected ? 600 : 400,
                        color: selected ? '#003087' : '#6b7280',
                      }}>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Expanded preview */}
              {expandedThumb && (
                <div style={{ position: 'relative', marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setExpandedThumb(null)}
                    style={{ position: 'absolute', top: 4, right: 4, zIndex: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', border: 'none', padding: 2, cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                  <img
                    src={`/images/infographic-thumbnails/${expandedThumb}.png`}
                    alt="Style preview"
                    style={{ borderRadius: 6, border: '1px solid #e5e7eb', width: '100%', maxHeight: 312, objectFit: 'contain', cursor: 'pointer' }}
                    onClick={() => setExpandedThumb(null)}
                  />
                </div>
              )}

              {/* Orientation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Default orientation</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['landscape', 'portrait'] as const).map(orient => (
                    <button
                      key={orient}
                      type="button"
                      onClick={() => updateDefault('defaultInfographicOrientation', orient)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        border: defaults.defaultInfographicOrientation === orient ? '1.5px solid #003087' : '0.5px solid #e5e7eb',
                        background: defaults.defaultInfographicOrientation === orient ? 'rgba(0,48,135,0.05)' : '#fff',
                        color: defaults.defaultInfographicOrientation === orient ? '#003087' : '#374151',
                        fontWeight: defaults.defaultInfographicOrientation === orient ? 500 : 400,
                      }}
                    >
                      {orient === 'landscape' ? <Monitor size={12} /> : <ImageIcon size={12} />}
                      {orient.charAt(0).toUpperCase() + orient.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo in infographic */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Include logo in infographic</span>
                <SpecToggle checked={defaults.includeLogoInInfographic} onChange={v => updateDefault('includeLogoInInfographic', v)} />
              </div>
            </div>

            {/* ── SLIDES DEFAULTS ── */}
            <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>SLIDES DEFAULTS</p>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              {/* Image mode */}
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Image style</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
                {IMAGE_MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateDefault('defaultImageMode', opt.value)}
                    style={{
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: defaults.defaultImageMode === opt.value ? '1.5px solid #003087' : '0.5px solid #e5e7eb',
                      background: defaults.defaultImageMode === opt.value ? 'rgba(0,48,135,0.05)' : '#fff',
                    }}
                  >
                    <p style={{ fontSize: 13, margin: 0, fontWeight: defaults.defaultImageMode === opt.value ? 600 : 400, color: defaults.defaultImageMode === opt.value ? '#003087' : '#374151' }}>{opt.label}</p>
                    <p style={{ fontSize: 10, margin: '2px 0 0', color: '#9ca3af' }}>{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Text density */}
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Text density</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {TEXT_DENSITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateDefault('defaultTextDensity', opt.value)}
                    style={{
                      flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      fontSize: 13, fontWeight: defaults.defaultTextDensity === opt.value ? 600 : 400,
                      border: defaults.defaultTextDensity === opt.value ? '1.5px solid #003087' : '0.5px solid #e5e7eb',
                      background: defaults.defaultTextDensity === opt.value ? 'rgba(0,48,135,0.05)' : '#fff',
                      color: defaults.defaultTextDensity === opt.value ? '#003087' : '#374151',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ fontSize: 13, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#003087', color: '#fff', cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
