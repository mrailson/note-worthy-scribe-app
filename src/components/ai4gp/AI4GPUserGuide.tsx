import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  BookOpen, 
  Mic, 
  Languages, 
  Settings, 
  History,
  CheckCircle,
  Sparkles,
  Stethoscope,
  Building2,
  Newspaper,
  Calendar,
  Activity,
  Camera,
  Upload,
  FileText,
  Keyboard,
  Video,
  ExternalLink
} from 'lucide-react';
import { trainingVideos, CATEGORIES } from '@/data/trainingVideos';

interface AI4GPUserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AI4GPUserGuide = ({ isOpen, onClose }: AI4GPUserGuideProps) => {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    {
      id: 'overview',
      title: 'Getting Started',
      icon: <Sparkles className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">Welcome to AI4GP & AI4PM</h4>
            <p className="text-blue-800 text-sm leading-relaxed">
              Your AI assistant for clinical guidance, practice management, meeting notes, and more. Built for UK healthcare professionals.
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
                NICE guidance, BNF lookup, prescribing, tricky case reviews
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
                Meeting notes, complaints, CQC evidence, communications
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Quick Start</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Type your question or use the <strong>microphone</strong> for voice input</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Click <strong>Prompts</strong> to browse pre-built clinical and management prompts</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Upload documents, images, or audio files for analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Use <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Esc</kbd> to clear</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Use <strong>Insert Details</strong> (clipboard icon) to add practice info to messages</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'input-tools',
      title: 'Input & Shortcuts',
      icon: <Keyboard className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold">Keyboard Shortcuts</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <kbd className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Ctrl+Enter</kbd>
                <span className="text-sm">Send message</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <kbd className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Esc</kbd>
                <span className="text-sm">Clear input</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Input Area Tools</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Mic className="w-5 h-5 text-blue-600" />
                <div>
                  <strong className="text-sm">Microphone</strong>
                  <p className="text-xs text-gray-600">Voice input</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Upload className="w-5 h-5 text-green-600" />
                <div>
                  <strong className="text-sm">Attachments</strong>
                  <p className="text-xs text-gray-600">Upload files or images</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <FileText className="w-5 h-5 text-purple-600" />
                <div>
                  <strong className="text-sm">Insert Details</strong>
                  <p className="text-xs text-gray-600">Add practice/personal info</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <div>
                  <strong className="text-sm">Prompts</strong>
                  <p className="text-xs text-gray-600">Pre-built prompt library</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'sidebar',
      title: 'Sidebar Features',
      icon: <Settings className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold">Main Actions</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm">New Search</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                <History className="w-4 h-4 text-green-600" />
                <span className="text-sm">Search History</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                <Settings className="w-4 h-4 text-purple-600" />
                <span className="text-sm">Settings</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Quick Actions</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Newspaper className="w-4 h-4 text-blue-600" />
                <div>
                  <strong className="text-sm">GP News</strong>
                  <p className="text-xs text-gray-600">Latest NHS updates</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Activity className="w-4 h-4 text-red-600" />
                <div>
                  <strong className="text-sm">BP Average Service</strong>
                  <p className="text-xs text-gray-600">Calculate BP averages</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Languages className="w-4 h-4 text-green-600" />
                <div>
                  <strong className="text-sm">Translation</strong>
                  <p className="text-xs text-gray-600">Medical translations</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                <Camera className="w-4 h-4 text-indigo-600" />
                <div>
                  <strong className="text-sm">LG Capture</strong>
                  <p className="text-xs text-gray-600">Lloyd George records</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Recent Meetings</h4>
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded border border-amber-200">
              <Calendar className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                Your recent meeting recordings appear in the sidebar. Click to view summaries and transcripts.
              </p>
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
              <CardContent className="text-sm text-gray-700">
                <ul className="space-y-1 text-xs">
                  <li>• Browse past conversations</li>
                  <li>• Search by keywords</li>
                  <li>• Protect important searches</li>
                  <li>• Flag for easy reference</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 flex items-center gap-2 text-base">
                  <Settings className="w-4 h-4" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700">
                <ul className="space-y-1 text-xs">
                  <li>• Adjust text size</li>
                  <li>• High contrast mode</li>
                  <li>• Practice details</li>
                  <li>• AI model selection</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      id: 'training-videos',
      title: 'Training Videos',
      icon: <Video className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Short video tutorials to help you get the most out of Notewell AI.
          </p>
          {CATEGORIES.map((category) => {
            const categoryVideos = trainingVideos.filter(v => v.category === category);
            if (categoryVideos.length === 0) return null;
            return (
              <div key={category} className="space-y-3">
                <h4 className="font-semibold text-sm">{category}</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {categoryVideos.map((video) => (
                    <a
                      key={video.id}
                      href={video.loomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border hover:bg-muted transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Video className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm group-hover:text-primary transition-colors">{video.title}</strong>
                          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{video.description}</p>
                        <Badge variant="secondary" className="mt-1.5 text-[10px] h-5">{video.duration}</Badge>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )
    }
  ];

  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-[95vw] sm:max-w-4xl max-h-[85vh] p-0"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-xl">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <span className="hidden sm:inline">AI4GP & AI4PM - User Guide</span>
            <span className="sm:hidden">User Guide</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col sm:flex-row h-[calc(85vh-80px)] sm:h-[calc(85vh-100px)]">
          {/* Sidebar Navigation */}
          <div className="sm:w-48 border-b sm:border-b-0 sm:border-r bg-gray-50 flex-shrink-0">
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
                      <span>{section.title}</span>
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
