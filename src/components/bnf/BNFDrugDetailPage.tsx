import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, AlertTriangle, Loader2, BookOpen, Copy, Check, RefreshCw } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { TLVocabItem } from '@/hooks/useTrafficLightVocab';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import wordIcon from '@/assets/word-icon.png';
import powerpointIcon from '@/assets/powerpoint-icon.png';
import infographicIcon from '@/assets/infographic-icon.png';

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
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [slideCount, setSlideCount] = useState<number>(5);

  // Fetch monograph with proper cleanup to prevent memory leaks
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    
    const fetchMonograph = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('bnf-comprehensive-lookup', {
          body: { drugName },
        });

        // Check if component is still mounted before updating state
        if (!isMounted) return;

        if (fnError) throw fnError;

        if (data?.monograph) {
          setMonograph(data.monograph);
        } else if (data?.error) {
          setError(data.error);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('BNF lookup error:', err);
        setError('Failed to load drug information. Please try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchMonograph();
    
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [drugName]);

  // Manual refresh function for retry button
  const handleRefresh = () => {
    // Trigger re-fetch by toggling a refresh key (or just use key prop from parent)
    setMonograph(null);
    setIsLoading(true);
    setError(null);
    
    supabase.functions.invoke('bnf-comprehensive-lookup', {
      body: { drugName },
    }).then(({ data, error: fnError }) => {
      if (fnError) {
        setError('Failed to load drug information. Please try again.');
        setIsLoading(false);
        return;
      }
      if (data?.monograph) {
        setMonograph(data.monograph);
      } else if (data?.error) {
        setError(data.error);
      }
      setIsLoading(false);
    }).catch(err => {
      console.error('BNF lookup error:', err);
      setError('Failed to load drug information. Please try again.');
      setIsLoading(false);
    });
  };

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
    toast.success('Copied to clipboard', { duration: 1500 });
    setTimeout(() => setCopied(false), 1500);
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
    toast.success('Inserted into chat', { duration: 1500 });
  };

  const buildMonographContent = (): string => {
    if (!monograph) return '';
    
    // Include ICB Traffic Light status if available
    const icbSection = trafficLightItem ? `
## Northamptonshire ICB Traffic Light Status
• Status: ${trafficLightItem.status_enum?.replace(/_/g, ' ')}
${trafficLightItem.status_raw ? `• Classification: ${trafficLightItem.status_raw}` : ''}
${trafficLightItem.notes ? `• ICB Notes: ${trafficLightItem.notes}` : ''}
${trafficLightItem.bnf_chapter ? `• BNF Chapter: ${trafficLightItem.bnf_chapter}` : ''}
${trafficLightItem.prior_approval_url ? `• Prior Approval Required: Yes` : ''}
` : '';
    
    return `# ${monograph.drugName} - Clinical Reference
${icbSection}
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
          prompt: `Create a clear, professional clinical infographic summarising the key prescribing information for ${monograph.drugName}. ${trafficLightItem ? `Include the Northamptonshire ICB Traffic Light status: ${trafficLightItem.status_enum?.replace(/_/g, ' ')}${trafficLightItem.notes ? ` - ${trafficLightItem.notes}` : ''}.` : ''} Focus on: indications, dosing, key contraindications, important interactions, and monitoring requirements. Use NHS-professional styling with clear visual hierarchy. Target audience: clinical staff. Include a prominent safety reminder to verify with official BNF.`,
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
        
        toast.success('Infographic downloaded!', { duration: 2000 });
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
          customInstructions: `Focus on practical prescribing guidance. ${trafficLightItem ? `Include a slide on Northamptonshire ICB Traffic Light status: ${trafficLightItem.status_enum?.replace(/_/g, ' ')}${trafficLightItem.notes ? ` with note: ${trafficLightItem.notes}` : ''}.` : ''} Include: indications, dosing (adult/elderly/renal), contraindications, key interactions, monitoring requirements, and patient counselling points. Use NHS-professional styling. Include safety disclaimer about verifying with official BNF.`,
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
        
        // Fetch the file and create blob for download (avoids cross-origin issues)
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error('Failed to fetch PowerPoint file');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${monograph.drugName.replace(/\s+/g, '-')}-Clinical-Guide.pptx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        
        toast.success('PowerPoint downloaded!', { duration: 2000 });
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

  const handleGenerateWord = async () => {
    if (!monograph) return;
    
    setIsGeneratingWord(true);
    toast.info('Generating Word document...', { duration: 2000 });
    
    try {
      const NHS_BLUE = '005EB8';
      const AMBER_COLOR = 'B45309';
      const RED_COLOR = 'DC2626';
      const GREEN_COLOR = '16A34A';
      
      // Helper function to create a styled section header
      const createSectionHeader = (text: string, color: string = NHS_BLUE) => {
        return new Paragraph({
          children: [
            new TextRun({
              text,
              bold: true,
              size: 24,
              color,
            }),
          ],
          spacing: { before: 300, after: 100 },
        });
      };
      
      // Helper to create bullet points
      const createBulletPoint = (text: string, bold: boolean = false) => {
        return new Paragraph({
          children: [
            new TextRun({
              text: `• ${text}`,
              size: 22,
              bold,
            }),
          ],
          spacing: { after: 60 },
          indent: { left: 360 },
        });
      };
      
      // Build document sections
      const children: any[] = [];
      
      // Title
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: monograph.drugName,
              bold: true,
              size: 36,
              color: NHS_BLUE,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Clinical Prescribing Guide',
              size: 24,
              color: '666666',
              italics: true,
            }),
          ],
          spacing: { after: 200 },
        })
      );
      
      // Safety disclaimer
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '⚠️ NHS Safety: ',
              bold: true,
              color: AMBER_COLOR,
              size: 22,
            }),
            new TextRun({
              text: 'Always verify with the official BNF before prescribing. Use clinical judgement. This is AI-generated guidance and should be cross-referenced.',
              color: AMBER_COLOR,
              size: 22,
            }),
          ],
          spacing: { before: 100, after: 300 },
          border: {
            top: { color: AMBER_COLOR, size: 1, style: BorderStyle.SINGLE },
            bottom: { color: AMBER_COLOR, size: 1, style: BorderStyle.SINGLE },
            left: { color: AMBER_COLOR, size: 1, style: BorderStyle.SINGLE },
            right: { color: AMBER_COLOR, size: 1, style: BorderStyle.SINGLE },
          },
          shading: { fill: 'FEF3C7' },
        })
      );
      
      // ICB Traffic Light Status - if available
      if (trafficLightItem) {
        const PURPLE_COLOR = '7C3AED';
        const SLATE_COLOR = '475569';
        const statusColor = 
          trafficLightItem.status_enum === 'GREEN' ? GREEN_COLOR :
          trafficLightItem.status_enum === 'AMBER' ? AMBER_COLOR :
          trafficLightItem.status_enum === 'RED' ? RED_COLOR :
          trafficLightItem.status_enum === 'DOUBLE_RED' ? RED_COLOR :
          trafficLightItem.status_enum === 'SPECIALIST_INITIATED' ? PURPLE_COLOR :
          trafficLightItem.status_enum === 'HOSPITAL_ONLY' ? SLATE_COLOR : NHS_BLUE;
        
        children.push(
          createSectionHeader('Northamptonshire ICB Traffic Light Status', statusColor),
          new Paragraph({
            children: [
              new TextRun({
                text: `Status: ${trafficLightItem.status_enum?.replace(/_/g, ' ')}`,
                bold: true,
                size: 24,
                color: statusColor,
              }),
            ],
            spacing: { after: 80 },
          })
        );
        
        if (trafficLightItem.status_raw) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Classification: ', bold: true, size: 22 }),
                new TextRun({ text: trafficLightItem.status_raw, size: 22 }),
              ],
              spacing: { after: 60 },
            })
          );
        }
        
        if (trafficLightItem.notes) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'ICB Notes: ', bold: true, size: 22 }),
                new TextRun({ text: trafficLightItem.notes, size: 22 }),
              ],
              spacing: { after: 60 },
            })
          );
        }
        
        if (trafficLightItem.bnf_chapter) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'BNF Chapter: ', bold: true, size: 22 }),
                new TextRun({ text: trafficLightItem.bnf_chapter, size: 22 }),
              ],
              spacing: { after: 60 },
            })
          );
        }
        
        if (trafficLightItem.prior_approval_url) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '⚠️ Prior Approval Required', bold: true, size: 22, color: AMBER_COLOR }),
              ],
              spacing: { after: 60 },
            })
          );
        }
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Source: ', size: 20, color: '666666' }),
              new TextRun({ text: trafficLightItem.detail_url, size: 20, color: NHS_BLUE }),
            ],
            spacing: { after: 200 },
          })
        );
      }
      
      // Indications
      children.push(createSectionHeader('Indications'));
      monograph.indications.forEach((ind) => {
        children.push(createBulletPoint(ind));
      });
      
      // Dosing table
      children.push(createSectionHeader('Dosing'));
      const dosingRows = [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Adult', bold: true, size: 22 })] })],
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: 'E5E7EB' },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: monograph.dosing.adult, size: 22 })] })],
              width: { size: 80, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ];
      
      if (monograph.dosing.elderly) {
        dosingRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Elderly', bold: true, size: 22 })] })],
                shading: { fill: 'E5E7EB' },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: monograph.dosing.elderly, size: 22 })] })],
              }),
            ],
          })
        );
      }
      
      if (monograph.dosing.renalAdjustment) {
        dosingRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Renal Adjustment', bold: true, size: 22 })] })],
                shading: { fill: 'E5E7EB' },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: monograph.dosing.renalAdjustment, size: 22 })] })],
              }),
            ],
          })
        );
      }
      
      if (monograph.dosing.paediatric) {
        dosingRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Paediatric', bold: true, size: 22 })] })],
                shading: { fill: 'E5E7EB' },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: monograph.dosing.paediatric, size: 22 })] })],
              }),
            ],
          })
        );
      }
      
      children.push(
        new Table({
          rows: dosingRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      
      // Two-column layout for Contraindications and Cautions
      children.push(
        new Paragraph({ spacing: { before: 200 } }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'Contraindications', bold: true, size: 24, color: RED_COLOR })],
                      spacing: { after: 100 },
                    }),
                    ...monograph.contraindications.map((c) => 
                      new Paragraph({
                        children: [new TextRun({ text: `• ${c}`, size: 20 })],
                        spacing: { after: 40 },
                      })
                    ),
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { color: 'CCCCCC', size: 1, style: BorderStyle.SINGLE },
                  },
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'Cautions', bold: true, size: 24, color: AMBER_COLOR })],
                      spacing: { after: 100 },
                    }),
                    ...monograph.cautions.map((c) => 
                      new Paragraph({
                        children: [new TextRun({ text: `• ${c}`, size: 20 })],
                        spacing: { after: 40 },
                      })
                    ),
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                }),
              ],
            }),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      
      // Side Effects
      children.push(
        createSectionHeader('Side Effects'),
        new Paragraph({
          children: [new TextRun({ text: 'Common:', bold: true, size: 22 })],
          spacing: { after: 60 },
        })
      );
      monograph.sideEffects.common.forEach((se) => {
        children.push(createBulletPoint(se));
      });
      
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Serious:', bold: true, size: 22, color: RED_COLOR })],
          spacing: { before: 100, after: 60 },
        })
      );
      monograph.sideEffects.serious.forEach((se) => {
        children.push(createBulletPoint(se, true));
      });
      
      // Drug Interactions
      children.push(createSectionHeader('Drug Interactions'));
      monograph.interactions.forEach((int) => {
        children.push(createBulletPoint(int));
      });
      
      // Monitoring
      children.push(createSectionHeader('Monitoring Requirements', GREEN_COLOR));
      monograph.monitoring.forEach((mon) => {
        children.push(createBulletPoint(mon));
      });
      
      // Pregnancy & Breastfeeding
      if (monograph.pregnancyBreastfeeding) {
        children.push(
          createSectionHeader('Pregnancy & Breastfeeding'),
          new Paragraph({
            children: [new TextRun({ text: monograph.pregnancyBreastfeeding, size: 22 })],
            spacing: { after: 100 },
          })
        );
      }
      
      // Patient Counselling
      children.push(createSectionHeader('Patient Counselling Points'));
      monograph.patientCounselling.forEach((pc) => {
        children.push(createBulletPoint(pc));
      });
      
      // Footer
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${new Date().toLocaleDateString('en-GB')} | AI4GP Clinical Reference`,
              size: 18,
              color: '999999',
              italics: true,
            }),
          ],
          spacing: { before: 400 },
          alignment: AlignmentType.CENTER,
        })
      );
      
      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });
      
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${monograph.drugName.replace(/\s+/g, '-')}-Clinical-Guide.docx`);
      
      toast.success('Word document downloaded!', { duration: 2000 });
    } catch (err) {
      console.error('Word generation error:', err);
      toast.error('Failed to generate Word document.');
    } finally {
      setIsGeneratingWord(false);
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
          
          {/* Drug name - prominent display */}
          <h1 className="text-xl font-bold text-foreground">{drugName}</h1>
          
          {/* ICB Badge */}
          {trafficLightItem ? (
            <Badge variant="outline" className={cn("text-xs font-medium", badge.className)}>
              Northants ICB: {badge.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
              BNF
            </Badge>
          )}
          
          {/* Export buttons - icon only with tooltips */}
          {monograph && (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-1 ml-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGenerateInfographic}
                      disabled={isGeneratingInfographic}
                      className="h-8 w-8"
                    >
                      {isGeneratingInfographic ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <img src={infographicIcon} alt="Infographic" className="h-6 w-6" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generate Infographic</TooltipContent>
                </Tooltip>
                
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isGeneratingPowerPoint}
                          className="h-8 w-8"
                        >
                          {isGeneratingPowerPoint ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <img src={powerpointIcon} alt="PowerPoint" className="h-6 w-6" />
                          )}
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Generate PowerPoint</TooltipContent>
                  </Tooltip>
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
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGenerateWord}
                      disabled={isGeneratingWord}
                      className="h-8 w-8"
                    >
                      {isGeneratingWord ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <img src={wordIcon} alt="Word" className="h-6 w-6" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download Word Document</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
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
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : monograph ? (
          <div className="grid gap-4 w-full">
            {/* ICB Traffic Light Status - if available */}
            {trafficLightItem && (
              <Card className={cn(
                "border-l-4",
                trafficLightItem.status_enum === 'GREEN' && "border-l-green-500 bg-green-50/50",
                trafficLightItem.status_enum === 'AMBER' && "border-l-amber-500 bg-amber-50/50",
                trafficLightItem.status_enum === 'RED' && "border-l-red-500 bg-red-50/50",
                trafficLightItem.status_enum === 'DOUBLE_RED' && "border-l-red-700 bg-red-100/50",
                trafficLightItem.status_enum === 'SPECIALIST_INITIATED' && "border-l-purple-500 bg-purple-50/50",
                trafficLightItem.status_enum === 'HOSPITAL_ONLY' && "border-l-slate-500 bg-slate-50/50",
              )}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", badge.className)}>
                      {badge.label}
                    </Badge>
                    Northamptonshire ICB Traffic Light Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {trafficLightItem.status_raw && (
                    <div>
                      <span className="font-medium">Classification:</span> {trafficLightItem.status_raw}
                    </div>
                  )}
                  {trafficLightItem.notes && (
                    <div>
                      <span className="font-medium">ICB Notes:</span> {trafficLightItem.notes}
                    </div>
                  )}
                  {trafficLightItem.bnf_chapter && (
                    <div>
                      <span className="font-medium">BNF Chapter:</span> {trafficLightItem.bnf_chapter}
                    </div>
                  )}
                  {trafficLightItem.prior_approval_url && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-amber-700">⚠️ Prior Approval Required</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => window.open(trafficLightItem.prior_approval_url, '_blank')}
                      >
                        View Form <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  )}
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => window.open(trafficLightItem.detail_url, '_blank')}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      ICB Formulary Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

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
