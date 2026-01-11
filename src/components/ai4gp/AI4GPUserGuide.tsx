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
  Volume2,
  Calendar,
  Newspaper,
  ImageIcon,
  QrCode,
  Video,
  Presentation,
  ClipboardCheck,
  Syringe,
  Megaphone,
  NotebookPen,
  Search,
  Scale,
  UserCheck,
  Camera,
  Download,
  Play,
  Palette,
  Heart
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
            <h4 className="font-semibold text-blue-900 mb-2">Welcome to AI4GP & AI4PM Service</h4>
            <p className="text-blue-800 text-sm leading-relaxed">
              Your intelligent NHS assistant for clinical guidance, patient information, practice management, 
              meeting notes, medical translations, and more. Built specifically for UK healthcare professionals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-800 flex items-center gap-2 text-base">
                  <Stethoscope className="w-4 h-4" />
                  GP Mode (AI4GP)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-green-700">
                Clinical guidance, NICE/BNF lookup, prescribing, patient care, NHS protocols, tricky case reviews, and medical decision support.
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 flex items-center gap-2 text-base">
                  <Building2 className="w-4 h-4" />
                  Practice Manager Mode (AI4PM)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-purple-700">
                Meeting notes & transcription, PowerPoint generation, complaint handling, CQC evidence, staff management, and practice operations.
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
                <span>Click <strong>Prompts</strong> button to browse pre-built clinical and management prompts</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Upload documents, images, or audio files for analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Use <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-200 rounded">Esc</kbd> to clear input</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Use the <strong>Insert Details</strong> button (clipboard icon) to add practice or personal details</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Hover over the <strong>info icon</strong> near the input for helpful tips and shortcuts</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Right-click any response to access <strong>Quick Pick</strong> enhancement options</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Use the <strong>sidebar</strong> for quick access to tools, history, and recent meetings</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Generate <strong>AI images</strong>, <strong>QR codes</strong>, and <strong>voice files</strong> using the sidebar quick actions</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Download</strong> generated audio files as MP3s for offline use</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'input-tools',
      title: 'Input Tools & Shortcuts',
      icon: <Zap className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 rounded-lg border border-cyan-200">
            <h4 className="font-semibold text-cyan-900 mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Input Area Features
            </h4>
            <p className="text-cyan-800 text-sm">
              The input area includes several productivity tools to help you work faster and provide better context to the AI.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Keyboard Shortcuts</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <kbd className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Ctrl+Enter</kbd>
                <div>
                  <strong className="text-sm">Send Message</strong>
                  <p className="text-xs text-gray-600">Quickly send your message</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <kbd className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Esc</kbd>
                <div>
                  <strong className="text-sm">Clear Input</strong>
                  <p className="text-xs text-gray-600">Clear the input field instantly</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <kbd className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Ctrl+V</kbd>
                <div>
                  <strong className="text-sm">Paste Content</strong>
                  <p className="text-xs text-gray-600">Paste text or images directly</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <kbd className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Drag & Drop</kbd>
                <div>
                  <strong className="text-sm">Upload Files</strong>
                  <p className="text-xs text-gray-600">Drop files onto the input area</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Insert Details Button</h4>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-sm text-indigo-800 mb-3">
                When you start typing, a clipboard icon appears on the left of the input area. Click it to quickly insert:
              </p>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="flex items-start gap-2 p-2 bg-white rounded border border-indigo-200">
                  <Building2 className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-xs text-indigo-900">My Practice Name</strong>
                    <p className="text-xs text-indigo-700">Just the practice name</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 bg-white rounded border border-indigo-200">
                  <Building2 className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-xs text-indigo-900">Practice Name, Email & Phone</strong>
                    <p className="text-xs text-indigo-700">Key contact details</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 bg-white rounded border border-indigo-200">
                  <Building2 className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-xs text-indigo-900">Full Practice Details</strong>
                    <p className="text-xs text-indigo-700">Name, address, phone, email</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 bg-white rounded border border-indigo-200">
                  <UserCheck className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-xs text-indigo-900">My Personal Details</strong>
                    <p className="text-xs text-indigo-700">Your name and email</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Prompts Button</h4>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800 mb-3">
                Click the <strong>Prompts</strong> button above the input area to access pre-built prompts organised by category:
              </p>
              <ul className="text-xs space-y-1 text-purple-700">
                <li>• <strong>GP Clinical</strong> - NICE guidance, BNF lookup, prescribing, tricky cases</li>
                <li>• <strong>Practice Manager</strong> - Meetings, complaints, HR, CQC, communications</li>
                <li>• Search to quickly find specific prompts</li>
                <li>• Click any prompt to insert it into the input area</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Input Tips Hover</h4>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-3">
                Hover over the info icon (ⓘ) near the input area to see helpful tips:
              </p>
              <ul className="text-xs space-y-1 text-amber-700">
                <li>• Be specific with your requests for better results</li>
                <li>• Provide context about your situation</li>
                <li>• Upload supporting documents when relevant</li>
                <li>• Use follow-up questions to refine responses</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Input Area Icons</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Mic className="w-5 h-5 text-blue-600" />
                <div>
                  <strong className="text-sm">Microphone</strong>
                  <p className="text-xs text-gray-600">Voice input for hands-free typing</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Upload className="w-5 h-5 text-green-600" />
                <div>
                  <strong className="text-sm">Attachment (+)</strong>
                  <p className="text-xs text-gray-600">Upload files, images, or audio</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <FileText className="w-5 h-5 text-purple-600" />
                <div>
                  <strong className="text-sm">Insert Details</strong>
                  <p className="text-xs text-gray-600">Add practice/personal details</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <RotateCcw className="w-5 h-5 text-gray-600" />
                <div>
                  <strong className="text-sm">Clear (Eraser)</strong>
                  <p className="text-xs text-gray-600">Clear the input field</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'sidebar',
      title: 'Sidebar & Navigation',
      icon: <Settings className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
            <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Your Control Centre
            </h4>
            <p className="text-indigo-800 text-sm">
              The sidebar provides quick access to all major features. Collapse it for more space or expand for full functionality.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Main Actions</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Card className="border-blue-200">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-800 font-medium">
                    <Sparkles className="w-4 h-4" />
                    New Search
                  </div>
                  <p className="text-xs text-gray-600">Start a fresh conversation</p>
                </CardContent>
              </Card>
              <Card className="border-green-200">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-800 font-medium">
                    <History className="w-4 h-4" />
                    Search History
                  </div>
                  <p className="text-xs text-gray-600">Browse past conversations</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-purple-800 font-medium">
                    <Settings className="w-4 h-4" />
                    Settings
                  </div>
                  <p className="text-xs text-gray-600">Customise your experience</p>
                </CardContent>
              </Card>
            </div>

            <h4 className="font-semibold mt-6">Quick Actions (Sidebar)</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <div>
                  <strong className="text-sm">All Quick Actions</strong>
                  <p className="text-xs text-gray-600">Access all available quick prompts</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Newspaper className="w-4 h-4 text-blue-600" />
                <div>
                  <strong className="text-sm">GP News</strong>
                  <p className="text-xs text-gray-600">Latest NHS and healthcare updates</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Languages className="w-4 h-4 text-green-600" />
                <div>
                  <strong className="text-sm">Translation</strong>
                  <p className="text-xs text-gray-600">Full translation service for documents</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <ImageIcon className="w-4 h-4 text-yellow-600" />
                <div>
                  <strong className="text-sm">Quick Image</strong>
                  <p className="text-xs text-gray-600">Generate AI images with practice templates</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <QrCode className="w-4 h-4 text-gray-700" />
                <div>
                  <strong className="text-sm">QR Code Generator</strong>
                  <p className="text-xs text-gray-600">Create QR codes with optional logo</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Heart className="w-4 h-4 text-red-600" />
                <div>
                  <strong className="text-sm">BP Average Service</strong>
                  <p className="text-xs text-gray-600">Calculate blood pressure averages from readings</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Camera className="w-4 h-4 text-indigo-600" />
                <div>
                  <strong className="text-sm">LG Capture</strong>
                  <p className="text-xs text-gray-600">Capture Lloyd George records and prescriptions</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Volume2 className="w-4 h-4 text-orange-600" />
                <div>
                  <strong className="text-sm">Audio Overview</strong>
                  <p className="text-xs text-gray-600">Generate audio briefings from meetings</p>
                </div>
              </div>
            </div>

            <h4 className="font-semibold mt-6">Recent Meetings</h4>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                Your most recent meeting recordings appear in the sidebar. Click any meeting to view its summary, transcript, and generated notes.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'gp-quick-actions',
      title: 'GP Mode Quick Actions',
      icon: <Stethoscope className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              Clinical Quick Actions
            </h4>
            <p className="text-green-800 text-sm">
              Pre-built prompts optimised for UK primary care, using NICE, BNF, NHS.uk, and local ICB sources.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              { label: 'NICE Guidance Finder', desc: 'Find latest NICE guidelines with key recommendations and implementation timelines', icon: BookOpen },
              { label: 'BNF Drug Lookup', desc: 'Comprehensive prescribing info including dosing, interactions, and monitoring', icon: Shield },
              { label: 'Northamptonshire Prescribing Guidance', desc: 'Local formulary and prescribing recommendations', icon: Search },
              { label: 'Tricky Case Check', desc: 'Clinical case review with differentials, red flags, and teaching points (auto-anonymises)', icon: Stethoscope },
              { label: 'Complaint Response Helper', desc: 'Draft professional NHS complaint responses with practice branding', icon: MessageSquare },
              { label: 'QOF Indicator Quick Check', desc: 'Check achievement and improve performance on QOF targets', icon: CheckCircle },
              { label: 'Patient Leaflet Finder', desc: 'Find NHS.uk and NICE patient information materials', icon: FileText },
              { label: 'Immunisation Schedule Lookup', desc: 'Current UK immunisation schedules from the Green Book', icon: Syringe },
              { label: 'Primary Care Prescribing Alerts', desc: 'Current MHRA drug safety updates and alerts', icon: AlertTriangle },
              { label: 'Practice Policy & Protocol Finder', desc: 'NHS policy and guidance for practice management', icon: Settings }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded border">
                <item.icon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sm text-gray-900">{item.label}</strong>
                  <p className="text-xs text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-2">Tricky Case Check - Auto Anonymisation</h5>
            <p className="text-sm text-blue-700">
              When using the Tricky Case Check, patient-identifiable information (names, DOBs, addresses, NHS numbers) is automatically removed and replaced with generic placeholders. This ensures governance compliance whilst providing clinical decision support.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'pm-quick-actions',
      title: 'Practice Manager Quick Actions',
      icon: <Building2 className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Practice Management Tools
            </h4>
            <p className="text-purple-800 text-sm">
              Comprehensive tools for practice operations, meetings, compliance, and communications.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              { label: 'Load Teams Transcript', desc: 'Import and process Microsoft Teams meeting transcripts', icon: Video },
              { label: 'Audio Transcribe', desc: 'Upload audio files for AI transcription and analysis', icon: Mic },
              { label: 'Complaint Response Helper', desc: 'Draft professional complaint responses with practice details', icon: MessageSquare },
              { label: 'Meeting Notes Service', desc: '10+ meeting templates including formal minutes, team summaries, partnership notes', icon: NotebookPen },
              { label: 'PowerPoint Generator', desc: 'Create professional NHS presentations automatically', icon: Presentation },
              { label: 'ARRS Claim Checker', desc: 'Review ARRS documentation for PCN DES compliance', icon: ClipboardCheck },
              { label: 'PCN DES / Contract Finder', desc: 'Current PCN DES specifications and contract requirements', icon: Building2 },
              { label: 'Staff Rota & Leave Planner', desc: 'Plan rotas and manage leave whilst maintaining service', icon: Calendar },
              { label: 'CQC Evidence Pack Builder', desc: 'Organise evidence across all CQC domains', icon: Shield },
              { label: 'DPIA / IG Helper', desc: 'Data Protection Impact Assessment and IG compliance', icon: Scale },
              { label: 'Subject Access Request (SAR) Assistant', desc: 'SAR process guidance with timelines and exemptions', icon: UserCheck },
              { label: 'Vaccine Clinic Planner', desc: 'Plan vaccine clinic logistics and staffing', icon: Syringe },
              { label: 'Practice Comms Builder', desc: 'Create communications for patients, staff, or stakeholders', icon: Megaphone }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded border">
                <item.icon className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sm text-gray-900">{item.label}</strong>
                  <p className="text-xs text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h5 className="font-semibold text-indigo-800 mb-2">Meeting Notes Templates</h5>
            <div className="flex flex-wrap gap-1 mt-2">
              {[
                'Formal board/committee minutes',
                'Informal team meeting summary',
                'Agenda-based notes',
                'Narrative minutes',
                'Resolution-style minutes',
                'Brainstorming session',
                'HR meeting summary',
                'GP partnership meeting',
                'Supplier negotiation',
                'Executive session'
              ].map((template, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{template}</Badge>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'meetings',
      title: 'Meeting Notes & Transcription',
      icon: <NotebookPen className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200">
            <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <NotebookPen className="w-4 h-4" />
              Intelligent Meeting Support
            </h4>
            <p className="text-amber-800 text-sm">
              Record meetings live, upload audio files, or import Teams transcripts. AI generates structured notes, action items, and summaries.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-800 flex items-center gap-2 text-base">
                  <Mic className="w-4 h-4" />
                  Live Recording
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                Record meetings in real-time with live transcription and word count tracking.
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-800 flex items-center gap-2 text-base">
                  <Upload className="w-4 h-4" />
                  Audio Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                Upload MP3, WAV, or M4A files for transcription and note generation.
              </CardContent>
            </Card>

            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 flex items-center gap-2 text-base">
                  <Video className="w-4 h-4" />
                  Teams Import
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                Import Microsoft Teams meeting transcripts for processing and note generation.
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Recent Meetings Access</h4>
            <div className="bg-gray-50 border rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-3">
                Your recent meetings appear in the sidebar. Click any meeting to:
              </p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• View the full meeting summary</li>
                <li>• Access the complete transcript</li>
                <li>• Review action items and decisions</li>
                <li>• Export notes in various formats</li>
                <li>• Edit meeting title and details</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-3">Meeting Templates Available</h5>
            <p className="text-sm text-blue-700 mb-2">
              Choose from 10+ professional meeting note formats:
            </p>
            <ul className="text-xs space-y-1 text-blue-600">
              <li>• Formal board/committee minutes with motions and votes</li>
              <li>• Informal team meeting summaries</li>
              <li>• GP partnership meeting notes</li>
              <li>• HR meeting documentation (confidential)</li>
              <li>• Brainstorming session capture</li>
              <li>• And more...</li>
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
                  Full translation service via sidebar:
                </p>
                <ol className="text-xs space-y-1 text-gray-600">
                  <li>1. Click "Translation" in sidebar</li>
                  <li>2. Upload document or paste text</li>
                  <li>3. Select source and target language</li>
                  <li>4. Receive formatted translation</li>
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
      id: 'image-generation',
      title: 'Image Generation',
      icon: <ImageIcon className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-lg border border-pink-200">
            <h4 className="font-semibold text-pink-900 mb-2 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              AI Image Creation
            </h4>
            <p className="text-pink-800 text-sm">
              Generate professional images for practice communications, social media, posters, and patient materials using AI.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">How to Access</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <ImageIcon className="w-5 h-5 text-pink-600" />
                <div>
                  <strong className="text-sm">Sidebar → Quick Image</strong>
                  <p className="text-xs text-gray-600">Click Quick Image in the sidebar Quick Actions</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Zap className="w-5 h-5 text-yellow-600" />
                <div>
                  <strong className="text-sm">+ Menu → Images</strong>
                  <p className="text-xs text-gray-600">Use the attachment menu and select Images</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Practice Quick Picks</h4>
            <p className="text-sm text-gray-600 mb-3">Pre-built templates for common practice needs:</p>
            <div className="grid md:grid-cols-2 gap-2">
              {[
                { name: 'DNA Reminder Poster', desc: 'Did Not Attend appointment reminders' },
                { name: 'Flu Campaign Social Media', desc: 'Seasonal flu vaccination promotion' },
                { name: 'Opening Hours Notice', desc: 'Display practice opening times' },
                { name: 'Staff Appreciation Post', desc: 'Celebrate team achievements' },
                { name: 'Service Update Announcement', desc: 'New services or changes' },
                { name: 'Health Awareness Campaign', desc: 'Public health messaging' }
              ].map((template, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-pink-50 rounded border border-pink-200">
                  <Sparkles className="w-4 h-4 text-pink-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-xs text-pink-900">{template.name}</strong>
                    <p className="text-xs text-pink-700">{template.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Style Options</h4>
            <div className="flex flex-wrap gap-1">
              {[
                'Photographic', 'Cartoon', 'Oil Painting', 'Watercolour', 
                'Digital Art', 'Pencil Sketch', 'Minimalist', 'Vintage', 'Infographic'
              ].map(style => (
                <Badge key={style} variant="outline" className="text-xs">
                  <Palette className="w-3 h-3 mr-1" />
                  {style}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Voice Input
              </h5>
              <p className="text-sm text-blue-700">
                Use the microphone button to describe your image using voice instead of typing.
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h5 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Practice Details
              </h5>
              <p className="text-sm text-purple-700">
                Toggle to automatically include your practice name and contact information in generated images.
              </p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Saving & Downloading
            </h5>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Click <strong>Download</strong> to save images as PNG files</li>
              <li>• Images are saved to your <strong>Image Gallery</strong> for later use</li>
              <li>• Re-use previously generated images from the gallery</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'qr-codes',
      title: 'QR Code Generator',
      icon: <QrCode className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-4 rounded-lg border border-gray-300">
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              QR Code Creation
            </h4>
            <p className="text-gray-700 text-sm">
              Generate QR codes for websites, appointment links, patient information, and more. Optional logo embedding available.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">How to Access</h4>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
              <QrCode className="w-5 h-5 text-gray-700" />
              <div>
                <strong className="text-sm">Sidebar → QR Code Generator</strong>
                <p className="text-xs text-gray-600">Click "QR Code Generator" in the Quick Actions section</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Creating a QR Code</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <div className="bg-gray-200 rounded-full p-1 mt-0.5">
                  <span className="text-gray-800 font-bold text-xs">1</span>
                </div>
                <div>
                  <strong className="text-sm">Enter URL</strong>
                  <p className="text-xs text-gray-600 mt-1">Enter the full URL including http:// or https://</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <div className="bg-gray-200 rounded-full p-1 mt-0.5">
                  <span className="text-gray-800 font-bold text-xs">2</span>
                </div>
                <div>
                  <strong className="text-sm">Choose Size</strong>
                  <p className="text-xs text-gray-600 mt-1">Select 256×256, 512×512, or 1024×1024 pixels</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <div className="bg-gray-200 rounded-full p-1 mt-0.5">
                  <span className="text-gray-800 font-bold text-xs">3</span>
                </div>
                <div>
                  <strong className="text-sm">Add Logo (Optional)</strong>
                  <p className="text-xs text-gray-600 mt-1">Toggle to include a custom logo in the centre</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <div className="bg-gray-200 rounded-full p-1 mt-0.5">
                  <span className="text-gray-800 font-bold text-xs">4</span>
                </div>
                <div>
                  <strong className="text-sm">Generate & Download</strong>
                  <p className="text-xs text-gray-600 mt-1">Click Generate, then download as PNG</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h5 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Error Correction Levels
            </h5>
            <div className="grid grid-cols-2 gap-2 text-xs text-amber-700">
              <div><strong>Low (7%)</strong> - Smallest QR code</div>
              <div><strong>Medium (15%)</strong> - Balanced</div>
              <div><strong>Quartile (25%)</strong> - Better with logos</div>
              <div><strong>High (30%)</strong> - Best for printing</div>
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Higher error correction allows more of the QR code to be obscured (e.g., by a logo) whilst remaining scannable.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-2">Common Uses</h5>
            <div className="flex flex-wrap gap-1">
              {[
                'Practice website', 'Online booking', 'Patient portal', 'NHS App', 
                'Feedback forms', 'Patient leaflets', 'Prescription info', 'Event registration'
              ].map(use => (
                <Badge key={use} variant="secondary" className="text-xs">{use}</Badge>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'voice-files',
      title: 'Voice File Generation',
      icon: <Volume2 className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Audio Generation & Download
            </h4>
            <p className="text-orange-800 text-sm">
              Generate voice audio files from text content, meeting summaries, and briefings. Download as MP3 for offline listening.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Audio Features</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-orange-800 flex items-center gap-2 text-base">
                    <NotebookPen className="w-4 h-4" />
                    Meeting Audio Overviews
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700">
                  <p className="mb-2">Generate spoken briefings from meeting transcripts:</p>
                  <ol className="text-xs space-y-1 text-gray-600">
                    <li>1. Open any meeting from Recent Meetings</li>
                    <li>2. Click "Generate Audio Overview"</li>
                    <li>3. Choose voice and duration</li>
                    <li>4. Download MP3 for playback</li>
                  </ol>
                </CardContent>
              </Card>

              <Card className="border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-purple-800 flex items-center gap-2 text-base">
                    <Volume2 className="w-4 h-4" />
                    Audio Overview Studio
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700">
                  <p className="mb-2">Create custom audio from any text:</p>
                  <ol className="text-xs space-y-1 text-gray-600">
                    <li>1. Navigate to Audio Overview Studio</li>
                    <li>2. Paste or upload content</li>
                    <li>3. Select voice and style</li>
                    <li>4. Generate and download audio</li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Voice Selection</h4>
            <p className="text-sm text-gray-600 mb-3">Choose from a variety of British and American voices:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { name: 'Alice', accent: 'British Female' },
                { name: 'Lily', accent: 'British Female' },
                { name: 'George', accent: 'British Male' },
                { name: 'Brian', accent: 'American Male' },
                { name: 'Matilda', accent: 'American Female' },
                { name: 'Will', accent: 'American Male' },
                { name: 'Charlotte', accent: 'British Female' },
                { name: 'Daniel', accent: 'British Male' }
              ].map(voice => (
                <div key={voice.name} className="p-2 bg-orange-50 rounded border border-orange-200 text-center">
                  <strong className="text-xs text-orange-900">{voice.name}</strong>
                  <p className="text-xs text-orange-700">{voice.accent}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <Play className="w-4 h-4" />
              Audio Player Controls
            </h5>
            <p className="text-sm text-blue-700 mb-2">
              When audio is generated, a player appears with these controls:
            </p>
            <ul className="text-xs space-y-1 text-blue-600">
              <li>• <strong>Play/Pause</strong> - Start or pause playback</li>
              <li>• <strong>Progress Bar</strong> - Scrub through the audio</li>
              <li>• <strong>Restart</strong> - Return to the beginning</li>
              <li>• <strong>Download</strong> - Save as MP3 file</li>
              <li>• <strong>Speed Control</strong> - Adjust playback speed</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Downloading Audio Files
            </h5>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Click the <strong>Download</strong> button on any audio player</li>
              <li>• Files are saved as high-quality <strong>MP3</strong> format</li>
              <li>• Perfect for listening during commutes or offline</li>
              <li>• Share audio briefings with colleagues</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'lg-capture',
      title: 'LG Capture Service',
      icon: <Camera className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 p-4 rounded-lg border border-indigo-200">
            <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Lloyd George Capture
            </h4>
            <p className="text-indigo-800 text-sm">
              Capture and process Lloyd George records, prescriptions, and medical documents using your device camera or file upload.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">How to Access</h4>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
              <Camera className="w-5 h-5 text-indigo-600" />
              <div>
                <strong className="text-sm">Sidebar → LG Capture</strong>
                <p className="text-xs text-gray-600">Click "LG Capture" in the Quick Actions section</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-800 flex items-center gap-2 text-base">
                  <Camera className="w-4 h-4" />
                  Camera Capture
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                <p className="mb-2">Use your device camera to photograph documents:</p>
                <ul className="text-xs space-y-1 text-gray-600">
                  <li>• Position document in frame</li>
                  <li>• Ensure good lighting</li>
                  <li>• Capture automatically processes</li>
                  <li>• OCR extracts text content</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-800 flex items-center gap-2 text-base">
                  <Upload className="w-4 h-4" />
                  File Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                <p className="mb-2">Upload existing digital files:</p>
                <ul className="text-xs space-y-1 text-gray-600">
                  <li>• PDF documents</li>
                  <li>• Scanned images (JPG, PNG)</li>
                  <li>• Multiple files at once</li>
                  <li>• Drag and drop supported</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Document Types</h4>
            <div className="flex flex-wrap gap-1">
              {[
                'Lloyd George Records', 'Prescriptions', 'Referral Letters', 
                'Test Results', 'Hospital Discharge', 'GP Letters', 
                'Consent Forms', 'Medical Certificates'
              ].map(type => (
                <Badge key={type} variant="outline" className="text-xs">
                  <FileText className="w-3 h-3 mr-1" />
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h5 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Patient Information
            </h5>
            <p className="text-sm text-amber-700">
              Link captures to patient records by entering patient details. This helps organise documents and enables searching by patient.
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h5 className="font-semibold text-purple-800 mb-2">Processing Pipeline</h5>
            <ol className="text-sm text-purple-700 space-y-1">
              <li>1. <strong>Capture/Upload</strong> - Document is received</li>
              <li>2. <strong>OCR Processing</strong> - Text is extracted automatically</li>
              <li>3. <strong>Document Classification</strong> - Type is identified</li>
              <li>4. <strong>Review</strong> - View extracted content and edit if needed</li>
              <li>5. <strong>Storage</strong> - Saved to recent captures for access</li>
            </ol>
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
              Upload and analyse documents, images, audio files, and spreadsheets. AI extracts content 
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
                  {['PDF', 'Word (.doc/.docx)', 'RTF', 'Text (.txt)', 'Email (.eml)'].map(format => (
                    <Badge key={format} variant="outline" className="text-xs">
                      {format}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Extract text, analyse content, summarise documents, translate materials
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
                  <ImageIcon className="w-4 h-4" />
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
        </div>
      )
    },
    {
      id: 'history-settings',
      title: 'History & Settings',
      icon: <History className="w-4 h-4" />,
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
                  <li>• Click "History" in the sidebar</li>
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
                  Customisation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700">
                  Personalise your AI4GP/AI4PM experience for optimal usability.
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
                  <li>• Specialised medical models</li>
                  <li>• Performance vs. cost optimisation</li>
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
              Connect your practice details for enhanced personalisation:
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
            <span className="hidden sm:inline">AI4GP & AI4PM Service - User Guide</span>
            <span className="sm:hidden">User Guide</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col sm:flex-row h-[calc(90vh-80px)] sm:h-[calc(90vh-100px)]">
          {/* Sidebar Navigation - Horizontal on mobile, vertical on desktop */}
          <div className="sm:w-56 border-b sm:border-b-0 sm:border-r bg-gray-50 flex-shrink-0">
            {/* Mobile: Horizontal scroll */}
            <div className="sm:hidden">
              <ScrollArea className="w-full">
                <div className="flex gap-1 p-2 min-w-max">
                  {sections.map((section) => (
                    <Button
                      key={section.id}
                      variant={activeSection === section.id ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setActiveSection(section.id)}
                      className="flex items-center gap-1.5 text-xs whitespace-nowrap flex-shrink-0 h-8"
                    >
                      {section.icon}
                      <span className="max-w-[80px] truncate">{section.title}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Desktop: Vertical scroll */}
            <ScrollArea className="hidden sm:block h-full">
              <div className="p-3 space-y-1">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant={activeSection === section.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSection(section.id)}
                    className="w-full justify-start gap-2 text-left h-9"
                  >
                    {section.icon}
                    <span className="truncate text-sm">{section.title}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                {currentSection.icon}
                <h3 className="text-lg sm:text-xl font-semibold">{currentSection.title}</h3>
              </div>
              {currentSection.content}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
