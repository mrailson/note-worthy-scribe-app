import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { EvidenceDrawer } from './EvidenceDrawer';

interface TrafficLightBrowserProps {
  onInsertIntoChat?: (message: string) => void;
  children?: React.ReactNode;
}

const TrafficLightBrowser: React.FC<TrafficLightBrowserProps> = ({ 
  onInsertIntoChat,
  children 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <EvidenceDrawer
      showListView={true}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    >
      {children || (
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Search className="w-4 h-4 mr-2" />
          Browse Medicines
        </Button>
      )}
    </EvidenceDrawer>
  );
};

export default TrafficLightBrowser;