import { Card } from '@/components/ui/card';
import { Camera, MessageSquare, Mic } from 'lucide-react';

interface ModeSelectProps {
  onSelectMode: (mode: 'menu' | 'text' | 'voice') => void;
}

const ModeSelector = ({ onSelectMode }: ModeSelectProps) => {
  return (
    <div className="flex flex-col h-full pt-safe pb-safe px-4">
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold mb-2">🇹🇷 Turkey 2025</h1>
        <p className="text-lg text-muted-foreground">Your travel translation companion</p>
      </div>

      <div className="flex-1 flex flex-col gap-6 justify-center max-w-md mx-auto w-full">
        <Card 
          className="p-8 cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation border-2"
          onClick={() => onSelectMode('menu')}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">📸 Menu</h2>
              <p className="text-muted-foreground">Snap Turkish menus for instant English translation</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-8 cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation border-2"
          onClick={() => onSelectMode('text')}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">✍️ Text</h2>
              <p className="text-muted-foreground">Type or speak for instant translation</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-8 cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation border-2"
          onClick={() => onSelectMode('voice')}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">🗣️ Voice</h2>
              <p className="text-muted-foreground">Real-time conversation translation</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ModeSelector;
