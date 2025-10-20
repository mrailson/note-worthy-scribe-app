import { useState, useEffect } from 'react';
import { ArrowLeft, Volume2, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SavedTranslation {
  id: string;
  original: string;
  translated: string;
  sourceLanguage?: string;
  type: 'menu' | 'text' | 'voice';
  image?: string;
  timestamp: string;
  favorite?: boolean;
}

interface HistoryViewProps {
  onBack: () => void;
}

const HistoryView = ({ onBack }: HistoryViewProps) => {
  const [history, setHistory] = useState<SavedTranslation[]>([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('turkeyFavorites') || '[]');
    setHistory(saved.reverse());
  }, []);

  const speakTranslation = (text: string, lang: string = 'en') => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'en' ? 'en-GB' : 'tr-TR';
      window.speechSynthesis.speak(utterance);
    }
  };

  const deleteItem = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('turkeyFavorites', JSON.stringify(updated.reverse()));
  };

  const clearAll = () => {
    if (confirm('Clear all history?')) {
      setHistory([]);
      localStorage.removeItem('turkeyFavorites');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe border-b">
        <Button variant="ghost" size="lg" onClick={onBack} className="touch-manipulation">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">History</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearAll}
          disabled={history.length === 0}
          className="touch-manipulation"
        >
          Clear
        </Button>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg">No saved translations yet</p>
            </div>
          ) : (
            history.map((item) => (
              <Card key={item.id} className="p-4 space-y-3">
                {item.image && (
                  <img 
                    src={item.image} 
                    alt="Menu" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                )}
                
                <div className="space-y-2">
                  {item.original && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Original:</p>
                      <p className="text-base">{item.original}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Translation:</p>
                    <p className="text-lg font-medium">{item.translated}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => speakTranslation(item.translated)}
                    className="flex-1 touch-manipulation"
                  >
                    <Volume2 className="h-4 w-4 mr-1" />
                    Play
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteItem(item.id)}
                    className="touch-manipulation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {new Date(item.timestamp).toLocaleString('en-GB')}
                </p>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default HistoryView;
