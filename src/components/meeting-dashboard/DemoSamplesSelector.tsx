import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FileText, Users, FileText as FileTextIcon, Play, Sparkles, ChevronLeft, ChevronRight, Stethoscope, Building2 } from 'lucide-react';
import { demoMeetings, DemoMeeting } from '@/data/demoMeetings';
import { useAuth } from '@/contexts/AuthContext';

interface DemoSamplesSelectorProps {
  onSelectDemo: (demo: DemoMeeting) => void;
  disabled?: boolean;
}

export const DemoSamplesSelector: React.FC<DemoSamplesSelectorProps> = ({
  onSelectDemo,
  disabled = false
}) => {
  const { canViewConsultationExamples } = useAuth();
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOrgType, setSelectedOrgType] = useState<'All' | 'GP Practice' | 'LMC' | 'Others'>('GP Practice');
  const itemsPerPage = 4;
  
  // Filter demos based on visibility settings
  let availableDemos = demoMeetings;
  
  // Remove consultation demos if user doesn't have access
  if (!canViewConsultationExamples) {
    availableDemos = demoMeetings.filter(meeting => meeting.category !== 'Consultation');
  }
  
  // Filter by organisation type
  const filteredDemos = selectedOrgType === 'All'
    ? availableDemos
    : availableDemos.filter(meeting => {
        // Map "Others" filter to "ICB" organisation type
        const filterType = selectedOrgType === 'Others' ? 'ICB' : selectedOrgType;
        return meeting.organizationType === filterType;
      });
  
  const totalPages = Math.ceil(filteredDemos.length / itemsPerPage);
  
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMeetings = filteredDemos.slice(startIndex, endIndex);

  // Reset page when organisation type changes
  const handleOrgTypeChange = (value: string) => {
    setSelectedOrgType(value as 'All' | 'GP Practice' | 'LMC' | 'Others');
    setCurrentPage(0);
  };

  const getMeetingTypeColor = (type: DemoMeeting['type']) => {
    switch (type) {
      case 'LMC':
        return 'bg-blue-500/10 text-blue-700 border-blue-300';
      case 'PCN':
        return 'bg-green-500/10 text-green-700 border-green-300';
      case 'Partnership':
        return 'bg-purple-500/10 text-purple-700 border-purple-300';
      case 'ICB':
        return 'bg-orange-500/10 text-orange-700 border-orange-300';
      case 'Neighbourhood':
        return 'bg-teal-500/10 text-teal-700 border-teal-300';
      case 'Regional':
        return 'bg-indigo-500/10 text-indigo-700 border-indigo-300';
      case 'Trust':
        return 'bg-red-500/10 text-red-700 border-red-300';
      case 'MDT':
        return 'bg-pink-500/10 text-pink-700 border-pink-300';
      case 'Consultation':
        return 'bg-cyan-500/10 text-cyan-700 border-cyan-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Organisation:</span>
            <ToggleGroup 
              type="single" 
              value={selectedOrgType} 
              onValueChange={(value) => value && handleOrgTypeChange(value)}
              className="gap-1"
            >
              <ToggleGroupItem value="All" aria-label="Show all organisations" className="gap-2">
                <Building2 className="h-4 w-4" />
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="GP Practice" aria-label="Show GP Practice meetings" className="gap-2">
                <Stethoscope className="h-4 w-4" />
                GP
              </ToggleGroupItem>
              <ToggleGroupItem value="LMC" aria-label="Show LMC meetings" className="gap-2">
                <Users className="h-4 w-4" />
                LMC
              </ToggleGroupItem>
              <ToggleGroupItem value="Others" aria-label="Show other organisation meetings" className="gap-2">
                <Building2 className="h-4 w-4" />
                Others
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        
        <Badge variant="secondary" className="text-xs shrink-0">
          {filteredDemos.length} {filteredDemos.length === 1 ? 'demo' : 'demos'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {currentMeetings.map((demo) => (
          <Card key={demo.id} className="relative overflow-hidden hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/5 to-transparent" />
            
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{demo.icon}</span>
                  <Badge variant="outline" className={getMeetingTypeColor(demo.type)}>
                    {demo.type}
                  </Badge>
                </div>
                <Badge variant="secondary" className="bg-accent/50">
                  Demo
                </Badge>
              </div>
              <CardTitle className="text-lg leading-tight">{demo.title}</CardTitle>
              <CardDescription className="text-sm">
                {demo.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="relative h-3.5 w-3.5">
                    <FileText className="h-3.5 w-3.5 text-blue-500 absolute" />
                    <FileText className="h-3.5 w-3.5 text-green-500 absolute opacity-40" style={{ filter: 'blur(0.5px)' }} />
                  </div>
                  <span>{demo.duration}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{demo.attendees.length} attendees</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{demo.wordCount.toLocaleString()} words</span>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  <strong>Topics:</strong> {demo.agenda}
                </p>

                <Button
                  size="sm"
                  onClick={() => onSelectDemo(demo)}
                  disabled={disabled}
                  className="w-full"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Create Meeting
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0 || disabled}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1 || disabled}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Demo meetings are marked with a special badge and contain fictional data based on realistic NHS scenarios. 
          They're ideal for client presentations, training sessions, and testing the note generation capabilities.
        </p>
      </div>
    </div>
  );
};