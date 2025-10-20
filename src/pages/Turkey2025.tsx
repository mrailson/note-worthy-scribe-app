import { useState } from 'react';
import { SEO } from '@/components/SEO';
import ModeSelector from '@/components/turkey2025/ModeSelector';
import MenuPhotoTranslator from '@/components/turkey2025/MenuPhotoTranslator';
import QuickTranslator from '@/components/turkey2025/QuickTranslator';
import VoiceConversation from '@/components/turkey2025/VoiceConversation';

type Mode = 'select' | 'menu' | 'text' | 'voice';

const Turkey2025 = () => {
  const [mode, setMode] = useState<Mode>('select');

  return (
    <div className="min-h-screen bg-background pb-safe">
      <SEO 
        title="Turkey 2025 Travel Translator | Menu & Voice Translation"
        description="Instant Turkish-English translation for travellers. Translate menus, signs, and have conversations with voice-to-voice translation. Optimised for iPhone."
        keywords="Turkish translator, Turkey travel, menu translation, voice translator, Turkish English translation, travel app, iPhone translator"
      />
      
      <div className="h-screen flex flex-col">
        {mode === 'select' && <ModeSelector onSelectMode={setMode} />}
        {mode === 'menu' && <MenuPhotoTranslator onBack={() => setMode('select')} />}
        {mode === 'text' && <QuickTranslator onBack={() => setMode('select')} />}
        {mode === 'voice' && <VoiceConversation onBack={() => setMode('select')} />}
      </div>
    </div>
  );
};

export default Turkey2025;
