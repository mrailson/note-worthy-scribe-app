/**
 * VPN Troubleshooting Guide Component
 * Provides guidance for users experiencing VPN-related login issues
 */

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  Wifi, 
  Shield, 
  HelpCircle, 
  CheckCircle, 
  AlertTriangle,
  Network
} from 'lucide-react';
import { testNetworkConnectivity, detectVpnUsage } from '@/utils/vpnDiagnostics';

interface VpnTroubleshootingGuideProps {
  isVisible: boolean;
  onClose: () => void;
  loginError?: any;
}

export function VpnTroubleshootingGuide({ 
  isVisible, 
  onClose, 
  loginError 
}: VpnTroubleshootingGuideProps) {
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['quick-fixes']));

  if (!isVisible) return null;

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    
    try {
      const [networkTest, vpnDetection] = await Promise.all([
        testNetworkConnectivity(),
        Promise.resolve(detectVpnUsage())
      ]);
      
      setDiagnosticResults({
        network: networkTest,
        vpn: vpnDetection,
        userAgent: navigator.userAgent,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setDiagnosticResults({
        error: 'Failed to run diagnostics',
        timestamp: new Date()
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const getNetworkQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'poor': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              VPN & Network Troubleshooting Guide
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Error Summary */}
          {loginError && (
            <Alert variant={loginError.isVpnRelated ? "default" : "destructive"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Login Error:</strong> {loginError.message}
                {loginError.isVpnRelated && (
                  <span className="block mt-1 text-sm">
                    <Shield className="inline h-3 w-3 mr-1" />
                    This appears to be VPN-related
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Network Diagnostics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Network className="h-5 w-5" />
                Network Diagnostics
              </h3>
              <Button 
                onClick={runDiagnostics} 
                disabled={isRunningDiagnostics}
                size="sm"
              >
                {isRunningDiagnostics ? 'Running...' : 'Run Test'}
              </Button>
            </div>
            
            {diagnosticResults && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {diagnosticResults.network && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Connection</span>
                        <Badge 
                          variant={diagnosticResults.network.isConnected ? "default" : "destructive"}
                        >
                          {diagnosticResults.network.isConnected ? 'Connected' : 'Failed'}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-2 h-2 rounded-full ${getNetworkQualityColor(diagnosticResults.network.quality)}`}
                          />
                          <span className="text-sm">
                            {diagnosticResults.network.quality} ({diagnosticResults.network.latency}ms)
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {diagnosticResults.vpn && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">VPN Detected</span>
                        <Badge variant={diagnosticResults.vpn.isVpnLikely ? "secondary" : "outline"}>
                          {diagnosticResults.vpn.isVpnLikely ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      {diagnosticResults.vpn.indicators.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-muted-foreground">
                            Indicators: {diagnosticResults.vpn.indicators.join(', ')}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Quick Fixes */}
          <Collapsible 
            open={expandedSections.has('quick-fixes')}
            onOpenChange={() => toggleSection('quick-fixes')}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold w-full">
              {expandedSections.has('quick-fixes') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CheckCircle className="h-5 w-5" />
              Quick Fixes (Try These First)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">1. Wait and Retry</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Corporate VPNs share IP addresses, which can trigger rate limits.
                    </p>
                    <ul className="text-sm space-y-1">
                      <li>• Wait 5-10 minutes</li>
                      <li>• Clear browser cache</li>
                      <li>• Try incognito/private mode</li>
                    </ul>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">2. Check VPN Settings</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Some VPN configurations can interfere with authentication.
                    </p>
                    <ul className="text-sm space-y-1">
                      <li>• Try different VPN server</li>
                      <li>• Switch to TCP mode if available</li>
                      <li>• Disable VPN split tunneling</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Advanced Solutions */}
          <Collapsible 
            open={expandedSections.has('advanced')}
            onOpenChange={() => toggleSection('advanced')}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold w-full">
              {expandedSections.has('advanced') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Wifi className="h-5 w-5" />
              Advanced Solutions
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="space-y-4">
                <Alert>
                  <HelpCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>For IT Administrators:</strong> Add these domains to your firewall whitelist:
                    <div className="mt-2 p-2 bg-muted rounded text-sm font-mono">
                      *.supabase.co<br/>
                      dphcnbricafkbtizkoal.supabase.co
                    </div>
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Network Configuration</h4>
                      <ul className="text-sm space-y-2">
                        <li>• Ensure WebSocket connections are allowed</li>
                        <li>• Allow HTTPS traffic on port 443</li>
                        <li>• Enable TLS 1.2 or higher</li>
                        <li>• Configure DNS to resolve *.supabase.co</li>
                      </ul>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">IT Department Tools</h4>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open('/network-diagnostics', '_blank')}
                          className="w-full justify-start"
                        >
                          <Network className="w-4 h-4 mr-2" />
                          Run Comprehensive Network Diagnostics
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Opens detailed network testing tool for IT troubleshooting
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Alternative Access Methods</h4>
                      <ul className="text-sm space-y-2">
                        <li>• Use mobile data/hotspot temporarily</li>
                        <li>• Try from different network location</li>
                        <li>• Contact IT support for VPN bypass</li>
                        <li>• Request whitelisting of our application</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Contact Support */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Still Need Help?</h4>
              <p className="text-sm text-muted-foreground mb-3">
                If you're still experiencing issues, please contact your IT support team with the following information:
              </p>
              <div className="bg-muted p-3 rounded text-sm font-mono">
                Error: {loginError?.message || 'Login failed'}<br/>
                VPN Detected: {diagnosticResults?.vpn?.isVpnLikely ? 'Yes' : 'Unknown'}<br/>
                Network Quality: {diagnosticResults?.network?.quality || 'Unknown'}<br/>
                User Agent: {navigator.userAgent.substring(0, 100)}...
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}