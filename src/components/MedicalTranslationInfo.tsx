import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Info, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  Globe, 
  Brain, 
  FileText,
  Zap,
  Users,
  Activity
} from 'lucide-react';

export const MedicalTranslationInfo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const features = [
    {
      icon: <Shield className="w-5 h-5 text-green-600" />,
      title: "Multi-Service OCR Verification",
      description: "Uses Google Cloud Vision with medical-specific settings and cross-validation",
      status: "Active"
    },
    {
      icon: <Globe className="w-5 h-5 text-blue-600" />,
      title: "Cross-Translation Verification",
      description: "Compares results from Google Translate, DeepL, and OpenAI for accuracy",
      status: "Active"
    },
    {
      icon: <Brain className="w-5 h-5 text-purple-600" />,
      title: "AI Medical Safety Review",
      description: "GPT-5 powered clinical safety analysis with medical context awareness",
      status: "Active"
    },
    {
      icon: <FileText className="w-5 h-5 text-orange-600" />,
      title: "Romanian Medical Validator",
      description: "Specialized dictionary for Romanian→English medical terminology",
      status: "Active"
    },
    {
      icon: <Activity className="w-5 h-5 text-red-600" />,
      title: "Medical Value Validation",
      description: "Detects suspicious lab values, dosages, and decimal point errors",
      status: "Active"
    },
    {
      icon: <Eye className="w-5 h-5 text-indigo-600" />,
      title: "Reverse Translation Check",
      description: "Translates back to original language to verify accuracy",
      status: "Active"
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-600" />,
      title: "Real-time Error Detection",
      description: "Identifies medication name errors, duplicated text, and OCR mistakes",
      status: "Active"
    },
    {
      icon: <Users className="w-5 h-5 text-teal-600" />,
      title: "Medical Audit Trail",
      description: "Complete logging with override capabilities for compliance",
      status: "Active"
    }
  ];

  const safeguards = [
    "Cholesterol >20 mmol/L flagged as likely decimal error",
    "Medication names cross-referenced (e.g., Atocand→Atacand)",
    "Medical procedures verified against terminology database",
    "Dosage ranges validated against clinical standards",
    "Mixed-language detection for incomplete translations",
    "Confidence scoring with multi-service agreement analysis"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          Medical Translation Features
          <Badge variant="secondary" className="ml-1">8 Systems</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Advanced Medical Translation System
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Overview */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Enterprise-Grade Medical Translation</h3>
            <p className="text-sm text-blue-800">
              Our system combines 8 advanced validation layers to ensure 99%+ accuracy for medical documents. 
              Designed specifically for NHS compliance and patient safety.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="relative">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {feature.icon}
                    {feature.title}
                    <Badge variant="outline" className="ml-auto text-xs">
                      {feature.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Safety Checks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Automated Safety Checks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {safeguards.map((safeguard, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{safeguard}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Process Flow */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Translation Process Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 items-center text-sm">
                <Badge variant="outline">1. Enhanced OCR</Badge>
                <span>→</span>
                <Badge variant="outline">2. Multi-Translation</Badge>
                <span>→</span>
                <Badge variant="outline">3. Medical Validation</Badge>
                <span>→</span>
                <Badge variant="outline">4. AI Safety Review</Badge>
                <span>→</span>
                <Badge variant="outline">5. Reverse Check</Badge>
                <span>→</span>
                <Badge variant="outline">6. Confidence Scoring</Badge>
                <span>→</span>
                <Badge variant="outline">7. Audit Logging</Badge>
              </div>
              <p className="text-xs text-gray-600 mt-3">
                Each step includes multiple validation points and error detection mechanisms
                to ensure maximum accuracy for medical translations.
              </p>
            </CardContent>
          </Card>

          {/* Compliance */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-green-900">NHS Compliance Ready</span>
            </div>
            <p className="text-sm text-green-800">
              Complete audit trail, medical override capabilities, and safety scoring designed 
              for healthcare environments and regulatory compliance.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};