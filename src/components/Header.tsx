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
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, LogOut, FileText, Home, Settings, ChevronDown, Shield, Stethoscope, Grid3X3, MessageSquareWarning, Sparkles, Mail, Users, Clock, FolderOpen, Wrench, BookOpen, Menu, ChevronsDown, Stars, ImageIcon, User, Palette, Zap, Mic, Languages } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger, DrawerClose, DrawerFooter } from "@/components/ui/drawer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserProfileModal } from "@/components/UserProfileModal";
import { ConsultationSummaryPreview } from "@/components/ConsultationSummaryPreview";
import notewellLogo from "@/assets/notewell-logo.png";
interface HeaderProps {
  onNewMeeting?: () => void;
}

export const Header = ({ onNewMeeting }: HeaderProps) => {
  const { user, signOut, hasModuleAccess, refreshUserModules, isSystemAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sharedDriveVisible, setSharedDriveVisible] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
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
      <div className="container mx-auto px-3 py-1 sm:px-4 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Mobile-friendly title - show for both logged in and logged out */}
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
            onClick={() => navigate('/')}
          >
            {user && (
              <img 
                src={notewellLogo} 
                alt="Notewell AI" 
                className="h-8 sm:h-10 w-auto"
              />
            )}
            <span className="text-sm sm:text-xl font-bold text-white flex items-center">
              Notewell AI
              <Stars className="h-4 w-4 sm:h-5 sm:w-5 ml-2 text-white" />
            </span>
          </div>
          
            {/* Navigation */}
            <div className="hidden sm:flex gap-2">
              <Button 
                onClick={() => navigate('/')}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
              >
                <Home className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Home</span>
              </Button>
              
              {!user && (
                <Button 
                  onClick={() => navigate('/security-compliance')}
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
                >
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Security</span>
                </Button>
              )}
            
            {user && (
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs sm:text-sm px-2 sm:px-4"
                    onClick={() => refreshUserModules()}
                  >
                    <Grid3X3 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Select Service</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                 <DropdownMenuContent 
                   align="end" 
                   className="bg-background border border-border shadow-lg w-48 z-50"
                 >
                        <DropdownMenuItem 
                          onClick={() => navigate('/ai4gp')}
                          className="cursor-pointer py-3"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI4GP Service
                        </DropdownMenuItem>
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
                        AI 4 PM Assistant
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
                       {hasModuleAccess('cqc_compliance_access') && (
                         <DropdownMenuItem 
                           onClick={() => navigate('/cqc-compliance')}
                           className="cursor-pointer py-3"
                         >
                           <Shield className="h-4 w-4 mr-2" />
                           CQC Compliance
                         </DropdownMenuItem>
                       )}
                       {hasModuleAccess('shared_drive_access') && (
                         <DropdownMenuItem 
                           onClick={() => navigate('/shared-drive')}
                           className="cursor-pointer py-3"
                         >
                           <FolderOpen className="h-4 w-4 mr-2" />
                           Shared Drive
                         </DropdownMenuItem>
                        )}
                        {hasModuleAccess('mic_test_service_access') && (
                          <DropdownMenuItem 
                            onClick={() => navigate('/mic-test')}
                            className="cursor-pointer py-3"
                          >
                            <Wrench className="h-4 w-4 mr-2" />
                            Mic Test Service
                          </DropdownMenuItem>
                        )}
                         {hasModuleAccess('translation_service') && (
                          <DropdownMenuItem 
                            onClick={() => {
                              // Check if mobile and redirect accordingly
                              const isMobileScreen = window.innerWidth < 768;
                              const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                              
                              if (isMobileScreen || isMobileUserAgent) {
                                navigate('/mobile-translate');
                              } else {
                                navigate('/translation-tool');
                              }
                            }}
                            className="cursor-pointer py-3"
                          >
                            <Languages className="h-4 w-4 mr-2" />
                            Translation Service
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
                    <User className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{user?.email?.split('@')[0] || 'Profile'}</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                 <DropdownMenuContent 
                   align="end" 
                   className="bg-background border border-border shadow-lg w-48 z-50"
                 >
                   <DropdownMenuItem 
                     onClick={() => setShowProfileModal(true)}
                     className="cursor-pointer py-3"
                   >
                     <User className="h-4 w-4 mr-2" />
                     My Profile
                   </DropdownMenuItem>
                   <DropdownMenuSeparator />
                   <DropdownMenuItem 
                     onClick={() => navigate('/settings')}
                     className="cursor-pointer py-3"
                   >
                     <Settings className="h-4 w-4 mr-2" />
                     User Settings
                   </DropdownMenuItem>
                   {/* Practice Manager Menu */}
                   {hasModuleAccess('practice_manager_access') && (
                     <DropdownMenuItem 
                       onClick={() => navigate('/practice-admin')}
                       className="cursor-pointer py-3"
                     >
                       <Users className="h-4 w-4 mr-2" />
                       Practice Management
                     </DropdownMenuItem>
                   )}
                   
                   {/* System Admin Menu */}
                   {isSystemAdmin && (
                     <DropdownMenuSub>
                       <DropdownMenuSubTrigger className="cursor-pointer py-3">
                         <Shield className="h-4 w-4 mr-2" />
                         System Admin
                       </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="bg-background border border-border shadow-lg z-50">
                          <DropdownMenuItem 
                            onClick={() => navigate('/admin')}
                            className="cursor-pointer py-3"
                          >
                            <Wrench className="h-4 w-4 mr-2" />
                            Admin Dashboard
                          </DropdownMenuItem>
                           <DropdownMenuItem 
                             onClick={() => navigate('/security-compliance')}
                             className="cursor-pointer py-3"
                           >
                             <BookOpen className="h-4 w-4 mr-2" />
                             Security Documentation
                          </DropdownMenuItem>
                           <DropdownMenuItem 
                             onClick={() => navigate('/transcription-comparison')}
                             className="cursor-pointer py-3"
                           >
                             <Mic className="h-4 w-4 mr-2" />
                             Mic and Transcript Lab
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>
                   )}
                   <DropdownMenuSeparator />
                   <DropdownMenuItem 
                     onClick={signOut}
                     className="cursor-pointer py-3 text-destructive focus:text-destructive"
                   >
                     <LogOut className="h-4 w-4 mr-2" />
                     Logout
                   </DropdownMenuItem>
                 </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Mobile menu - upgraded to full-height Drawer */}
          <div className="sm:hidden">
            <Drawer>
              <DrawerTrigger asChild>
                <Button 
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 h-8 w-8 p-0"
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-[92dvh] sm:h-auto overflow-y-auto">
                <DrawerHeader className="text-left">
                  <DrawerTitle>Menu</DrawerTitle>
                  <DrawerDescription>Quick access to services</DrawerDescription>
                </DrawerHeader>
                <div className="px-4 pb-4 space-y-1">
                  <nav className="grid gap-1">
                    <DrawerClose asChild>
                       <Button 
                         variant="ghost" 
                         className="justify-start"
                          onClick={() => navigate('/')}
                       >
                         <Home className="h-4 w-4 mr-2" />
                         Home
                       </Button>
                    </DrawerClose>

                    {!user && (
                      <DrawerClose asChild>
                        <Button 
                          variant="default" 
                          className="justify-start bg-primary text-primary-foreground"
                          onClick={() => navigate('/security-compliance')}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Security & Compliance
                        </Button>
                      </DrawerClose>
                    )}

                      {/* Main Services */}
                      {user && (
                        <>
                           <DrawerClose asChild>
                             <Button variant="ghost" className="justify-start" onClick={() => navigate('/ai4gp')}>
                               <Sparkles className="h-4 w-4 mr-2" />
                               AI4GP Service
                             </Button>
                           </DrawerClose>
                           {hasModuleAccess('meeting_recorder') && (
                             <DrawerClose asChild>
                               <Button variant="ghost" className="justify-start" onClick={() => navigate('/')}> 
                                 <FileText className="h-4 w-4 mr-2" />
                                 Meeting Notes
                               </Button>
                             </DrawerClose>
                           )}
                           {hasModuleAccess('gp_scribe') && (
                             <DrawerClose asChild>
                               <Button variant="ghost" className="justify-start" onClick={() => navigate('/gp-scribe')}>
                                 <Stethoscope className="h-4 w-4 mr-2" />
                                 GP Scribe
                               </Button>
                             </DrawerClose>
                           )}
                         {hasModuleAccess('complaints_system') && (
                           <DrawerClose asChild>
                             <Button variant="ghost" className="justify-start" onClick={() => navigate('/complaints')}>
                               <MessageSquareWarning className="h-4 w-4 mr-2" />
                               Complaints System
                             </Button>
                           </DrawerClose>
                         )}
                         {hasModuleAccess('ai_4_pm') && (
                           <DrawerClose asChild>
                             <Button variant="ghost" className="justify-start" onClick={() => navigate('/ai-4-pm')}>
                               <Sparkles className="h-4 w-4 mr-2" />
                               AI 4 PM Assistant
                             </Button>
                           </DrawerClose>
                          )}
                           {hasModuleAccess('enhanced_access') && (
                           <DrawerClose asChild>
                             <Button variant="ghost" className="justify-start" onClick={() => navigate('/enhanced-access')}>
                               <Clock className="h-4 w-4 mr-2" />
                               Enhanced Access
                             </Button>
                           </DrawerClose>
                         )}
                          {hasModuleAccess('cqc_compliance_access') && (
                            <DrawerClose asChild>
                              <Button variant="ghost" className="justify-start" onClick={() => navigate('/cqc-compliance')}>
                                <Shield className="h-4 w-4 mr-2" />
                                CQC Compliance
                              </Button>
                            </DrawerClose>
                          )}
                          {hasModuleAccess('shared_drive_access') && (
                            <DrawerClose asChild>
                              <Button variant="ghost" className="justify-start" onClick={() => navigate('/shared-drive')}>
                                <FolderOpen className="h-4 w-4 mr-2" />
                                Shared Drive
                              </Button>
                            </DrawerClose>
                          )}
                           {hasModuleAccess('mic_test_service_access') && (
                              <DrawerClose asChild>
                                <Button variant="ghost" className="justify-start" onClick={() => navigate('/meetings')}>
                                  <Wrench className="h-4 w-4 mr-2" />
                                  Mic Test Service
                                </Button>
                              </DrawerClose>
                            )}
                            {hasModuleAccess('translation_service') && (
                              <DrawerClose asChild>
                                <Button variant="ghost" className="justify-start" onClick={() => {
                                  // Check if mobile and redirect accordingly
                                  const isMobileScreen = window.innerWidth < 768;
                                  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                                  
                                  if (isMobileScreen || isMobileUserAgent) {
                                    navigate('/mobile-translate');
                                  } else {
                                    navigate('/translation-tool');
                                  }
                                }}>
                                  <Languages className="h-4 w-4 mr-2" />
                                  Translation Service
                                </Button>
                              </DrawerClose>
                            )}
                        </>
                      )}

                     {/* Settings and Admin */}
                    {user && (
                      <>
                         {/* Practice Manager Menu - Mobile */}
                         {hasModuleAccess('practice_manager_access') && (
                           <DrawerClose asChild>
                             <Button variant="ghost" className="justify-start" onClick={() => navigate('/practice-admin')}>
                               <Users className="h-4 w-4 mr-2" />
                               Practice Management
                             </Button>
                           </DrawerClose>
                         )}
                         
                           {isSystemAdmin && (
                             <>
                               <DrawerClose asChild>
                                 <Button variant="ghost" className="justify-start" onClick={() => navigate('/admin')}>
                                   <Wrench className="h-4 w-4 mr-2" />
                                   Admin Dashboard
                                 </Button>
                               </DrawerClose>
                                <DrawerClose asChild>
                                  <Button variant="ghost" className="justify-start" onClick={() => navigate('/security-compliance')}>
                                    <BookOpen className="h-4 w-4 mr-2" />
                                    Security Documentation
                                  </Button>
                                </DrawerClose>
                                <DrawerClose asChild>
                                  <Button variant="ghost" className="justify-start" onClick={() => navigate('/transcription-comparison')}>
                                    <Mic className="h-4 w-4 mr-2" />
                                    Mic and Transcript Lab
                                  </Button>
                                </DrawerClose>
                             </>
                            )}

                          <DrawerClose asChild>
                            <Button variant="ghost" className="justify-start" onClick={() => setShowProfileModal(true)}>
                              <User className="h-4 w-4 mr-2" />
                              My Profile
                            </Button>
                          </DrawerClose>

                           <DrawerClose asChild>
                             <Button variant="ghost" className="justify-start" onClick={() => navigate('/settings')}>
                               <Settings className="h-4 w-4 mr-2" />
                               User Settings
                             </Button>
                           </DrawerClose>

                          <DrawerClose asChild>
                           <Button variant="destructive" className="justify-start" onClick={signOut}>
                             <LogOut className="h-4 w-4 mr-2" />
                             Logout
                           </Button>
                         </DrawerClose>
                      </>
                    )}
                  </nav>
                </div>
                <DrawerFooter className="pt-0">
                  <div className="text-xs text-muted-foreground text-center w-full pb-2">Notewell AI</div>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>
      
      {/* User Profile Modal */}
      <UserProfileModal 
        open={showProfileModal} 
        onOpenChange={setShowProfileModal} 
      />
    </header>
  );
};