import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FileText, 
  Upload, 
  Mic, 
  Sparkles, 
  Copy, 
  Printer, 
  RotateCcw, 
  Info,
  Loader2,
  Bold,
  Italic,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';

const TONES = [
  'friendly', 'professional', 'empathetic', 'clinical', 
  'informative', 'reassuring', 'apologetic', 'urgent', 
  'firm', 'diplomatic'
];

const DEMO_DATA = {
  'ARRS Funding': {
    emailText: 'Dear Practice Manager, I am writing to inquire about the ARRS funding allocation for our practice. We submitted our application last month but have not received any updates. Could you please provide an update on the status? Best regards, Dr. Smith',
    contextNotes: 'ARRS funding inquiry from partner practice in our PCN',
    responseGuidance: 'Provide professional update on funding status and next steps'
  },
  'CQC Request': {
    emailText: 'To Whom It May Concern, We are conducting a routine CQC inspection of your practice next month. Please prepare all necessary documentation including patient safety records, staff training certificates, and quality assurance processes. CQC Inspector Team',
    contextNotes: 'CQC inspection preparation request - routine inspection',
    responseGuidance: 'Acknowledge receipt and confirm preparation timeline'
  }
};

export default function ReplyWellAI() {
  const { user } = useAuth();
  const [emailText, setEmailText] = useState('');
  const [contextNotes, setContextNotes] = useState('');
  const [responseGuidance, setResponseGuidance] = useState('');
  const [tone, setTone] = useState('professional');
  const [replyLength, setReplyLength] = useState([3]);
  const [draftMode, setDraftMode] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [generatedReply, setGeneratedReply] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isListening, setIsListening] = useState(false);

  // Update word count when generated reply changes
  React.useEffect(() => {
    const words = generatedReply.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [generatedReply]);

  const resetForm = useCallback(() => {
    setEmailText('');
    setContextNotes('');
    setResponseGuidance('');
    setTone('professional');
    setReplyLength([3]);
    setDraftMode(false);
    setDraftText('');
    setGeneratedReply('');
    toast.success('Form reset');
  }, []);

  const loadDemo = useCallback((demoType: keyof typeof DEMO_DATA) => {
    const demo = DEMO_DATA[demoType];
    setEmailText(demo.emailText);
    setContextNotes(demo.contextNotes);
    setResponseGuidance(demo.responseGuidance);
    toast.success(`${demoType} demo loaded`);
  }, []);

  const generateReply = async () => {
    if (!emailText.trim()) {
      toast.error('Please enter the incoming correspondence');
      return;
    }

    if (draftMode && !draftText.trim()) {
      toast.error('Please enter draft text for improvement mode');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-reply', {
        body: {
          emailText,
          contextNotes,
          responseGuidance,
          tone,
          replyLength: replyLength[0],
          mode: draftMode ? 'improve' : 'create',
          draftText: draftMode ? draftText : undefined
        }
      });

      if (error) throw error;

      setGeneratedReply(data.generatedReply);
      
      // Save to database
      if (user) {
        await supabase.from('communications').insert({
          user_id: user.id,
          email_text: emailText,
          context_notes: contextNotes,
          response_guidance: responseGuidance,
          tone: tone as any,
          reply_length: replyLength[0],
          mode: draftMode ? 'improve' as const : 'create' as const,
          draft_text: draftMode ? draftText : null,
          generated_reply: data.generatedReply
        });
      }

      toast.success('Reply generated successfully!');
    } catch (error) {
      console.error('Error generating reply:', error);
      toast.error('Failed to generate reply. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedReply);
      toast.success('Reply copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const printReply = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>ReplyWell AI - Generated Response</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Generated Response</h2>
            <div style="white-space: pre-wrap; line-height: 1.6;">${generatedReply}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ReplyWell AI</h1>
          <p className="text-muted-foreground">Professional correspondence assistant for NHS practices</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Info className="h-4 w-4 mr-2" />
                Info
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>ReplyWell AI Information</DialogTitle>
                <DialogDescription>
                  Comprehensive guide to using ReplyWell AI effectively
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="tips">Tips & Tricks</TabsTrigger>
                  <TabsTrigger value="compliance">NHS Compliance</TabsTrigger>
                  <TabsTrigger value="ethics">AI Ethics</TabsTrigger>
                  <TabsTrigger value="support">Support</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                  <h3 className="text-lg font-semibold">Overview</h3>
                  <p>ReplyWell AI helps NHS practices generate professional responses to correspondence using advanced AI technology.</p>
                </TabsContent>
                <TabsContent value="tips" className="space-y-4">
                  <h3 className="text-lg font-semibold">Tips & Tricks</h3>
                  <ul className="space-y-2">
                    <li>• Provide clear context notes for better responses</li>
                    <li>• Use draft mode to improve existing responses</li>
                    <li>• Adjust tone based on the correspondence type</li>
                  </ul>
                </TabsContent>
                <TabsContent value="compliance" className="space-y-4">
                  <h3 className="text-lg font-semibold">NHS Compliance</h3>
                  <p>All generated responses follow NHS communication guidelines and maintain professional standards.</p>
                </TabsContent>
                <TabsContent value="ethics" className="space-y-4">
                  <h3 className="text-lg font-semibold">AI Ethics</h3>
                  <p>ReplyWell AI is designed to assist, not replace, human judgment in correspondence.</p>
                </TabsContent>
                <TabsContent value="support" className="space-y-4">
                  <h3 className="text-lg font-semibold">Support</h3>
                  <p>For technical support, contact your system administrator.</p>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          <Button onClick={resetForm} variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            New Communication
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Incoming Correspondence
              </CardTitle>
              <CardDescription>
                Paste the email or message you need to respond to
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste the incoming email or correspondence here..."
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                className="min-h-[120px]"
              />
              <div className="flex gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadDemo('ARRS Funding')}
                >
                  ARRS Funding Demo
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadDemo('CQC Request')}
                >
                  CQC Request Demo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                File Attachments
              </CardTitle>
              <CardDescription>
                Upload supporting documents (.pdf, .doc, .ppt, .jpg, .png)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop files here or click to browse
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Management Context
              </CardTitle>
              <CardDescription>
                Provide additional context about the situation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Additional context notes..."
                value={contextNotes}
                onChange={(e) => setContextNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Response Guidance
              </CardTitle>
              <CardDescription>
                Specific instructions for the response
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="How should the response be structured or what should it address?"
                value={responseGuidance}
                onChange={(e) => setResponseGuidance(e.target.value)}
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Draft Mode</CardTitle>
              <CardDescription>
                Improve an existing draft instead of creating new content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={draftMode}
                  onCheckedChange={setDraftMode}
                />
                <Label>Enable Draft Improvement Mode</Label>
              </div>
              {draftMode && (
                <Textarea
                  placeholder="Paste your draft text here for improvement..."
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="min-h-[100px]"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Controls & Output Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Response Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium">Reply Length: {replyLength[0]}/5</Label>
                <Slider
                  value={replyLength}
                  onValueChange={setReplyLength}
                  max={5}
                  min={1}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Brief</span>
                  <span>Comprehensive</span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-3 block">Tone Selection</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TONES.map((toneOption) => (
                    <Button
                      key={toneOption}
                      variant={tone === toneOption ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTone(toneOption)}
                      className="capitalize"
                    >
                      {toneOption}
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={generateReply} 
                className="w-full" 
                disabled={isGenerating || !emailText.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {draftMode ? 'Improve Draft' : 'Generate Reply'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {generatedReply && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Response</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{wordCount} words</Badge>
                    <Button onClick={copyToClipboard} variant="outline" size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button onClick={printReply} variant="outline" size="sm">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-1 border-b pb-2">
                    <Button variant="ghost" size="sm">
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <List className="h-4 w-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <Button variant="ghost" size="sm">
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={generatedReply}
                    onChange={(e) => setGeneratedReply(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}