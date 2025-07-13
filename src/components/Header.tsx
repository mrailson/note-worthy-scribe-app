import { Button } from "@/components/ui/button";
import { Plus, HelpCircle } from "lucide-react";

interface HeaderProps {
  onNewMeeting: () => void;
  onHelp: () => void;
}

export const Header = ({ onNewMeeting, onHelp }: HeaderProps) => {
  return (
    <header className="bg-gradient-primary text-primary-foreground shadow-strong">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Notewell AI Meeting Notes Service
          </h1>
          
          <div className="flex gap-2">
            <Button 
              onClick={onNewMeeting}
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Start New Meeting
            </Button>
            <Button 
              onClick={onHelp}
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Help & About
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};