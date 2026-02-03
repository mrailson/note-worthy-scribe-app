import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, AlertTriangle, Loader2, BookOpen, Copy, Check, RefreshCw, Image, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { TLVocabItem } from '@/hooks/useTrafficLightVocab';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface BNFDrugDetailPageProps {
  drugName: string;
  trafficLightItem?: TLVocabItem;
  onBack: () => void;
  onInsertToChat?: (text: string) => void;
}

interface DrugMonograph {
  drugName: string;
  indications: string[];
  dosing: {
    adult: string;
    elderly?: string;
    renalAdjustment?: string;
    paediatric?: string;
  };
  contraindications: string[];
  cautions: string[];
  interactions: string[];
  sideEffects: {
    common: string[];
    serious: string[];
  };
  monitoring: string[];
  pregnancyBreastfeeding: string;
  patientCounselling: string[];
  bnfChapter?: string;
  lastUpdated?: string;
}

const getStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
  
  if (statusLower.includes('green') || statusLower === 'green') {
    return { label: 'GREEN', className: 'bg-green-100 text-green-800 border-green-200' };
  }
  if (statusLower.includes('double') || statusLower === 'double_red') {
    return { label: 'DOUBLE RED', className: 'bg-red-200 text-red-900 border-red-300' };
  }
  if (statusLower.includes('red') || statusLower === 'red') {
    return { label: 'RED', className: 'bg-red-100 text-red-800 border-red-200' };
  }
  if (statusLower.includes('amber') || statusLower === 'amber') {
    return { label: 'AMBER', className: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  if (statusLower.includes('specialist') || statusLower === 'specialist_initiated') {
    return { label: 'SPECIALIST', className: 'bg-purple-100 text-purple-800 border-purple-200' };
  }
  if (statusLower.includes('hospital') || statusLower === 'hospital_only') {
    return { label: 'HOSPITAL', className: 'bg-slate-100 text-slate-800 border-slate-200' };
  }
  
  return { label: 'BNF', className: 'bg-blue-100 text-blue-800 border-blue-200' };
};

export const BNFDrugDetailPage: React.FC<BNFDrugDetailPageProps> = ({
  drugName,
  trafficLightItem,
  onBack,
  onInsertToChat,
}) => {
  const [monograph, setMonograph] = useState<DrugMonograph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);
  const [isGeneratingPowerPoint, setIsGeneratingPowerPoint] = useState(false);
  const [slideCount, setSlideCount] = useState<number>(5);

  const fetchMonograph = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('bnf-comprehensive-lookup', {
        body: { drugName },
      });

      if (fnError) throw fnError;

      if (data?.monograph) {
        setMonograph(data.monograph);
      } else if (data?.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('BNF lookup error:', err);
      setError('Failed to load drug information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonograph();
  }, [drugName]);

  const handleCopyToClipboard = () => {
    if (!monograph) return;

    const summary = `**${monograph.drugName}**

**Indications:** ${monograph.indications.join(', ')}

**Dosing:**
• Adult: ${monograph.dosing.adult}
${monograph.dosing.elderly ? `• Elderly: ${monograph.dosing.elderly}` : ''}
${monograph.dosing.renalAdjustment ? `• Renal: ${monograph.dosing.renalAdjustment}` : ''}

**Contraindications:** ${monograph.contraindications.join(', ')}

**Key Interactions:** ${monograph.interactions.slice(0, 5).join(', ')}

**Monitoring:** ${monograph.monitoring.join(', ')}

⚠️ Always verify with official BNF. Use clinical judgement.`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertToChat = () => {
    if (!monograph || !onInsertToChat) return;

    const summary = `**${monograph.drugName} - Quick Reference**

**Indications:** ${monograph.indications.slice(0, 3).join(', ')}
**Adult dose:** ${monograph.dosing.adult}
**Key cautions:** ${monograph.cautions.slice(0, 3).join(', ')}
**Monitor:** ${monograph.monitoring.slice(0, 3).join(', ')}

⚠️ Verify with BNF. Clinical judgement required.`;

    onInsertToChat(summary);
    toast.success('Inserted into chat');
  };

  const buildMonographContent = (): string => {
    if (!monograph) return '';
    
    return `# ${monograph.drugName} - Clinical Reference

## Indications
${monograph.indications.map(i => `• ${i}`).join('\n')}

## Dosing
• Adult: ${monograph.dosing.adult}
${monograph.dosing.elderly ? `• Elderly: ${monograph.dosing.elderly}` : ''}
${monograph.dosing.renalAdjustment ? `• Renal adjustment: ${monograph.dosing.renalAdjustment}` : ''}
${monograph.dosing.paediatric ? `• Paediatric: ${monograph.dosing.paediatric}` : ''}

## Contraindications
${monograph.contraindications.map(c => `• ${c}`).join('\n')}

## Cautions
${monograph.cautions.map(c => `• ${c}`).join('\n')}

## Drug Interactions
${monograph.interactions.map(i => `• ${i}`).join('\n')}

## Side Effects
### Common (>1%)
${monograph.sideEffects.common.map(s => `• ${s}`).join('\n')}

### Serious
${monograph.sideEffects.serious.map(s => `• ${s}`).join('\n')}

## Monitoring
${monograph.monitoring.map(m => `• ${m}`).join('\n')}

## Pregnancy & Breastfeeding
${monograph.pregnancyBreastfeeding}

## Patient Counselling
${monograph.patientCounselling.map(p => `• ${p}`).join('\n')}

---
⚠️ Always verify with official BNF before prescribing. Use clinical judgement.`;
  };

  const handleGenerateInfographic = async () => {
    if (!monograph) return;
    
    setIsGeneratingInfographic(true);
    toast.info('Generating infographic...', { duration: 3000 });
    
    try {
      const documentContent = buildMonographContent();
      
      const { data, error: fnError } = await supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: `Create a clear, professional clinical infographic summarising the key prescribing information for ${monograph.drugName}. Focus on: indications, dosing, key contraindications, important interactions, and monitoring requirements. Use NHS-professional styling with clear visual hierarchy. Target audience: clinical staff. Include a prominent safety reminder to verify with official BNF.`,
          documentContent,
          requestType: 'infographic',
          imageModel: 'google/gemini-3-pro-image-preview',
          layoutPreference: 'landscape',
          brandingLevel: 'none',
          targetAudience: 'clinical',
          purpose: 'infographic',
          stylePreset: 'nhs-professional',
        },
      });

      if (fnError) throw fnError;

      // Response format: { success: true, image: { url: "data:image/png;base64,..." } }
      const imageUrl = data?.image?.url || data?.imageUrl;
      
      if (imageUrl) {
        // Convert base64 data URL to blob directly without fetch (avoids browser limitations)
        if (imageUrl.startsWith('data:')) {
          const base64Data = imageUrl.split(',')[1];
          const mimeType = imageUrl.split(';')[0].split(':')[1] || 'image/png';
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${monograph.drugName.replace(/\s+/g, '-')}-Clinical-Infographic.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        } else {
          // Remote URL - fetch and download
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${monograph.drugName.replace(/\s+/g, '-')}-Clinical-Infographic.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        }
        
        toast.success('Infographic downloaded!');
      } else {
        console.error('Response data:', data);
        throw new Error('No image URL returned');
      }
    } catch (err) {
      console.error('Infographic generation error:', err);
      toast.error('Failed to generate infographic. Please try again.');
    } finally {
      setIsGeneratingInfographic(false);
    }
  };

  const handleGeneratePowerPoint = async () => {
    if (!monograph) return;
    
    setIsGeneratingPowerPoint(true);
    toast.info(`Generating ${slideCount}-slide presentation...`, { duration: 3000 });
    
    try {
      const supportingContent = buildMonographContent();
      
      const { data, error: fnError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: {
          topic: `${monograph.drugName} - Clinical Prescribing Guide`,
          presentationType: 'Clinical Guidelines',
          slideCount,
          supportingContent,
          audience: 'Clinical staff and healthcare professionals',
          customInstructions: 'Focus on practical prescribing guidance. Include: indications, dosing (adult/elderly/renal), contraindications, key interactions, monitoring requirements, and patient counselling points. Use NHS-professional styling. Include safety disclaimer about verifying with official BNF.',
          localThemeStyle: {
            primaryColor: '#005EB8', // NHS Blue
            secondaryColor: '#003087', // NHS Dark Blue
            accentColor: '#41B6E6', // NHS Light Blue
            themeName: 'NHS Clinical',
          },
        },
      });

      if (fnError) throw fnError;

      if (data?.exportUrl || data?.pptxUrl) {
        const downloadUrl = data.exportUrl || data.pptxUrl;
        
        // Auto-download the PowerPoint
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${monograph.drugName.replace(/\s+/g, '-')}-Clinical-Guide.pptx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast.success('PowerPoint downloaded!');
      } else {
        throw new Error('No download URL returned');
      }
    } catch (err) {
      console.error('PowerPoint generation error:', err);
      toast.error('Failed to generate presentation. Please try again.');
    } finally {
      setIsGeneratingPowerPoint(false);
    }
  };

  const badge = trafficLightItem 
    ? getStatusBadge(trafficLightItem.status_enum)
    : getStatusBadge('');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">{drugName}</h1>
            {trafficLightItem && (
              <Badge variant="outline" className={cn("text-xs", badge.className)}>
                Northants ICB: {badge.label}
              </Badge>
            )}
            
            {/* Generation buttons - next to drug name */}
            {monograph && (
              <>
                <Separator orientation="vertical" className="h-5 mx-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateInfographic}
                  disabled={isGeneratingInfographic}
                  className="h-7 px-2 text-xs"
                >
                  {isGeneratingInfographic ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Image className="w-3 h-3 mr-1" />
                      Infographic
                    </>
                  )}
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isGeneratingPowerPoint}
                      className="h-7 px-2 text-xs"
                    >
                      {isGeneratingPowerPoint ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Presentation className="w-3 h-3 mr-1" />
                          PowerPoint
                        </>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-3" align="start">
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-foreground">Slide Count</div>
                      <Select
                        value={slideCount.toString()}
                        onValueChange={(val) => setSlideCount(parseInt(val))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 6, 7, 8, 9, 10].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} slides
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => handleGeneratePowerPoint()}
                        disabled={isGeneratingPowerPoint}
                      >
                        {isGeneratingPowerPoint ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate & Download'
                        )}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            Copy
          </Button>
          {onInsertToChat && (
            <Button variant="outline" size="sm" onClick={handleInsertToChat}>
              Insert to Chat
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://bnf.nice.org.uk/search/?q=${encodeURIComponent(drugName)}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            BNF Online
          </Button>
        </div>
      </div>

      {/* Safety disclaimer */}
      <Alert className="mx-4 mt-4 border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-sm">
          <strong>NHS Safety:</strong> Always verify with the official BNF before prescribing. 
          Use clinical judgement. This is AI-generated guidance and should be cross-referenced.
        </AlertDescription>
      </Alert>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading BNF information...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchMonograph} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : monograph ? (
          <div className="grid gap-4 w-full">
            {/* Indications */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Indications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {monograph.indications.map((ind, i) => (
                    <li key={i}>{ind}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Dosing */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Dosing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Adult:</span> {monograph.dosing.adult}
                </div>
                {monograph.dosing.elderly && (
                  <div>
                    <span className="font-medium">Elderly:</span> {monograph.dosing.elderly}
                  </div>
                )}
                {monograph.dosing.renalAdjustment && (
                  <div>
                    <span className="font-medium">Renal adjustment:</span> {monograph.dosing.renalAdjustment}
                  </div>
                )}
                {monograph.dosing.paediatric && (
                  <div>
                    <span className="font-medium">Paediatric:</span> {monograph.dosing.paediatric}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contraindications & Cautions */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-destructive">Contraindications</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {monograph.contraindications.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-600">Cautions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {monograph.cautions.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Interactions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Drug Interactions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {monograph.interactions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Side Effects */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Side Effects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium text-sm mb-1">Common (&gt;1%):</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {monograph.sideEffects.common.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-sm mb-1 text-destructive">Serious (seek advice):</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                    {monograph.sideEffects.serious.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Monitoring */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {monograph.monitoring.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pregnancy/Breastfeeding */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pregnancy & Breastfeeding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{monograph.pregnancyBreastfeeding}</p>
              </CardContent>
            </Card>

            {/* Patient Counselling */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Patient Counselling Points</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {monograph.patientCounselling.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Footer disclaimer */}
            <div className="text-xs text-muted-foreground text-center py-4 border-t">
              <p>
                Source: AI-generated from BNF guidelines. Last generated: {new Date().toLocaleDateString('en-GB')}.
                <br />
                Always verify with{' '}
                <a 
                  href="https://bnf.nice.org.uk" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline text-primary hover:text-primary/80"
                >
                  bnf.nice.org.uk
                </a>
                {' '}before prescribing.
              </p>
            </div>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
};
