/**
 * NHS Compliance Banner Component
 * Displays information about patient data protection measures
 */

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, Clock } from "lucide-react";

interface NHSComplianceBannerProps {
  activeSessionsCount?: number;
}

export const NHSComplianceBanner: React.FC<NHSComplianceBannerProps> = ({
  activeSessionsCount = 0
}) => {
  return (
    <Card className="border-blue-200 bg-blue-50 mb-6">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-blue-900">NHS Data Protection Active</h3>
                <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-100">
                  GDPR Compliant
                </Badge>
              </div>
              <p className="text-sm text-blue-800">
                Patient identifiable data is automatically masked. Access requires justification and is logged for NHS compliance.
              </p>
              <div className="flex items-center gap-4 text-xs text-blue-700">
                <div className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  <span>Data Encrypted</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  <span>Access Audited</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Auto-Expire Sessions</span>
                </div>
              </div>
            </div>
          </div>
          
          {activeSessionsCount > 0 && (
            <div className="text-center">
              <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-300">
                {activeSessionsCount} Active Session{activeSessionsCount !== 1 ? 's' : ''}
              </Badge>
              <p className="text-xs text-blue-700 mt-1">
                Patient data visible
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};