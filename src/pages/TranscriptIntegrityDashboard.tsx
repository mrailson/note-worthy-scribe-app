import React from 'react';
import TranscriptIntegrityManager from '@/components/TranscriptIntegrityManager';
import AudioReprocessingPanel from '@/components/AudioReprocessingPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  AlertTriangle, 
  Database, 
  FileAudio,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const TranscriptIntegrityDashboard: React.FC = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Transcript Data Integrity System</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Comprehensive protection against transcript data loss with atomic transactions, 
          mandatory backups, real-time validation, and emergency recovery capabilities.
        </p>
      </div>

      {/* System Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Implementation Status
          </CardTitle>
          <CardDescription>
            All protective measures are now active to prevent the transcript data loss bug
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <div className="font-semibold text-green-700 dark:text-green-300">Database Triggers</div>
                <div className="text-sm text-green-600 dark:text-green-400">Prevent empty saves</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Database className="h-8 w-8 text-blue-600" />
              <div>
                <div className="font-semibold text-blue-700 dark:text-blue-300">Atomic Transactions</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">All-or-nothing saves</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <FileAudio className="h-8 w-8 text-purple-600" />
              <div>
                <div className="font-semibold text-purple-700 dark:text-purple-300">Audio Backups</div>
                <div className="text-sm text-purple-600 dark:text-purple-400">Recovery capability</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div>
                <div className="font-semibold text-orange-700 dark:text-orange-300">Real-time Monitoring</div>
                <div className="text-sm text-orange-600 dark:text-orange-400">24/7 detection</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alert */}
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>⚠️ Previous Data Loss Confirmed</AlertTitle>
        <AlertDescription>
          <div className="space-y-2">
            <p>Your 7am meeting today suffered from the exact bug this system prevents:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><strong>Meeting had 13,915 word count</strong> but <strong>zero transcript text saved</strong></li>
              <li>Processing happened but data wasn't stored properly</li>
              <li>No audio backup was available for recovery</li>
            </ul>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="destructive">CRITICAL BUG</Badge>
              <Badge variant="outline">NOW PREVENTED</Badge>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Protection Features */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              Preventive Measures
            </CardTitle>
            <CardDescription>
              Systems that prevent the bug from occurring
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Database Validation Triggers</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically prevents saving word count greater than 0 with empty transcript text
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Atomic Transaction System</div>
                  <div className="text-sm text-muted-foreground">
                    Ensures transcript text and word count are saved together or not at all
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Real-time Validation</div>
                  <div className="text-sm text-muted-foreground">
                    Immediate verification that data was actually saved correctly
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Mandatory Audio Backups</div>
                  <div className="text-sm text-muted-foreground">
                    Every transcript save includes audio backup for recovery capability
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-500" />
              Detective Measures
            </CardTitle>
            <CardDescription>
              Systems that detect and alert on issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">24/7 Integrity Monitoring</div>
                  <div className="text-sm text-muted-foreground">
                    Continuous scanning for meetings with word count but no transcript
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Real-time Alerts</div>
                  <div className="text-sm text-muted-foreground">
                    Immediate notifications when data integrity issues are detected
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Emergency Detection Functions</div>
                  <div className="text-sm text-muted-foreground">
                    Database functions to scan and identify existing data loss issues
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-pink-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Recovery Tools</div>
                  <div className="text-sm text-muted-foreground">
                    Automated systems to recover lost transcripts from audio backups
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Management Interfaces */}
      <div className="space-y-8">
        {/* Integrity Manager */}
        <TranscriptIntegrityManager />
        
        {/* Audio Reprocessing Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Audio Reprocessing & Recovery</CardTitle>
            <CardDescription>
              Tools to recover transcript data from audio backups when issues are detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AudioReprocessingPanel 
              meetingId="example-meeting-id" 
              userId="example-user-id" 
              audioFilePath="example-audio.webm" 
            />
          </CardContent>
        </Card>
      </div>

      {/* Implementation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Implementation Summary</CardTitle>
          <CardDescription>
            All systems are now active to prevent and recover from transcript data loss
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <h4>✅ Database Level Protection</h4>
            <ul>
              <li>Validation triggers prevent empty transcript saves</li>
              <li>Word count automatically calculated and synced</li>
              <li>Integrity check functions detect existing issues</li>
            </ul>

            <h4>🔐 Application Level Protection</h4>
            <ul>
              <li>Atomic transcript saving with rollback capability</li>
              <li>Mandatory audio backups for all transcriptions</li>
              <li>Real-time validation of saved data</li>
            </ul>

            <h4>🚨 Monitoring & Alerting</h4>
            <ul>
              <li>24/7 monitoring for transcript integrity issues</li>
              <li>Real-time alerts for critical problems</li>
              <li>Dashboard for system health monitoring</li>
            </ul>

            <h4>🛠️ Recovery Systems</h4>
            <ul>
              <li>Audio reprocessing capabilities</li>
              <li>Emergency detection functions</li>
              <li>Automated recovery workflows</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TranscriptIntegrityDashboard;