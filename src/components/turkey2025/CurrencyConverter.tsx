import { useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface CurrencyConverterProps {
  onBack: () => void;
}

const CurrencyConverter = ({ onBack }: CurrencyConverterProps) => {
  // Exchange rate: 15,000 TL = £308 => 48.7 TL per GBP
  const [exchangeRate] = useState(48.7);
  const [tlAmount, setTlAmount] = useState<string>('');
  const [gbpAmount, setGbpAmount] = useState<string>('');

  const handleTlChange = (value: string) => {
    // Only allow numbers and decimals
    const sanitized = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('') 
      : sanitized;
    
    setTlAmount(formatted);
    
    if (formatted && !isNaN(parseFloat(formatted))) {
      const tl = parseFloat(formatted);
      const gbp = tl / exchangeRate;
      setGbpAmount(gbp.toFixed(2));
    } else {
      setGbpAmount('');
    }
  };

  const handleGbpChange = (value: string) => {
    // Only allow numbers and decimals
    const sanitized = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 1 
      ? parts[0] + '.' + parts[1].slice(0, 2) // Only 2 decimals for currency
      : sanitized;
    
    setGbpAmount(formatted);
    
    if (formatted && !isNaN(parseFloat(formatted))) {
      const gbp = parseFloat(formatted);
      const tl = gbp * exchangeRate;
      setTlAmount(tl.toFixed(2));
    } else {
      setTlAmount('');
    }
  };

  const clearAll = () => {
    setTlAmount('');
    setGbpAmount('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-safe border-b">
        <Button variant="ghost" size="lg" onClick={onBack} className="touch-manipulation">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">Currency Converter</h1>
        <div className="w-12" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Exchange Rate Info */}
        <Card className="p-6 bg-primary/5 border-primary/20">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Current Rate</p>
            <p className="text-3xl font-bold text-primary">₺{exchangeRate.toFixed(2)} = £1</p>
            <p className="text-xs text-muted-foreground mt-2">Turkish Lira to British Pound</p>
          </div>
        </Card>

        {/* Turkish Lira Input */}
        <div className="space-y-3">
          <label className="text-lg font-semibold text-primary flex items-center gap-2">
            🇹🇷 Turkish Lira (TL)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
              ₺
            </span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={tlAmount}
              onChange={(e) => handleTlChange(e.target.value)}
              className="h-16 text-2xl font-bold pl-10 pr-4 touch-manipulation"
            />
          </div>
        </div>

        {/* Swap Indicator */}
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-primary" />
          </div>
        </div>

        {/* British Pounds Output */}
        <div className="space-y-3">
          <label className="text-lg font-semibold text-primary flex items-center gap-2">
            🇬🇧 British Pounds (GBP)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
              £
            </span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={gbpAmount}
              onChange={(e) => handleGbpChange(e.target.value)}
              className="h-16 text-2xl font-bold pl-10 pr-4 touch-manipulation"
            />
          </div>
        </div>

        {/* Quick Examples */}
        <Card className="p-4 bg-accent/50">
          <p className="text-sm font-medium mb-3">Quick Examples:</p>
          <div className="space-y-2 text-sm">
            <button 
              onClick={() => handleTlChange('100')}
              className="flex justify-between w-full hover:bg-accent rounded p-2 touch-manipulation"
            >
              <span>₹100</span>
              <span className="text-muted-foreground">= £{(100 / exchangeRate).toFixed(2)}</span>
            </button>
            <button 
              onClick={() => handleTlChange('500')}
              className="flex justify-between w-full hover:bg-accent rounded p-2 touch-manipulation"
            >
              <span>₹500</span>
              <span className="text-muted-foreground">= £{(500 / exchangeRate).toFixed(2)}</span>
            </button>
            <button 
              onClick={() => handleTlChange('1000')}
              className="flex justify-between w-3 hover:bg-accent rounded p-2 touch-manipulation"
            >
              <span>₹1,000</span>
              <span className="text-muted-foreground">= £{(1000 / exchangeRate).toFixed(2)}</span>
            </button>
            <button 
              onClick={() => handleTlChange('15000')}
              className="flex justify-between w-full hover:bg-accent rounded p-2 touch-manipulation"
            >
              <span>₹15,000</span>
              <span className="text-muted-foreground">= £{(15000 / exchangeRate).toFixed(2)}</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Clear Button */}
      <div className="p-4 pb-safe border-t bg-background">
        <Button
          variant="outline"
          size="lg"
          onClick={clearAll}
          disabled={!tlAmount && !gbpAmount}
          className="w-full h-12 text-base touch-manipulation"
        >
          Clear
        </Button>
      </div>
    </div>
  );
};

export default CurrencyConverter;
