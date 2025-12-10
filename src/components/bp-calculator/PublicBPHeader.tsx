import { Stars, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const PublicBPHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="bg-gradient-primary text-primary-foreground shadow-strong sticky top-0 z-50">
      <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center justify-between">
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
            onClick={() => navigate('/public/bp-calculator')}
          >
            <span className="text-sm sm:text-xl font-bold text-white flex items-center">
              Notewell AI
              <Stars className="h-4 w-4 sm:h-5 sm:w-5 ml-2 text-white" />
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-white/90">
            <Heart className="h-4 w-4" />
            <span className="text-sm font-medium">BP Average Service</span>
          </div>
        </div>
      </div>
    </header>
  );
};
