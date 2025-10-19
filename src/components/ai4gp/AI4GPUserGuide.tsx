import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  BookOpen, 
  Mic, 
  Languages, 
  Shield, 
  Zap, 
  FileText, 
  Upload, 
  Settings, 
  History,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Globe,
  Stethoscope,
  Building2,
  Copy,
  Volume2
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AI4GPUserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AI4GPUserGuide = ({ isOpen, onClose }: AI4GPUserGuideProps) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [openSections, setOpenSections] = useState<string[]>(['overview']);

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const sections = [
    {
      id: 'overview',
      title: 'Getting Started',
      icon: <Sparkles className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">Welcome to AI4GP Service</h4>
            <p className="text-blue-800 text-sm leading-relaxed">
              Your intelligent NHS assistant for clinical guidance, patient information, practice management, 
              and medical translations. Built specifically for UK healthcare professionals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-800 flex items-center gap-2 text-base">
                  <Stethoscope className="w-4 h-4" />
                  GP Mode
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-green-700">
                Clinical guidance, prescribing, patient care, NHS protocols, and medical decision support.
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 flex items-center gap-2 text-base">
                  <Building2 className="w-4 h-4" />
                  Practice Manager Mode
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-purple-700">
                Practice operations, staff management, policies, compliance, and administrative guidance.
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Quick Start Tips:</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Type your question or use the <strong>microphone</strong> for voice input</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Upload documents, images, or audio files for analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Use <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+Enter</kbd> to send messages quickly</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Right-click any response to access <strong>Quick Pick</strong> enhancement options</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'voice',
      title: 'Voice & Microphone',
      icon: <Mic className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Built-in Speech Recognition
            </h4>
            <p className="text-blue-800 text-sm">
              Advanced browser-based speech-to-text that works without internet connection for privacy.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Mic className="w-4 h-4 text-blue-600" />
                How to Use Voice Input
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <span className="text-blue-800 font-bold text-xs">1</span>
                  </div>
                  <div>
                    <strong className="text-sm">Click the Microphone Icon</strong>
                    <p className="text-xs text-gray-600 mt-1">Located in the input area next to the send button</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <span className="text-blue-800 font-bold text-xs">2</span>
                  </div>
                  <div>
                    <strong className="text-sm">Grant Microphone Permission</strong>
                    <p className="text-xs text-gray-600 mt-1">Allow browser access when prompted (first time only)</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <span className="text-blue-800 font-bold text-xs">3</span>
                  </div>
                  <div>
                    <strong className="text-sm">Start Speaking</strong>
                    <p className="text-xs text-gray-600 mt-1">Speak clearly at normal pace - text appears in real-time</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <span className="text-blue-800 font-bold text-xs">4</span>
                  </div>
                  <div>
                    <strong className="text-sm">Review & Send</strong>
                    <p className="text-xs text-gray-600 mt-1">Edit if needed, then send with button or Ctrl+Enter</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h5 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Voice Recognition Tips
              </h5>
              <ul className="space-y-1 text-sm text-amber-700">
                <li>• Speak at normal conversational pace</li>
                <li>• Use medical terminology naturally - the system understands clinical language</li>
                <li>• Pause briefly between sentences for better accuracy</li>
                <li>• Say "period" or "full stop" for punctuation</li>
                <li>• Works offline - your voice never leaves your device</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'translation',
      title: 'Translation & Languages',
      icon: <Languages className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Multi-Language Support
            </h4>
            <p className="text-green-800 text-sm">
              Professional medical translation with quality verification for 25+ languages commonly used in UK healthcare.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-800 flex items-center gap-2 text-base">
                  <MessageSquare className="w-4 h-4" />
                  Text Translation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700">
                  Translate any AI response using Quick Pick options:
                </p>
                <ol className="text-xs space-y-1 text-gray-600">
                  <li>1. Right-click any AI response</li>
                  <li>2. Select "Translate" from Quick Pick menu</li>
                  <li>3. Choose target language</li>
                  <li>4. Review translated text</li>
                </ol>
              </CardContent>
            </Card>

            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  Document Translation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700">
                  Upload and translate documents:
                </p>
                <ol className="text-xs space-y-1 text-gray-600">
                  <li>1. Click "+" button in input area</li>
                  <li>2. Select "Translate Document"</li>
                  <li>3. Upload image or document</li>
                  <li>4. Choose target language</li>
                </ol>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Supported Languages</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {[
                'Polish 🇵🇱', 'Arabic 🇸🇦', 'Bengali 🇧🇩', 'Romanian 🇷🇴', 
                'Spanish 🇪🇸', 'Portuguese 🇵🇹', 'Turkish 🇹🇷', 'French 🇫🇷',
                'Chinese 🇨🇳', 'Hindi 🇮🇳', 'Gujarati 🇮🇳', 'Punjabi 🇮🇳',
                'Italian 🇮🇹', 'German 🇩🇪', 'Russian 🇷🇺', 'Urdu 🇵🇰',
                'Somali 🇸🇴', 'Farsi 🇮🇷', 'Tamil 🇮🇳', 'Lithuanian 🇱🇹'
              ].map(lang => (
                <Badge key={lang} variant="outline" className="justify-center text-xs py-1">
                  {lang}
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h5 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Round-Trip Translation Check
            </h5>
            <p className="text-sm text-emerald-700 mb-2">
              Verify translation accuracy by translating back to English:
            </p>
            <ol className="text-xs space-y-1 text-emerald-600">
              <li>1. After translating text, use Quick Pick menu</li>
              <li>2. Select "Round-trip translation check"</li>
              <li>3. System translates back to English</li>
              <li>4. Compare original vs. back-translation</li>
              <li>5. Identify any meaning changes or errors</li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Translation Quality Verification
            </h5>
            <p className="text-sm text-blue-700 mb-2">
              Advanced AI-powered quality assessment for medical translations:
            </p>
            <ul className="text-xs space-y-1 text-blue-600">
              <li>• Analyzes medical terminology preservation</li>
              <li>• Checks for safety-critical translation errors</li>
              <li>• Provides confidence scoring (0-100%)</li>
              <li>• Identifies potential issues and suggestions</li>
              <li>• Ensures culturally appropriate language</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'clinical-verification',
      title: 'Clinical Verification',
      icon: <Shield className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-red-50 to-rose-50 p-4 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Automated Clinical Safety Checks
            </h4>
            <p className="text-red-800 text-sm">
              Every clinical response is automatically verified against NICE guidelines, BNF, and NHS protocols 
              to ensure accuracy and safety.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-semibold text-green-800 text-sm">Low Risk</span>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-green-700">
                Well-evidenced guidance with strong NHS source references
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="font-semibold text-amber-800 text-sm">Medium Risk</span>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-amber-700">
                Requires additional verification or clinical judgment
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="font-semibold text-red-800 text-sm">High Risk</span>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-red-700">
                Needs careful review before clinical use
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Verification Features</h4>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Automatic Checks
                </h5>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• NICE/CKS guideline compliance</li>
                  <li>• BNF prescribing information</li>
                  <li>• NHS source verification</li>
                  <li>• Safety-critical content flagging</li>
                  <li>• Drug interaction warnings</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h5 className="font-medium text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Manual Verification Tools
                </h5>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• Red/amber flag screening</li>
                  <li>• Interaction checking</li>
                  <li>• Confidence assessment</li>
                  <li>• Citation validation</li>
                  <li>• Flag suspected errors</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h5 className="font-semibold text-gray-800 mb-3">Understanding Verification Scores</h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Confidence Score:</span>
                <span className="text-gray-900 font-medium">0-100% based on source quality</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Source Trust:</span>
                <span className="text-gray-900 font-medium">High (NICE/BNF) → Low (other)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">LLM Consensus:</span>
                <span className="text-gray-900 font-medium">Agreement across AI models</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'quick-pick',
      title: 'Quick Pick Enhancement',
      icon: <Zap className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Instant Text Enhancement
            </h4>
            <p className="text-purple-800 text-sm">
              Right-click any AI response to access 100+ enhancement options. Transform, translate, 
              format, and refine content instantly.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Quick Pick Categories</h4>
            
            <div className="grid gap-3">
              {[
                {
                  category: "Quality & Safety",
                  icon: <Shield className="w-4 h-4 text-red-600" />,
                  items: ["Validate with citations", "Red/amber flag screen", "Interaction check", "Confidence assessment"]
                },
                {
                  category: "Format & Style", 
                  icon: <FileText className="w-4 h-4 text-blue-600" />,
                  items: ["Convert bullets/numbers", "Add/remove formatting", "Clean spacing", "Table format"]
                },
                {
                  category: "Text Operations",
                  icon: <Copy className="w-4 h-4 text-green-600" />,
                  items: ["Change case", "Remove filler words", "Standardise dates", "Format numbers"]
                },
                {
                  category: "Smart Replacements",
                  icon: <Sparkles className="w-4 h-4 text-purple-600" />,
                  items: ["NHS abbreviations", "Expand medical terms", "Drug name standardisation"]
                },
                {
                  category: "AI Enhancement",
                  icon: <Zap className="w-4 h-4 text-orange-600" />,
                  items: ["Make longer/shorter", "Simplify language", "Add detail", "Plain English"]
                },
                {
                  category: "Content Refinement",
                  icon: <Settings className="w-4 h-4 text-gray-600" />,
                  items: ["Expand with examples", "Summarise", "EMIS/SystmOne format", "Add formulary notes"]
                },
                {
                  category: "Audience Adaptation",
                  icon: <MessageSquare className="w-4 h-4 text-indigo-600" />,
                  items: ["Patient leaflet", "Safety-netting", "Patient letter/email", "Staff training pack"]
                },
                {
                  category: "Translation",
                  icon: <Languages className="w-4 h-4 text-emerald-600" />,
                  items: ["25+ languages", "Round-trip check", "Quality verification", "Medical accuracy"]
                }
              ].map((category, index) => (
                <Card key={index} className="border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {category.icon}
                      {category.category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {category.items.map((item, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-3">How to Use Quick Pick</h5>
            <div className="space-y-2 text-sm text-blue-700">
              <div className="flex items-start gap-2">
                <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                <span>Right-click on any AI response text</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                <span>Browse categories or search for specific enhancements</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                <span>Click your desired option - AI applies enhancement instantly</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-blue-200 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                <span>Chain multiple enhancements for complex formatting</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'file-upload',
      title: 'File Upload & Processing',
      icon: <Upload className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Multi-Format File Support
            </h4>
            <p className="text-orange-800 text-sm">
              Upload and analyze documents, images, audio files, and spreadsheets. AI extracts content 
              and provides analysis, summaries, and recommendations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-800 flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {['PDF', 'Word (.docx)', 'RTF', 'Text (.txt)', 'Email (.eml)'].map(format => (
                    <Badge key={format} variant="outline" className="text-xs">
                      {format}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Extract text, analyze content, summarize documents, translate materials
                </p>
              </CardContent>
            </Card>

            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 flex items-center gap-2 text-base">
                  <Volume2 className="w-4 h-4" />
                  Audio Files
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {['MP3', 'WAV', 'M4A', 'Audio Notes'].map(format => (
                    <Badge key={format} variant="outline" className="text-xs">
                      {format}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Speech-to-text transcription, consultation notes, meeting recordings
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-800 flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  Images
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {['JPG', 'PNG', 'Documents', 'Prescriptions'].map(format => (
                    <Badge key={format} variant="outline" className="text-xs">
                      {format}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  OCR text extraction, document translation, image analysis
                </p>
              </CardContent>
            </Card>

            <Card className="border-teal-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-teal-800 flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" />
                  Spreadsheets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {['Excel (.xlsx)', 'CSV', 'Data Analysis'].map(format => (
                    <Badge key={format} variant="outline" className="text-xs">
                      {format}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Data analysis, patient lists, practice statistics, reporting
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Upload Methods</h4>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                </div>
                <h5 className="font-medium text-sm mb-1">Drag & Drop</h5>
                <p className="text-xs text-gray-600">Drop files directly into the chat area</p>
              </div>

              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="bg-green-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <h5 className="font-medium text-sm mb-1">Click to Browse</h5>
                <p className="text-xs text-gray-600">Use the attachment button (+ menu)</p>
              </div>

              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="bg-purple-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Copy className="w-5 h-5 text-purple-600" />
                </div>
                <h5 className="font-medium text-sm mb-1">Paste Text</h5>
                <p className="text-xs text-gray-600">Large text becomes a file automatically</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h5 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              File Processing Features
            </h5>
            <ul className="space-y-1 text-sm text-yellow-700">
              <li>• Automatic content validation and safety checks</li>
              <li>• Text extraction with formatting preservation</li>
              <li>• Multi-language OCR for international documents</li>
              <li>• Audio transcription with medical terminology recognition</li>
              <li>• Progress tracking for large file uploads</li>
              <li>• File content preview before processing</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'history-settings',
      title: 'History & Settings',
      icon: <Settings className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-800 flex items-center gap-2 text-base">
                  <History className="w-4 h-4" />
                  Search History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700">
                  Access previous conversations and continue where you left off.
                </p>
                <ul className="text-xs space-y-1 text-gray-600">
                  <li>• Click "History" button next to service title</li>
                  <li>• Browse by date or search keywords</li>
                  <li>• Reload previous conversations</li>
                  <li>• Protect important searches from deletion</li>
                  <li>• Flag conversations for easy reference</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 flex items-center gap-2 text-base">
                  <Settings className="w-4 h-4" />
                  Customization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700">
                  Personalize your AI4GP experience for optimal usability.
                </p>
                <ul className="text-xs space-y-1 text-gray-600">
                  <li>• Adjust text size (8 different levels)</li>
                  <li>• Interface density settings</li>
                  <li>• High contrast mode for accessibility</li>
                  <li>• Reading-friendly font options</li>
                  <li>• Auto-collapse user prompts</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Advanced Settings</h4>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">AI Model Options</h5>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• GPT-5 (Latest) - Most capable</li>
                  <li>• GPT-4.1 - Reliable and fast</li>
                  <li>• Specialized medical models</li>
                  <li>• Performance vs. cost optimization</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">Response Options</h5>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• Clinical verification level</li>
                  <li>• Response metrics display</li>
                  <li>• Session memory preferences</li>
                  <li>• Auto-formatting options</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h5 className="font-semibold text-indigo-800 mb-3">Practice Integration</h5>
            <p className="text-sm text-indigo-700 mb-2">
              Connect your practice details for enhanced personalization:
            </p>
            <ul className="space-y-1 text-xs text-indigo-600">
              <li>• Practice name and contact information</li>
              <li>• ICB and local formulary integration</li>
              <li>• Custom email and letter signatures</li>
              <li>• Local referral pathways and contacts</li>
              <li>• Team member profiles and roles</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-[95vw] sm:max-w-6xl max-h-[90vh] p-0"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-xl">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <span className="hidden sm:inline">AI4GP Service - User Guide</span>
            <span className="sm:hidden">User Guide</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col sm:flex-row h-[calc(90vh-80px)] sm:h-[calc(90vh-100px)]">
          {/* Sidebar Navigation - Horizontal on mobile, vertical on desktop */}
          <div className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r bg-gray-50 p-2 sm:p-4 overflow-x-auto sm:overflow-x-visible">
            <ScrollArea className="h-full">
              <div className="flex sm:flex-col gap-2 sm:space-y-2 min-w-max sm:min-w-0">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant={activeSection === section.id ? "secondary" : "ghost"}
                    className={`shrink-0 sm:w-full justify-start gap-2 text-left text-xs sm:text-sm ${
                      activeSection === section.id ? 'bg-blue-100 text-blue-800' : ''
                    }`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    {section.icon}
                    <span className="whitespace-nowrap sm:whitespace-normal">{section.title}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
            <ScrollArea className="h-full">
              <div className="max-w-4xl">
                <div className="mb-3 sm:mb-4">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2 sm:gap-3">
                    {currentSection.icon}
                    {currentSection.title}
                  </h2>
                </div>
                
                <div className="prose prose-sm max-w-none text-sm sm:text-base">
                  {currentSection.content}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};