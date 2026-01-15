import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { 
  Sparkles, 
  Search, 
  Shield, 
  TestTube, 
  Zap, 
  Palette, 
  Newspaper, 
  Plus,
  X
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { QuickActionsPanel } from './QuickActionsPanel';

interface FloatingQuickActionsProps {
  setInput: (input: string) => void;
  onOpenDrugModal: () => void;
  onOpenAITestModal?: () => void;
  onOpenNews?: () => void;
  onOpenImageService?: () => void;
  onOpenQuickImageModal?: () => void;
  imageGenerationModel?: 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
}

export const FloatingQuickActions: React.FC<FloatingQuickActionsProps> = ({
  setInput,
  onOpenDrugModal,
  onOpenAITestModal,
  onOpenNews,
  onOpenImageService,
  onOpenQuickImageModal,
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview'
}) => {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);
  const isMobile = useIsMobile();

  const quickMenuItems = [
    {
      icon: Search,
      label: 'Drug Lookup',
      action: onOpenDrugModal
    },
    {
      icon: TestTube,
      label: 'AI Tester',
      action: onOpenAITestModal
    },
    {
      icon: Newspaper,
      label: 'GP News',
      action: onOpenNews
    },
    {
      icon: Zap,
      label: 'Quick Image',
      action: onOpenQuickImageModal
    },
    {
      icon: Palette,
      label: 'Image Maker',
      action: onOpenImageService
    }
  ];

  const QuickActionsContent = () => (
    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Quick Actions</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowQuickActions(false)}
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <QuickActionsPanel
        showAllQuickActions={showAllQuickActions}
        setShowAllQuickActions={setShowAllQuickActions}
        setInput={setInput}
        selectedRole="gp"
        onOpenAITestModal={onOpenAITestModal}
        onInsertIntoChat={setInput}
        imageGenerationModel={imageGenerationModel}
      />
    </div>
  );

  return (
    <>
      {/* Floating Quick Actions Button */}
      <div 
        className="fixed z-[9998]" 
        style={{
          bottom: isMobile ? `calc(80px + env(safe-area-inset-bottom, 0px))` : '80px',
          left: '16px'
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="h-12 w-12 rounded-full shadow-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground mobile-touch-target border-2 border-background/50"
            >
              <Sparkles className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-48 mb-2"
            sideOffset={8}
          >
            <DropdownMenuItem onClick={() => setShowQuickActions(true)}>
              <Plus className="w-4 h-4 mr-2" />
              All Quick Actions
            </DropdownMenuItem>
            {quickMenuItems.map((item, index) => (
              <DropdownMenuItem 
                key={index}
                onClick={() => item.action?.()}
                disabled={!item.action}
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick Actions Modal/Drawer */}
      {isMobile ? (
        <Drawer open={showQuickActions} onOpenChange={setShowQuickActions}>
          <DrawerContent className="max-h-[80vh]">
            <DrawerHeader>
              <DrawerTitle>Quick Actions</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <QuickActionsPanel
                showAllQuickActions={showAllQuickActions}
                setShowAllQuickActions={setShowAllQuickActions}
                setInput={setInput}
                selectedRole="gp"
                onOpenAITestModal={onOpenAITestModal}
                onInsertIntoChat={setInput}
                imageGenerationModel={imageGenerationModel}
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showQuickActions} onOpenChange={setShowQuickActions}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Quick Actions</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto">
              <QuickActionsPanel
                showAllQuickActions={showAllQuickActions}
                setShowAllQuickActions={setShowAllQuickActions}
                setInput={setInput}
                selectedRole="gp"
                onOpenAITestModal={onOpenAITestModal}
                onInsertIntoChat={setInput}
                imageGenerationModel={imageGenerationModel}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};