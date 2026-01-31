import React from 'react';
import { Sparkles, Search, FileText, Mic, Calendar, Users, Stethoscope, ClipboardList, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MobileQuickActionsDrawerProps {
  onSelectAction: (prompt: string) => void;
  isPracticeManager?: boolean;
}

const clinicalActions = [
  { label: 'NICE guidance', prompt: 'What does NICE recommend for...', icon: Stethoscope },
  { label: 'Red flags', prompt: 'What are the red flag symptoms for...', icon: Search },
  { label: 'Drug lookup', prompt: 'Tell me about the medication...', icon: FileText },
  { label: 'Differential diagnosis', prompt: 'What are the differential diagnoses for...', icon: ClipboardList },
];

const practiceActions = [
  { label: 'CQC tips', prompt: 'What should I prepare for a CQC inspection?', icon: ClipboardList },
  { label: 'QOF targets', prompt: 'What are the current QOF targets for...', icon: TrendingUp },
  { label: 'Staff training', prompt: 'What training is required for...', icon: Users },
  { label: 'Meeting agenda', prompt: 'Help me create an agenda for a practice meeting about...', icon: Calendar },
];

const toolActions = [
  { label: 'Summarise document', prompt: 'Please summarise the uploaded document', icon: FileText },
  { label: 'Transcribe audio', prompt: 'Please transcribe the uploaded audio', icon: Mic },
  { label: 'Compare documents', prompt: 'Please compare these documents', icon: FileText },
];

export const MobileQuickActionsDrawer: React.FC<MobileQuickActionsDrawerProps> = ({
  onSelectAction,
  isPracticeManager = false
}) => {
  const [open, setOpen] = React.useState(false);

  const handleSelectAction = (prompt: string) => {
    onSelectAction(prompt);
    setOpen(false);
  };

  const ActionChip = ({ label, prompt, icon: Icon }: { label: string; prompt: string; icon: React.ElementType }) => (
    <Button
      variant="outline"
      size="sm"
      className="h-11 min-h-[44px] px-4 rounded-full whitespace-nowrap flex-shrink-0 text-sm mobile-touch-target"
      onClick={() => handleSelectAction(prompt)}
    >
      <Icon className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 min-h-[44px] px-3 text-muted-foreground hover:text-primary mobile-touch-target"
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          <span className="text-sm">Ideas</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[60vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-base">Quick Actions</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="h-11 w-11 min-h-[44px] min-w-[44px] p-0 mobile-touch-target">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        
        <ScrollArea className="px-4 pb-6">
          <div className="space-y-4">
            {/* Clinical Actions */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Clinical</h4>
              <div className="flex flex-wrap gap-2">
                {clinicalActions.map((action) => (
                  <ActionChip key={action.label} {...action} />
                ))}
              </div>
            </div>

            {/* Practice Actions - shown for Practice Managers */}
            {isPracticeManager && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Practice Management</h4>
                <div className="flex flex-wrap gap-2">
                  {practiceActions.map((action) => (
                    <ActionChip key={action.label} {...action} />
                  ))}
                </div>
              </div>
            )}

            {/* Tool Actions */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Tools</h4>
              <div className="flex flex-wrap gap-2">
                {toolActions.map((action) => (
                  <ActionChip key={action.label} {...action} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};
