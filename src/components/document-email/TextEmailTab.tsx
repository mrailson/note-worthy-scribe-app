import React, { useEffect } from 'react';
import { EmailHandler } from '@/components/EmailHandler';

interface TextEmailTabProps {
  resetTrigger: number;
}

export const TextEmailTab = ({ resetTrigger }: TextEmailTabProps) => {
  return (
    <div className="space-y-4">
      <EmailHandler resetTrigger={resetTrigger} />
    </div>
  );
};