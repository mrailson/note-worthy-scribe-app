import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, X, Search, Star, Diamond, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Theme definitions ────────────────────────────────────────
export interface SlideTheme {
  key: string;
  label: string;
  primary: string;
  accent: string;
  bg: string;
}

export const SLIDE_THEMES: SlideTheme[] = [
  { key: 'nhs-blue',       label: 'NHS Blue',       primary: '#003087', accent: '#FFB81C', bg: '#E6F1FB' },
  { key: 'nhs-green',      label: 'NHS Green',      primary: '#006747', accent: '#FFB81C', bg: '#EAF3DE' },
  { key: 'governance',     label: 'Governance',     primary: '#2C3E50', accent: '#3498DB', bg: '#EEF2F7' },
  { key: 'board-pack',     label: 'Board Pack',     primary: '#1a1a2e', accent: '#e94560', bg: '#f0f0f0' },
  { key: 'icb-submission', label: 'ICB Submission', primary: '#005EB8', accent: '#41B6E6', bg: '#E8F4FD' },
  { key: 'patient-safety', label: 'Patient Safety', primary: '#8B0000', accent: '#FFD700', bg: '#FFF5F5' },
  { key: 'clinical',       label: 'Clinical',       primary: '#006747', accent: '#7DC242', bg: '#F0FFF4' },
  { key: 'minimal',        label: 'Minimal',        primary: '#374151', accent: '#6B7280', bg: '#F9FAFB' },
];

// ─── Types ────────────────────────────────────────────────────
export type SlideCount = 'auto' | 6 | 8 | 10 | 12;
export type TextDensity = 'brief' | 'medium' | 'detailed';
export type ImageMode = 'noImages' | 'pictographic' | 'webFreeToUseCommercially' | 'aiGenerated';

export interface SlidePickerConfig {
  theme: SlideTheme;
  slideCount: SlideCount;
  textDensity: TextDensity;
  imageMode: ImageMode;
  speakerNotes: boolean;
  includeLogo: boolean;
  titleClosingSlide: boolean;
}

export interface SlideGenerationResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

interface SlidesStylePickerProps {
  logoUrl?: string | null;
  onGenerate: (config: SlidePickerConfig) => Promise<SlideGenerationResult>;
}

// ─── Mini slide thumbnail (CSS only) ──────────────────────────
const ThemeThumbnail: React.FC<{ theme: SlideTheme }> = ({ theme }) => (
  <div
    className="w-full aspect-video rounded-[3px] overflow-hidden flex flex-col"
    style={{ background: theme.bg }}
  >
    {/* Header bar - 28% */}
    <div className="flex items-end px-2 pb-1" style={{ background: theme.primary, height: '28%' }}>
      <div className="rounded-full" style={{ background: theme.accent, width: '60%', height: 3 }} />
    </div>
    {/* Content - 62% */}
    <div className="flex-1 flex flex-col justify-center gap-[3px] px-2.5 py-1">
      <div className="rounded-full" style={{ background: theme.primary, opacity: 0.35, height: 2, width: '80%' }} />
      <div className="rounded-full" style={{ background: theme.primary, opacity: 0.2, height: 2, width: '65%' }} />
      <div className="rounded-full" style={{ background: theme.primary, opacity: 0.15, height: 2, width: '50%' }} />
    </div>
    {/* Footer strip - 10% */}
    <div style={{ background: theme.primary, opacity: 0.08, height: '10%' }} />
  </div>
);

// ─── Custom toggle (matches Document Settings exactly) ────────
const NhsToggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="relative inline-flex shrink-0 cursor-pointer transition-colors duration-200"
    style={{
      width: 36,
      height: 20,
      borderRadius: 10,
      background: checked ? '#003087' : '#9ca3af',
    }}
  >
    <span
      className="pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200"
      style={{
        width: 14,
        height: 14,
        position: 'absolute',
        top: 3,
        left: checked ? 19 : 3,
      }}
    />
  </button>
);

// ─── Component ────────────────────────────────────────────────
export const SlidesStylePicker: React.FC<SlidesStylePickerProps> = ({
  logoUrl,
  onGenerate,
  isGenerating,
  generationProgress,
  generationPhase,
  generationSubPhase,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<SlideTheme>(SLIDE_THEMES[0]);
  const [themeExpanded, setThemeExpanded] = useState(false);
  const [slideCount, setSlideCount] = useState<SlideCount>('auto');
  const [textDensity, setTextDensity] = useState<TextDensity>('brief');
  const [imageMode, setImageMode] = useState<ImageMode>('noImages');
  const [speakerNotes, setSpeakerNotes] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [titleClosingSlide, setTitleClosingSlide] = useState(true);

  const slideCountOptions: { label: string; value: SlideCount }[] = [
    { label: 'Auto', value: 'auto' },
    { label: '6', value: 6 },
    { label: '8', value: 8 },
    { label: '10', value: 10 },
    { label: '12', value: 12 },
  ];

  const textDensityOptions: { label: string; value: TextDensity }[] = [
    { label: 'Brief', value: 'brief' },
    { label: 'Medium', value: 'medium' },
    { label: 'Detailed', value: 'detailed' },
  ];

  const imageModeOptions: { label: string; subtitle: string; icon: React.ReactNode; value: ImageMode }[] = [
    { label: 'None', subtitle: 'Clean, text only', icon: <X className="h-3.5 w-3.5" />, value: 'noImages' },
    { label: 'Icons', subtitle: 'Pictographic', icon: <Diamond className="h-3.5 w-3.5" />, value: 'pictographic' },
    { label: 'Web photos', subtitle: 'Curated library', icon: <Search className="h-3.5 w-3.5" />, value: 'webFreeToUseCommercially' },
    { label: 'Illustrations', subtitle: 'Generated visuals', icon: <Star className="h-3.5 w-3.5" />, value: 'aiGenerated' },
  ];

  const handleGenerate = () => {
    onGenerate({
      theme: selectedTheme,
      slideCount,
      textDensity,
      imageMode,
      speakerNotes,
      includeLogo,
      titleClosingSlide,
    });
  };

  // ─── Summary pills ───────────────────────────────────────
  const pills: { label: string; bg: string; color: string }[] = [
    { label: selectedTheme.label, bg: selectedTheme.bg, color: selectedTheme.primary },
    { label: slideCount === 'auto' ? 'Auto slides' : `${slideCount} slides`, bg: '#EEEDFE', color: '#3C3489' },
    { label: textDensity.charAt(0).toUpperCase() + textDensity.slice(1), bg: '#EAF3DE', color: '#27500A' },
    { label: imageModeOptions.find(o => o.value === imageMode)?.label || 'None', bg: '#E6F1FB', color: '#0C447C' },
  ];
  if (speakerNotes) pills.push({ label: 'Speaker notes', bg: '#FAEEDA', color: '#633806' });
  if (includeLogo) pills.push({ label: 'Logo', bg: '#E6F1FB', color: '#0C447C' });
  if (titleClosingSlide) pills.push({ label: 'Title + closing', bg: '#EAF3DE', color: '#27500A' });

  // Button style helper
  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#003087' : '#ffffff',
    color: active ? '#ffffff' : undefined,
    border: active ? '1px solid #003087' : '0.5px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 11,
    padding: '5px 12px',
    fontWeight: 500,
    cursor: 'pointer',
  });

  return (
    <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
      {/* Header */}
      <div className="rounded-lg px-3 py-2" style={{ background: '#003087' }}>
        <p style={{ color: '#FFB81C', fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const }}>
          Export Studio · Slides
        </p>
        <p style={{ color: '#ffffff', fontSize: 13, fontWeight: 500 }}>Create as PowerPoint</p>
      </div>

      {/* SECTION 1 — Theme thumbnails (collapsible, collapsed by default) */}
      <div>
        <button
          type="button"
          onClick={() => setThemeExpanded(prev => !prev)}
          className="flex items-center justify-between w-full"
          style={{ marginBottom: themeExpanded ? 8 : 0 }}
        >
          <span style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase' as const }}>
            Theme — {selectedTheme.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-full"
              style={{ width: 10, height: 10, background: selectedTheme.primary, border: '1px solid #e5e7eb' }}
            />
            {themeExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </button>
        {themeExpanded && (
          <div className="grid grid-cols-4 gap-2">
            {SLIDE_THEMES.map((theme) => (
              <button
                key={theme.key}
                type="button"
                onClick={() => setSelectedTheme(theme)}
                className="flex flex-col items-center gap-1 transition-all"
                style={{
                  border: selectedTheme.key === theme.key ? '2px solid #003087' : '2px solid transparent',
                  borderRadius: 6,
                  padding: 3,
                }}
                onMouseEnter={(e) => {
                  if (selectedTheme.key !== theme.key) e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={(e) => {
                  if (selectedTheme.key !== theme.key) e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <ThemeThumbnail theme={theme} />
                <span style={{ fontSize: 10, color: selectedTheme.key === theme.key ? '#003087' : '#6b7280' }}>
                  {theme.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2 — Slide count + Text density */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 8 }}>
            Slide count
          </p>
          <div className="flex flex-wrap gap-1">
            {slideCountOptions.map(o => (
              <button key={String(o.value)} type="button" style={btnStyle(slideCount === o.value)} onClick={() => setSlideCount(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 8 }}>
            Text density
          </p>
          <div className="flex flex-wrap gap-1">
            {textDensityOptions.map(o => (
              <button key={o.value} type="button" style={btnStyle(textDensity === o.value)} onClick={() => setTextDensity(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3 — Image mode */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 8 }}>
          Images
        </p>
        <div
          className="grid grid-cols-4 overflow-hidden"
          style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8 }}
        >
          {imageModeOptions.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setImageMode(opt.value)}
              className="flex flex-col items-center gap-0.5 py-2.5 px-1 transition-colors"
              style={{
                background: imageMode === opt.value ? 'rgba(0,48,135,0.06)' : 'transparent',
                borderRight: idx < 3 ? '0.5px solid #e5e7eb' : undefined,
              }}
            >
              <span style={{ color: imageMode === opt.value ? '#003087' : '#6b7280' }}>
                {opt.icon}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: imageMode === opt.value ? 500 : 400,
                color: imageMode === opt.value ? '#003087' : undefined,
              }}>
                {opt.label}
              </span>
              <span style={{ fontSize: 9, color: '#9ca3af' }}>{opt.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 4 — Options toggles */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 8 }}>
          Options
        </p>
        <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8 }} className="overflow-hidden">
          {[
            { label: 'Speaker notes', subtitle: 'One talking-point note per slide', checked: speakerNotes, onChange: setSpeakerNotes },
            { label: 'Include logo', subtitle: 'From your active logo in Document Settings', checked: includeLogo, onChange: setIncludeLogo },
            { label: 'Title + closing slide', subtitle: 'Auto-generated cover and thank-you slides', checked: titleClosingSlide, onChange: setTitleClosingSlide },
          ].map((opt, idx) => (
            <div
              key={opt.label}
              className="flex items-center justify-between px-3 py-2.5"
              style={{ borderTop: idx > 0 ? '0.5px solid #e5e7eb' : undefined }}
            >
              <div>
                <p style={{ fontSize: 11, fontWeight: 500 }}>{opt.label}</p>
                <p style={{ fontSize: 10, color: '#9ca3af' }}>{opt.subtitle}</p>
              </div>
              <NhsToggle checked={opt.checked} onChange={opt.onChange} />
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5 — Summary pills */}
      <div
        className="flex flex-wrap items-center gap-1.5"
        style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}
      >
        <span style={{ fontSize: 10, color: '#9ca3af', marginRight: 2 }}>Will generate:</span>
        {pills.map((pill) => (
          <span
            key={pill.label}
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 20,
              background: pill.bg,
              color: pill.color,
            }}
          >
            {pill.label}
          </span>
        ))}
      </div>

      {/* SECTION 6 — Generate button / Progress */}
      {!isGenerating ? (
        <button
          type="button"
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 transition-colors hover:opacity-90"
          style={{
            background: '#003087',
            color: '#ffffff',
            borderRadius: 8,
            padding: 11,
            fontSize: 13,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Sparkles className="h-4 w-4" />
          Generate Presentation
        </button>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{generationPhase}</span>
            <span style={{ fontSize: 11, color: '#003087', fontWeight: 500 }}>{generationProgress}%</span>
          </div>
          <div className="w-full overflow-hidden" style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${generationProgress}%`,
                background: 'linear-gradient(90deg, #009639, #003087)',
                borderRadius: 2,
              }}
            />
          </div>
          <p style={{ fontSize: 10, color: '#9ca3af' }}>{generationSubPhase}</p>
        </div>
      )}
    </div>
  );
};
