import { useState } from 'react';
import { SEO } from '@/components/SEO';
import ModeSelector from '@/components/turkey2025/ModeSelector';
import MenuPhotoTranslator from '@/components/turkey2025/MenuPhotoTranslator';
import QuickTranslator from '@/components/turkey2025/QuickTranslator';
import VoiceConversation from '@/components/turkey2025/VoiceConversation';
import LiveCameraTranslator from '@/components/turkey2025/LiveCameraTranslator';
import HistoryView from '@/components/turkey2025/HistoryView';
import CurrencyConverter from '@/components/turkey2025/CurrencyConverter';

type Mode = 'select' | 'menu' | 'text' | 'voice' | 'live' | 'history' | 'currency';

const Turkey2025 = () => {
  const [mode, setMode] = useState<Mode>('select');

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Turkey 2025 - Turkish Travel Tools | Translation & Currency Converter"
        description="Complete Turkish-English translation suite: menu translator, live camera translation, voice chat, and currency converter. Optimised for iPhone."
        keywords="Turkey translator, Turkish English translation, menu translator, Turkish lira to pounds, TL to GBP, travel Turkey, Turkish currency converter"
      />
      
      <div className="h-screen flex flex-col">
        {mode === 'select' && <ModeSelector onSelectMode={(m) => setMode(m)} />}
        {mode === 'menu' && <MenuPhotoTranslator onBack={() => setMode('select')} />}
        {mode === 'text' && <QuickTranslator onBack={() => setMode('select')} />}
        {mode === 'voice' && <VoiceConversation onBack={() => setMode('select')} />}
        {mode === 'history' && <HistoryView onBack={() => setMode('select')} />}
        {mode === 'currency' && <CurrencyConverter onBack={() => setMode('select')} />}
      </div>
    </div>
  );
};

export default Turkey2025;
