import React, { useState } from 'react';
import { X, FileText, Building2, ClipboardCheck } from 'lucide-react';

interface StyleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStyleSelect: (styleId: string) => void;
}

const StyleSelectorModal: React.FC<StyleSelectorModalProps> = ({ isOpen, onClose, onStyleSelect }) => {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const styles = [
    {
      id: 'style1',
      name: 'Professional Business',
      icon: <Building2 className="w-6 h-6" />,
      description: 'Modern corporate format with executive summary and risk analysis',
      features: [
        'Executive summary',
        'Hierarchical numbering (1.1, 1.2)',
        'Risk and timeline analysis',
        'Business-oriented language',
        'Priority-based decisions'
      ],
      preview: `PARTNERSHIP MEETING MINUTES

Meeting Details:
Date: 15th March 2024
Attendees: Dr. Sarah Mitchell, Dr. James Thompson...

EXECUTIVE SUMMARY
• Partnership approved £45,000 investment in clinical system upgrade
• Decision made to recruit Advanced Nurse Practitioner
• CQC inspection preparation timeline established

AGENDA ITEMS DISCUSSED

1. CLINICAL SYSTEM UPGRADE PROPOSAL
   
   1.1 Current Situation
       • EMIS system showing performance issues
       • Patient complaints increased 15%
   
   1.2 Analysis of Challenges
       Staff and Operational Impact:
       • 2-week training period required
       
       Financial and Business Implications:
       • Total investment: £45,000 over 3 years

DECISIONS REQUIRED
Priority 1 (Immediate):
1. System upgrade approval - APPROVED

ACTION ITEMS
Dr. Thompson - System Implementation
• Coordinate with EMIS for timeline
• Target: 30th April 2024`
    },
    {
      id: 'style2',
      name: 'Clear & Direct',
      icon: <FileText className="w-6 h-6" />,
      description: 'Clean, straightforward format focusing on clarity and readability',
      features: [
        'Simple numbered sections',
        'Clear bullet points',
        'Direct language',
        'Easy to scan format',
        'Practical action items'
      ],
      preview: `Partnership Meeting Notes

Date: 15th March 2024
Attendees: Dr. Sarah Mitchell, Dr. James Thompson...

1. CLINICAL SYSTEM UPGRADE DISCUSSION

Proposal Overview
- Upgrade current EMIS system to Web Plus
- Cost: £45,000 over 3 years
- Implementation target: April 2024

Challenges Identified
Staff and Patient Impact:
- 2-week training period required
- Patient complaints up 15%

Technical Limitations:
- Performance issues during peak hours
- Data migration requires weekend work

Potential Benefits
- 25% improvement in booking efficiency
- Better clinical workflow
- Expected £20,000 annual savings

4. KEY DECISIONS NEEDED
1. System upgrade approval and budget
2. ANP recruitment authorization

5. ACTION ITEMS
- Dr. Thompson: Lead implementation
- Lisa Stevens: Begin recruitment by 25th March`
    },
    {
      id: 'style3',
      name: 'NHS Formal',
      icon: <ClipboardCheck className="w-6 h-6" />,
      description: 'Traditional NHS committee minutes with formal structure and language',
      features: [
        'Formal committee structure',
        'Traditional NHS language',
        'Present/Apologies sections',
        'Numbered agenda items',
        'Signature lines'
      ],
      preview: `MEADOWBROOK SURGERY PARTNERSHIP MEETING

MINUTES OF MEETING

Meeting: Partnership Meeting
Date: 15th March 2024
Time: 14:00 - 16:30
Present: Dr. Sarah Mitchell (Senior Partner, Chair)
         Dr. James Thompson (Partner)
In Attendance: Lisa Stevens (Practice Manager)
Chair: Dr. Sarah Mitchell

ITEM 1: CLINICAL SYSTEM UPGRADE PROPOSAL

1.1 Dr. Thompson presented the current position regarding 
    the practice clinical system performance. The key points 
    highlighted were:
    a) EMIS system experiencing performance degradation
    b) Patient complaints increased by 15%

1.2 Discussion ensued regarding the proposed upgrade. 
    The following concerns were raised:
    a) Dr. Rodriguez highlighted training requirements
    b) Dr. Chen questioned migration timeline

ACTION: Dr. Thompson to coordinate with EMIS by 30th April

DECISIONS MADE:
Decision 1: System upgrade approved with £45,000 budget

Chair: Dr. Sarah Mitchell
Date: 15th March 2024`
    }
  ];

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId);
  };

  const handleConfirm = () => {
    if (selectedStyle) {
      onStyleSelect(selectedStyle);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden border">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Choose Your Meeting Notes Style</h2>
            <p className="text-primary-foreground/80 mt-1">Select the format that best suits your needs</p>
          </div>
          <button 
            onClick={onClose}
            className="text-primary-foreground hover:text-primary-foreground/80 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {styles.map((style) => (
              <div 
                key={style.id}
                className={`border-2 rounded-lg transition-all duration-200 cursor-pointer ${
                  selectedStyle === style.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-border/80'
                }`}
                onClick={() => handleStyleSelect(style.id)}
              >
                {/* Style Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      selectedStyle === style.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {style.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{style.name}</h3>
                      <p className="text-sm text-muted-foreground">{style.description}</p>
                    </div>
                  </div>
                  
                  {/* Features */}
                  <div className="mt-3">
                    <h4 className="font-semibold text-sm text-foreground mb-2">Key Features:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {style.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Preview */}
                <div className="p-4">
                  <h4 className="font-semibold text-sm text-foreground mb-2">Preview:</h4>
                  <div className="bg-muted rounded border p-3 text-xs font-mono leading-relaxed overflow-hidden">
                    <pre className="whitespace-pre-wrap text-foreground max-h-80 overflow-y-auto">
                      {style.preview}
                    </pre>
                  </div>
                </div>

                {/* Selection Indicator */}
                {selectedStyle === style.id && (
                  <div className="bg-primary text-primary-foreground text-center py-2 font-semibold text-sm">
                    ✓ Selected
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted px-6 py-4 flex justify-between items-center border-t">
          <p className="text-sm text-muted-foreground">
            {selectedStyle ? 'Click "Generate Notes" to proceed with your selected style' : 'Please select a style to continue'}
          </p>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              disabled={!selectedStyle}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                selectedStyle 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              Generate Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleSelectorModal;