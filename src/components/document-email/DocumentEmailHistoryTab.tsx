import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';

export const DocumentEmailHistoryTab = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Translation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Translation history functionality will be integrated here.</p>
            <p className="text-sm mt-2">This will show combined history for email, document, and voice translations.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};