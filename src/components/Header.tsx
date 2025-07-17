import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, HelpCircle, LogOut, FileText, Home, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

interface HeaderProps {
  onNewMeeting: () => void;
  onHelp: () => void;
}

export const Header = ({ onNewMeeting, onHelp }: HeaderProps) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const isHomePage = location.pathname === '/';
  const isMeetingHistoryPage = location.pathname === '/meetings';
  const isSettingsPage = location.pathname === '/settings';
  return (
    <header className="bg-gradient-primary text-primary-foreground shadow-strong">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Notewell AI Meeting Notes Service
          </h1>
          
          
          <div className="flex gap-2">
            {!isHomePage && (
              <Button 
                onClick={() => navigate('/')}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            )}
            
             {!isMeetingHistoryPage ? (
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button 
                     variant="secondary"
                     size="sm"
                     className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                   >
                     <FileText className="h-4 w-4 mr-2" />
                     Meeting History
                     <ChevronDown className="h-3 w-3 ml-1" />
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent 
                   align="end" 
                   className="bg-background border border-border shadow-lg"
                 >
                   <DropdownMenuItem 
                     onClick={() => navigate('/meetings')}
                     className="cursor-pointer"
                   >
                     <FileText className="h-4 w-4 mr-2" />
                     View Meeting History
                   </DropdownMenuItem>
                   <DropdownMenuItem 
                     onClick={() => navigate('/')}
                     className="cursor-pointer"
                   >
                     <Plus className="h-4 w-4 mr-2" />
                     Start New Meeting
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
             ) : (
               <Button 
                 onClick={() => navigate('/')}
                 variant="secondary"
                 size="sm"
                 className="bg-white/20 hover:bg-white/30 text-white border-white/30"
               >
                 <Plus className="h-4 w-4 mr-2" />
                 Start New Meeting
               </Button>
             )}
            
            {!isSettingsPage && (
              <Button 
                onClick={() => navigate('/settings')}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            )}
            
            {isHomePage && (
              <Button 
                onClick={onNewMeeting}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Plus className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            )}
            
            <Button 
              onClick={onHelp}
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Help & About
            </Button>
            
            {user && (
              <Button
                onClick={signOut}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};