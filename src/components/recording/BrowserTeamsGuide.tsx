import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, CheckSquare, AlertCircle } from 'lucide-react';

interface BrowserTeamsGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BrowserTeamsGuide: React.FC<BrowserTeamsGuideProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-centre gap-3 mb-2">
            <Globe className="h-6 w-6 text-blue-500" />
            <DialogTitle className="text-xl">Browser Teams + Tab Audio Capture</DialogTitle>
          </div>
          <DialogDescription>
            Bypass NHS laptop restrictions by using Teams in your browser
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Important Note */}
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Important</p>
                  <p className="text-sm text-muted-foreground">
                    This method only works if your NHS/corporate IT policies allow Teams to run in a web browser 
                    (Chrome or Edge). Some organisations block browser access to Teams.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step-by-Step Instructions */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Setup Instructions</h3>
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-centre justify-centre font-semibold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-1">Open Teams in Browser</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Go to <code className="bg-muted px-2 py-0.5 rounded text-xs">teams.microsoft.com</code> in Chrome or Edge
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      💡 Close the Teams desktop app if it's running
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-centre justify-centre font-semibold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-1">Join Your Meeting</p>
                    <p className="text-sm text-muted-foreground">
                      Join the Teams meeting as you normally would through the browser interface
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-centre justify-centre font-semibold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-1">Start Notewell Recording</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Open Notewell (in a different browser tab) and click to start recording
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      💡 You'll be asked to share your screen/tab
                    </p>
                  </div>
                </div>

                {/* Step 4 - Most Important */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-centre justify-centre font-semibold">
                    4
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-1">🔑 Share the Teams Tab (Key Step!)</p>
                    <Card className="mt-2 border-primary/30 bg-primary/5">
                      <CardContent className="pt-3 pb-3">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">In the share screen dialogue:</p>
                          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Click the <strong>"Chrome Tab"</strong> or <strong>"Edge Tab"</strong> option (not "Entire Screen")</li>
                            <li>Select the <strong>Teams browser tab</strong> from the list</li>
                            <li><strong>CRITICAL:</strong> Tick the <strong>"Share tab audio"</strong> checkbox</li>
                            <li>Click <strong>Share</strong></li>
                          </ol>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-centre justify-centre font-semibold">
                    5
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-1">Verify Audio Capture</p>
                    <p className="text-sm text-muted-foreground">
                      Check Notewell shows audio levels from both your mic AND the Teams tab. 
                      You should see activity when other participants speak.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What Gets Captured */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3 flex items-centre gap-2">
                <CheckSquare className="h-5 w-5 text-green-600" />
                What Gets Captured
              </h3>
              <div className="space-y-2">
                <div className="flex items-centre gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
                  <p className="text-sm">Your microphone (your voice)</p>
                </div>
                <div className="flex items-centre gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
                  <p className="text-sm">All participants' audio from Teams tab</p>
                </div>
                <div className="flex items-centre gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
                  <p className="text-sm">Screen shares with audio (if shared in Teams)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Troubleshooting */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">Troubleshooting</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-sm">❌ Can't access teams.microsoft.com</p>
                  <p className="text-xs text-muted-foreground">
                    Your organisation blocks browser Teams. Use the phone recording method instead.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm">❌ Don't see "Share tab audio" checkbox</p>
                  <p className="text-xs text-muted-foreground">
                    Only Chrome and Edge support tab audio sharing. Ensure you're using one of these browsers.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm">❌ Only capturing my voice, not others</p>
                  <p className="text-xs text-muted-foreground">
                    Make sure you selected the Teams TAB (not entire screen) and ticked "Share tab audio". Try again.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
