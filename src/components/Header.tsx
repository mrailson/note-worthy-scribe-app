import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, LogOut, FileText, Home, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

interface HeaderProps {
  onNewMeeting: () => void;
}

export const Header = ({ onNewMeeting }: HeaderProps) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const isHomePage = location.pathname === '/';
  const isMeetingHistoryPage = location.pathname === '/meetings';
  const isSettingsPage = location.pathname === '/settings';
  return (
    <header className="bg-gradient-primary text-primary-foreground shadow-strong sticky top-0 z-50">
      <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Mobile-friendly title */}
          <h1 className="text-sm sm:text-xl font-bold leading-tight max-w-[200px] sm:max-w-none">
            <span className="hidden sm:inline">Notewell AI Meeting Notes Service</span>
            <span className="sm:hidden">Notewell AI</span>
          </h1>
          
          {/* Mobile navigation */}
          <div className="flex gap-1 sm:gap-2">
            {!isHomePage && (
              <Button 
                onClick={() => navigate('/')}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
              >
                <Home className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            )}
            
            {user && !isMeetingHistoryPage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
                  >
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Meeting History</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="bg-background border border-border shadow-lg z-50 w-48"
                >
                  <DropdownMenuItem 
                    onClick={() => navigate('/meetings')}
                    className="cursor-pointer py-3"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Meeting History
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate('/')}
                    className="cursor-pointer py-3"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Meeting
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : user && isMeetingHistoryPage ? (
              <Button 
                onClick={() => navigate('/')}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Meeting</span>
              </Button>
            ) : null}
            
            {user && !isSettingsPage && (
              <Button 
                onClick={() => navigate('/settings')}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
              >
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            )}
            
            {user && (
              <Button
                onClick={signOut}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};