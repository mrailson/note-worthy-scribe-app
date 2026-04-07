import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRecording } from "@/contexts/RecordingContext";
import { useServiceActivation } from "@/hooks/useServiceActivation";
import { useServiceVisibility } from "@/hooks/useServiceVisibility";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SDAFeedbackModal } from "@/components/sda/SDAFeedbackModal";
import { Home, Grid3X3, ChevronDown, Stars, Circle, MessageSquareWarning, User, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import notewellLogo from "@/assets/notewell-logo.png";

interface ENNHeaderProps {
  activeTab: string;
}

export const ENNHeader = ({ activeTab }: ENNHeaderProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isRecording: isGlobalRecording } = useRecording();
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const loadName = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      setUserDisplayName(data?.full_name || user.email || null);
    };
    loadName();
  }, [user]);

  return (
    <header className="bg-gradient-to-r from-[#005EB8] via-[#003087] to-[#002060] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-[1500px] mx-auto px-4 h-12 flex items-center justify-between gap-3">
        {/* Left: Logo + context */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5 shrink-0"
            onClick={() => navigate('/?from=home')}
          >
            <span className="text-sm font-bold text-white flex items-center">
              Notewell AI
              <Stars className="h-3.5 w-3.5 ml-1 text-white" />
            </span>
          </div>

          {isGlobalRecording && (
            <span className="flex items-center gap-1 text-[10px] font-medium bg-destructive/80 text-white px-1.5 py-0.5 rounded-full animate-pulse shrink-0">
              <Circle className="h-1.5 w-1.5 fill-current" />
              REC
            </span>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-white/30 shrink-0" />

          {/* Programme context */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-white/90 font-normal truncate">
              East Northants Neighbourhood
            </span>
            <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider shrink-0 hidden md:inline">
              SDA Programme
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Go-Live pill */}
          <span className="hidden sm:inline-flex items-center text-[11px] font-semibold bg-emerald-500 text-white px-2.5 py-0.5 rounded-full">
            Go-Live: 1st July 2026
          </span>

          <Button
            onClick={() => navigate('/?from=home')}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/15 h-8 px-2"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden lg:inline ml-1.5 text-xs">Home</span>
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/15 h-8 px-2 text-xs"
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline ml-1.5">Services</span>
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border shadow-lg w-48 z-50">
                <DropdownMenuItem onClick={() => navigate('/')} className="cursor-pointer py-2">
                  Meeting Notes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/NRESDashboard')} className="cursor-pointer py-2">
                  NRES Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/enn')} className="cursor-pointer py-2">
                  ENN Dashboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/15 h-8 w-8 p-0">
                  <User className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {userDisplayName}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer py-2">
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Feedback icon-only */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/15 h-8 w-8 p-0"
                  onClick={() => setFeedbackOpen(true)}
                >
                  <MessageSquareWarning className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Feedback or Problem?</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <SDAFeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        currentSection={activeTab}
      />
    </header>
  );
};
