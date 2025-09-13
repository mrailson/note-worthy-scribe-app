/**
 * NHS Patient Data Disclosure Warning Component
 * Displays warnings when accessing patient identifiable data
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, Shield, Clock, User } from "lucide-react";
import { toast } from "sonner";

interface PatientDataDisclosureProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  patientReference: string;
  complaintReference: string;
  accessReason?: string;
  userRole: string;
}

export const PatientDataDisclosureWarning: React.FC<PatientDataDisclosureProps> = ({
  isOpen,
  onClose,
  onApprove,
  patientReference,
  complaintReference,
  accessReason = "Complaint investigation",
  userRole
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [justification, setJustification] = useState("");

  const handleApprove = () => {
    if (!acknowledged) {
      toast.error("Please acknowledge the data protection requirements");
      return;
    }

    if (justification.trim().length < 10) {
      toast.error("Please provide a proper justification for accessing patient data");
      return;
    }

    // Log the access approval
    console.log('[PID DISCLOSURE APPROVED]', {
      timestamp: new Date().toISOString(),
      complaintReference,
      patientReference,
      userRole,
      justification,
      sessionId: sessionStorage.getItem('sessionId') || 'unknown'
    });

    onApprove();
    setAcknowledged(false);
    setJustification("");
  };

  const handleClose = () => {
    onClose();
    setAcknowledged(false);
    setJustification("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Patient Identifiable Data Access
          </DialogTitle>
          <DialogDescription>
            You are about to access patient identifiable data (PID). This action is monitored and logged for NHS compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-800">
                NHS Data Protection Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-amber-700">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Only access data necessary for your role and the specific complaint investigation</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Access is time-limited and will be automatically logged and audited</span>
              </div>
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Do not share, copy, or store this information outside approved systems</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Complaint Reference</label>
              <div className="font-mono text-sm">{complaintReference}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Patient Reference</label>
              <div className="font-mono text-sm">{patientReference}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Your Role</label>
              <Badge variant="outline">{userRole}</Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Access Reason</label>
              <div className="text-sm">{accessReason}</div>
            </div>
          </div>

          <div>
            <label htmlFor="justification" className="text-sm font-medium">
              Justification for Access *
            </label>
            <textarea
              id="justification"
              className="mt-1 w-full min-h-[80px] px-3 py-2 border border-input rounded-md text-sm"
              placeholder="Please provide a specific reason why you need to access the patient's full details for this complaint..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="acknowledge"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="acknowledge" className="text-sm text-muted-foreground">
              I acknowledge that I have a legitimate need to access this patient data, understand my 
              responsibilities under NHS data protection policies, and that this access will be audited.
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={!acknowledged || justification.trim().length < 10}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              <Eye className="h-4 w-4 mr-2" />
              Access Patient Data
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface PatientDataWarningBannerProps {
  isVisible: boolean;
  onDismiss: () => void;
  timeRemaining?: number;
}

export const PatientDataWarningBanner: React.FC<PatientDataWarningBannerProps> = ({
  isVisible,
  onDismiss,
  timeRemaining
}) => {
  if (!isVisible) return null;

  return (
    <Card className="border-amber-200 bg-amber-50 mb-4">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Patient Data Access Active
            </span>
            {timeRemaining && (
              <Badge variant="outline" className="text-amber-700 border-amber-300">
                {Math.ceil(timeRemaining / 60)} min remaining
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onDismiss}
            className="text-amber-700 hover:text-amber-800"
          >
            End Session
          </Button>
        </div>
        <p className="text-xs text-amber-700 mt-1">
          You are viewing patient identifiable data. This session is being monitored and logged.
        </p>
      </CardContent>
    </Card>
  );
};