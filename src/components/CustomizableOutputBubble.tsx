import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatUniversalText, detectContentType, TextFormatterOptions } from '@/lib/universalTextFormatter';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { applyTextFormatting } from '@/utils/textFormatting';
import { 
  Copy, 
  Settings, 
  Type, 
  Palette, 
  RotateCcw,
  Download,
  FileText,
  Presentation,
  WandSparkles,
  Eye,
  EyeOff,
  Paintbrush,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Minus,
  ArrowRight,
  Hash,
  Eraser,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export interface BubbleCustomization {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  padding: number;
  useNHSStyling: boolean;
  contentType: TextFormatterOptions['contentType'];
  enhanceReadability: boolean;
  addSmartBreaks: boolean;
}

const DEFAULT_CUSTOMIZATION: BubbleCustomization = {
  fontFamily: 'system',
  fontSize: 14,
  lineHeight: 1.6,
  backgroundColor: 'bg-muted/30',
  textColor: 'text-foreground',
  borderRadius: 8,
  padding: 16,
  useNHSStyling: true,
  contentType: 'general',
  enhanceReadability: true,
  addSmartBreaks: true
};

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default', css: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  { value: 'inter', label: 'Inter', css: 'Inter, system-ui, sans-serif' },
  { value: 'georgia', label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { value: 'mono', label: 'Monospace', css: '"SF Mono", Monaco, "Cascadia Code", monospace' },
  { value: 'open-sans', label: 'Open Sans', css: '"Open Sans", system-ui, sans-serif' }
];

const BACKGROUND_OPTIONS = [
  { value: 'bg-muted/30', label: 'Default Muted', preview: '#f1f5f9' },
  { value: 'bg-background', label: 'Clean White', preview: '#ffffff' },
  { value: 'bg-primary/5', label: 'Subtle Primary', preview: '#e0f2fe' },
  { value: 'bg-secondary/20', label: 'Light Secondary', preview: '#f8fafc' },
  { value: 'bg-accent/10', label: 'Soft Accent', preview: '#fef3c7' },
  { value: 'bg-gradient-to-br from-background to-muted/20', label: 'Gradient', preview: 'linear-gradient(135deg, #ffffff, #f1f5f9)' }
];

interface CustomizableOutputBubbleProps {
  content: string;
  title?: string;
  onExportWord?: (content: string, title?: string) => void;
  onExportPowerPoint?: (content: string, title?: string) => void;
  className?: string;
  defaultCustomization?: Partial<BubbleCustomization>;
}

export const CustomizableOutputBubble: React.FC<CustomizableOutputBubbleProps> = ({
  content,
  title = 'Generated Content',
  onExportWord,
  onExportPowerPoint,
  className = '',
  defaultCustomization = {}
}) => {
  const [customization, setCustomization] = useState<BubbleCustomization>({
    ...DEFAULT_CUSTOMIZATION,
    ...defaultCustomization
  });
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [processedContent, setProcessedContent] = useState('');
  const [quickFormatContent, setQuickFormatContent] = useState('');
  const [isQuickFormatOpen, setIsQuickFormatOpen] = useState(false);

  // Auto-detect content type and apply formatting
  useEffect(() => {
    if (content) {
      const detectedType = detectContentType(content);
      const formattedContent = formatUniversalText(content, {
        contentType: customization.contentType || detectedType,
        enhanceReadability: customization.enhanceReadability,
        addSmartBreaks: customization.addSmartBreaks
      });
      setProcessedContent(formattedContent);
      setQuickFormatContent(formattedContent);
      
      // Update content type if different from current
      if (detectedType !== customization.contentType) {
        setCustomization(prev => ({ ...prev, contentType: detectedType }));
      }
    }
  }, [content, customization.contentType, customization.enhanceReadability, customization.addSmartBreaks]);

  const handleCustomizationChange = (key: keyof BubbleCustomization, value: any) => {
    setCustomization(prev => ({ ...prev, [key]: value }));
  };

  const resetCustomization = () => {
    setCustomization(DEFAULT_CUSTOMIZATION);
    toast.success('Styling reset to defaults');
  };

  const copyContent = () => {
    navigator.clipboard.writeText(processedContent);
    toast.success('Content copied to clipboard');
  };

  const handleExportWord = () => {
    if (onExportWord) {
      onExportWord(processedContent, title);
    }
  };

  const handleExportPowerPoint = () => {
    if (onExportPowerPoint) {
      onExportPowerPoint(processedContent, title);
    }
  };

  const getFontCss = (fontValue: string) => {
    return FONT_OPTIONS.find(f => f.value === fontValue)?.css || FONT_OPTIONS[0].css;
  };

  // Quick format functions
  const applyQuickFormat = (formatType: string) => {
    const formatted = applyTextFormatting(quickFormatContent, formatType);
    setQuickFormatContent(formatted);
    toast.success(`Applied ${formatType.replace('-', ' ')}`);
  };

  const resetQuickFormat = () => {
    setQuickFormatContent(processedContent);
    toast.success('Reset to original formatting');
  };

  const applyTitleColor = (color: string) => {
    // Apply title color by wrapping titles in span with color
    const formatted = quickFormatContent.replace(/^(#{1,6}\s+)(.*?)$/gm, `$1<span style="color: ${color}">$2</span>`);
    setQuickFormatContent(formatted);
    toast.success('Title color applied');
  };

  const toggleTitleUnderline = () => {
    const formatted = quickFormatContent.replace(/^(#{1,6}\s+)(.*?)$/gm, '$1<u>$2</u>');
    setQuickFormatContent(formatted);
    toast.success('Title underline applied');
  };

  const bubbleStyle = {
    fontFamily: getFontCss(customization.fontFamily),
    fontSize: `${customization.fontSize}px`,
    lineHeight: customization.lineHeight,
    borderRadius: `${customization.borderRadius}px`,
    padding: `${customization.padding}px`
  };

  const renderedContent = customization.useNHSStyling 
    ? renderNHSMarkdown(quickFormatContent, { enableNHSStyling: true })
    : quickFormatContent;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            {customization.contentType}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Preview Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="h-8 px-2"
          >
            {isPreviewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>

          {/* Styling Controls */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Settings className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Output Styling</h4>
                  <Button variant="ghost" size="sm" onClick={resetCustomization}>
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <label className="text-xs font-medium flex items-center gap-1">
                    <Type className="w-3 h-3" />
                    Font Family
                  </label>
                  <select
                    value={customization.fontFamily}
                    onChange={(e) => handleCustomizationChange('fontFamily', e.target.value)}
                    className="w-full p-2 text-xs border rounded"
                  >
                    {FONT_OPTIONS.map(font => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Font Size: {customization.fontSize}px</label>
                  <Slider
                    value={[customization.fontSize]}
                    onValueChange={([value]) => handleCustomizationChange('fontSize', value)}
                    min={10}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Line Height */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Line Height: {customization.lineHeight}</label>
                  <Slider
                    value={[customization.lineHeight]}
                    onValueChange={([value]) => handleCustomizationChange('lineHeight', value)}
                    min={1.2}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                {/* Background */}
                <div className="space-y-2">
                  <label className="text-xs font-medium flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    Background
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {BACKGROUND_OPTIONS.map(bg => (
                      <button
                        key={bg.value}
                        onClick={() => handleCustomizationChange('backgroundColor', bg.value)}
                        className={`p-2 border rounded text-left ${
                          customization.backgroundColor === bg.value ? 'border-primary' : 'border-border'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Type */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Content Type</label>
                  <select
                    value={customization.contentType}
                    onChange={(e) => handleCustomizationChange('contentType', e.target.value as TextFormatterOptions['contentType'])}
                    className="w-full p-2 text-xs border rounded"
                  >
                    <option value="general">General</option>
                    <option value="clinical">Clinical/Medical</option>
                    <option value="meeting-notes">Meeting Notes</option>
                    <option value="drug-info">Drug Information</option>
                  </select>
                </div>

                {/* Formatting Options */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Formatting Options</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={customization.useNHSStyling}
                        onChange={(e) => handleCustomizationChange('useNHSStyling', e.target.checked)}
                      />
                      NHS Styling
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={customization.enhanceReadability}
                        onChange={(e) => handleCustomizationChange('enhanceReadability', e.target.checked)}
                      />
                      Enhance Readability
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={customization.addSmartBreaks}
                        onChange={(e) => handleCustomizationChange('addSmartBreaks', e.target.checked)}
                      />
                      Smart Line Breaks
                    </label>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export Controls */}
          <Button variant="ghost" size="sm" onClick={copyContent} className="h-8 px-2">
            <Copy className="w-4 h-4" />
          </Button>
          
          {onExportWord && (
            <Button variant="ghost" size="sm" onClick={handleExportWord} className="h-8 px-2">
              <FileText className="w-4 h-4" />
            </Button>
          )}
          
          {onExportPowerPoint && (
            <Button variant="ghost" size="sm" onClick={handleExportPowerPoint} className="h-8 px-2">
              <Presentation className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content Display with Quick Format Icon */}
      <div 
        className={`${customization.backgroundColor} rounded-lg overflow-hidden border border-border/50 relative group`}
        style={bubbleStyle}
      >
        {/* Floating Quick Format Icon */}
        <Popover open={isQuickFormatOpen} onOpenChange={setIsQuickFormatOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 left-2 h-7 w-7 p-0 opacity-60 hover:opacity-100 transition-opacity z-10 group-hover:opacity-100"
            >
              <Paintbrush className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start" side="right">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Quick Format</h4>
                <Button variant="ghost" size="sm" onClick={resetQuickFormat} className="h-6 px-1">
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>

              {/* Bullet Controls */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Bullet Points</label>
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFormat('format-remove-formatting')}
                    className="h-7 text-xs"
                  >
                    <Eraser className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFormat('format-bullet-points')}
                    className="h-7 text-xs"
                  >
                    <List className="w-3 h-3 mr-1" />
                    Add •
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const formatted = quickFormatContent.replace(/^\s*[•·→]\s+/gm, '- ');
                      setQuickFormatContent(formatted);
                      toast.success('Changed to dash bullets');
                    }}
                    className="h-7 text-xs"
                  >
                    <Minus className="w-3 h-3 mr-1" />
                    Dash -
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const formatted = quickFormatContent.replace(/^\s*[•-]\s+/gm, '→ ');
                      setQuickFormatContent(formatted);
                      toast.success('Changed to arrow bullets');
                    }}
                    className="h-7 text-xs"
                  >
                    <ArrowRight className="w-3 h-3 mr-1" />
                    Arrow →
                  </Button>
                </div>
              </div>

              {/* Title Formatting */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Title Formatting</label>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyTitleColor('hsl(var(--primary))')}
                    className="h-7 text-xs"
                  >
                    <div className="w-2 h-2 bg-primary rounded mr-1" />
                    Primary
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyTitleColor('hsl(217, 91%, 60%)')}
                    className="h-7 text-xs"
                  >
                    <div className="w-2 h-2 bg-blue-500 rounded mr-1" />
                    NHS Blue
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyTitleColor('hsl(142, 76%, 36%)')}
                    className="h-7 text-xs"
                  >
                    <div className="w-2 h-2 bg-green-600 rounded mr-1" />
                    Clinical
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickFormat('format-bold-titles')}
                    className="h-7 text-xs"
                  >
                    <Bold className="w-3 h-3 mr-1" />
                    Bold
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleTitleUnderline}
                    className="h-7 text-xs"
                  >
                    <Underline className="w-3 h-3 mr-1" />
                    Underline
                  </Button>
                </div>
              </div>

              {/* Text Styling */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Quick Presets</label>
                <div className="grid grid-cols-1 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleCustomizationChange('fontFamily', 'system');
                      handleCustomizationChange('fontSize', 14);
                      handleCustomizationChange('lineHeight', 1.6);
                      toast.success('Applied readable preset');
                    }}
                    className="h-7 text-xs justify-start"
                  >
                    📖 Readable
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleCustomizationChange('fontFamily', 'mono');
                      handleCustomizationChange('fontSize', 12);
                      handleCustomizationChange('lineHeight', 1.4);
                      toast.success('Applied compact preset');
                    }}
                    className="h-7 text-xs justify-start"
                  >
                    📄 Compact
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleCustomizationChange('fontFamily', 'georgia');
                      handleCustomizationChange('fontSize', 16);
                      handleCustomizationChange('lineHeight', 1.8);
                      handleCustomizationChange('backgroundColor', 'bg-background');
                      toast.success('Applied print preset');
                    }}
                    className="h-7 text-xs justify-start"
                  >
                    🖨️ Print
                  </Button>
                </div>
              </div>

              {/* Content Actions */}
              <div className="grid grid-cols-2 gap-1 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyQuickFormat('standardize-all')}
                  className="h-7 text-xs"
                >
                  <WandSparkles className="w-3 h-3 mr-1" />
                  Polish
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyQuickFormat('format-headers')}
                  className="h-7 text-xs"
                >
                  <Hash className="w-3 h-3 mr-1" />
                  Headers
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <ScrollArea className="max-h-[800px] md:max-h-none">
          {isPreviewMode ? (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-xs font-mono p-2 bg-muted/20 rounded">
              {quickFormatContent}
            </pre>
          )}
        </ScrollArea>
      </div>

      {/* Format Enhancement Button */}
      {(processedContent !== content || quickFormatContent !== processedContent) && (
        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
          <WandSparkles className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary font-medium">
            {quickFormatContent !== processedContent 
              ? 'Content has been quick-formatted' 
              : 'Content has been enhanced with universal formatting'
            }
          </span>
        </div>
      )}
    </div>
  );
};