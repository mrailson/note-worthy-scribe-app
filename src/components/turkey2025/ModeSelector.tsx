import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, MessageSquare, Mic, Video, History, Calculator } from 'lucide-react';

interface ModeSelectProps {
  onSelectMode: (mode: 'menu' | 'text' | 'voice' | 'live' | 'history' | 'currency') => void;
}

const ModeSelector = ({ onSelectMode }: ModeSelectProps) => {
  return (
    <div className="flex flex-col h-full pt-safe pb-safe px-4">
      <div className="text-center py-6">
        <h1 className="text-4xl font-bold mb-2">🇹🇷 Turkey 2025</h1>
        <p className="text-lg text-muted-foreground">Your travel translation companion</p>
      </div>

      <div className="flex-1 flex flex-col gap-4 justify-center max-w-md mx-auto w-full pb-20">
        <Card 
          className="p-6 cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation border-2"
          onClick={() => onSelectMode('live')}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Video className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left flex-1">
              <h2 className="text-xl font-bold mb-1">📹 Live Camera</h2>
              <p className="text-sm text-muted-foreground">Real-time Turkish to English translation</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-6 cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation border-2"
          onClick={() => onSelectMode('menu')}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Camera className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left flex-1">
              <h2 className="text-xl font-bold mb-1">📸 Menu Photo</h2>
              <p className="text-sm text-muted-foreground">Snap menus for translation</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-6 cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation border-2"
          onClick={() => onSelectMode('text')}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left flex-1">
              <h2 className="text-xl font-bold mb-1">✍️ Quick Text</h2>
              <p className="text-sm text-muted-foreground">Type or speak to translate</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-6 cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation border-2"
          onClick={() => onSelectMode('voice')}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Mic className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left flex-1">
              <h2 className="text-xl font-bold mb-1">🗣️ Voice Chat</h2>
              <p className="text-sm text-muted-foreground">Real-time conversation</p>
            </div>
          </div>
        </Card>
      </div>

      {/* History Button */}
      <div className="p-4 border-t">
        <Button
          variant="outline"
          size="lg"
          onClick={() => onSelectMode('history')}
          className="w-full h-14 text-base touch-manipulation"
        >
          <History className="h-5 w-5 mr-2" />
          View History
        </Button>
      </div>
    </div>
  );
};

export default ModeSelector;
