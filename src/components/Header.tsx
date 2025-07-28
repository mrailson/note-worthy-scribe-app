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
import { Plus, LogOut, FileText, Home, Settings, ChevronDown, Shield, Stethoscope, Grid3X3, MessageSquareWarning, Sparkles, Mail, Users, Clock } from "lucide-react";
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
  const [moduleAccess, setModuleAccess] = useState({
    meeting_notes_access: true,
    gp_scribe_access: false,
    complaints_manager_access: false,
    complaints_admin_access: false,
    replywell_access: false,
    ai_4_pm_access: false
  });
  
  const isHomePage = location.pathname === '/';
  const isGPScribePage = location.pathname === '/gp-scribe';
  const isMeetingHistoryPage = location.pathname === '/meetings';
  const isSettingsPage = location.pathname === '/settings';
  const isAdminPage = location.pathname === '/admin';

  useEffect(() => {
    const checkUserPermissions = async () => {
      if (!user) {
        console.log('No user found in Header');
        return;
      }
      
      console.log('Checking permissions for user:', user.id);
      
      try {
        // Check admin access
        const { data: adminData, error: adminError } = await supabase
          .rpc('is_system_admin', { _user_id: user.id });
        
        console.log('Admin check result:', { adminData, adminError });
        
        if (!adminError) {
          setIsAdmin(adminData);
        }

        // Get user module access from user_roles table - handle multiple roles
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('meeting_notes_access, gp_scribe_access, complaints_manager_access, complaints_admin_access, replywell_access, ai_4_pm_access')
          .eq('user_id', user.id);

        console.log('Role data result:', { roleData, roleError });

        if (!roleError && roleData && roleData.length > 0) {
          // If user has multiple roles, combine all permissions (OR logic)
          const combinedAccess = roleData.reduce((acc, role) => ({
            meeting_notes_access: acc.meeting_notes_access || role.meeting_notes_access || false,
            gp_scribe_access: acc.gp_scribe_access || role.gp_scribe_access || false,
            complaints_manager_access: acc.complaints_manager_access || role.complaints_manager_access || false,
            complaints_admin_access: acc.complaints_admin_access || role.complaints_admin_access || false,
            replywell_access: acc.replywell_access || role.replywell_access || false,
            ai_4_pm_access: acc.ai_4_pm_access || role.ai_4_pm_access || false
          }), {
            meeting_notes_access: false,
            gp_scribe_access: false,
            complaints_manager_access: false,
            complaints_admin_access: false,
            replywell_access: false,
            ai_4_pm_access: false
          });

          console.log('Combined module access:', combinedAccess);
          setModuleAccess(combinedAccess);
        } else {
          // No roles found, set default access
          console.log('No roles found, setting default access');
          setModuleAccess({
            meeting_notes_access: true,
            gp_scribe_access: false,
            complaints_manager_access: false,
            complaints_admin_access: false,
            replywell_access: false,
            ai_4_pm_access: false
          });
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
                  className="bg-background border border-border shadow-lg z-50 w-48"
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
                  className="bg-background border border-border shadow-lg z-50 w-48"
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