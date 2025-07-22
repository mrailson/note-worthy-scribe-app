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
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
} from "@/components/ui/menubar";
import { Plus, LogOut, FileText, Home, Settings, ChevronDown, Shield, Stethoscope, Grid3X3, MessageSquareWarning, Sparkles, Mail } from "lucide-react";
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
            <span className="hidden sm:inline">Notewell AI</span>
            <span className="sm:hidden">Notewell AI</span>
          </h1>
          
          {/* Top-level menubar navigation */}
          {user ? (
            <Menubar className="bg-transparent border-none">
              <MenubarMenu>
                <MenubarTrigger className="text-white hover:bg-white/20 focus:bg-white/20 data-[state=open]:bg-white/20">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </MenubarTrigger>
                <MenubarContent className="bg-background border-border">
                  <MenubarItem onClick={() => navigate('/')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Meeting
                  </MenubarItem>
                  <MenubarItem onClick={() => navigate('/meetings')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Meeting History
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>

              <MenubarMenu>
                <MenubarTrigger className="text-white hover:bg-white/20 focus:bg-white/20 data-[state=open]:bg-white/20">
                  <Stethoscope className="h-4 w-4 mr-2" />
                  Clinical
                </MenubarTrigger>
                <MenubarContent className="bg-background border-border">
                  <MenubarItem onClick={() => navigate('/gp-scribe')}>
                    <Stethoscope className="h-4 w-4 mr-2" />
                    GP Scribe
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarSub>
                    <MenubarSubTrigger>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Services
                    </MenubarSubTrigger>
                    <MenubarSubContent className="bg-background border-border">
                      <MenubarItem onClick={() => navigate('/ai-4-pm')}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        AI 4 PM
                      </MenubarItem>
                      <MenubarItem onClick={() => navigate('/replywell-ai')}>
                        <Mail className="h-4 w-4 mr-2" />
                        ReplyWell AI
                      </MenubarItem>
                    </MenubarSubContent>
                  </MenubarSub>
                </MenubarContent>
              </MenubarMenu>

              <MenubarMenu>
                <MenubarTrigger className="text-white hover:bg-white/20 focus:bg-white/20 data-[state=open]:bg-white/20">
                  <MessageSquareWarning className="h-4 w-4 mr-2" />
                  Quality
                </MenubarTrigger>
                <MenubarContent className="bg-background border-border">
                  <MenubarItem onClick={() => navigate('/complaints')}>
                    <MessageSquareWarning className="h-4 w-4 mr-2" />
                    Complaints System
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>

              <MenubarMenu>
                <MenubarTrigger className="text-white hover:bg-white/20 focus:bg-white/20 data-[state=open]:bg-white/20">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </MenubarTrigger>
                <MenubarContent className="bg-background border-border">
                  <MenubarItem onClick={() => navigate('/settings')}>
                    <Settings className="h-4 w-4 mr-2" />
                    User Settings
                  </MenubarItem>
                  {isAdmin && (
                    <>
                      <MenubarSeparator />
                      <MenubarItem onClick={() => navigate('/admin')}>
                        <Shield className="h-4 w-4 mr-2" />
                        System Admin
                      </MenubarItem>
                    </>
                  )}
                  <MenubarSeparator />
                  <MenubarItem onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          ) : (
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate('/')}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};