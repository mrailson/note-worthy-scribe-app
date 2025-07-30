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
import { Plus, LogOut, FileText, Home, Settings, ChevronDown, Shield, Stethoscope, Grid3X3, MessageSquareWarning, Sparkles, Mail, Users, Clock, FolderOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface HeaderProps {
  onNewMeeting: () => void;
}

export const Header = ({ onNewMeeting }: HeaderProps) => {
  const { user, signOut, hasModuleAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [sharedDriveVisible, setSharedDriveVisible] = useState(true);
  
  const isHomePage = location.pathname === '/';
  const isGPScribePage = location.pathname === '/gp-scribe';
  const isMeetingHistoryPage = location.pathname === '/meetings';
  const isSettingsPage = location.pathname === '/settings';
  const isAdminPage = location.pathname === '/admin';

  useEffect(() => {
    const checkUserPermissions = async () => {
      if (!user) {
        return;
      }
      
      try {
        // Check admin access
        const { data: adminData, error: adminError } = await supabase
          .rpc('is_system_admin', { _user_id: user.id });
        
        if (!adminError) {
          setIsAdmin(adminData);
        }

        // Check shared drive visibility
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('shared_drive_visible')
          .eq('user_id', user.id)
          .single();

        if (!profileError && profileData?.shared_drive_visible !== undefined) {
          setSharedDriveVisible(profileData.shared_drive_visible);
        }
      } catch (error) {
        console.error('Error checking user permissions:', error);
      }
    };

    checkUserPermissions();
  }, [user]);

  return (
    <header className="bg-gradient-primary text-primary-foreground shadow-strong sticky top-0 z-50">
      <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Mobile-friendly title */}
          <h1 className="text-sm sm:text-xl font-bold leading-tight max-w-[200px] sm:max-w-none">
            <span className="hidden sm:inline">Notewell AI</span>
            <span className="sm:hidden">Notewell AI</span>
          </h1>
          
          {/* Navigation */}
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
                    <span className="hidden sm:inline">Select Service</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="bg-background border border-border shadow-lg z-[100] w-48"
                >
                   {hasModuleAccess('meeting_recorder') && (
                     <DropdownMenuItem 
                       onClick={() => navigate('/')}
                       className="cursor-pointer py-3"
                     >
                       <FileText className="h-4 w-4 mr-2" />
                       Meeting Notes
                     </DropdownMenuItem>
                   )}
                   {hasModuleAccess('gp_scribe') && (
                     <DropdownMenuItem 
                       onClick={() => navigate('/gp-scribe')}
                       className="cursor-pointer py-3"
                     >
                       <Stethoscope className="h-4 w-4 mr-2" />
                       GP Scribe
                     </DropdownMenuItem>
                   )}
                   {hasModuleAccess('complaints_system') && (
                     <DropdownMenuItem 
                       onClick={() => navigate('/complaints')}
                       className="cursor-pointer py-3"
                     >
                       <MessageSquareWarning className="h-4 w-4 mr-2" />
                       Complaints System
                     </DropdownMenuItem>
                   )}
                   {hasModuleAccess('ai_4_pm') && (
                     <DropdownMenuItem 
                       onClick={() => navigate('/ai-4-pm')}
                       className="cursor-pointer py-3"
                     >
                       <Sparkles className="h-4 w-4 mr-2" />
                       AI Assistant
                     </DropdownMenuItem>
                   )}
                   {hasModuleAccess('enhanced_access') && (
                     <DropdownMenuItem 
                       onClick={() => navigate('/enhanced-access')}
                       className="cursor-pointer py-3"
                     >
                       <Clock className="h-4 w-4 mr-2" />
                       Enhanced Access
                     </DropdownMenuItem>
                    )}
                    {sharedDriveVisible && (
                      <DropdownMenuItem 
                        onClick={() => navigate('/shared-drive')}
                        className="cursor-pointer py-3"
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Shared Drive
                      </DropdownMenuItem>
                    )}
                 </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
                  >
                    <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Settings</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="bg-background border border-border shadow-lg z-[100] w-48"
                >
                  <DropdownMenuItem 
                    onClick={() => navigate('/settings')}
                    className="cursor-pointer py-3"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    User Settings
                  </DropdownMenuItem>
                   {isAdmin && (
                      <DropdownMenuItem 
                        onClick={() => navigate('/admin')}
                        className="cursor-pointer py-3"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        System Admin
                      </DropdownMenuItem>
                   )}
                </DropdownMenuContent>
              </DropdownMenu>
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