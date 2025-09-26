import React from 'react';
import { NetworkDiagnostics } from '../components/NetworkDiagnostics';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export const NetworkDiagnosticsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </Link>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">
              Network Connectivity Diagnostics
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              This tool helps IT departments and network administrators diagnose connectivity issues 
              with VPNs, corporate firewalls, and network infrastructure when accessing NoteWell AI.
            </p>
          </div>
        </div>
        
        <NetworkDiagnostics />
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            For additional support, contact your system administrator or 
            <a href="mailto:support@notewell.ai" className="text-primary hover:underline ml-1">
              technical support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};