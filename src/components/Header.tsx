import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Plus, LogOut, FileText, Home, Settings, ChevronDown, Shield, Stethoscope, Grid3X3, MessageSquareWarning, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface HeaderProps {
  onNewMeeting: () => void;
}

export const Header = ({ onNewMeeting }: HeaderProps) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const isHomePage = location.pathname === '/';
  const isGPScribePage = location.pathname === '/gp-scribe';
  const isMeetingHistoryPage = location.pathname === '/meetings';
  const isSettingsPage = location.pathname === '/settings';
  const isAdminPage = location.pathname === '/admin';

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .rpc('is_system_admin', { _user_id: user.id });
        
        if (!error) {
          setIsAdmin(data);
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
      }
    };

    checkAdminAccess();
  }, [user]);

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
            <Button 
              onClick={() => isHomePage ? onNewMeeting() : navigate('/')}
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
            >
              <Home className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
                  >
                    <Grid3X3 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Select Module</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="bg-background border border-border shadow-lg z-50 w-48"
                >
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer py-3">
                      <FileText className="h-4 w-4 mr-2" />
                      Meeting Notes Service
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-background border border-border shadow-lg">
                      <DropdownMenuItem 
                        onClick={() => navigate('/')}
                        className="cursor-pointer py-3"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Start New Meeting
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => navigate('/meetings')}
                        className="cursor-pointer py-3"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Meeting History
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem 
                    onClick={() => navigate('/gp-scribe')}
                    className="cursor-pointer py-3"
                  >
                    <Stethoscope className="h-4 w-4 mr-2" />
                    GP Scribe
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate('/complaints')}
                    className="cursor-pointer py-3"
                  >
                    <MessageSquareWarning className="h-4 w-4 mr-2" />
                    Complaints System
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate('/replywell-ai')}
                    className="cursor-pointer py-3"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    ReplyWell AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
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
            
            {user && isAdmin && !isAdminPage && (
              <Button 
                onClick={() => navigate('/admin')}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
              >
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
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