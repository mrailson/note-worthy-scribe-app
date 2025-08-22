import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

export const MobileDebug = () => {
  const isMobile = useIsMobile();
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div className="fixed top-4 left-4 bg-red-500 text-white p-2 rounded text-xs z-[10000]">
      Mobile: {isMobile ? 'YES' : 'NO'} | Width: {window.innerWidth}
    </div>
  );
};