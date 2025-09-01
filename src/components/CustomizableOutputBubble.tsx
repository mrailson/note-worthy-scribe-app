import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatUniversalText, detectContentType, TextFormatterOptions } from '@/lib/universalTextFormatter';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
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
  EyeOff
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

  const bubbleStyle = {
    fontFamily: getFontCss(customization.fontFamily),
    fontSize: `${customization.fontSize}px`,
    lineHeight: customization.lineHeight,
    borderRadius: `${customization.borderRadius}px`,
    padding: `${customization.padding}px`
  };

  const renderedContent = customization.useNHSStyling 
    ? renderNHSMarkdown(processedContent, { enableNHSStyling: true })
    : processedContent;

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

      {/* Content Display */}
      <div 
        className={`${customization.backgroundColor} rounded-lg overflow-hidden border border-border/50`}
        style={bubbleStyle}
      >
        <ScrollArea className="max-h-[600px]">
          {isPreviewMode ? (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-xs font-mono p-2 bg-muted/20 rounded">
              {processedContent}
            </pre>
          )}
        </ScrollArea>
      </div>

      {/* Format Enhancement Button */}
      {processedContent !== content && (
        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
          <WandSparkles className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary font-medium">
            Content has been enhanced with universal formatting
          </span>
        </div>
      )}
    </div>
  );
};