import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  Search,
  Cpu,
  Globe,
  Bot,
  FileText,
  Activity,
  Zap,
  RefreshCw,
  Database
} from 'lucide-react';

export const TranslationValidationGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const validationSystems = [
    {
      id: 'ocr-verification',
      name: 'Multi-Service OCR Verification',
      icon: <Eye className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Uses Google Cloud Vision API to extract text with medical-specific OCR optimization',
      checks: [
        'Character recognition accuracy',
        'Medical terminology detection',
        'Confidence scoring for each word',
        'OCR error pattern identification',
        'Text layout preservation'
      ],
      example: 'Detects if "Paracetamol 500mg" was misread as "Paracetam0l 5OOmg"'
    },
    {
      id: 'cross-translation',
      name: 'Cross-Translation Verification',
      icon: <Globe className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Compares translations from Google Translate, DeepL, and OpenAI for consistency',
      checks: [
        'Translation agreement scoring',
        'Medical term consistency',
        'Dosage preservation accuracy',
        'Context preservation',
        'Service-specific confidence weighting'
      ],
      example: 'If Google says "chest pain" but DeepL says "heart pain", flags for review'
    },
    {
      id: 'ai-medical-review',
      name: 'AI Medical Safety Review',
      icon: <Bot className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'GPT-5 powered medical translation review with clinical context awareness',
      checks: [
        'Medical accuracy assessment',
        'Clinical terminology validation',
        'Dosage safety verification',
        'Context appropriateness',
        'Risk level classification'
      ],
      example: 'Identifies dangerous mistranslations like "take once daily" → "take once hourly"'
    },
    {
      id: 'romanian-validator',
      name: 'Romanian Medical Validator',
      icon: <FileText className="w-5 h-5" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Specialized validation for Romanian medical documents and terminology',
      checks: [
        'Romanian medical term recognition',
        'Known translation error patterns',
        'Medical context identification',
        'Dosage format validation',
        'Common OCR error detection'
      ],
      example: 'Catches "Aspirina" mistranslated as "Aspirin" instead of "Aspirin"'
    },
    {
      id: 'medical-calculations',
      name: 'Medical Value Validation',
      icon: <Cpu className="w-5 h-5" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Validates medical measurements, dosages, and numerical values',
      checks: [
        'Dosage range validation',
        'Unit conversion accuracy',
        'Decimal point preservation',
        'Medical reference ranges',
        'Calculation consistency'
      ],
      example: 'Flags "2000mg" as potentially dangerous dosage vs "200mg"'
    },
    {
      id: 'reverse-translation',
      name: 'Reverse Translation Check',
      icon: <RefreshCw className="w-5 h-5" />,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      description: 'Translates result back to original language to verify accuracy',
      checks: [
        'Round-trip translation accuracy',
        'Meaning preservation',
        'Context retention',
        'Medical term stability',
        'Information loss detection'
      ],
      example: 'EN→RO→EN: "Heart attack" → "Infarct miocardic" → "Heart attack" ✓'
    },
    {
      id: 'error-detection',
      name: 'Real-time Error Detection',
      icon: <Zap className="w-5 h-5" />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Identifies common translation and OCR errors in real-time',
      checks: [
        'Medication name validation',
        'Duplicated text detection',
        'Garbled term identification',
        'Mixed language detection',
        'Incomplete sentence recognition'
      ],
      example: 'Detects "Atocand" should be "Atacand" (common medication name error)'
    },
    {
      id: 'audit-trail',
      name: 'Medical Audit Trail',
      icon: <Database className="w-5 h-5" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: 'Comprehensive logging and compliance tracking for medical translations',
      checks: [
        'Complete translation history',
        'Validation result logging',
        'Safety level tracking',
        'User override documentation',
        'Compliance report generation'
      ],
      example: 'Maintains NHS-compliant audit trail for all medical document translations'
    }
  ];

  const safetyLevels = [
    {
      level: 'safe',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: <CheckCircle className="w-4 h-4" />,
      criteria: [
        'Translation agreement > 85%',
        'No critical medical warnings',
        'All dosages within normal ranges',
        'High OCR confidence (>90%)',
        'Medical terminology preserved'
      ]
    },
    {
      level: 'warning',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      icon: <AlertTriangle className="w-4 h-4" />,
      criteria: [
        'Translation agreement 70-85%',
        'Minor terminology inconsistencies',
        'Some OCR uncertainty',
        'Unusual but not dangerous values',
        'Requires human review'
      ]
    },
    {
      level: 'unsafe',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: <AlertTriangle className="w-4 h-4" />,
      criteria: [
        'Translation agreement < 70%',
        'Critical medical warnings detected',
        'Dangerous dosage discrepancies',
        'Poor OCR confidence (<70%)',
        'Manual override required'
      ]
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          View Validation System Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Medical Translation Validation System
            <Badge variant="secondary">8 Validation Systems</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="systems" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="systems">Validation Systems</TabsTrigger>
            <TabsTrigger value="safety">Safety Levels</TabsTrigger>
            <TabsTrigger value="workflow">Validation Workflow</TabsTrigger>
          </TabsList>
          
          <TabsContent value="systems" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {validationSystems.map((system) => (
                <Card key={system.id} className={`${system.bgColor} border-2`}>
                  <CardHeader className="pb-3">
                    <CardTitle className={`text-lg flex items-center gap-2 ${system.color}`}>
                      {system.icon}
                      {system.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600">{system.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Validation Checks:</h4>
                      <ul className="text-xs space-y-1">
                        {system.checks.map((check, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                            {check}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3 p-2 bg-white/50 rounded text-xs">
                      <strong>Example:</strong> {system.example}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="safety" className="space-y-4">
            <div className="space-y-4">
              {safetyLevels.map((level) => (
                <Card key={level.level} className={`${level.bgColor} border-2 ${level.borderColor}`}>
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${level.color} capitalize`}>
                      {level.icon}
                      {level.level} Level
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {level.criteria.map((criterion, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          {criterion}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Validation Workflow Process</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-blue-600 font-bold">1</span>
                    </div>
                    <h3 className="font-semibold mb-2">OCR Processing</h3>
                    <p className="text-sm text-center text-gray-600">
                      Google Cloud Vision extracts text with medical optimization
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-green-600 font-bold">2</span>
                    </div>
                    <h3 className="font-semibold mb-2">Multi-Service Translation</h3>
                    <p className="text-sm text-center text-gray-600">
                      Google Translate, DeepL, and OpenAI provide independent translations
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-purple-600 font-bold">3</span>
                    </div>
                    <h3 className="font-semibold mb-2">Cross-Verification</h3>
                    <p className="text-sm text-center text-gray-600">
                      AI compares results and identifies discrepancies
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-red-600 font-bold">4</span>
                    </div>
                    <h3 className="font-semibold mb-2">Medical Validation</h3>
                    <p className="text-sm text-center text-gray-600">
                      Romanian medical terms and dosages validated
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-orange-600 font-bold">5</span>
                    </div>
                    <h3 className="font-semibold mb-2">Safety Assessment</h3>
                    <p className="text-sm text-center text-gray-600">
                      Overall safety level determined and logged
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center p-4 border rounded-lg">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-indigo-600 font-bold">6</span>
                    </div>
                    <h3 className="font-semibold mb-2">Audit Trail</h3>
                    <p className="text-sm text-center text-gray-600">
                      Complete validation results stored for compliance
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">NHS Compliance Features:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Complete audit trail with timestamps</li>
                    <li>• User override documentation</li>
                    <li>• Safety level tracking</li>
                    <li>• Compliance report generation</li>
                    <li>• Exportable validation records</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};